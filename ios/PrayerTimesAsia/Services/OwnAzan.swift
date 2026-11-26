import AVFoundation
import Foundation

/// "Your own azan": the person picks an audio file on their iPhone, and it becomes the
/// sound of their prayer time alerts. The file is shaped by `AudioClip` (quiet start
/// removed, at most 29 s, 0.5 s fade, loudness evened out) and saved as Linear PCM
/// .caf in Library/Sounds, where iOS looks for notification sounds. It stays on this
/// phone: we never upload it, and it is not in the app for anyone else.
///
/// Each new file gets a new name, because iOS can keep playing an old sound that
/// had the same name. Same feature as Android alarms/OwnAzan.kt.
enum OwnAzan {
    enum Result: Equatable, Sendable {
        case saved(seconds: Double, wasCut: Bool)
        /// The file had no sound we could use, or less than a second of it.
        case noSound
        /// The phone could not open or read the file.
        case unreadable
    }

    private static let fileKey = "ownAzanFile"
    private static let nameKey = "ownAzanName"
    private static let secondsKey = "ownAzanSeconds"
    /// Read only this much of a long file: enough for a quiet start plus the clip.
    private static let readSeconds = 45.0

    private static var defaults: UserDefaults { .standard }

    static var soundsFolder: URL {
        FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0].appendingPathComponent("Sounds", isDirectory: true)
    }

    /// The file name iOS plays (in Library/Sounds), or nil when none is set.
    static var soundName: String? {
        guard let name = defaults.string(forKey: fileKey),
              FileManager.default.fileExists(atPath: soundsFolder.appendingPathComponent(name).path) else { return nil }
        return name
    }

    static var isSet: Bool { soundName != nil }

    static var fileURL: URL? { soundName.map { soundsFolder.appendingPathComponent($0) } }

    /// The name of the file they picked, for the Settings page.
    static var sourceName: String? { defaults.string(forKey: nameKey) }

    static var seconds: Double { defaults.double(forKey: secondsKey) }

    /// Reads, shapes and saves the picked file. Call off the main thread.
    static func importFile(from url: URL) -> Result {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        let samples: [Float]
        let rate: Double
        do {
            let file = try AVAudioFile(forReading: url)
            let format = file.processingFormat
            rate = format.sampleRate
            let frames = AVAudioFrameCount(min(file.length, AVAudioFramePosition(readSeconds * rate)))
            guard frames > 0, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames) else { return .noSound }
            try file.read(into: buffer, frameCount: frames)
            guard let data = buffer.floatChannelData else { return .unreadable }
            let n = Int(buffer.frameLength)
            let channels = (0..<Int(format.channelCount)).map { Array(UnsafeBufferPointer(start: data[$0], count: n)) }
            samples = AudioClip.mono(channels)
        } catch {
            return .unreadable
        }
        guard let clip = AudioClip.shape(samples, sampleRate: rate) else { return .noSound }

        let name = "own-azan-\(Int(Date().timeIntervalSince1970)).caf"
        do {
            try FileManager.default.createDirectory(at: soundsFolder, withIntermediateDirectories: true)
            try write(clip, to: soundsFolder.appendingPathComponent(name))
        } catch {
            return .unreadable
        }
        removeFile()
        defaults.set(name, forKey: fileKey)
        defaults.set(url.deletingPathExtension().lastPathComponent, forKey: nameKey)
        defaults.set(clip.seconds, forKey: secondsKey)
        return .saved(seconds: clip.seconds, wasCut: clip.wasCut)
    }

    /// Back to the app's own azan (or the phone's sound when the app has none).
    static func remove() {
        removeFile()
        for key in [fileKey, nameKey, secondsKey] { defaults.removeObject(forKey: key) }
    }

    private static func removeFile() {
        guard let old = defaults.string(forKey: fileKey) else { return }
        try? FileManager.default.removeItem(at: soundsFolder.appendingPathComponent(old))
    }

    /// 16-bit mono Linear PCM in a .caf, which iOS accepts as an alert sound.
    private static func write(_ clip: AudioClip.Clip, to url: URL) throws {
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: clip.sampleRate,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsBigEndianKey: false,
        ]
        let out = try AVAudioFile(forWriting: url, settings: settings, commonFormat: .pcmFormatFloat32, interleaved: false)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: out.processingFormat, frameCapacity: AVAudioFrameCount(clip.samples.count)),
              let channel = buffer.floatChannelData?[0] else { throw CocoaError(.fileWriteUnknown) }
        clip.samples.withUnsafeBufferPointer { src in
            channel.update(from: src.baseAddress!, count: clip.samples.count)
        }
        buffer.frameLength = AVAudioFrameCount(clip.samples.count)
        try out.write(from: buffer)
    }
}
