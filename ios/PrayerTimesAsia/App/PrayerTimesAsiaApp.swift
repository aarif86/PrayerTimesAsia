import SwiftUI

@main
struct PrayerTimesAsiaApp: App {
    @State private var model = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(model.colorScheme)
                .environment(\.softNight, model.prefs.appearance == .system)
                .task {
                    while !Task.isCancelled {
                        model.tickSky()
                        try? await Task.sleep(for: .seconds(30))
                    }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { model.appBecameActive(); model.tickSky() }
                }
                .onChange(of: model.location.location) { _, location in
                    if let location { model.handle(location: location) }
                    model.tickSky()
                }
                .onChange(of: model.prefs) { old, _ in
                    model.preferencesChanged(from: old)
                    model.tickSky()
                }
                .onOpenURL { model.open(url: $0) }
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
                    .tabItem { Label { Text("Prayer") } icon: { Image("Tab-prayer") } }
                    .tag(AppModel.Tab.today)
                QiblaView()
                    .tabItem { Label { Text("Qibla") } icon: { Image("Tab-qibla") } }
                    .tag(AppModel.Tab.qibla)
                FalakView(isTab: true)
                    .tabItem { Label { Text("Falak") } icon: { Image("Tab-falak") } }
                    .tag(AppModel.Tab.falak)
                NearbyView()
                    .tabItem { Label { Text("Masjid") } icon: { Image("Tab-masjid") } }
                    .tag(AppModel.Tab.nearby)
                SettingsView(isTab: true)
                    .tabItem { Label("Settings", systemImage: "gearshape") }
                    .tag(AppModel.Tab.settings)
            }
            .tint(.primary)
            .onAppear { model.applyDemoTab() }
            .sheet(isPresented: $model.showJourney) { JourneyView() }
            .sheet(item: $model.pendingMasjid) { MasjidLinkSheet(link: $0) }
            .fullScreenCover(isPresented: .constant(ProcessInfo.processInfo.arguments.contains("-widget-preview"))) {
                NavigationStack { WidgetPreviewView() }
            }
        } else {
            OnboardingView()
                .environment(\.colorScheme, .dark)
        }
    }
}
