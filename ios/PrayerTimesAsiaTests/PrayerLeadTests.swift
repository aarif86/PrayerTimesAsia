import XCTest
@testable import PrayerTimesAsia

/// What leads the Prayer screen and widgets. Same cases as web/tests/prayerLead.test.ts.
final class PrayerLeadTests: XCTestCase {
    private let t = Date(timeIntervalSince1970: 1_800_000_000)

    func testAnOpenPrayerLeadsAsNow() {
        let lead = PrayerLead(current: (.asr, t), next: (.maghrib, t + 3600))
        XCTAssertEqual(lead?.prayer, .asr)
        XCTAssertEqual(lead?.isNext, false)
        XCTAssertEqual(PrayerLead.open((.asr, t))?.prayer, .asr)
    }

    func testFromSyurukToZohorTheNextPrayerLeads() {
        let lead = PrayerLead(current: (.sunrise, t), next: (.dhuhr, t + 3180))
        XCTAssertEqual(lead?.prayer, .dhuhr)
        XCTAssertEqual(lead?.time, t + 3180)
        XCTAssertEqual(lead?.isNext, true)
        XCTAssertNil(PrayerLead.open((.sunrise, t)))
    }

    func testSubuhStaysOpenUntilSyuruk() {
        XCTAssertEqual(PrayerLead(current: (.fajr, t), next: (.sunrise, t + 600))?.prayer, .fajr)
    }

    func testNothingWithoutTimes() {
        XCTAssertNil(PrayerLead(current: nil, next: (.dhuhr, t)))
    }
}
