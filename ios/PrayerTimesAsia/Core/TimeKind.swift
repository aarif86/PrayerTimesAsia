import Foundation

/// What kind of time this is, in plain words, so nobody has to know what a grade means.
///   published   copied from the timetable an authority publishes
///   formula     worked out on the phone with an authority's own published method
///   masjid      from a masjid's own timetable
///   calculated  worked out with a widely used international method
///
/// Same rules as web/src/core/timeKind.ts and android core TimeKind.kt.
enum TimeKind: Sendable {
    case published, formula, masjid, calculated

    /// Methods that belong to no single authority. Everything else is some authority's own method.
    private static let international: Set<String> = ["sea", "mwl", "karachi", "isna", "moonsighting"]

    static func of(grade: SourceGrade, hasOfficialTimetable: Bool, method: CalculationMethod) -> TimeKind {
        if grade == .masjid { return .masjid }
        if grade == .official { return hasOfficialTimetable ? .published : .formula }
        if grade == .calculated && !international.contains(method.id) { return .formula }
        return .calculated
    }

    var title: String {
        switch self {
        case .published: W("source.kindPublished")
        case .formula: W("source.kindFormula")
        case .masjid: W("source.kindMasjid")
        case .calculated: W("source.kindCalculated")
        }
    }

    var explanation: String {
        switch self {
        case .published: W("source.kindExplainPublished")
        case .formula: W("source.kindExplainFormula")
        case .masjid: W("source.kindExplainMasjid")
        case .calculated: W("source.kindExplainCalculated")
        }
    }

    /// The country whose authority owns this method (nil for international methods).
    static func methodCountry(_ method: CalculationMethod) -> CountryProfile? {
        if international.contains(method.id) { return nil }
        return AsiaRegions.profiles.first { $0.methodID == method.id && $0.source != .standard }
    }

    /// The person pinned a method in Settings and is now in another country, so the
    /// times follow a country they are not in. Returns that country, else nil.
    static func awayFromMethodCountry(pinned: Bool, method: CalculationMethod, placeCountry: String?) -> CountryProfile? {
        guard pinned, let placeCountry, !placeCountry.isEmpty else { return nil }
        guard let home = methodCountry(method), home.code != placeCountry.uppercased() else { return nil }
        return home
    }
}
