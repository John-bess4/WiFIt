import Foundation

public struct AuthSession: Codable, Equatable, Sendable {
    public let userID: UUID
    public let accessToken: String
    public let refreshToken: String
    public let expiresAt: Date
    public init(userID: UUID, accessToken: String, refreshToken: String, expiresAt: Date) {
        self.userID = userID; self.accessToken = accessToken
        self.refreshToken = refreshToken; self.expiresAt = expiresAt
    }
}

public protocol SessionStore: Sendable {
    func load() throws(DataError) -> AuthSession?
    func save(_ session: AuthSession) throws(DataError)
    func remove() throws(DataError)
}

public struct RequestCredentials: Equatable, Sendable {
    public let userID: UUID
    public let accessToken: String
    public let generation: UUID
    public init(userID: UUID, accessToken: String, generation: UUID) {
        self.userID = userID; self.accessToken = accessToken; self.generation = generation
    }
}

public protocol AccessTokenProvider: Sendable {
    func credentials() async throws(DataError) -> RequestCredentials
    func refresh(after rejected: RequestCredentials) async throws(DataError) -> RequestCredentials
    func isCurrent(_ credentials: RequestCredentials) async -> Bool
}

public enum SessionResolution: Equatable, Sendable {
    case loggedOut
    case valid(AuthSession)
    case refreshed(AuthSession)
}

/// One instance per app process. Session generations prevent late requests from crossing sign-out/account switches.
public actor Auth: AccessTokenProvider {
    private let configuration: SupabaseConfiguration
    private let store: any SessionStore
    private let transport: any HTTPTransport
    private let now: @Sendable () -> Date
    private var session: AuthSession?
    private var loaded = false
    private var needsPersistence = false
    private var needsDeletion = false
    private var generation = UUID()
    private struct RefreshFlight {
        let id: UUID
        let generation: UUID
        let task: Task<Result<AuthSession, DataError>, Never>
    }
    private var flight: RefreshFlight?

    public init(configuration: SupabaseConfiguration, store: any SessionStore,
                transport: any HTTPTransport = URLSessionTransport(), now: @escaping @Sendable () -> Date = Date.init) {
        self.configuration = configuration; self.store = store; self.transport = transport; self.now = now
    }

    private func loadIfNeeded() throws(DataError) {
        if needsDeletion {
            try store.remove()
            needsDeletion = false
        }
        guard !loaded else { return }
        session = try store.load()
        loaded = true
        if let session, session.accessToken.isEmpty || session.refreshToken.isEmpty {
            try clearLocalSession()
            throw .authenticationRequired
        }
    }

    public func resolveSession() async throws(DataError) -> SessionResolution {
        try loadIfNeeded()
        try persistIfNeeded()
        guard let session else { return .loggedOut }
        if session.expiresAt.timeIntervalSince(now()) > 60 { return .valid(session) }
        let fresh = try await refreshSession(rejected: snapshot(session))
        return .refreshed(fresh)
    }

    public func credentials() async throws(DataError) -> RequestCredentials {
        switch try await resolveSession() {
        case .loggedOut: throw .authenticationRequired
        case .valid(let session), .refreshed(let session): return snapshot(session)
        }
    }

    public func isCurrent(_ credentials: RequestCredentials) -> Bool {
        credentials.generation == generation && session?.userID == credentials.userID
    }

    public func refresh(after rejected: RequestCredentials) async throws(DataError) -> RequestCredentials {
        snapshot(try await refreshSession(rejected: rejected))
    }

    private func snapshot(_ session: AuthSession) -> RequestCredentials {
        RequestCredentials(userID: session.userID, accessToken: session.accessToken, generation: generation)
    }

    private func persistIfNeeded() throws(DataError) {
        guard needsPersistence, let session else { return }
        try store.save(session)
        needsPersistence = false
    }

    private func refreshSession(rejected: RequestCredentials) async throws(DataError) -> AuthSession {
        try persistIfNeeded()
        guard isCurrent(rejected), let previous = session else { throw .sessionChanged }
        // A delayed 401 may arrive after a different request already rotated the token.
        if previous.accessToken != rejected.accessToken { return previous }
        let pending: RefreshFlight
        if let flight { pending = flight }
        else {
            let configuration = configuration, transport = transport, now = now
            pending = RefreshFlight(id: UUID(), generation: generation, task: Task {
                do throws(DataError) {
                    return .success(try await Self.exchange(configuration: configuration, transport: transport,
                        grant: "refresh_token", payload: ["refresh_token": previous.refreshToken],
                        previous: previous, now: now()))
                } catch { return .failure(error) }
            })
            flight = pending
        }
        let result = await pending.task.value
        guard pending.generation == generation else { throw .sessionChanged }
        // Only the first waiter persists a rotated token. Other waiters use that exact result.
        if flight?.id == pending.id {
            flight = nil
            switch result {
            case .success(let fresh):
                session = fresh
                needsPersistence = true
            case .failure(let error):
                if case .http(let status, _) = error, [400, 401, 403].contains(status) {
                    try clearLocalSession()
                    throw .authenticationRequired
                }
                // A server outage/network error is not evidence that the credentials are invalid.
                throw error
            }
        }
        switch result {
        case .success(let fresh):
            // Every waiter must observe persistence failure; no request can use a non-durable rotation.
            try persistIfNeeded()
            return fresh
        case .failure(let error): throw error
        }
    }

    public func signIn(email: String, password: String) async throws(DataError) -> AuthSession {
        guard !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !password.isEmpty else {
            throw .invalidInput("Email and password are required")
        }
        try clearLocalSession()
        let attempt = generation
        let fresh = try await Self.exchange(configuration: configuration, transport: transport,
            grant: "password", payload: ["email": email, "password": password], previous: nil, now: now())
        guard generation == attempt else { throw .sessionChanged }
        try store.save(fresh)
        session = fresh
        return fresh
    }

    /// Clears this app immediately. A failed server logout is surfaced; sister-app sessions remain independent.
    public func signOut() async throws(DataError) {
        try loadIfNeeded()
        let previous = session
        var localError: DataError?
        do { try clearLocalSession() } catch { localError = error }
        guard let previous else {
            if let localError { throw localError }
            return
        }
        var url = URLComponents(url: configuration.url.appendingPathComponent("auth/v1/logout"), resolvingAgainstBaseURL: false)!
        url.queryItems = [URLQueryItem(name: "scope", value: "local")]
        var request = URLRequest(url: url.url!)
        request.httpMethod = "POST"
        request.setValue(configuration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer " + previous.accessToken, forHTTPHeaderField: "Authorization")
        let response: HTTPResponse
        do { response = try await transport.send(request) }
        catch { throw localError ?? error }
        if let localError { throw localError }
        guard (200..<300).contains(response.status) else { throw statusError(response) }
    }

    public func clearLocalSession() throws(DataError) {
        generation = UUID()
        flight?.task.cancel(); flight = nil
        session = nil; loaded = true
        needsPersistence = false
        needsDeletion = true
        try store.remove()
        needsDeletion = false
    }

    private static func exchange(configuration: SupabaseConfiguration, transport: any HTTPTransport,
        grant: String, payload: [String: String], previous: AuthSession?, now: Date) async throws(DataError) -> AuthSession {
        var url = URLComponents(url: configuration.url.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        url.queryItems = [URLQueryItem(name: "grant_type", value: grant)]
        var request = URLRequest(url: url.url!)
        request.httpMethod = "POST"
        request.setValue(configuration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do { request.httpBody = try JSONEncoder().encode(payload) } catch { throw .encoding }
        let response = try await transport.send(request)
        guard (200..<300).contains(response.status) else { throw statusError(response) }
        struct User: Decodable { let id: UUID }
        struct Payload: Decodable {
            let access_token: String
            let refresh_token: String
            let expires_at: Double?
            let expires_in: Double?
            let user: User?
        }
        let body: Payload
        do { body = try JSONDecoder().decode(Payload.self, from: response.body) } catch { throw .decoding }
        guard !body.access_token.isEmpty, !body.refresh_token.isEmpty,
              let userID = body.user?.id ?? previous?.userID,
              let expiry = body.expires_at ?? body.expires_in.map({ now.timeIntervalSince1970 + $0 }),
              expiry.isFinite, expiry > now.timeIntervalSince1970 else { throw .decoding }
        if let previous, userID != previous.userID { throw .sessionChanged }
        return AuthSession(userID: userID, accessToken: body.access_token, refreshToken: body.refresh_token,
            expiresAt: Date(timeIntervalSince1970: expiry))
    }
}
