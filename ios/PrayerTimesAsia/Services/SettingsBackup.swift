import Foundation
import Security

/// A quiet copy of your settings in the iPhone's keychain, so deleting and
/// reinstalling the app brings everything back with no account.
///
/// The keychain is kept by iOS when an app is deleted, and with iCloud Keychain
/// on it also travels to a new iPhone on the same Apple ID (end-to-end
/// encrypted by Apple; we never see it). No extra capability or sign in is
/// needed. The app's own copy in UserDefaults stays the one it reads; this
/// copy is only read when that one is missing (a fresh install).
enum SettingsBackup {
    private static let service = "com.prayertimesasia.settings"
    private static let account = "preferences.v1"

    /// Saves this copy. Skips the write when nothing changed since the last one.
    static func save(_ data: Data) {
        guard data != lastSaved else { return }
        lastSaved = data
        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: kCFBooleanTrue!,
        ]
        let update: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemUpdate(match as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound {
            var add = match
            add.merge(update) { $1 }
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    /// The saved copy, from this phone or (with iCloud Keychain) another one of yours.
    static func load() -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrSynchronizable as String: kSecAttrSynchronizableAny,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        lastSaved = result as? Data
        return result as? Data
    }

    nonisolated(unsafe) private static var lastSaved: Data?
}
