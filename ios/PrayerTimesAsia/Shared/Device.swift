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

    /// A sentence written for a phone, said the Mac way: "Tap" becomes "Click"
    /// (and Ketik, Ketuk, Tekan become Klik). "Tekan lama" stays, since holding the
    /// mouse button down works the same. On a phone the line comes back untouched.
    static func words(_ line: String) -> String {
        #if targetEnvironment(macCatalyst)
        var out = line
        for (from, to) in macWords {
            out = out.replacingOccurrences(of: from, with: to, options: .regularExpression)
        }
        return out
        #else
        return line
        #endif
    }

    #if targetEnvironment(macCatalyst)
    private static let macWords: [(String, String)] = [
        ("\\bTouch and hold\\b", "Click and hold"), ("\\btouch and hold\\b", "click and hold"),
        ("\\bTap and hold\\b", "Right click"), ("\\btap and hold\\b", "right click"),
        ("\\bTapping\\b", "Clicking"), ("\\btapping\\b", "clicking"),
        ("\\bTapped\\b", "Clicked"), ("\\btapped\\b", "clicked"),
        ("\\bTaps\\b", "Clicks"), ("\\btaps\\b", "clicks"),
        ("\\bTap\\b", "Click"), ("\\btap\\b", "click"),
        ("\\b(Ketik|Ketuk)\\b", "Klik"), ("\\b(ketik|ketuk)\\b", "klik"),
        ("\\bTekan\\b(?! lama)", "Klik"), ("\\btekan\\b(?! lama)", "klik"),
        ("\\byour phone\\b", "your Mac"), ("\\bthis phone\\b", "this Mac"),
        ("\\btelefon anda\\b", "Mac anda"), ("\\bponsel Anda\\b", "Mac Anda"),
    ]
    #endif
}
