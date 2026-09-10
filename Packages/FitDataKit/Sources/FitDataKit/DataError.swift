import Foundation

/// Failure remains separate from a successful empty read. Never includes tokens or row bodies.
public enum DataError: Error, Equatable, Sendable {
    case invalidInput(String)
    case authenticationRequired
    case sessionChanged
    case cancelled
    case network
    case invalidResponse
    case http(status: Int, code: String?)
    case decoding
    case encoding
    case unexpectedRowCount(expected: Int, actual: Int)
    case outcomeUnknown(operation: String)
    case storage(operation: String, status: Int32?)
}

public protocol DatabaseWrite: Encodable, Sendable {
    func validate() throws(DataError)
}

public struct HTTPResponse: Sendable {
    public let status: Int
    public let headers: [String: String]
    public let body: Data
    public init(status: Int, headers: [String: String] = [:], body: Data = Data()) {
        self.status = status; self.headers = headers; self.body = body
    }
}

public protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws(DataError) -> HTTPResponse
}

public struct URLSessionTransport: HTTPTransport {
    private let session: URLSession
    public init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.timeoutIntervalForRequest = 30
        self.session = URLSession(configuration: configuration)
    }
    public func send(_ request: URLRequest) async throws(DataError) -> HTTPResponse {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw DataError.invalidResponse }
            let headers = http.allHeaderFields.reduce(into: [String: String]()) { result, pair in
                if let key = pair.key as? String, let value = pair.value as? String { result[key.lowercased()] = value }
            }
            return HTTPResponse(status: http.statusCode, headers: headers, body: data)
        } catch let error as DataError { throw error }
        catch is CancellationError { throw .cancelled }
        catch let error as URLError where error.code == .cancelled { throw .cancelled }
        catch { throw .network }
    }
}

public struct SupabaseConfiguration: Sendable {
    public let url: URL
    public let publishableKey: String
    public init(url: URL, publishableKey: String) throws(DataError) {
        guard url.scheme == "https", url.host != nil, url.user == nil, url.password == nil,
              url.query == nil, url.fragment == nil, url.path.isEmpty || url.path == "/",
              !publishableKey.isEmpty else { throw .invalidInput("Use an HTTPS Supabase project origin and publishable key") }
        self.url = url; self.publishableKey = publishableKey
    }
}

func statusError(_ response: HTTPResponse) -> DataError {
    struct Body: Decodable { let code: String?; let errorCode: String?
        enum CodingKeys: String, CodingKey { case code; case errorCode = "error_code" }
    }
    let body = try? JSONDecoder().decode(Body.self, from: response.body)
    return .http(status: response.status, code: body?.code ?? body?.errorCode)
}
