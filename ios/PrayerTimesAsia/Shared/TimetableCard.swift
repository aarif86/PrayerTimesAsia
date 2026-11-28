import SwiftUI

/// The large widget's face in each of the five looks (Centre Dial, Sun Path, Colour Bands,
/// Big and Simple, Calm Gold), drawn like that look's Prayer screen. Every look shows how
/// long until the next prayer. Shared so the app can show it too (Settings preview, CI).
/// Small and Medium use WidgetFaces.swift.
struct TimetableCard: View {
    let snapshot: WidgetSnapshot?
    let date: Date
    var style: TodayStyle = .centre

    /// Each look, header and row is wrapped in AnyView on purpose: the widget
    /// draws on a small stack, and one deeply nested SwiftUI type is enough to
    /// overflow it while Swift looks the type up. When that happens the widget
    /// never draws and iOS leaves the grey placeholder bars on the Home Screen.
    var body: AnyView {
        guard let s = snapshot, let day = s.day(containing: date) else {
            return AnyView(Text(W("widget.setLocation"))
                .font(.headline)
                .foregroundStyle(WidgetPal.of(style).fg)
                .padding())
        }
        let pal = WidgetPal.of(style)
        switch style.look {
        case .sunPath: return AnyView(sunPath(s, day: day, pal: pal))
        case .bands: return AnyView(bands(s, day: day, pal: pal))
        case .simple: return AnyView(simple(s, day: day, pal: pal))
        default: return AnyView(dial(s, day: day, pal: pal, gold: style.look == .gold))
        }
    }

    /// What goes behind the card.
    static func background(_ snapshot: WidgetSnapshot?, at date: Date, style: TodayStyle) -> AnyView {
        AnyView(WidgetBackdrop(snapshot: snapshot, date: date, style: style))
    }

    // MARK: Centre Dial and Calm Gold

    private func dial(_ s: WidgetSnapshot, day: PrayerDay, pal: WidgetPal, gold: Bool) -> some View {
        let next = s.next(after: date)
        return VStack(spacing: 8) {
            HStack(spacing: 14) {
                AnyView(WidgetDialFace(snapshot: s, day: day, date: date, pal: pal, gold: gold, size: 132))
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(s.placeName) \(s.flag)").font(.system(size: 15, weight: .bold)).lineLimit(1)
                    Text(WidgetText.dateLine(s, date: date, day: day))
                        .font(.system(size: 12)).foregroundStyle(pal.fg2).lineLimit(2)
                    if let next {
                        Text(W("today.nextAria", ["name": s.name(next.prayer, at: next.time), "time": s.format(next.time)]))
                            .font(.system(size: 12, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.8)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 6)
            AnyView(WidgetList(snapshot: s, day: day, date: date, style: gold ? .gold : .centre, size: 15, compact: false))
        }
        .padding(12)
        .foregroundStyle(pal.fg)
    }

    // MARK: Sun Path

    private func sunPath(_ s: WidgetSnapshot, day: PrayerDay, pal: WidgetPal) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("\(s.placeName) \(s.flag)").font(.system(size: 12, weight: .semibold))
                Spacer()
                Text(WidgetText.dateLine(s, date: date, day: day)).font(.system(size: 11)).lineLimit(1).minimumScaleFactor(0.7)
            }
            .foregroundStyle(pal.fg2)
            .padding(.horizontal, 6)
            AnyView(WidgetSunHero(snapshot: s, day: day, date: date, pal: pal, big: true))
                .padding(.horizontal, 6)
            SunArc(day: day, now: date, ink: pal.fg, line: Color(red: 0.85, green: 0.45, blue: 0.18))
                .frame(height: 56)
                .padding(.horizontal, 6)
            AnyView(WidgetList(snapshot: s, day: day, date: date, style: .sunPath, size: 15, compact: false))
        }
        .padding(12)
        .foregroundStyle(pal.fg)
    }

    // MARK: Big and Simple

    private func simple(_ s: WidgetSnapshot, day: PrayerDay, pal: WidgetPal) -> some View {
        VStack(spacing: 6) {
            Text("\(s.placeName) \(s.flag)  ·  \(Hijri.format(date, timeZone: s.timeZone, style: s.naming, adjustment: s.hijriAdjustment ?? 0))")
                .font(.system(size: 11, weight: .medium)).foregroundStyle(pal.fg2).lineLimit(1).minimumScaleFactor(0.7)
            AnyView(WidgetSimpleHero(snapshot: s, date: date, pal: pal, nameSize: 38, countSize: 20))
            AnyView(WidgetList(snapshot: s, day: day, date: date, style: .simple, size: 18, compact: false))
        }
        .padding(12)
        .foregroundStyle(pal.fg)
    }

    // MARK: Colour Bands

    /// A header with the prayer and the countdown, the date bar, then each prayer a full-width band.
    private func bands(_ s: WidgetSnapshot, day: PrayerDay, pal: WidgetPal) -> some View {
        let lead = PrayerLead(current: s.current(at: date), next: s.next(after: date))
        let next = s.next(after: date)
        return VStack(spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                if let lead {
                    Text(s.name(lead.prayer, at: lead.time)).font(.system(size: 26, weight: .bold))
                }
                if let next {
                    (Text(lead?.isNext == true ? Wsplit("today.in").0 : "\(s.name(next.prayer, at: next.time)) \(Wsplit("today.in").0)")
                     + Text(timerInterval: date...max(date, next.time), countsDown: true).monospacedDigit())
                        .font(.system(size: 14, weight: .medium)).foregroundStyle(pal.fg2)
                }
                Spacer(minLength: 0)
            }
            .lineLimit(1).minimumScaleFactor(0.7)
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 8)
            Text(WidgetText.dateLine(s, date: date, day: day))
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(1).minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity).padding(.vertical, 5)
                .background(pal.bar)
            AnyView(WidgetList(snapshot: s, day: day, date: date, style: .bands, size: 19, compact: false))
        }
        .foregroundStyle(pal.fg)
    }
}

/// The Day Dial's ring for the widget: noon at the top, each prayer's period in
/// its sky colour, a dot for now.
struct DialRing: View {
    let day: PrayerDay
    let now: Date
    let timeZone: TimeZone
    var ink: Color = .white

    var body: some View {
        Canvas { ctx, size in
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = timeZone
            let midnight = cal.startOfDay(for: day.time(.dhuhr))
            func angle(_ d: Date) -> Double { d.timeIntervalSince(midnight) / 86_400 * 360 + 180 }
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let ring = size.width * 0.09
            let r = size.width / 2 - ring * 0.7
            func arc(_ a0: Double, _ a1: Double) -> Path {
                var p = Path()
                p.addArc(center: c, radius: r, startAngle: .degrees(a0 - 90), endAngle: .degrees(a1 - 90), clockwise: false)
                return p
            }
            ctx.stroke(arc(0, 360), with: .color(ink.opacity(0.12)), style: StrokeStyle(lineWidth: ring))
            let order = Prayer.allCases
            for (i, prayer) in order.enumerated() {
                let start = angle(day.time(prayer))
                let end = i + 1 < order.count ? angle(day.time(order[i + 1])) : angle(day.time(.fajr)) + 360
                ctx.stroke(arc(start + 1.2, end - 1.2), with: .color(prayer.tint), style: StrokeStyle(lineWidth: ring))
            }
            let a = (angle(now) - 90) * .pi / 180
            let dot = CGPoint(x: c.x + cos(a) * r, y: c.y + sin(a) * r)
            let k = ring * 0.62
            ctx.fill(Path(ellipseIn: CGRect(x: dot.x - k, y: dot.y - k, width: k * 2, height: k * 2)), with: .color(.white))
            ctx.stroke(Path(ellipseIn: CGRect(x: dot.x - k, y: dot.y - k, width: k * 2, height: k * 2)),
                       with: .color(Color(red: 0.97, green: 0.74, blue: 0.56)), lineWidth: 2.5)
        }
    }
}

/// A smooth arc for the sun from Subuh to Isyak: above the horizon between
/// sunrise and Maghrib, each prayer marked, the sun where it is now.
struct SunArc: View {
    let day: PrayerDay
    let now: Date
    var ink: Color = .white
    var line: Color = Color(red: 0.97, green: 0.74, blue: 0.56)

    var body: some View {
        Canvas { ctx, size in
            let start = day.time(.fajr).addingTimeInterval(-3600), end = day.time(.isha).addingTimeInterval(3600)
            let rise = day.time(.sunrise), set = day.time(.maghrib)
            let horizon = size.height * 0.68
            func x(_ d: Date) -> Double { d.timeIntervalSince(start) / end.timeIntervalSince(start) * size.width }
            func y(_ d: Date) -> Double {
                let f = d.timeIntervalSince(rise) / set.timeIntervalSince(rise)
                let h = sin(.pi * f)   // 1 at solar noon, below 0 at night
                return horizon - h * (h > 0 ? horizon - 6 : size.height - horizon - 4)
            }
            var path = Path()
            for i in 0...60 {
                let d = start.addingTimeInterval(end.timeIntervalSince(start) * Double(i) / 60)
                let p = CGPoint(x: x(d), y: y(d))
                if i == 0 { path.move(to: p) } else { path.addLine(to: p) }
            }
            var horizonLine = Path()
            horizonLine.move(to: CGPoint(x: 0, y: horizon)); horizonLine.addLine(to: CGPoint(x: size.width, y: horizon))
            ctx.stroke(horizonLine, with: .color(ink.opacity(0.25)), lineWidth: 1)
            ctx.stroke(path, with: .color(line.opacity(0.9)), lineWidth: 2.5)
            for prayer in Prayer.allCases {
                let p = CGPoint(x: x(day.time(prayer)), y: y(day.time(prayer)))
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 3.5, y: p.y - 3.5, width: 7, height: 7)), with: .color(prayer.tint))
            }
            if now > start && now < end {
                let p = CGPoint(x: x(now), y: y(now))
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 12, y: p.y - 12, width: 24, height: 24)),
                         with: .color(Color(red: 1, green: 0.8, blue: 0.5).opacity(0.35)))
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 6, y: p.y - 6, width: 12, height: 12)),
                         with: .color(Color(red: 1, green: 0.85, blue: 0.6)))
            }
        }
    }
}

/// Calm Gold's ring: one thin gold line, a faint full circle, a gold dot where now is.
struct GoldRing: View {
    let day: PrayerDay
    let now: Date
    let timeZone: TimeZone
    var gold: Color

    var body: some View {
        Canvas { ctx, size in
            var cal = Calendar(identifier: .gregorian)
            cal.timeZone = timeZone
            let midnight = cal.startOfDay(for: day.time(.dhuhr))
            func angle(_ d: Date) -> Double { d.timeIntervalSince(midnight) / 86_400 * 360 + 180 }
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let r = size.width / 2 - 6
            var full = Path()
            full.addArc(center: c, radius: r, startAngle: .degrees(0), endAngle: .degrees(360), clockwise: false)
            ctx.stroke(full, with: .color(gold.opacity(0.35)), lineWidth: 2)
            var done = Path()
            done.addArc(center: c, radius: r, startAngle: .degrees(90), endAngle: .degrees(angle(now) - 90), clockwise: false)
            ctx.stroke(done, with: .color(gold), lineWidth: 2)
            let a = (angle(now) - 90) * .pi / 180
            let dot = CGPoint(x: c.x + cos(a) * r, y: c.y + sin(a) * r)
            ctx.fill(Path(ellipseIn: CGRect(x: dot.x - 5, y: dot.y - 5, width: 10, height: 10)), with: .color(gold))
        }
    }
}
