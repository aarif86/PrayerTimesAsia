import Foundation

/// "Leave for Jumaat": a Friday reminder to get ready and leave for the masjid.
/// Same choices and words in web/src/core/jumuahLeave.ts and android core JumuahLeave.kt.
enum JumuahSession: String, Codable, CaseIterable, Identifiable, Sendable {
    /// At Zohor (or your masjid's own Jumaat time).
    case first
    /// The second session some Singapore masjids hold, from 2 PM.
    case second
    var id: String { rawValue }
}

enum JumuahLeave {
    /// Minutes before Jumaat. 0 is off.
    static let choices = [0, 15, 30, 45, 60, 90, 120, 150, 180]

    /// "14:00", from the Islamic Religious Council of Singapore (MUIS) list.
    static var secondSessionFrom: String { MasjidExtras.fridaySecondFrom }

    /// The older choice 20 moves up to 30, so the reminder still comes early enough. Anything else not on the list is off.
    static func snap(_ m: Int) -> Int {
        if m == 20 { return 30 }
        return choices.contains(m) ? m : 0
    }

    /// "15 min", "1 hour", "2 hours" in the alert's language.
    static func span(_ minutes: Int, _ lang: RamadanContent.Lang) -> String {
        if minutes >= 60 && minutes % 30 == 0 {
            let h = minutes / 60
            let half = minutes % 60 == 30
            switch lang {
            case .en: return half ? "\(h) \(h == 1 ? "hour" : "hours") 30 min" : (h == 1 ? "1 hour" : "\(h) hours")
            case .ms: return half ? "\(h) jam 30 minit" : "\(h) jam"
            case .id: return half ? "\(h) jam 30 menit" : "\(h) jam"
            }
        }
        switch lang {
        case .en: return "\(minutes) min"
        case .ms: return "\(minutes) minit"
        case .id: return "\(minutes) menit"
        }
    }

    /// The picker label: "Off", "15 min before", "1 hour before", "2 hours before".
    static func label(_ minutes: Int) -> String {
        minutes == 0 ? "Off" : "\(span(minutes, .en)) before"
    }

    /// The words of the reminder. `name` is the Friday prayer's name ("Jumaat"),
    /// `at` the start time already formatted, `where_` the masjid when the time comes from it.
    static func words(_ lang: RamadanContent.Lang, minutes: Int, name: String, second: Bool, at: String, where where_: String?) -> (title: String, body: String) {
        let span = span(minutes, lang)
        switch lang {
        case .ms:
            let place = where_.map { " di \($0)" } ?? ""
            return ("Masa untuk bertolak ke solat \(name)\(second ? " sesi kedua" : "")",
                    "\(second ? "Sesi kedua solat" : "Solat") \(name)\(place) bermula pada \(at), \(span) lagi.")
        case .id:
            let place = where_.map { " di \($0)" } ?? ""
            return ("Saatnya berangkat untuk salat \(name)\(second ? " sesi kedua" : "")",
                    "\(second ? "Sesi kedua salat" : "Salat") \(name)\(place) dimulai pukul \(at), \(span) lagi.")
        case .en:
            let place = where_.map { " at \($0)" } ?? ""
            return ("Time to leave for \(second ? "the second " : "")\(name)",
                    "\(second ? "The second " : "")\(name)\(place) starts \(second ? "from" : "at") \(at), \(span) from now.")
        }
    }
}
