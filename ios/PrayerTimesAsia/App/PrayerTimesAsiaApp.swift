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
                // Grey notes a step stronger than the system's, so footnotes, place
                // names and distances stay easy to read on the sky in every look.
                .foregroundStyle(Color.primary, Color.primary.opacity(0.82), Color.primary.opacity(0.62))
                // "Bigger text": at least the phone's extra large size, more if the phone asks for more.
                .modifier(LargeTextModifier(on: model.prefs.largeText))
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
    // The moving opening screen (OpeningView.swift) plays over the plain navy launch screen,
    // then fades. Always on a fresh install, then as Settings > Opening screen says.
    // Skipped for the CI screenshots.
    @State private var opening: Bool?

    var body: some View {
        ZStack {
            content
            if opening ?? Self.showOpening(model.prefs) {
                OpeningView(isShowing: Binding(get: { opening ?? true }, set: { opening = $0 }))
                    .transition(.opacity).zIndex(1)
            }
        }
        // Decide once per launch, so turning it on in Settings doesn't bring it up mid-use.
        .onAppear { if opening == nil { opening = Self.showOpening(model.prefs) } }
    }

    private static func showOpening(_ prefs: Preferences) -> Bool {
        !ProcessInfo.processInfo.arguments.contains("-demo") && OpeningView.shouldShow(prefs)
    }

    @ViewBuilder private var content: some View {
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
            .sheet(isPresented: $model.showWakeUp) { WakeUpView() }
            .sheet(item: $model.pendingMasjid) { MasjidLinkSheet(link: $0) }
            .alert("Welcome back", isPresented: $model.showWelcomeBack) {
                Button("OK") {}
            } message: {
                Text("Your settings are back, just as you left them. Your phone keeps a private copy, so deleting the app never loses them.")
            }
            .fullScreenCover(isPresented: .constant(ProcessInfo.processInfo.arguments.contains("-widget-preview"))) {
                NavigationStack { WidgetPreviewView() }
            }
        } else {
            OnboardingView()
                .environment(\.colorScheme, .dark)
        }
    }
}

/// "Bigger text" in Settings, for older eyes, without going into the phone's settings.
private struct LargeTextModifier: ViewModifier {
    let on: Bool
    @Environment(\.dynamicTypeSize) private var phone

    func body(content: Content) -> some View {
        if on { content.dynamicTypeSize(max(phone, .xxxLarge)) } else { content }
    }
}
