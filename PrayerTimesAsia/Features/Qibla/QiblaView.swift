import SwiftUI

/// Qibla compass. The dial turns with the phone so the Kaaba marker always sits
/// at the true qibla; line it up with the top marker and the dial lights up.
struct QiblaView: View {
    @Environment(AppModel.self) private var model
    @State private var aligned = false
    /// Heading accumulated without wrapping, so crossing north turns the dial a
    /// few degrees instead of spinning it the long way round.
    @State private var dialHeading: Double = 0
    @State private var lastHeading: Double?

    private let tolerance = 4.0

    var body: some View {
        let location = model.location
        let place = model.activePlace
        ZStack {
            LivingSkyBackground(colors: .evening)
            if let place {
                let bearing = Geo.qiblaBearing(from: place.coordinates)
                let heading = location.heading
                let delta = heading.map { Geo.angleDelta(bearing, $0) }
                VStack(spacing: 22) {
                    VStack(spacing: 6) {
                        Text("Qibla").font(Theme.display(34, .bold))
                            .accessibilityAddTraits(.isHeader)
                        Text(instruction(delta))
                            .font(.title3.weight(.semibold))
                            .contentTransition(.numericText())
                            .opacity(0.9)
                        Button { model.selectedTab = .falak } label: { Chip(text: "Check with the sun", systemImage: "sun.max.fill") }
                            .buttonStyle(.plain)
                            .padding(.top, 6)
                            .accessibilityHint("Falak Mode: find the qibla and prayer times from the sun")
                    }
                    .padding(.top, 12)

                    Spacer(minLength: 0)
                    Dial(bearing: bearing, heading: dialHeading, aligned: aligned)
                        .frame(maxWidth: 340)
                        .padding(.horizontal, 24)
                    Spacer(minLength: 0)

                    GlassCard {
                        HStack {
                            stat("\(Int(bearing.rounded()))° \(Geo.compassPoint(bearing))", "from true north")
                            Divider().frame(height: 34).overlay(Color.primary.opacity(0.3))
                            stat("\(Int(Geo.distanceKm(place.coordinates, Geo.kaaba).rounded()).formatted()) km", "to Makkah")
                        }
                    }
                    footnote(location: location)
                }
                .padding(.horizontal, Theme.gutter)
                .padding(.bottom, 24)
                .onChange(of: delta.map { abs($0) < tolerance } ?? false) { _, now in aligned = now }
                .onChange(of: heading) { _, new in
                    guard let new else { return }
                    if let last = lastHeading { dialHeading += Geo.angleDelta(new, last) } else { dialHeading = new }
                    lastHeading = new
                }
            } else {
                Text("Choose a place to find the qibla.").font(.headline)
            }
        }
        .foregroundStyle(.primary)
        .sensoryFeedback(.success, trigger: aligned) { _, now in now }
        .onAppear { location.beginHeading() }
        .onDisappear { location.endHeading() }
    }

    private func instruction(_ delta: Double?) -> String {
        guard let delta else { return "Point the top of your phone \(Int(Geo.qiblaBearing(from: model.activePlace!.coordinates).rounded()))° from north" }
        if abs(delta) < tolerance { return "You're facing the Qibla" }
        let deg = Int(abs(delta).rounded())
        return delta > 0 ? "Turn right \(deg)°" : "Turn left \(deg)°"
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(Theme.display(20)).monospacedDigit()
            Text(label).font(.caption).opacity(0.75)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func footnote(location: LocationService) -> some View {
        if !location.headingAvailable {
            Text("This device has no compass. Use the bearing above with a landmark or a map.")
        } else if location.headingAccuracy < 0 || location.headingAccuracy > 25 {
            Label("Low accuracy - move your phone in a figure-8 and keep away from metal.", systemImage: "exclamationmark.triangle")
        } else {
            Text("Hold your phone flat, away from magnets and metal.")
        }
    }
}

private struct Dial: View {
    let bearing: Double
    let heading: Double
    let aligned: Bool

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            ZStack {
                // Fixed "you are pointing here" marker at the top.
                Capsule().fill(Color.primary).frame(width: 4, height: 22).offset(y: -size / 2 - 6)

                ZStack {
                    Circle().fill(Color.primary.opacity(aligned ? 0.16 : 0.07))
                    Circle().strokeBorder(Color.primary.opacity(0.25), lineWidth: 1)
                    ForEach(0..<72, id: \.self) { i in
                        Capsule()
                            .fill(Color.primary.opacity(i % 18 == 0 ? 0.9 : (i % 6 == 0 ? 0.55 : 0.25)))
                            .frame(width: i % 6 == 0 ? 2 : 1, height: i % 6 == 0 ? 12 : 6)
                            .offset(y: -size / 2 + 14)
                            .rotationEffect(.degrees(Double(i) * 5))
                    }
                    ForEach(Array(["N", "E", "S", "W"].enumerated()), id: \.offset) { i, letter in
                        Text(letter)
                            .font(.headline.weight(i == 0 ? .heavy : .semibold))
                            .foregroundStyle(i == 0 ? Color(red: 1, green: 0.55, blue: 0.45) : Color.primary.opacity(0.8))
                            .rotationEffect(.degrees(-Double(i) * 90 + heading))
                            .offset(y: -size / 2 + 38)
                            .rotationEffect(.degrees(Double(i) * 90))
                    }
                    // Qibla pointer
                    ZStack {
                        Capsule()
                            .fill(LinearGradient(colors: [Theme.gold, Color.primary.opacity(0.1)],
                                                 startPoint: .top, endPoint: .bottom))
                            .frame(width: 6, height: size * 0.36)
                            .offset(y: -size * 0.18)
                        KaabaGlyph()
                            .frame(width: 34, height: 34)
                            .offset(y: -size * 0.36 - 4)
                    }
                    .rotationEffect(.degrees(bearing))
                    Circle().fill(Color.primary).frame(width: 10, height: 10)
                }
                .rotationEffect(.degrees(-heading))
                .animation(.interpolatingSpring(stiffness: 60, damping: 14), value: heading)
            }
            .frame(width: size, height: size)
            .position(x: geo.size.width / 2, y: geo.size.height / 2)
            .shadow(color: aligned ? Theme.gold.opacity(0.6) : .clear, radius: 30)
            .animation(.easeInOut(duration: 0.3), value: aligned)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityHidden(true)
    }
}

/// A simple cube with the gold band, drawn so it scales crisply.
struct KaabaGlyph: View {
    var body: some View {
        GeometryReader { g in
            let w = g.size.width
            ZStack {
                RoundedRectangle(cornerRadius: w * 0.12).fill(Color(red: 0.08, green: 0.08, blue: 0.1))
                Rectangle().fill(Color(red: 0.95, green: 0.78, blue: 0.4)).frame(height: w * 0.12).offset(y: -w * 0.18)
                RoundedRectangle(cornerRadius: w * 0.12).strokeBorder(Color.primary.opacity(0.85), lineWidth: 1.5)
            }
        }
    }
}
