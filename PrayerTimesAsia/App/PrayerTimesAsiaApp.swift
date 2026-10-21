import SwiftUI

@main
struct PrayerTimesAsiaApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(.dark)
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { model.appBecameActive() }
                }
                .onChange(of: model.location.location) { _, location in
                    if let location { model.handle(location: location) }
                }
                .onChange(of: model.prefs) { old, _ in model.preferencesChanged(from: old) }
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        if model.prefs.hasOnboarded {
            TabView(selection: $model.selectedTab) {
                TodayView()
                    .tabItem { Label("Today", systemImage: "sun.horizon.fill") }
                    .tag(AppModel.Tab.today)
                QiblaView()
                    .tabItem { Label("Qibla", systemImage: "location.north.line.fill") }
                    .tag(AppModel.Tab.qibla)
                JourneyView()
                    .tabItem { Label("Journey", systemImage: "airplane") }
                    .tag(AppModel.Tab.journey)
                SettingsView()
                    .tabItem { Label("Settings", systemImage: "gearshape.fill") }
                    .tag(AppModel.Tab.settings)
            }
            .tint(.white)
            .onAppear { model.applyDemoTab() }
        } else {
            OnboardingView()
        }
    }
}
