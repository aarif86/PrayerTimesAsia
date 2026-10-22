import SwiftUI

@main
struct PrayerTimesAsiaApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(model.prefs.appearance.colorScheme)
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
                FalakView(isTab: true)
                    .tabItem { Label { Text("Falak") } icon: { Image("FalakTab") } }
                    .tag(AppModel.Tab.falak)
                NearbyView()
                    .tabItem { Label("Masjid", systemImage: "moon.stars.fill") }
                    .tag(AppModel.Tab.nearby)
                JourneyView()
                    .tabItem { Label("Journey", systemImage: "airplane") }
                    .tag(AppModel.Tab.journey)
            }
            .tint(.primary)
            .onAppear { model.applyDemoTab() }
            .sheet(isPresented: $model.showSettings) { SettingsView() }
        } else {
            OnboardingView()
                .environment(\.colorScheme, .dark)
        }
    }
}

extension Appearance {
    var colorScheme: ColorScheme? {
        switch self {
        case .system: nil
        case .light: .light
        case .dark: .dark
        }
    }
}
