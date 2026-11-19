import SwiftUI

/// "13:15" as the user reads times: 1:15 PM, or 13:15.
private func clock(_ hhmm: String, h24: Bool) -> String {
    if h24 { return hhmm }
    let p = hhmm.split(separator: ":").compactMap { Int($0) }
    guard p.count == 2 else { return hhmm }
    return "\((p[0] + 11) % 12 + 1):\(String(format: "%02d", p[1])) \(p[0] < 12 ? "AM" : "PM")"
}

private struct RuleRow: Identifiable { let id: String; let label: String; let value: String }

@MainActor private func rules(_ m: MasjidLink, model: AppModel) -> [RuleRow] {
    let h24 = model.prefs.use24Hour
    var rows = Prayer.obligatory.compactMap { p -> RuleRow? in
        guard let r = m.jamaah[p.rawValue] else { return nil }
        let value = r.fixed.map { clock($0, h24: h24) } ?? (r.after == 0 ? "At the azan" : "\(r.after ?? 0) min after azan")
        return RuleRow(id: p.rawValue, label: p.name(model.naming), value: value)
    }
    if let j = m.jumuah { rows.append(RuleRow(id: "jumuah", label: "Jumu'ah", value: clock(j, h24: h24))) }
    return rows
}

/// Opened from a masjid screen's QR code: ask before making it "your masjid".
struct MasjidLinkSheet: View {
    @Environment(AppModel.self) private var model
    let link: MasjidLink

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(spacing: 8) {
                        Image(systemName: "moon.stars.fill").font(.title).foregroundStyle(Theme.accentText)
                        Text(link.name).font(.headline).multilineTextAlignment(.center)
                        Text("Add it as your masjid and its iqamah times show on your Prayer screen whenever you're nearby.")
                            .font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }
                Section {
                    let rows = rules(link, model: model)
                    if rows.isEmpty {
                        Text("This masjid hasn't set its iqamah times yet.").foregroundStyle(.secondary)
                    }
                    ForEach(rows) { r in LabeledContent(r.label, value: r.value) }
                } header: {
                    Text("Iqamah")
                } footer: {
                    if let current = model.prefs.myMasjid, current.name != link.name {
                        Text("This replaces \(current.name).")
                    }
                }
                Section {
                    Button { model.followPendingMasjid() } label: {
                        Text("Add my masjid").font(.headline).frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.accent)
                    .listRowBackground(Color.clear)
                }
            }
            .navigationTitle("Your masjid")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Not now") { model.pendingMasjid = nil } }
            }
        }
        .presentationDetents([.large])
    }
}
