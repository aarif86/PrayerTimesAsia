import AVFoundation
import SwiftUI
import UniformTypeIdentifiers

/// Settings, Your own azan: pick an audio file on this iPhone and prayer time alerts
/// play it. Same page as Android ui/settings/OwnAzanPage.kt. The file never leaves the phone.
struct OwnAzanView: View {
    @Environment(AppModel.self) private var model
    @State private var picking = false
    @State private var busy = false
    @State private var isSet = OwnAzan.isSet
    @State private var note: String?
    @State private var player: AVAudioPlayer?

    var body: some View {
        Form {
            Section {
                if isSet {
                    LabeledContent("Your azan", value: OwnAzan.sourceName ?? "Chosen file")
                    LabeledContent("Length", value: "\(Int(OwnAzan.seconds.rounded())) seconds")
                }
                Button {
                    picking = true
                } label: {
                    Label(busy ? "Preparing your azan…" : isSet ? "Choose a different file" : "Choose an audio file",
                          systemImage: "folder")
                }
                .disabled(busy)
                if isSet {
                    Button {
                        if player != nil { stop() } else { play() }
                    } label: {
                        Label(player != nil ? "Stop" : "Play", systemImage: player != nil ? "stop.fill" : "play.fill")
                    }
                    Button(role: .destructive) {
                        stop()
                        OwnAzan.remove()
                        isSet = false
                        note = "Removed. Alerts use the app's azan again."
                        model.scheduleNotifications()
                    } label: {
                        Label("Go back to the app's azan", systemImage: "trash")
                    }
                }
            } footer: {
                Text("Pick an azan recording saved on this iPhone or in Files. We use the start of it, up to \(Int(AudioClip.maxSeconds)) seconds, with a soft fade at the end, and even out the volume. iPhone does not play alert sounds longer than 30 seconds. The file stays on this phone. We never upload it or share it.")
            }
            if let note {
                Section { Text(note) }
            }
            Section {
            } footer: {
                Text("Only use a recording you have the right to use, such as one you or your masjid recorded. It plays for every prayer, Fajr too, when \"Play the azan\" is on in Alerts and alarms.")
            }
        }
        .fileImporter(isPresented: $picking, allowedContentTypes: [.audio]) { result in
            guard case .success(let url) = result else { return }
            stop()
            busy = true
            note = nil
            Task {
                let outcome = await Task.detached(priority: .userInitiated) { OwnAzan.importFile(from: url) }.value
                busy = false
                isSet = OwnAzan.isSet
                switch outcome {
                case .saved(let seconds, let wasCut):
                    // Picking a file means they want to hear it.
                    model.prefs.azanSound = true
                    model.scheduleNotifications()
                    note = wasCut
                        ? "Saved. Your iPhone plays the first \(Int(seconds.rounded())) seconds, with a soft fade at the end."
                        : "Saved. It is \(Int(seconds.rounded())) seconds long."
                case .noSound:
                    note = "That file has no sound we could use. Try another one."
                case .unreadable:
                    note = "This iPhone could not open that file. Try an MP3, M4A or WAV."
                }
            }
        }
        .onDisappear { stop() }
        .settingsPage("Your own azan")
    }

    private func play() {
        guard let url = OwnAzan.fileURL, let p = try? AVAudioPlayer(contentsOf: url) else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback)
        p.play()
        player = p
        // Clear the Stop button when it ends (clips are at most 29 s).
        DispatchQueue.main.asyncAfter(deadline: .now() + p.duration + 0.2) { if player === p { player = nil } }
    }

    private func stop() {
        player?.stop()
        player = nil
    }
}
