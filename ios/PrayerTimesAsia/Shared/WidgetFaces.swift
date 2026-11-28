import SwiftUI

/// Words every widget face shares.
enum WidgetText {
    /// "25 Nov · 15 Jumada al-Akhirah 1448".
    static func dateLine(_ s: WidgetSnapshot, date: Date, day: PrayerDay) -> String {
        let f = DateFormatter()
        f.timeZone = s.timeZone
        f.dateFormat = "d MMM"
        let hijri = Hijri.format(date, timeZone: s.timeZone, style: s.naming, adjustment: s.hijriAdjustment ?? 0)
        return "\(f.string(from: date)) · \(hijri)"
    }

    static func timeParts(_ s: WidgetSnapshot, _ date: Date) -> (time: String, suffix: String?) {
        let f = DateFormatter()
        f.timeZone = s.timeZone
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = s.use24Hour ? "HH:mm" : "h:mm"
        let time = f.string(from: date)
        guard !s.use24Hour else { return (time, nil) }
        f.dateFormat = "a"
        return (time, f.string(from: date))
    }

    /// The prayer that carries the live "in 1:23:45": the next prayer's, or once the
    /// next is tomorrow's Subuh, the one we are in ("Subuh in 7:12:03").
    static func countdownRow(_ s: WidgetSnapshot, day: PrayerDay, date: Date) -> (prayer: Prayer, label: String, until: Date)? {
        guard let next = s.next(after: date) else { return nil }
        if abs(day.time(next.prayer).timeIntervalSince(next.time)) < 60 { return (next.prayer, "in", next.time) }
        guard let current = s.current(at: date)?.prayer else { return nil }
        return (current, "\(s.name(next.prayer, at: next.time)) in", next.time)
    }

    /// Ticks by itself between timeline entries.
    static func countdown(_ label: String, _ date: Date, _ until: Date) -> Text {
        Text("\(label) ") + Text(timerInterval: date...max(date, until), countsDown: true).monospacedDigit()
    }
}

/// The prayer list: six rows, the next prayer highlighted with its live countdown.
/// Colour Bands draws full-width bands instead of a card.
struct WidgetList: View {
    let snapshot: WidgetSnapshot
    let day: PrayerDay
    let date: Date
    let style: TodayStyle
    var size: CGFloat
    var compact: Bool

    var body: some View {
        let pal = WidgetPal.of(style)
        let hit = WidgetText.countdownRow(snapshot, day: day, date: date)
        if style.look == .bands {
            VStack(spacing: 0) {
                ForEach(Prayer.allCases) { prayer in
                    AnyView(band(prayer, hit: hit?.prayer == prayer ? hit : nil))
                }
            }
        } else {
            VStack(spacing: 0) {
                ForEach(Prayer.allCases) { prayer in
                    AnyView(row(prayer, pal: pal, hit: hit?.prayer == prayer ? hit : nil))
                }
            }
            .background(pal.card, in: RoundedRectangle(cornerRadius: compact ? 12 : 16, style: .continuous))
            .clipShape(RoundedRectangle(cornerRadius: compact ? 12 : 16, style: .continuous))
        }
    }

    private func row(_ prayer: Prayer, pal: WidgetPal, hit: (prayer: Prayer, label: String, until: Date)?) -> some View {
        let time = day.time(prayer)
        let parts = WidgetText.timeParts(snapshot, time)
        let passed = time <= date && hit == nil
        let gold = style.look == .gold
        return HStack(spacing: 8) {
            if !compact { AnyView(tick(prayer, time: time, pal: pal)) }
            if gold {
                Circle().fill(pal.acc).frame(width: 7, height: 7).opacity(hit == nil ? 0 : 1)
            } else {
                Capsule().fill(prayer.tint).frame(width: 3, height: size + 3)
            }
            Text(snapshot.name(prayer, at: time))
                .font(.system(size: size, weight: hit == nil ? .medium : .bold)).lineLimit(1)
            if let hit, !compact {
                WidgetText.countdown(hit.label, date, hit.until)
                    .font(.system(size: size * 0.72, weight: .bold)).foregroundStyle(pal.acc).lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            Spacer(minLength: 2)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(parts.time).font(.system(size: size, weight: .medium, design: .rounded)).monospacedDigit()
                if let suffix = parts.suffix {
                    Text(suffix).font(.system(size: size * 0.62, weight: .bold, design: .rounded)).foregroundStyle(pal.fg2)
                }
            }
            .fixedSize()
        }
        .padding(.horizontal, compact ? 8 : 12)
        .frame(maxHeight: .infinity)
        .background(hit == nil ? Color.clear : pal.cur)
        .opacity(passed ? 0.6 : 1)
    }

    /// A tick for each prayer whose time has closed, an empty ring for the others, nothing for
    /// Syuruk. Said as "Time has passed" to VoiceOver, never as "prayed".
    @ViewBuilder
    private func tick(_ prayer: Prayer, time: Date, pal: WidgetPal) -> some View {
        let d = size * 0.9
        if prayer == .sunrise {
            Color.clear.frame(width: d, height: d)
        } else if WidgetMore.isDone(prayer, time: time, snapshot, date) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: d))
                .foregroundStyle(style.look == .bands ? Color.white : pal.acc)
                .accessibilityLabel(W("widget.passed"))
        } else {
            Circle().stroke(style.look == .bands ? Color.white.opacity(0.6) : pal.fg2.opacity(0.5), lineWidth: 1.5)
                .frame(width: d - 2, height: d - 2).padding(1)
                .accessibilityHidden(true)
        }
    }

    private func band(_ prayer: Prayer, hit: (prayer: Prayer, label: String, until: Date)?) -> some View {
        let time = day.time(prayer)
        let parts = WidgetText.timeParts(snapshot, time)
        return HStack(alignment: .firstTextBaseline, spacing: 6) {
            if !compact { AnyView(tick(prayer, time: time, pal: WidgetPal.of(style))) }
            Text(snapshot.name(prayer, at: time)).font(.system(size: size, weight: .bold)).lineLimit(1)
            if let hit, !compact {
                WidgetText.countdown(hit.label, date, hit.until)
                    .font(.system(size: size * 0.6, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
            }
            Spacer(minLength: 2)
            Text(parts.time).font(.system(size: size * 1.2, weight: .light)).monospacedDigit()
            if let suffix = parts.suffix { Text(suffix).font(.system(size: size * 0.75, weight: .light)) }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, compact ? 10 : 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(BandsPalette.color(prayer))
    }
}

/// The ring with the countdown inside: the rainbow Day Dial (Centre Dial) or Calm Gold's
/// thin gold ring.
struct WidgetDialFace: View {
    let snapshot: WidgetSnapshot
    let day: PrayerDay
    let date: Date
    let pal: WidgetPal
    let gold: Bool
    let size: CGFloat
    /// Overrides what the ring says (Ramadan: "Berbuka"); nil is the next prayer.
    var title: String? = nil
    var target: Date? = nil

    var body: some View {
        let next = snapshot.next(after: date)
        let lead = PrayerLead(current: snapshot.current(at: date), next: next)
        ZStack {
            if gold {
                GoldRing(day: day, now: date, timeZone: snapshot.timeZone, gold: pal.acc)
            } else {
                DialRing(day: day, now: date, timeZone: snapshot.timeZone, ink: pal.fg)
            }
            if let until = target ?? next?.time, let lead {
                let isNext = title != nil || lead.isNext
                let name = title ?? snapshot.name(lead.prayer, at: lead.time)
                let timer = Text(timerInterval: date...max(date, until), countsDown: true)
                VStack(spacing: 0) {
                    Text(isNext ? "Next prayer" : "Now \(name)")
                        .font(.system(size: size * 0.075, weight: .medium)).foregroundStyle(pal.fg2)
                    timer.font(.system(size: size * 0.2, weight: .bold, design: .rounded)).monospacedDigit()
                        .lineLimit(1).minimumScaleFactor(0.6)
                    Text(isNext ? "until \(name)" : "left")
                        .font(.system(size: size * 0.075, weight: .medium)).foregroundStyle(pal.fg2)
                }
                .frame(width: size * 0.72)
                .foregroundStyle(pal.fg)
                .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .frame(width: size, height: size)
    }
}

/// Sun Path's top: the prayer with a coloured dot, and the countdown in a pill.
struct WidgetSunHero: View {
    let snapshot: WidgetSnapshot
    let day: PrayerDay
    let date: Date
    let pal: WidgetPal
    var big: Bool
    var title: String? = nil
    var target: Date? = nil

    var body: some View {
        let next = snapshot.next(after: date)
        let lead = PrayerLead(current: snapshot.current(at: date), next: next)
        VStack(alignment: .leading, spacing: 3) {
            if let lead {
                HStack(spacing: 6) {
                    Circle().fill(lead.prayer.tint).frame(width: big ? 10 : 8, height: big ? 10 : 8)
                    Text(title ?? snapshot.name(lead.prayer, at: lead.time))
                        .font(.system(size: big ? 30 : 24, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
                }
            }
            if let until = target ?? next?.time {
                let label = title != nil || lead?.isNext == true ? "in" : "\(snapshot.name(next?.prayer ?? .fajr, at: until)) in"
                WidgetText.countdown(label, date, until)
                    .font(.system(size: big ? 14 : 12, weight: .semibold))
                    .lineLimit(1).minimumScaleFactor(0.7)
                    .padding(.horizontal, 10).padding(.vertical, 3)
                    .background(pal.card, in: Capsule())
            }
        }
    }
}

/// Big and Simple's hero: the prayer in big violet, the countdown under it.
struct WidgetSimpleHero: View {
    let snapshot: WidgetSnapshot
    let date: Date
    let pal: WidgetPal
    var nameSize: CGFloat
    var countSize: CGFloat
    var title: String? = nil
    var target: Date? = nil

    var body: some View {
        let next = snapshot.next(after: date)
        let lead = PrayerLead(current: snapshot.current(at: date), next: next)
        VStack(spacing: 0) {
            if let lead {
                Text(title ?? snapshot.name(lead.prayer, at: lead.time))
                    .font(.system(size: nameSize, weight: .bold, design: .rounded)).foregroundStyle(pal.hero)
                    .lineLimit(1).minimumScaleFactor(0.6)
            }
            if let until = target ?? next?.time {
                let label = title != nil || lead?.isNext == true ? "in" : "\(snapshot.name(next?.prayer ?? .fajr, at: until)) in"
                WidgetText.countdown(label, date, until)
                    .font(.system(size: countSize, weight: .semibold, design: .rounded))
                    .lineLimit(1).minimumScaleFactor(0.7)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

/// What a Small or Medium widget says: the prayer (or, in Ramadan, Berbuka or Imsak), when,
/// and how long until.
struct WidgetHeadline {
    var title: String
    var target: Date
    /// The prayer whose colour Colour Bands uses.
    var prayer: Prayer
    /// Ramadan only: the next prayer as a small line.
    var nextLine: String?
    /// True when title/target replace the next prayer (Ramadan).
    var isFast: Bool
}

/// The Small widget and the left half of the Medium widget, in each look.
struct WidgetHeadlineFace: View {
    let snapshot: WidgetSnapshot
    let day: PrayerDay?
    let date: Date
    let style: TodayStyle
    let head: WidgetHeadline
    /// Medium: the left half is narrower, so things are a little smaller.
    var medium: Bool

    var body: some View {
        let pal = WidgetPal.of(style)
        let time = snapshot.format(head.target)
        let override: String? = head.isFast ? head.title : nil
        let target: Date? = head.isFast ? head.target : nil
        switch style.look {
        case .bands:
            VStack(alignment: .leading, spacing: 0) {
                Text("\(snapshot.placeName) \(snapshot.flag)").font(.system(size: 12, weight: .semibold)).opacity(0.9).lineLimit(1)
                Spacer(minLength: 0)
                Text(head.title).font(.system(size: medium ? 22 : 26, weight: .bold)).lineLimit(1).minimumScaleFactor(0.6)
                Text(time).font(.system(size: medium ? 24 : 28, weight: .light, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
                Text(timerInterval: date...max(date, head.target), countsDown: true)
                    .font(.system(size: 13, weight: .semibold).monospacedDigit()).opacity(0.95)
            }
            .foregroundStyle(.white)
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        case .simple:
            VStack(spacing: 2) {
                Text(W("widget.nextPrayer")).font(.system(size: 12, weight: .medium)).foregroundStyle(pal.fg2)
                Text(head.title).font(.system(size: medium ? 28 : 32, weight: .bold, design: .rounded)).foregroundStyle(pal.hero)
                    .lineLimit(1).minimumScaleFactor(0.6)
                Text(timerInterval: date...max(date, head.target), countsDown: true)
                    .font(.system(size: medium ? 17 : 19, weight: .semibold, design: .rounded).monospacedDigit())
                    .lineLimit(1).minimumScaleFactor(0.7)
                Text(time).font(.system(size: 14)).foregroundStyle(pal.fg2)
            }
            .foregroundStyle(pal.fg)
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .sunPath:
            VStack(alignment: .leading, spacing: 4) {
                Text("\(snapshot.placeName) \(snapshot.flag)").font(.system(size: 12)).foregroundStyle(pal.fg2).lineLimit(1)
                if let day {
                    AnyView(WidgetSunHero(snapshot: snapshot, day: day, date: date, pal: pal, big: false, title: override, target: target))
                    Spacer(minLength: 0)
                    SunArc(day: day, now: date, ink: pal.fg, line: Color(red: 0.85, green: 0.45, blue: 0.18))
                        .frame(height: medium ? 34 : 42)
                }
            }
            .foregroundStyle(pal.fg)
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        default:
            if let day {
                VStack {
                    AnyView(WidgetDialFace(snapshot: snapshot, day: day, date: date, pal: pal, gold: style.look == .gold,
                                           size: medium ? 128 : 140, title: override, target: target))
                }
                .padding(medium ? 6 : 8)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}
