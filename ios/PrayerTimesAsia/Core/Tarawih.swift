import Foundation

/// The Tarawih counter. The user chooses 8 or 20 rakaat once (both are followed,
/// the app never says which), then taps after each salam. Each tap is 2 rakaat.
/// Same rules as web/src/core/tarawih.ts and android core Tarawih.kt.
enum Tarawih {
    static let choices = [8, 20]

    /// One salam: two more rakaat, never past the total.
    static func tap(_ done: Int, total: Int) -> Int { min(total, max(0, done) + 2) }

    /// Take back the last salam.
    static func undo(_ done: Int) -> Int { max(0, done - 2) }

    /// One dot per salam.
    static func sets(_ total: Int) -> Int { total / 2 }
}
