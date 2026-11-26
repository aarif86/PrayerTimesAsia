import XCTest
@testable import PrayerTimesAsia

/// "Your own azan": how a picked file is made into an alert sound. Same cases as Android AudioClipTest.kt.
final class AudioClipTests: XCTestCase {
    private let rate = 8000.0

    private func tone(_ seconds: Double, _ level: Float, silenceBefore: Double = 0) -> [Float] {
        let lead = Int(silenceBefore * rate)
        let n = Int(seconds * rate)
        return (0..<(lead + n)).map { i in i < lead ? 0 : level * Float(sin(2 * Double.pi * 440 * Double(i - lead) / rate)) }
    }

    private func rms(_ a: [Float], _ from: Int, _ to: Int) -> Float {
        var s = 0.0
        for i in from..<to { s += Double(a[i] * a[i]) }
        return Float((s / Double(to - from)).squareRoot())
    }

    func testLongFileIsCutToUnderThirtySeconds() throws {
        let clip = try XCTUnwrap(AudioClip.shape(tone(180, 0.3), sampleRate: rate))
        XCTAssertTrue(clip.wasCut)
        XCTAssertEqual(clip.seconds, AudioClip.maxSeconds, accuracy: 0.01)
    }

    func testShortFileIsKeptWhole() throws {
        let clip = try XCTUnwrap(AudioClip.shape(tone(12, 0.3), sampleRate: rate))
        XCTAssertFalse(clip.wasCut)
        XCTAssertEqual(clip.seconds, 12, accuracy: 0.01)
    }

    func testQuietStartIsRemoved() throws {
        let clip = try XCTUnwrap(AudioClip.shape(tone(10, 0.3, silenceBefore: 3), sampleRate: rate))
        XCTAssertEqual(clip.seconds, 10.05, accuracy: 0.01)
    }

    func testEndsWithAFadeToSilence() throws {
        let clip = try XCTUnwrap(AudioClip.shape(tone(10, 0.3), sampleRate: rate))
        XCTAssertEqual(clip.samples.last ?? 1, 0, accuracy: 1e-6)
        let fade = Int(AudioClip.fadeSeconds * rate), n = clip.samples.count, r = Int(rate)
        XCTAssertLessThan(rms(clip.samples, n - fade / 5, n), rms(clip.samples, n - fade - r, n - fade) / 4)
    }

    func testQuietRecordingIsRaisedToTheSameLevelAsOurClips() throws {
        let clip = try XCTUnwrap(AudioClip.shape(tone(10, 0.05), sampleRate: rate))
        XCTAssertEqual(rms(clip.samples, Int(rate), 5 * Int(rate)), AudioClip.targetRMS, accuracy: 0.01)
    }

    func testLoudRecordingIsNeverLouderThanTheCap() throws {
        let clip = try XCTUnwrap(AudioClip.shape(tone(10, 1), sampleRate: rate))
        XCTAssertTrue(clip.samples.allSatisfy { abs($0) <= AudioClip.maxPeak + 1e-4 })
    }

    func testSilentOrTooShortFilesAreRefused() {
        XCTAssertNil(AudioClip.shape([Float](repeating: 0, count: Int(rate) * 5), sampleRate: rate))
        XCTAssertNil(AudioClip.shape(tone(0.5, 0.3), sampleRate: rate))
    }

    func testStereoIsMadeMono() {
        let m = AudioClip.mono([[0.2, -0.2], [0.4, 0.2]])
        XCTAssertEqual(m.count, 2)
        XCTAssertEqual(m[0], 0.3, accuracy: 1e-6)
        XCTAssertEqual(m[1], 0, accuracy: 1e-6)
    }
}
