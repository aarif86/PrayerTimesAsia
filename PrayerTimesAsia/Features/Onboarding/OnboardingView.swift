import SwiftUI

struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    @State private var showPlaces = false
    @State private var appeared = false

    var body: some View {
        ZStack {
            LivingSkyBackground(colors: .dawn)
            VStack(alignment: .leading, spacing: 28) {
                Spacer()
                VStack(alignment: .leading, spacing: 10) {
                    Text("Prayer Times\nAsia")
                        .font(Theme.display(52, .bold))
                        .lineSpacing(-6)
                    Text("Wherever you land in Asia, know when to pray and which way to face.")
                        .font(.title3.weight(.medium))
                        .opacity(0.9)
                }
                VStack(alignment: .leading, spacing: 16) {
                    feature("globe.asia.australia.fill", "Every country's own method",
                            "MUIS in Singapore, JAKIM in Malaysia, Kemenag in Indonesia - and sensible defaults everywhere else.")
                    feature("airplane", "Built for travel",
                            "Switches when you land, works offline, and tells you when you can shorten and combine prayers.")
                    feature("location.north.line.fill", "Qibla in one glance",
                            "A calm compass that lights up when you're facing the Kaaba.")
                }
                Spacer()
                VStack(spacing: 12) {
                    Button {
                        model.useGPS()
                        model.prefs.hasOnboarded = true
                    } label: {
                        Text("Use my location").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 16)
                            .background(.white, in: Capsule())
                            .foregroundStyle(Color(red: 0.12, green: 0.2, blue: 0.4))
                    }
                    Button("Choose a city instead") { showPlaces = true }
                        .font(.subheadline.weight(.semibold))
                    Text("No ads. No account. Your location stays on your phone.")
                        .font(.caption).opacity(0.75)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 28)
            .padding(.bottom, 20)
            .foregroundStyle(.white)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 16)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.7)) { appeared = true }
        }
        .sheet(isPresented: $showPlaces, onDismiss: {
            if model.activePlace != nil { model.prefs.hasOnboarded = true }
        }) { PlacesView() }
    }

    private func feature(_ icon: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon).font(.title3).frame(width: 30)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).opacity(0.85).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
