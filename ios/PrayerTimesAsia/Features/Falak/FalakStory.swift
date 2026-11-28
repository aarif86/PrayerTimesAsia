import SwiftUI

// Falak for everyone (Nov 2026): the sky slider, the "Then" story and
// "Why it helps". Same words and pictures as the web app (web/src/ui/Falak.tsx).

// MARK: - Slide the sun

/// A picture of today's sky you can slide with your finger. East is on the
/// left, so the sun moves the same way as the finger, morning to night.
struct SkySliderCard: View {
    @Environment(AppModel.self) private var model
    @Environment(\.look) private var look
    let place: Place
    let now: Date
    /// Minutes since the start of the slider; nil follows the clock.
    @State private var picked: Double?

    private var cal: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: place.timeZoneID) ?? .current
        return c
    }

    var body: some View {
        if let day = model.day(containing: now) {
            // The whole day, midnight to midnight, so the night can be explored too.
            let start = cal.startOfDay(for: day.time(.dhuhr))
            let end = cal.date(byAdding: .day, value: 1, to: start) ?? start.addingTimeInterval(86_400)
            let span = end.timeIntervalSince(start) / 60
            let clock = min(max(now.timeIntervalSince(start) / 60, 0), span)
            let t = start.addingTimeInterval((picked ?? clock) * 60)
            let stage = Falak.skyStage(t, times: day.times)
            let ymd = model.ymd(t)
            let plan = Falak.shadowDay(year: ymd.0, month: ymd.1, day: ymd.2, coordinates: place.coordinates)
            // Small surprises while you slide: the last third of the night, midday stillness.
            let fajr = day.time(.fajr)
            let lastThird = t >= Falak.lastThirdStart(maghrib: day.time(.maghrib), fajr: fajr) && t < fajr
            let atNoon = abs(t.timeIntervalSince(plan.noon)) <= 15 * 60
            VStack(alignment: .leading, spacing: 12) {
                SkyPicture(day: day, plan: plan, t: t, coordinates: place.coordinates, school: model.asrSchool, stage: stage, look: look, lastThird: lastThird)
                    .frame(height: 170)
                    .clipShape(RoundedRectangle(cornerRadius: look == .bands ? 0 : 18, style: .continuous))
                    .accessibilityHidden(true)
                HStack(alignment: .firstTextBaseline) {
                    Text(title(stage)).lookFont(look == .simple ? 34 : 28, .bold, design: .rounded)
                    Spacer()
                    Text(model.formatted(t)).lookFont(13, .medium).monospacedDigit()
                        .foregroundStyle(look.palette.tx2)
                }
                Text(lastThird ? W("falak.lastThirdSay") : atNoon ? W("falak.noonSay", ["name": name(.dhuhr)]) : say(stage))
                    .lookFont(15).foregroundStyle(look.palette.tx2)
                    .fixedSize(horizontal: false, vertical: true)
                if lastThird { HadithView(id: .lastThird, style: .line) }
                Slider(value: Binding(get: { picked ?? clock }, set: { picked = $0 }), in: 0...span)
                    .tint(look.palette.actx)
                    .accessibilityLabel(W("falak.slideSun"))
                    .accessibilityValue("\(model.formatted(t)), \(title(stage))")
                HStack {
                    Text(W("falak.east")).font(.caption2.weight(.semibold)).opacity(0.6)
                    Spacer()
                    Text(W("falak.slideSun")).font(.caption.weight(.semibold)).opacity(0.7)
                    Spacer()
                    Text(W("falak.west")).font(.caption2.weight(.semibold)).opacity(0.6)
                }
                if picked != nil {
                    Button(W("common.now")) { withAnimation(.snappy) { picked = nil } }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(look.palette.actx)
                        .frame(maxWidth: .infinity)
                        .accessibilityHint(W("phone.falak.sunBack"))
                }
            }
            .modifier(SkyCardStyle())
            .sensoryFeedback(.selection, trigger: stage)
        }
    }

    private func name(_ p: Prayer) -> String { p.name(model.naming) }

    private func title(_ s: Falak.SkyStage) -> String {
        switch s {
        case .night: W("falak.stageNight")
        case .fajr: name(.fajr)
        case .sunrise: W("falak.stageSunrise")
        case .morning: W("falak.stageMorning")
        case .dhuhr: name(.dhuhr)
        case .asr: name(.asr)
        case .maghrib: name(.maghrib)
        case .isha: name(.isha)
        }
    }

    private func say(_ s: Falak.SkyStage) -> String {
        switch s {
        case .night: W("falak.stageNightSay", ["name": name(.fajr)])
        case .fajr: W("falak.stageFajrSay", ["name": name(.fajr)])
        case .sunrise: W("falak.stageSunriseSay", ["name": name(.fajr)])
        case .morning: W("falak.stageMorningSay")
        case .dhuhr: W("falak.stageDhuhrSay")
        case .asr: W("falak.stageAsrSay")
        case .maghrib: W("falak.stageMaghribSay")
        case .isha: W("falak.stageIshaSay")
        }
    }
}

/// The sky card's frame: a look card, or in Colour Bands a flat full width strip.
private struct SkyCardStyle: ViewModifier {
    @Environment(\.look) private var look

    func body(content: Content) -> some View {
        if look == .bands {
            content
                .padding(.horizontal, 24).padding(.vertical, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(look.palette.card)
                .overlay(Rectangle().strokeBorder(look.palette.sep, lineWidth: 1))
                .padding(.horizontal, -Theme.gutter)
        } else {
            content.lookCard(padding: 14)
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
    let stage: Falak.SkyStage
    let look: TodayStyle
    var lastThird = false

    /// 0 new moon, 0.5 full, from the average lunar month (good to about a day).
    private var moonPhase: Double {
        let synodic = 29.530588853 * 86_400
        let newMoon = Date(timeIntervalSince1970: 947_182_440) // 2000-01-06 18:14 UTC
        let x = t.timeIntervalSince(newMoon).truncatingRemainder(dividingBy: synodic)
        return (x < 0 ? x + synodic : x) / synodic
    }

    var body: some View {
        let pal = look.palette
        Canvas { ctx, size in
            let w = size.width, h = size.height
            let ground = h * 0.78, stickX = w / 2, stick: CGFloat = 44
            let sun = Falak.sunPosition(at: t, coordinates: coordinates)
            // Sky.
            // In daylight the sky takes the look's own colours, as on the web. Dawn, dusk and night keep real ones.
            let lit = sun.altitude > 0 && stage != .fajr && stage != .maghrib
            let colors = lit ? [pal.fk1, pal.fk2] : skyColors(sun.altitude)
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
                     with: .color(lit ? pal.ground : (sun.altitude > 0 ? Color(red: 0.36, green: 0.55, blue: 0.33) : Color(red: 0.12, green: 0.2, blue: 0.16))))
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
                // Stars, brighter in the last third of the night.
                for i in 0..<(lastThird ? 26 : 14) {
                    let sx = Double((i * 73) % 343) / 343 * w, sy = Double((i * 37) % 100 + 8) / 170 * h
                    let r: CGFloat = lastThird ? 1.6 : 1.2
                    ctx.fill(Path(ellipseIn: CGRect(x: sx, y: sy, width: r * 2, height: r * 2)), with: .color(.white.opacity(lastThird ? 0.95 : 0.7)))
                }
                // The moon shows today's real phase and crosses the night sky, east to west.
                let night0 = day.time(.maghrib), night1 = day.time(.fajr).addingTimeInterval(86_400)
                let np = (t.timeIntervalSince(night0).truncatingRemainder(dividingBy: 86_400) + 86_400)
                    .truncatingRemainder(dividingBy: 86_400) / max(night1.timeIntervalSince(night0), 1)
                if np >= 0 && np <= 1 {
                    let wd = Double(w), gd = Double(ground)
                    let mx: Double = 44 + (wd - 88) * np
                    let my: Double = gd - 34 - (gd - 64) * sin(Double.pi * np)
                    let r: Double = 9
                    let k: Double = cos(2 * Double.pi * moonPhase)
                    let sign: Double = moonPhase < 0.5 ? 1 : -1
                    ctx.fill(Path(ellipseIn: CGRect(x: mx - r, y: my - r, width: 2 * r, height: 2 * r)), with: .color(.white.opacity(0.12)))
                    var lit = Path()
                    for i in 0...24 {
                        let a = -Double.pi / 2 + Double.pi * Double(i) / 24
                        let pt = CGPoint(x: mx + sign * r * cos(a), y: my + r * sin(a))
                        if i == 0 { lit.move(to: pt) } else { lit.addLine(to: pt) }
                    }
                    for i in 0...24 {
                        let a = Double.pi / 2 - Double.pi * Double(i) / 24
                        lit.addLine(to: CGPoint(x: mx + sign * k * r * cos(a), y: my + r * sin(a)))
                    }
                    ctx.fill(lit, with: .color(Color(red: 0.95, green: 0.94, blue: 0.9)))
                }
            }
            // Asr mark: the shadow reaches here in the afternoon (it points east, to the left).
            let asrLen = stick * CGFloat(plan.asrShadow(height: 1, school: school))
            let asrX = stickX - asrLen
            var mark = Path()
            mark.move(to: CGPoint(x: asrX, y: ground - 7)); mark.addLine(to: CGPoint(x: asrX, y: ground + 9))
            ctx.stroke(mark, with: .color(Color(red: 1, green: 0.8, blue: 0.25)), style: StrokeStyle(lineWidth: 3, lineCap: .round))
            ctx.draw(Text(W("settings.asr")).font(.caption2.weight(.bold)).foregroundStyle(Color(red: 1, green: 0.85, blue: 0.4)),
                     at: CGPoint(x: asrX, y: ground + 20))
            // The shadow: away from the sun.
            if sun.altitude > 0.5 {
                let len = min(CGFloat(Falak.shadowLength(height: 1, altitude: sun.altitude)) * stick, w)
                let toLeft = t >= plan.noon
                var s = Path()
                s.move(to: CGPoint(x: stickX, y: ground + 1))
                s.addLine(to: CGPoint(x: toLeft ? stickX - len : stickX + len, y: ground + 1))
                ctx.stroke(s, with: .color(lit ? (look == .bands ? Color.white : pal.actx) : Color.black.opacity(0.55)), style: StrokeStyle(lineWidth: 5, lineCap: .round))
            }
            // The stick.
            var st = Path()
            st.move(to: CGPoint(x: stickX, y: ground)); st.addLine(to: CGPoint(x: stickX, y: ground - stick))
            ctx.stroke(st, with: .color(lit ? pal.stick : Color(red: 0.42, green: 0.28, blue: 0.16)), style: StrokeStyle(lineWidth: 4, lineCap: .round))
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
            StoryCard(symbol: "sparkles", tint: Theme.gold, title: W("falak.then1Title"),
                      text: W("falak.then1")) {
                HadithView(id: .falakJibril, style: .line)
            }
            StoryCard(symbol: "figure.walk", tint: .orange, title: W("falak.then2Title"),
                      text: W("falak.then2", ["dhuhr": n(.dhuhr), "asr": n(.asr)]),
                      word: W("falak.then2Word")) {
                HadithView(id: .falakFeet, style: .line)
            }
            StoryCard(symbol: "sunrise.fill", tint: .pink, title: W("falak.then3Title"),
                      text: W("falak.then3", ["isha": n(.isha), "fajr": n(.fajr)]),
                      word: W("falak.then3Word")) {
                HadithView(id: .falakDawn, style: .line)
            }
            StoryCard(symbol: "building.columns.fill", tint: .teal, title: W("falak.then4Title"),
                      text: W("falak.then4"),
                      word: W("falak.then4Word")) { EmptyView() }
            StoryCard(symbol: "location.north.line.fill", tint: .green, title: W("falak.then5Title"),
                      text: W("falak.then5")) { EmptyView() }
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
        .lookCard(padding: 16)
    }
}

// MARK: - Why it helps

struct WhyItHelps: View {
    var body: some View {
        VStack(spacing: 14) {
            VStack(spacing: 0) {
                row("eye.fill", .blue, W("falak.why1Title"), W("falak.why1"))
                Divider().padding(.leading, 60)
                row("antenna.radiowaves.left.and.right.slash", .green, W("falak.why2Title"), W("falak.why2"))
                Divider().padding(.leading, 60)
                row("calendar", .orange, W("falak.why3Title"), W("falak.why3"))
                Divider().padding(.leading, 60)
                row("building.columns.fill", .teal, W("falak.why4Title"), W("falak.why4"))
            }
            .lookCard(padding: 0)
            VStack(alignment: .leading, spacing: 6) {
                Label(W("falak.authority"), systemImage: "checkmark.seal.fill")
                    .font(.headline).foregroundStyle(Theme.gold)
                Text(W("falak.authoritySub"))
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
