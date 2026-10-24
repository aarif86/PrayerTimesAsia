import Foundation

/// How the Prayer screen shows the day.
enum TodayStyle: String, Codable, CaseIterable, Identifiable, Sendable {
    /// The Day Dial beside a list of the times.
    case list
    /// The Day Dial centred at the top, then the day and the list (Sun Path's lower half).
    case centre
    /// The Day Dial fills the screen, every time inside it at its hour.
    case dial
    /// The sun's arc across the top, the current prayer small at the top left, then the list.
    case sunPath
    /// Each prayer a full-width band of colour, like the classic Singapore timetable.
    case bands
    var id: String { rawValue }
    var label: String {
        switch self {
        case .list: "Classic list"
        case .centre: "Centre Dial"
        case .dial: "Day Dial"
        case .sunPath: "Sun Path"
        case .bands: "Colour Bands"
        }
    }
}
