#if os(macOS)
import Foundation
import Security
import XCTest
@testable import FitDataKit

/// Real SecItem integration on macOS. This does not prove signed iOS entitlement
/// or locked-device behavior. Every item has a unique synthetic service/account.
final class KeychainSessionStoreTests: XCTestCase {
    func testRealKeychainCRUDAndServiceIsolation() throws {
        // The legacy process-local switch is used only by this macOS test to
        // prevent a locked/unavailable Keychain from opening user prompts.
        var interactionAllowed: DarwinBoolean = false
        let readInteraction = SecKeychainGetUserInteractionAllowed(&interactionAllowed)
        guard readInteraction == errSecSuccess else {
            throw XCTSkip("Cannot disable Keychain prompts in this macOS test process: " + String(readInteraction))
        }
        let disableInteraction = SecKeychainSetUserInteractionAllowed(false)
        guard disableInteraction == errSecSuccess else {
            throw XCTSkip("Cannot disable Keychain prompts in this macOS test process: " + String(disableInteraction))
        }
        defer {
            XCTAssertEqual(SecKeychainSetUserInteractionAllowed(interactionAllowed.boolValue), errSecSuccess,
                           "Restore the process's Keychain interaction setting.")
        }

        let identifier = UUID().uuidString
        let account = "synthetic-session-" + identifier
        let first = KeychainSessionStore(service: "com.wifit.fitdatakit.tests.first." + identifier, account: account)
        let second = KeychainSessionStore(service: "com.wifit.fitdatakit.tests.second." + identifier, account: account)
        var wroteFirst = false
        var wroteSecond = false
        defer {
            if wroteFirst {
                do { try first.remove() }
                catch { XCTFail("Failed to remove the first synthetic Keychain test item: " + String(describing: error)) }
            }
            if wroteSecond {
                do { try second.remove() }
                catch { XCTFail("Failed to remove the second synthetic Keychain test item: " + String(describing: error)) }
            }
        }

        let user = UUID()
        let initial = AuthSession(userID: user, accessToken: "synthetic-access-initial",
                                  refreshToken: "synthetic-refresh-initial",
                                  expiresAt: Date(timeIntervalSince1970: 1_900_000_000))
        let updated = AuthSession(userID: user, accessToken: "synthetic-access-updated",
                                  refreshToken: "synthetic-refresh-updated",
                                  expiresAt: Date(timeIntervalSince1970: 1_900_003_600))
        let independent = AuthSession(userID: UUID(), accessToken: "synthetic-independent-access",
                                      refreshToken: "synthetic-independent-refresh",
                                      expiresAt: Date(timeIntervalSince1970: 1_900_000_000))

        do {
            let missingFirst = try first.load()
            let missingSecond = try second.load()
            XCTAssertNil(missingFirst)
            XCTAssertNil(missingSecond)
            try first.save(initial)
            wroteFirst = true
            let insertedFirst = try first.load()
            let stillMissingSecond = try second.load()
            XCTAssertEqual(insertedFirst, initial)
            XCTAssertNil(stillMissingSecond, "A different app service must not see the first session.")

            try second.save(independent)
            wroteSecond = true
            let insertedSecond = try second.load()
            XCTAssertEqual(insertedSecond, independent)
            try first.save(updated)
            let updatedFirst = try first.load()
            let unaffectedSecond = try second.load()
            XCTAssertEqual(updatedFirst, updated, "Update must replace both access and refresh tokens durably.")
            XCTAssertEqual(unaffectedSecond, independent, "Updating one service must not modify another.")

            try first.remove()
            wroteFirst = false
            let deletedFirst = try first.load()
            let remainingSecond = try second.load()
            XCTAssertNil(deletedFirst)
            XCTAssertEqual(remainingSecond, independent, "Deleting one service must not remove another.")
            try first.remove() // Removing an already-absent entry is idempotent.
            try second.remove()
            wroteSecond = false
            let deletedSecond = try second.load()
            XCTAssertNil(deletedSecond)
        } catch {
            if case .storage(_, let status) = error, let status,
               [errSecInteractionNotAllowed, errSecNotAvailable, errSecAuthFailed, errSecMissingEntitlement].contains(status) {
                throw XCTSkip("Real macOS Keychain access unavailable without user interaction or entitlements (OSStatus "
                              + String(status) + "). CRUD/isolation is not verified by this run.")
            }
            throw error
        }
    }
}
#endif
