import Foundation
import Security

/// Use different service names per app. No shared access group or synchronizable credentials by default.
public struct KeychainSessionStore: SessionStore {
    private let service: String
    private let account: String
    public init(service: String, account: String = "supabase-session") {
        self.service = service; self.account = account
    }
    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
         kSecAttrAccount as String: account, kSecAttrSynchronizable as String: false]
    }
    public func load() throws(DataError) -> AuthSession? {
        var query = query
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &value)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = value as? Data else { throw .storage(operation: "read", status: status) }
        do { return try JSONDecoder().decode(AuthSession.self, from: data) }
        catch { throw .storage(operation: "decode", status: nil) }
    }
    public func save(_ session: AuthSession) throws(DataError) {
        let data: Data
        do { data = try JSONEncoder().encode(session) } catch { throw .storage(operation: "encode", status: nil) }
        let values: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status = SecItemUpdate(query as CFDictionary, values as CFDictionary)
        if status == errSecItemNotFound {
            let insert = query.merging(values) { _, new in new }
            let added = SecItemAdd(insert as CFDictionary, nil)
            guard added == errSecSuccess else { throw .storage(operation: "insert", status: added) }
        } else if status != errSecSuccess { throw .storage(operation: "update", status: status) }
    }
    public func remove() throws(DataError) {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw .storage(operation: "delete", status: status) }
    }
}
