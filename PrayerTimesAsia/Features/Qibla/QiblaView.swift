import SwiftUI

/// Qibla compass. The dial turns with the phone so the Kaaba marker always sits
/// at the true qibla; line it up with the top marker and the whole dial turns
/// green, with a tick, a ripple and a tap.
struct QiblaView: View {
    @Environment(AppModel.self) private var model
    @State private var aligned = false
    /// Heading accumulated without wrapping, so crossing north turns the dial a
    /// few degrees instead of spinning it the long way round.
    @State private var dialHeading: Double = 0
    @State private var lastHeading: Double?
    /// `-aligned` (CI screenshots): pretend the phone faces the qibla.
    private let demoAligned = ProcessInfo.processInfo.arguments.contains("-aligned")

    /// Lights up inside 4°, goes out past 6°, so it doesn't flicker at the edge.
    private let enter = 4.0, leave = 6.0

    var body: some View {
        let location = model.location
        let place = model.activePlace
        ZStack {
            SkyNow()
            if let place {
                let bearing = Geo.qiblaBearing(from: place.coordinates)
                let heading = demoAligned ? bearing : location.heading
                let delta = heading.map { Geo.angleDelta(bearing, $0) }
                ScrollView {
                    VStack(spacing: 20) {
                        header(delta: delta, bearing: bearing)
                        Dial(bearing: bearing, heading: dialHeading, delta: delta, aligned: aligned)
                            .frame(maxWidth: 320)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                        stats(place: place, bearing: bearing, heading: heading)
                        steps(location: location)
                    }
                    .padding(.horizontal, Theme.gutter)
                    .padding(.bottom, 24)
                }
                .scrollIndicators(.hidden)
                .onChange(of: delta) { _, d in
                    guard let d else { aligned = false; return }
                    if aligned, abs(d) > leave { aligned = false } else if !aligned, abs(d) < enter { aligned = true }
                }
                .onChange(of: heading) { _, new in
                    guard let new else { return }
                    if let last = lastHeading { dialHeading += Geo.angleDelta(new, last) } else { dialHeading = new }
                    lastHeading = new
                }
                .onAppear {
                    if demoAligned { dialHeading = bearing; aligned = true }
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

    private func header(delta: Double?, bearing: Double) -> some View {
        VStack(spacing: 8) {
            Text("Qibla").font(Theme.display(34, .bold))
                .accessibilityAddTraits(.isHeader)
            Text(instruction(delta, bearing: bearing))
                .font(.title3.weight(.semibold))
                .foregroundStyle(aligned ? Color.green : Color.primary.opacity(0.9))
                .contentTransition(.numericText())
                .animation(.snappy, value: aligned)
            Button { model.selectedTab = .falak } label: { Chip(text: "Check with the sun", systemImage: "sun.max.fill") }
                .buttonStyle(.plain)
                .accessibilityHint("Falak Mode: find the qibla from the sun")
        }
        .padding(.top, 12)
    }

    private func instruction(_ delta: Double?, bearing: Double) -> String {
        guard let delta else { return "Face \(Int(bearing.rounded()))° from north" }
        if aligned { return "You're facing the Qibla" }
        let deg = Int(abs(delta).rounded())
        return delta > 0 ? "Turn right \(deg)°" : "Turn left \(deg)°"
    }

    private func stats(place: Place, bearing: Double, heading: Double?) -> some View {
        GlassCard {
            HStack {
                stat("\(Int(bearing.rounded()))° \(Geo.compassPoint(bearing))", "Qibla")
                Divider().frame(height: 34).overlay(Color.primary.opacity(0.3))
                stat(heading.map { "\(Int(Astro.fix($0, 360).rounded()))° \(Geo.compassPoint($0))" } ?? "-", "You're facing")
                Divider().frame(height: 34).overlay(Color.primary.opacity(0.3))
                stat("\(Int(Geo.distanceKm(place.coordinates, Geo.kaaba).rounded()).formatted()) km", "To Makkah")
            }
        }
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(spacing: 3) {
            Text(label.uppercased()).font(.caption2.weight(.semibold)).tracking(0.5).opacity(0.6)
            Text(value).font(Theme.display(18)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
    }

    /// How to use it, step by step - plus a calibration note only when needed.
    private func steps(location: LocationService) -> some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("How to find the qibla").font(.headline)
                if !location.headingAvailable && !demoAligned {
                    step("map", "This phone has no compass. Use the qibla bearing above with a map, or the sun in Falak.")
                } else {
                    step("1.circle.fill", "Hold your phone flat in front of you, screen facing up.")
                    step("2.circle.fill", "Turn your whole body slowly until the Ka'bah reaches the marker at the top.")
                    step("3.circle.fill", "When the dial turns green and your phone taps, you're facing the qibla.")
                    if location.headingAccuracy < 0 || location.headingAccuracy > 25 {
                        step("exclamationmark.triangle.fill",
                             "The compass needs calibrating: wave your phone in a figure-8 a few times, away from cars, laptops and magnetic cases.",
                             tint: .orange)
                    }
                }
            }
        }
    }

    private func step(_ symbol: String, _ text: String, tint: Color = Theme.gold) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: symbol).font(.body).foregroundStyle(tint).frame(width: 22)
            Text(text).font(.subheadline).fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct Dial: View {
    let bearing: Double
    let heading: Double
    let delta: Double?
    let aligned: Bool

    private let green = Color.green

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            ZStack {
                // Fixed "you are pointing here" marker at the top.
                Capsule().fill(aligned ? green : Color.primary).frame(width: 4, height: 22).offset(y: -size / 2 - 8)

                // Face: tinted green and glowing when aligned.
                Circle()
                    .fill(aligned
                          ? AnyShapeStyle(RadialGradient(colors: [green.opacity(0.28), green.opacity(0.08)],
                                                         center: .center, startRadius: 10, endRadius: size / 2))
                          : AnyShapeStyle(Color.primary.opacity(0.07)))
                Circle()
                    .trim(from: 0, to: aligned ? 1 : 0)
                    .stroke(green, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .shadow(color: green.opacity(0.7), radius: 12)
                Circle().strokeBorder(Color.primary.opacity(aligned ? 0 : 0.25), lineWidth: 1)
                if aligned { Ripple(color: green).frame(width: size, height: size) }

                ZStack {
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
                            .foregroundStyle(i == 0 ? Theme.north : Color.primary.opacity(0.8))
                            .rotationEffect(.degrees(-Double(i) * 90 + heading))
                            .offset(y: -size / 2 + 38)
                            .rotationEffect(.degrees(Double(i) * 90))
                    }
                    // Qibla pointer, from the centre ring out to the Kaaba.
                    ZStack {
                        Capsule()
                            .fill(aligned ? AnyShapeStyle(green.opacity(0.8))
                                  : AnyShapeStyle(LinearGradient(colors: [Theme.gold, Color.primary.opacity(0.1)],
                                                                 startPoint: .top, endPoint: .bottom)))
                            .frame(width: 4, height: size * 0.14)
                            .offset(y: -size * 0.29)
                        ZStack {
                            Circle()
                                .fill(aligned ? green.opacity(0.25) : Color.clear)
                                .overlay(Circle().strokeBorder(aligned ? green : Color.clear, lineWidth: 2.5))
                                .frame(width: 52, height: 52)
                            KaabaGlyph().frame(width: 30, height: 30)
                        }
                        .rotationEffect(.degrees(-bearing + heading))
                        .offset(y: -size * 0.40)
                    }
                    .rotationEffect(.degrees(bearing))
                }
                .rotationEffect(.degrees(-heading))
                .animation(.interpolatingSpring(stiffness: 60, damping: 14), value: heading)

                // Centre: a tick when aligned, otherwise an arrow pointing at the qibla.
                Circle()
                    .fill(.ultraThinMaterial)
                    .overlay(Circle().strokeBorder(aligned ? green.opacity(0.5) : Color.primary.opacity(0.15), lineWidth: 1))
                    .frame(width: size * 0.42, height: size * 0.42)
                Group {
                    if aligned {
                        VStack(spacing: 4) {
                            Image(systemName: "checkmark")
                                .font(.system(size: size * 0.12, weight: .bold))
                                .foregroundStyle(green)
                                .symbolEffect(.bounce, value: aligned)
                            Text("Aligned").font(.subheadline.weight(.semibold))
                        }
                        .transition(.scale(scale: 0.6).combined(with: .opacity))
                    } else if let delta {
                        // A compass arrow that always points at the qibla - no numbers here.
                        Image(systemName: "location.north.fill")
                            .font(.system(size: size * 0.16, weight: .bold))
                            .foregroundStyle(Theme.gold)
                            .shadow(color: Theme.gold.opacity(0.4), radius: 8)
                            .rotationEffect(.degrees(delta))
                            .animation(.interpolatingSpring(stiffness: 60, damping: 14), value: delta)
                            .transition(.opacity)
                    } else {
                        Image(systemName: "location.north.line").font(.system(size: size * 0.08)).opacity(0.6)
                    }
                }
            }
            .frame(width: size, height: size)
            .position(x: geo.size.width / 2, y: geo.size.height / 2)
            .animation(.spring(response: 0.5, dampingFraction: 0.7), value: aligned)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(aligned ? "Facing the qibla" : "Qibla compass")
    }
}

/// A soft green ring that keeps spreading out from the dial while aligned.
private struct Ripple: View {
    let color: Color
    @State private var on = false

    var body: some View {
        Circle()
            .stroke(color.opacity(0.6), lineWidth: 2)
            .scaleEffect(on ? 1.18 : 1)
            .opacity(on ? 0 : 1)
            .onAppear {
                withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { on = true }
            }
            .allowsHitTesting(false)
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
                RoundedRectangle(cornerRadius: w * 0.12).strokeBorder(Color.white.opacity(0.85), lineWidth: 1.5)
            }
        }
    }
}
