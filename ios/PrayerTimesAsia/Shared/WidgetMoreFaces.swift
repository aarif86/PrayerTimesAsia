import SwiftUI

/// Small helpers the newer widgets share: Now and Next, Current Prayer, Day bar and the
/// Hijri Calendar. Each face follows the look chosen on the Prayer screen, in Light and Dark,
/// the same as the other widgets. Faces are wrapped in AnyView by their widgets for the
/// reason given in TimetableCard.swift.
enum WidgetMore {
    /// When the prayer that starts at `start` ends: the next time in the snapshot.
    /// Subuh ends at Syuruk, Isyak at tomorrow's Subuh.
    static func end(after start: Date, _ s: WidgetSnapshot) -> Date? {
        s.timeline.first { $0.time > start }?.time
    }

    /// "4:17 PM to 6:54 PM".
    static func range(_ s: WidgetSnapshot, _ a: Date, _ b: Date) -> String {
        W("widget.range", ["from": s.format(a), "to": s.format(b)])
    }

    /// A live timer with its words around it: "1:34:12 left", "in 1:34:12".
    static func timer(_ key: String, _ date: Date, _ until: Date) -> Text {
        let parts = Wsplit(key)
        return Text(parts.0) + Text(timerInterval: date...max(date, until), countsDown: true).monospacedDigit() + Text(parts.1)
    }

    /// An obligatory prayer whose time has closed. Syuruk never counts, and neither does the
    /// prayer that is open now.
    static func isDone(_ prayer: Prayer, time: Date, _ s: WidgetSnapshot, _ date: Date) -> Bool {
        guard prayer != .sunrise, let end = end(after: time, s) else { return false }
        return end <= date
    }

    /// Where a Small widget sits: Colour Bands paints the whole widget in the prayer's colour,
    /// the other looks use the Prayer screen's backdrop.
    static func background(_ s: WidgetSnapshot?, date: Date, style: TodayStyle, prayer: Prayer?) -> AnyView {
        if style.look == .bands, let prayer { return AnyView(BandsPalette.color(prayer)) }
        return TimetableCard.background(s, at: date, style: style)
    }

    /// The prayer's colour for dots and bars: one gold in Calm Gold.
    static func accent(_ prayer: Prayer, style: TodayStyle, pal: WidgetPal) -> Color {
        style.look == .gold ? pal.acc : prayer.tint
    }
}

// MARK: Now and Next

/// Two halves: the prayer you are in with when it ends, and the one after with its countdown.
/// From Syuruk to Zohor no prayer is open, so it reads the next prayer and the one after it.
struct WidgetNowNextFace: View {
    let snapshot: WidgetSnapshot
    let date: Date
    let style: TodayStyle

    private struct Half {
        let label: String
        let prayer: Prayer
        let time: Date
        let detail: Text
    }

    private var halves: (Half, Half)? {
        guard let next = snapshot.next(after: date) else { return nil }
        if let open = PrayerLead.open(snapshot.current(at: date)) {
            let first = Half(label: W("today.now"), prayer: open.prayer, time: open.time,
                             detail: Text(W("widget.untilTime", ["time": snapshot.format(next.time)])))
            let second = Half(label: W("today.next"), prayer: next.prayer, time: next.time,
                              detail: WidgetMore.timer("today.in", date, next.time))
            return (first, second)
        }
        guard let after = snapshot.timeline.first(where: { $0.time > next.time }) else { return nil }
        let first = Half(label: W("today.next"), prayer: next.prayer, time: next.time,
                         detail: WidgetMore.timer("today.in", date, next.time))
        let second = Half(label: W("widget.then"), prayer: after.prayer, time: after.time,
                          detail: Text(snapshot.format(after.time)))
        return (first, second)
    }

    var body: some View {
        let pal = WidgetPal.of(style)
        if let (top, bottom) = halves {
            let bands = style.look == .bands
            VStack(spacing: 0) {
                AnyView(half(top, pal: pal, bands: bands))
                if !bands { Rectangle().fill(pal.fg2.opacity(0.35)).frame(height: 1).padding(.horizontal, 14) }
                AnyView(half(bottom, pal: pal, bands: bands))
            }
            .foregroundStyle(bands ? Color.white : pal.fg)
            .accessibilityElement(children: .combine)
        } else {
            Text(W("widget.setLocation")).font(.caption).padding().foregroundStyle(pal.fg)
        }
    }

    private func half(_ h: Half, pal: WidgetPal, bands: Bool) -> some View {
        let simple = style.look == .simple
        let size: CGFloat = simple ? 28 : 24
        return VStack(alignment: simple ? .center : .leading, spacing: 1) {
            Text(h.label).font(.system(size: 10, weight: .semibold)).tracking(0.8)
                .foregroundStyle(bands ? Color.white.opacity(0.9) : pal.fg2)
            HStack(spacing: 7) {
                if !bands && style.look != .gold {
                    Capsule().fill(h.prayer.tint).frame(width: 3, height: size - 2)
                }
                Text(Self.name(snapshot, h)).font(.system(size: size, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
                    .foregroundStyle(!bands && style.look == .gold && h.label == W("today.next") ? pal.acc : (bands ? Color.white : (simple ? pal.hero : pal.fg)))
            }
            h.detail.font(.system(size: 11, weight: .medium)).lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(bands ? Color.white.opacity(0.9) : pal.fg2)
        }
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: simple ? .center : .leading)
        .background(bands ? BandsPalette.color(h.prayer) : Color.clear)
    }

    private static func name(_ s: WidgetSnapshot, _ h: Half) -> String { s.name(h.prayer, at: h.time) }
}

// MARK: Current Prayer

/// The prayer you are in with the time it runs from and to, a progress line and what is left.
/// From Syuruk to Zohor it shows the coming prayer's time range and counts down to its start.
struct WidgetCurrentFace: View {
    let snapshot: WidgetSnapshot
    let date: Date
    let style: TodayStyle

    /// The prayer this face is about, for the Colour Bands background.
    static func prayer(_ s: WidgetSnapshot, _ date: Date) -> Prayer? {
        PrayerLead(current: s.current(at: date), next: s.next(after: date))?.prayer
    }

    var body: some View {
        let pal = WidgetPal.of(style)
        let bands = style.look == .bands
        let simple = style.look == .simple
        if let lead = PrayerLead(current: snapshot.current(at: date), next: snapshot.next(after: date)),
           let end = WidgetMore.end(after: lead.time, snapshot) {
            let ink: Color = bands ? .white : pal.fg
            let soft: Color = bands ? Color.white.opacity(0.9) : pal.fg2
            let span = max(1, end.timeIntervalSince(lead.time))
            let done = lead.isNext ? 0 : min(1, max(0, date.timeIntervalSince(lead.time) / span))
            VStack(alignment: simple ? .center : .leading, spacing: 0) {
                Text(lead.isNext ? W("today.next") : W("today.now"))
                    .font(.system(size: 10, weight: .semibold)).tracking(0.8).foregroundStyle(soft)
                Spacer(minLength: 0)
                Text(snapshot.name(lead.prayer, at: lead.time))
                    .font(.system(size: simple ? 38 : 32, weight: .bold, design: simple ? .rounded : .default))
                    .foregroundStyle(simple ? pal.hero : ink)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text(WidgetMore.range(snapshot, lead.time, end))
                    .font(.system(size: 12, weight: .medium)).foregroundStyle(soft)
                    .lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength: 0)
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(soft.opacity(0.35))
                        Capsule().fill(bands ? Color.white : WidgetMore.accent(lead.prayer, style: style, pal: pal))
                            .frame(width: g.size.width * done)
                    }
                }
                .frame(height: style.look == .gold ? 3 : 5)
                .padding(.bottom, 5)
                WidgetMore.timer(lead.isNext ? "today.in" : "widget.timeLeft", date, lead.isNext ? lead.time : end)
                    .font(.system(size: 11, weight: .medium)).foregroundStyle(soft).lineLimit(1).minimumScaleFactor(0.7)
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: simple ? .center : .leading)
            .accessibilityElement(children: .combine)
        } else {
            Text(W("widget.setLocation")).font(.caption).padding().foregroundStyle(pal.fg)
        }
    }
}

// MARK: Day bar

/// Today's five prayers on one line, the prayers that are over filled in, a marker for now.
/// Colour Bands draws the day as coloured stretches instead of a line.
struct WidgetDayBarFace: View {
    let snapshot: WidgetSnapshot
    let day: PrayerDay
    let date: Date
    let style: TodayStyle

    var body: some View {
        let pal = WidgetPal.of(style)
        let first = day.time(.fajr), last = day.time(.isha)
        let span = max(1, last.timeIntervalSince(first))
        let lead = PrayerLead(current: snapshot.current(at: date), next: snapshot.next(after: date))
        let hit = lead?.prayer
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(W("widget.today")).font(.system(size: 14, weight: .bold))
                Spacer()
                if let next = snapshot.next(after: date) {
                    WidgetMore.timer("today.nextIn", date, next.time, name: snapshot.name(next.prayer, at: next.time))
                        .font(.system(size: 12, weight: .medium)).foregroundStyle(pal.fg2).lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            GeometryReader { g in
                let x: (Date) -> CGFloat = { g.size.width * CGFloat(min(1, max(0, $0.timeIntervalSince(first) / span))) }
                ZStack(alignment: .leading) {
                    if style.look == .bands {
                        ZStack(alignment: .leading) {
                            ForEach(Prayer.obligatory, id: \.self) { p in
                                let a = x(day.time(p))
                                let b = p == .isha ? g.size.width : x(Self.next(of: p, day))
                                Rectangle().fill(BandsPalette.color(p)).opacity(b <= x(date) ? 0.5 : 1)
                                    .frame(width: max(0, b - a)).offset(x: a)
                            }
                        }
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        Rectangle().fill(pal.fg).frame(width: 3).offset(x: max(0, x(date) - 1.5))
                    } else {
                        Capsule().fill(pal.fg2.opacity(0.3)).frame(height: 4)
                        Capsule().fill(style.look == .gold ? pal.acc : Color(red: 0.91, green: 0.50, blue: 0.25))
                            .frame(width: x(date), height: 4)
                        ForEach(Prayer.obligatory, id: \.self) { p in
                            let filled = day.time(p) <= date
                            Circle().fill(filled ? WidgetMore.accent(p, style: style, pal: pal) : Color.clear)
                                .overlay(Circle().stroke(WidgetMore.accent(p, style: style, pal: pal), lineWidth: 2))
                                .frame(width: 12, height: 12).offset(x: x(day.time(p)) - 6)
                        }
                    }
                }
                .frame(maxHeight: .infinity, alignment: .center)
            }
            .frame(height: style.look == .bands ? 22 : 14)
            HStack(spacing: 0) {
                ForEach(Prayer.obligatory, id: \.self) { p in
                    VStack(spacing: 1) {
                        Text(snapshot.name(p, at: day.time(p))).font(.system(size: 11, weight: hit == p ? .bold : .medium))
                            .lineLimit(1).minimumScaleFactor(0.6)
                        Text(snapshot.format(day.time(p)).replacingOccurrences(of: " AM", with: "").replacingOccurrences(of: " PM", with: ""))
                            .font(.system(size: 11, weight: hit == p ? .bold : .regular, design: .rounded)).monospacedDigit()
                            .foregroundStyle(pal.fg2)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .foregroundStyle(pal.fg)
        .frame(maxHeight: .infinity)
    }

    /// The prayer time after `p` in the day's list (Syuruk follows Subuh).
    private static func next(of p: Prayer, _ day: PrayerDay) -> Date {
        let all = Prayer.allCases
        guard let i = all.firstIndex(of: p), i + 1 < all.count else { return day.time(.isha) }
        return day.time(all[i + 1])
    }
}

extension WidgetMore {
    /// "Maghrib in 1:34:12" built from a line with {name} and {time} holes.
    static func timer(_ key: String, _ date: Date, _ until: Date, name: String) -> Text {
        let line = W(key, ["name": name, "time": "\u{1}"]).components(separatedBy: "\u{1}")
        return Text(line.first ?? "") + Text(timerInterval: date...max(date, until), countsDown: true).monospacedDigit()
            + Text(line.count > 1 ? line[1] : "")
    }
}

// MARK: Hijri Calendar

/// One Hijri month laid out as a grid, worked out from Umm al-Qura with the user's own
/// plus or minus days, so it matches the date on the Prayer screen. Dates are expected,
/// the local religious authority decides.
struct HijriMonthGrid: Equatable {
    enum Mark: Equatable { case none, nuzul, lastTen, eid }
    struct Cell: Equatable {
        let day: Int
        let gregorianDay: Int
        let mark: Mark
        let isToday: Bool
    }

    let month: Int
    let year: Int
    /// Empty cells before day 1 (Sunday first).
    let lead: Int
    let cells: [Cell]
    /// In Ramadan, the cell after the last day: 1 Syawal.
    let eidAfter: Int?
    /// Days until the next 1 Ramadan, nil during Ramadan.
    let daysToRamadan: Int?

    init(date: Date, timeZone: TimeZone, adjustment: Int = 0) {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let h = Hijri.date(date, timeZone: timeZone, adjustment: adjustment)
        func at(_ offset: Int) -> Date { cal.date(byAdding: .day, value: offset, to: date) ?? date }
        func hijri(_ offset: Int) -> Hijri.HijriDate { Hijri.date(at(offset), timeZone: timeZone, adjustment: adjustment) }

        var length = h.day
        while length < 30, hijri(length + 1 - h.day).month == h.month { length += 1 }

        month = h.month
        year = h.year
        lead = max(0, cal.component(.weekday, from: at(1 - h.day)) - 1)
        cells = (1...length).map { d in
            let mark: Mark
            if h.month == 9 && d == 17 { mark = .nuzul }
            else if h.month == 9 && d >= 21 { mark = .lastTen }
            else if (h.month == 10 && d == 1) || (h.month == 12 && d == 10) { mark = .eid }
            else { mark = .none }
            return Cell(day: d, gregorianDay: cal.component(.day, from: at(d - h.day)), mark: mark, isToday: d == h.day)
        }
        eidAfter = h.month == 9 ? cal.component(.day, from: at(length + 1 - h.day)) : nil

        if h.month == 9 {
            daysToRamadan = nil
        } else {
            var found: Int?
            for i in 1...400 {
                let n = hijri(i)
                if n.month == 9 && n.day == 1 { found = i; break }
            }
            daysToRamadan = found
        }
    }
}

struct WidgetHijriFace: View {
    let snapshot: WidgetSnapshot
    let date: Date
    let style: TodayStyle

    var body: some View {
        let pal = WidgetPal.of(style)
        let grid = HijriMonthGrid(date: date, timeZone: snapshot.timeZone, adjustment: snapshot.hijriAdjustment ?? 0)
        let monthName = snapshot.naming.hijriMonths[max(0, min(11, grid.month - 1))]
        let accent: Color = style.look == .bands ? BandsPalette.color(.asr) : (style.look == .gold ? pal.acc : Prayer.asr.tint)
        let eidColor: Color = style.look == .bands ? BandsPalette.color(.fajr) : accent
        let onAccent: Color = style.look == .gold ? Color.wdyn(0xFFFFFF, 0x0B0F2A) : .white
        let simple = style.look == .simple
        VStack(alignment: simple ? .center : .leading, spacing: 4) {
            Text(W("widget.hijriExpected")).font(.system(size: 12)).foregroundStyle(pal.fg2)
            Text("\(monthName) \(grid.year)").font(.system(size: simple ? 30 : 24, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
            AnyView(weekdays(pal: pal))
            AnyView(days(grid, pal: pal, accent: accent, eid: eidColor, onAccent: onAccent, simple: simple))
            AnyView(legend(grid, pal: pal, accent: accent, eid: eidColor))
        }
        .padding(.horizontal, 14).padding(.vertical, 14)
        .foregroundStyle(pal.fg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func weekdays(pal: WidgetPal) -> some View {
        var cal = Calendar(identifier: .gregorian)
        cal.locale = AppWords.formatLocale
        let names = cal.shortWeekdaySymbols
        return HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { i in
                Text(names[i]).font(.system(size: 10)).foregroundStyle(pal.fg2).frame(maxWidth: .infinity)
            }
        }
        .padding(.top, 4)
    }

    private func days(_ grid: HijriMonthGrid, pal: WidgetPal, accent: Color, eid: Color, onAccent: Color, simple: Bool) -> some View {
        let slots: [Int?] = Array(repeating: nil, count: grid.lead) + grid.cells.indices.map { Optional($0) }
        let trailing = grid.eidAfter != nil
        let total = slots.count + (trailing ? 1 : 0)
        let rows = (total + 6) / 7
        return VStack(spacing: 3) {
            ForEach(0..<rows, id: \.self) { r in
                HStack(spacing: 3) {
                    ForEach(0..<7, id: \.self) { c in
                        let i = r * 7 + c
                        if i < slots.count, let idx = slots[i] {
                            AnyView(cell(grid.cells[idx], pal: pal, accent: accent, eid: eid, onAccent: onAccent, simple: simple))
                        } else if trailing, i == slots.count, let g = grid.eidAfter {
                            AnyView(eidCell(g, eid: eid))
                        } else {
                            Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                }
                .frame(maxHeight: .infinity)
            }
        }
        .frame(maxHeight: .infinity)
    }

    private func cell(_ c: HijriMonthGrid.Cell, pal: WidgetPal, accent: Color, eid: Color, onAccent: Color, simple: Bool) -> some View {
        let fill: Color = c.isToday ? accent : (c.mark == .eid ? eid : .clear)
        let text: Color = (c.isToday || c.mark == .eid) ? onAccent : pal.fg
        return ZStack(alignment: .topTrailing) {
            VStack(spacing: 0) {
                Text("\(c.day)").font(.system(size: simple ? 16 : 14, weight: c.isToday ? .bold : .semibold))
                Text("\(c.gregorianDay)").font(.system(size: 8)).opacity(0.65)
            }
            .foregroundStyle(text)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            if c.mark == .nuzul {
                Circle().fill(Color(red: 0.50, green: 0.61, blue: 0.88)).frame(width: 5, height: 5).padding(3)
            }
        }
        .background(fill, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay {
            if c.mark == .lastTen && !c.isToday {
                RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(pal.fg2.opacity(0.45), lineWidth: 1)
            }
        }
    }

    private func eidCell(_ gregorianDay: Int, eid: Color) -> some View {
        VStack(spacing: 0) {
            Text(W("widget.eid")).font(.system(size: 10, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
            Text("1").font(.system(size: 8)).opacity(0.8)
        }
        .foregroundStyle(Color.white)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(eid, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    private func legend(_ grid: HijriMonthGrid, pal: WidgetPal, accent: Color, eid: Color) -> some View {
        HStack(spacing: 10) {
            if let n = grid.daysToRamadan {
                Text(W("widget.ramadanIn", ["n": n])).font(.system(size: 11, weight: .semibold)).foregroundStyle(pal.acc)
            } else {
                HStack(spacing: 4) {
                    Circle().fill(Color(red: 0.50, green: 0.61, blue: 0.88)).frame(width: 6, height: 6)
                    Text(W("widget.nuzul"))
                }
                HStack(spacing: 4) {
                    RoundedRectangle(cornerRadius: 2).stroke(pal.fg2.opacity(0.6), lineWidth: 1).frame(width: 9, height: 9)
                    Text(W("widget.lastTen"))
                }
                HStack(spacing: 4) {
                    Circle().fill(eid).frame(width: 6, height: 6)
                    Text(W("widget.eid"))
                }
            }
            Spacer(minLength: 0)
        }
        .font(.system(size: 10)).foregroundStyle(pal.fg2)
        .lineLimit(1).minimumScaleFactor(0.7)
    }
}
