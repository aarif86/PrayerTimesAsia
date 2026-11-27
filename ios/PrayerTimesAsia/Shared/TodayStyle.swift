import Foundation

/// How the Prayer screen shows the day.
enum TodayStyle: String, Codable, CaseIterable, Identifiable, Sendable {
    /// The Day Dial centred at the top, then the day and the list (Sun Path's lower
    /// half). The default.
    case centre
    /// "Side Dial": the Day Dial beside the date, the list below. (rawValue
    /// "list" is kept so saved choices and widgets still decode.)
    case list
    /// The Day Dial fills the screen, every time inside it at its hour.
    case dial
    /// The sun's arc across the top, the current prayer small at the top left, then the list.
    case sunPath
    /// Each prayer a full-width band of colour, like the classic Singapore timetable.
    case bands
    /// Big and Simple: the prayer now, the time left, and five big rows. For older eyes.
    case simple
    /// Calm Gold: the Centre Dial layout on flat navy (warm white in Light), one gold accent.
    case gold
    var id: String { rawValue }
    var label: String {
        switch self {
        case .centre: W("style.centre")
        case .list: W("style.list")
        case .dial: W("style.dial")
        case .sunPath: W("style.sunPath")
        case .bands: W("style.bands")
        case .simple: W("style.simple")
        case .gold: W("style.gold")
        }
    }
    /// The five looks people can pick, in the web app's order. Side Dial and Day Dial are
    /// retired: kept only so old saved choices and widgets still decode.
    static let looks: [TodayStyle] = [.centre, .sunPath, .bands, .simple, .gold]
    /// A retired look shows as Centre Dial.
    var look: TodayStyle { self == .list || self == .dial ? .centre : self }
}
