import CoreImage.CIFilterBuiltins
import SwiftUI
import VisionKit

/// Settings › Move my settings: a QR code (and link) holding everything the
/// user chose, for their next phone. Nothing is uploaded.
struct MoveOutView: View {
    @Environment(AppModel.self) private var model
    @State private var copied = false

    var body: some View {
        let moved = MovedSettings(model.prefs)
        let qr = moved.qrLink()
        Form {
            Section {
                VStack(spacing: 16) {
                    Text("Your places, choices and tracker history, packed into one code. Nothing is uploaded: the settings are inside the code itself.")
                        .font(.subheadline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if let image = Self.qrImage(qr.link) {
                        Image(uiImage: image)
                            .interpolation(.none)
                            .resizable()
                            .scaledToFit()
                            .frame(maxWidth: 260)
                            .padding(10)
                            .background(.white, in: RoundedRectangle(cornerRadius: 12))
                            .accessibilityLabel("QR code with your settings")
                    }
                }
                .padding(.vertical, 6)
            } footer: {
                VStack(alignment: .leading, spacing: 6) {
                    Text("On the other phone, open Prayer Times Asia › Settings › Bring in settings and scan this code. No app there? Point its camera at the code: it opens the web app with your settings.")
                    if let kept = qr.keptDays {
                        Text("The QR code carries your last \(kept) days of tracker history. To bring all of it, share the link instead.")
                    }
                }
            }

            Section {
                ShareLink(item: URL(string: moved.link)!, subject: Text("My Prayer Times Asia settings")) {
                    Label("Share link", systemImage: "square.and.arrow.up")
                }
                Button {
                    UIPasteboard.general.string = moved.link
                    copied = true
                } label: {
                    Label(copied ? "Copied" : "Copy link", systemImage: copied ? "checkmark" : "doc.on.doc")
                }
            } footer: {
                Text("The code includes your saved places, so only send it to yourself.")
            }
        }
        .scrollContentBackground(.hidden)
        .background(SkyNow())
        .navigationTitle("Move my settings")
        .navigationBarTitleDisplayMode(.inline)
    }

    static func qrImage(_ text: String) -> UIImage? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(text.utf8)
        filter.correctionLevel = "L"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 8, y: 8)),
              let cg = CIContext().createCGImage(output, from: output.extent) else { return nil }
        return UIImage(cgImage: cg)
    }
}

/// Settings › Bring in settings: scan the other phone's QR code, or paste its link.
struct MoveInView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var scanning = false
    @State private var done = false
    /// A sheet of its own (from onboarding) rather than a page in Settings.
    var isSheet = false

    private var moved: MovedSettings? { MovedSettings(code: text) }

    var body: some View {
        Form {
            if done {
                Section {
                    Text("Your settings are here.").font(.headline)
                } footer: {
                    Text("Prayer alerts need permission on each phone: turn them on in Settings › Alerts.")
                }
            } else {
                Section {
                    if DataScannerViewController.isSupported {
                        Button { scanning = true } label: { Label("Scan the QR code", systemImage: "qrcode.viewfinder") }
                    }
                    PasteButton(payloadType: String.self) { strings in
                        if let s = strings.first { text = s }
                    }
                    TextField("Or type or paste the link", text: $text, axis: .vertical)
                        .lineLimit(1...4)
                        .font(.footnote.monospaced())
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } footer: {
                    Text("On your other phone or browser, open Settings › Move my settings. It shows a QR code and a link.")
                }

                if !text.isEmpty {
                    if let moved {
                        Section {
                            ForEach(moved.summary, id: \.self) { Text($0) }
                            Button("Bring in settings") { bringIn(moved) }
                                .font(.headline)
                        } header: {
                            Text("This will bring in")
                        } footer: {
                            Text("Your settings here are replaced. Tracker history is added to what's already here.")
                        }
                    } else {
                        Section {
                            Text("That doesn't look like a settings code. Copy the whole link and try again.")
                                .foregroundStyle(.red)
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(SkyNow())
        .navigationTitle("Bring in settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isSheet || done { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .sheet(isPresented: $scanning) {
            QRScanner { found in
                text = found
                scanning = false
            }
            .ignoresSafeArea()
        }
    }

    private func bringIn(_ moved: MovedSettings) {
        model.prefs = moved.applied(to: model.prefs)
        if model.prefs.useGPS { model.useGPS() }
        done = true
    }
}

/// The camera, looking for a QR code with a settings code in it.
private struct QRScanner: UIViewControllerRepresentable {
    let found: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(recognizedDataTypes: [.barcode(symbologies: [.qr])],
                                                qualityLevel: .balanced, isHighlightingEnabled: true)
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_ controller: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(found: found) }

    @MainActor
    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let found: (String) -> Void
        private var done = false
        init(found: @escaping (String) -> Void) { self.found = found }

        func dataScanner(_ scanner: DataScannerViewController, didAdd items: [RecognizedItem], allItems: [RecognizedItem]) {
            for case .barcode(let code) in items {
                guard !done, let text = code.payloadStringValue, text.contains(MovedSettings.prefix) else { continue }
                done = true
                scanner.stopScanning()
                found(text)
            }
        }
    }
}
