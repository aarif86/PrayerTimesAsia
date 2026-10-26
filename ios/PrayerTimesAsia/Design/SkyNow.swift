import SwiftUI

/// The Living Sky for right now at the user's place, so every tab shares the
/// Prayer screen's sky: morning blue, sunset, night. AppModel moves it on.
struct SkyNow: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        LivingSkyBackground(colors: model.skyNow)
    }
}
