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
        switch status {
        case .home:
            return ("You're home", "Pray in full. Travel concessions apply once you journey at least \(Int(rules.thresholdKm)) km.")
        case .nearby:
            return ("Within \(Int(rules.thresholdKm)) km of home",
                    "That's short of the travel distance, so pray in full.")
        case .traveller:
            if rules.allowsJamak {
                return ("You are a musafir",
                        "You may shorten (qasar) and join (jamak) your prayers. Here is what changes for each one.")
            }
            return ("You are a musafir",
                    "You may shorten (qasr) your prayers. In the Hanafi school prayers are not joined outside Hajj. Here is what changes for each one.")
        case .settled(_, let days):
            return ("Settled here",
                    "You've been here \(days) days. Staying longer than \(rules.maxStayDays) days ends the travel concession, so pray in full.")
        }
    }

    /// One prayer's line in the traveller's plan, so nobody has to work out
    /// from a sentence which prayers are shortened and which are joined.
    struct PlanRow: Identifiable, Sendable {
        let prayer: Prayer
        let name: String
        let rakaat: String
        let change: String
        let join: String
        var id: Prayer { prayer }
    }

    /// Subuh and Maghrib keep their rakaat; Zohor, Asar and Isyak go from 4 to 2.
    /// Zohor joins with Asar and Maghrib with Isyak (not in the Hanafi school).
    static func plan(rules: Rules, naming: NamingStyle) -> [PlanRow] {
        let n = (naming.isRightToLeft ? NamingStyle.international : naming).names
        func join(_ p: Prayer) -> String {
            guard rules.allowsJamak else { return "Not joined" }
            switch p {
            case .dhuhr: return "Can join with \(n[.asr]!)"
            case .asr: return "Can join with \(n[.dhuhr]!)"
            case .maghrib: return "Can join with \(n[.isha]!)"
            case .isha: return "Can join with \(n[.maghrib]!)"
            default: return "Never joined"
            }
        }
        return [
            PlanRow(prayer: .fajr, name: n[.fajr]!, rakaat: "2 rakaat", change: "No change", join: rules.allowsJamak ? "Never joined" : "Not joined"),
            PlanRow(prayer: .dhuhr, name: n[.dhuhr]!, rakaat: "2 rakaat", change: "Shortened from 4", join: join(.dhuhr)),
            PlanRow(prayer: .asr, name: n[.asr]!, rakaat: "2 rakaat", change: "Shortened from 4", join: join(.asr)),
            PlanRow(prayer: .maghrib, name: n[.maghrib]!, rakaat: "3 rakaat", change: "No change", join: join(.maghrib)),
            PlanRow(prayer: .isha, name: n[.isha]!, rakaat: "2 rakaat", change: "Shortened from 4", join: join(.isha)),
        ]
    }

    /// Plain words on how the chosen travel distance decides the result,
    /// so changing 81 km and 89 km visibly does something.
    static func distanceCheck(for status: Status, rules: Rules) -> (counts: Bool, text: String)? {
        let limit = Int(rules.thresholdKm)
        switch status {
        case .home:
            return nil
        case .nearby(let km):
            return (false, "You are \(Int(km.rounded()).formatted()) km from home. That is less than \(limit) km, so this trip does not count as travel yet.")
        case .traveller(let km), .settled(let km, _):
            return (true, "You are \(Int(km.rounded()).formatted()) km from home. That is more than \(limit) km, so this trip counts as travel.")
        }
    }
}
