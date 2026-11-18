import XCTest

/// Apple's automatic accessibility audit (VoiceOver labels, Dynamic Type, clipped
/// text, contrast, touch areas) on the main screens, in the fixed demo state the
/// CI screenshots use. Every issue found is listed in the failure message.
final class AccessibilityAuditTests: XCTestCase {
    override func setUp() {
        continueAfterFailure = true
    }

    /// One screen of the app: the launch arguments that open it.
    private struct Screen {
        let name: String
        let arguments: [String]
    }

    private let screens: [Screen] = [
        Screen(name: "Prayer, centre", arguments: ["-demo", "-tab", "today", "-centre"]),
        Screen(name: "Prayer, list", arguments: ["-demo", "-tab", "today", "-sidedial"]),
        Screen(name: "Prayer, dial", arguments: ["-demo", "-tab", "today", "-dial"]),
        Screen(name: "Prayer, sun path, light", arguments: ["-demo", "-tab", "today", "-sunpath", "-light"]),
        Screen(name: "Prayer, bands", arguments: ["-demo", "-tab", "today", "-bands"]),
        Screen(name: "Prayer, travelling", arguments: ["-demo-travel", "-tab", "today"]),
        Screen(name: "Qibla", arguments: ["-demo", "-tab", "qibla"]),
        Screen(name: "Falak", arguments: ["-demo", "-tab", "falak"]),
        Screen(name: "Settings", arguments: ["-demo", "-tab", "settings"]),
        Screen(name: "Journey", arguments: ["-demo-travel", "-tab", "journey"]),
        Screen(name: "Wake up", arguments: ["-demo", "-tab", "wakeup", "-wake"]),
    ]

    private func audit(_ screen: Screen, extra: [String] = [], types: XCUIAccessibilityAuditType) throws -> [String] {
        let app = XCUIApplication()
        // -still stops the moving sky: the audit times out on a screen that keeps changing.
        app.launchArguments = ["-still"] + screen.arguments + extra
        app.launch()
        // Let the sky, times and tab settle.
        _ = app.tabBars.firstMatch.waitForExistence(timeout: 10)
        sleep(2)
        var found: [String] = []
        try app.performAccessibilityAudit(for: types) { issue in
            let element = issue.element.map { e -> String in
                let label = e.label.isEmpty ? e.identifier : e.label
                return " [\(e.elementType.rawValue)] \"\(label.prefix(60))\""
            } ?? ""
            if Self.accepted(issue) { return true }
            found.append("\(screen.name)\(extra.isEmpty ? "" : " " + extra.joined(separator: " ")): \(Self.name(issue.auditType)): \(issue.compactDescription)\(element)")
            return true
        }
        app.terminate()
        return found
    }

    /// Issues we accept on purpose, each for a reason:
    /// - Text inside the round dials is sized to the circle, not to the text size setting,
    ///   so it never spills out of the dial. VoiceOver reads the dial as one full sentence.
    /// - The system "Done" button in a sheet's top bar: Apple draws it and caps its size.
    private static func accepted(_ issue: XCUIAccessibilityAuditIssue) -> Bool {
        guard let e = issue.element else { return false }
        if issue.auditType == .dynamicType || issue.auditType == .textClipped {
            if e.identifier == "dial-centre" { return true }
            if e.elementType == .button && e.label == "Done" { return true }
        }
        return false
    }

    private static func name(_ t: XCUIAccessibilityAuditType) -> String {
        switch t {
        case .contrast: "contrast"
        case .elementDetection: "elementDetection"
        case .hitRegion: "hitRegion"
        case .sufficientElementDescription: "description"
        case .dynamicType: "dynamicType"
        case .textClipped: "textClipped"
        case .trait: "trait"
        default: "other(\(t.rawValue))"
        }
    }

    func testMainScreensAtNormalSize() throws {
        var issues: [String] = []
        // Colour contrast is left out here: the audit cannot measure text on the moving sky
        // and its gradients. Contrast is checked by hand against 7 to 1 for white text.
        var types = XCUIAccessibilityAuditType.all
        types.remove(.contrast)
        for screen in screens { issues += try audit(screen, types: types) }
        report(issues)
    }

    func testMainScreensAtLargestTextSize() throws {
        var issues: [String] = []
        let largest = ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        for screen in screens { issues += try audit(screen, extra: largest, types: [.textClipped, .dynamicType, .hitRegion]) }
        report(issues)
    }

    private func report(_ issues: [String]) {
        for line in issues { print("A11Y-ISSUE \(line)") }
        XCTAssertTrue(issues.isEmpty, "\(issues.count) accessibility issues:\n" + issues.joined(separator: "\n"))
    }
}
