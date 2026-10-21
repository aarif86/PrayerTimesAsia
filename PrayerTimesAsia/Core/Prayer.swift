import Foundation

/// The six daily times shown in the app. `sunrise` (Syuruk) is not a prayer,
/// it marks the end of Subuh - shown, but never notified as a prayer.
enum Prayer: String, CaseIterable, Codable, Identifiable, Sendable {
    case fajr, sunrise, dhuhr, asr, maghrib, isha

    var id: String { rawValue }
    var isObligatory: Bool { self != .sunrise }

    static let obligatory: [Prayer] = [.fajr, .dhuhr, .asr, .maghrib, .isha]

    func name(_ style: NamingStyle, isFriday: Bool = false) -> String {
        if self == .dhuhr && isFriday { return style.friday }
        return style.names[self] ?? rawValue.capitalized
    }

    /// SF Symbol used for the row glyph.
    var symbol: String {
        switch self {
        case .fajr: "sun.horizon"
        case .sunrise: "sunrise"
        case .dhuhr: "sun.max"
        case .asr: "sun.min"
        case .maghrib: "sunset"
        case .isha: "moon.stars"
        }
    }
}

/// How prayer names are spelled. Muslims across Asia say the same prayers
/// with different words - a traveller from Singapore wants "Subuh" even in Tokyo.
enum NamingStyle: String, CaseIterable, Codable, Identifiable, Sendable {
    case malay, indonesian, arabic, southAsian

    var id: String { rawValue }

    var label: String {
        switch self {
        case .malay: "Malay (Subuh, Zuhur, Isyak)"
        case .indonesian: "Indonesian (Subuh, Dzuhur, Isya)"
        case .arabic: "Arabic (Fajr, Dhuhr, Isha)"
        case .southAsian: "South Asian (Fajr, Zuhr, Isha)"
        }
    }

    var names: [Prayer: String] {
        switch self {
        case .malay:
            [.fajr: "Subuh", .sunrise: "Syuruk", .dhuhr: "Zuhur", .asr: "Asar", .maghrib: "Maghrib", .isha: "Isyak"]
        case .indonesian:
            [.fajr: "Subuh", .sunrise: "Terbit", .dhuhr: "Dzuhur", .asr: "Ashar", .maghrib: "Maghrib", .isha: "Isya"]
        case .arabic:
            [.fajr: "Fajr", .sunrise: "Sunrise", .dhuhr: "Dhuhr", .asr: "Asr", .maghrib: "Maghrib", .isha: "Isha"]
        case .southAsian:
            [.fajr: "Fajr", .sunrise: "Sunrise", .dhuhr: "Zuhr", .asr: "Asr", .maghrib: "Maghrib", .isha: "Isha"]
        }
    }

    var friday: String {
        switch self {
        case .malay: "Jumaat"
        case .indonesian: "Jumat"
        case .arabic, .southAsian: "Jumu'ah"
        }
    }

    var hijriMonths: [String] {
        switch self {
        case .malay, .indonesian:
            ["Muharram", "Safar", "Rabiulawal", "Rabiulakhir", "Jamadilawal", "Jamadilakhir",
             "Rejab", "Syaaban", "Ramadan", "Syawal", "Zulkaedah", "Zulhijjah"]
        case .arabic, .southAsian:
            ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Ula", "Jumada al-Akhirah",
             "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qa'dah", "Dhu al-Hijjah"]
        }
    }
}

enum AsrSchool: String, CaseIterable, Codable, Identifiable, Sendable {
    /// Shafi'i, Maliki, Hanbali - shadow length equals object length.
    case standard
    /// Shadow twice the object length.
    case hanafi

    var id: String { rawValue }
    var shadowFactor: Double { self == .hanafi ? 2 : 1 }
    var label: String { self == .hanafi ? "Hanafi" : "Shafi'i (standard)" }
}
