import SwiftUI

/// Falak Mode F1 (brief v03 §8): Qibla Day, daily rashdul qiblat, the
/// tongkat istiwa' for Zuhur and Asr, and guided sky signs. Everything here is
/// Grade F - for learning and checking, never in place of the authority's times.
struct FalakView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    /// A main tab (no Done button) or a sheet.
    var isTab = false
    @State private var showAR = false
    @State private var showLevel = false

    var body: some View {
        NavigationStack {
            ZStack {
                LivingSkyBackground(colors: .afternoon).ignoresSafeArea()
                if let place = model.activePlace {
                    TimelineView(.periodic(from: .now, by: 30)) { context in
                        ScrollView {
                            VStack(spacing: 16) {
                                header
                                tools
                                SunSafetyCard()
                                ShadowCompassCard(place: place, now: context.date)
                                QiblaDayCard(place: place, now: context.date)
                                RashdulCard(place: place, now: context.date)
                                ShadowStickCard(place: place)
                                SkySignsCard(now: context.date)
                                Text(Falak.reviewNote)
                                    .font(.footnote).opacity(0.75)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding(.horizontal, Theme.gutter)
                            .padding(.bottom, 32)
                        }
                    }
                } else {
                    Text("Choose a place first.").font(.headline)
                }
            }
            .foregroundStyle(.primary)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if !isTab { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            }
            .toolbar(isTab ? .hidden : .automatic, for: .navigationBar)
            .fullScreenCover(isPresented: $showAR) { FalakARScreen() }
            .sheet(isPresented: $showLevel) { LevelView() }
        }
    }

    private var tools: some View {
        HStack(spacing: 12) {
            tile("Camera", "AR qibla & shadow", "arkit") { showAR = true }
            tile("Level", "Ground & stick", "level.fill") { showLevel = true }
        }
    }

    private func tile(_ title: String, _ subtitle: String, _ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: symbol).font(.title2.weight(.semibold))
                    .foregroundStyle(SourceGrade.falak.tint)
                Text(title).font(.headline)
                Text(subtitle).font(.caption).opacity(0.75)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Image("FalakGlyph").resizable().frame(width: 40, height: 40)
                    .foregroundStyle(SourceGrade.falak.tint)
                    .accessibilityHidden(true)
                Text("Falak").font(Theme.display(34, .bold)).accessibilityAddTraits(.isHeader)
            }
            Text("Read the time and the qibla from the sun and its shadow, the way the muwaqqit did - no signal needed.")
                .font(.subheadline).opacity(0.9)
            HStack(spacing: 8) {
                Chip(text: "Grade F · Falak", systemImage: SourceGrade.falak.symbol)
                Chip(text: "Pending shariah review", systemImage: "hourglass")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
    }
}

// MARK: - Shared bits

private struct CardTitle: View {
    let title: String
    let symbol: String
    var body: some View {
        Label(title, systemImage: symbol).font(.headline)
    }
}

private extension AppModel {
    var placeCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal
    }

    func ymd(_ date: Date) -> (Int, Int, Int) {
        let c = placeCalendar.dateComponents([.year, .month, .day], from: date)
        return (c.year!, c.month!, c.day!)
    }

    func longDate(_ date: Date) -> String {
        var style = Date.FormatStyle(date: .complete, time: .omitted)
        style.timeZone = timeZone
        return date.formatted(style)
    }
}

private func minutesText(_ m: Double) -> String {
    let r = Int(m.rounded())
    return r == 1 || r == -1 ? "\(abs(r)) minute" : "\(abs(r)) minutes"
}

struct SunSafetyCard: View {
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "eye.trianglebadge.exclamationmark.fill")
                .font(.title2).foregroundStyle(Color(red: 1, green: 0.78, blue: 0.35))
            Text("Never look at the sun - not briefly, not through sunglasses, binoculars or your phone's camera. Look only at the shadow on the ground.")
                .font(.footnote.weight(.semibold))
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(red: 0.55, green: 0.25, blue: 0.05).opacity(0.55), in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
    }
}

// MARK: - Live shadow compass

/// Where an upright stick's shadow points right now, against the qibla line.
private struct ShadowCompassCard: View {
    @Environment(AppModel.self) private var model
    let place: Place
    let now: Date

    var body: some View {
        let sun = Falak.sunPosition(at: now, coordinates: place.coordinates)
        let qibla = Geo.qiblaBearing(from: place.coordinates)
        let shadowBearing = Astro.fix(sun.azimuth + 180, 360)
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                CardTitle(title: "The shadow right now", symbol: "sun.max.fill")
                HStack(spacing: 16) {
                    ShadowDial(qibla: qibla, shadowBearing: shadowBearing, altitude: sun.altitude)
                        .frame(width: 140, height: 140)
                    VStack(alignment: .leading, spacing: 6) {
                        if sun.altitude > 0 {
                            Text("Sun \(Int(sun.altitude.rounded()))° up, in the \(Geo.compassPoint(sun.azimuth))")
                                .font(.subheadline.weight(.semibold))
                            Text("A stick's shadow points \(Int(shadowBearing.rounded()))° \(Geo.compassPoint(shadowBearing)) and is \(String(format: "%.1f", Falak.shadowLength(height: 1, altitude: max(sun.altitude, 0.5))))× its height.")
                                .font(.footnote).opacity(0.85)
                        } else {
                            Text("The sun is below the horizon.").font(.subheadline.weight(.semibold))
                            Text("Shadow readings start after sunrise. See the sky signs below.").font(.footnote).opacity(0.85)
                        }
                        Label("Qibla \(Int(qibla.rounded()))° \(Geo.compassPoint(qibla))", systemImage: "location.north.line.fill")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Color(red: 1, green: 0.84, blue: 0.5))
                    }
                }
            }
        }
    }
}

private struct ShadowDial: View {
    let qibla: Double
    let shadowBearing: Double
    let altitude: Double

    var body: some View {
        Canvas { ctx, size in
            let r = min(size.width, size.height) / 2
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            func point(_ bearing: Double, _ length: Double) -> CGPoint {
                let a = (bearing - 90) * .pi / 180
                return CGPoint(x: c.x + cos(a) * length, y: c.y + sin(a) * length)
            }
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)), with: .color(Color.primary.opacity(0.08)))
            ctx.stroke(Path(ellipseIn: CGRect(x: c.x - r + 0.5, y: c.y - r + 0.5, width: 2 * r - 1, height: 2 * r - 1)), with: .color(Color.primary.opacity(0.3)))
            for i in 0..<4 {
                var tick = Path()
                tick.move(to: point(Double(i) * 90, r - 8)); tick.addLine(to: point(Double(i) * 90, r - 1))
                ctx.stroke(tick, with: .color(Color.primary.opacity(0.6)), lineWidth: 1.5)
            }
            ctx.draw(Text("N").font(.caption2.weight(.heavy)).foregroundStyle(Color(red: 1, green: 0.55, blue: 0.45)), at: point(0, r - 16))
            // Qibla line, dashed, through the stick.
            var q = Path()
            q.move(to: point(qibla + 180, r - 6)); q.addLine(to: point(qibla, r - 6))
            ctx.stroke(q, with: .color(Color(red: 1, green: 0.84, blue: 0.5).opacity(0.9)), style: StrokeStyle(lineWidth: 2, dash: [4, 4]))
            ctx.fill(Path(ellipseIn: CGRect(origin: point(qibla, r - 6), size: .zero).insetBy(dx: -5, dy: -5)), with: .color(Color(red: 1, green: 0.84, blue: 0.5)))
            // The shadow: longer when the sun is low.
            if altitude > 0 {
                let len = min(r - 10, max(r * 0.3, (r - 10) * 0.25 * Falak.shadowLength(height: 1, altitude: altitude)))
                var s = Path()
                s.move(to: c); s.addLine(to: point(shadowBearing, len))
                ctx.stroke(s, with: .color(.black.opacity(0.75)), style: StrokeStyle(lineWidth: 8, lineCap: .round))
            }
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - 5, y: c.y - 5, width: 10, height: 10)), with: .color(Color.primary))
        }
        .accessibilityLabel("Shadow points \(Int(shadowBearing.rounded())) degrees; qibla is \(Int(qibla.rounded())) degrees")
    }
}

// MARK: - Qibla Day

private struct QiblaDayCard: View {
    @Environment(AppModel.self) private var model
    let place: Place
    let now: Date

    var body: some View {
        let day = Falak.nextQiblaDay(after: now)
        let sun = Falak.sunPosition(at: day, coordinates: place.coordinates)
        let days = model.placeCalendar.dateComponents([.day], from: model.placeCalendar.startOfDay(for: now),
                                                       to: model.placeCalendar.startOfDay(for: day)).day ?? 0
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                CardTitle(title: "Qibla Day", symbol: "sun.max.circle.fill")
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(days <= 0 ? "Today" : "\(days)")
                        .font(Theme.display(44, .bold)).monospacedDigit()
                    if days > 0 { Text(days == 1 ? "day to go" : "days to go").font(.headline).opacity(0.85) }
                }
                Text("\(model.longDate(day)) at \(model.formatted(day)) your time")
                    .font(.subheadline.weight(.semibold))
                Text("Twice a year the sun stands directly over the Ka'bah at Makkah noon (istiwa' a'zam). At that minute, every upright shadow wherever the sun is up points straight away from the Ka'bah - the most exact qibla check there is, with nothing but a stick.")
                    .font(.footnote).opacity(0.85)
                if sun.altitude > 3 {
                    Label("Visible from here: the sun will be \(Int(sun.altitude.rounded()))° up. Stand a straight stick upright on level ground and face from the shadow's tip to its base. The day before and after also work within about half a degree.", systemImage: "checkmark.circle.fill")
                        .font(.footnote)
                } else {
                    Label("The sun is down here at that moment. Use the daily rashdul qiblat below, or the next Qibla Day.", systemImage: "moon.fill")
                        .font(.footnote)
                }
            }
        }
    }
}

// MARK: - Daily rashdul qiblat

private struct RashdulCard: View {
    @Environment(AppModel.self) private var model
    let place: Place
    let now: Date

    var body: some View {
        let ymd = model.ymd(now)
        let today = Falak.rashdulQiblat(year: ymd.0, month: ymd.1, day: ymd.2, timeZone: model.timeZone, coordinates: place.coordinates)
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                CardTitle(title: "Rashdul qiblat today", symbol: "arrow.up.and.down.and.sparkles")
                Text("The moments the sun lines up with the qibla from where you are, so any upright shadow lies along the qibla line.")
                    .font(.footnote).opacity(0.85)
                if today.isEmpty {
                    if let next = nextAlignment(after: now) {
                        Text("No alignment with the sun high enough today. Next: \(model.longDate(next.time)) at \(model.formatted(next.time)).")
                            .font(.subheadline.weight(.semibold))
                    } else {
                        Text("The sun doesn't line up with the qibla from here in the coming weeks. Use the compass or Qibla Day.")
                            .font(.subheadline.weight(.semibold))
                    }
                } else {
                    ForEach(Array(today.enumerated()), id: \.offset) { _, a in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(model.formatted(a.time)).font(Theme.display(24, .bold)).monospacedDigit()
                                if a.time < now { Text("passed").font(.caption.weight(.semibold)).opacity(0.6) }
                                Spacer()
                                Text("sun \(Int(a.altitude.rounded()))° up").font(.caption).opacity(0.75)
                            }
                            Text(a.shadowNote).font(.footnote)
                        }
                        .opacity(a.time < now ? 0.6 : 1)
                    }
                    Text("Good for about ±2 minutes either side; check that the stick is truly vertical with a plumb line or a hanging string.")
                        .font(.caption).opacity(0.7)
                }
            }
        }
    }

    private func nextAlignment(after date: Date) -> Falak.Alignment? {
        for offset in 1...60 {
            let ymd = model.ymd(date.addingTimeInterval(Double(offset) * 86_400))
            if let first = Falak.rashdulQiblat(year: ymd.0, month: ymd.1, day: ymd.2, timeZone: model.timeZone,
                                               coordinates: place.coordinates).first {
                return first
            }
        }
        return nil
    }
}

// MARK: - Tongkat istiwa'

private struct ShadowStickCard: View {
    @Environment(AppModel.self) private var model
    let place: Place
    @AppStorage("falak.stickHeight") private var height: Double = 100
    @State private var shadow: Double?
    @State private var measuredAt = Date.now

    var body: some View {
        let ymd = model.ymd(measuredAt)
        let plan = Falak.shadowDay(year: ymd.0, month: ymd.1, day: ymd.2, coordinates: place.coordinates)
        let school = model.asrSchool
        let official = model.day(containing: measuredAt)
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                CardTitle(title: "Tongkat istiwa' (shadow stick)", symbol: "ruler.fill")
                Text("Stand a straight stick upright on level ground - a pen on a table works. Measure the stick and its shadow in centimetres.")
                    .font(.footnote).opacity(0.85)

                LabeledContent("Stick height") {
                    TextField("cm", value: $height, format: .number.precision(.fractionLength(0...1)))
                        .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 90)
                }
                .font(.subheadline)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Today, for this stick").font(.subheadline.weight(.semibold))
                    row("Zawal (shortest shadow)", model.formatted(plan.noon),
                        "\(cm(plan.noonShadow(height: height))) pointing \(Geo.compassPoint(plan.noonShadowBearing))")
                    if let t = plan.asrShafii {
                        row("Asr, Shafi'i (+1× stick)", model.formatted(t), cm(plan.asrShadow(height: height, school: .standard)))
                    }
                    if let t = plan.asrHanafi {
                        row("Asr, Hanafi (+2× stick)", model.formatted(t), cm(plan.asrShadow(height: height, school: .hanafi)))
                    }
                    Text("Zuhur begins once the shadow stops shrinking and starts to grow. Asr begins when the shadow is the noon shadow plus the stick's height (twice it, for Hanafi).")
                        .font(.caption).opacity(0.75)
                    if let official {
                        Text("Your timetable: Zuhur \(model.formatted(official.time(.dhuhr))), Asr \(model.formatted(official.time(.asr))). Timetables add a few minutes of ihtiyat (precaution) on top of the sun's geometry.")
                            .font(.caption).opacity(0.75)
                    }
                }

                Divider().overlay(Color.primary.opacity(0.3))

                Text("Check a reading").font(.subheadline.weight(.semibold))
                LabeledContent("Shadow length") {
                    TextField("cm", value: $shadow, format: .number.precision(.fractionLength(0...1)))
                        .keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(width: 90)
                }
                .font(.subheadline)
                HStack {
                    DatePicker("Measured at", selection: $measuredAt, displayedComponents: .hourAndMinute)
                        .environment(\.timeZone, model.timeZone)
                    Button("Now") { measuredAt = .now }.buttonStyle(.bordered)
                }
                .font(.subheadline)

                if let shadow, let r = Falak.reading(height: height, shadow: shadow, at: measuredAt,
                                                     coordinates: place.coordinates, timeZone: model.timeZone, school: school) {
                    result(r, shadow: shadow, plan: plan, school: school)
                }
            }
        }
    }

    @ViewBuilder
    private func result(_ r: Falak.Reading, shadow: Double, plan: Falak.ShadowDay, school: AsrSchool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Chip(text: "Grade F · your observation", systemImage: SourceGrade.falak.symbol)
            Text("The sun is \(String(format: "%.1f", r.altitude))° up by your shadow.").font(.subheadline.weight(.semibold))
            if let t = r.sunTime, let off = r.offsetMinutes, let pm = r.uncertaintyMinutes {
                let side = abs(off) <= pm ? "matches the clock" :
                    (off > 0 ? "is \(minutesText(off)) ahead of the clock" : "is \(minutesText(off)) behind the clock")
                Text("That puts the sun's time at \(model.formatted(t)) (±\(Int(pm.rounded(.up))) min), which \(side).")
                    .font(.footnote)
                if abs(off) > pm {
                    Text("Usual causes: the stick isn't vertical, the ground isn't level, or the shadow tip was hard to see. Try again with a plumb line.")
                        .font(.caption).opacity(0.75)
                }
            } else {
                Text("The sun never gets that low on this side of noon today. Re-measure, or check the time.")
                    .font(.footnote)
            }
            if let reached = r.asrReached {
                let target = plan.asrShadow(height: height, school: school)
                Text(reached
                     ? "Asr (\(school == .hanafi ? "Hanafi" : "Shafi'i")) has begun by your shadow: it is past \(cm(target))."
                     : "Asr (\(school == .hanafi ? "Hanafi" : "Shafi'i")) hasn't begun by your shadow: it needs to reach \(cm(target)).")
                    .font(.footnote.weight(.semibold))
            } else {
                Text("Morning reading - before zawal. Zuhur has not begun.").font(.footnote.weight(.semibold))
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(SourceGrade.falak.tint.opacity(0.18), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func cm(_ v: Double) -> String {
        v.isFinite ? String(format: "%.1f cm", v) : "-"
    }

    private func row(_ label: String, _ time: String, _ detail: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.footnote)
                Text(detail).font(.caption).opacity(0.75)
            }
            Spacer()
            Text(time).font(.subheadline.weight(.semibold)).monospacedDigit()
        }
    }
}

// MARK: - Sky signs

private struct SkySignsCard: View {
    @Environment(AppModel.self) private var model
    let now: Date

    var body: some View {
        let day = model.day(containing: now)
        GlassCard {
            VStack(alignment: .leading, spacing: 14) {
                CardTitle(title: "Signs in the sky", symbol: "sparkles")
                Text("What the prayer times describe, so you can see them for yourself. Informational: city lights, haze and buildings hide these signs, and scholars differ on how to read dawn and twilight. Pray by your timetable.")
                    .font(.footnote).opacity(0.85)
                sign("Maghrib", .maghrib, day, "sunset",
                     "The whole disc of the sun has gone below the horizon - its upper edge has disappeared. Best seen over the sea or open land; behind hills or buildings it vanishes early, so don't pray by that.")
                sign("Isha", .isha, day, "moon.stars",
                     "The red glow (shafaq ahmar) has gone from the western sky - the view of the Shafi'i, Maliki and Hanbali schools. Imam Abu Hanifah held it is the white glow that follows it. Timetables use the sun's depth below the horizon (about 17°-18°) instead.")
                sign("Subuh", .fajr, day, "sunrise",
                     "True dawn (fajr sadiq): a thin whiteness spreading sideways along the eastern horizon, growing steadily. Not the false dawn (fajr kazib) before it: a faint upright column of light that fades again. Researchers still debate the exact depth of the sun at true dawn, so this stays informational.")
            }
        }
    }

    private func sign(_ title: String, _ prayer: Prayer, _ day: PrayerDay?, _ symbol: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol).font(.title3).frame(width: 28)
            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(prayer.name(model.naming)).font(.subheadline.weight(.semibold))
                    Spacer()
                    if let day { Text("today \(model.formatted(day.time(prayer)))").font(.caption).opacity(0.75) }
                }
                Text(text).font(.footnote).opacity(0.9)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(text)")
    }
}
