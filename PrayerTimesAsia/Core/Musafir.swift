import Foundation

/// Traveller's concessions (rukhsah): shortening (qasar) and combining (jamak).
///
/// This is guidance, not a fatwa - the UI always says so and points to the
/// traveller's own religious authority. The thresholds below are the commonly
/// cited figures: two marhalah, ≈ 81 km in the Shafi'i school followed across
/// Southeast Asia (some authorities use ≈ 89 km), ≈ 78 km in the Hanafi school.
enum Musafir {
    struct Rules: Sendable {
        let school: AsrSchool
        let thresholdKm: Double

        /// Days of intended stay after which you are no longer a traveller.
        var maxStayDays: Int { school == .hanafi ? 15 : 3 }
        var allowsJamak: Bool { school != .hanafi }
    }

    enum Status: Equatable, Sendable {
        case home
        case nearby(distanceKm: Double)
        case traveller(distanceKm: Double)
        case settled(distanceKm: Double, days: Int)

        var isTraveller: Bool {
            if case .traveller = self { return true }
            return false
        }
    }

    /// `daysHere` counts full days since arriving at the current destination.
    static func status(home: Coordinates?, current: Coordinates, daysHere: Int, rules: Rules) -> Status? {
        guard let home else { return nil }
        let km = Geo.distanceKm(home, current)
        if km < 2 { return .home }
        if km < rules.thresholdKm { return .nearby(distanceKm: km) }
        if daysHere > rules.maxStayDays { return .settled(distanceKm: km, days: daysHere) }
        return .traveller(distanceKm: km)
    }

    static func guidance(for status: Status, rules: Rules, naming: NamingStyle) -> (title: String, body: String) {
        let n = naming.names
        let four = "\(n[.dhuhr]!), \(n[.asr]!) and \(n[.isha]!)"
        switch status {
        case .home:
            return ("You're home", "Pray in full. Travel concessions apply once you journey at least \(Int(rules.thresholdKm)) km.")
        case .nearby(let km):
            return ("Within \(Int(rules.thresholdKm)) km of home",
                    "You're \(Int(km.rounded())) km away - short of the travel distance, so pray in full.")
        case .traveller(let km):
            if rules.allowsJamak {
                return ("You are a musafir",
                        "\(Int(km.rounded())) km from home. You may shorten (qasar) \(four) to 2 rakaat, and combine (jamak) \(n[.dhuhr]!) with \(n[.asr]!), and \(n[.maghrib]!) with \(n[.isha]!).")
            }
            return ("You are a musafir",
                    "\(Int(km.rounded())) km from home. Shorten (qasr) \(four) to 2 rakaat. In the Hanafi school prayers are not combined outside Hajj.")
        case .settled(_, let days):
            return ("Settled here",
                    "You've been here \(days) days. Staying longer than \(rules.maxStayDays) days ends the travel concession - pray in full.")
        }
    }
}
