import XCTest
@testable import PrayerTimesAsia

/// Same email as the web (tests/suggestRoom.test.ts) and Android (RoomSuggestionTest).
final class RoomSuggestionTests: XCTestCase {
    func testEmailListsOnlyWhatWasFilledIn() {
        let m = RoomSuggestion.email(name: " Pasir Ris Mall ", level: "3", address: "", directions: "Next to the toilets", remarks: "",
                                     has: [.ablution, .women], pin: Coordinates(latitude: 1.3734561, longitude: 103.9499123),
                                     near: Coordinates(latitude: 1.37, longitude: 103.95), details: "Version 1, iPhone")
        XCTAssertEqual(m.subject, "Suggest a prayer room: Pasir Ris Mall | Prayer Times Asia")
        XCTAssertTrue(m.body.hasPrefix("Place: Pasir Ris Mall\nLevel: 3\nHow to find it: Next to the toilets\nHas: Women's space, Place for wudhu\n"))
        XCTAssertTrue(m.body.contains("mlat=1.37346&mlon=103.94991"))
        XCTAssertFalse(m.body.contains("Near"))
    }

    func testNeedsANameAndAnAddressOrPin() {
        XCTAssertFalse(RoomSuggestion.ready(name: "X", address: "", pin: nil))
        XCTAssertTrue(RoomSuggestion.ready(name: "X", address: "1 Road", pin: nil))
    }
}
