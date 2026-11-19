import Foundation

/// The quick guide new users see once, after choosing their place (and again from
/// Settings). The words live in data/guide-words.json and are written into
/// GuideWordsData.swift by tools/build_guide_words.py.
enum GuideWords {
    /// One moment on a card's little phone: an app screen, the box the finger points at
    /// (fractions of the screen), the words under it, and whether the finger taps.
    struct Step: Equatable {
        let shot: String
        let x: Double, y: Double, w: Double, h: Double
        let say: String
        let tap: Bool
    }

    /// The line for this key in this language, with its {holes} filled in.
    static func word(_ lang: RamadanContent.Lang, _ key: String, _ args: [String: String] = [:]) -> String {
        var line = data[lang]?[key] ?? data[.en]?[key] ?? key
        for (name, value) in args { line = line.replacingOccurrences(of: "{\(name)}", with: value) }
        return line
    }

    /// The prayer names' language if it is Malay or Indonesian, else the phone's.
    static func startLanguage(naming: NamingStyle, locale: Locale = .current) -> RamadanContent.Lang {
        let fromNames = RamadanContent.lang(naming)
        if fromNames != .en { return fromNames }
        switch locale.language.languageCode?.identifier {
        case "ms": return .ms
        case "id", "in": return .id
        default: return .en
        }
    }
}
