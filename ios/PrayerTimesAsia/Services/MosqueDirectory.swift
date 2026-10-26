import Foundation
import Observation

/// Masjid-confirmed (Grade B) timetables and jamaah times from data/mosques.json
/// in the public repo. The whole file is downloaded - nothing about where you
/// are is sent - cached on disk, and refreshed at most once a day.
@MainActor
@Observable
final class MosqueDirectory {
    private(set) var dataset = MosqueDataset(version: 1, licence: "CC-BY-4.0", mosques: [])

    static let url = URL(string: "https://raw.githubusercontent.com/aarif86/PrayerTimesAsia/main/data/mosques.json")!
    private static var cacheURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("mosques.json")
    }
    private static let refreshedKey = "mosques.refreshedAt"

    init() {
        if let data = try? Data(contentsOf: Self.cacheURL),
           let cached = try? JSONDecoder().decode(MosqueDataset.self, from: data) {
            dataset = cached
        }
    }

    func profile(near point: Coordinates) -> MosqueProfile? { dataset.profile(near: point) }

    func refreshIfStale() async {
        let last = UserDefaults.standard.object(forKey: Self.refreshedKey) as? Date ?? .distantPast
        guard Date.now.timeIntervalSince(last) > 86_400 else { return }
        var request = URLRequest(url: Self.url, timeoutInterval: 20)
        request.setValue("PrayerTimesAsia/1.0 (iOS)", forHTTPHeaderField: "User-Agent")
        guard let result = try? await URLSession.shared.data(for: request),
              (result.1 as? HTTPURLResponse)?.statusCode == 200,
              let fresh = try? JSONDecoder().decode(MosqueDataset.self, from: result.0) else { return }
        let data = result.0
        dataset = fresh
        UserDefaults.standard.set(Date.now, forKey: Self.refreshedKey)
        try? FileManager.default.createDirectory(at: Self.cacheURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try? data.write(to: Self.cacheURL, options: .atomic)
    }
}
