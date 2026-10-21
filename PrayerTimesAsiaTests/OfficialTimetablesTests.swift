import XCTest
@testable import PrayerTimesAsia

/// Parsers use the exact response shapes seen from e-solat.gov.my and
/// data.gov.sg in the validate workflow (tools/validate_official.py).
@MainActor
final class OfficialTimetablesTests: XCTestCase {
    func testParsesJakimWithMalayMonths() throws {
        let json = """
        {"prayerTime":[
          {"hijri":"1447-07-11","date":"01-Jan-2026","day":"Thursday","imsak":"05:56:00","fajr":"06:06:00",
           "syuruk":"07:18:00","dhuha":"07:43:00","dhuhr":"13:19:00","asr":"16:42:00","maghrib":"19:17:00","isha":"20:31:00"},
          {"hijri":"1447-09-12","date":"01-Mac-2026","day":"Sunday","imsak":"06:02:00","fajr":"06:12:00",
           "syuruk":"07:21:00","dhuha":"07:46:00","dhuhr":"13:25:00","asr":"16:35:00","maghrib":"19:26:00","isha":"20:35:00"}
        ],"status":"OK!","serverTime":"2026-10-21 12:00:00","periodType":"year","lang":"ms_my","zone":"WLY01","bearing":"292° 31′ 9″"}
        """
        let table = try OfficialTimetables.parseJAKIM(Data(json.utf8), year: 2026)
        XCTAssertEqual(table["2026-01-01"]?["fajr"], "06:06")
        XCTAssertEqual(table["2026-01-01"]?["sunrise"], "07:18")
        XCTAssertEqual(table["2026-03-01"]?["isha"], "20:35")
        XCTAssertEqual(OfficialTimetables.jakimDate("15-Ogos-2026"), "2026-08-15")
        XCTAssertEqual(OfficialTimetables.jakimDate("31-Dis-2026"), "2026-12-31")
    }

    func testParsesMuis() throws {
        let json = """
        {"success":true,"result":{"records":[
          {"_id":1,"Date":"2026-01-01","Day":"Thurs","Subuh":"05:44","Syuruk":"07:08","Zohor":"13:10",
           "Asar":"16:34","Maghrib":"19:11","Isyak":"20:25"}
        ]}}
        """
        let table = try OfficialTimetables.parseMUIS(Data(json.utf8))
        XCTAssertEqual(table["2026-01-01"], ["fajr": "05:44", "sunrise": "07:08", "dhuhr": "13:10",
                                            "asr": "16:34", "maghrib": "19:11", "isha": "20:25"])
    }

    func testNearestJakimZone() {
        XCTAssertEqual(OfficialTimetables.nearestJakimZone(to: Coordinates(latitude: 3.1478, longitude: 101.6953)), "WLY01") // KLCC area
        XCTAssertEqual(OfficialTimetables.nearestJakimZone(to: Coordinates(latitude: 1.4927, longitude: 103.7414)), "JHR02") // Johor Bahru
        XCTAssertEqual(OfficialTimetables.nearestJakimZone(to: Coordinates(latitude: 5.4141, longitude: 100.3288)), "PNG01") // George Town
        XCTAssertEqual(OfficialTimetables.nearestJakimZone(to: Coordinates(latitude: 1.5535, longitude: 110.3593)), "SWK08") // Kuching
        XCTAssertEqual(OfficialTimetables.nearestJakimZone(to: Coordinates(latitude: 5.9804, longitude: 116.0735)), "SBH07") // Kota Kinabalu
    }

    func testSourceOnlyForTheAuthoritysOwnMethod() {
        let kl = Place(name: "KL", countryCode: "MY", countryName: "Malaysia", timeZoneID: "Asia/Kuala_Lumpur",
                       coordinates: Coordinates(latitude: 3.1478, longitude: 101.6953))
        XCTAssertEqual(OfficialTimetables.source(for: kl, method: .jakim, zoneOverride: nil), .jakim(zone: "WLY01"))
        XCTAssertEqual(OfficialTimetables.source(for: kl, method: .jakim, zoneOverride: "SGR01"), .jakim(zone: "SGR01"))
        XCTAssertNil(OfficialTimetables.source(for: kl, method: .mwl, zoneOverride: nil))
        let sg = Place(name: "SG", countryCode: "SG", countryName: "Singapore", timeZoneID: "Asia/Singapore",
                       coordinates: Coordinates(latitude: 1.35, longitude: 103.82))
        XCTAssertEqual(OfficialTimetables.source(for: sg, method: .muis, zoneOverride: nil), .muis)
    }
}

@MainActor
final class NearbySearchTests: XCTestCase {
    func testKeepsPrayerSpacesAndDropsLookalikes() {
        for name in ["Al-Istighfar Mosque", "Musollah@Pasir Ris Mall", "Surau Raudhatul Jannah",
                     "Masjid Kampong Siglap", "Prayer Room", "Tokyo Camii", "Seoul Central Masjid",
                     "Masjid Jalan Kebun", "Masjid Jamek"] {
            XCTAssertTrue(NearbySearch.looksLikePrayerSpace(name), name)
        }
        for name in ["Darul Ghufran Mosque Stop", "Mosque Street", "Jalan Masjid", "Masjid Jamek LRT Station",
                     "Mosque Road Car Park", "Bugis Mosque Bus Stop", "Starbucks"] {
            XCTAssertFalse(NearbySearch.looksLikePrayerSpace(name), name)
        }
    }
}
