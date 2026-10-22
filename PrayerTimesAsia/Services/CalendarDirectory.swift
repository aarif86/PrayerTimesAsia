import Foundation
import Observation

/// Ramadan/Eid announcements per authority from data/calendar.json in the
/// public repo. Announcements come the night before, so this refreshes every
/// three hours rather than daily. Nothing about you is sent.
@MainActor
@Observable
final class CalendarDirectory {
    private(set) var dataset = CalendarDataset(version: 1, licence: "CC-BY-4.0", announcements: [])

    static let url = URL(string: "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/data/calendar.json")!
    private static var cacheURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("calendar.json")
    }
    private static let refreshedKey = "calendar.refreshedAt"

    init() {
        if let data = try? Data(contentsOf: Self.cacheURL),
           let cached = try? JSONDecoder().decode(CalendarDataset.self, from: data) {
            dataset = cached
        }
    }

    func announcements(for event: HijriEvent, hijriYear: Int) -> [CalendarAnnouncement] {
        dataset.announcements.filter { $0.event == event && $0.hijriYear == hijriYear }
    }

    func refreshIfStale() async {
        let last = UserDefaults.standard.object(forKey: Self.refreshedKey) as? Date ?? .distantPast
        guard Date.now.timeIntervalSince(last) > 3 * 3600 else { return }
        var request = URLRequest(url: Self.url, timeoutInterval: 20)
        request.setValue("PrayerTimesAsia/1.0 (iOS)", forHTTPHeaderField: "User-Agent")
        guard let result = try? await URLSession.shared.data(for: request),
              (result.1 as? HTTPURLResponse)?.statusCode == 200,
              let fresh = try? JSONDecoder().decode(CalendarDataset.self, from: result.0) else { return }
        dataset = fresh
        UserDefaults.standard.set(Date.now, forKey: Self.refreshedKey)
        try? FileManager.default.createDirectory(at: Self.cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? result.0.write(to: Self.cacheURL, options: .atomic)
    }
}
