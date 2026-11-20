#if targetEnvironment(macCatalyst)
import UIKit

/// The Mac window: a tall, fairly narrow panel, so the screens keep the shape
/// they were designed for instead of stretching across a wide display.
@MainActor
enum MacWindow {
    static func fit() {
        for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
            scene.sizeRestrictions?.minimumSize = CGSize(width: 440, height: 680)
            scene.sizeRestrictions?.maximumSize = CGSize(width: 820, height: 1400)
            scene.title = "Prayer Times Asia"
        }
    }
}
#endif
