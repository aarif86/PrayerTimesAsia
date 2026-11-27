import Foundation

/// Every word on the app screens, in English, Malay and Indonesian. The text is
/// the shared list in data/app-words, written into AppWordsData.swift by
/// tools/build_ios_words.py, so the iPhone, Android and web apps say the same
/// thing. Prayer names are not here, they follow the prayer names setting.
enum AppWords {
    /// The line for this key in this language, with its {holes} filled in. A key
    /// with a `_one` line uses it when `n` is exactly 1. A key the language lacks
    /// falls back to English, and an unknown key gives an empty line.
    static func text(_ key: String, _ lang: RamadanContent.Lang, _ args: [String: CustomStringConvertible] = [:]) -> String {
        let words = lines(lang)
        let single = (args["n"].map { "\($0)" } == "1") ? words[key + "_one"] : nil
        var line = single ?? words[key] ?? enLines[key] ?? ""
        for (name, value) in args { line = line.replacingOccurrences(of: "{\(name)}", with: "\(value)") }
        return line
    }

    /// The language of the app's own words (the Ramadan page, alert lines, hadith
    /// cards, widgets). English until the App words choice ships in Settings.
    /// The prayer names setting must never change this: it only picks how
    /// Fajr, Subuh and the others are written.
    static func appLanguage(naming: NamingStyle) -> RamadanContent.Lang { .en }

    /// The app language from the phone's language list. Bahasa Melayu and Bahasa
    /// Indonesia when the phone is set to them, English for everything else.
    static func deviceLang(_ preferred: [String] = Locale.preferredLanguages) -> RamadanContent.Lang {
        for tag in preferred {
            switch String(tag.prefix(2)).lowercased() {
            case "ms": return .ms
            case "id", "in": return .id
            case "en": return .en
            default: continue
            }
        }
        return .en
    }

    static func lines(_ lang: RamadanContent.Lang) -> [String: String] {
        switch lang {
        case .en: enLines
        case .ms: msLines
        case .id: idLines
        }
    }
}
