import SwiftUI

/// Travel mode: where home is, how far you are, whether the traveller's
/// concessions (jamak & qasar) apply, and the trail of countries you've prayed in.
struct JourneyView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                LivingSkyBackground(colors: .dusk)
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Journey").font(Theme.display(34, .bold)).padding(.top, 8)
                        statusCard
                        if model.musafirStatus?.isTraveller == true, model.asrSchool != .hanafi { combinedCard }
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
        }
    }

    @ViewBuilder
    private var statusCard: some View {
        GlassCard(padding: 20) {
            if let status = model.musafirStatus {
                let g = Musafir.guidance(for: status, rules: model.musafirRules, naming: model.naming)
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 10) {
                        Image(systemName: status.isTraveller ? "airplane.circle.fill" : "house.circle.fill")
                            .font(.system(size: 30))
                        Text(g.title).font(.title2.weight(.bold))
                    }
                    if let km = distance(status) {
                        Text("\(Int(km.rounded()).formatted()) km")
                            .font(Theme.display(48)).monospacedDigit()
                        + Text("  from home").font(.headline)
                    }
                    Text(g.body).font(.body).opacity(0.9).fixedSize(horizontal: false, vertical: true)
                    if model.prefs.arrivedAt != nil, status.isTraveller || isSettled(status) {
                        Text("Day \(model.daysHere + 1) in \(model.profile.name.isEmpty ? "this place" : model.profile.name)")
                            .font(.subheadline.weight(.semibold)).opacity(0.8)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Set your home").font(.title2.weight(.bold))
                    Text("Tell us where home is and we'll work out when you count as a traveller.")
                        .opacity(0.85)
                }
            }
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
                    Text("Jamak taqdim prays both in the first prayer's time; jamak ta'khir prays both in the second's. \(Prayer.fajr.name(model.naming)) is never combined.")
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
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("HOME").font(.caption.weight(.heavy)).opacity(0.7)
                    Text(model.prefs.home.map { "\($0.profile.flag) \($0.name)" } ?? "Not set")
                        .font(.headline)
                    if let home = model.prefs.home, !home.subtitle.isEmpty {
                        Text(home.subtitle).font(.subheadline).opacity(0.75)
                    }
                }
                Spacer()
                if let place = model.activePlace, model.prefs.home.map({ !$0.isNear(place) }) ?? true {
                    Button("Set to here") { model.setHome(place) }
                        .font(.subheadline.weight(.semibold))
                        .buttonStyle(.bordered)
                        .tint(.primary)
                }
            }
        }
    }

    private var rulesCard: some View {
        @Bindable var model = model
        return GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("TRAVEL DISTANCE").font(.caption.weight(.heavy)).opacity(0.7)
                if model.asrSchool == .hanafi {
                    Text("Hanafi: about 78 km, stays up to 15 days. Prayers are shortened but not combined.")
                        .font(.subheadline)
                } else {
                    Picker("Distance", selection: $model.prefs.musafirThresholdKm) {
                        Text("81 km (2 marhalah)").tag(81.0)
                        Text("89 km").tag(89.0)
                    }
                    .pickerStyle(.segmented)
                    Text("Shafi'i: stays of up to 3 days, not counting the days you arrive and leave.")
                        .font(.subheadline).opacity(0.85)
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
