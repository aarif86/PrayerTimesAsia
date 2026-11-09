import XCTest
@testable import PrayerTimesAsia

/// The moving opening screen: every movement ends on the still icon, hands on the real time.
final class OpeningPoseTests: XCTestCase {
    private let clock = OpeningClock(Calendar.current.date(from: DateComponents(year: 2026, month: 11, day: 9, hour: 15, minute: 30))!)

    func testHandsPointAtTheTime() {
        XCTAssertEqual(clock.minute, 180, accuracy: 0.001)
        XCTAssertEqual(clock.hour, 105, accuracy: 0.001)
    }

    func testEveryMovementEndsOnTheStillDial() {
        for move in OpeningMove.allCases {
            let p = OpeningPose(move: move, ms: Double(OpeningPose.lengthMs), clock: clock)
            for (name, value, want) in [("dialScale", p.dialScale, 1.0), ("dialOpacity", p.dialOpacity, 1), ("dialY", p.dialY, 0),
                                        ("ringRot", p.ringRot, 0), ("ringScale", p.ringScale, 1), ("batikRot", p.batikRot, 0),
                                        ("stitchOuterRot", p.stitchOuterRot, 0), ("kaabahScale", p.kaabahScale, 1),
                                        ("centreOpacity", p.centreOpacity, 1), ("nameIn", p.nameIn, 1), ("lineIn", p.lineIn, 1)] {
                XCTAssertEqual(value, want, accuracy: 0.001, "\(move) \(name)")
            }
            XCTAssertEqual(p.hourRot.truncatingRemainder(dividingBy: 360), 105, accuracy: 0.001, "\(move)")
            XCTAssertEqual(p.minuteRot.truncatingRemainder(dividingBy: 360), 180, accuracy: 0.001, "\(move)")
        }
    }

    func testEachMovementStartsSomewhereElse() {
        for move in OpeningMove.allCases {
            let start = OpeningPose(move: move, ms: 0, clock: clock)
            let end = OpeningPose(move: move, ms: 2000, clock: clock)
            let moved = start.dialOpacity != end.dialOpacity || start.ringRot != end.ringRot || start.hourRot != end.hourRot
                || start.batikRot != end.batikRot || start.stitchOuterRot != end.stitchOuterRot || start.kaabahScale != end.kaabahScale
            XCTAssertTrue(moved, "\(move)")
        }
    }
}
