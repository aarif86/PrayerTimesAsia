import SwiftUI

extension SourceGrade {
    var tint: Color {
        switch self {
        case .official: Color(red: 0.45, green: 0.86, blue: 0.62)
        case .masjid: Color(red: 0.55, green: 0.78, blue: 1)
        case .community: Color(red: 1, green: 0.82, blue: 0.45)
        case .calculated: Color.primary.opacity(0.75)
        case .falak: Theme.accent
        }
    }

    var symbol: String {
        switch self {
        case .official: "checkmark.seal.fill"
        case .masjid: "building.columns.fill"
        case .community: "person.3.fill"
        case .calculated: "function"
        case .falak: "sun.dust.fill"
        }
    }
}

/// "Every time has a source. We show it." - the badge above the prayer list.
struct SourceBadge: View {
    @Environment(AppModel.self) private var model
    let day: PrayerDay
    /// "A · MUIS ⓘ" for the Prayer screen header.
    var compact = false
    @State private var showSanad = false

    var body: some View {
        Button { showSanad = true } label: {
            if compact { compactLabel } else { fullLabel }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(W("phone.source.gradeLabel", ["grade": day.grade.rawValue, "a": day.grade.title, "b": sourceName]))
        .accessibilityHint(W("phone.source.showsWhere"))
        .sheet(isPresented: $showSanad) { SanadSheet(day: day) }
    }

    private var compactLabel: some View {
        HStack(spacing: 6) {
            Text(day.grade.rawValue)
                .font(.caption2.weight(.heavy))
                .frame(width: 18, height: 18)
                .background(day.grade.tint.opacity(0.9), in: Circle())
                .foregroundStyle(.black.opacity(0.8))
            Text(shortSource).font(.caption.weight(.semibold)).lineLimit(1)
            Image(systemName: "info.circle").font(.caption2).opacity(0.7)
        }
        .padding(.horizontal, 9).padding(.vertical, 5)
        .background(Color.primary.opacity(0.1), in: Capsule())
    }

    private var shortSource: String {
        switch day.grade {
        case .official: "\(day.grade.title) · \(model.officialSource?.authority ?? model.method.shortName)"
        case .masjid, .community: day.mosqueName ?? day.grade.title
        default: "\(day.grade.title) · \(model.method.shortName)"
        }
    }

    private var fullLabel: some View {
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
            .background(Color.primary.opacity(0.12), in: Capsule())
    }

    private var sourceName: String {
        day.officialSource ?? W("phone.source.methodName", ["name": model.method.shortName])
    }
}

struct SanadSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let day: PrayerDay
    @State private var submitting: SubmitView.Kind?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: day.grade.symbol)
                            .font(.title2)
                            .foregroundStyle(day.grade.tint)
                            .accessibilityHidden(true)
                            .frame(width: 32)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(W("source.gradeName", ["grade": day.grade.rawValue, "name": day.grade.title])).font(.headline)
                            Text(day.officialSource ?? model.method.name).font(.subheadline)
                            Text(detail).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text(W("source.where"))
                }

                if let other = day.alternateSource, !day.alternate.isEmpty {
                    Section {
                        ForEach(Prayer.obligatory.filter { day.alternate[$0] != nil }) { p in
                            LabeledContent(p.name(model.naming, isFriday: model.isFriday(day.time(.dhuhr))),
                                           value: "\(model.formatted(day.time(p))) · \(model.formatted(day.alternate[p]!))")
                        }
                    } header: {
                        Text("\(day.officialSource ?? "Official") · \(other)")
                    } footer: {
                        Text(W("source.differ"))
                    }
                }

                if let mosque = day.mosqueName, !day.jamaah.isEmpty {
                    Section(W("source.jamaahAt", ["name": mosque])) {
                        ForEach(Prayer.obligatory.filter { day.jamaah[$0] != nil }) { p in
                            LabeledContent(p.name(model.naming, isFriday: model.isFriday(day.time(.dhuhr))),
                                           value: model.formatted(day.jamaah[p]!))
                        }
                        Text(W("phone.source.beginsToday"))
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                }

                Section(W("source.grades")) {
                    ForEach([SourceGrade.official, .masjid, .community, .calculated, .falak], id: \.self) { g in
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
                    Button { submitting = .timetable } label: {
                        Label(W("phone.source.sendTimetable"), systemImage: "camera.fill")
                    }
                    Button { submitting = .method } label: {
                        Label(W("phone.source.tellMethod"), systemImage: "checklist")
                    }
                    Button { submitting = .spotcheck } label: {
                        Label(W("phone.source.reportAdhan"), systemImage: "ear.fill")
                    }
                } header: {
                    Text(W("source.helpVerify"))
                } footer: {
                    Text(W("source.checked"))
                }
            }
            .sheet(item: $submitting) { SubmitView(kind: $0) }
            .navigationTitle(W("source.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(W("common.done")) { dismiss() } } }
        }
    }

    private var detail: String {
        switch day.grade {
        case .official where day.officialSource != nil:
            return W("phone.source.downloadedYearly")
        case .official:
            return model.sourceSummary
        case .masjid, .community:
            return model.nearbyMosque.flatMap { $0.method?.note } ?? day.grade.explanation
        case .calculated, .falak:
            return model.sourceSummary
        }
    }
}
