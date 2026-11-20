#if targetEnvironment(macCatalyst)
import UIKit

/// The Mac window: room for the side bar and the two parts of the Prayer
/// screen, without letting the screens stretch across a very wide display.
@MainActor
enum MacWindow {
    static func fit() {
        for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
            scene.sizeRestrictions?.minimumSize = CGSize(width: 900, height: 640)
            scene.sizeRestrictions?.maximumSize = CGSize(width: 1320, height: 1400)
            scene.title = "Prayer Times Asia"
        }
    }
}
#endif
