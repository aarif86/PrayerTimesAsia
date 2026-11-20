#if targetEnvironment(macCatalyst)
import UIKit

/// The Mac window: room for the side bar plus one column of content, without
/// letting the screens stretch across a wide display.
@MainActor
enum MacWindow {
    static func fit() {
        for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
            scene.sizeRestrictions?.minimumSize = CGSize(width: 720, height: 680)
            scene.sizeRestrictions?.maximumSize = CGSize(width: 1100, height: 1400)
            scene.title = "Prayer Times Asia"
        }
    }
}
#endif
