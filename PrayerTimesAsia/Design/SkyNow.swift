import SwiftUI

/// The Living Sky for this minute at the user's place, so every tab shares the
/// Prayer screen's sky: morning blue, sunset, night.
struct SkyNow: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        TimelineView(.everyMinute) { context in
            LivingSkyBackground(colors: model.day(containing: context.date)
                .map { SkyColors.at(context.date, day: $0) } ?? .night)
        }
    }
}
