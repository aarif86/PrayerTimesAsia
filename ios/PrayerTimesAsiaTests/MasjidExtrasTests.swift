import XCTest
@testable import PrayerTimesAsia

/// The Masjid tab extras, checked with the same cases as the web and Android apps.
final class MasjidExtrasTests: XCTestCase {
    func testFridayListMatchesTheWeb() {
        XCTAssertEqual(MasjidExtras.friday.count, 24)
        XCTAssertEqual(MasjidExtras.fridayAt(Coordinates(latitude: 1.37106, longitude: 103.96412))?.name, "Masjid Al-Istighfar")
        XCTAssertNil(MasjidExtras.fridayAt(Coordinates(latitude: 1.38, longitude: 103.97)))
        XCTAssertEqual(MasjidExtras.fridayNearest(Coordinates(latitude: 1.3044, longitude: 103.8537)).first?.mosque.name, "Masjid Abdul Gafoor")
    }

    func testEidShowsTwoWeeksBefore() {
        let e = EidEvent(name: "Hari Raya Aidilfitri 1448H", date: "2027-03-10", sourceURL: "x",
                         mosques: [EidMosque(name: "Al-Ansar", lat: nil, lng: nil, sessions: [EidSession(time: "07:20", khutbah: "Malay", women: true)], note: nil)])
        XCTAssertNil(MasjidExtras.currentEid(today: "2027-02-20", events: [e]))
        XCTAssertNotNil(MasjidExtras.currentEid(today: "2027-02-25", events: [e]))
        XCTAssertNotNil(MasjidExtras.currentEid(today: "2027-03-10", events: [e]))
        XCTAssertNil(MasjidExtras.currentEid(today: "2027-03-11", events: [e]))
        XCTAssertEqual(MasjidExtras.eidAt(e, name: "Al-Ansar Mosque", coordinates: Coordinates(latitude: 1, longitude: 103))?.name, "Al-Ansar")
        XCTAssertEqual(e.shortName, "Hari Raya Aidilfitri")
    }

    func testTripTimes() {
        XCTAssertEqual(MasjidExtras.tripText(1.85, mode: .walk), "23 min walk")
        XCTAssertNil(MasjidExtras.tripText(2.5, mode: .walk))
        XCTAssertEqual(MasjidExtras.tripText(1.9, mode: .drive), "6 min drive")
        XCTAssertEqual(MasjidExtras.clock("13:00", use24: false), "1 PM")
        XCTAssertEqual(MasjidExtras.clock("07:20", use24: false), "7:20 AM")
    }

    func testGravesLeftOut() {
        XCTAssertTrue(NearbySearch.isGraveOrShrine("Kubur Kassim"))
        XCTAssertFalse(NearbySearch.isGraveOrShrine("Masjid Kubur Kassim"))
        XCTAssertEqual(NearbySearch.facilities(["female": "yes", "wheelchair": "limited"]), "wa")
    }

    func testOpeningHours() {
        XCTAssertEqual(OpeningHours.at("Mo-Su 10:00-22:00", weekday: 2, minute: 9 * 60), OpeningHours.Now(open: false, opensAt: "10:00"))
        XCTAssertEqual(OpeningHours.at("Mo-Su 10:00-22:00", weekday: 2, minute: 13 * 60), OpeningHours.Now(open: true, until: "22:00"))
        XCTAssertEqual(OpeningHours.at("Mo-Fr 08:00-20:00; Sa,Su off", weekday: 5, minute: 12 * 60), OpeningHours.Now(open: false))
        XCTAssertEqual(OpeningHours.at("Mo-Su 18:00-02:00", weekday: 1, minute: 60), OpeningHours.Now(open: true, until: "02:00"))
        XCTAssertEqual(OpeningHours.at("24/7", weekday: 3, minute: 600), OpeningHours.Now(open: true))
        XCTAssertNil(OpeningHours.at("Jan-Mar Mo-Fr 09:00-17:00", weekday: 0, minute: 600))
    }

    func testTileRowsKeepFacilitiesAndHours() throws {
        let json = #"{"places":[["n1",1.3,103.8,"Surau Mall","",1,"wa","Mo-Su 10:00-22:00"],["n2",1.31,103.81,"Masjid X","",0],["n3",1.32,103.82,"Kubur Kassim","",0]]}"#
        let p = try XCTUnwrap(MasjidList.parse(Data(json.utf8)))
        XCTAssertEqual(p.count, 2)
        XCTAssertEqual(p[0].facilities, "wa")
        XCTAssertEqual(p[0].hours, "Mo-Su 10:00-22:00")
        XCTAssertEqual(p[1].facilities, "")
    }

    func testRingsFollowTheZoom() {
        // A 390 by 260 map: Walk opens about 3 km tall, Drive about 11 km tall.
        XCTAssertEqual(MasjidExtras.rings(halfWidthKm: 2.25, halfHeightKm: 1.5), [0.5, 1, 2])
        XCTAssertEqual(MasjidExtras.rings(halfWidthKm: 8.25, halfHeightKm: 5.5), [1, 2, 5])
        XCTAssertEqual(MasjidExtras.rings(halfWidthKm: 30, halfHeightKm: 20), [5, 10, 20])
        XCTAssertEqual(MasjidExtras.rings(halfWidthKm: 0.3, halfHeightKm: 0.2), [0.25, 0.5, 1])
        XCTAssertEqual(MasjidExtras.ringDistance(0.5), "500 m")
        XCTAssertEqual(MasjidExtras.ringDistance(2), "2 km")
    }
}
