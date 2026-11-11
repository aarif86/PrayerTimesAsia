import Foundation

/// Every word on the Ramadan page and the Ramadan card, in English, Malay and
/// Indonesian (data/ramadan-words.json, written into RamadanWordsData.swift by
/// tools/build_ramadan_words.py). The language follows the prayer names, like
/// the doa and the alerts. The doa and niat text itself is in RamadanContent.
enum RamadanWords {
    /// The line for this key in this language, with its {holes} filled in.
    static func text(_ key: RamadanWordKey, _ lang: RamadanContent.Lang, _ args: [String: CustomStringConvertible] = [:]) -> String {
        let words = data[lang] ?? [:]
        let one = (args["n"].map { "\($0)" } == "1") ? words[key.rawValue + "_one"] : nil
        var line = one ?? words[key.rawValue] ?? data[.en]?[key.rawValue] ?? ""
        for (name, value) in args { line = line.replacingOccurrences(of: "{\(name)}", with: "\(value)") }
        return line
    }

    static func mark(_ m: FastMark, _ lang: RamadanContent.Lang) -> String { line("mark_" + m.rawValue, lang) }

    /// One letter for a day in the month grid; empty for a kept fast.
    static func letter(_ m: FastMark, _ lang: RamadanContent.Lang) -> String { line("letter_" + m.rawValue, lang) }

    static func locale(_ lang: RamadanContent.Lang) -> Locale {
        switch lang {
        case .en: Locale(identifier: "en_GB")
        case .ms: Locale(identifier: "ms_MY")
        case .id: Locale(identifier: "id_ID")
        }
    }

    private static func line(_ key: String, _ lang: RamadanContent.Lang) -> String { data[lang]?[key] ?? data[.en]?[key] ?? "" }

    /// A short way to write lines in one language: `let t = RamadanWords.In(lang); t(.imsak)`.
    struct In {
        let lang: RamadanContent.Lang
        init(_ lang: RamadanContent.Lang) { self.lang = lang }
        func callAsFunction(_ key: RamadanWordKey, _ args: [String: CustomStringConvertible] = [:]) -> String { RamadanWords.text(key, lang, args) }
        func mark(_ m: FastMark) -> String { RamadanWords.mark(m, lang) }
        func letter(_ m: FastMark) -> String { RamadanWords.letter(m, lang) }
    }
}
