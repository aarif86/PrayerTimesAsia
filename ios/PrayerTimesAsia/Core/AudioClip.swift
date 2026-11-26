import Foundation

/// Shapes a recording into an alert sound, for "Your own azan": the person picks a
/// file on their phone and it is made into a clip that stays on that phone. We never
/// upload it or ship it to anyone else.
///
/// The same rules as the clip spec in docs/azan.md and Android core AudioClip.kt:
/// - quiet lead-in removed, so the call starts straight away;
/// - at most `maxSeconds` (iPhone plays nothing longer than 30 s as an alert);
/// - a `fadeSeconds` fade at the end, and a tiny fade in so it never clicks;
/// - loudness evened out to about -16 dB, the level of our own azan clips, and
///   never louder than -1 dB at its peak.
///
/// Works on mono samples from -1 to 1.
enum AudioClip {
    static let maxSeconds = 29.0
    static let fadeSeconds = 0.5
    static let fadeInSeconds = 0.01
    static let minSeconds = 1.0
    /// About -16 dB: the loudness our own azan clips are made to (tools/make_azan.sh).
    static let targetRMS: Float = 0.158
    /// About -1 dB.
    static let maxPeak: Float = 0.89
    /// Never boost more than this (about +18 dB), so a near-silent file doesn't turn into hiss.
    static let maxGain: Float = 8
    /// Anything quieter than this (about -34 dB) at the start counts as silence.
    static let silence: Float = 0.02

    struct Clip {
        var samples: [Float]
        var sampleRate: Double
        var wasCut: Bool
        var seconds: Double { Double(samples.count) / sampleRate }
    }

    /// Nil when the file has no sound in it, or less than `minSeconds` of it.
    static func shape(_ input: [Float], sampleRate: Double) -> Clip? {
        guard sampleRate > 0, let first = input.firstIndex(where: { abs($0) > silence }) else { return nil }
        let start = max(0, first - Int(0.05 * sampleRate))
        let maxLen = Int(maxSeconds * sampleRate)
        let wasCut = input.count - start > maxLen
        var out = Array(input[start..<min(input.count, start + maxLen)])
        guard Double(out.count) >= minSeconds * sampleRate else { return nil }

        var sum = 0.0
        var peak: Float = 0
        for s in out { sum += Double(s * s); peak = max(peak, abs(s)) }
        let rms = Float((sum / Double(out.count)).squareRoot())
        guard rms > 0, peak > 0 else { return nil }
        let gain = min(targetRMS / rms, maxPeak / peak, maxGain)
        for i in out.indices { out[i] *= gain }

        let fadeIn = min(Int(fadeInSeconds * sampleRate), out.count)
        for i in 0..<fadeIn { out[i] *= Float(i) / Float(fadeIn) }
        let fade = min(Int(fadeSeconds * sampleRate), out.count)
        for i in 0..<fade {
            out[out.count - fade + i] *= Float(fade - 1 - i) / Float(max(1, fade - 1))
        }
        return Clip(samples: out, sampleRate: sampleRate, wasCut: wasCut)
    }

    /// Several channels, each its own array, made into one.
    static func mono(_ channels: [[Float]]) -> [Float] {
        guard let first = channels.first else { return [] }
        if channels.count == 1 { return first }
        var out = [Float](repeating: 0, count: first.count)
        for ch in channels { for i in 0..<min(out.count, ch.count) { out[i] += ch[i] } }
        let n = Float(channels.count)
        return out.map { $0 / n }
    }
}
