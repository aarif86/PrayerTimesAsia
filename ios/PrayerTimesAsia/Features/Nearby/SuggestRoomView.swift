import SwiftUI
import UIKit

/// "Suggest a prayer room": a musollah or prayer room missing from the Masjid tab.
/// No sign in and no server: it opens the site note page, filled in, to
/// salam@prayertimes.asia. Same lines as the web and Android apps.
enum RoomSuggestion {
    enum Has: String, CaseIterable, Identifiable {
        case women, shared, aircon, mats, garments, ablution, slippers
        var id: String { rawValue }
        var label: String {
            switch self {
            case .women: "Women's space"
            case .shared: "One space for men and women"
            case .aircon: "Air conditioned"
            case .mats: "Prayer mats"
            case .garments: "Telekung and sarong"
            case .ablution: "Place for wudhu"
            case .slippers: "Slippers"
            }
        }
    }

    private static func at(_ c: Coordinates) -> String { String(format: "%.5f, %.5f", c.latitude, c.longitude) }

    /// [pin] is where the person stood; [near] the area the tab showed.
    static func email(name: String, level: String, address: String, directions: String, remarks: String,
                      has: Set<Has>, pin: Coordinates?, near: Coordinates?, details: String) -> (subject: String, body: String) {
        func t(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }
        var lines = ["Place: \(t(name))"]
        if !t(level).isEmpty { lines.append("Level: \(t(level))") }
        if !t(address).isEmpty { lines.append("Address: \(t(address))") }
        if !t(directions).isEmpty { lines.append("How to find it: \(t(directions))") }
        if !has.isEmpty { lines.append("Has: " + Has.allCases.filter(has.contains).map(\.label).joined(separator: ", ")) }
        if !t(remarks).isEmpty { lines.append("Remarks: \(t(remarks))") }
        if let pin {
            let la = String(format: "%.5f", pin.latitude), lo = String(format: "%.5f", pin.longitude)
            lines.append("Pin (I was there): \(at(pin)) https://www.openstreetmap.org/?mlat=\(la)&mlon=\(lo)#map=19/\(la)/\(lo)")
        } else if let near {
            lines.append("Near: \(at(near))")
        }
        lines += ["", details]
        let body = lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines) + "\n"
        return ("Suggest a prayer room: \(t(name).isEmpty ? "no name" : t(name)) | Prayer Times Asia", body)
    }

    static func ready(name: String, address: String, pin: Coordinates?) -> Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (!address.trimmingCharacters(in: .whitespaces).isEmpty || pin != nil)
    }
}

struct SuggestRoomView: View {
    /// The area the Masjid tab shows.
    let near: Coordinates?
    /// A fresh fix from Near me, offered as the room's pin.
    let live: Coordinates?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var name = ""
    @State private var level = ""
    @State private var address = ""
    @State private var directions = ""
    @State private var remarks = ""
    @State private var has = Set<RoomSuggestion.Has>()
    @State private var usePin = false
    @State private var copied = false

    private var mail: (subject: String, body: String) {
        RoomSuggestion.email(name: name, level: level, address: address, directions: directions, remarks: remarks,
                             has: has, pin: usePin ? live : nil, near: near, details: "Version \(Bundle.main.appVersion), iPhone")
    }
    private var ready: Bool { RoomSuggestion.ready(name: name, address: address, pin: usePin ? live : nil) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Know a musollah or prayer room that is not on our map? Tell us about it. We check every one and then add it for everyone.")
                        .font(.subheadline)
                }
                Section("Place name") { TextField("For example Pasir Ris Mall", text: $name) }
                Section("Floor or level") { TextField("For example Level 3 or B1", text: $level) }
                Section("Address") { TextField("Address", text: $address, axis: .vertical).lineLimit(1...3) }
                Section("How to find it") {
                    TextField("For example next to the toilets near the car park lift", text: $directions, axis: .vertical).lineLimit(2...5)
                }
                Section {
                    if live != nil {
                        Toggle("I am at the prayer room now", isOn: $usePin)
                    }
                } header: {
                    Text("Where it is on the map")
                } footer: {
                    Text(live != nil
                         ? "Only if you are standing at the room. Your location is added to this email once and is not kept anywhere else."
                         : "Standing at the room? Close this, tap Near me, then come back to add a pin. Otherwise an address is enough.")
                }
                Section("What is there") {
                    ForEach(RoomSuggestion.Has.allCases) { h in
                        Toggle(h.label, isOn: Binding(get: { has.contains(h) }, set: { if $0 { has.insert(h) } else { has.remove(h) } }))
                    }
                }
                Section("Anything else") {
                    TextField("Opening hours, or who may use it", text: $remarks, axis: .vertical).lineLimit(2...5)
                }
                Section {
                    Button { send() } label: { Label("Send your suggestion", systemImage: "paperplane.fill").bold() }
                        .disabled(!ready)
                    if ready {
                        Button { copyNote() } label: { Label(copied ? "Copied" : "No email app? Copy the note", systemImage: "doc.on.doc") }
                    }
                } footer: {
                    Text(ready ? "It opens our note page with your words filled in. Add your email there so we can thank you. JazakAllahu khairan for helping others find a place to pray."
                               : "Add the place name and either the address or a pin.")
                }
            }
            .onChange(of: mail.body) { _, _ in copied = false }
            .navigationTitle("Suggest a prayer room")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
    }

    private func send() {
        if let url = Reviews.noteURL(about: "Suggest a prayer room", note: mail.body, place: name) { openURL(url) }
    }

    private func copyNote() {
        UIPasteboard.general.string = "To \(Reviews.feedbackEmail)\n\(mail.subject)\n\n\(mail.body)"
        copied = true
    }
}
