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

/// How prayer names are spelled. Muslims across Asia say the same prayers with
/// different words. The app uses *your* words (from your home, or your phone)
/// wherever you are, and shows the local word underneath when you travel - so a
/// Singaporean in Tokyo still reads "Subuh", and an Australian in Kuala Lumpur
/// reads "Fajr" with "Subuh" beneath it, as the masjid there writes it.
enum NamingStyle: String, CaseIterable, Codable, Identifiable, Sendable {
    /// rawValue "arabic" is kept so saved preferences still decode.
    case international = "arabic"
    case malay, indonesian, southAsian, turkish

    var id: String { rawValue }

    /// Short name, for "Subuh (Malay)" style captions.
    var language: String {
        switch self {
        case .international: "International"
        case .malay: "Malay"
        case .indonesian: "Indonesian"
        case .southAsian: "South Asian"
        case .turkish: "Turkish"
        }
    }

    var label: String {
        switch self {
        case .international: "International (Fajr, Dhuhr, Asr, Isha)"
        case .malay: "Malay (Subuh, Zohor, Asar, Isyak)"
        case .indonesian: "Indonesian (Subuh, Dzuhur, Ashar, Isya)"
        case .southAsian: "South Asian (Fajr, Zuhr, Asr, Isha)"
        case .turkish: "Turkish (Sabah, Öğle, İkindi, Yatsı)"
        }
    }

    /// Spellings follow each authority's own timetable: MUIS/JAKIM (Malay),
    /// Kemenag (Indonesian), Diyanet (Turkish); International is the common
    /// English transliteration.
    var names: [Prayer: String] {
        switch self {
        case .international:
            [.fajr: "Fajr", .sunrise: "Sunrise", .dhuhr: "Dhuhr", .asr: "Asr", .maghrib: "Maghrib", .isha: "Isha"]
        case .malay:
            [.fajr: "Subuh", .sunrise: "Syuruk", .dhuhr: "Zohor", .asr: "Asar", .maghrib: "Maghrib", .isha: "Isyak"]
        case .indonesian:
            [.fajr: "Subuh", .sunrise: "Terbit", .dhuhr: "Dzuhur", .asr: "Ashar", .maghrib: "Maghrib", .isha: "Isya"]
        case .southAsian:
            [.fajr: "Fajr", .sunrise: "Sunrise", .dhuhr: "Zuhr", .asr: "Asr", .maghrib: "Maghrib", .isha: "Isha"]
        case .turkish:
            [.fajr: "Sabah", .sunrise: "Güneş", .dhuhr: "Öğle", .asr: "İkindi", .maghrib: "Akşam", .isha: "Yatsı"]
        }
    }

    var friday: String {
        switch self {
        case .malay: "Jumaat"
        case .indonesian: "Jumat"
        case .turkish: "Cuma"
        case .international, .southAsian: "Jumu'ah"
        }
    }

    var hijriMonths: [String] {
        switch self {
        case .malay, .indonesian:
            ["Muharram", "Safar", "Rabiulawal", "Rabiulakhir", "Jamadilawal", "Jamadilakhir",
             "Rejab", "Syaaban", "Ramadan", "Syawal", "Zulkaedah", "Zulhijjah"]
        case .international, .southAsian, .turkish:
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
