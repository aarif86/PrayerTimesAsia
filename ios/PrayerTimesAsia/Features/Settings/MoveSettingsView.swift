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
                    Text(W("move.intro"))
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
                            .accessibilityLabel(W("move.qrAlt"))
                    }
                }
                .padding(.vertical, 6)
            } footer: {
                VStack(alignment: .leading, spacing: 6) {
                    Text(W("phone.move.otherPhone"))
                    if let note = Self.trimNote(keptDays: qr.keptDays, ramadanTrimmed: qr.ramadanTrimmed) {
                        Text(note)
                    }
                }
            }

            Section {
                ShareLink(item: URL(string: moved.link)!, subject: Text(W("move.shareTitle"))) {
                    Label(W("phone.shareLink"), systemImage: "square.and.arrow.up")
                }
                Button {
                    UIPasteboard.general.string = moved.link
                    copied = true
                } label: {
                    Label(copied ? W("common.copied") : W("common.copyLink"), systemImage: copied ? "checkmark" : "doc.on.doc")
                }
            } footer: {
                Text(W("move.private"))
            }
        }
        .scrollContentBackground(.hidden)
        .background(SkyNow())
        .navigationTitle(W("move.title"))
        .navigationBarTitleDisplayMode(.inline)
    }

    /// What the QR code left out, if anything; the link always carries everything.
    static func trimNote(keptDays: Int?, ramadanTrimmed: Bool) -> String? {
        var parts: [String] = []
        if let kept = keptDays { parts.append(W("move.lastDays", ["n": kept])) }
        if ramadanTrimmed { parts.append(W("move.ramadanOnly")) }
        guard !parts.isEmpty else { return nil }
        return W("phone.settings.moveCarries", ["what": parts.joined(separator: " and ")])
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
                    Text(W("move.arrived")).font(.headline)
                } footer: {
                    Text(W("phone.alertsEachPhone"))
                }
            } else {
                Section {
                    if QRScanner.isSupported {
                        Button { scanning = true } label: { Label(W("phone.scanQr"), systemImage: "qrcode.viewfinder") }
                    }
                    PasteButton(payloadType: String.self) { strings in
                        if let s = strings.first { text = s }
                    }
                    TextField(W("phone.orPaste"), text: $text, axis: .vertical)
                        .lineLimit(1...4)
                        .font(.footnote.monospaced())
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } footer: {
                    Text(W("phone.bringHow"))
                }

                if !text.isEmpty {
                    if let moved {
                        Section {
                            ForEach(moved.summary, id: \.self) { Text($0) }
                            Button(W("move.bringIn")) { bringIn(moved) }
                                .font(.headline)
                        } header: {
                            Text(W("move.willBring"))
                        } footer: {
                            Text(W("move.replaceNote"))
                        }
                    } else {
                        Section {
                            Text(W("move.bad"))
                                .foregroundStyle(.red)
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(SkyNow())
        .navigationTitle(W("move.bringIn"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isSheet || done { ToolbarItem(placement: .confirmationAction) { Button(W("common.done")) { dismiss() } } }
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

#if !targetEnvironment(macCatalyst)
/// The camera, looking for a QR code with a settings code in it.
private struct QRScanner: UIViewControllerRepresentable {
    let found: (String) -> Void
    @MainActor static var isSupported: Bool { DataScannerViewController.isSupported }

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
#else
/// A Mac app has no live QR scanner; the link is pasted or typed there instead.
private struct QRScanner: View {
    let found: (String) -> Void
    static var isSupported: Bool { false }
    var body: some View { EmptyView() }
}
#endif
