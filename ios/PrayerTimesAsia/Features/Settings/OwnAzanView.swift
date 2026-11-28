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
                    LabeledContent(W("phone.azan.yours"), value: OwnAzan.sourceName ?? W("phone.common.chosenFile"))
                    LabeledContent(W("alerts.azanLength"), value: "\(Int(OwnAzan.seconds.rounded())) seconds")
                }
                Button {
                    picking = true
                } label: {
                    Label(busy ? W("phone.azan.preparing") : isSet ? W("phone.azan.chooseOther") : W("phone.azan.chooseFile"),
                          systemImage: "folder")
                }
                .disabled(busy)
                if isSet {
                    Button {
                        if player != nil { stop() } else { play() }
                    } label: {
                        Label(player != nil ? W("alerts.azanStop") : W("phone.common.play"), systemImage: player != nil ? "stop.fill" : "play.fill")
                    }
                    Button(role: .destructive) {
                        stop()
                        OwnAzan.remove()
                        isSet = false
                        note = W("phone.azan.removed")
                        model.scheduleNotifications()
                    } label: {
                        Label(W("phone.azan.goBack"), systemImage: "trash")
                    }
                }
            } footer: {
                Text(W("phone.azan.pick", ["n": Int(AudioClip.maxSeconds)]))
            }
            if let note {
                Section { Text(note) }
            }
            Section {
            } footer: {
                Text(W("phone.azan.rights"))
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
                        ? W("phone.azan.savedFirst", ["n": Int(seconds.rounded())])
                        : W("phone.azan.savedLong", ["n": Int(seconds.rounded())])
                case .noSound:
                    note = W("phone.azan.noSound")
                case .unreadable:
                    note = W("phone.azan.cannotOpen")
                }
            }
        }
        .onDisappear { stop() }
        .settingsPage(W("phone.azan.own"))
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
