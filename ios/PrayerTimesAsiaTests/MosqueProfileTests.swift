import XCTest
@testable import PrayerTimesAsia

/// The Grade B path: a mosque's fingerprint and jamaah rules from data/mosques.json.
final class MosqueProfileTests: XCTestCase {
    private let json = """
    {"version":1,"licence":"CC-BY-4.0","mosques":[
      {"id":"test-hcm","name":"Test Masjid","lat":10.7626,"lng":106.6957,"country":"VN","radiusKm":3,
       "fingerprint":{"fajrAngle":18,"ishaAngle":17,"ishaInterval":null,"asrFactor":1,
                      "offsets":{"fajr":2,"dhuhr":2,"asr":2,"maghrib":2,"isha":2}},
       "jamaah":{"fajr":{"afterMinutes":20},"dhuhr":{"fixed":"13:00"},"isha":{"beforeSunriseMinutes":null,"afterMinutes":15}},
       "jumuah":"13:15","source":"unit test","verifiedAt":"2026-10-22","grade":"B"}
    ]}
    """

    func testResolvesWithinRadiusOnly() throws {
        let data = try JSONDecoder().decode(MosqueDataset.self, from: Data(json.utf8))
        XCTAssertEqual(data.profile(near: Coordinates(latitude: 10.77, longitude: 106.70))?.id, "test-hcm")
        XCTAssertNil(data.profile(near: Coordinates(latitude: 21.03, longitude: 105.85))) // Hanoi
    }

    func testFingerprintAndJamaah() throws {
        let mosque = try JSONDecoder().decode(MosqueDataset.self, from: Data(json.utf8)).mosques[0]
        let method = try XCTUnwrap(mosque.method)
        XCTAssertEqual(method.fajrAngle, 18)
        XCTAssertEqual(method.offsets[.maghrib], 2)
        let tz = TimeZone(identifier: "Asia/Ho_Chi_Minh")!
        let day = PrayerEngine.compute(year: 2026, month: 10, day: 21, at: mosque.coordinates, method: method, asr: .standard)
        let jamaah = mosque.jamaahTimes(for: day, timeZone: tz, isFriday: false)
        XCTAssertEqual(jamaah[.fajr], day.time(.fajr).addingTimeInterval(20 * 60))
        XCTAssertEqual(jamaah[.isha], day.time(.isha).addingTimeInterval(15 * 60))
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = tz
        XCTAssertEqual(cal.dateComponents([.hour, .minute], from: jamaah[.dhuhr]!), DateComponents(hour: 13, minute: 0))
        let friday = mosque.jamaahTimes(for: day, timeZone: tz, isFriday: true)
        XCTAssertEqual(cal.dateComponents([.hour, .minute], from: friday[.dhuhr]!), DateComponents(hour: 13, minute: 15))
        XCTAssertNil(jamaah[.asr])
    }

    func testShippedDatasetDecodes() throws {
        // data/mosques.json must always decode, or no profile would ever load.
        // ios/PrayerTimesAsiaTests/ -> repo root, where the shared data lives.
        let url = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().appendingPathComponent("data/mosques.json")
        let data = try Data(contentsOf: url)
        XCTAssertNoThrow(try JSONDecoder().decode(MosqueDataset.self, from: data))
    }
}
