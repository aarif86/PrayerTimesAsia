import SwiftUI

/// The prayer times are the product: a small "where we are now" line, the sun
/// path, then the day's times - large, colour-coded, AM/PM never wrapping.
struct TodayView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var showPlaces = false
    @State private var showCalendar = false
    @State private var showTracker = false
    /// Days away from today shown in the list (‹ › and swipe); 0 = today.
    @State private var dayOffset = 0
    /// Show the blessed times (Dhuha, middle and last third of the night).
    @AppStorage("today.showMore") private var showMore = false
    /// The new style's name, shown for a moment after switching.
    @State private var styleToast: String?

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
        .sheet(isPresented: $showCalendar) { CalendarSanadView { days in withAnimation(.snappy) { dayOffset = days } } }
        .sheet(isPresented: $showTracker) { TrackerView() }
        .asksForStarsWhenCalm()
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
        let shown = dayOffset == 0 ? day : (model.day(containing: model.noon(now, plus: dayOffset)) ?? day)

        ZStack {
            LookBackdrop(sky: sky)
            // Fill the screen when it all fits; otherwise (small phones, Show more
            // open, bigger text) scroll. Every look follows the web app's layout.
            ViewThatFits(in: .vertical) {
                v12Page(now: now, day: day, shown: shown, current: current, next: next, fill: true)
                ScrollView {
                    v12Page(now: now, day: day, shown: shown, current: current, next: next, fill: false)
                }
                .scrollIndicators(.hidden)
            }
        }
        .foregroundStyle(.primary)
        .overlay(alignment: .top) {
            if let styleToast {
                Text(styleToast)
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(.regularMaterial, in: Capsule())
                    .padding(.top, 52)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .allowsHitTesting(false)
            }
        }
        .onChange(of: model.prefs.appearance) { _, appearance in
            let label = appearance == .system ? W("appearance.system") : appearance.label
            withAnimation(.snappy) { styleToast = label }
            Task {
                try? await Task.sleep(for: .seconds(1.4))
                withAnimation(.easeOut) { if styleToast == label { styleToast = nil } }
            }
        }
        .onChange(of: model.prefs.todayStyle) { _, style in
            withAnimation(.snappy) { styleToast = style.label }
            Task {
                try? await Task.sleep(for: .seconds(1.4))
                withAnimation(.easeOut) { if styleToast == style.label { styleToast = nil } }
            }
        }
    }

    @ViewBuilder
    private func page(now: Date, day: PrayerDay, shown: PrayerDay,
                      current: (prayer: Prayer, time: Date)?, next: (prayer: Prayer, time: Date)?, fill: Bool) -> some View {
        VStack(alignment: .leading, spacing: fill ? 12 : 12) {
            header(now: now, day: day, shown: shown, current: current, next: next)
            if model.showAlertsPrompt { alertsPrompt }
            prayerHadith(next)
            if !model.prefs.arrivalBannerDismissed { ArrivalCard() }
            if dayOffset == 0 { TodayNotes(now: now) }
            PrayerList(day: shown, now: now,
                       current: dayOffset == 0 ? PrayerLead.open(current)?.prayer : nil,
                       next: dayOffset == 0 ? next : nil,
                       showMore: showMore, fill: fill)
                .frame(maxHeight: fill ? .infinity : nil, alignment: .top)
                .simultaneousGesture(DragGesture(minimumDistance: 30).onEnded { v in
                    guard abs(v.translation.width) > abs(v.translation.height) * 2 else { return }
                    withAnimation(.snappy) { dayOffset += v.translation.width < 0 ? 1 : -1 }
                })
            showMoreButton
            if dayOffset == 0 { ReviewLine(now: now) }
            if model.prefs.showOffers && showMore {
                CommunityCardSlot(now: now, next: next)
            }
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.top, 4)
        .padding(.bottom, fill ? 8 : 24)
    }

    // MARK: Top

    /// The Day Dial on the left; where, when and the source on the right.
    /// When the buttons need more room (an alarm time, the streak, the luggage button,
    /// bigger text) the dial gets smaller, and if that is still not enough the buttons
    /// move to their own row above. The row must never be wider than the screen: that
    /// pushed the whole Prayer page sideways, cut off on the left.
    private func header(now: Date, day: PrayerDay, shown: PrayerDay,
                        current: (prayer: Prayer, time: Date)?, next: (prayer: Prayer, time: Date)?) -> AnyView {
        // AnyView on purpose. The three layouts below make a very deep SwiftUI type, and
        // on a real iPhone (1 MB main thread stack) looking that type up when the Prayer
        // screen opened ran out of stack and crashed the app at launch (build 30).
        // The Simulator has a bigger stack, so CI never saw it.
        AnyView(ViewThatFits(in: .horizontal) {
            HStack(alignment: .center, spacing: 14) {
                headerDial(now: now, day: day, current: current, next: next, size: 172)
                VStack(alignment: .leading, spacing: 10) {
                    headerButtons(now)
                    headerPlaceAndDay(shown)
                }
            }
            HStack(alignment: .center, spacing: 10) {
                headerDial(now: now, day: day, current: current, next: next, size: 140)
                VStack(alignment: .leading, spacing: 10) {
                    headerButtons(now)
                    headerPlaceAndDay(shown)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                headerButtons(now)
                HStack(alignment: .center, spacing: 10) {
                    headerDial(now: now, day: day, current: current, next: next, size: 140)
                    VStack(alignment: .leading, spacing: 10) { headerPlaceAndDay(shown) }
                }
            }
        })
    }

    @ViewBuilder
    private func headerDial(now: Date, day: PrayerDay, current: (prayer: Prayer, time: Date)?,
                            next: (prayer: Prayer, time: Date)?, size: CGFloat) -> some View {
        if let lead = PrayerLead(current: current, next: next), let next, let tomorrow = model.day(containing: model.noon(now, plus: 1)) {
            DayDial(now: now, day: day, nextFajr: tomorrow.time(.fajr), timeZone: model.timeZone,
                    currentName: lead.prayer.name(model.naming, isFriday: model.isFriday(lead.time)),
                    currentPrayer: lead.prayer,
                    countdown: PrayerCountdown(now: now, next: next, model: model).count,
                    label: PrayerCountdown(now: now, next: next, model: model).label,
                    isNext: lead.isNext)
                .frame(width: size, height: size)
        }
    }

    private func headerButtons(_ now: Date) -> some View {
        HStack(spacing: 8) {
            Spacer(minLength: 0)
            if model.prefs.musafirEnabled, let status = model.musafirStatus, status.isTraveller {
                Button { model.showJourney = true } label: {
                    Image("Tab-journey").resizable().scaledToFit().frame(width: 18, height: 18)
                        .frame(width: 34, height: 34)
                        .background(Theme.accent.opacity(0.25), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(W("today.musafirButton"))
            }
            wakeChip(now)
            if model.prefs.trackerEnabled { streakChip(now) }
            appearanceButton
            styleButton
        }
    }

    @ViewBuilder
    private func headerPlaceAndDay(_ shown: PrayerDay) -> some View {
        Button { showPlaces = true } label: {
            HStack(spacing: 5) {
                Image(systemName: model.prefs.useGPS ? "location.fill" : "mappin").font(.caption2)
                    .symbolEffect(.pulse, isActive: model.isCheckingLocation)
                Text(model.activePlace?.name ?? W("masjid.choosePlace")).lineLimit(typeSize.isAccessibilitySize ? 3 : 1).minimumScaleFactor(0.8)
                if let place = model.activePlace, place.isInAsia { Text(place.profile.flag) }
                Image(systemName: "chevron.down").font(.caption2.weight(.bold)).opacity(0.6)
            }
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 10).padding(.vertical, 6)
            .overlay(Capsule().strokeBorder(Theme.accent.opacity(0.7), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityHint(W("today.changeLocation"))
        dateBlock(shown)
        SourceBadge(day: shown, compact: true)
    }

    /// "TODAY / Fri 23 Oct / 12 Jamadilawal 1448" with ‹ › to move between days.
    private func dateBlock(_ shown: PrayerDay) -> some View {
        let date = shown.time(.dhuhr)
        let f = DateFormatter()
        f.timeZone = model.timeZone
        f.dateFormat = "EEE d MMM"
        let label: String = switch dayOffset {
        case 0: W("common.today").uppercased()
        case 1: W("common.tomorrow").uppercased()
        case -1: W("today.yesterday").uppercased()
        default: dayOffset > 0 ? W("today.inDays", ["n": dayOffset]).uppercased() : W("today.daysAgo", ["n": -dayOffset]).uppercased()
        }
        return HStack(spacing: 2) {
            Button { withAnimation(.snappy) { dayOffset -= 1 } } label: {
                Image(systemName: "chevron.left").font(.subheadline.weight(.semibold)).frame(width: 22, height: 40).opacity(0.6)
            }
            .accessibilityLabel(W("today.prevDay"))
            Button { if dayOffset == 0 { showCalendar = true } else { withAnimation(.snappy) { dayOffset = 0 } } } label: {
                VStack(alignment: .leading, spacing: 1) {
                    Text(label).font(.caption2.weight(.heavy)).tracking(0.5).foregroundStyle(Theme.accentText)
                    Text(f.string(from: date)).font(.headline)
                    HStack(spacing: 3) {
                        Text(model.hijriLabel(date))
                            .lineLimit(1).minimumScaleFactor(0.75)
                        Image(systemName: "calendar")
                    }
                    .font(.caption).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .accessibilityHint(dayOffset == 0 ? W("today.datesSources") : W("today.backToToday"))
            Button { withAnimation(.snappy) { dayOffset += 1 } } label: {
                Image(systemName: "chevron.right").font(.subheadline.weight(.semibold)).frame(width: 22, height: 40).opacity(0.6)
            }
            .accessibilityLabel(W("today.nextDay"))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func dialPage(now: Date, day: PrayerDay, shown: PrayerDay,
                      current: (prayer: Prayer, time: Date)?, next: (prayer: Prayer, time: Date)?, fill: Bool) -> some View {
        VStack(spacing: fill ? 14 : 12) {
            topBar(now)
            if model.showAlertsPrompt { alertsPrompt }
            if !model.prefs.arrivalBannerDismissed { ArrivalCard() }
            if dayOffset == 0 { TodayNotes(now: now) }
            dateHeader(shown)
            dial(now: now, shown: shown, current: current, next: next)
                .padding(.horizontal, 8 - Theme.gutter)
                .frame(maxWidth: .infinity, minHeight: fill ? 300 : nil, maxHeight: fill ? .infinity : nil)
                .contentShape(Rectangle())
                .simultaneousGesture(DragGesture(minimumDistance: 30).onEnded { v in
                    guard abs(v.translation.width) > abs(v.translation.height) * 2 else { return }
                    withAnimation(.snappy) { dayOffset += v.translation.width < 0 ? 1 : -1 }
                })
            dayRow(shown)
            showMoreButton
            if dayOffset == 0 { ReviewLine(now: now) }
            if model.prefs.showOffers && showMore {
                CommunityCardSlot(now: now, next: next)
            }
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.top, 4)
        .padding(.bottom, fill ? 8 : 24)
    }

    // MARK: Day Dial style

    /// Where we are on the left; musafir, streak and settings on the right.
    private func topBar(_ now: Date) -> some View {
        HStack(spacing: 8) {
            Button { showPlaces = true } label: {
                HStack(spacing: 5) {
                    Image(systemName: model.prefs.useGPS ? "location.fill" : "mappin").font(.caption2)
                        .symbolEffect(.pulse, isActive: model.isCheckingLocation)
                    Text(model.activePlace?.name ?? W("masjid.choosePlace")).lineLimit(typeSize.isAccessibilitySize ? 3 : 1).minimumScaleFactor(0.8)
                    if let place = model.activePlace, place.isInAsia { Text(place.profile.flag) }
                    Image(systemName: "chevron.down").font(.caption2.weight(.bold)).opacity(0.6)
                }
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 8)
                .overlay(Capsule().strokeBorder(Theme.accent.opacity(0.7), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .accessibilityHint(W("today.changeLocation"))
            Spacer(minLength: 0)
            if model.prefs.musafirEnabled, let status = model.musafirStatus, status.isTraveller {
                Button { model.showJourney = true } label: {
                    Image("Tab-journey").resizable().scaledToFit().frame(width: 18, height: 18)
                        .frame(width: 34, height: 34)
                        .background(Theme.accent.opacity(0.25), in: Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(W("today.musafirButton"))
            }
            wakeChip(now)
                    if model.prefs.trackerEnabled { streakChip(now) }
            appearanceButton
            styleButton
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
        HeroDial(now: now, day: shown, nextFajr: nextFajr, timeZone: model.timeZone,
                currentPrayer: isToday ? PrayerLead(current: current, next: next)?.prayer : nil, marks: marks,
                label: { mark, size in
                    if let prayer = Prayer(rawValue: mark.id) {
                        PrayerMark(prayer: prayer, time: mark.date, now: now, size: size, day: shown,
                                   isCurrent: isToday && prayer == PrayerLead.open(current)?.prayer)
                    } else if let b = blessed.first(where: { $0.0.rawValue == mark.id }) {
                        BlessedMark(blessed: b.0, time: b.1, now: now, size: size)
                    }
                },
                centre: { size in dialCentre(now: now, shown: shown, current: isToday ? current : nil, next: next, size: size) })
            .animation(.snappy, value: showMore)
    }

    private func blessedTimes(_ shown: PrayerDay) -> [(BlessedTime, Date)] {
        guard let place = model.activePlace,
              let nextDay = model.day(containing: shown.time(.dhuhr).addingTimeInterval(86_400)) else { return [] }
        let all = BlessedTime.compute(day: shown, nextDay: nextDay, coordinates: place.coordinates, isRamadan: model.isRamadanDay(shown.time(.dhuhr)))
        // In Ramadan, Imsak is always shown.
        return showMore ? all : all.filter { $0.0 == .imsak }
    }

    /// "TODAY", the date and the Hijri date above the dial; tap for the calendar,
    /// or to come back to today.
    private func dateHeader(_ shown: PrayerDay) -> some View {
        let date = shown.time(.dhuhr)
        let f = DateFormatter()
        f.timeZone = model.timeZone
        f.dateFormat = "EEEE d MMMM"
        let label: String = switch dayOffset {
        case 0: W("common.today").uppercased()
        case 1: W("common.tomorrow").uppercased()
        case -1: W("today.yesterday").uppercased()
        default: dayOffset > 0 ? W("today.inDays", ["n": dayOffset]).uppercased() : W("today.daysAgo", ["n": -dayOffset]).uppercased()
        }
        return Button {
            if dayOffset == 0 { showCalendar = true } else { withAnimation(.snappy) { dayOffset = 0 } }
        } label: {
            VStack(spacing: 3) {
                Text(label).font(.caption.weight(.heavy)).tracking(0.8).foregroundStyle(Theme.accentText)
                Text(f.string(from: date)).font(Theme.display(26, .bold))
                HStack(spacing: 4) {
                    Text(model.hijriLabel(date))
                    Image(systemName: dayOffset == 0 ? "calendar" : "arrow.uturn.backward")
                }
                .font(.subheadline).foregroundStyle(.secondary)
            }
            .lineLimit(1).minimumScaleFactor(0.7)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityHint(dayOffset == 0 ? W("today.datesSources") : W("today.backToToday"))
    }

    /// The dial's centre: the prayer we are in and the time left until the next.
    /// From Syuruk to Zohor no prayer is open, so it names the next one instead.
    @ViewBuilder
    private func dialCentre(now: Date, shown: PrayerDay, current: (prayer: Prayer, time: Date)?,
                        next: (prayer: Prayer, time: Date)?, size: CGFloat) -> some View {
        if let lead = PrayerLead(current: current, next: next), let next {
            let count = PrayerCountdown(now: now, next: next, model: model)
            VStack(spacing: size * 0.006) {
                Text(lead.isNext ? W("today.next") : W("today.now")).font(.system(size: size * 0.028, weight: .heavy)).tracking(0.6)
                    .foregroundStyle(lead.prayer.textTint)
                Text(lead.prayer.name(model.naming, isFriday: model.isFriday(lead.time)))
                    .font(Theme.display(size * 0.085, .bold))
                Text(count.count)
                    .font(Theme.display(size * 0.066, .semibold)).monospacedDigit()
                    .foregroundStyle(Theme.accentText)
                    .contentTransition(.numericText(countsDown: true))
                if !count.label.isEmpty {
                    Text(count.label)
                        .font(.system(size: size * 0.034, weight: .medium))
                        .foregroundStyle(.secondary)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.6)
            .accessibilityElement(children: .combine)
            // Sized to the dial, not to the text size setting: it has to fit inside the circle.
            .accessibilityIdentifier("dial-centre")
        } else {
            Image(systemName: "moon.stars").font(.system(size: size * 0.08, weight: .light)).opacity(0.5)
        }
    }

    /// ‹ the source of these times ›
    private func dayRow(_ shown: PrayerDay) -> some View {
        HStack(spacing: 4) {
            Button { withAnimation(.snappy) { dayOffset -= 1 } } label: {
                Image(systemName: "chevron.left").font(.subheadline.weight(.semibold))
                    .frame(width: 36, height: 36).background(Color.primary.opacity(0.08), in: Circle())
            }
            .accessibilityLabel(W("today.prevDay"))
            Spacer(minLength: 4)
            SourceBadge(day: shown, compact: true)
            Spacer(minLength: 4)
            Button { withAnimation(.snappy) { dayOffset += 1 } } label: {
                Image(systemName: "chevron.right").font(.subheadline.weight(.semibold))
                    .frame(width: 36, height: 36).background(Color.primary.opacity(0.08), in: Circle())
            }
            .accessibilityLabel(W("today.nextDay"))
        }
        .buttonStyle(.plain)
    }

    // MARK: Colour Bands style

    /// The classic Singapore timetable look: each prayer a full-width band of
    /// colour, edge to edge, so the time can be read from across the room.
    private func bandsPage(now: Date, shown: PrayerDay,
                           current: (prayer: Prayer, time: Date)?, next: (prayer: Prayer, time: Date)?, fill: Bool) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Button { showPlaces = true } label: {
                        HStack(spacing: 5) {
                            Image(systemName: model.prefs.useGPS ? "location.fill" : "mappin").font(.caption2)
                                .symbolEffect(.pulse, isActive: model.isCheckingLocation)
                            Text(model.activePlace?.name ?? W("masjid.choosePlace")).lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
                            if let place = model.activePlace, place.isInAsia { Text(place.profile.flag) }
                            Image(systemName: "chevron.down").font(.caption2.weight(.bold)).opacity(0.6)
                        }
                        .font(.title3.weight(.bold))
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint(W("today.changeLocation"))
                    Spacer(minLength: 0)
                    if model.prefs.musafirEnabled, let status = model.musafirStatus, status.isTraveller {
                        Button { model.showJourney = true } label: {
                            Image("Tab-journey").resizable().scaledToFit().frame(width: 18, height: 18)
                                .frame(width: 34, height: 34).background(Color.white.opacity(0.12), in: Circle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(W("today.musafirButton"))
                    }
                    wakeChip(now)
                    if model.prefs.trackerEnabled { streakChip(now) }
                    appearanceButton
                    styleButton
                }
                if let lead = PrayerLead(current: current, next: next), let next, dayOffset == 0 {
                    Text("\(lead.prayer.name(model.naming, isFriday: model.isFriday(lead.time)))\(lead.isNext ? "" : " now ·") \(PrayerCountdown(now: now, next: next, model: model).text)")
                        .font(.subheadline.weight(.semibold)).monospacedDigit()
                        .foregroundStyle(.white.opacity(0.75))
                        .contentTransition(.numericText(countsDown: true))
                }
                if model.showAlertsPrompt { alertsPrompt }
                if !model.prefs.arrivalBannerDismissed { ArrivalCard() }
                if dayOffset == 0 { TodayNotes(now: now) }
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 4).padding(.bottom, 12)

            bandsDateBar(shown)

            VStack(spacing: 0) {
                ForEach(Prayer.allCases) { prayer in
                    PrayerBand(prayer: prayer, time: shown.time(prayer), now: now,
                               isCurrent: dayOffset == 0 && prayer == PrayerLead.open(current)?.prayer,
                               next: dayOffset == 0 && prayer == next?.prayer ? next : nil,
                               fill: fill)
                }
                ForEach(blessedTimes(shown), id: \.0) { item in
                    BlessedBand(blessed: item.0, time: item.1, now: now)
                }
            }
            .frame(maxHeight: fill ? .infinity : nil)
            .simultaneousGesture(DragGesture(minimumDistance: 30).onEnded { v in
                guard abs(v.translation.width) > abs(v.translation.height) * 2 else { return }
                withAnimation(.snappy) { dayOffset += v.translation.width < 0 ? 1 : -1 }
            })

            VStack(spacing: 12) {
                HStack {
                    SourceBadge(day: shown, compact: true)
                    Spacer(minLength: 8)
                    showMoreButton.fixedSize()
                }
                if dayOffset == 0 { ReviewLine(now: now) }
                if model.prefs.showOffers && showMore {
                    CommunityCardSlot(now: now, next: next)
                }
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 12)
            .padding(.bottom, fill ? 8 : 24)
        }
        .foregroundStyle(.white)
    }

    /// "‹  Sat 24 Oct 2026 · 13 Jamadilawal 1448  ›" on a darker strip.
    private func bandsDateBar(_ shown: PrayerDay) -> some View {
        let date = shown.time(.dhuhr)
        let f = DateFormatter()
        f.timeZone = model.timeZone
        f.dateFormat = "d MMM yyyy"
        let hijri = model.hijriLabel(date)
        return HStack(spacing: 4) {
            Button { withAnimation(.snappy) { dayOffset -= 1 } } label: {
                Image(systemName: "chevron.left").frame(width: 36, height: 40)
            }
            .accessibilityLabel(W("today.prevDay"))
            Button { if dayOffset == 0 { showCalendar = true } else { withAnimation(.snappy) { dayOffset = 0 } } } label: {
                HStack(spacing: 6) {
                    if dayOffset != 0 { Image(systemName: "arrow.uturn.backward").font(.caption) }
                    Text("\(f.string(from: date)) · \(hijri)").lineLimit(1).minimumScaleFactor(0.7)
                }
                .frame(maxWidth: .infinity)
            }
            .accessibilityHint(dayOffset == 0 ? W("today.datesSources") : W("today.backToToday"))
            Button { withAnimation(.snappy) { dayOffset += 1 } } label: {
                Image(systemName: "chevron.right").frame(width: 36, height: 40)
            }
            .accessibilityLabel(W("today.nextDay"))
        }
        .font(.headline)
        .buttonStyle(.plain)
        .padding(.horizontal, 8)
        .background(BandsPalette.dateBar)
    }

    // MARK: Centre Dial style

    /// The Day Dial centred at the top, buttons beside it, then the day and the
    /// list as on Sun Path - the two styles met in the middle.
    private func centrePage(now: Date, day: PrayerDay, shown: PrayerDay,
                            current: (prayer: Prayer, time: Date)?, next: (prayer: Prayer, time: Date)?, fill: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack(alignment: .topTrailing) {
                if let lead = PrayerLead(current: current, next: next), let next, let tomorrow = model.day(containing: model.noon(now, plus: 1)) {
                    DayDial(now: now, day: day, nextFajr: tomorrow.time(.fajr), timeZone: model.timeZone,
                            currentName: lead.prayer.name(model.naming, isFriday: model.isFriday(lead.time)),
                            currentPrayer: lead.prayer,
                            countdown: PrayerCountdown(now: now, next: next, model: model).count,
                            label: PrayerCountdown(now: now, next: next, model: model).label,
                            isNext: lead.isNext)
                        .frame(width: 148, height: 148)
                        .frame(maxWidth: .infinity)
                }
                VStack(spacing: 8) {
                    sunJourneyButton
                    styleButton
                    appearanceButton
                    wakeChip(now)
                    if model.prefs.trackerEnabled { streakChip(now) }
                }
                .padding(.top, 4)
            }
            // Room for the now-dot, which sits on the ring's edge.
            .padding(.bottom, 10)
            sunPlaceChip()
            if model.showAlertsPrompt { alertsPrompt }
            prayerHadith(next)
            if !model.prefs.arrivalBannerDismissed { ArrivalCard() }
            if dayOffset == 0 { TodayNotes(now: now) }
            if model.prefs.musafirEnabled, !model.prefs.musafirChipDismissed, let status = model.musafirStatus, status.isTraveller { sunMusafirChip(status) }
            sunDayNavigator(shown)
            PrayerList(day: shown, now: now,
                       current: dayOffset == 0 ? PrayerLead.open(current)?.prayer : nil,
                       next: dayOffset == 0 ? next : nil,
                       showMore: showMore, fill: fill)
                .frame(maxHeight: fill ? .infinity : nil, alignment: .top)
                .simultaneousGesture(DragGesture(minimumDistance: 30).onEnded { v in
                    guard abs(v.translation.width) > abs(v.translation.height) * 2 else { return }
                    withAnimation(.snappy) { dayOffset += v.translation.width < 0 ? 1 : -1 }
                })
            HStack {
                SourceBadge(day: shown, compact: true)
                Spacer(minLength: 8)
                showMoreButton.fixedSize()
            }
            if dayOffset == 0 { ReviewLine(now: now) }
            if model.prefs.showOffers && showMore {
                CommunityCardSlot(now: now, next: next)
            }
        }
        .padding(.horizontal, Theme.gutter)
        .padding(.top, 4)
        .padding(.bottom, fill ? 8 : 24)
    }

    // MARK: Sun Path style

    /// The sun's arc across the sky up top, where we are in the day small at
    /// the top left, then the list.
    private func sunPathPage(now: Date, day: PrayerDay, shown: PrayerDay,
                             current: (prayer: Prayer, time: Date)?, next: (prayer: Prayer, time: Date)?) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                sunTopBar(now: now, current: current, next: next)
                if let place = model.activePlace {
                    SunPath(now: now, day: day, coordinates: place.coordinates, timeZone: place.timeZone,
                            glow: Theme.sunArc)
                        .frame(height: 96)
                        .padding(.horizontal, -Theme.gutter)
                }
                sunPlaceChip()
                if model.showAlertsPrompt { alertsPrompt }
                prayerHadith(next)
                if !model.prefs.arrivalBannerDismissed { ArrivalCard() }
                if dayOffset == 0 { TodayNotes(now: now) }
                if model.prefs.musafirEnabled, !model.prefs.musafirChipDismissed, let status = model.musafirStatus, status.isTraveller { sunMusafirChip(status) }
                sunDayNavigator(shown)
                PrayerList(day: shown, now: now,
                           current: dayOffset == 0 ? PrayerLead.open(current)?.prayer : nil,
                           next: dayOffset == 0 ? next : nil,
                           showMore: showMore)
                    .simultaneousGesture(DragGesture(minimumDistance: 30).onEnded { v in
                        guard abs(v.translation.width) > abs(v.translation.height) * 2 else { return }
                        withAnimation(.snappy) { dayOffset += v.translation.width < 0 ? 1 : -1 }
                    })
                showMoreButton
                SourceBadge(day: shown)
                if dayOffset == 0 { ReviewLine(now: now) }
                if model.prefs.showOffers && showMore {
                    CommunityCardSlot(now: now, next: next)
                }
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.bottom, 32)
        }
        .scrollIndicators(.hidden)
    }

    /// Left: where we are in the day. Right: streak and settings. One row.
    private func sunTopBar(now: Date, current: (prayer: Prayer, time: Date)?, next: (prayer: Prayer, time: Date)?) -> some View {
        HStack(alignment: .top, spacing: 8) {
            if let lead = PrayerLead(current: current, next: next), let next {
                sunStatus(lead: lead, next: next, now: now)
            }
            Spacer(minLength: 0)
            sunJourneyButton
            wakeChip(now)
                    if model.prefs.trackerEnabled { streakChip(now) }
            appearanceButton
            styleButton
        }
        .padding(.top, 6)
    }

    /// "TODAY | ➤ Pasir Ris 🇸🇬" - which day and where, in one centred chip.
    private func sunPlaceChip() -> some View {
        let label: String = switch dayOffset {
        case 0: W("common.today").uppercased()
        case 1: W("common.tomorrow").uppercased()
        case -1: W("today.yesterday").uppercased()
        default: dayOffset > 0 ? W("today.inDays", ["n": dayOffset]).uppercased() : W("today.daysAgo", ["n": -dayOffset]).uppercased()
        }
        return Button { showPlaces = true } label: {
            HStack(spacing: 8) {
                Text(label).font(.caption.weight(.heavy)).tracking(0.5)
                Rectangle().fill(Color.primary.opacity(0.3)).frame(width: 1, height: 12)
                HStack(spacing: 5) {
                    Image(systemName: model.prefs.useGPS ? "location.fill" : "mappin").font(.caption2)
                        .symbolEffect(.pulse, isActive: model.isCheckingLocation)
                    Text(model.activePlace?.name ?? W("masjid.choosePlace")).lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
                    if let place = model.activePlace, place.isInAsia { Text(place.profile.flag) }
                    Image(systemName: "chevron.down").font(.caption2.weight(.bold)).opacity(0.6)
                }
                .font(.subheadline.weight(.semibold))
            }
            .padding(.horizontal, 14).padding(.vertical, 7)
            .background(Color.primary.opacity(0.06), in: Capsule())
            .overlay(Capsule().strokeBorder(Theme.sunArc.opacity(0.7), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .padding(.top, -6)
        .accessibilityHint(W("today.changeLocation"))
    }

    /// "Isyak · 9h 22m left to pray" - small, top left. From Syuruk to Zohor
    /// the next prayer leads: "Zohor · in 53m".
    private func sunStatus(lead: PrayerLead, next: (prayer: Prayer, time: Date), now: Date) -> some View {
        let leadName = lead.prayer.name(model.naming, isFriday: model.isFriday(lead.time))
        let nextName = next.prayer.name(model.naming, isFriday: model.isFriday(next.time))
        let remaining = next.time.timeIntervalSince(now)
        let count = PrayerCountdown(now: now, next: next, model: model)
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Circle().fill(lead.prayer.tint).frame(width: 9, height: 9)
                Text(leadName).font(.system(.title, design: .rounded, weight: .bold))
                    .lineLimit(1).minimumScaleFactor(0.5)
            }
            Text(count.text)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(count.urgent ? Theme.accent : .primary)
                .monospacedDigit()
                .contentTransition(.numericText(countsDown: true))
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(Color.primary.opacity(0.1), in: Capsule())
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(lead.isNext
            ? W("phone.today.nextAt", ["name": nextName, "time": model.formatted(next.time), "left": Self.spoken(remaining)])
            : W("phone.today.nowThen", ["name": leadName, "next": nextName, "time": model.formatted(next.time), "left": Self.spoken(remaining)]))
    }

    private func sunDayNavigator(_ shown: PrayerDay) -> some View {
        let date = shown.time(.dhuhr)
        let f = DateFormatter()
        f.timeZone = model.timeZone
        f.dateFormat = "EEEE d MMMM"
        let hijri = model.hijriLabel(date)
        return HStack {
            Button { withAnimation(.snappy) { dayOffset -= 1 } } label: {
                Image(systemName: "chevron.left").frame(width: 40, height: 40).opacity(0.6)
            }
            .accessibilityLabel(W("today.prevDay"))
            Spacer()
            Button { if dayOffset == 0 { showCalendar = true } else { withAnimation(.snappy) { dayOffset = 0 } } } label: {
                VStack(spacing: 2) {
                    Text(f.string(from: date)).font(.title3.weight(.semibold))
                    HStack(spacing: 4) {
                        Text(hijri)
                        Image(systemName: "calendar").font(.caption2)
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .accessibilityHint(dayOffset == 0 ? W("today.datesSources") : W("today.backToToday"))
            Spacer()
            Button { withAnimation(.snappy) { dayOffset += 1 } } label: {
                Image(systemName: "chevron.right").frame(width: 40, height: 40).opacity(0.6)
            }
            .accessibilityLabel(W("today.nextDay"))
        }
        .font(.headline.weight(.semibold))
        .buttonStyle(.plain)
    }

    /// Shown when a trip starts. Closing it tucks it away as the luggage button with the others.
    private func sunMusafirChip(_ status: Musafir.Status) -> some View {
        HStack(spacing: 4) {
            Button { model.showJourney = true } label: {
                HStack {
                    Image("Tab-journey").resizable().scaledToFit().frame(width: 17, height: 17)
                    Text(W("today.musafirLine")).lineLimit(1)
                    Spacer(minLength: 4)
                    Image(systemName: "chevron.right").font(.caption.weight(.bold))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Button {
                withAnimation(.snappy) { model.prefs.musafirChipDismissed = true }
            } label: {
                Image(systemName: "xmark").font(.caption.weight(.bold))
                    .frame(width: 28, height: 28)
                    .background(Color.primary.opacity(0.1), in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(W("today.musafirHide"))
        }
        .font(.subheadline.weight(.semibold))
        .padding(.leading, 16).padding(.trailing, 8).padding(.vertical, 8)
        .background(Color.primary.opacity(0.12), in: Capsule())
        .transition(.opacity.combined(with: .scale(scale: 0.95)))
    }

    /// The luggage button that takes the Musafir line's place once it's closed.
    @ViewBuilder
    private var sunJourneyButton: some View {
        if model.prefs.musafirEnabled, model.prefs.musafirChipDismissed, model.musafirStatus?.isTraveller == true {
            Button { model.showJourney = true } label: {
                Image("Tab-journey").resizable().scaledToFit().frame(width: 18, height: 18)
                    .frame(width: 34, height: 34)
                    .background(Theme.accent.opacity(0.25), in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(W("today.musafirButton"))
            .transition(.scale.combined(with: .opacity))
        }
    }

    /// Automatic (follows the sky) → Light → Dark, one tap each. Hidden on Colour
    /// Bands, which keeps its own fixed colours, so the button would do nothing there.
    @ViewBuilder private var appearanceButton: some View {
        if model.prefs.todayStyle != .bands { appearanceToggle }
    }

    private var appearanceToggle: some View {
        let symbol = switch model.prefs.appearance {
        case .system: "circle.lefthalf.filled"
        case .light: "sun.max.fill"
        case .dark: "moon.fill"
        }
        return Button {
            let all = Appearance.allCases
            let i = all.firstIndex(of: model.prefs.appearance) ?? 0
            withAnimation(.easeInOut) { model.prefs.appearance = all[(i + 1) % all.count] }
        } label: {
            Image(systemName: symbol).font(.subheadline.weight(.semibold))
                .contentTransition(.symbolEffect(.replace))
                .frame(width: 34, height: 34)
                .background(Color.primary.opacity(0.1), in: Circle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: model.prefs.appearance)
        .accessibilityLabel(W("phone.a11y.appearance", ["name": model.prefs.appearance.label]))
        .accessibilityHint(W("phone.a11y.appearanceHint"))
    }

    /// Tap to try the next Prayer screen style; touch and hold to pick one.
    /// The choice is kept (Settings, Look and feel shows the same).
    private var styleButton: some View {
        Button {
            let all = TodayStyle.allCases
            let i = all.firstIndex(of: model.prefs.todayStyle) ?? 0
            withAnimation(.snappy) { model.prefs.todayStyle = all[(i + 1) % all.count] }
        } label: {
            Image(systemName: "paintpalette.fill").font(.subheadline)
                .frame(width: 34, height: 34)
                .background(Color.primary.opacity(0.1), in: Circle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            ForEach(TodayStyle.allCases) { style in
                Button { withAnimation(.snappy) { model.prefs.todayStyle = style } } label: {
                    if style == model.prefs.todayStyle { Label(style.label, systemImage: "checkmark") } else { Text(style.label) }
                }
            }
        }
        .sensoryFeedback(.selection, trigger: model.prefs.todayStyle)
        .accessibilityLabel(W("phone.a11y.styleLabel", ["name": model.prefs.todayStyle.label]))
        .accessibilityHint(W("phone.a11y.styleHint"))
    }

    /// "9h 22m", "22m", "45s".
    /// "Jamaah 1:20 PM", with a countdown between the azan and the iqamah.
    @MainActor static func jamaahText(_ jamaah: Date, for prayer: Prayer, on day: PrayerDay, now: Date, model: AppModel) -> String {
        let text = W("phone.today.jamaah", ["time": model.formatted(jamaah)])
        return day.time(prayer) <= now && now < jamaah ? W("today.nextIn", ["name": text, "time": short(jamaah.timeIntervalSince(now))]) : text
    }

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

    /// The alarm clock: prayer alarms (Subuh first), one tap from the Prayer screen.
    /// Shows the next alarm's time when one is set.
    private func wakeChip(_ now: Date) -> some View {
        let next = model.nextWakeUp(after: now)
        let fajr = Prayer.fajr.name(model.naming)
        return Button { model.openAlerts() } label: {
            HStack(spacing: 4) {
                Image(systemName: next == nil ? "alarm" : "alarm.fill")
                if let next {
                    Text(model.formatted(next.date).replacingOccurrences(of: " AM", with: "").replacingOccurrences(of: " PM", with: ""))
                        .monospacedDigit()
                }
            }
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, next == nil ? 0 : 10)
            .frame(minWidth: 34, minHeight: 34)
            .background(next == nil ? Color.primary.opacity(0.1) : Theme.sunArc.opacity(0.3), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(next.map { W("phone.today.nextAlarm", ["time": model.formatted($0.date)]) } ?? W("settings.alertsAlarms"))
        .accessibilityHint(W("phone.a11y.alertsHint", ["name": fajr]))
    }

    private func streakChip(_ now: Date) -> some View {
        let excused = model.isExcused(now)
        let paused = model.trackerPaused
        return Button { showTracker = true } label: {
            HStack(spacing: 4) {
                Image(systemName: paused ? "pause.fill" : excused ? "drop.fill" : "checkmark.circle")
                Text("\(model.streak)").monospacedDigit()
            }
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 10).padding(.vertical, 8)
            .background(Color.primary.opacity(0.1), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(W("today.trackerButton", ["n": model.streak, "extra": paused ? ", paused" : excused ? ", excused today" : ""]))
        .accessibilityHint(W("phone.a11y.trackerHint"))
    }

    // MARK: Day

    /// One tap to be told when each prayer begins (all five, at the exact time).
    /// Before Subuh and before Asar: the hadith of the two cool prayers. Today only, and only on the list pages.
    @ViewBuilder
    private func prayerHadith(_ next: (prayer: Prayer, time: Date)?) -> some View {
        if dayOffset == 0, let next, next.prayer == .fajr || next.prayer == .asr {
            HadithView(id: .coolPrayers, tag: W("today.before", ["name": next.prayer.name(model.naming)]))
        }
    }

    private var alertsPrompt: some View {
        HStack(spacing: 10) {
            Image(systemName: "bell.badge.fill").foregroundStyle(Theme.accentText).accessibilityHidden(true)
            Text(W("today.alertPrompt")).font(.subheadline.weight(.semibold))
                .lineLimit(typeSize.isAccessibilitySize ? nil : 2).minimumScaleFactor(0.85)
                .fixedSize(horizontal: false, vertical: typeSize.isAccessibilitySize)
            Spacer(minLength: 4)
            Button(W("common.turnOn")) {
                Task {
                    guard await NotificationScheduler.requestPermission() else { return }
                    model.prefs.notifyPrayers = Set(Prayer.obligatory)
                    model.prefs.notificationsEnabled = true
                    await model.refreshNotificationStatus()
                }
            }
            .font(.subheadline.weight(.bold))
            .buttonStyle(.borderedProminent)
            .tint(Theme.sunArc)
            .foregroundStyle(.black.opacity(0.8))
            Button { withAnimation { model.prefs.alertsPromptDismissed = true } } label: {
                Image(systemName: "xmark").font(.caption.weight(.bold)).opacity(0.6).frame(width: 44, height: 44).contentShape(Rectangle())
                    .padding(.vertical, -10)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(W("common.notNow"))
        }
        .padding(.leading, 14).padding(.trailing, 8).padding(.vertical, 8)
        .background(Color.primary.opacity(0.08), in: Capsule())
        .overlay(Capsule().strokeBorder(Color.primary.opacity(0.1), lineWidth: 1))
    }

    private var showMoreButton: some View {
        Button { withAnimation(.snappy) { showMore.toggle() } } label: {
            HStack(spacing: 6) {
                Text(showMore ? W("common.showLess").uppercased() : W("common.showMore").uppercased())
                Image(systemName: showMore ? "chevron.up" : "chevron.down")
            }
            .font(.footnote.weight(.bold))
            .tracking(0.6)
            .padding(.horizontal, 16).padding(.vertical, 9)
            .background(Color.primary.opacity(0.1), in: Capsule())
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .accessibilityHint(W("phone.a11y.moreTimes"))
    }
}

// MARK: - The list

private struct PrayerList: View {
    @Environment(AppModel.self) private var model
    let day: PrayerDay
    let now: Date
    let current: Prayer?
    let next: (prayer: Prayer, time: Date)?
    let showMore: Bool
    /// Stretch the rows to fill the height they are given.
    var fill = false
    @State private var syurukOpen = false

    private enum Entry: Identifiable {
        case prayer(Prayer, Date)
        case blessed(BlessedTime, Date)
        var id: String {
            switch self {
            case .prayer(let p, _): p.rawValue
            case .blessed(let b, _): b.rawValue
            }
        }
        var time: Date {
            switch self {
            case .prayer(_, let d), .blessed(_, let d): d
            }
        }
    }

    private var entries: [Entry] {
        var list = Prayer.allCases.map { Entry.prayer($0, day.time($0)) }
        if let place = model.activePlace,
           let nextDay = model.day(containing: day.time(.dhuhr).addingTimeInterval(86_400)) {
            list += BlessedTime.compute(day: day, nextDay: nextDay, coordinates: place.coordinates, isRamadan: model.isRamadanDay(day.time(.dhuhr)))
                .filter { showMore || $0.0 == .imsak }
                .map { Entry.blessed($0.0, $0.1) }
        }
        return list.sorted { $0.time < $1.time }
    }

    var body: some View {
        VStack(spacing: 6) {
            list
            if model.allFiveOnAndAllowed {
                Button { model.showWakeUp = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "bell.fill").font(.caption)
                        Text(W("today.allFiveOn")).font(.footnote)
                        Text(W("alerts.change")).font(.footnote.weight(.bold)).foregroundStyle(Theme.accentText)
                    }
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(W("phone.a11y.allFive"))
            }
        }
    }

    private var list: some View {
        VStack(spacing: 6) {
            ForEach(entries) { entry in
                switch entry {
                case .prayer(let p, let t):
                    row(p, t)
                    // Tapping Syuruk opens a short hadith on why it is not a prayer time.
                    if p == .sunrise && syurukOpen && model.prefs.showHadith {
                        HadithView(id: .syuruk, style: .line).padding(.horizontal, 4)
                    }
                case .blessed(let b, let t): blessedRow(b, t)
                }
            }
        }
        .padding(8)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
            .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1))
    }

    private func row(_ prayer: Prayer, _ time: Date) -> some View {
        let isCurrent = prayer == current && time <= now
        let isNext = prayer == next?.prayer && next?.time == time
        let passed = time <= now && !isCurrent
        let mode = model.prefs.alertMode(prayer)
        let trackable = model.prefs.trackerEnabled && prayer.isObligatory && time <= now
        let prayed = trackable && model.isPrayed(prayer, on: time)
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(prayer.name(model.naming, isFriday: model.isFriday(time)))
                        .font(.title3.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                    if let local = model.localName(prayer, at: time) {
                        Text(local).font(.caption.weight(.medium)).foregroundStyle(.secondary)
                            .lineLimit(1).layoutPriority(-1)
                            .accessibilityLabel(W("today.calledHere", ["name": local]))
                    }
                    if prayed {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.subheadline)
                            .foregroundStyle(.green)
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                if isCurrent {
                    Text(W("today.now")).font(.caption2.weight(.heavy)).foregroundStyle(prayer.textTint)
                } else if isNext, let next {
                    Text(W("today.in", ["time": TodayView.short(next.time.timeIntervalSince(now))]))
                        .font(.caption.weight(.semibold)).monospacedDigit()
                        .foregroundStyle(prayer.textTint)
                }
                if let jamaah = day.jamaah[prayer] {
                    Text(TodayView.jamaahText(jamaah, for: prayer, on: day, now: now, model: model)).font(.caption.weight(.medium)).opacity(0.75)
                }
                if let other = day.alternate[prayer], let name = day.alternateSource {
                    Text("\(name) \(model.formatted(other))")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(SourceGrade.masjid.tint)
                        .accessibilityLabel(W("phone.a11y.gives", ["a": name, "b": model.formatted(other)]))
                }
            }
            .layoutPriority(-1)
            Spacer(minLength: 6)
            TimeText(parts: model.timeParts(time), size: 27)
            // All five on Notify: no repeating bells, one line under the list says so.
            if prayer.isObligatory && model.allFiveOnAndAllowed {
                Color.clear.frame(width: 30, height: 34).accessibilityHidden(true)
            } else {
            Group {
                Button { cycleAlert(prayer, model: model) } label: {
                    Image(systemName: mode.symbol)
                        .font(.subheadline)
                        .foregroundStyle(mode == .alarm ? Theme.sunArc : Color.primary)
                        .opacity(mode == .off ? 0.4 : 0.95)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                        // 44 pt to tap, but laid out at the old 30 by 34 so rows keep their height.
                        .padding(.horizontal, -7).padding(.vertical, -5)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(prayer.name(model.naming)) \(mode.word)")
                .accessibilityHint(W("phone.a11y.tapChange"))
                .contextMenu { AlertMenuItems(prayer: prayer) }
            }
            }
        }
        .padding(.leading, 14).padding(.trailing, 6).padding(.vertical, fill ? 8 : 12)
        .frame(maxHeight: fill ? 92 : nil)
        .contentShape(Rectangle())
        // Tracker (opt-in): tap a prayer that has passed to tick it off.
        .onTapGesture {
            guard trackable else {
                if prayer == .sunrise && model.prefs.showHadith { withAnimation(.snappy) { syurukOpen.toggle() } }
                return
            }
            withAnimation(.snappy) { model.togglePrayed(prayer, on: time) }
        }
        .sensoryFeedback(.success, trigger: prayed) { _, new in new }
        .accessibilityAction(named: prayed ? W("phone.tracker.markNot") : W("phone.tracker.mark")) {
            if trackable { model.togglePrayed(prayer, on: time) }
        }
        .background {
            if isCurrent {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(prayer.tint.opacity(0.16))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(prayer.tint.opacity(0.45), lineWidth: 1))
            }
        }
        .overlay(alignment: .leading) {
            Capsule().fill(prayer.tint.opacity(isCurrent ? 1 : 0.55)).frame(width: 3).padding(.vertical, 14).offset(x: -5)
        }
        .opacity(passed && !prayed ? 0.55 : 1)
        .accessibilityElement(children: .contain)
    }

    private func blessedRow(_ blessed: BlessedTime, _ time: Date) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(blessed.name(model.naming)).font(.body.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.8)
                Text(blessed.note).font(.caption).opacity(0.7).lineLimit(2)
            }
            .layoutPriority(-1)
            Spacer(minLength: 6)
            TimeText(parts: model.timeParts(time), size: 22, weight: .medium)
            Color.clear.frame(width: 30, height: 34)
        }
        .padding(.leading, 14).padding(.trailing, 6).padding(.vertical, 6)
        .overlay(alignment: .leading) {
            Capsule().fill(blessed.tint.opacity(0.35)).frame(width: 2).padding(.vertical, 12).offset(x: -5)
        }
        .opacity(time <= now ? 0.55 : 0.9)
        .transition(.opacity.combined(with: .move(edge: .top)))
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
        let mode = model.prefs.alertMode(prayer)
        let trackable = model.prefs.trackerEnabled && prayer.isObligatory && time <= now
        let prayed = trackable && model.isPrayed(prayer, on: time)
        Menu {
            AlertMenuItems(prayer: prayer)
            if trackable {
                Button { withAnimation(.snappy) { model.togglePrayed(prayer, on: time) } } label: {
                    Label(prayed ? W("phone.tracker.markNot") : W("phone.tracker.mark"),
                          systemImage: prayed ? "xmark.circle" : "checkmark.circle")
                }
            }
        } label: {
            VStack(spacing: 0) {
                HStack(spacing: 3) {
                    Text(name)
                        .font(.system(size: size * 0.034, weight: isCurrent ? .bold : .semibold))
                        .foregroundStyle(isCurrent ? prayer.textTint : Color.primary.opacity(0.75))
                    if prayed {
                        Image(systemName: "checkmark.circle.fill").font(.system(size: size * 0.03)).foregroundStyle(.green)
                    } else if mode == .alarm {
                        Image(systemName: "alarm.fill").font(.system(size: size * 0.026)).opacity(0.8)
                    } else if model.prefs.notificationsEnabled && mode == .off && prayer.isObligatory {
                        Image(systemName: "bell.slash").font(.system(size: size * 0.026)).opacity(0.5)
                    }
                }
                .lineLimit(1).minimumScaleFactor(0.7)
                TimeText(parts: model.timeParts(time), size: size * 0.05, weight: isCurrent ? .bold : .semibold)
                if let jamaah = day.jamaah[prayer] {
                    Text(TodayView.jamaahText(jamaah, for: prayer, on: day, now: now, model: model)).font(.system(size: size * 0.027, weight: .medium)).opacity(0.75)
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
            .font(.system(size: size * 0.028, weight: .semibold))
            .foregroundStyle(.secondary)
            .lineLimit(1).minimumScaleFactor(0.7)
            TimeText(parts: model.timeParts(time), size: size * 0.04, weight: .medium)
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
        switch blessed {
        case .midnight: W("today.midnightShort")
        case .lastThird: W("today.lastThirdShort")
        default: blessed.name(model.naming)
        }
    }
}

// MARK: - Colour bands

/// One prayer as a full-width band. Tap for its alert and, with the tracker
/// on, to tick it off.
private struct PrayerBand: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    let prayer: Prayer
    let time: Date
    let now: Date
    let isCurrent: Bool
    let next: (prayer: Prayer, time: Date)?
    let fill: Bool

    var body: some View {
        let mode = model.prefs.alertMode(prayer)
        let trackable = model.prefs.trackerEnabled && prayer.isObligatory && time <= now
        let prayed = trackable && model.isPrayed(prayer, on: time)
        let parts = model.timeParts(time)
        Menu {
            AlertMenuItems(prayer: prayer)
            if trackable {
                Button { withAnimation(.snappy) { model.togglePrayed(prayer, on: time) } } label: {
                    Label(prayed ? W("phone.tracker.markNot") : W("phone.tracker.mark"),
                          systemImage: prayed ? "xmark.circle" : "checkmark.circle")
                }
            }
        } label: {
            HStack(alignment: .center, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(prayer.name(model.naming, isFriday: model.isFriday(time)))
                            .font(.system(size: 26, weight: .bold))
                        if let local = model.localName(prayer, at: time) {
                            Text(local).font(.caption.weight(.semibold)).opacity(0.8)
                        }
                        if isCurrent {
                            Text(W("today.now")).font(.system(size: 11, weight: .heavy))
                                .padding(.horizontal, 7).padding(.vertical, 3)
                                .background(.white.opacity(0.25), in: Capsule())
                        }
                        if prayed { Image(systemName: "checkmark.circle.fill").font(.subheadline) }
                    }
                    if let next {
                        Text(W("today.in", ["time": TodayView.short(next.time.timeIntervalSince(now))]))
                            .font(.caption.weight(.semibold)).monospacedDigit().opacity(0.85)
                    }
                }
                .lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 6)
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(parts.time).font(.system(size: 34, weight: .light)).monospacedDigit()
                    if let suffix = parts.suffix { Text(suffix).font(.system(size: 22, weight: .bold)) }
                }
                .fixedSize()
                if mode == .alarm {
                    Image(systemName: "alarm.fill").font(.caption).opacity(0.85)
                } else if model.prefs.notificationsEnabled && mode == .off && prayer.isObligatory {
                    Image(systemName: "bell.slash").font(.caption).opacity(0.6)
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, Theme.gutter)
            .frame(maxWidth: .infinity, minHeight: 64, maxHeight: fill || typeSize.isAccessibilitySize ? .infinity : 64)
            .background(BandsPalette.color(prayer))
            .overlay(alignment: .leading) {
                if isCurrent { Rectangle().fill(.white).frame(width: 5) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.success, trigger: prayed) { _, new in new }
        .accessibilityLabel("\(prayer.name(model.naming)), \(model.formatted(time))\(isCurrent ? ", now" : "")\(prayed ? ", prayed" : "")")
    }

}

/// A blessed time under Show more: a thinner, quiet grey band.
private struct BlessedBand: View {
    @Environment(AppModel.self) private var model
    let blessed: BlessedTime
    let time: Date
    let now: Date

    var body: some View {
        let parts = model.timeParts(time)
        HStack(spacing: 8) {
            Image(systemName: blessed.symbol).font(.subheadline).opacity(0.8)
            VStack(alignment: .leading, spacing: 1) {
                Text(blessed.name(model.naming)).font(.headline)
                Text(blessed.note).font(.caption).opacity(0.7)
            }
            .lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 6)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(parts.time).font(.system(size: 24, weight: .light)).monospacedDigit()
                if let suffix = parts.suffix { Text(suffix).font(.system(size: 15, weight: .light)) }
            }
            .fixedSize()
        }
        .foregroundStyle(.white)
        .padding(.horizontal, Theme.gutter)
        .frame(maxWidth: .infinity, minHeight: 52)
        .background(Color(white: 0.3))
        .opacity(time <= now ? 0.7 : 1)
        .transition(.opacity.combined(with: .move(edge: .top)))
        .accessibilityElement(children: .combine)
    }
}

/// The long summer days note, then the Ramadan and Syawal card. One view, so the
/// Prayer pages' types stay as shallow as before.
private struct TodayNotes: View {
    let now: Date

    var body: some View {
        LongDaysNote(now: now)
        SeasonCard(now: now)
    }
}

/// Far from the equator in summer: why Fajr and Isha look unusual. Once per place and summer, closable.
private struct LongDaysNote: View {
    @Environment(AppModel.self) private var model
    let now: Date

    var body: some View {
        if let key = model.longDaysNote(now) {
            let w = LongDays.words(model.appLang)
            GlassCard {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "sun.max.fill").font(.title2).foregroundStyle(Theme.accent)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(w.title).font(.headline)
                        Text(w.body(Prayer.fajr.name(model.naming), Prayer.isha.name(model.naming)))
                            .font(.subheadline)
                            .opacity(0.85)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                    Button { withAnimation(.snappy) { model.closeLongDaysNote(key) } } label: {
                        Image(systemName: "xmark").font(.footnote.weight(.bold)).frame(width: 44, height: 44).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(w.close)
                }
            }
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
                        Text(profile.code.isEmpty ? W("today.welcome") : W("today.welcomeTo", ["place": profile.name]))
                            .font(.headline)
                        Text(model.isMethodAutomatic
                             ? W("today.switched", ["method": model.method.name, "country": model.method.parameterSummary])
                             : W("today.pinned", ["method": model.method.shortName]))
                            .font(.subheadline)
                            .opacity(0.85)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(model.sourceShort)
                            .font(.caption)
                            .opacity(0.75)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 0)
                    Button { model.prefs.arrivalBannerDismissed = true } label: {
                        Image(systemName: "xmark").font(.footnote.weight(.bold)).frame(width: 44, height: 44).contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(W("common.dismiss"))
                }
                Divider().overlay(Color.primary.opacity(0.25)).padding(.vertical, 8)
                Toggle(isOn: Binding(
                    get: { model.isMethodAutomatic },
                    set: { auto in model.prefs.methodOverrideID = auto ? nil : model.method.id })) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(W("today.switchAuto")).font(.subheadline.weight(.semibold))
                        Text(W("today.switchAutoSub")).font(.caption).opacity(0.75)
                    }
                }
                .tint(Theme.accent)
                if let home = model.prefs.home?.countryCode, home != profile.code {
                    Toggle(isOn: Binding(get: { model.prefs.musafirEnabled },
                                         set: { model.prefs.musafirEnabled = $0 })) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(W("settings.musafir")).font(.subheadline.weight(.semibold))
                            Text(W("today.musafirSub")).font(.caption).opacity(0.75)
                        }
                    }
                    .tint(Theme.accent)
                    .padding(.top, 6)
                    if model.prefs.musafirEnabled, !model.prefs.homeConfirmed {
                        HomeQuestionCard().padding(.top, 6)
                    }
                }
                HStack {
                    Text(W("settings.asr")).font(.subheadline.weight(.semibold))
                    Spacer()
                    Menu {
                        Button(W("common.automaticWith", ["name": profile.asr.label])) { model.prefs.asrOverride = nil }
                        ForEach(AsrSchool.allCases) { school in
                            Button(school.label) { model.prefs.asrOverride = school }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(model.asrSchool == .hanafi ? W("today.asrHanafi") : W("today.asrShafii"))
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
                Text(model.location.isDenied ? W("today.locationOff") : W("today.finding"))
                    .font(.title2.weight(.semibold))
                Text(W("today.whereExplain"))
                    .multilineTextAlignment(.center).opacity(0.85)
                Button(W("today.chooseCity")) { showPlaces = true }
                    .buttonStyle(.borderedProminent).tint(Color.primary.opacity(0.25))
            }
            .padding(32)
            .foregroundStyle(.primary)
        }
    }
}

// MARK: - The five looks, as on the web app (mockup v10 layout, v12 sizes)
//
// Ported from web/src/ui/Today.tsx and the `.v12` rules in web/src/ui/screens.css.
// Every look shares the same parts: the top bar (place on the left, alarm and menu on
// the right), the look's own top (dial, sun path, big words or the bands heading),
// the date with arrows right above the times, the list card with Show more inside,
// and the source line. Only colour, shape and each look's signature change.

extension TodayView {
    typealias Moment = (prayer: Prayer, time: Date)

    var lookStyle: TodayStyle { model.prefs.todayStyle }
    var pal: LookPalette { lookStyle.palette }

    /// A size that still follows the phone's text size (and Settings, Bigger text).
    func vf(_ size: CGFloat, _ weight: Font.Weight = .regular, display: Bool = false) -> Font {
        V12Type.font(size, weight, display: display, typeSize)
    }

    func v12Page(now: Date, day: PrayerDay, shown: PrayerDay, current: Moment?, next: Moment?, fill: Bool) -> AnyView {
        if lookStyle == .bands {
            return AnyView(v12Bands(now: now, shown: shown, current: current, next: next, fill: fill))
        }
        return AnyView(v12Stack(now: now, day: day, shown: shown, current: current, next: next, fill: fill))
    }

    // MARK: Centre Dial, Sun Path, Big and Simple, Calm Gold

    private func v12Stack(now: Date, day: PrayerDay, shown: PrayerDay, current: Moment?, next: Moment?, fill: Bool) -> some View {
        VStack(spacing: 10) {
            v12TopBar(now)
            AnyView(v12Hero(now: now, day: day, current: current, next: next))
            if model.showAlertsPrompt { alertsPrompt }
            if lookStyle != .simple { prayerHadith(next) }
            if !model.prefs.arrivalBannerDismissed { ArrivalCard() }
            if dayOffset == 0 { TodayNotes(now: now) }
            if model.prefs.musafirEnabled, !model.prefs.musafirChipDismissed, let status = model.musafirStatus, status.isTraveller { sunMusafirChip(status) }
            v12DayNav(shown)
            V12List(look: lookStyle, day: shown, now: now,
                    current: dayOffset == 0 ? PrayerLead.open(current)?.prayer : nil,
                    next: dayOffset == 0 ? next : nil,
                    showMore: $showMore,
                    onSwipe: { step in withAnimation(.snappy) { dayOffset += step } })
                .frame(maxHeight: fill && lookStyle == .simple ? .infinity : nil, alignment: .top)
            if lookStyle != .simple { V12SourceLine(day: shown, look: lookStyle).frame(maxWidth: .infinity) }
            if dayOffset == 0 { ReviewLine(now: now) }
            if model.prefs.showOffers && showMore { CommunityCardSlot(now: now, next: next) }
            if fill && lookStyle != .simple { Spacer(minLength: 0) }
        }
        .foregroundStyle(pal.tx)
        .padding(.horizontal, Theme.gutter)
        .padding(.top, 4)
        .padding(.bottom, fill ? 8 : 24)
    }

    /// Each look's own top: the dial, the sun's path, or the big words.
    @ViewBuilder
    private func v12Hero(now: Date, day: PrayerDay, current: Moment?, next: Moment?) -> some View {
        if let lead = PrayerLead(current: current, next: next), let next {
            let count = PrayerCountdown(now: now, next: next, model: model)
            let name = lead.prayer.name(model.naming, isFriday: model.isFriday(lead.time))
            switch lookStyle {
            case .sunPath:
                v12SunHero(now: now, day: day, lead: lead, name: name, next: next, count: count)
            case .simple:
                v12SimpleHero(name: name, count: count)
            default:
                v12DialHero(now: now, day: day, name: name, next: next, count: count)
            }
        }
    }

    @ViewBuilder
    private func v12DialHero(now: Date, day: PrayerDay, name: String, next: Moment, count: PrayerCountdown) -> some View {
        let gold = lookStyle == .gold
        let inPrayer = count.label == "left to pray"
        let nextName = next.prayer.name(model.naming, isFriday: model.isFriday(next.time))
        let bare = TodayView.short(next.time.timeIntervalSince(now))
        let tomorrowFajr = model.day(containing: model.noon(now, plus: 1))?.time(.fajr) ?? day.time(.fajr).addingTimeInterval(86_400)
        V12Dial(now: now, day: day, nextFajr: tomorrowFajr, timeZone: model.timeZone, gold: gold,
                kicker: inPrayer ? name : W("today.nextPrayer"),
                count: inPrayer ? count.count : bare,
                label: inPrayer ? count.label : "until \(nextName)",
                urgent: count.urgent,
                spoken: inPrayer ? W("phone.today.nowLeft", ["name": name, "left": count.count]) : W("phone.today.nextIn", ["name": nextName, "left": TodayView.spoken(next.time.timeIntervalSince(now))]))
            .frame(width: gold ? 204 : 190, height: gold ? 204 : 190)
            .frame(maxWidth: .infinity)
            .padding(.top, 2)
    }

    /// Sun Path: the prayer's name big, the time left in a pill, the day's arc edge to edge.
    private func v12SunHero(now: Date, day: PrayerDay, lead: PrayerLead, name: String, next: Moment, count: PrayerCountdown) -> some View {
        let nextName = next.prayer.name(model.naming, isFriday: model.isFriday(next.time))
        let remaining = next.time.timeIntervalSince(now)
        return VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    Circle().fill(lead.prayer.tint).frame(width: 10, height: 10)
                    Text(name).font(vf(44, .bold, display: true)).lineLimit(1).minimumScaleFactor(0.5)
                }
                Text(count.text)
                    .font(vf(16, .semibold)).monospacedDigit()
                    .foregroundStyle(count.urgent ? pal.accent : pal.tx)
                    .contentTransition(.numericText(countsDown: true))
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(v12Shape(18).fill(pal.card))
                    .overlay(v12Shape(18).strokeBorder(pal.stroke, lineWidth: 1))
            }
            .padding(.top, 2)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(lead.isNext
                ? W("phone.today.nextAt", ["name": nextName, "time": model.formatted(next.time), "left": Self.spoken(remaining)])
                : W("phone.today.nowThen", ["name": name, "next": nextName, "time": model.formatted(next.time), "left": Self.spoken(remaining)]))
            if let place = model.activePlace {
                V12SunPath(now: now, day: day, timeZone: place.timeZone)
                    .frame(height: 120)
                    .padding(.horizontal, -Theme.gutter)
                    .padding(.top, -4)
                    .accessibilityHidden(true)
            }
        }
    }

    /// Big and Simple: the prayer and the time left in big words.
    private func v12SimpleHero(name: String, count: PrayerCountdown) -> some View {
        VStack(spacing: 2) {
            HStack(spacing: 8) {
                Text(name).font(vf(46, .bold, display: true)).foregroundStyle(Color.dyn(0x4B3CBF, 0xB2A8FF))
                    .lineLimit(1).minimumScaleFactor(0.6)
                if count.done {
                    Image(systemName: "checkmark.circle.fill").font(.system(size: 30)).foregroundStyle(pal.accent)
                }
            }
            Text(count.text)
                .font(vf(24, .semibold, display: true)).monospacedDigit()
                .foregroundStyle(count.urgent ? pal.accent : pal.tx)
                .lineLimit(1).minimumScaleFactor(0.7)
                .contentTransition(.numericText(countsDown: true))
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 4).padding(.bottom, 2)
        .accessibilityElement(children: .combine)
    }

    // MARK: Top bar

    /// Place on the left; the trip button, alarm and menu on the right.
    func v12TopBar(_ now: Date) -> some View {
        HStack(spacing: 8) {
            v12PlaceChip
            Spacer(minLength: 0)
            if model.prefs.musafirEnabled, model.prefs.musafirChipDismissed, model.musafirStatus?.isTraveller == true {
                Button { model.showJourney = true } label: {
                    Image("Tab-journey").resizable().scaledToFit().frame(width: 18, height: 18)
                        .frame(width: 44, height: 44)
                        .background(v12Shape(22).fill(pal.accent.opacity(0.25)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(W("today.musafirButton"))
            }
            v12WakeChip(now)
            v12Menu(now)
        }
    }

    /// Square in Colour Bands, round everywhere else.
    func v12Shape(_ radius: CGFloat) -> RoundedRectangle {
        RoundedRectangle(cornerRadius: lookStyle == .bands ? min(radius, 10) : radius, style: .continuous)
    }

    /// The glass under a chip on the sky; flat on Colour Bands and Calm Gold.
    @ViewBuilder
    private func v12Chip(_ radius: CGFloat) -> some View {
        let shape = v12Shape(radius)
        ZStack {
            if lookStyle != .bands && lookStyle != .gold { shape.fill(.ultraThinMaterial) }
            shape.fill(pal.card)
            shape.strokeBorder(pal.stroke, lineWidth: 1)
        }
    }

    private var v12PlaceChip: some View {
        let name = model.activePlace?.name ?? W("masjid.choosePlace")
        return Button { showPlaces = true } label: {
            HStack(spacing: 5) {
                Image(systemName: model.prefs.useGPS ? "location.fill" : "mappin")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(pal.accent)
                    .symbolEffect(.pulse, isActive: model.isCheckingLocation)
                Text(name).lineLimit(typeSize.isAccessibilitySize ? 2 : 1).minimumScaleFactor(0.8)
                if let place = model.activePlace, place.isInAsia { Text(place.profile.flag) }
                Image(systemName: "chevron.down").font(.system(size: 10, weight: .heavy)).opacity(0.6)
            }
            .font(vf(name.count > 11 ? 13 : 15, .semibold))
            .foregroundStyle(pal.tx)
            .padding(.horizontal, 12)
            .frame(minHeight: 36)
            .background(v12Chip(lookStyle == .bands ? 6 : 18))
            .padding(.vertical, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(W("phone.a11y.changeLocation", ["place": name]))
    }

    /// The alarm clock, with the next alarm's time when one is set.
    private func v12WakeChip(_ now: Date) -> some View {
        let next = model.nextWakeUp(after: now)
        let fajr = Prayer.fajr.name(model.naming)
        return Button { model.openAlerts() } label: {
            HStack(spacing: 5) {
                Image(systemName: next == nil ? "alarm" : "alarm.fill").font(.system(size: next == nil ? 19 : 15, weight: .medium))
                if let next {
                    Text(model.formatted(next.date).replacingOccurrences(of: " AM", with: "").replacingOccurrences(of: " PM", with: ""))
                        .font(vf(15, .semibold)).monospacedDigit()
                }
            }
            .foregroundStyle(next == nil ? pal.tx : pal.accent)
            .padding(.horizontal, next == nil ? 0 : 12)
            .frame(minWidth: 44, minHeight: 44)
            .background(v12Chip(22))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(next.map { W("phone.today.nextAlarm", ["time": model.formatted($0.date)]) } ?? W("settings.alertsAlarms"))
        .accessibilityHint(W("phone.a11y.alertsHint", ["name": fajr]))
    }

    /// The menu: light or dark, the five looks, and the prayer tracker.
    private func v12Menu(_ now: Date) -> some View {
        Menu {
            Section(W("settings.appearance")) {
                ForEach(Appearance.allCases) { a in
                    Button { withAnimation(.easeInOut) { model.prefs.appearance = a } } label: {
                        if a == model.prefs.appearance { Label(v12AppearanceWord(a), systemImage: "checkmark") } else { Text(v12AppearanceWord(a)) }
                    }
                }
            }
            Menu {
                ForEach(TodayStyle.looks) { style in
                    Button { withAnimation(.snappy) { model.prefs.todayStyle = style } } label: {
                        if style == model.prefs.todayStyle { Label(style.label, systemImage: "checkmark") } else { Text(style.label) }
                    }
                }
            } label: {
                Label(W("settings.lookFeel"), systemImage: "paintpalette")
            }
            Button { showTracker = true } label: {
                Label(W("settings.trackerOn"), systemImage: "checkmark.circle")
                Text(v12TrackerWord(now))
            }
        } label: {
            Image(systemName: "ellipsis").font(.system(size: 18, weight: .bold))
                .foregroundStyle(pal.tx)
                .frame(width: 44, height: 44)
                .background(v12Chip(22))
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: model.prefs.todayStyle)
        .accessibilityLabel(W("phone.a11y.menuLook", ["name": model.prefs.todayStyle.label]))
        .accessibilityHint(W("phone.a11y.menuHint"))
    }

    private func v12AppearanceWord(_ a: Appearance) -> String {
        switch a {
        case .system: W("common.automatic")
        case .light: W("appearance.light")
        case .dark: W("appearance.dark")
        }
    }

    private func v12TrackerWord(_ now: Date) -> String {
        if !model.prefs.trackerEnabled { return W("common.off") }
        if model.trackerPaused { return W("today.trackerPaused") }
        if model.isExcused(now) { return W("tracker.excusedToday") }
        return model.streak == 1 ? W("phone.today.oneDay") : "\(model.streak) days"
    }

    // MARK: Date

    /// "Thu 26 Nov" over the Hijri date, with ‹ › for other days. Tap for the calendar.
    private func v12DayNav(_ shown: PrayerDay) -> some View {
        let date = shown.time(.dhuhr)
        let f = DateFormatter()
        f.timeZone = model.timeZone
        f.dateFormat = "EEE d MMM"
        return HStack(spacing: 0) {
            Button { withAnimation(.snappy) { dayOffset -= 1 } } label: {
                Image(systemName: "chevron.left").font(.system(size: 20, weight: .medium))
                    .foregroundStyle(pal.tx2).frame(width: 44, height: 44).contentShape(Rectangle())
            }
            .accessibilityLabel(W("today.prevDay"))
            Button { if dayOffset == 0 { showCalendar = true } else { withAnimation(.snappy) { dayOffset = 0 } } } label: {
                VStack(spacing: 1) {
                    Text(f.string(from: date)).font(vf(18, .bold)).foregroundStyle(pal.tx)
                    HStack(spacing: 6) {
                        Text(model.hijriLabel(date))
                        Image(systemName: dayOffset == 0 ? "calendar" : "arrow.uturn.backward").font(.system(size: 13))
                    }
                    .font(vf(14)).foregroundStyle(pal.tx2)
                }
                .lineLimit(1).minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
            }
            .accessibilityElement(children: .combine)
            .accessibilityHint(dayOffset == 0 ? W("today.datesSources") : W("today.backToToday"))
            Button { withAnimation(.snappy) { dayOffset += 1 } } label: {
                Image(systemName: "chevron.right").font(.system(size: 20, weight: .medium))
                    .foregroundStyle(pal.tx2).frame(width: 44, height: 44).contentShape(Rectangle())
            }
            .accessibilityLabel(W("today.nextDay"))
        }
        .buttonStyle(.plain)
        .padding(.top, 2)
    }

    // MARK: Colour Bands

    private func v12Bands(now: Date, shown: PrayerDay, current: Moment?, next: Moment?, fill: Bool) -> some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 8) {
                v12TopBar(now)
                if dayOffset == 0, let lead = PrayerLead(current: current, next: next), let next {
                    let name = lead.prayer.name(model.naming, isFriday: model.isFriday(lead.time))
                    let hero = Text(lead.isNext ? name : "\(name) now").font(vf(34, .bold, display: true))
                        + Text("  " + PrayerCountdown(now: now, next: next, model: model).text).font(vf(17)).foregroundColor(pal.tx2)
                    hero
                        .lineLimit(2).minimumScaleFactor(0.7)
                        .padding(.top, 2)
                }
                if model.showAlertsPrompt { alertsPrompt }
                if !model.prefs.arrivalBannerDismissed { ArrivalCard() }
                if model.prefs.musafirEnabled, !model.prefs.musafirChipDismissed, let status = model.musafirStatus, status.isTraveller { sunMusafirChip(status) }
                if dayOffset == 0 { TodayNotes(now: now) }
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 4).padding(.bottom, 10)

            v12BandsDate(shown)

            VStack(spacing: 0) {
                ForEach(Prayer.allCases) { prayer in
                    V12Band(prayer: prayer, time: shown.time(prayer), now: now,
                            isCurrent: dayOffset == 0 && prayer == PrayerLead.open(current)?.prayer,
                            next: dayOffset == 0 && prayer == next?.prayer ? next : nil,
                            fill: fill)
                }
                ForEach(blessedTimes(shown), id: \.0) { item in
                    V12BlessedBand(blessed: item.0, time: item.1, now: now)
                }
            }
            .frame(maxHeight: fill ? .infinity : nil)
            .simultaneousGesture(DragGesture(minimumDistance: 30).onEnded { v in
                guard abs(v.translation.width) > abs(v.translation.height) * 2 else { return }
                withAnimation(.snappy) { dayOffset += v.translation.width < 0 ? 1 : -1 }
            })

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    V12SourceLine(day: shown, look: .bands)
                    Spacer(minLength: 8)
                    V12MoreLink(showMore: $showMore, look: .bands).fixedSize()
                }
                if dayOffset == 0 { ReviewLine(now: now) }
                if model.prefs.showOffers && showMore { CommunityCardSlot(now: now, next: next) }
                V12AllFiveLine(look: .bands)
                Text(W("bands.credit"))
                    .font(vf(12)).foregroundStyle(pal.tx2)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.bottom, 8)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 4)
            .padding(.bottom, fill ? 0 : 16)
        }
        .foregroundStyle(pal.tx)
    }

    /// "‹  26 Nov · 16 Jumada al-Akhirah 1448  ›" between two hairlines.
    private func v12BandsDate(_ shown: PrayerDay) -> some View {
        let date = shown.time(.dhuhr)
        let f = DateFormatter()
        f.timeZone = model.timeZone
        f.dateFormat = "d MMM"
        return HStack(spacing: 0) {
            Button { withAnimation(.snappy) { dayOffset -= 1 } } label: {
                Image(systemName: "chevron.left").font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(pal.tx2).frame(width: 44, height: 44).contentShape(Rectangle())
            }
            .accessibilityLabel(W("today.prevDay"))
            Button { if dayOffset == 0 { showCalendar = true } else { withAnimation(.snappy) { dayOffset = 0 } } } label: {
                HStack(spacing: 6) {
                    if dayOffset != 0 { Image(systemName: "arrow.uturn.backward").font(.caption) }
                    Text("\(f.string(from: date)) · \(model.hijriLabel(date))").lineLimit(1).minimumScaleFactor(0.7)
                }
                .font(vf(15))
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
            }
            .accessibilityHint(dayOffset == 0 ? W("today.datesSources") : W("today.backToToday"))
            Button { withAnimation(.snappy) { dayOffset += 1 } } label: {
                Image(systemName: "chevron.right").font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(pal.tx2).frame(width: 44, height: 44).contentShape(Rectangle())
            }
            .accessibilityLabel(W("today.nextDay"))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Theme.gutter - 4)
        .overlay(alignment: .top) { Rectangle().fill(pal.sep).frame(height: 1).padding(.horizontal, Theme.gutter) }
        .overlay(alignment: .bottom) { Rectangle().fill(pal.sep).frame(height: 1).padding(.horizontal, Theme.gutter) }
    }
}

/// Text sizes in points at the phone's default text size, scaled with its setting.
enum V12Type {
    static func scale(_ t: DynamicTypeSize) -> CGFloat {
        switch t {
        case .xSmall: 0.82
        case .small: 0.88
        case .medium: 0.94
        case .large: 1
        case .xLarge: 1.1
        case .xxLarge: 1.2
        case .xxxLarge: 1.3
        case .accessibility1: 1.45
        case .accessibility2: 1.6
        case .accessibility3: 1.75
        case .accessibility4: 1.9
        default: 2
        }
    }

    static func font(_ size: CGFloat, _ weight: Font.Weight, display: Bool, _ t: DynamicTypeSize) -> Font {
        .system(size: (size * scale(t)).rounded(), weight: weight, design: display ? .rounded : .default)
    }
}

/// Calm Gold's fill for the tick, the dot and the alarm: gold, deeper on white.
private func v12Fill(_ look: TodayStyle) -> Color {
    look == .gold ? Color(hex: 0xE2B65A) : look.palette.accent
}

// MARK: - The dial (Centre Dial and Calm Gold)

/// Centre Dial: the whole day as a 24 hour ring in the colours of the sky, noon at the
/// top, a glowing dot for now. Calm Gold: one thin ring, the hours since midnight in gold.
/// The centre says the prayer we are in and the time left (web DayDial and GoldDial).
private struct V12Dial: View {
    @Environment(\.look) private var look
    let now: Date
    let day: PrayerDay
    let nextFajr: Date
    let timeZone: TimeZone
    let gold: Bool
    let kicker: String
    let count: String
    let label: String
    let urgent: Bool
    let spoken: String

    private var midnight: Date {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        return cal.startOfDay(for: day.time(.dhuhr))
    }

    var body: some View {
        GeometryReader { geo in
            let size = min(geo.size.width, geo.size.height)
            ZStack {
                if gold { goldRing(size) } else { skyRing(size) }
                glyphs(size)
                centre(size)
            }
            .frame(width: size, height: size)
            .position(x: geo.size.width / 2, y: geo.size.height / 2)
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spoken)
        .accessibilityIdentifier("dial-centre")
    }

    /// Degrees clockwise from the top, with noon at the top and midnight at the bottom.
    private func angle(_ date: Date) -> Double { date.timeIntervalSince(midnight) / 3600 / 24 * 360 + 180 }

    private func arc(_ c: CGPoint, _ r: CGFloat, _ a0: Double, _ a1: Double) -> Path {
        var p = Path()
        p.addArc(center: c, radius: r, startAngle: .degrees(a0 - 90), endAngle: .degrees(a1 - 90), clockwise: false)
        return p
    }

    private func point(_ c: CGPoint, _ r: CGFloat, _ a: Double) -> CGPoint {
        let rad = a * .pi / 180
        return CGPoint(x: c.x + CGFloat(sin(rad)) * r, y: c.y - CGFloat(cos(rad)) * r)
    }

    private func skyRing(_ size: CGFloat) -> some View {
        let p = look.palette
        let stops = V12Sky.stops(day: day, midnight: midnight)
        return Canvas { ctx, sz in
            let k = size / 190
            let ring = 10 * k
            let r = size / 2 - ring / 2
            let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
            ctx.stroke(arc(c, r, 0, 360), with: .color(p.tx.opacity(0.1)), lineWidth: ring)
            let order = Prayer.allCases
            for (i, prayer) in order.enumerated() {
                let a0 = angle(day.time(prayer)) + 0.9
                let a1 = (i + 1 < order.count ? angle(day.time(order[i + 1])) : angle(nextFajr)) - 0.9
                guard a1 > a0 else { continue }
                let n = max(1, Int(((a1 - a0) / 2.5).rounded(.up)))
                let step = (a1 - a0) / Double(n)
                for j in 0..<n {
                    let s = a0 + Double(j) * step
                    let e = min(a1, s + step + (j < n - 1 ? 0.4 : 0))
                    let mid = (s + min(a1, s + step)) / 2
                    ctx.stroke(arc(c, r, s, e), with: .color(V12Sky.color(stops, (mid - 180) / 360)), lineWidth: ring)
                }
            }
            let dot = point(c, r, angle(now))
            ctx.fill(Path(ellipseIn: CGRect(x: dot.x - 13 * k, y: dot.y - 13 * k, width: 26 * k, height: 26 * k)), with: .color(p.accent.opacity(0.5)))
            ctx.fill(Path(ellipseIn: CGRect(x: dot.x - 9 * k, y: dot.y - 9 * k, width: 18 * k, height: 18 * k)), with: .color(.white))
        }
        .frame(width: size, height: size)
    }

    private func goldRing(_ size: CGFloat) -> some View {
        let track = Color.dyn(Color(hex: 0x151A45, opacity: 0.1), Color.white.opacity(0.08))
        let fill = Color(hex: 0xE2B65A)
        let fraction = now.timeIntervalSince(midnight) / 86_400
        let a1 = 180 + min(359.5, max(0.5, fraction * 360))
        return Canvas { ctx, sz in
            let k = size / 214
            let r = 98 * k
            let w = 3 * k
            let c = CGPoint(x: sz.width / 2, y: sz.height / 2)
            ctx.stroke(arc(c, r, 0, 360), with: .color(track), lineWidth: w)
            ctx.stroke(arc(c, r, 180, a1), with: .color(fill), style: StrokeStyle(lineWidth: w, lineCap: .round))
            let dot = point(c, r, a1)
            let dotRect = CGRect(x: dot.x - 7 * k, y: dot.y - 7 * k, width: 14 * k, height: 14 * k)
            ctx.fill(Path(ellipseIn: dotRect), with: .color(.white))
            ctx.stroke(Path(ellipseIn: dotRect), with: .color(fill), lineWidth: w)
        }
        .frame(width: size, height: size)
    }

    /// The sun at noon and the moon at midnight, inside the ring.
    private func glyphs(_ size: CGFloat) -> some View {
        let k = gold ? size / 214 : size / 190
        let glyph = gold ? 16 * k : 15 * k
        let fromEdge = gold ? 20 * k : 10 * k + 5 * k + 7.5 * k
        let colour = gold ? Color(hex: 0xE2B65A) : look.palette.accent
        return ZStack {
            Image(systemName: "sun.max").font(.system(size: glyph, weight: .regular))
                .offset(y: -(size / 2 - fromEdge))
            Image(systemName: "moon").font(.system(size: glyph * 0.9, weight: .regular))
                .offset(y: size / 2 - fromEdge)
        }
        .foregroundStyle(colour)
    }

    private func centre(_ size: CGFloat) -> some View {
        let p = look.palette
        let k = gold ? size / 214 : size / 190
        return VStack(spacing: 0) {
            Text(kicker).font(.system(size: (gold ? 14 : 13) * k, weight: .medium)).foregroundStyle(p.tx2)
            Text(count)
                .font(.system(size: (gold ? 40 : 32) * k, weight: .bold, design: .rounded)).monospacedDigit()
                .foregroundStyle(urgent ? p.accent : p.tx)
                .contentTransition(.numericText(countsDown: true))
            if !label.isEmpty {
                Text(label).font(.system(size: 14 * k, weight: .medium)).foregroundStyle(p.tx2)
            }
        }
        .lineLimit(1)
        .minimumScaleFactor(0.6)
        .padding(.horizontal, size * 0.16)
    }
}

/// The sky through the day as colour stops, midnight (0) to midnight (1). Same as the web.
enum V12Sky {
    typealias RGB = (Double, Double, Double)
    static let night: RGB = (0.13, 0.15, 0.36)
    static let dawnPeach: RGB = (0.96, 0.70, 0.58)
    static let tint: [Prayer: RGB] = [
        .fajr: (0.50, 0.61, 0.88), .sunrise: (0.95, 0.77, 0.42), .dhuhr: (0.95, 0.60, 0.20),
        .asr: (0.91, 0.50, 0.25), .maghrib: (0.87, 0.36, 0.33), .isha: (0.42, 0.37, 0.76),
    ]

    static func stops(day: PrayerDay, midnight: Date) -> [(Double, RGB)] {
        func f(_ p: Prayer) -> Double { min(1, max(0, day.time(p).timeIntervalSince(midnight) / 86_400)) }
        let t = { (p: Prayer) -> RGB in tint[p] ?? night }
        return [
            (0, night),
            (max(0, f(.fajr) - 0.06), t(.isha)),
            (f(.fajr), t(.fajr)),
            (f(.sunrise), dawnPeach),
            ((f(.sunrise) + f(.dhuhr)) / 2, t(.sunrise)),
            (f(.dhuhr), t(.dhuhr)),
            (f(.asr), t(.asr)),
            (f(.maghrib), t(.maghrib)),
            (f(.isha), t(.isha)),
            (1, night),
        ]
    }

    static func color(_ stops: [(Double, RGB)], _ x: Double) -> Color {
        let f = (x.truncatingRemainder(dividingBy: 1) + 1).truncatingRemainder(dividingBy: 1)
        var i = 0
        while i < stops.count - 2 && f > stops[i + 1].0 { i += 1 }
        let (a, ca) = stops[i]
        let (b, cb) = stops[i + 1]
        let k = b > a ? min(1, max(0, (f - a) / (b - a))) : 0
        return Color(red: ca.0 + (cb.0 - ca.0) * k, green: ca.1 + (cb.1 - ca.1) * k, blue: ca.2 + (cb.2 - ca.2) * k)
    }
}

// MARK: - The sun's path (Sun Path)

/// The day as one smooth arc, midnight to midnight: highest at solar noon, crossing the
/// horizon at sunrise and Maghrib, a hollow ring at each prayer, a warm sun (or the
/// moon) at now. Port of the web SunPath with its v12 look.
private struct V12SunPath: View {
    @Environment(\.look) private var look
    let now: Date
    let day: PrayerDay
    let timeZone: TimeZone

    var body: some View {
        let p = look.palette
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = timeZone
        let start = cal.startOfDay(for: day.time(.dhuhr))
        func fraction(_ d: Date) -> Double { min(1, max(0, d.timeIntervalSince(start) / 86_400)) }
        let noon = fraction(day.time(.dhuhr))
        let halfDay = (fraction(day.time(.maghrib)) - fraction(day.time(.sunrise))) / 2
        let horizonValue = cos(2 * .pi * halfDay)
        let isDay = now >= day.time(.sunrise) && now < day.time(.maghrib)
        let prayerFractions = Prayer.allCases.map { fraction(day.time($0)) }
        let nowFraction = fraction(now)
        return Canvas { ctx, sz in
            let width = sz.width
            let top: CGFloat = 22, bottom = sz.height - 14
            func y(_ v: Double) -> CGFloat { bottom - CGFloat((v + 1) / 2) * (bottom - top) }
            func pt(_ f: Double) -> CGPoint { CGPoint(x: CGFloat(f) * width, y: y(cos(2 * .pi * (f - noon)))) }
            let horizon = y(horizonValue)
            var curve = Path()
            for i in 0...240 {
                let q = pt(Double(i) / 240)
                if i == 0 { curve.move(to: q) } else { curve.addLine(to: q) }
            }
            var line = Path()
            line.move(to: CGPoint(x: 0, y: horizon))
            line.addLine(to: CGPoint(x: width, y: horizon))
            ctx.stroke(line, with: .color(p.tx3.opacity(0.5)), lineWidth: 1)
            ctx.stroke(curve, with: .color(p.tx3.opacity(0.7)), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
            ctx.drawLayer { layer in
                layer.clip(to: Path(CGRect(x: 0, y: -20, width: width, height: max(0, horizon + 20))))
                layer.stroke(curve, with: .color(p.accent), style: StrokeStyle(lineWidth: 3.5, lineCap: .round))
            }
            for f in prayerFractions {
                let q = pt(f)
                ctx.stroke(Path(ellipseIn: CGRect(x: q.x - 5.5, y: q.y - 5.5, width: 11, height: 11)), with: .color(p.tx), lineWidth: 2)
            }
            let sun = pt(nowFraction)
            ctx.drawLayer { glow in
                glow.addFilter(.blur(radius: 6))
                glow.fill(Path(ellipseIn: CGRect(x: sun.x - 22, y: sun.y - 22, width: 44, height: 44)), with: .color(Color(hex: 0xF7BD8F, opacity: 0.6)))
            }
            if isDay {
                ctx.fill(Path(ellipseIn: CGRect(x: sun.x - 9, y: sun.y - 9, width: 18, height: 18)), with: .color(Color(hex: 0xFFD98A)))
            } else {
                var moon = ctx.resolve(Image(systemName: "moon.fill"))
                moon.shading = .color(p.accent)
                ctx.draw(moon, in: CGRect(x: sun.x - 7, y: sun.y - 7, width: 14, height: 14))
            }
        }
    }
}

// MARK: - The list card

private struct V12List: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    let look: TodayStyle
    let day: PrayerDay
    let now: Date
    let current: Prayer?
    let next: (prayer: Prayer, time: Date)?
    @Binding var showMore: Bool
    let onSwipe: (Int) -> Void
    @State private var syurukOpen = false

    private enum Entry: Identifiable {
        case prayer(Prayer, Date)
        case blessed(BlessedTime, Date)
        var id: String {
            switch self {
            case .prayer(let p, _): p.rawValue
            case .blessed(let b, _): b.rawValue
            }
        }
        var time: Date {
            switch self {
            case .prayer(_, let d), .blessed(_, let d): d
            }
        }
    }

    private var entries: [Entry] {
        var list = Prayer.allCases.map { Entry.prayer($0, day.time($0)) }
        if let place = model.activePlace,
           let nextDay = model.day(containing: day.time(.dhuhr).addingTimeInterval(86_400)) {
            list += BlessedTime.compute(day: day, nextDay: nextDay, coordinates: place.coordinates, isRamadan: model.isRamadanDay(day.time(.dhuhr)))
                .filter { showMore || $0.0 == .imsak }
                .map { Entry.blessed($0.0, $0.1) }
        }
        return list.sorted { $0.time < $1.time }
    }

    private var pal: LookPalette { look.palette }
    private var simple: Bool { look == .simple }
    /// Centre Dial and Sun Path have a coloured bar per prayer; the others a dot on the lit row.
    private var bars: Bool { look != .simple && look != .gold }
    private func vf(_ size: CGFloat, _ weight: Font.Weight = .regular, display: Bool = false) -> Font {
        V12Type.font(size, weight, display: display, min(typeSize, .accessibility2))
    }

    var body: some View {
        VStack(spacing: 6) {
            card
            V12AllFiveLine(look: look)
        }
    }

    private var card: some View {
        let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
        return VStack(spacing: 0) {
            ForEach(entries) { entry in
                switch entry {
                case .prayer(let p, let t):
                    row(p, t)
                    if p == .sunrise && syurukOpen && model.prefs.showHadith {
                        HadithView(id: .syuruk, style: .line).padding(.horizontal, 12).padding(.bottom, 8)
                    }
                case .blessed(let b, let t):
                    blessedRow(b, t)
                }
            }
            V12MoreLink(showMore: $showMore, look: look)
        }
        .background {
            ZStack {
                if look != .gold { shape.fill(.ultraThinMaterial) }
                shape.fill(pal.card)
            }
        }
        .clipShape(shape)
        .overlay(shape.strokeBorder(pal.stroke, lineWidth: 1))
        .shadow(color: look == .gold ? Color.dyn(Color(hex: 0x151A45, opacity: 0.05), .clear) : .clear, radius: 3, y: 1)
        .simultaneousGesture(DragGesture(minimumDistance: 30).onEnded { v in
            guard abs(v.translation.width) > abs(v.translation.height) * 2 else { return }
            onSwipe(v.translation.width < 0 ? 1 : -1)
        })
    }

    private func row(_ prayer: Prayer, _ time: Date) -> some View {
        let isCurrent = prayer == current && time <= now
        let isNext = prayer == next?.prayer && next?.time == time
        let lit = prayer == (current ?? next?.prayer) && (current != nil || next != nil)
        let passed = time <= now && !isCurrent
        let mode = model.prefs.alertMode(prayer)
        let trackable = model.prefs.trackerEnabled && prayer.isObligatory && time <= now
        let prayed = trackable && model.isPrayed(prayer, on: time)
        let parts = model.timeParts(time)
        let fill = v12Fill(look)
        return HStack(spacing: 8) {
            if !bars && lit {
                Circle().fill(look == .gold ? LookPalette.goldIcon : pal.accent).frame(width: 8, height: 8)
            }
            VStack(alignment: .leading, spacing: 1) {
                HStack(alignment: .center, spacing: 8) {
                    Text(prayer.name(model.naming, isFriday: model.isFriday(time)))
                        .font(vf(simple ? 23 : 19, lit ? .bold : .medium))
                        .lineLimit(1).minimumScaleFactor(0.8)
                    if let local = model.localName(prayer, at: time) {
                        Text(local).font(vf(13, .medium)).foregroundStyle(pal.tx2)
                            .lineLimit(1).layoutPriority(-1)
                            .accessibilityLabel(W("today.calledHere", ["name": local]))
                    }
                    if prayed {
                        Image(systemName: "checkmark").font(.system(size: 10, weight: .heavy))
                            .foregroundStyle(look == .gold ? Color(hex: 0x151100) : Color.dyn(0xFFFFFF, 0x2A1500))
                            .frame(width: 18, height: 18)
                            .background(fill, in: Circle())
                            .transition(.scale.combined(with: .opacity))
                            .accessibilityLabel(W("today.prayed"))
                    }
                    if isNext && !isCurrent, let next {
                        Text(W("today.in", ["time": TodayView.short(next.time.timeIntervalSince(now))]))
                            .font(vf(simple ? 15 : 13, .semibold)).monospacedDigit()
                            .foregroundStyle(pal.accent)
                            .lineLimit(1).fixedSize()
                    }
                }
                if let jamaah = day.jamaah[prayer] {
                    Text(TodayView.jamaahText(jamaah, for: prayer, on: day, now: now, model: model))
                        .font(vf(13, .medium)).foregroundStyle(pal.tx2)
                }
                if let other = day.alternate[prayer], let name = day.alternateSource {
                    Text("\(name) \(model.formatted(other))")
                        .font(vf(13, .medium))
                        .foregroundStyle(SourceGrade.masjid.tint)
                        .accessibilityLabel(W("phone.a11y.gives", ["a": name, "b": model.formatted(other)]))
                }
            }
            .layoutPriority(-1)
            Spacer(minLength: 6)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(parts.time).font(vf(simple ? 23 : 20, .semibold, display: true)).monospacedDigit()
                if let suffix = parts.suffix {
                    Text(suffix).font(vf(simple ? 15 : 13, .semibold)).foregroundStyle(pal.tx2)
                }
            }
            .lineLimit(1).fixedSize()
            .accessibilityElement(children: .combine)
            if prayer.isObligatory && model.allFiveOnAndAllowed {
                Color.clear.frame(width: 44, height: 44).accessibilityHidden(true)
            } else {
                bell(prayer, mode)
            }
        }
        .foregroundStyle(passed ? pal.tx2 : pal.tx)
        .padding(.leading, bars ? 28 : 18).padding(.trailing, 2)
        .frame(minHeight: simple ? 62 : 54)
        .background((isCurrent || lit) ? pal.tint : Color.clear)
        .overlay(alignment: .leading) {
            if bars {
                RoundedRectangle(cornerRadius: 2).fill(prayer.tint).frame(width: 4).padding(.vertical, 12)
            }
        }
        .overlay(alignment: .bottom) { Rectangle().fill(pal.sep).frame(height: 1) }
        .opacity(passed && !prayed ? 0.55 : 1)
        .contentShape(Rectangle())
        // Tracker (opt in): tap a prayer that has passed to tick it off.
        .onTapGesture {
            guard trackable else {
                if prayer == .sunrise && model.prefs.showHadith { withAnimation(.snappy) { syurukOpen.toggle() } }
                return
            }
            withAnimation(.snappy) { model.togglePrayed(prayer, on: time) }
        }
        .sensoryFeedback(.success, trigger: prayed) { _, new in new }
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: prayed ? W("phone.tracker.markNot") : W("phone.tracker.mark")) {
            if trackable { model.togglePrayed(prayer, on: time) }
        }
        .accessibilityValue(isCurrent ? "now" : "")
    }

    private func bell(_ prayer: Prayer, _ mode: AlertMode) -> some View {
        let alarmColour = look == .gold ? LookPalette.goldIcon : pal.accent
        return Button { cycleAlert(prayer, model: model) } label: {
            Image(systemName: mode.symbol)
                .font(.system(size: 19))
                .foregroundStyle(mode == .alarm ? alarmColour : pal.tx3)
                .opacity(mode == .off ? 0.5 : (mode == .alarm ? 1 : 0.85))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(prayer.name(model.naming)) \(mode.word)")
        .accessibilityHint(W("phone.a11y.tapChange"))
        .contextMenu { AlertMenuItems(prayer: prayer) }
    }

    private func blessedRow(_ blessed: BlessedTime, _ time: Date) -> some View {
        let parts = model.timeParts(time)
        return HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                Text(blessed.name(model.naming)).font(vf(simple ? 21 : 17, .semibold)).lineLimit(1).minimumScaleFactor(0.8)
                Text(blessed.note).font(vf(13)).foregroundStyle(pal.tx2).lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .layoutPriority(-1)
            Spacer(minLength: 6)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(parts.time).font(vf(simple ? 21 : 20, .medium, display: true)).monospacedDigit()
                if let suffix = parts.suffix { Text(suffix).font(vf(13, .semibold)).foregroundStyle(pal.tx2) }
            }
            .lineLimit(1).fixedSize()
            Color.clear.frame(width: 44, height: 44)
        }
        .foregroundStyle(pal.tx2)
        .padding(.leading, bars ? 28 : 18).padding(.trailing, 2).padding(.vertical, 4)
        .frame(minHeight: simple ? 62 : 54)
        .overlay(alignment: .leading) {
            if bars {
                RoundedRectangle(cornerRadius: 2).fill(pal.tx3.opacity(0.35)).frame(width: 4).padding(.vertical, 12)
            }
        }
        .overlay(alignment: .bottom) { Rectangle().fill(pal.sep).frame(height: 1) }
        .opacity(time <= now ? 0.55 : 1)
        .accessibilityElement(children: .combine)
        .transition(.opacity.combined(with: .move(edge: .top)))
    }
}

/// The quiet "Show more" link at the foot of the list card.
private struct V12MoreLink: View {
    @Binding var showMore: Bool
    let look: TodayStyle
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let big = look == .simple
        Button { withAnimation(.snappy) { showMore.toggle() } } label: {
            HStack(spacing: 4) {
                Text(showMore ? W("common.showLess") : W("common.showMore"))
                Image(systemName: showMore ? "chevron.up" : "chevron.down").font(.system(size: big ? 17 : 15, weight: .semibold))
            }
            .font(V12Type.font(big ? 17 : 15, .semibold, display: false, min(typeSize, .accessibility2)))
            .foregroundStyle(look.palette.accent)
            .frame(maxWidth: look == .bands ? nil : .infinity, minHeight: big ? 48 : 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(showMore ? W("common.showLess") : W("common.showMore"))
        .accessibilityHint(W("phone.a11y.moreTimes"))
    }
}

/// Shown instead of five identical bells: every main prayer is on Notify.
private struct V12AllFiveLine: View {
    @Environment(AppModel.self) private var model
    let look: TodayStyle

    var body: some View {
        if model.allFiveOnAndAllowed {
            Button { model.showWakeUp = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "bell.fill").font(.caption)
                    Text(W("today.allFiveOn")).font(.footnote)
                    Text(W("alerts.change")).font(.footnote.weight(.bold)).foregroundStyle(look.palette.accent)
                }
                .foregroundStyle(look.palette.tx2)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: look == .bands ? .leading : .center)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(W("phone.a11y.allFive"))
        }
    }
}

/// "Calculated · MUIS · Grade D". Tap for where these times come from.
private struct V12SourceLine: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    let day: PrayerDay
    let look: TodayStyle
    @State private var showSanad = false

    private var authority: String? {
        switch day.grade {
        case .official: model.officialSource?.authority ?? model.method.shortName
        case .masjid, .community: day.mosqueName
        default: model.method.shortName
        }
    }

    var body: some View {
        let p = look.palette
        let size: CGFloat = look == .bands ? 13 : 15
        Button { showSanad = true } label: {
            (Text(day.grade.title).bold().foregroundColor(look == .bands ? p.tx2 : p.accent)
                + Text(authority.map { " · \($0)" } ?? "")
                + Text(" · \(W("source.grade")) \(day.grade.rawValue)"))
                .font(V12Type.font(size, .regular, display: false, min(typeSize, .accessibility2)))
                .foregroundStyle(look == .bands ? p.tx2 : p.tx3)
                .multilineTextAlignment(look == .bands ? .leading : .center)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(W("phone.a11y.sourceGrade", ["grade": day.grade.rawValue, "a": day.grade.title]))
        .accessibilityHint(W("phone.source.showsWhere"))
        .sheet(isPresented: $showSanad) { SanadSheet(day: day) }
    }
}

// MARK: - Colour Bands

/// The six band colours of the v10 and v12 mockups.
private func v12BandColour(_ prayer: Prayer) -> Color {
    switch prayer {
    case .fajr: Color(hex: 0x3A6F63)
    case .sunrise: Color(hex: 0x8A9A52)
    case .dhuhr: Color(hex: 0xAB8D3A)
    case .asr: Color(hex: 0xCD7D38)
    case .maghrib: Color(hex: 0xD3705C)
    case .isha: Color(hex: 0xC9565D)
    }
}

/// One prayer as a full width band. Tap for its alert and, with the tracker on, to tick it off.
private struct V12Band: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dynamicTypeSize) private var typeSize
    let prayer: Prayer
    let time: Date
    let now: Date
    let isCurrent: Bool
    let next: (prayer: Prayer, time: Date)?
    let fill: Bool

    private func vf(_ size: CGFloat, _ weight: Font.Weight = .regular, display: Bool = false) -> Font {
        V12Type.font(size, weight, display: display, min(typeSize, .accessibility2))
    }

    var body: some View {
        let mode = model.prefs.alertMode(prayer)
        let trackable = model.prefs.trackerEnabled && prayer.isObligatory && time <= now
        let prayed = trackable && model.isPrayed(prayer, on: time)
        let hideBell = prayer.isObligatory && model.allFiveOnAndAllowed
        Menu {
            AlertMenuItems(prayer: prayer)
            if trackable {
                Button { withAnimation(.snappy) { model.togglePrayed(prayer, on: time) } } label: {
                    Label(prayed ? W("phone.tracker.markNot") : W("phone.tracker.mark"),
                          systemImage: prayed ? "xmark.circle" : "checkmark.circle")
                }
            }
        } label: {
            bandLabel(mode: mode, prayed: prayed, hideBell: hideBell)
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.success, trigger: prayed) { _, new in new }
        .accessibilityLabel("\(prayer.name(model.naming)), \(model.formatted(time))\(isCurrent ? ", now" : "")\(prayed ? ", prayed" : ""), \(mode.word)")
    }

    private func bandLabel(mode: AlertMode, prayed: Bool, hideBell: Bool) -> some View {
        let parts = model.timeParts(time)
        return HStack(alignment: .center, spacing: 4) {
            HStack(alignment: .center, spacing: 8) {
                Text(prayer.name(model.naming, isFriday: model.isFriday(time))).font(vf(26, .bold))
                if let local = model.localName(prayer, at: time) {
                    Text(local).font(vf(12, .semibold)).opacity(0.8)
                }
                if isCurrent {
                    Text(W("today.now")).font(.system(size: 11, weight: .heavy))
                        .foregroundStyle(Color(hex: 0x1D1D20))
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(.white, in: Capsule())
                }
                if prayed {
                    Image(systemName: "checkmark").font(.system(size: 10, weight: .heavy))
                        .foregroundStyle(Color(hex: 0x222222))
                        .frame(width: 18, height: 18).background(.white, in: Circle())
                }
                if let next {
                    Text(W("today.in", ["time": TodayView.short(next.time.timeIntervalSince(now))]))
                        .font(vf(15, .semibold)).monospacedDigit().opacity(0.9).fixedSize()
                }
            }
            .lineLimit(1).minimumScaleFactor(0.75)
            Spacer(minLength: 6)
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(parts.time).font(vf(32, .medium, display: true)).monospacedDigit()
                if let suffix = parts.suffix { Text(suffix).font(vf(15, .semibold)).opacity(0.9) }
            }
            .fixedSize()
            Image(systemName: mode.symbol).font(.system(size: 19))
                .opacity(mode == .off ? 0.55 : 1)
                .frame(width: 24)
                .padding(.leading, 6)
                .opacity(hideBell ? 0 : 1)
        }
        .foregroundStyle(.white)
        .padding(.leading, 24).padding(.trailing, 20)
        .frame(maxWidth: .infinity, minHeight: 60, maxHeight: fill || typeSize.isAccessibilitySize ? 84 : 60)
        .background(v12BandColour(prayer))
        .contentShape(Rectangle())
    }
}

/// A blessed time under Show more: a thinner, quiet band.
private struct V12BlessedBand: View {
    @Environment(AppModel.self) private var model
    let blessed: BlessedTime
    let time: Date
    let now: Date

    var body: some View {
        let parts = model.timeParts(time)
        HStack(spacing: 8) {
            Image(systemName: blessed.symbol).font(.subheadline).opacity(0.8)
            VStack(alignment: .leading, spacing: 1) {
                Text(blessed.name(model.naming)).font(.headline)
                Text(blessed.note).font(.caption).opacity(0.7)
            }
            .lineLimit(1).minimumScaleFactor(0.8)
            Spacer(minLength: 6)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(parts.time).font(.system(size: 22, weight: .regular, design: .rounded)).monospacedDigit()
                if let suffix = parts.suffix { Text(suffix).font(.system(size: 13, weight: .semibold)) }
            }
            .fixedSize()
        }
        .foregroundStyle(Color.dyn(0x17171C, 0xFFFFFF))
        .padding(.leading, 24).padding(.trailing, 20)
        .frame(maxWidth: .infinity, minHeight: 52)
        .background(Color.dyn(Color(red: 224 / 255, green: 219 / 255, blue: 207 / 255), Color(white: 0.3)))
        .opacity(time <= now ? 0.7 : 1)
        .transition(.opacity.combined(with: .move(edge: .top)))
        .accessibilityElement(children: .combine)
    }
}
