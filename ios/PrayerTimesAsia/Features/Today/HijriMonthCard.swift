import SwiftUI

/// A quiet month calendar at the top of the Calendar sheet (tap the date on the
/// Prayer screen): Gregorian month like a wall calendar, the Hijri day under each
/// date and the important days marked. Same as web ui/HijriCalendar.tsx.
struct HijriMonthCard: View {
    @Environment(AppModel.self) private var model
    /// Shows a day on the Prayer screen: days from today.
    var onShowDay: ((Int) -> Void)?

    @State private var shown: (y: Int, m: Int)?
    @State private var picked: CivilDay?

    private struct Cell: Identifiable {
        let g: CivilDay
        let h: Hijri.HijriDate
        var id: Int { g.dayNumber }
    }

    private static let sunday = Color(red: 0.90, green: 0.28, blue: 0.30)
    private static let ramadanBlue = Color(red: 0.30, green: 0.48, blue: 0.85)

    var body: some View {
        let today = model.civil(.now)
        let ym = shown ?? (today.year, today.month)
        let style = model.naming
        let w = IslamicDays.words(lang: model.appLang)
        let cells = days(ym.y, ym.m)
        let lead = weekday(CivilDay(year: ym.y, month: ym.m, day: 1))
        let keyDays = cells.flatMap { c in IslamicDays.of(c.h).filter { IslamicDays.listed(c.h, $0) }.map { (c, $0) } }
        let whiteRuns = keyDays.isEmpty ? cells.enumerated().filter { i, c in
            (c.h.day == 13 || i == 0) && IslamicDays.of(c.h).contains { $0.kind == .whiteDay }
        }.map(\.element) : []
        let sel = picked.flatMap { p in cells.first { $0.g == p } }
        let authority = model.communityAuthority
        let starts = model.hijriCalendar.dataset.monthStarts
        let adj = model.prefs.hijriAdjustment

        VStack(alignment: .leading, spacing: 12) {
            HStack {
                arrow("chevron.left", label: W("tracker.prevMonth")) { move(-1, from: ym) }
                Spacer()
                VStack(spacing: 2) {
                    Text("\(w.months[ym.m - 1]) \(String(ym.y))").font(.headline)
                    Text(span(cells, style: style, and: w.and)).font(.footnote.weight(.semibold)).foregroundStyle(Theme.accentText)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
                Spacer()
                arrow("chevron.right", label: W("tracker.nextMonth")) { move(1, from: ym) }
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 7), spacing: 3) {
                ForEach(0..<7, id: \.self) { i in
                    Text(w.week[i]).font(.caption.weight(.semibold))
                        .foregroundStyle(i == 0 ? Self.sunday : i == 5 ? Theme.gold : .secondary)
                        .accessibilityHidden(true)
                }
                ForEach(100..<(100 + lead), id: \.self) { _ in Color.clear.frame(height: 1) }
                ForEach(Array(cells.enumerated()), id: \.element.id) { i, c in
                    dayCell(c, first: i == 0, today: today, picked: sel?.g == c.g, style: style)
                }
            }

            Divider()

            if let sel {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(sel.h.day) \(style.hijriMonths[sel.h.month - 1]) \(String(sel.h.year))").font(.subheadline.weight(.semibold))
                        Text(longDate(sel.g)).font(.caption).foregroundStyle(.secondary)
                        ForEach(IslamicDays.of(sel.h), id: \.self) { k in
                            Text(IslamicDays.name(k.kind, lang: model.appLang)).font(.caption.weight(.semibold)).foregroundStyle(Theme.accentText)
                        }
                    }
                    Spacer()
                    if let onShowDay {
                        Button(w.prayerTimes) { onShowDay(today.days(to: sel.g)) }
                            .buttonStyle(.bordered).tint(Theme.accent)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    if !(ym.y == today.year && ym.m == today.month) {
                        HStack { Spacer(); Button(w.today) { picked = nil; shown = nil }.font(.caption.weight(.semibold)) }
                    }
                    if !keyDays.isEmpty {
                        ForEach(Array(keyDays.enumerated()), id: \.offset) { _, item in
                            row(item.0, IslamicDays.name(item.1.kind, lang: model.appLang), "\(item.0.h.day) \(style.hijriMonths[item.0.h.month - 1])")
                        }
                    } else if !whiteRuns.isEmpty {
                        ForEach(whiteRuns) { c in row(c, IslamicDays.name(.whiteDay, lang: model.appLang), "13, 14, 15 \(IslamicDays.monthShort(c.h.month, style))") }
                    } else {
                        Text(w.none).font(.footnote).foregroundStyle(.secondary)
                    }
                    if whiteRuns.isEmpty {
                        HStack(spacing: 6) {
                            Circle().fill(.secondary).frame(width: 5, height: 5)
                            Text("\(IslamicDays.name(.whiteDay, lang: model.appLang)) 13, 14, 15").font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            if let url = URL(string: "https://prayertimes.asia/app/print/#sheet=year&m=\(String(ym.y))-01") {
                Link(destination: url) {
                    Label("\(w.print) \(String(ym.y))", systemImage: "printer").font(.subheadline.weight(.semibold))
                }
                .tint(Theme.accentText)
            }

            Text(note(w, authority: authority, starts: starts, first: cells.first?.g))
                .font(.footnote).foregroundStyle(.secondary)

            // A published calendar (MUIS) already gives the local dates, so there is nothing to move.
            if !published(authority: authority, starts: starts, first: cells.first?.g) {
            HStack {
                Text(w.adjust).font(.subheadline)
                Spacer()
                Text(adj == 0 ? w.adjustNone : "\(adj > 0 ? "+" : "")\(adj) \(w.dayOff)").font(.footnote.monospacedDigit()).foregroundStyle(.secondary)
                Stepper(w.adjust, value: Binding(get: { model.prefs.hijriAdjustment },
                                                  set: { model.prefs.hijriAdjustment = max(-2, min(2, $0)) }), in: -2...2)
                    .labelsHidden()
            }
            }
        }
        .padding(.vertical, 6)
        // Inside a List row: only the buttons themselves take taps, not the whole card.
        .buttonStyle(.borderless)
    }

    // MARK: Pieces

    private func arrow(_ icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon).font(.body.weight(.semibold)).frame(width: 44, height: 44)
                .background(.thinMaterial, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func dayCell(_ c: Cell, first: Bool, today: CivilDay, picked: Bool, style: NamingStyle) -> some View {
        let marks = IslamicDays.of(c.h)
        let major = marks.first { $0.major }
        let quiet = major == nil && marks.contains { [.lastTen, .tasyrik, .zulhijjahTen].contains($0.kind) }
        let white = marks.contains { $0.kind == .whiteDay }
        let ramadan = c.h.month == 9
        let sunday = weekday(c.g) == 0
        let newMonth = c.h.day == 1
        let isToday = c.g == today
        let bg: Color = picked ? Theme.accent
            : ramadan ? Self.ramadanBlue.opacity(quiet ? 0.30 : 0.16)
            : major != nil ? Theme.accent.opacity(0.22)
            : quiet ? Theme.accent.opacity(0.10)
            : Color.primary.opacity(0.06)
        let fg: Color? = picked ? .black : nil
        let small: String? = major.map { IslamicDays.shortName($0.kind, lang: model.appLang) }
            ?? ((newMonth || first) ? IslamicDays.monthShort(c.h.month, style) : nil)
        let label = "\(longDate(c.g)), \(c.h.day) \(style.hijriMonths[c.h.month - 1]) \(String(c.h.year))"
            + (marks.isEmpty ? "" : ", " + marks.map { IslamicDays.name($0.kind, lang: model.appLang) }.joined(separator: ", "))

        return Button { self.picked = picked ? nil : c.g } label: {
            VStack(spacing: 1) {
                Text("\(c.g.day)").font(.system(size: 19, weight: .bold, design: .rounded)).monospacedDigit()
                    .foregroundStyle(fg ?? (sunday ? Self.sunday : .primary))
                HStack(spacing: 2) {
                    Text("\(c.h.day)").font(.caption2.monospacedDigit())
                    if white { Circle().frame(width: 4, height: 4) }
                }
                .foregroundStyle(fg ?? (newMonth ? Theme.accentText : .secondary))
                if let small {
                    Text(small).font(.system(size: 9, weight: major != nil || newMonth ? .bold : .regular))
                        .foregroundStyle(fg ?? (major != nil || newMonth ? Theme.accentText : .secondary))
                        .lineLimit(2).multilineTextAlignment(.center).minimumScaleFactor(0.8)
                }
                Spacer(minLength: 0)
            }
            .padding(.top, 6).padding(.horizontal, 1)
            .frame(maxWidth: .infinity, minHeight: 62, alignment: .top)
            .background(bg, in: RoundedRectangle(cornerRadius: 10))
            .overlay(alignment: .top) {
                if major != nil && !picked { UnevenRoundedRectangle(topLeadingRadius: 10, topTrailingRadius: 10).fill(Theme.gold).frame(height: 2) }
            }
            .overlay { if isToday { RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.accent, lineWidth: 2) } }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(picked ? .isSelected : [])
    }

    private func row(_ c: Cell, _ name: String, _ detail: String) -> some View {
        Button { picked = c.g } label: {
            HStack(spacing: 12) {
                Text("\(c.g.day)").font(.body.weight(.bold).monospacedDigit()).foregroundStyle(Theme.accentText).frame(width: 28, alignment: .leading)
                Text(name).foregroundStyle(.primary)
                Spacer()
                Text(detail).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
            }
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: Dates

    private func days(_ y: Int, _ m: Int) -> [Cell] {
        let first = CivilDay(year: y, month: m, day: 1)
        let next = m == 12 ? CivilDay(year: y + 1, month: 1, day: 1) : CivilDay(year: y, month: m + 1, day: 1)
        return (0..<first.days(to: next)).map { i in
            let g = first.adding(i)
            return Cell(g: g, h: model.hijri(of: g))
        }
    }

    /// 0 is Sunday.
    private func weekday(_ g: CivilDay) -> Int { ((g.dayNumber % 7) + 11) % 7 }

    private func move(_ d: Int, from ym: (y: Int, m: Int)) {
        picked = nil
        let i = ym.y * 12 + (ym.m - 1) + d
        shown = (i / 12, i % 12 + 1)
    }

    private func span(_ cells: [Cell], style: NamingStyle, and: String) -> String {
        guard let a = cells.first?.h, let z = cells.last?.h else { return "" }
        let n = { IslamicDays.monthShort($0, style) }
        if a.month == z.month { return "\(n(a.month)) \(String(a.year))" }
        return a.year == z.year ? "\(n(a.month)) \(and) \(n(z.month)) \(String(z.year))"
            : "\(n(a.month)) \(String(a.year)) \(and) \(n(z.month)) \(String(z.year))"
    }

    private func published(authority: String?, starts: [MonthStart]?, first: CivilDay?) -> Bool {
        guard let authority, let first else { return false }
        return Season.publishedHijri(first, starts: starts, authority: authority) != nil
    }

    private func note(_ w: IslamicDays.Words, authority: String?, starts: [MonthStart]?, first: CivilDay?) -> String {
        let short = authority.map { CalendarSanad.authorityName($0).replacingOccurrences(of: #"\s*\(.*\)\s*$"#, with: "", options: .regularExpression) }
        if let authority, let short, let first, Season.publishedHijri(first, starts: starts, authority: authority) != nil {
            return w.notePublished(short)
        }
        return w.note(short)
    }

    private func longDate(_ g: CivilDay) -> String {
        let utc = TimeZone(identifier: "UTC")!
        var style = Date.FormatStyle(date: .complete, time: .omitted)
        style.timeZone = utc
        style.locale = Locale(identifier: "en_GB")
        return g.noon(in: utc).formatted(style)
    }
}
