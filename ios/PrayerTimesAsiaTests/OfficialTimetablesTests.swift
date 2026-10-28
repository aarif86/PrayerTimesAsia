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

    /// Johor Bahru: Apple Maps lists almost nothing here, OpenStreetMap does.
    func testReadsOpenStreetMapPlaces() {
        let json = """
        {"elements":[
          {"type":"node","id":1,"lat":1.4655,"lon":103.7578,"tags":{"amenity":"place_of_worship","religion":"muslim","name":"Masjid Sultan Abu Bakar","addr:street":"Jalan Skudai","addr:city":"Johor Bahru"}},
          {"type":"way","id":2,"center":{"lat":1.5030,"lon":103.7770},"tags":{"amenity":"place_of_worship","religion":"muslim","name":"Surau Al-Ikhlas"}},
          {"type":"node","id":3,"lat":1.5040,"lon":103.7780,"tags":{"amenity":"place_of_worship","religion":"muslim","place_of_worship":"musalla"}},
          {"type":"node","id":4,"lat":3.1390,"lon":101.6869,"tags":{"amenity":"place_of_worship","religion":"muslim","name":"Far Away Masjid"}}
        ]}
        """
        let here = Coordinates(latitude: 1.5022, longitude: 103.7766)
        let spaces = NearbySearch.parseOverpass(Data(json.utf8), center: here) ?? []
        XCTAssertEqual(spaces.map(\.name), ["Surau Al-Ikhlas", "Musollah", "Masjid Sultan Abu Bakar"])
        XCTAssertEqual(spaces.map(\.isMusollah), [true, true, false])
        XCTAssertEqual(spaces.last?.address, "Jalan Skudai, Johor Bahru")
        XCTAssertNil(NearbySearch.parseOverpass(Data("not json".utf8), center: here))
    }

    func testOverpassQueryHasNoResultCap() {
        let q = NearbySearch.overpassQuery(around: Coordinates(latitude: 1.5022, longitude: 103.7766))
        XCTAssertTrue(q.contains("around:12000,1.5022,103.7766"), q)
        XCTAssertTrue(q.hasSuffix("out center tags;"), q)
    }
}

@MainActor
final class KemenagTests: XCTestCase {
    private let cities: [(id: String, name: String)] = [
        ("1201", "KAB. BANDUNG"), ("1202", "KAB. BANDUNG BARAT"), ("1219", "KOTA BANDUNG"),
        ("1204", "KAB. BOGOR"), ("1222", "KOTA BOGOR"), ("1301", "KOTA JAKARTA"),
        ("1638", "KOTA SURABAYA"), ("2622", "KOTA MAKASSAR"),
    ]

    func testMatchesApplePlaceNames() {
        XCTAssertEqual(OfficialTimetables.matchKemenagCity(["Kota Bandung"], in: cities), "1219")
        XCTAssertEqual(OfficialTimetables.matchKemenagCity(["Bandung City"], in: cities), "1219")
        XCTAssertEqual(OfficialTimetables.matchKemenagCity(["Kabupaten Bandung Barat"], in: cities), "1202")
        XCTAssertEqual(OfficialTimetables.matchKemenagCity(["Bogor Regency"], in: cities), "1204")
        XCTAssertEqual(OfficialTimetables.matchKemenagCity(["Bogor"], in: cities), "1222") // city preferred when unsaid
        XCTAssertEqual(OfficialTimetables.matchKemenagCity(["Jakarta Selatan"], in: cities), "1301")
        XCTAssertEqual(OfficialTimetables.matchKemenagCity(["South Jakarta"], in: cities), "1301")
        XCTAssertEqual(OfficialTimetables.matchKemenagCity(["Nowhere", "Surabaya"], in: cities), "1638")
        XCTAssertNil(OfficialTimetables.matchKemenagCity(["Tokyo"], in: cities))
    }

    func testParsesKemenag() throws {
        let json = """
        {"status":true,"data":{"id":1301,"lokasi":"KOTA JAKARTA","daerah":"DKI JAKARTA","jadwal":[
          {"tanggal":"Kamis, 01/10/2026","imsak":"04:13","subuh":"04:23","terbit":"05:35","dhuha":"06:02",
           "dzuhur":"11:46","ashar":"14:51","maghrib":"17:50","isya":"18:59","date":"2026-10-01"}]}}
        """
        let table = try OfficialTimetables.parseKemenag(Data(json.utf8))
        XCTAssertEqual(table["2026-10-01"], ["fajr": "04:23", "sunrise": "05:35", "dhuhr": "11:46",
                                            "asr": "14:51", "maghrib": "17:50", "isha": "18:59"])
    }
}
