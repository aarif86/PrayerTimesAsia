import SwiftUI

/// Travel mode: where home is, how far you are, whether the traveller's
/// concessions (jamak & qasar) apply, and the trail of countries you've prayed in.
struct JourneyView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var pickingHome = false

    var body: some View {
        NavigationStack {
            ZStack {
                SkyNow()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Journey").font(Theme.display(34, .bold)).padding(.top, 8)
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
                        Text("This is general guidance on the traveller's concessions (rukhsah), not a fatwa. When unsure, follow your local religious authority.")
                            .font(.caption).opacity(0.7)
                    }
                    .padding(.horizontal, Theme.gutter)
                    .padding(.bottom, 32)
                }
                .scrollIndicators(.hidden)
            }
            .foregroundStyle(.primary)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
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
                        Text("\(Int(km.rounded()).formatted()) km")
                            .font(Theme.display(48)).monospacedDigit()
                        + Text("  from home").font(.headline)
                    }
                    Text(g.body).font(.body).opacity(0.9).fixedSize(horizontal: false, vertical: true)
                    if status.isTraveller { planTable }
                    if model.prefs.arrivedAt != nil, status.isTraveller || isSettled(status) {
                        Text("Day \(model.daysHere + 1) in \(model.profile.name.isEmpty ? "this place" : model.profile.name)")
                            .font(.subheadline.weight(.semibold)).opacity(0.8)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Set your home").font(.title2.weight(.bold))
                    Text("Tell us where home is and we'll work out when you count as a traveller.")
                        .opacity(0.85)
                    Button { pickingHome = true } label: {
                        Label("Set home", systemImage: "house.fill").font(.headline)
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
                Text("FASTING ON THIS JOURNEY").font(.caption.weight(.heavy)).opacity(0.7)
                Text("As a traveller you may choose not to fast today and replace it after Ramadan. If fasting is easy for you, fasting is better. The day counts as travel only if you left home before Subuh.")
                    .font(.footnote)
                Text("Mark it on the Ramadan page so the app counts the day to replace.").font(.footnote).opacity(0.8)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// Today's combined (jamak) windows from the times on the Today screen.
    @ViewBuilder
    private var combinedCard: some View {
        if let today = model.day(containing: .now), let tomorrow = model.day(containing: .now.addingTimeInterval(86_400)) {
            GlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("COMBINED WINDOWS TODAY").font(.caption.weight(.heavy)).opacity(0.7)
                        Spacer()
                        Text("Pending shariah review").font(.caption2.weight(.semibold)).opacity(0.6)
                    }
                    window(.dhuhr, .asr, from: today.time(.dhuhr), to: today.time(.maghrib))
                    window(.maghrib, .isha, from: today.time(.maghrib), to: tomorrow.time(.fajr))
                    Text("Jamak taqdim means praying both in the first prayer's time. Jamak ta'khir means praying both in the second prayer's time. \(Prayer.fajr.name(model.naming)) is never joined.")
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
                    Text("HOME").font(.caption.weight(.heavy)).opacity(0.7)
                    Text(model.prefs.home.map { "\($0.profile.flag) \($0.name)" } ?? "Not set")
                        .font(.headline)
                    if let home = model.prefs.home, !home.subtitle.isEmpty {
                        Text(home.subtitle).font(.subheadline).opacity(0.75)
                    }
                }
                Button { pickingHome = true } label: {
                    Label(model.prefs.home == nil ? "Set home" : "Change home", systemImage: "house")
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
                Text("TRAVEL DISTANCE").font(.caption.weight(.heavy)).opacity(0.7)
                if model.asrSchool == .hanafi {
                    Text("In the Hanafi school the travel distance is about 78 km, for stays of up to 15 days. Prayers are shortened but not joined.")
                        .font(.subheadline)
                } else {
                    Picker("Distance", selection: $model.prefs.musafirThresholdKm.animation(.spring(duration: 0.35))) {
                        Text("81 km (2 marhalah)").tag(81.0)
                        Text("89 km").tag(89.0)
                    }
                    .pickerStyle(.segmented)
                    .sensoryFeedback(.selection, trigger: model.prefs.musafirThresholdKm)
                    Text("Most of Southeast Asia uses 81 km, which is two marhalah. Some scholars use 89 km. Pick the one your local religious authority uses.")
                        .font(.subheadline).opacity(0.85)
                    Text("In the Shafi'i school this holds for stays of up to 3 days, not counting the day you arrive and the day you leave.")
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
                Text("WHERE YOU'VE PRAYED").font(.caption.weight(.heavy)).opacity(0.7)
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
                        Text("Is \(home.name) your home?").font(.title3.weight(.bold))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Text("We guessed it from where your phone was when you first opened the app. Home is used to work out when you count as a traveller, so please check it.")
                        .font(.subheadline).opacity(0.85)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 10) {
                        Button { withAnimation { model.confirmHome() } } label: {
                            Text("Yes, this is home").font(.subheadline.weight(.semibold))
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.primary)
                        .foregroundStyle(.background)
                        Button { pickingHome = true } label: {
                            Text("Change home").font(.subheadline.weight(.semibold))
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
