import Foundation

/// What to call the thing the app runs on in sentences: "your phone" on iPhone,
/// "your Mac" when the same app runs as a Mac app.
enum Device {
    #if targetEnvironment(macCatalyst)
    static let noun = "Mac"
    static let isMac = true
    #else
    static let noun = "phone"
    static let isMac = false
    #endif
}
