import SwiftUI

// Falak for everyone (Nov 2026): the sky slider, the "Then" story and
// "Why it helps". Same words and pictures as the web app (web/src/ui/Falak.tsx).

// MARK: - Slide the sun

/// A picture of today's sky you can slide with your finger. East is on the
/// left, so the sun moves the same way as the finger, morning to night.
struct SkySliderCard: View {
    @Environment(AppModel.self) private var model
    let place: Place
    let now: Date
    /// Minutes since the start of the slider; nil follows the clock.
    @State private var picked: Double?

    var body: some View {
        if let day = model.day(containing: now) {
            let start = day.time(.fajr).addingTimeInterval(-45 * 60)
            let end = day.time(.isha).addingTimeInterval(45 * 60)
            let span = end.timeIntervalSince(start) / 60
            let clock = min(max(now.timeIntervalSince(start) / 60, 0), span)
            let t = start.addingTimeInterval((picked ?? clock) * 60)
            let stage = Falak.skyStage(t, times: day.times)
            let ymd = model.ymd(t)
            let plan = Falak.shadowDay(year: ymd.0, month: ymd.1, day: ymd.2, coordinates: place.coordinates)
            VStack(alignment: .leading, spacing: 12) {
                SkyPicture(day: day, plan: plan, t: t, coordinates: place.coordinates, school: model.asrSchool)
                    .frame(height: 170)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .accessibilityHidden(true)
                HStack(alignment: .firstTextBaseline) {
                    Text(title(stage)).font(.title3.weight(.bold))
                    Spacer()
                    Text(model.formatted(t)).font(.title3.weight(.semibold)).monospacedDigit().opacity(0.8)
                }
                Text(say(stage)).font(.subheadline).opacity(0.85)
                    .fixedSize(horizontal: false, vertical: true)
                Slider(value: Binding(get: { picked ?? clock }, set: { picked = $0 }), in: 0...span)
                    .tint(Theme.gold)
                    .accessibilityLabel("Slide the sun")
                    .accessibilityValue("\(model.formatted(t)), \(title(stage))")
                HStack {
                    Text("East").font(.caption2.weight(.semibold)).opacity(0.6)
                    Spacer()
                    Text("Slide the sun").font(.caption.weight(.semibold)).opacity(0.7)
                    Spacer()
                    Text("West").font(.caption2.weight(.semibold)).opacity(0.6)
                }
            }
            .padding(14)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            .sensoryFeedback(.selection, trigger: stage)
        }
    }

    private func name(_ p: Prayer) -> String { p.name(model.naming) }

    private func title(_ s: Falak.SkyStage) -> String {
        switch s {
        case .night: "Night"
        case .fajr: name(.fajr)
        case .sunrise: "Sunrise"
        case .morning: "Morning"
        case .dhuhr: name(.dhuhr)
        case .asr: name(.asr)
        case .maghrib: name(.maghrib)
        case .isha: name(.isha)
        }
    }

    private func say(_ s: Falak.SkyStage) -> String {
        switch s {
        case .night: "The sky is dark. \(name(.fajr)) has not come yet."
        case .fajr: "A white line spreads along the eastern sky. \(name(.fajr)) has begun."
        case .sunrise: "The sun is up. \(name(.fajr)) time has ended."
        case .morning: "The shadow gets shorter as the sun climbs."
        case .dhuhr: "The sun has passed the middle. The shadow stopped shrinking and starts to grow."
        case .asr: "The shadow has grown one length longer than at noon."
        case .maghrib: "The sun has fully set. A red glow stays in the west."
        case .isha: "The red glow is gone. The sky is dark."
        }
    }
}

/// The drawing: sky colour, the sun on its arc, a stick and its shadow, and the
/// gold mark where the shadow reaches at Asr.
private struct SkyPicture: View {
    let day: PrayerDay
    let plan: Falak.ShadowDay
    let t: Date
    let coordinates: Coordinates
    let school: AsrSchool

    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height
            let ground = h * 0.78, stickX = w / 2, stick: CGFloat = 44
            let sun = Falak.sunPosition(at: t, coordinates: coordinates)
            // Sky.
            let colors = skyColors(sun.altitude)
            ctx.fill(Path(CGRect(x: 0, y: 0, width: w, height: ground)),
                     with: .linearGradient(Gradient(colors: colors), startPoint: .zero, endPoint: CGPoint(x: 0, y: ground)))
            // Glow on the horizon at dawn and dusk, east (left) in the morning, west (right) in the evening.
            if sun.altitude < 4 && sun.altitude > -18 {
                let morning = t < plan.noon
                let gx = morning ? 0 : w
                let glow = sun.altitude > -6 ? Color(red: 1, green: 0.45, blue: 0.3) : Color.white
                ctx.fill(Path(ellipseIn: CGRect(x: gx - w * 0.45, y: ground - 40, width: w * 0.9, height: 80)),
                         with: .radialGradient(Gradient(colors: [glow.opacity(0.55), .clear]),
                                               center: CGPoint(x: gx, y: ground), startRadius: 0, endRadius: w * 0.45))
            }
            // Ground.
            ctx.fill(Path(CGRect(x: 0, y: ground, width: w, height: h - ground)),
                     with: .color(sun.altitude > 0 ? Color(red: 0.36, green: 0.55, blue: 0.33) : Color(red: 0.12, green: 0.2, blue: 0.16)))
            // Sun along its daytime arc, east on the left.
            let rise = day.time(.sunrise), set = day.time(.maghrib)
            let f = t.timeIntervalSince(rise) / max(set.timeIntervalSince(rise), 1)
            if sun.altitude > -2 {
                let x = w * CGFloat(0.06 + 0.88 * min(max(f, 0), 1))
                let lift = max(sin(sun.altitude * .pi / 180), 0) / max(sin(plan.noonAltitude * .pi / 180), 0.2)
                let y = ground - (ground - 22) * CGFloat(min(lift, 1))
                let r: CGFloat = 13
                ctx.fill(Path(ellipseIn: CGRect(x: x - r * 2, y: y - r * 2, width: r * 4, height: r * 4)),
                         with: .radialGradient(Gradient(colors: [Color.yellow.opacity(0.5), .clear]),
                                               center: CGPoint(x: x, y: y), startRadius: r, endRadius: r * 2))
                ctx.fill(Path(ellipseIn: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r)), with: .color(Color(red: 1, green: 0.86, blue: 0.35)))
            } else {
                // A thin moon at night.
                ctx.fill(Path(ellipseIn: CGRect(x: w * 0.78, y: 20, width: 18, height: 18)), with: .color(.white.opacity(0.85)))
            }
            // Asr mark: the shadow reaches here in the afternoon (it points east, to the left).
            let asrLen = stick * CGFloat(plan.asrShadow(height: 1, school: school))
            let asrX = stickX - asrLen
            var mark = Path()
            mark.move(to: CGPoint(x: asrX, y: ground - 7)); mark.addLine(to: CGPoint(x: asrX, y: ground + 9))
            ctx.stroke(mark, with: .color(Color(red: 1, green: 0.8, blue: 0.25)), style: StrokeStyle(lineWidth: 3, lineCap: .round))
            ctx.draw(Text("Asr").font(.caption2.weight(.bold)).foregroundStyle(Color(red: 1, green: 0.85, blue: 0.4)),
                     at: CGPoint(x: asrX, y: ground + 20))
            // The shadow: away from the sun.
            if sun.altitude > 0.5 {
                let len = min(CGFloat(Falak.shadowLength(height: 1, altitude: sun.altitude)) * stick, w)
                let toLeft = t >= plan.noon
                var s = Path()
                s.move(to: CGPoint(x: stickX, y: ground + 1))
                s.addLine(to: CGPoint(x: toLeft ? stickX - len : stickX + len, y: ground + 1))
                ctx.stroke(s, with: .color(.black.opacity(0.55)), style: StrokeStyle(lineWidth: 5, lineCap: .round))
            }
            // The stick.
            var st = Path()
            st.move(to: CGPoint(x: stickX, y: ground)); st.addLine(to: CGPoint(x: stickX, y: ground - stick))
            ctx.stroke(st, with: .color(Color(red: 0.42, green: 0.28, blue: 0.16)), style: StrokeStyle(lineWidth: 4, lineCap: .round))
        }
    }

    private func skyColors(_ alt: Double) -> [Color] {
        switch alt {
        case 8...: [Color(red: 0.32, green: 0.62, blue: 0.95), Color(red: 0.66, green: 0.84, blue: 0.98)]
        case 0..<8: [Color(red: 0.35, green: 0.5, blue: 0.85), Color(red: 1, green: 0.7, blue: 0.45)]
        case -6..<0: [Color(red: 0.18, green: 0.24, blue: 0.5), Color(red: 0.95, green: 0.5, blue: 0.4)]
        case -18 ..< -6: [Color(red: 0.06, green: 0.1, blue: 0.28), Color(red: 0.25, green: 0.3, blue: 0.55)]
        default: [Color(red: 0.02, green: 0.04, blue: 0.14), Color(red: 0.06, green: 0.1, blue: 0.25)]
        }
    }
}

// MARK: - Then

struct ThenStory: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let n = { (p: Prayer) in p.name(model.naming) }
        VStack(spacing: 14) {
            StoryCard(symbol: "sparkles", tint: Theme.gold, title: "An angel taught the times",
                      text: "Jibril led the Prophet ﷺ in prayer on two days. Once at the start of each time, and once at its end.") {
                HadithView(id: .falakJibril, style: .line)
            }
            StoryCard(symbol: "figure.walk", tint: .orange, title: "A shadow told the time",
                      text: "The Companions measured their shadow with their own feet. A short shadow meant \(n(.dhuhr)). A long one meant \(n(.asr)).",
                      word: "Learn the word. Tongkat istiwa' means a shadow stick.") {
                HadithView(id: .falakFeet, style: .line)
            }
            StoryCard(symbol: "sunrise.fill", tint: .pink, title: "The sky told the rest",
                      text: "When the red glow goes, it is \(n(.isha)). When a white line spreads along the sky, it is \(n(.fajr)).",
                      word: "Learn the word. Shafaq is the glow after sunset.") {
                HadithView(id: .falakDawn, style: .line)
            }
            StoryCard(symbol: "building.columns.fill", tint: .teal, title: "Timekeepers at the masjid",
                      text: "Big masjids had a timekeeper. He used a sundial and an astrolabe to call the azan on time.",
                      word: "Learn the word. A muwaqqit is a masjid timekeeper.") { EmptyView() }
            StoryCard(symbol: "location.north.line.fill", tint: .green, title: "The sun shows the qibla",
                      text: "Twice a year the sun stands right above the Kaaba. At that minute every shadow points away from it.") { EmptyView() }
        }
    }
}

private struct StoryCard<Extra: View>: View {
    let symbol: String
    let tint: Color
    let title: String
    let text: String
    var word: String? = nil
    @ViewBuilder let extra: () -> Extra

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.system(size: 20, weight: .semibold)).foregroundStyle(.white)
                    .frame(width: 42, height: 42)
                    .background(tint.gradient, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityHidden(true)
                Text(title).font(.headline)
            }
            Text(text).font(.body).fixedSize(horizontal: false, vertical: true)
            if let word {
                Text(word).font(.footnote).italic().opacity(0.7)
            }
            extra()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
    }
}

// MARK: - Why it helps

struct WhyItHelps: View {
    var body: some View {
        VStack(spacing: 14) {
            VStack(spacing: 0) {
                row("eye.fill", .blue, "See it with your own eyes", Device.words("The times on your phone come from the sun. Now you can check them."))
                Divider().padding(.leading, 60)
                row("antenna.radiowaves.left.and.right.slash", .green, "Qibla with no signal", "Your location comes from GPS satellites, not the internet. The sun can still show the way.")
                Divider().padding(.leading, 60)
                row("calendar", .orange, "Know why times move", "The sun is a little higher or lower each day. So the times change a little too.")
                Divider().padding(.leading, 60)
                row("building.columns.fill", .teal, "Your masjid uses it too", "Official times are worked out from the sun by scholars of falak. They add a few minutes of care so nobody prays too early.")
            }
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                Label("Always follow your local religious authority", systemImage: "checkmark.seal.fill")
                    .font(.headline).foregroundStyle(Theme.gold)
                Text("City lights and haze can hide the signs. One timetable keeps us praying together.")
                    .font(.subheadline).opacity(0.85)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.gold.opacity(0.14), in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
        }
    }

    private func row(_ symbol: String, _ tint: Color, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 34, height: 34)
                .background(tint.gradient, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.body.weight(.semibold))
                Text(text).font(.footnote).opacity(0.8).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
    }
}
