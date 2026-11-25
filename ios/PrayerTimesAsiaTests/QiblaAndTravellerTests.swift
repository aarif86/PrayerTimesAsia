import XCTest
@testable import PrayerTimesAsia

/// Same cases as the Qibla and distance tests in web/tests, plus the traveller rules.
final class QiblaAndTravellerTests: XCTestCase {
    private let singapore = Coordinates(latitude: 1.3521, longitude: 103.8198)

    func testQiblaFromWellKnownCities() {
        XCTAssertEqual(Geo.qiblaBearing(from: singapore), 293, accuracy: 0.5)
        XCTAssertEqual(Geo.qiblaBearing(from: Coordinates(latitude: 51.5074, longitude: -0.1278)), 118.9, accuracy: 0.5)
        XCTAssertEqual(Geo.qiblaBearing(from: Coordinates(latitude: 40.7128, longitude: -74.006)), 58.5, accuracy: 0.5)
        XCTAssertEqual(Geo.qiblaBearing(from: Coordinates(latitude: -33.8688, longitude: 151.2093)), 277, accuracy: 0.5)
    }

    func testBearingStaysInRangeAtTheDateLineAndPoles() {
        for (lat, lng) in [(0.0, 179.9), (0.0, -179.9), (89.9, 0.0), (-89.9, 100.0), (21.4225, 39.8262)] {
            let b = Geo.qiblaBearing(from: Coordinates(latitude: lat, longitude: lng))
            XCTAssertGreaterThanOrEqual(b, 0)
            XCTAssertLessThan(b, 360)
            XCTAssertTrue(b.isFinite)
        }
    }

    func testDistanceIsInKmAndTheSameBothWays() {
        XCTAssertEqual(Geo.distanceKm(Geo.kaaba, Geo.kaaba), 0, accuracy: 0.0001)
        let d = Geo.distanceKm(singapore, Geo.kaaba)
        XCTAssertGreaterThan(d, 7200)
        XCTAssertLessThan(d, 7350)
        XCTAssertEqual(d, Geo.distanceKm(Geo.kaaba, singapore), accuracy: 0.000001)
        let north = Geo.bearing(from: Coordinates(latitude: 0, longitude: 0), to: Coordinates(latitude: 10, longitude: 0))
        XCTAssertEqual(north, 0, accuracy: 0.000001)
    }

    func testCompassPointsAndShortWayRound() {
        XCTAssertEqual(Geo.compassPoint(0), "N")
        XCTAssertEqual(Geo.compassPoint(359), "N")
        XCTAssertEqual(Geo.compassPoint(293), "WNW")
        XCTAssertEqual(Geo.compassPoint(-90), "W")
        XCTAssertEqual(Geo.angleDelta(350, 10), -20, accuracy: 0.000001)
        XCTAssertEqual(Geo.angleDelta(10, 350), 20, accuracy: 0.000001)
        XCTAssertEqual(Geo.angleDelta(180, 0), 180, accuracy: 0.000001)
    }

    func testTravellerStatusFollowsDistanceAndDays() {
        let rules = Musafir.Rules(school: .standard, thresholdKm: 81)
        let home = Coordinates(latitude: 1.3521, longitude: 103.8198)
        // About 111 km north of home
        let far = Coordinates(latitude: 2.3521, longitude: 103.8198)
        // About 22 km north of home
        let near = Coordinates(latitude: 1.5521, longitude: 103.8198)

        XCTAssertNil(Musafir.status(home: nil, current: far, daysHere: 0, rules: rules))
        XCTAssertEqual(Musafir.status(home: home, current: home, daysHere: 0, rules: rules), .home)
        if case .nearby = Musafir.status(home: home, current: near, daysHere: 0, rules: rules)! {} else { XCTFail("near") }
        XCTAssertTrue(Musafir.status(home: home, current: far, daysHere: 3, rules: rules)!.isTraveller)
        if case .settled = Musafir.status(home: home, current: far, daysHere: 4, rules: rules)! {} else { XCTFail("settled after 3 days") }
    }

    func testHanafiStaysLongerAndNeverJoins() {
        let hanafi = Musafir.Rules(school: .hanafi, thresholdKm: 78)
        let shafii = Musafir.Rules(school: .standard, thresholdKm: 81)
        XCTAssertEqual(hanafi.maxStayDays, 15)
        XCTAssertEqual(shafii.maxStayDays, 3)
        XCTAssertFalse(hanafi.allowsJamak)
        XCTAssertTrue(shafii.allowsJamak)
        let plan = Musafir.plan(rules: hanafi, naming: .international)
        XCTAssertEqual(plan.count, 5)
        XCTAssertTrue(plan.allSatisfy { !$0.join.hasPrefix("Can join") })
    }
}
