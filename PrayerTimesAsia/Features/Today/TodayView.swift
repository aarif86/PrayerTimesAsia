import SwiftUI

/// The prayer times are the product: a small "where we are now" line, the sun
/// path, then the day's times - large, colour-coded, AM/PM never wrapping.
struct TodayView: View {
    @Environment(AppModel.self) private var model
    @State private var showPlaces = false
    @State private var showCalendar = false
    /// Days away from today shown in the list (‹ › and swipe); 0 = today.
    @State private var dayOffset = 0
    /// Show the blessed times (Dhuha, middle and last third of the night).
    @AppStorage("today.showMore") private var showMore = false

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let now = context.date
            if let day = model.day(containing: now) {
                content(now: now, day: day)
            } else {
                NoPlaceView(showPlaces: $showPlaces)
            }
        }
        .sheet(isPresented: $showPlaces) { PlacesView() }
        .sheet(isPresented: $showCalendar) { CalendarSanadView() }
        .onAppear {
            // Demo screenshots: Show more only when asked, never carried over from a previous run.
            let args = ProcessInfo.processInfo.arguments
            if args.contains(where: { $0.hasPrefix("-demo") }) { showMore = args.contains("-more") }
        }
    }

    @ViewBuilder
    private func content(now: Date, day: PrayerDay) -> some View {
        let sky = SkyColors.at(now, day: day)
        let next = model.next(after: now)
        let current = model.current(at: now)
        let shown = dayOffset == 0 ? day : (model.day(containing: now.addingTimeInterval(Double(dayOffset) * 86_400)) ?? day)

        ZStack {
            LivingSkyBackground(colors: sky)
            // Fill the screen when it all fits: the list stretches into the free
            // height so it breathes. Otherwise (small phones, Show more open) scroll.
            ViewThatFits(in: .vertical) {
                page(now: now, day: day, shown: shown, current: current, next: next, fill: true)
                ScrollView {
                    page(now: now, day: day, shown: shown, current: current, next: next, fill: false)
                }
                .scrollIndicators(.hidden)
            }
        }
        .foregroundStyle(.primary)
    }

    @ViewBuilder
    private func page(now: Date, day: PrayerDay, shown: PrayerDay,
                      current: (prayer: Prayer, time: Date)?, next: (prayer: Prayer, time: Date)?, fill: Bool) -> some View {
        VStack(spacing: fill ? 14 : 12) {
            topBar(now)
            if !model.prefs.notificationsEnabled && !model.prefs.alertsPromptDismissed { alertsPrompt }
            if !model.prefs.arrivalBannerDismissed { ArrivalCard() }
            dial(now: now, shown: shown, current: current, next: next)
                .frame(maxWidth: .infinity, minHeight: fill ? 300 : nil, maxHeight: fill ? .infinity : nil)
                .contentShape(Rectangle())
                .simultaneousGesture(DragGesture(minimumDistance: 30).onEnded { v in
                    guard abs(v.translation.width) > abs(v.translation.height) * 2 else { return }
                    withAnimation(.snappy) { dayOffset += v.translation.width < 0 ? 1 : -1 }
                })
            dayRow(shown)
            showMoreButton
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.top, 4)
        .padding(.bottom, fill ? 8 : 24)
    }

    // MARK: Top

    /// Where we are on the left; musafir, streak and settings on the right.
    private func topBar(_ now: Date) -> some View {
        HStack(spacing: 8) {
            Button { showPlaces = true } label: {
                HStack(spacing: 5) {
                    Image(systemName: model.prefs.useGPS ? "location.fill" : "mappin").font(.caption2)
                    Text(model.activePlace?.name ?? "Choose a place").lineLimit(1).minimumScaleFactor(0.8)
                    if let place = model.activePlace, place.isInAsia { Text(place.profile.flag) }
                    Image(systemName: "chevron.down").font(.caption2.weight(.bold)).opacity(0.6)
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 8)
                .overlay(Capsule().strokeBorder(Theme.accent.opacity(0.7), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityHint("Change location")
            Spacer(minLength: 0)
            if let status = model.musafirStatus, status.isTraveller {
                Button { model.selectedTab = .journey } label: {
                    Image(systemName: "airplane").font(.subheadline.weight(.semibold))
                        .frame(width: 34, height: 34)
                        .background(Theme.accent.opacity(0.25), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Musafir: you may shorten and combine prayers")
            }
            if model.prefs.trackerEnabled { streakChip(now) }
            Button { model.showSettings = true } label: {
                Image(systemName: "gearshape.fill").font(.subheadline)
                    .frame(width: 34, height: 34)
                    .background(Color.primary.opacity(0.1), in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Settings")
        }
    }

    // MARK: The dial

    /// The Day Dial with every time of the day inside it, and the day in its centre.
    @ViewBuilder
    private func dial(now: Date, shown: PrayerDay,
                      current: (prayer: Prayer, time: Date)?, next: (prayer: Prayer, time: Date)?) -> some View {
        let isToday = dayOffset == 0
        let nextFajr = model.day(containing: shown.time(.dhuhr).addingTimeInterval(86_400))?.time(.fajr)
            ?? shown.time(.fajr).addingTimeInterval(86_400)
        let blessed = blessedTimes(shown)
        let marks = Prayer.allCases.map { p in
            DialMark(id: p.rawValue, date: shown.time(p),
                     extraLine: shown.jamaah[p] != nil || shown.alternate[p] != nil, tint: p.tint)
        } + blessed.map { DialMark(id: $0.0.rawValue, date: $0.1, minor: true) }
        DayDial(now: now, day: shown, nextFajr: nextFajr, timeZone: model.timeZone,
                currentPrayer: isToday ? current?.prayer : nil, marks: marks,
                label: { mark, size in
                    if let prayer = Prayer(rawValue: mark.id) {
                        PrayerMark(prayer: prayer, time: mark.date, now: now, size: size, day: shown,
                                   isCurrent: isToday && prayer == current?.prayer)
                    } else if let b = blessed.first(where: { $0.0.rawValue == mark.id }) {
                        BlessedMark(blessed: b.0, time: b.1, now: now, size: size)
                    }
                },
                centre: { size in centre(now: now, shown: shown, current: isToday ? current : nil, next: next, size: size) })
            .animation(.snappy, value: showMore)
    }

    private func blessedTimes(_ shown: PrayerDay) -> [(BlessedTime, Date)] {
        guard showMore, let place = model.activePlace,
              let nextDay = model.day(containing: shown.time(.dhuhr).addingTimeInterval(86_400)) else { return [] }
        let ramadan = Hijri.isRamadan(shown.time(.dhuhr), timeZone: model.timeZone, adjustment: model.prefs.hijriAdjustment)
        return BlessedTime.compute(day: shown, nextDay: nextDay, coordinates: place.coordinates, isRamadan: ramadan)
    }

    /// The day, then where we are in it: "TODAY · FRI 23 OCT", the Hijri date,
    /// the current prayer and the time left until the next.
    private func centre(now: Date, shown: PrayerDay, current: (prayer: Prayer, time: Date)?,
                        next: (prayer: Prayer, time: Date)?, size: CGFloat) -> some View {
        let date = shown.time(.dhuhr)
        let f = DateFormatter()
        f.timeZone = model.timeZone
        f.dateFormat = "EEE d MMM"
        let label: String = switch dayOffset {
        case 0: "TODAY"
        case 1: "TOMORROW"
        case -1: "YESTERDAY"
        default: dayOffset > 0 ? "IN \(dayOffset) DAYS" : "\(-dayOffset) DAYS AGO"
        }
        return Button {
            if dayOffset == 0 { showCalendar = true } else { withAnimation(.snappy) { dayOffset = 0 } }
        } label: {
            VStack(spacing: size * 0.008) {
                Text(dayOffset == 0 ? "\(label) · \(f.string(from: date).uppercased())" : label)
                    .font(.system(size: size * 0.03, weight: .heavy)).tracking(0.5)
                    .foregroundStyle(Theme.accent)
                if let current, let next {
                    Text(current.prayer.name(model.naming, isFriday: model.isFriday(current.time)))
                        .font(Theme.display(size * 0.1, .bold))
                    Text(Self.short(next.time.timeIntervalSince(now)))
                        .font(Theme.display(size * 0.075, .semibold)).monospacedDigit()
                        .foregroundStyle(Theme.accent)
                        .contentTransition(.numericText(countsDown: true))
                    Text("until \(next.prayer.name(model.naming, isFriday: model.isFriday(next.time)))")
                        .font(.system(size: size * 0.036, weight: .medium))
                        .foregroundStyle(.secondary)
                } else {
                    Text(f.string(from: date)).font(Theme.display(size * 0.075, .bold))
                }
                HStack(spacing: 3) {
                    Text(Hijri.format(date, timeZone: model.timeZone, style: model.naming, adjustment: model.prefs.hijriAdjustment))
                    Image(systemName: dayOffset == 0 ? "calendar" : "arrow.uturn.backward")
                }
                .font(.system(size: size * 0.03, weight: .medium))
                .foregroundStyle(.secondary)
                .padding(.top, size * 0.01)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .multilineTextAlignment(.center)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint(dayOffset == 0 ? "Ramadan and Eid dates with their sources" : "Back to today")
    }

    /// ‹ the source of these times ›
    private func dayRow(_ shown: PrayerDay) -> some View {
        HStack(spacing: 4) {
            Button { withAnimation(.snappy) { dayOffset -= 1 } } label: {
                Image(systemName: "chevron.left").font(.subheadline.weight(.semibold))
                    .frame(width: 36, height: 36).background(Color.primary.opacity(0.08), in: Circle())
            }
            .accessibilityLabel("Previous day")
            Spacer(minLength: 4)
            SourceBadge(day: shown, compact: true)
            Spacer(minLength: 4)
            Button { withAnimation(.snappy) { dayOffset += 1 } } label: {
                Image(systemName: "chevron.right").font(.subheadline.weight(.semibold))
                    .frame(width: 36, height: 36).background(Color.primary.opacity(0.08), in: Circle())
            }
            .accessibilityLabel("Next day")
        }
        .buttonStyle(.plain)
    }

    /// "9h 22m", "22m", "45s".
    static func short(_ seconds: TimeInterval) -> String {
        let s = max(0, Int(seconds.rounded(.up)))
        if s < 60 { return "\(s)s" }
        let minutes = (s + 59) / 60
        let h = minutes / 60, m = minutes % 60
        return h > 0 ? "\(h)h \(m)m" : "\(m)m"
    }

    /// "1 hour 5 minutes" for VoiceOver.
    static func spoken(_ seconds: TimeInterval) -> String {
        let f = DateComponentsFormatter()
        f.unitsStyle = .full
        f.allowedUnits = seconds >= 3600 ? [.hour, .minute] : [.minute]
        return f.string(from: max(60, seconds)) ?? ""
    }

    private func streakChip(_ now: Date) -> some View {
        let excused = model.isExcused(now)
        return Menu {
            Button {
                model.toggleExcused(now)
            } label: {
                Label(excused ? "Not excused today" : "Excused today", systemImage: excused ? "xmark.circle" : "drop.fill")
            }
        } label: {
            HStack(spacing: 4) {
                Image(systemName: excused ? "drop.fill" : "flame.fill")
                Text("\(model.streak)").monospacedDigit()
            }
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 10).padding(.vertical, 8)
            .background(Color.primary.opacity(0.1), in: Capsule())
        }
        .accessibilityLabel("Streak \(model.streak) days\(excused ? ", excused today" : "")")
        .accessibilityHint("Mark today as excused - for example during haid or illness - so your streak continues.")
    }

    // MARK: Day

    /// One tap to be told when each prayer begins (all five, at the exact time).
    private var alertsPrompt: some View {
        HStack(spacing: 10) {
            Image(systemName: "bell.badge.fill").foregroundStyle(Theme.sunArc)
            Text("Get an alert when each prayer begins").font(.subheadline.weight(.semibold))
                .lineLimit(2).minimumScaleFactor(0.85)
            Spacer(minLength: 4)
            Button("Turn on") {
                Task {
                    guard await NotificationScheduler.requestPermission() else { return }
                    model.prefs.notifyPrayers = Set(Prayer.obligatory)
                    model.prefs.notificationsEnabled = true
                }
            }
            .font(.subheadline.weight(.bold))
            .buttonStyle(.borderedProminent)
            .tint(Theme.sunArc)
            .foregroundStyle(.black.opacity(0.8))
            Button { withAnimation { model.prefs.alertsPromptDismissed = true } } label: {
                Image(systemName: "xmark").font(.caption.weight(.bold)).opacity(0.6).frame(width: 24, height: 24)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Not now")
        }
        .padding(.leading, 14).padding(.trailing, 8).padding(.vertical, 8)
        .background(Color.primary.opacity(0.08), in: Capsule())
        .overlay(Capsule().strokeBorder(Color.primary.opacity(0.1), lineWidth: 1))
    }

    private var showMoreButton: some View {
        Button { withAnimation(.snappy) { showMore.toggle() } } label: {
            HStack(spacing: 6) {
                Text(showMore ? "SHOW LESS" : "SHOW MORE")
                Image(systemName: showMore ? "chevron.up" : "chevron.down")
            }
            .font(.footnote.weight(.bold))
            .tracking(0.6)
            .padding(.horizontal, 16).padding(.vertical, 9)
            .background(Color.primary.opacity(0.1), in: Capsule())
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .accessibilityHint("Dhuha and the blessed times of the night")
    }
}

// MARK: - Times on the dial

/// One prayer inside the dial: its name and time, tinted when it is now.
/// Tap for its alert and, with the tracker on, to tick it off.
private struct PrayerMark: View {
    @Environment(AppModel.self) private var model
    let prayer: Prayer
    let time: Date
    let now: Date
    let size: CGFloat
    let day: PrayerDay
    let isCurrent: Bool

    var body: some View {
        let passed = time <= now && !isCurrent
        let notifying = model.prefs.notificationsEnabled && model.prefs.notifyPrayers.contains(prayer)
        let trackable = model.prefs.trackerEnabled && prayer.isObligatory && time <= now
        let prayed = trackable && model.isPrayed(prayer, on: time)
        Menu {
            Button { toggleNotify() } label: {
                Label(notifying ? "Turn off alert" : "Alert me at \(prayer.name(model.naming))",
                      systemImage: notifying ? "bell.slash" : "bell")
            }
            if trackable {
                Button { withAnimation(.snappy) { model.togglePrayed(prayer, on: time) } } label: {
                    Label(prayed ? "Mark as not prayed" : "Mark as prayed",
                          systemImage: prayed ? "xmark.circle" : "checkmark.circle")
                }
            }
        } label: {
            VStack(spacing: 0) {
                HStack(spacing: 3) {
                    Text(name)
                        .font(.system(size: size * 0.036, weight: isCurrent ? .bold : .semibold))
                        .foregroundStyle(isCurrent ? prayer.tint : Color.primary.opacity(0.75))
                    if prayed {
                        Image(systemName: "checkmark.circle.fill").font(.system(size: size * 0.03)).foregroundStyle(.green)
                    } else if model.prefs.notificationsEnabled && !notifying && prayer.isObligatory {
                        Image(systemName: "bell.slash").font(.system(size: size * 0.026)).opacity(0.5)
                    }
                }
                .lineLimit(1).minimumScaleFactor(0.7)
                TimeText(parts: model.timeParts(time), size: size * 0.056, weight: isCurrent ? .bold : .semibold)
                if let jamaah = day.jamaah[prayer] {
                    Text("Jamaah \(model.formatted(jamaah))").font(.system(size: size * 0.027, weight: .medium)).opacity(0.75)
                } else if let other = day.alternate[prayer], let source = day.alternateSource {
                    Text("\(source) \(model.formatted(other))")
                        .font(.system(size: size * 0.027, weight: .medium))
                        .foregroundStyle(SourceGrade.masjid.tint)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
            }
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background {
                if isCurrent {
                    RoundedRectangle(cornerRadius: size * 0.035, style: .continuous)
                        .fill(prayer.tint.opacity(0.16))
                        .overlay(RoundedRectangle(cornerRadius: size * 0.035, style: .continuous)
                            .strokeBorder(prayer.tint.opacity(0.5), lineWidth: 1))
                }
            }
            .opacity(passed && !prayed ? 0.55 : 1)
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.success, trigger: prayed) { _, new in new }
        .accessibilityLabel("\(name), \(model.formatted(time))\(isCurrent ? ", now" : "")\(prayed ? ", prayed" : "")")
    }

    /// "Fajr · Subuh" for a visitor, so they know what it is called here.
    private var name: String {
        let own = prayer.name(model.naming, isFriday: model.isFriday(time))
        guard let local = model.localName(prayer, at: time) else { return own }
        return "\(own) · \(local)"
    }

    private func toggleNotify() {
        Task {
            if !model.prefs.notificationsEnabled {
                guard await NotificationScheduler.requestPermission() else { return }
                model.prefs.notificationsEnabled = true
                model.prefs.notifyPrayers = [prayer]
                return
            }
            if model.prefs.notifyPrayers.contains(prayer) {
                model.prefs.notifyPrayers.remove(prayer)
            } else {
                model.prefs.notifyPrayers.insert(prayer)
            }
        }
    }
}

/// A blessed time inside the dial, smaller and quieter than the prayers.
private struct BlessedMark: View {
    @Environment(AppModel.self) private var model
    let blessed: BlessedTime
    let time: Date
    let now: Date
    let size: CGFloat

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 2) {
                Image(systemName: blessed.symbol)
                Text(shortName)
            }
            .font(.system(size: size * 0.03, weight: .semibold))
            .foregroundStyle(.secondary)
            .lineLimit(1).minimumScaleFactor(0.7)
            TimeText(parts: model.timeParts(time), size: size * 0.042, weight: .medium)
                .opacity(0.85)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .opacity(time <= now ? 0.55 : 1)
        .transition(.opacity.combined(with: .scale(scale: 0.8)))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(blessed.name(model.naming)), \(model.formatted(time)). \(blessed.note)")
    }

    /// The dial has room for a word or two.
    private var shortName: String {
        let malay = model.naming == .malay || model.naming == .indonesian
        return switch blessed {
        case .midnight: malay ? "Tengah malam" : "Midnight"
        case .lastThird: malay ? "Sepertiga" : "Last third"
        default: blessed.name(model.naming)
        }
    }
}

private struct ArrivalCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let profile = model.profile
        GlassCard {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top, spacing: 12) {
                    Text(profile.flag.isEmpty ? "🌏" : profile.flag).font(.system(size: 34))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(profile.code.isEmpty ? "Outside Asia" : "Welcome to \(profile.name)")
                            .font(.headline)
                        Text(model.isMethodAutomatic
                             ? "Switched to \(model.method.name) (\(model.method.parameterSummary)), local time. Works offline."
                             : "Local time applied. You've pinned \(model.method.shortName) in Settings.")
                            .font(.subheadline)
                            .opacity(0.85)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                    Button { model.prefs.arrivalBannerDismissed = true } label: {
                        Image(systemName: "xmark").font(.footnote.weight(.bold)).padding(6)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Dismiss")
                }
                Divider().overlay(Color.primary.opacity(0.25)).padding(.vertical, 8)
                Toggle(isOn: Binding(
                    get: { model.isMethodAutomatic },
                    set: { auto in model.prefs.methodOverrideID = auto ? nil : model.method.id })) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Switch automatically").font(.subheadline.weight(.semibold))
                        Text("Follow each country's method as you travel").font(.caption).opacity(0.75)
                    }
                }
                .tint(Theme.accent)
                HStack {
                    Text("Asr").font(.subheadline.weight(.semibold))
                    Spacer()
                    Menu {
                        Button("Automatic (\(profile.asr.label))") { model.prefs.asrOverride = nil }
                        ForEach(AsrSchool.allCases) { school in
                            Button(school.label) { model.prefs.asrOverride = school }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(model.asrSchool == .hanafi ? "Later Asr (Hanafi)" : "Earlier Asr (Shafi'i)")
                            Image(systemName: "chevron.up.chevron.down").font(.caption2)
                        }
                        .font(.subheadline)
                    }
                }
                .padding(.top, 6)
            }
        }
    }
}

private struct NoPlaceView: View {
    @Environment(AppModel.self) private var model
    @Binding var showPlaces: Bool

    var body: some View {
        ZStack {
            LivingSkyBackground(colors: .preDawn)
            VStack(spacing: 16) {
                Image(systemName: "location.circle").font(.system(size: 54, weight: .light))
                Text(model.location.isDenied ? "Location is off" : "Finding where you are…")
                    .font(.title2.weight(.semibold))
                Text("Prayer times are calculated for your exact spot. Allow location, or pick a city.")
                    .multilineTextAlignment(.center).opacity(0.85)
                Button("Choose a city") { showPlaces = true }
                    .buttonStyle(.borderedProminent).tint(Color.primary.opacity(0.25))
            }
            .padding(32)
            .foregroundStyle(.primary)
        }
    }
}
