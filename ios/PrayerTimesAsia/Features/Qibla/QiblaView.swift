import SwiftUI

/// Qibla compass, in the look the person picked (as the web app: web/src/ui/Qibla.tsx).
/// The dial turns with the phone so the Ka'bah always sits at the true qibla; line it
/// up with the top marker and the dial glows green, with a tick, a ripple and a tap.
struct QiblaView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.look) private var look
    @State private var aligned = false
    /// Heading accumulated without wrapping, so crossing north turns the dial a
    /// few degrees instead of spinning it the long way round.
    @State private var dialHeading: Double = 0
    @State private var lastHeading: Double?
    /// `-aligned` (CI screenshots): pretend the phone faces the qibla.
    private let demoAligned = ProcessInfo.processInfo.arguments.contains("-aligned")

    /// Lights up inside 4°, goes out past 6°, so it doesn't flicker at the edge.
    private let enter = 4.0, leave = 6.0

    @ScaledMetric(relativeTo: .largeTitle) private var bigTitle: CGFloat = 38
    @ScaledMetric(relativeTo: .largeTitle) private var sunSay: CGFloat = 38
    @ScaledMetric(relativeTo: .title) private var sunSayWide: CGFloat = 28
    @ScaledMetric(relativeTo: .title) private var simpleWord: CGFloat = 26
    @ScaledMetric(relativeTo: .largeTitle) private var simpleDegrees: CGFloat = 60
    @ScaledMetric(relativeTo: .title) private var simpleSay: CGFloat = 28
    @ScaledMetric(relativeTo: .title2) private var simpleKm: CGFloat = 23
    @ScaledMetric(relativeTo: .body) private var buttonText: CGFloat = 17
    @ScaledMetric(relativeTo: .title2) private var bigButtonText: CGFloat = 23
    @ScaledMetric(relativeTo: .title3) private var bandText: CGFloat = 19

    var body: some View {
        let location = model.location
        let place = model.activePlace
        ZStack {
            SkyNow()
            if let place {
                let bearing = Geo.qiblaBearing(from: place.coordinates)
                let heading = demoAligned ? bearing : location.heading
                let delta = heading.map { Geo.angleDelta(bearing, $0) }
                GeometryReader { geo in
                    ScrollView {
                        page(reading(place: place, bearing: bearing, heading: heading, delta: delta),
                             location: location, width: geo.size.width)
                    }
                    .scrollIndicators(.hidden)
                }
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
                Text("Choose a place to find the qibla.").font(.headline).foregroundStyle(look.palette.tx)
            }
        }
        .sensoryFeedback(.success, trigger: aligned) { _, now in now }
        .onAppear { location.beginHeading() }
        .onDisappear { location.endHeading() }
    }

    // MARK: What the screen shows

    /// Everything the looks show, worked out once.
    private struct Reading {
        var bearing: Double
        var heading: Double?
        var delta: Double?
        var aligned: Bool
        var dial: QiblaDialState
        var instruction: String
        var qibla: String
        var facing: String
        var km: String
    }

    private func reading(place: Place, bearing: Double, heading: Double?, delta: Double?) -> Reading {
        let isAligned = demoAligned || aligned
        let h = heading != nil ? dialHeading : 0
        let instruction: String
        if let delta {
            let deg = Int(abs(delta).rounded())
            instruction = isAligned ? "You're facing the qibla" : (delta > 0 ? "Turn right \(deg)°" : "Turn left \(deg)°")
        } else {
            instruction = "Face \(Int(bearing.rounded()))° from north"
        }
        return Reading(
            bearing: bearing, heading: heading, delta: delta, aligned: isAligned,
            dial: QiblaDialState(heading: h, rel: bearing - h, aligned: isAligned),
            instruction: instruction,
            qibla: "\(Int(bearing.rounded()))° \(Geo.compassPoint(bearing))",
            facing: heading.map { "\(Int(Astro.fix($0, 360).rounded()))°" } ?? "…",
            km: Int(Geo.distanceKm(place.coordinates, Geo.kaaba).rounded()).formatted())
    }

    private func page(_ r: Reading, location: LocationService, width: CGFloat) -> some View {
        VStack(spacing: 0) {
            lookBody(r, width: width)
            steps(location: location)
                .padding(.top, 22)
                .padding(.horizontal, look == .bands ? 24 : Theme.gutter)
        }
        .padding(.bottom, 24)
    }

    private func lookBody(_ r: Reading, width: CGFloat) -> AnyView {
        switch look {
        case .bands: AnyView(bandsBody(r, width: width))
        case .simple: AnyView(simpleBody(r, width: width))
        case .sunPath: AnyView(sunPathBody(r, width: width))
        case .gold: AnyView(dialBody(r, dial: AnyView(GoldCompass(state: r.dial, size: qiblaDialSize(screen: width, max: 330, margin: 50)))))
        default: AnyView(dialBody(r, dial: AnyView(BezelCompass(state: r.dial, size: qiblaDialSize(screen: width, max: 340, margin: 40)))))
        }
    }

    // MARK: The looks

    /// Centre Dial and Calm Gold: title, words, dial, numbers, the sun button.
    private func dialBody(_ r: Reading, dial: AnyView) -> some View {
        VStack(spacing: 0) {
            title(Theme.screenTitle)
            say(r, font: look == .gold ? Font.headline : Font.title3.weight(.semibold),
                color: look == .gold ? look.palette.actx : look.palette.tx)
                .padding(.bottom, look == .gold ? 6 : 8)
            dial.padding(.top, 6)
            stats(r).padding(.top, 12)
            sunButton(size: buttonText, height: 54).padding(.top, 12)
        }
        .padding(.horizontal, Theme.gutter)
    }

    /// Sun Path: the sun moves along the day's curve to a fixed Ka'bah.
    private func sunPathBody(_ r: Reading, width: CGFloat) -> some View {
        let wide = r.heading == nil || r.aligned
        return VStack(spacing: 0) {
            title(Theme.screenTitle).padding(.horizontal, Theme.gutter)
            QiblaSunCurve(rel: r.delta ?? Geo.angleDelta(r.bearing, 0), aligned: r.aligned,
                          hasHeading: r.heading != nil, width: width)
            VStack(spacing: 0) {
                say(r, font: Theme.display(wide ? sunSayWide : sunSay, .bold), color: look.palette.tx)
                if r.heading != nil && !r.aligned {
                    Text("Turn until the sun reaches the Ka'bah.")
                        .font(.subheadline)
                        .foregroundStyle(look.palette.tx2)
                        .multilineTextAlignment(.center)
                        .padding(.top, 6)
                        .padding(.bottom, 4)
                }
                stats(r).padding(.top, 12)
                sunButton(size: buttonText, height: 54).padding(.top, 12)
            }
            .padding(.top, 4)
            .padding(.horizontal, Theme.gutter)
        }
    }

    /// Big and Simple: big words, one big arrow, the distance, a bigger button.
    private func simpleBody(_ r: Reading, width: CGFloat) -> some View {
        VStack(spacing: 0) {
            title(Theme.display(bigTitle, .bold))
            simpleSayView(r)
            SimpleCompass(state: r.dial, size: qiblaDialSize(screen: width, max: 300, margin: 80))
                .padding(.top, 16)
            Text("\(r.km) km to Makkah")
                .font(Theme.display(simpleKm, .semibold))
                .foregroundStyle(look.palette.tx2)
                .multilineTextAlignment(.center)
                .padding(.top, 12)
            sunButton(size: bigButtonText, height: 60).padding(.top, 14)
        }
        .padding(.horizontal, Theme.gutter)
    }

    @ViewBuilder
    private func simpleSayView(_ r: Reading) -> some View {
        if let delta = r.delta, !r.aligned {
            VStack(spacing: 2) {
                Text(delta > 0 ? "Turn right" : "Turn left").font(Theme.display(simpleWord, .bold))
                Text("\(Int(abs(delta).rounded()))°").font(Theme.display(simpleDegrees, .heavy)).monospacedDigit()
            }
            .foregroundStyle(look.palette.tx)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .contentTransition(.numericText())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(r.instruction)
        } else {
            say(r, font: Theme.display(simpleSay, .bold), color: look.palette.tx)
        }
    }

    /// Colour Bands: full width bands, square corners, the numbers as three bands.
    private func bandsBody(_ r: Reading, width: CGFloat) -> some View {
        let rows: [(String, String)] = [("Qibla", r.qibla), ("Facing", r.facing), ("To Makkah", "\(r.km) km")]
        return VStack(spacing: 0) {
            Text("Qibla")
                .font(Theme.screenTitle)
                .foregroundStyle(.white)
                .accessibilityAddTraits(.isHeader)
                .padding(.horizontal, 24)
                .frame(maxWidth: .infinity, minHeight: 80, alignment: .leading)
                .background(QiblaColors.bands[0].padding(.top, -400))
            say(r, font: Font.title3.bold(), color: look.palette.tx, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 24)
                .padding(.top, 14)
                .padding(.bottom, 4)
            BandsCompass(state: r.dial, size: qiblaDialSize(screen: width, max: 330, margin: 50))
                .padding(.top, 6)
            VStack(spacing: 0) {
                ForEach(0..<3, id: \.self) { i in
                    bandRow(rows[i].0, rows[i].1, color: QiblaColors.bands[i + 1])
                }
            }
            .padding(.top, 14)
        }
    }

    private func bandRow(_ name: String, _ value: String, color: Color) -> some View {
        HStack {
            Text(name)
            Spacer(minLength: 8)
            Text(value).font(Theme.display(bandText, .bold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
        }
        .font(.system(size: bandText, weight: .bold))
        .foregroundStyle(.white)
        .shadow(color: .black.opacity(0.25), radius: 1, y: 1)
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, minHeight: 54)
        .background(color)
        .accessibilityElement(children: .combine)
    }

    // MARK: Shared parts

    private func title(_ font: Font) -> some View {
        Text("Qibla")
            .font(font)
            .tracking(-0.5)
            .foregroundStyle(look.palette.tx)
            .accessibilityAddTraits(.isHeader)
            .padding(.top, 8)
            .padding(.bottom, 4)
    }

    /// The headline: "Turn right 175°", or "You're facing the qibla" in green.
    private func say(_ r: Reading, font: Font, color: Color, alignment: TextAlignment = .center) -> some View {
        Text(r.instruction)
            .font(font)
            .foregroundStyle(r.aligned ? QiblaColors.green : color)
            .multilineTextAlignment(alignment)
            .contentTransition(.numericText())
            .animation(.snappy, value: r.aligned)
    }

    /// QIBLA, FACING and TO MAKKAH in one card.
    private func stats(_ r: Reading) -> some View {
        HStack(spacing: 0) {
            stat("Qibla", r.qibla)
            stat("Facing", r.facing)
            stat("To Makkah", "\(r.km) km")
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 4)
        .lookCard(padding: 0)
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(label.uppercased())
                .font(.caption2.weight(.medium))
                .tracking(0.9)
                .foregroundStyle(look.palette.tx2)
            Text(value)
                .font(.headline.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(look.palette.tx)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    /// The big "Check with the sun" button in the look's button colour: opens Falak.
    private func sunButton(size: CGFloat, height: CGFloat) -> some View {
        let p = look.palette
        return Button { model.selectedTab = .falak } label: {
            HStack(spacing: 10) {
                Image(systemName: "sun.max").font(.system(size: 20, weight: .semibold)).accessibilityHidden(true)
                Text("Check with the sun").font(.system(size: size, weight: .bold))
            }
            .foregroundStyle(p.onBtn)
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, minHeight: height)
            .background(RoundedRectangle(cornerRadius: p.radius + 8, style: .continuous).fill(p.btn))
            .contentShape(RoundedRectangle(cornerRadius: p.radius + 8, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Falak Mode, find the qibla from the sun")
    }

    /// How to use it, step by step, plus a calibration note only when needed.
    private func steps(location: LocationService) -> some View {
        let p = look.palette
        let sun = look == .sunPath
        return VStack(alignment: .leading, spacing: 12) {
            Text("How to find the qibla").font(.headline).foregroundStyle(p.tx)
                .accessibilityAddTraits(.isHeader)
            if !location.headingAvailable && !demoAligned {
                step(icon: AnyView(Image(systemName: "map").foregroundStyle(p.actx)),
                     "This phone has no compass. Use the qibla bearing above with a map, or the sun in Falak.")
            } else {
                step(icon: AnyView(NumBadge(n: 1)), "Hold your phone flat in front of you, screen facing up.")
                step(icon: AnyView(NumBadge(n: 2)), sun
                     ? "Turn your whole body slowly until the sun reaches the Ka'bah."
                     : "Turn your whole body slowly until the Ka'bah reaches the marker at the top.")
                step(icon: AnyView(NumBadge(n: 3)), sun
                     ? "When the words turn green and your phone taps, you're facing the qibla."
                     : "When the dial turns green and your phone taps, you're facing the qibla.")
                if !demoAligned && (location.headingAccuracy < 0 || location.headingAccuracy > 25) {
                    step(icon: AnyView(Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.warning)),
                         "The compass needs calibrating. Wave your phone in a figure 8 a few times, away from cars, laptops and magnetic cases.")
                }
            }
        }
        .lookCard()
    }

    private func step(icon: AnyView, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            icon.font(.body).frame(width: 22).accessibilityHidden(true)
            Text(text)
                .font(.subheadline)
                .foregroundStyle(look.palette.tx2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

/// The numbered dot in the steps, in the look's colour.
private struct NumBadge: View {
    let n: Int
    @Environment(\.look) private var look
    @ScaledMetric(relativeTo: .subheadline) private var d: CGFloat = 19

    var body: some View {
        Text("\(n)")
            .font(.caption.weight(.heavy))
            .foregroundStyle(look.palette.onBtn)
            .frame(width: d, height: d)
            .background(Circle().fill(look.palette.ac))
            .padding(.top, 1)
    }
}

/// A simple cube with the gold band, drawn so it scales crisply (used by Makers).
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
