import SwiftUI

/// The large widget's face, in each of the Prayer screen's styles: a mini
/// version of the list, the Day Dial, the Sun Path or the Colour Bands. Every
/// style shows how long until the next prayer.
/// Shared so the app can show it too (Settings preview, CI).
struct TimetableCard: View {
    let snapshot: WidgetSnapshot?
    let date: Date
    var style: TodayStyle = .list

    var body: some View {
        if let s = snapshot, let day = s.day(containing: date) {
            switch style {
            case .list: list(s, day: day)
            case .dial, .centre: dial(s, day: day)
            case .sunPath: sunPath(s, day: day)
            case .bands: bands(s, day: day)
            }
        } else {
            Text("Open Prayer Times Asia to set your location.")
                .font(.headline)
                .foregroundStyle(.white)
                .padding()
        }
    }

    /// What goes behind the card: the Living Sky, or charcoal for the bands.
    @ViewBuilder
    static func background(_ snapshot: WidgetSnapshot?, at date: Date, style: TodayStyle) -> some View {
        if style == .bands { BandsPalette.header } else { sky(snapshot, at: date) }
    }

    // MARK: Side Dial (a mini version of the list)

    private func list(_ s: WidgetSnapshot, day: PrayerDay) -> some View {
        let current = s.current(at: date)?.prayer
        let countdown = countdownRow(s, day: day)
        return VStack(spacing: 8) {
            header(s, day: day)
            VStack(spacing: 2) {
                ForEach(Prayer.allCases) { prayer in
                    row(s, prayer: prayer, time: day.time(prayer), isCurrent: prayer == current,
                        countdown: countdown?.prayer == prayer ? countdown : nil)
                }
            }
            .padding(5)
            .background(Color.black.opacity(0.18), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.white.opacity(0.1), lineWidth: 1))
        }
        .padding(12)
        .foregroundStyle(.white)
    }

    // MARK: Day Dial

    /// The 24-hour ring with the current prayer and countdown inside, the six
    /// times underneath.
    private func dial(_ s: WidgetSnapshot, day: PrayerDay) -> some View {
        let current = s.current(at: date)
        let next = s.next(after: date)
        return VStack(spacing: 8) {
            HStack(spacing: 14) {
                ZStack {
                    DialRing(day: day, now: date, timeZone: s.timeZone)
                    if let current, let next {
                        VStack(spacing: 0) {
                            Text(s.name(current.prayer, at: current.time))
                                .font(.system(size: 17, weight: .bold, design: .rounded))
                            Text(timerInterval: date...max(date, next.time), countsDown: true)
                                .font(.system(size: 13, weight: .semibold, design: .rounded)).monospacedDigit()
                                .multilineTextAlignment(.center)
                                .foregroundStyle(Color(red: 0.97, green: 0.74, blue: 0.56))
                        }
                        .frame(width: 84)
                        .lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
                .frame(width: 136, height: 136)
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(s.placeName) \(s.flag)").font(.system(size: 15, weight: .semibold)).lineLimit(1)
                    Text(Hijri.format(date, timeZone: s.timeZone, style: s.naming, adjustment: s.hijriAdjustment ?? 0))
                        .font(.system(size: 12)).opacity(0.75).lineLimit(2)
                    if let next {
                        Text("Next: \(s.name(next.prayer, at: next.time)) \(s.format(next.time))")
                            .font(.system(size: 12, weight: .semibold)).opacity(0.9).lineLimit(1).minimumScaleFactor(0.8)
                    }
                }
                Spacer(minLength: 0)
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 3), spacing: 6) {
                ForEach(Prayer.allCases) { prayer in
                    let time = day.time(prayer)
                    let isCurrent = prayer == current?.prayer
                    VStack(spacing: 1) {
                        Text(s.name(prayer, at: time)).font(.system(size: 12, weight: .semibold)).opacity(0.85)
                        Text(s.format(time)).font(.system(size: 16, weight: .semibold, design: .rounded)).monospacedDigit()
                    }
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .frame(maxWidth: .infinity).padding(.vertical, 7)
                    .background(prayer.tint.opacity(isCurrent ? 0.35 : 0.14), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(prayer.tint.opacity(isCurrent ? 0.8 : 0), lineWidth: 1))
                    .opacity(time <= date && !isCurrent ? 0.6 : 1)
                }
            }
        }
        .padding(14)
        .foregroundStyle(.white)
    }

    // MARK: Sun Path

    /// The sun's arc over the day with each prayer on it, then the list.
    private func sunPath(_ s: WidgetSnapshot, day: PrayerDay) -> some View {
        let current = s.current(at: date)
        let next = s.next(after: date)
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                if let current {
                    Circle().fill(current.prayer.tint).frame(width: 8, height: 8)
                    Text(s.name(current.prayer, at: current.time)).font(.system(size: 20, weight: .bold))
                }
                Spacer()
                if let next {
                    Text("\(s.name(next.prayer, at: next.time)) in ")
                        .font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.8))
                    + Text(next.time, style: .relative).font(.system(size: 12, weight: .semibold))
                }
            }
            .lineLimit(1).minimumScaleFactor(0.7)
            SunArc(day: day, now: date).frame(height: 64)
            VStack(spacing: 0) {
                ForEach(Prayer.allCases) { prayer in
                    let time = day.time(prayer)
                    let isCurrent = prayer == current?.prayer
                    let parts = timeParts(s, time)
                    HStack {
                        Capsule().fill(prayer.tint).frame(width: 3, height: 16)
                        Text(s.name(prayer, at: time)).font(.system(size: 15, weight: isCurrent ? .bold : .semibold))
                        Spacer()
                        Text(parts.time).font(.system(size: 18, weight: .semibold, design: .rounded)).monospacedDigit()
                        if let suffix = parts.suffix { Text(suffix).font(.system(size: 10, weight: .bold)).opacity(0.7) }
                    }
                    .padding(.horizontal, 8)
                    .frame(maxHeight: .infinity)
                    .background {
                        if isCurrent { RoundedRectangle(cornerRadius: 10, style: .continuous).fill(prayer.tint.opacity(0.25)) }
                    }
                    .opacity(time <= date && !isCurrent ? 0.6 : 1)
                }
            }
        }
        .padding(14)
        .foregroundStyle(.white)
    }

    // MARK: Colour Bands

    /// Each prayer a full-width band, like the classic Singapore timetable.
    private func bands(_ s: WidgetSnapshot, day: PrayerDay) -> some View {
        let current = s.current(at: date)?.prayer
        let countdown = countdownRow(s, day: day)
        return VStack(spacing: 0) {
            VStack(spacing: 1) {
                Text(Hijri.format(date, timeZone: s.timeZone, style: s.naming, adjustment: s.hijriAdjustment ?? 0))
                    .font(.system(size: 17, weight: .semibold, design: .rounded))
                Text("\(s.placeName) \(s.flag)  ·  \(s.sourceLabel)")
                    .font(.caption2.weight(.medium)).opacity(0.65)
            }
            .lineLimit(1)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 9)
            ForEach(Prayer.allCases) { prayer in
                let time = day.time(prayer)
                let parts = timeParts(s, time)
                let isCurrent = prayer == current
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 0) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(s.name(prayer, at: time)).font(.system(size: 21, weight: .bold))
                            if isCurrent {
                                Text("NOW").font(.system(size: 10, weight: .heavy))
                                    .padding(.horizontal, 6).padding(.vertical, 2)
                                    .background(.white.opacity(0.25), in: Capsule())
                            }
                        }
                        if let countdown, countdown.prayer == prayer {
                            countdownText(countdown).font(.system(size: 12, weight: .semibold)).opacity(0.9)
                        }
                    }
                    .lineLimit(1)
                    Spacer()
                    Text(parts.time).font(.system(size: 25, weight: .light)).monospacedDigit()
                    if let suffix = parts.suffix { Text(suffix).font(.system(size: 15, weight: .light)) }
                }
                .padding(.horizontal, 16)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(BandsPalette.color(prayer))
                .overlay(alignment: .leading) {
                    if isCurrent { Rectangle().fill(.white).frame(width: 4) }
                }
            }
        }
        .foregroundStyle(.white)
    }

    /// The sky behind the card, for the widget container and the preview.
    static func sky(_ snapshot: WidgetSnapshot?, at date: Date) -> some View {
        let colors = snapshot?.day(containing: date).map { SkyColors.at(date, day: $0) } ?? .night
        return ZStack {
            LinearGradient(colors: [colors.top.color, colors.bottom.color], startPoint: .top, endPoint: .bottom)
            RadialGradient(colors: [colors.glow.color.opacity(0.3), .clear],
                           center: UnitPoint(x: 0.5, y: 1.1), startRadius: 4, endRadius: 260)
        }
    }

    private func header(_ s: WidgetSnapshot, day: PrayerDay) -> some View {
        let f = DateFormatter()
        f.timeZone = s.timeZone
        f.dateFormat = "EEEE d MMMM"
        return VStack(spacing: 4) {
            HStack(spacing: 6) {
                Text("TODAY").font(.system(size: 10, weight: .heavy)).tracking(0.4)
                Rectangle().fill(Color.white.opacity(0.35)).frame(width: 1, height: 9)
                Text("\(s.placeName) \(s.flag)").font(.system(size: 11, weight: .semibold)).lineLimit(1)
            }
            .padding(.horizontal, 10).padding(.vertical, 4)
            .overlay(Capsule().strokeBorder(Color(red: 0.97, green: 0.74, blue: 0.56).opacity(0.75), lineWidth: 1))
            HStack(spacing: 6) {
                Text(f.string(from: day.time(.dhuhr))).font(.system(size: 14, weight: .semibold))
                Text("·").opacity(0.5)
                Text(Hijri.format(date, timeZone: s.timeZone, style: s.naming, adjustment: s.hijriAdjustment ?? 0))
                    .font(.system(size: 12)).opacity(0.7)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
    }

    private func row(_ s: WidgetSnapshot, prayer: Prayer, time: Date, isCurrent: Bool,
                     countdown: Countdown?) -> some View {
        let parts = timeParts(s, time)
        let passed = time <= date && !isCurrent
        return HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 0) {
                Text(s.name(prayer, at: time)).font(.system(size: 16, weight: .semibold))
                if isCurrent || countdown != nil {
                    HStack(spacing: 5) {
                        if isCurrent {
                            Text("NOW").font(.system(size: 9, weight: .heavy)).foregroundStyle(prayer.tint)
                        }
                        if let countdown {
                            countdownText(countdown).font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(Color(red: 0.97, green: 0.74, blue: 0.56))
                        }
                    }
                    .lineLimit(1)
                }
            }
            Spacer(minLength: 4)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(parts.time).font(.system(size: 22, weight: .semibold, design: .rounded)).monospacedDigit()
                if let suffix = parts.suffix {
                    Text(suffix).font(.system(size: 11, weight: .bold, design: .rounded)).opacity(0.7)
                }
            }
            .fixedSize()
        }
        .padding(.leading, 16).padding(.trailing, 10)
        .frame(maxHeight: .infinity)
        .background {
            if isCurrent {
                RoundedRectangle(cornerRadius: 13, style: .continuous)
                    .fill(prayer.tint.opacity(0.2))
                    .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .strokeBorder(prayer.tint.opacity(0.5), lineWidth: 1))
            }
        }
        .overlay(alignment: .leading) {
            Capsule().fill(prayer.tint.opacity(isCurrent ? 1 : 0.6)).frame(width: 3).padding(.vertical, 10).offset(x: 2)
        }
        .opacity(passed ? 0.6 : 1)
    }

    typealias Countdown = (prayer: Prayer, label: String, until: Date)

    /// Which row carries the live "in 1:23:45": the next prayer's, or once the
    /// next is tomorrow's Subuh, the one we are in ("Subuh in 7:12:03").
    private func countdownRow(_ s: WidgetSnapshot, day: PrayerDay) -> Countdown? {
        guard let next = s.next(after: date) else { return nil }
        if abs(day.time(next.prayer).timeIntervalSince(next.time)) < 60 { return (next.prayer, "in", next.time) }
        guard let current = s.current(at: date)?.prayer else { return nil }
        return (current, "\(s.name(next.prayer, at: next.time)) in", next.time)
    }

    /// Ticks by itself between timeline entries.
    private func countdownText(_ c: Countdown) -> Text {
        Text("\(c.label) ") + Text(timerInterval: date...max(date, c.until), countsDown: true).monospacedDigit()
    }

    private func timeParts(_ s: WidgetSnapshot, _ date: Date) -> (time: String, suffix: String?) {
        let f = DateFormatter()
        f.timeZone = s.timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = s.use24Hour ? "HH:mm" : "h:mm"
        let time = f.string(from: date)
        guard !s.use24Hour else { return (time, nil) }
        f.dateFormat = "a"
        return (time, f.string(from: date))
    }
}

/// The Day Dial's ring for the widget: noon at the top, each prayer's period in
/// its sky colour, a dot for now.
private struct DialRing: View {
    let day: PrayerDay
    let now: Date
    let timeZone: TimeZone

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
            ctx.stroke(arc(0, 360), with: .color(.white.opacity(0.12)), style: StrokeStyle(lineWidth: ring))
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
private struct SunArc: View {
    let day: PrayerDay
    let now: Date

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
            var line = Path()
            line.move(to: CGPoint(x: 0, y: horizon)); line.addLine(to: CGPoint(x: size.width, y: horizon))
            ctx.stroke(line, with: .color(.white.opacity(0.25)), lineWidth: 1)
            ctx.stroke(path, with: .color(Color(red: 0.97, green: 0.74, blue: 0.56).opacity(0.9)), lineWidth: 2.5)
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
