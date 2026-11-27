import SwiftUI

/// Travel mode: where home is, how far you are, whether the traveller's
/// concessions (jamak & qasar) apply, and the trail of countries you've prayed in.
struct JourneyView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var pickingHome = false
    /// The big distance, 48 pt at the usual text size, larger when the phone asks for bigger text.
    @ScaledMetric(relativeTo: .largeTitle) private var distanceSize: CGFloat = 48

    var body: some View {
        NavigationStack {
            ZStack {
                SkyNow()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(W("settings.journey")).font(Theme.screenTitle).accessibilityAddTraits(.isHeader).padding(.top, 8)
                        if model.prefs.home != nil, !model.prefs.homeConfirmed {
                            HomeQuestionCard()
                        } else {
                            statusCard
                        }
                        if model.musafirStatus?.isTraveller == true, model.asrSchool != .hanafi { combinedCard }
                        if model.musafirStatus?.isTraveller == true, model.isRamadanDay(.now) { fastingCard }
                        homeCard
                        rulesCard
                        if !model.prefs.trip.isEmpty { tripCard }
                        Text(W("journey.notFatwa"))
                            .font(.caption).opacity(0.7)
                    }
                    .padding(.horizontal, Theme.gutter)
                    .padding(.bottom, 32)
                }
                .scrollIndicators(.hidden)
            }
            .foregroundStyle(.primary)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(W("common.done")) { dismiss() } } }
            .sheet(isPresented: $pickingHome) { PlacesView(purpose: .home) }
        }
    }

    @ViewBuilder
    private var statusCard: some View {
        GlassCard(padding: 20) {
            if let status = model.musafirStatus {
                let g = Musafir.guidance(for: status, rules: model.musafirRules, naming: model.naming)
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Group {
                            if status.isTraveller {
                                Image("Tab-journey").resizable().scaledToFit().frame(width: 18, height: 18)
                                    .foregroundStyle(.background).frame(width: 30, height: 30)
                                    .background(Circle().fill(.primary))
                            } else {
                                Image(systemName: "house.circle.fill").font(.system(size: 30))
                            }
                        }
                        Text(g.title).font(.title2.weight(.bold))
                    }
                    if let km = distance(status) {
                        Text(W("common.km", ["n": Int(km.rounded()).formatted()]))
                            .font(Theme.display(distanceSize)).monospacedDigit()
                        + Text(W("phone.journey.fromHome")).font(.headline)
                    }
                    Text(g.body).font(.body).opacity(0.9).fixedSize(horizontal: false, vertical: true)
                    if status.isTraveller { planTable }
                    if model.prefs.arrivedAt != nil, status.isTraveller || isSettled(status) {
                        Text(W("phone.journey.dayIn", ["n": model.daysHere + 1, "place": model.profile.name.isEmpty ? W("journey.thisPlace") : model.profile.name]))
                            .font(.subheadline.weight(.semibold)).opacity(0.8)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Text(W("journey.setHome")).font(.title2.weight(.bold))
                    Text(W("journey.setHomeHelp"))
                        .opacity(0.85)
                    Button { pickingHome = true } label: {
                        Label(W("journey.setHomeButton"), systemImage: "house.fill").font(.headline)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.primary)
                    .foregroundStyle(.background)
                }
            }
        }
    }

    /// Each prayer on its own line: how many rakaat, and what it joins with.
    private var planTable: some View {
        VStack(spacing: 0) {
            ForEach(Musafir.plan(rules: model.musafirRules, naming: model.naming)) { row in
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(row.name).font(.headline)
                        Text(row.join).font(.footnote).opacity(0.75)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(row.rakaat).font(.headline).monospacedDigit()
                        Text(row.change).font(.footnote).opacity(0.75)
                    }
                }
                .padding(.vertical, 8)
                if row.prayer != .isha { Divider().opacity(0.5) }
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var fastingCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(W("journey.fasting").uppercased()).font(.caption.weight(.heavy)).opacity(0.7)
                Text(W("phone.fastingToday"))
                    .font(.footnote)
                Text(W("phone.markRamadan")).font(.footnote).opacity(0.8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Today's combined (jamak) windows from the times on the Today screen.
    @ViewBuilder
    private var combinedCard: some View {
        if let today = model.day(containing: .now), let tomorrow = model.day(containing: model.noon(.now, plus: 1)) {
            GlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(W("journey.combined").uppercased()).font(.caption.weight(.heavy)).opacity(0.7)
                        Spacer()
                        Text(W("falak.pendingReview")).font(.caption2.weight(.semibold)).opacity(0.6)
                    }
                    window(.dhuhr, .asr, from: today.time(.dhuhr), to: today.time(.maghrib))
                    window(.maghrib, .isha, from: today.time(.maghrib), to: tomorrow.time(.fajr))
                    Text(W("phone.journey.jamakExplain", ["name": Prayer.fajr.name(model.naming)]))
                        .font(.footnote).opacity(0.85)
                }
            }
        }
    }

    private func window(_ a: Prayer, _ b: Prayer, from start: Date, to end: Date) -> some View {
        HStack {
            Text("\(a.name(model.naming)) + \(b.name(model.naming))").font(.headline)
            Spacer()
            Text("\(model.formatted(start)) – \(model.formatted(end))").font(.headline).monospacedDigit()
        }
    }

    private var homeCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(W("journey.home").uppercased()).font(.caption.weight(.heavy)).opacity(0.7)
                    Text(model.prefs.home.map { "\($0.profile.flag) \($0.name)" } ?? W("settings.notSet"))
                        .font(.headline)
                    if let home = model.prefs.home, !home.subtitle.isEmpty {
                        Text(home.subtitle).font(.subheadline).opacity(0.75)
                    }
                }
                Button { pickingHome = true } label: {
                    Label(model.prefs.home == nil ? W("journey.setHomeButton") : W("journey.changeHome"), systemImage: "house")
                        .font(.subheadline.weight(.semibold))
                }
                .buttonStyle(.bordered)
                .tint(.primary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var rulesCard: some View {
        @Bindable var model = model
        return GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Text(W("journey.distance").uppercased()).font(.caption.weight(.heavy)).opacity(0.7)
                if model.asrSchool == .hanafi {
                    Text(W("journey.hanafi"))
                        .font(.subheadline)
                } else {
                    Picker(W("phone.journey.distanceShort"), selection: $model.prefs.musafirThresholdKm.animation(.spring(duration: 0.35))) {
                        Text(W("journey.km81")).tag(81.0)
                        Text(W("journey.km89")).tag(89.0)
                    }
                    .pickerStyle(.segmented)
                    .sensoryFeedback(.selection, trigger: model.prefs.musafirThresholdKm)
                    Text(W("journey.distanceHelp"))
                        .font(.subheadline).opacity(0.85)
                    Text(W("journey.shafii"))
                        .font(.subheadline).opacity(0.85)
                }
                if let status = model.musafirStatus, let check = Musafir.distanceCheck(for: status, rules: model.musafirRules) {
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: check.counts ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundStyle(check.counts ? Color.green : Color.orange)
                        Text(check.text).font(.subheadline.weight(.semibold))
                            .fixedSize(horizontal: false, vertical: true)
                            .contentTransition(.numericText())
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 14).fill(.primary.opacity(0.06)))
                    .id(model.prefs.musafirThresholdKm)
                    .transition(.opacity.combined(with: .scale(scale: 0.97)))
                }
            }
        }
    }

    private var tripCard: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 10) {
                Text(W("journey.prayedAt").uppercased()).font(.caption.weight(.heavy)).opacity(0.7)
                ForEach(model.prefs.trip.prefix(12)) { stop in
                    HStack {
                        Text(AsiaRegions.profile(for: stop.countryCode)?.flag ?? "🌏")
                        VStack(alignment: .leading) {
                            Text(stop.countryName).font(.subheadline.weight(.semibold))
                            Text(stop.placeName).font(.caption).opacity(0.7)
                        }
                        Spacer()
                        Text(stop.arrived, format: .dateTime.day().month(.abbreviated).year())
                            .font(.caption).opacity(0.75)
                    }
                }
            }
        }
    }

    private func distance(_ status: Musafir.Status) -> Double? {
        switch status {
        case .home: nil
        case .nearby(let km), .traveller(let km): km
        case .settled(let km, _): km
        }
    }

    private func isSettled(_ status: Musafir.Status) -> Bool {
        if case .settled = status { return true }
        return false
    }
}

/// "Is Kuala Lumpur your home?" for a home the app only guessed (from where the
/// phone was when the app was first opened). Until it is answered, Journey and
/// the musafir line say nothing about travelling.
struct HomeQuestionCard: View {
    @Environment(AppModel.self) private var model
    @State private var pickingHome = false

    var body: some View {
        if let home = model.prefs.home, !model.prefs.homeConfirmed {
            GlassCard(padding: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        Image(systemName: "house.circle.fill").font(.system(size: 30))
                        Text(W("places.isHome", ["place": home.name])).font(.title3.weight(.bold))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Text(W("phone.homeGuess"))
                        .font(.subheadline).opacity(0.85)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 10) {
                        Button { withAnimation { model.confirmHome() } } label: {
                            Text(W("places.yesHome")).font(.subheadline.weight(.semibold))
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.primary)
                        .foregroundStyle(.background)
                        Button { pickingHome = true } label: {
                            Text(W("journey.changeHome")).font(.subheadline.weight(.semibold))
                        }
                        .buttonStyle(.bordered)
                        .tint(.primary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .sheet(isPresented: $pickingHome) { PlacesView(purpose: .home) }
        }
    }
}
