import Foundation
@testable import PrayerTimesAsia

/// The expected times shared with the Android and web tests, read from the
/// repository's testdata/ folder. The Simulator runs on the same Mac as the
/// checkout, so the file is found next to this source file.
enum ExpectedTimes {
    struct Day {
        let source: String
        let method: CalculationMethod
        let date: (year: Int, month: Int, day: Int)
        let coordinates: Coordinates
        let timeZone: TimeZone
        let times: [String] // local 24h, in Prayer.allCases order
    }

    struct YearPlace {
        let name: String
        let method: CalculationMethod
        let coordinates: Coordinates
        let tzHours: Int
        let days: [String: [Int]] // "2026-01-01": minutes after local midnight
    }

    private struct File: Decodable {
        struct Place: Decodable { let lat: Double; let lng: Double; let timeZone: String }
        struct Entry: Decodable { let source: String; let method: String; let place: String; let date: String; let times: [String] }
        struct Section: Decodable { let days: [Entry] }
        struct WholeYear: Decodable { let file: String }
        let places: [String: Place]
        let official: Section
        let exact: Section
        let wholeYear: WholeYear
    }

    private struct Reference: Decodable { let method: String; let lat: Double; let lng: Double; let tzHours: Int; let days: [String: [Int]] }

    static let directory = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent() // PrayerTimesAsiaTests
        .deletingLastPathComponent() // ios
        .deletingLastPathComponent() // repository root
        .appendingPathComponent("testdata")

    private static func load<T: Decodable>(_ name: String) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(contentsOf: directory.appendingPathComponent(name)))
    }

    private static func days(_ entries: [File.Entry], places: [String: File.Place]) throws -> [Day] {
        try entries.map { e -> Day in
            guard let method = CalculationMethod.with(id: e.method) else { throw Missing("method \(e.method)") }
            guard let place = places[e.place], let zone = TimeZone(identifier: place.timeZone) else { throw Missing("place \(e.place)") }
            let ymd = e.date.split(separator: "-").map { Int($0)! }
            return Day(source: e.source, method: method, date: (ymd[0], ymd[1], ymd[2]),
                       coordinates: Coordinates(latitude: place.lat, longitude: place.lng),
                       timeZone: zone, times: e.times)
        }
    }

    struct Missing: Error, CustomStringConvertible {
        let description: String
        init(_ what: String) { description = "testdata/expected-times.json: unknown \(what)" }
    }

    /// Official timetable days: never earlier than these.
    static func official() throws -> [Day] {
        let file: File = try load("expected-times.json")
        return try days(file.official.days, places: file.places)
    }

    /// What the apps show, to the minute.
    static func exact() throws -> [Day] {
        let file: File = try load("expected-times.json")
        return try days(file.exact.days, places: file.places)
    }

    /// Every day of 2026 from tools/reference_engine.py.
    static func wholeYear() throws -> [YearPlace] {
        let file: File = try load("expected-times.json")
        let reference: [String: Reference] = try load(file.wholeYear.file)
        return try reference.sorted { $0.key < $1.key }.map { entry -> YearPlace in
            let (name, r) = (entry.key, entry.value)
            guard let method = CalculationMethod.with(id: r.method) else { throw Missing("method \(r.method)") }
            return YearPlace(name: name, method: method, coordinates: Coordinates(latitude: r.lat, longitude: r.lng),
                             tzHours: r.tzHours, days: r.days)
        }
    }
}
