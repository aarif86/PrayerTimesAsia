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
    /// The names in each language's own words and script. A native speaker
    /// should check each one before launch.
    case arabicScript, urdu, bengali, french

    /// Written right to left. English sentences use International names instead.
    var isRightToLeft: Bool { self == .arabicScript || self == .urdu }

    var id: String { rawValue }

    /// Short name, for "Subuh (Malay)" style captions.
    var language: String {
        switch self {
        case .international: "International"
        case .malay: "Malay"
        case .indonesian: "Indonesian"
        case .southAsian: "South Asian"
        case .turkish: "Turkish"
        case .arabicScript: "Arabic"
        case .urdu: "Urdu"
        case .bengali: "Bangla"
        case .french: "French"
        }
    }

    var label: String {
        switch self {
        case .international: "International (Fajr, Dhuhr, Asr, Isha)"
        case .malay: "Malay (Subuh, Zohor, Asar, Isyak)"
        case .indonesian: "Indonesian (Subuh, Dzuhur, Ashar, Isya)"
        case .southAsian: "South Asian (Fajr, Zuhr, Asr, Isha)"
        case .turkish: "Turkish (Sabah, Öğle, İkindi, Yatsı)"
        case .arabicScript: "Arabic (الفجر، الظهر، العصر)"
        case .urdu: "Urdu (فجر، ظہر، عصر)"
        case .bengali: "Bangla (ফজর, যোহর, আসর)"
        case .french: "French (Fajr, Dhohr, Asr, Icha)"
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
        case .arabicScript:
            [.fajr: "الفجر", .sunrise: "الشروق", .dhuhr: "الظهر", .asr: "العصر", .maghrib: "المغرب", .isha: "العشاء"]
        case .urdu:
            [.fajr: "فجر", .sunrise: "طلوع آفتاب", .dhuhr: "ظہر", .asr: "عصر", .maghrib: "مغرب", .isha: "عشاء"]
        case .bengali:
            [.fajr: "ফজর", .sunrise: "সূর্যোদয়", .dhuhr: "যোহর", .asr: "আসর", .maghrib: "মাগরিব", .isha: "এশা"]
        case .french:
            [.fajr: "Fajr", .sunrise: "Chourouq", .dhuhr: "Dhohr", .asr: "Asr", .maghrib: "Maghrib", .isha: "Icha"]
        }
    }

    var friday: String {
        switch self {
        case .malay: "Jumaat"
        case .indonesian: "Jumat"
        case .turkish: "Cuma"
        case .international, .southAsian: "Jumu'ah"
        case .arabicScript: "الجمعة"
        case .urdu: "جمعہ"
        case .bengali: "জুমা"
        case .french: "Joumou'a"
        }
    }

    var hijriMonths: [String] {
        switch self {
        case .malay, .indonesian:
            ["Muharram", "Safar", "Rabiulawal", "Rabiulakhir", "Jamadilawal", "Jamadilakhir",
             "Rejab", "Syaaban", "Ramadan", "Syawal", "Zulkaedah", "Zulhijjah"]
        case .international, .southAsian:
            ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Ula", "Jumada al-Akhirah",
             "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qa'dah", "Dhu al-Hijjah"]
        case .turkish:
            ["Muharrem", "Safer", "Rebiülevvel", "Rebiülahir", "Cemaziyelevvel", "Cemaziyelahir",
             "Recep", "Şaban", "Ramazan", "Şevval", "Zilkade", "Zilhicce"]
        case .arabicScript:
            ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
             "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"]
        case .urdu:
            ["محرم", "صفر", "ربیع الاول", "ربیع الثانی", "جمادی الاول", "جمادی الثانی",
             "رجب", "شعبان", "رمضان", "شوال", "ذوالقعدہ", "ذوالحجہ"]
        case .bengali:
            ["মহররম", "সফর", "রবিউল আউয়াল", "রবিউস সানি", "জমাদিউল আউয়াল", "জমাদিউস সানি",
             "রজব", "শাবান", "রমজান", "শাওয়াল", "জিলকদ", "জিলহজ"]
        case .french:
            ["Mouharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Joumada al-Oula", "Joumada al-Akhira",
             "Rajab", "Chaabane", "Ramadan", "Chawwal", "Dhou al-Qida", "Dhou al-Hijja"]
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
