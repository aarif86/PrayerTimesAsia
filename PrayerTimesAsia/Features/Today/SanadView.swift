import SwiftUI

extension SourceGrade {
    var tint: Color {
        switch self {
        case .official: Color(red: 0.45, green: 0.86, blue: 0.62)
        case .masjid: Color(red: 0.55, green: 0.78, blue: 1)
        case .community: Color(red: 1, green: 0.82, blue: 0.45)
        case .calculated: .white.opacity(0.75)
        }
    }

    var symbol: String {
        switch self {
        case .official: "checkmark.seal.fill"
        case .masjid: "building.columns.fill"
        case .community: "person.3.fill"
        case .calculated: "function"
        }
    }
}

/// "Every time has a source. We show it." - the badge above the prayer list.
struct SourceBadge: View {
    @Environment(AppModel.self) private var model
    let day: PrayerDay
    @State private var showSanad = false

    var body: some View {
        Button { showSanad = true } label: {
            HStack(spacing: 8) {
                Text(day.grade.rawValue)
                    .font(.caption.weight(.heavy))
                    .frame(width: 20, height: 20)
                    .background(day.grade.tint.opacity(0.9), in: Circle())
                    .foregroundStyle(.black.opacity(0.8))
                Text("\(day.grade.title) · \(sourceName)")
                    .font(.footnote.weight(.semibold))
                    .lineLimit(1)
                Spacer(minLength: 4)
                Image(systemName: "info.circle").font(.footnote)
            }
            .padding(.horizontal, 12).padding(.vertical, 9)
            .background(.white.opacity(0.12), in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Source: grade \(day.grade.rawValue), \(day.grade.title), \(sourceName)")
        .accessibilityHint("Shows where these times come from")
        .sheet(isPresented: $showSanad) { SanadSheet(day: day) }
    }

    private var sourceName: String {
        day.officialSource ?? "\(model.method.shortName) method"
    }
}

struct SanadSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    let day: PrayerDay

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: day.grade.symbol)
                            .font(.title2)
                            .foregroundStyle(day.grade.tint)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Grade \(day.grade.rawValue) · \(day.grade.title)").font(.headline)
                            Text(day.officialSource ?? model.method.name).font(.subheadline)
                            Text(detail).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("Where today's times come from")
                }

                if let mosque = day.mosqueName, !day.jamaah.isEmpty {
                    Section("Jamaah at \(mosque)") {
                        ForEach(Prayer.obligatory.filter { day.jamaah[$0] != nil }) { p in
                            LabeledContent(p.name(model.naming, isFriday: model.isFriday(day.time(.dhuhr))),
                                           value: model.formatted(day.jamaah[p]!))
                        }
                        Text("Prayer time begins at the times on the Today screen; these are when the congregation prays.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }

                Section("The grades") {
                    ForEach([SourceGrade.official, .masjid, .community, .calculated], id: \.self) { g in
                        HStack(alignment: .top, spacing: 12) {
                            Text(g.rawValue)
                                .font(.caption.weight(.heavy))
                                .frame(width: 22, height: 22)
                                .background(g.tint, in: Circle())
                                .foregroundStyle(.black.opacity(0.8))
                            VStack(alignment: .leading, spacing: 2) {
                                Text(g.title).font(.subheadline.weight(.semibold))
                                Text(g.explanation).font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                Section {
                    Button {
                        openURL(Contribute.url(.timetable, model: model))
                    } label: {
                        Label("Send a mosque timetable from here", systemImage: "camera.fill")
                    }
                    Button {
                        openURL(Contribute.url(.method, model: model))
                    } label: {
                        Label("Tell us which method mosques here use", systemImage: "checklist")
                    }
                    Button {
                        openURL(Contribute.url(.spotCheck, model: model))
                    } label: {
                        Label("Report an adhan time you heard", systemImage: "ear.fill")
                    }
                } header: {
                    Text("Help verify times here")
                } footer: {
                    Text("Opens a short form on GitHub. Submissions are checked by a person before they change anyone's times, and shared openly under CC-BY 4.0.")
                }
            }
            .navigationTitle("Source")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }

    private var detail: String {
        switch day.grade {
        case .official where day.officialSource != nil:
            return "Downloaded once a year from the authority and kept on your phone, so it works offline."
        case .official:
            return "\(model.method.parameterSummary). This is the authority's own published method."
        case .masjid, .community:
            return model.nearbyMosque.flatMap { $0.method?.note } ?? day.grade.explanation
        case .calculated:
            return "\(model.method.parameterSummary) · \(model.asrSchool == .hanafi ? "Hanafi" : "Shafi'i") Asr. \(model.method.note)"
        }
    }
}

/// Community submissions v0: prefilled GitHub issue forms (.github/ISSUE_TEMPLATE).
/// Only what the user can see on screen is prefilled - never coordinates.
enum Contribute {
    enum Kind: String { case timetable, method, spotCheck = "spot-check" }

    static let repo = "https://github.com/aarif86/PrayerTimesAsia"

    @MainActor
    static func url(_ kind: Kind, model: AppModel) -> URL {
        var c = URLComponents(string: "\(repo)/issues/new")!
        let place = model.activePlace
        let where_ = [place?.name, place?.district ?? place?.region, place?.countryName]
            .compactMap { $0 }.reduce(into: [String]()) { if !$0.contains($1) { $0.append($1) } }
            .joined(separator: ", ")
        c.queryItems = [
            .init(name: "template", value: "\(kind.rawValue).yml"),
            .init(name: "title", value: "[\(kind.rawValue)] \(where_)"),
            .init(name: "place", value: where_),
            .init(name: "app_method", value: "\(model.method.name) (\(model.method.parameterSummary))"),
        ]
        return c.url!
    }
}
