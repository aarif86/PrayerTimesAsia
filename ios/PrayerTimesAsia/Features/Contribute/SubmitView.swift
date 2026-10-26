import PhotosUI
import SwiftUI

/// Community submissions ("Lapor Waktu"): a mosque timetable photo, the method
/// local mosques use, or an adhan time heard. Sent to the `submit` Cloud
/// Function for review; only what's typed or picked here is sent - never GPS.
struct SubmitView: View {
    enum Kind: String, CaseIterable, Identifiable {
        case timetable = "Timetable", method = "Method", spotcheck = "Adhan heard"
        var id: String { rawValue }
    }

    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State var kind: Kind

    @State private var place = ""
    @State private var mosque = ""
    @State private var mapsLink = ""
    @State private var jamaah = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var photo: UIImage?
    @State private var method = "MWL"
    @State private var asr = "unsure"
    @State private var how = ""
    @State private var prayer = Prayer.fajr
    @State private var heardAt = Date.now
    @State private var note = ""
    @State private var consent = false
    @State private var sending = false
    @State private var result: String?
    @State private var failed = false

    private static let methods: [(id: String, label: String)] = [
        ("MUIS", "MUIS (Singapore)"), ("JAKIM", "JAKIM (Malaysia)"), ("Kemenag", "Kemenag (Indonesia)"),
        ("MWL", "Muslim World League (18°/17°)"), ("Karachi", "Karachi (18°/18°)"),
        ("UmmAlQura", "Umm al-Qura"), ("Diyanet", "Diyanet (Türkiye)"), ("Other", "Other / not sure"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Sending", selection: $kind) {
                        ForEach(Kind.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    TextField("City, area, country", text: $place)
                } header: {
                    Text("Where")
                }

                switch kind {
                case .timetable: timetableFields
                case .method: methodFields
                case .spotcheck: spotFields
                }

                Section {
                    TextField("Anything else (optional)", text: $note, axis: .vertical).lineLimit(2...5)
                }

                Section {
                    Toggle("Share under CC-BY 4.0", isOn: $consent)
                } footer: {
                    Text("Checked by a person before it changes anyone's times. Only what you type or pick here is sent - not your location. Photos are kept as evidence and not republished without the mosque's permission.")
                }
            }
            .navigationTitle("Help verify times")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    if sending { ProgressView() } else {
                        Button("Send") { Task { await send() } }.disabled(!isValid)
                    }
                }
            }
            .onAppear(perform: prefill)
            .onChange(of: photoItem) { _, item in
                Task {
                    if let data = try? await item?.loadTransferable(type: Data.self) { photo = UIImage(data: data) }
                }
            }
            .alert(failed ? "Couldn't send" : "Thank you", isPresented: Binding(
                get: { result != nil }, set: { if !$0 { if !failed { dismiss() }; result = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(result ?? "")
            }
        }
    }

    @ViewBuilder private var timetableFields: some View {
        Section {
            TextField("Mosque or musolla name", text: $mosque)
            TextField("Map link or address (optional)", text: $mapsLink)
                .textInputAutocapitalization(.never).keyboardType(.URL)
            PhotosPicker(selection: $photoItem, matching: .images) {
                Label(photo == nil ? "Choose timetable photo" : "Change photo", systemImage: "photo.on.rectangle")
            }
            if let photo {
                Image(uiImage: photo).resizable().scaledToFit().frame(maxHeight: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            TextField("Jamaah / Jumu'ah times if shown (optional)", text: $jamaah, axis: .vertical).lineLimit(1...4)
        } header: {
            Text("Mosque timetable")
        } footer: {
            Text("One month is enough - we work out the mosque's method so the whole year can be generated.")
        }
    }

    @ViewBuilder private var methodFields: some View {
        Section("Mosques here follow") {
            Picker("Method", selection: $method) {
                ForEach(Self.methods, id: \.id) { Text($0.label).tag($0.id) }
            }
            Picker("Asr", selection: $asr) {
                Text("Earlier (Shafi'i)").tag("shafii")
                Text("Later (Hanafi)").tag("hanafi")
                Text("Not sure").tag("unsure")
            }
            TextField("How do you know?", text: $how, axis: .vertical).lineLimit(2...5)
        }
    }

    @ViewBuilder private var spotFields: some View {
        Section("What you heard") {
            TextField("Mosque name", text: $mosque)
            Picker("Prayer", selection: $prayer) {
                ForEach(Prayer.obligatory) { Text($0.name(model.naming)).tag($0) }
            }
            DatePicker("Adhan called at", selection: $heardAt, in: ...Date.now)
        }
    }

    private var isValid: Bool {
        guard consent, !place.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        switch kind {
        case .timetable: return !mosque.isEmpty && photo != nil
        case .method: return !how.isEmpty
        case .spotcheck: return !mosque.isEmpty
        }
    }

    private func prefill() {
        guard place.isEmpty, let p = model.activePlace else { return }
        place = [p.name, p.district ?? p.region, p.countryName].compactMap { $0 }
            .reduce(into: [String]()) { if !$0.contains($1) { $0.append($1) } }
            .joined(separator: ", ")
    }

    private func send() async {
        sending = true
        defer { sending = false }
        var body: [String: Any] = [
            "type": kind == .spotcheck ? "spotcheck" : kind == .method ? "method" : "timetable",
            "consent": consent,
            "place": place,
            "countryCode": model.activePlace?.countryCode ?? "",
            "appMethod": "\(model.method.name) (\(model.method.parameterSummary))",
            "appVersion": Bundle.main.appVersion,
            "note": note,
        ]
        switch kind {
        case .timetable:
            body["mosque"] = mosque
            body["mapsLink"] = mapsLink
            body["jamaah"] = jamaah
            body["photo"] = photo.flatMap(Submissions.jpegForUpload)?.base64EncodedString()
        case .method:
            body["method"] = method
            body["asr"] = asr
            body["how"] = how
        case .spotcheck:
            body["mosque"] = mosque
            body["prayer"] = prayer.rawValue
            body["heardAt"] = ISO8601DateFormatter().string(from: heardAt)
        }
        switch await Submissions.send(body) {
        case .success(let id):
            failed = false
            result = "Your submission (\(id.prefix(6))) is in the review queue. JazakAllahu khairan."
        case .failure(let message):
            failed = true
            result = message
        }
    }
}

enum Submissions {
    static let endpoint = URL(string: "https://asia-southeast1-prayertimes-asia.cloudfunctions.net/submit")!

    enum Outcome { case success(String), failure(String) }

    /// Random per-install token, only used (hashed, server side) for rate limiting.
    static var installToken: String {
        if let t = UserDefaults.standard.string(forKey: "install.token") { return t }
        let t = UUID().uuidString
        UserDefaults.standard.set(t, forKey: "install.token")
        return t
    }

    /// Longest side 1600 px, JPEG - a readable timetable well under the 3 MB limit.
    static func jpegForUpload(_ image: UIImage) -> Data? {
        let maxSide: CGFloat = 1600
        let scale = min(1, maxSide / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let resized = UIGraphicsImageRenderer(size: size).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        return resized.jpegData(compressionQuality: 0.75)
    }

    static func send(_ body: [String: Any]) async -> Outcome {
        var request = URLRequest(url: endpoint, timeoutInterval: 60)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(installToken, forHTTPHeaderField: "x-install-token")
        guard let json = try? JSONSerialization.data(withJSONObject: body) else { return .failure("Couldn't prepare the submission.") }
        request.httpBody = json
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            if (response as? HTTPURLResponse)?.statusCode == 201, let id = object?["id"] as? String {
                return .success(id)
            }
            return .failure(object?["error"] as? String ?? "The server couldn't accept it. Please try again later.")
        } catch {
            return .failure("No connection. Please try again when you're online.")
        }
    }
}
