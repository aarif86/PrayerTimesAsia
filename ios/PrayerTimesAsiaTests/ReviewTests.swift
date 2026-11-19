import XCTest
@testable import PrayerTimesAsia

final class ReviewTests: XCTestCase {
    func testAppStoreButtonOnlyOnceLive() {
        XCTAssertEqual(Reviews.links(appStoreID: "").map(\.id), ["google"])
        XCTAssertEqual(Reviews.links(appStoreID: "123").map(\.id), ["appstore", "google"])
        XCTAssertEqual(Reviews.links(appStoreID: "123").first?.url.absoluteString, "https://apps.apple.com/app/id123?action=write-review")
        XCTAssertEqual(Reviews.googleReview.absoluteString, "https://g.page/r/CSq5hZxhRs1BEBM/review")
    }

    func testNoteEmail() {
        let kind = NoteView.email(kind: .kind, text: " Thank you ", details: "Version 1, iPhone", mayShare: true)
        XCTAssertEqual(kind.subject, "A kind word | Prayer Times Asia")
        XCTAssertEqual(kind.body, "Thank you\n\nYou may share these words on the website, without my name.\n\nVersion 1, iPhone\n")
        let idea = NoteView.email(kind: .idea, text: "", details: nil, mayShare: true)
        XCTAssertEqual(idea.body, "(no words)\n")
    }
}
