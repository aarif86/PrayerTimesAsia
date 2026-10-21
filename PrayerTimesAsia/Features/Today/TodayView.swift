import SwiftUI

struct TodayView: View {
    @Environment(AppModel.self) private var model
    @State private var showPlaces = false

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
    }

    @ViewBuilder
    private func content(now: Date, day: PrayerDay) -> some View {
        let sky = SkyColors.at(now, day: day)
        let next = model.next(after: now)
        let current = model.current(at: now)
        let tomorrow = model.day(containing: now.addingTimeInterval(86_400))

        ZStack {
            LivingSkyBackground(colors: sky)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header(now: now)
                    if !model.prefs.arrivalBannerDismissed { ArrivalCard() }
                    if let next { hero(next: next, now: now, sky: sky) }
                    SunArc(now: now, day: day, nextFajr: tomorrow?.time(.fajr), glow: sky.glow.color)
                        .frame(height: 96)
                        .padding(.horizontal, 4)
                    if let status = model.musafirStatus, status.isTraveller { musafirChip(status) }
                    PrayerList(day: day, now: now, current: current?.prayer, next: next?.prayer)
                    methodFooter
                }
                .padding(.horizontal, Theme.gutter)
                .padding(.bottom, 32)
            }
            .scrollIndicators(.hidden)
        }
        .foregroundStyle(.white)
    }

    private func header(now: Date) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Button { showPlaces = true } label: {
                HStack(spacing: 8) {
                    Image(systemName: model.prefs.useGPS ? "location.fill" : "mappin.circle.fill")
                    Text(model.activePlace?.name ?? "Choose a place").lineLimit(1)
                    if let place = model.activePlace, place.isInAsia { Text(place.profile.flag) }
                    Image(systemName: "chevron.down").font(.caption.weight(.bold)).opacity(0.7)
                }
                .font(.headline)
                .padding(.horizontal, 14).padding(.vertical, 9)
                .background(.white.opacity(0.14), in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Change location")

            Text(dateLine(now))
                .font(.subheadline.weight(.medium))
                .opacity(0.85)
        }
        .padding(.top, 8)
    }

    private func dateLine(_ now: Date) -> String {
        let f = DateFormatter()
        f.timeZone = model.timeZone
        f.dateFormat = "EEE, d MMM"
        let hijri = Hijri.format(now, timeZone: model.timeZone, style: model.naming,
                                 adjustment: model.prefs.hijriAdjustment)
        return "\(f.string(from: now))  ·  \(hijri)"
    }

    private func hero(next: (prayer: Prayer, time: Date), now: Date, sky: SkyColors) -> some View {
        let name = next.prayer.name(model.naming, isFriday: model.isFriday(next.time))
        return VStack(alignment: .leading, spacing: 4) {
            Text(next.prayer == .sunrise ? "\(name) - Subuh ends in" : "\(name) in")
                .font(.title3.weight(.semibold))
                .opacity(0.9)
            Text(Countdown.text(next.time.timeIntervalSince(now)))
                .font(Theme.display(68))
                .monospacedDigit()
                .contentTransition(.numericText(countsDown: true))
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .shadow(color: sky.glow.color.opacity(0.45), radius: 18)
            Text("at \(model.formatted(next.time))")
                .font(.headline)
                .opacity(0.8)
        }
        .padding(.top, 6)
        .accessibilityElement(children: .combine)
    }

    private func musafirChip(_ status: Musafir.Status) -> some View {
        Button { model.selectedTab = .journey } label: {
            HStack {
                Image(systemName: "airplane")
                Text("Musafir · you may shorten & combine").lineLimit(1)
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").font(.caption.weight(.bold))
            }
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(.white.opacity(0.16), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private var methodFooter: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(model.method.name) · \(model.method.parameterSummary) · \(model.asrSchool == .hanafi ? "Hanafi Asr" : "Shafi'i Asr")")
            Text(model.method.matchesOfficialTable
                 ? "Calculated on your phone · matches the official timetable"
                 : "Calculated on your phone · works offline")
        }
        .font(.caption)
        .opacity(0.7)
        .padding(.horizontal, 4)
    }
}

private struct PrayerList: View {
    @Environment(AppModel.self) private var model
    let day: PrayerDay
    let now: Date
    let current: Prayer?
    let next: Prayer?

    var body: some View {
        VStack(spacing: 4) {
            ForEach(Prayer.allCases) { prayer in
                row(prayer, day.time(prayer))
            }
        }
        .padding(8)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous)
            .strokeBorder(.white.opacity(0.12), lineWidth: 1))
    }

    private func row(_ prayer: Prayer, _ time: Date) -> some View {
        let isCurrent = prayer == current && time <= now
        let passed = time <= now && !isCurrent
        let notifying = model.prefs.notificationsEnabled && model.prefs.notifyPrayers.contains(prayer)
        return HStack(spacing: 14) {
            Image(systemName: prayer.symbol)
                .font(.body.weight(.semibold))
                .frame(width: 26)
            Text(prayer.name(model.naming, isFriday: model.isFriday(time)))
                .font(.title3.weight(isCurrent ? .bold : .semibold))
            if isCurrent {
                Text("NOW").font(.caption2.weight(.heavy)).padding(.horizontal, 7).padding(.vertical, 3)
                    .background(.white.opacity(0.25), in: Capsule())
            } else if prayer == next {
                Text("NEXT").font(.caption2.weight(.heavy)).opacity(0.75)
            }
            Spacer()
            Text(model.formatted(time))
                .font(Theme.display(22, .medium))
                .monospacedDigit()
            if prayer.isObligatory {
                Button { toggleNotify(prayer) } label: {
                    Image(systemName: notifying ? "bell.fill" : "bell.slash")
                        .font(.subheadline)
                        .opacity(notifying ? 0.95 : 0.45)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(notifying ? "Turn off reminder" : "Turn on reminder")
            } else {
                Color.clear.frame(width: 30, height: 30)
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 54)
        .background(isCurrent ? Color.white.opacity(0.18) : .clear,
                    in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .opacity(passed ? 0.6 : 1)
        .accessibilityElement(children: .combine)
    }

    private func toggleNotify(_ prayer: Prayer) {
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

private struct ArrivalCard: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        let profile = model.profile
        GlassCard {
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
                    .buttonStyle(.borderedProminent).tint(.white.opacity(0.25))
            }
            .padding(32)
            .foregroundStyle(.white)
        }
    }
}
