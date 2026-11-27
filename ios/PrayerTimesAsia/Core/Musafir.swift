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
            return (W("journey.homeTitle"), W("journey.homeBody", ["km": Int(rules.thresholdKm)]))
        case .nearby:
            return (W("journey.nearbyTitle", ["km": Int(rules.thresholdKm)]),
                    W("journey.nearbyBody"))
        case .traveller:
            if rules.allowsJamak {
                return (W("phone.journey.youAreMusafir"),
                        W("journey.travellerBody"))
            }
            return (W("phone.journey.youAreMusafir"),
                    W("phone.journey.hanafiNote"))
        case .settled(_, let days):
            return (W("journey.settledTitle"),
                    W("journey.settledBody", ["n": days, "max": rules.maxStayDays]))
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
            guard rules.allowsJamak else { return W("journey.notJoined") }
            switch p {
            case .dhuhr: return W("journey.canJoin", ["name": n[.asr]!])
            case .asr: return W("journey.canJoin", ["name": n[.dhuhr]!])
            case .maghrib: return W("journey.canJoin", ["name": n[.isha]!])
            case .isha: return W("journey.canJoin", ["name": n[.maghrib]!])
            default: return W("journey.neverJoinedShort")
            }
        }
        return [
            PlanRow(prayer: .fajr, name: n[.fajr]!, rakaat: W("phone.journey.rakaat2"), change: W("journey.noChange"), join: rules.allowsJamak ? W("journey.neverJoinedShort") : W("journey.notJoined")),
            PlanRow(prayer: .dhuhr, name: n[.dhuhr]!, rakaat: W("phone.journey.rakaat2"), change: W("journey.shortened"), join: join(.dhuhr)),
            PlanRow(prayer: .asr, name: n[.asr]!, rakaat: W("phone.journey.rakaat2"), change: W("journey.shortened"), join: join(.asr)),
            PlanRow(prayer: .maghrib, name: n[.maghrib]!, rakaat: W("phone.journey.rakaat3"), change: W("journey.noChange"), join: join(.maghrib)),
            PlanRow(prayer: .isha, name: n[.isha]!, rakaat: W("phone.journey.rakaat2"), change: W("journey.shortened"), join: join(.isha)),
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
            return (false, W("journey.notTravel", ["km": Int(km.rounded(.down)).formatted(), "limit": limit]))
        case .traveller(let km), .settled(let km, _):
            return (true, W("journey.isTravel", ["km": Int(km.rounded()).formatted(), "limit": limit]))
        }
    }
}
