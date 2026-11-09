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
            let checks: [(String, Double, Double)] = [("dialScale", p.dialScale, 1.0), ("dialOpacity", p.dialOpacity, 1), ("dialY", p.dialY, 0),
                                        ("dialRot", p.dialRot, 0), ("dialFlip", p.dialFlip, 1), ("stitchOpacity", p.stitchOpacity, 1),
                                        ("marksOpacity", p.marksOpacity, 1), ("faceOpacity", p.faceOpacity, 1), ("handsOpacity", p.handsOpacity, 1),
                                        ("ringRot", p.ringRot, 0), ("ringScale", p.ringScale, 1), ("batikRot", p.batikRot, 0),
                                        ("stitchOuterRot", p.stitchOuterRot, 0), ("kaabahScale", p.kaabahScale, 1),
                                        ("centreOpacity", p.centreOpacity, 1), ("nameIn", p.nameIn, 1), ("lineIn", p.lineIn, 1)]
            for (name, value, want) in checks {
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

    func testTheHandsMoveInEveryMovement() {
        for move in OpeningMove.allCases {
            let start = OpeningPose(move: move, ms: 0, clock: clock), half = OpeningPose(move: move, ms: 700, clock: clock)
            XCTAssertNotEqual(start.minuteRot, half.minuteRot, accuracy: 0.001, "\(move)")
        }
    }

    func testEveryMovementComesRoundBeforeAnyRepeats() {
        var bag: [Int] = [], last: Int? = nil, seen: [OpeningMove] = []
        for _ in 0..<(OpeningMove.allCases.count * 20) {
            let (move, rest) = OpeningMove.next(bag: bag, last: last)
            XCTAssertNotEqual(move.rawValue, last)
            seen.append(move); bag = rest; last = move.rawValue
        }
        for round in stride(from: 0, to: seen.count, by: OpeningMove.allCases.count) {
            XCTAssertEqual(Set(seen[round..<round + OpeningMove.allCases.count]).count, OpeningMove.allCases.count)
        }
    }
}
