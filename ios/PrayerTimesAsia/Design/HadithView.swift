import SwiftUI

/// A short hadith or ayah, as a card or a softer line (Core/HadithContent.swift).
/// Hidden when Settings, Hadith is off or the person closed this one with its ✕.
/// Right after closing, a small "Hidden" note with Undo stays for a few seconds.
struct HadithView: View {
    enum Style { case card, line }
    @Environment(AppModel.self) private var model
    let id: Hadith.ID
    var tag: String? = nil
    var style: Style = .card
    @State private var justHidden = false

    var body: some View {
        if model.prefs.showHadith {
            if model.prefs.hiddenHadith.contains(id.rawValue) {
                if justHidden { undoNote }
            } else {
                content
            }
        }
    }

    private var content: some View {
        let h = Hadith.of(id)
        let lang = RamadanContent.lang(model.naming)
        let words = VStack(alignment: .leading, spacing: style == .card ? 8 : 6) {
            Text(h.arabic)
                .font(.system(size: style == .card ? 22 : 19))
                .lineSpacing(6)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .environment(\.layoutDirection, .rightToLeft)
                .padding(.leading, style == .line ? 28 : 0)
            Text("“\(h.meaning(lang))”")
                .font(style == .card ? Font.body.italic() : Font.subheadline)
                .fixedSize(horizontal: false, vertical: true)
            Text(h.source(lang)).font(.caption).foregroundStyle(.secondary)
        }
        return Group {
            if style == .card {
                GlassCard(padding: 18) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text((tag ?? "Hadith").uppercased())
                                .font(.caption2.weight(.bold)).tracking(1.2).foregroundStyle(Theme.accentText)
                            Spacer()
                            closeButton
                        }
                        words
                    }
                }
            } else {
                words
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(alignment: .topLeading) { closeButton.padding(8) }
            }
        }
        .padding(.vertical, 6)
    }

    private var closeButton: some View {
        Button {
            withAnimation {
                if !model.prefs.hiddenHadith.contains(id.rawValue) { model.prefs.hiddenHadith.append(id.rawValue) }
                justHidden = true
            }
            Task { try? await Task.sleep(for: .seconds(6)); withAnimation { justHidden = false } }
        } label: {
            Image(systemName: "xmark")
                .font(.caption.weight(.bold))
                .frame(width: 26, height: 26)
                .background(Color.primary.opacity(0.12), in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Hide this hadith")
    }

    private var undoNote: some View {
        HStack(spacing: 12) {
            Text("Hadith hidden here. Bring them all back in Settings, Hadith.").font(.subheadline)
            Spacer()
            Button("Undo") {
                withAnimation {
                    model.prefs.hiddenHadith.removeAll { $0 == id.rawValue }
                    justHidden = false
                }
            }
            .font(.subheadline.weight(.bold))
        }
        .padding(14)
        .background(Color.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(.vertical, 6)
    }
}

extension View {
    /// A hadith inside a List or Form: no row background, so it keeps its own look.
    func hadithRow() -> some View {
        listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
            .listRowSeparator(.hidden)
    }
}
