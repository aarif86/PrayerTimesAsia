import Foundation
import Observation

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

    /// The language of the app's own words (every screen, alert lines, hadith
    /// cards, widgets). The prayer names setting must never change this: it only
    /// picks how Fajr, Subuh and the others are written.
    /// The language the app speaks: the App words choice, or the phone's language
    /// (English unless it is Malay or Indonesian). Prayer names never decide it.
    static func appLanguage(choice: AppLanguageChoice?, preferred: [String] = Locale.preferredLanguages) -> RamadanContent.Lang {
        choice?.lang ?? deviceLang(preferred)
    }

    /// The language every screen reads from. Set from the App words choice by
    /// AppModel. It is observable, so any view that calls `W(...)` redraws when
    /// the choice changes.
    static var current: RamadanContent.Lang { AppLanguage.shared.lang }

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

    /// Day and month names for dates follow the app language.
    static var formatLocale: Locale {
        switch AppLanguage.shared.lang {
        case .en: Locale(identifier: "en_GB")
        case .ms: Locale(identifier: "ms_MY")
        case .id: Locale(identifier: "id_ID")
        }
    }

    static func lines(_ lang: RamadanContent.Lang) -> [String: String] {
        switch lang {
        case .en: enLines
        case .ms: msLines
        case .id: idLines
        }
    }
}

/// What the App words setting can be set to. No saved choice means Automatic,
/// the phone's language (English unless it is Malay or Indonesian).
enum AppLanguageChoice: String, CaseIterable, Codable, Identifiable, Sendable {
    case en, ms, id

    var id: String { rawValue }

    var lang: RamadanContent.Lang {
        switch self {
        case .en: .en
        case .ms: .ms
        case .id: .id
        }
    }

    /// Each language in its own words, so it can always be found.
    var label: String {
        switch self {
        case .en: "English"
        case .ms: "Bahasa Melayu"
        case .id: "Bahasa Indonesia"
        }
    }

    static func code(_ lang: RamadanContent.Lang) -> String {
        switch lang {
        case .en: "en"
        case .ms: "ms"
        case .id: "id"
        }
    }

    static func label(_ lang: RamadanContent.Lang) -> String {
        switch lang {
        case .en: AppLanguageChoice.en.label
        case .ms: AppLanguageChoice.ms.label
        case .id: AppLanguageChoice.id.label
        }
    }
}

/// The one place every screen asks which language the app words are in.
@Observable
final class AppLanguage {
    static let shared = AppLanguage()
    var lang: RamadanContent.Lang = AppWords.deviceLang()
}

/// One line of the app's words in the app language. A view that calls this
/// redraws when the App words choice changes.
func W(_ key: String, _ args: [String: CustomStringConvertible] = [:]) -> String {
    Device.words(AppWords.text(key, AppLanguage.shared.lang, args))
}

/// A line with one {time} hole, cut into the words before and after it, for
/// places where a ticking timer sits between them ("in" 5:00, 5:00 "left").
func Wsplit(_ key: String) -> (String, String) {
    let parts = W(key, ["time": "\u{1}"]).components(separatedBy: "\u{1}")
    return (parts.first ?? "", parts.count > 1 ? parts[1] : "")
}
