import SwiftUI

struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    @State private var showPlaces = false
    @State private var showMoveIn = false
    @State private var appeared = false

    var body: some View {
        ZStack {
            LivingSkyBackground(colors: .dawn)
            VStack(alignment: .leading, spacing: 28) {
                Spacer()
                VStack(alignment: .leading, spacing: 10) {
                    Text(W("phone.onboard.title"))
                        .font(Theme.display(52, .bold))
                        .lineSpacing(-6)
                    Text(W("welcome.tagline"))
                        .font(.title3.weight(.medium))
                        .opacity(0.9)
                }
                VStack(alignment: .leading, spacing: 16) {
                    feature("globe.asia.australia.fill", W("welcome.countryMethod"),
                            W("welcome.countryMethodDetail"))
                    feature("Tab-journey", W("welcome.travel"),
                            W("welcome.travelDetail"))
                    feature("location.north.line.fill", W("welcome.qiblaGlance"),
                            W("welcome.qiblaDetail"))
                }
                Spacer()
                VStack(spacing: 12) {
                    Button {
                        model.useGPS()
                        model.prefs.hasOnboarded = true
                        model.askForAlertsAfterWelcome()
                    } label: {
                        Text(W("welcome.useLocation")).font(.headline).frame(maxWidth: .infinity).padding(.vertical, 16)
                            .background(.white, in: Capsule())
                            .foregroundStyle(Color(red: 0.12, green: 0.2, blue: 0.4))
                    }
                    Button(W("welcome.chooseCity")) { showPlaces = true }
                        .font(.subheadline.weight(.semibold))
                    Button(W("welcome.bringIn")) { showMoveIn = true }
                        .font(.footnote.weight(.semibold))
                        .opacity(0.85)
                    Text(W("phone.welcomePrivacy"))
                        .font(.caption).opacity(0.75)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 28)
            .padding(.bottom, 20)
            .foregroundStyle(.primary)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 16)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.7)) { appeared = true }
        }
        .sheet(isPresented: $showPlaces, onDismiss: {
            if model.activePlace != nil { model.prefs.hasOnboarded = true; model.askForAlertsAfterWelcome() }
        }) { PlacesView() }
        .sheet(isPresented: $showMoveIn) {
            NavigationStack { MoveInView(isSheet: true) }
        }
    }

    private func feature(_ icon: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Group {
                // "Tab-journey" is an asset (Google's luggage icon), the rest are SF Symbols.
                if icon == "Tab-journey" { Image(icon).resizable().scaledToFit().frame(width: 22, height: 22) }
                else { Image(systemName: icon).font(.title3) }
            }
            .frame(width: 30)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).opacity(0.85).fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
