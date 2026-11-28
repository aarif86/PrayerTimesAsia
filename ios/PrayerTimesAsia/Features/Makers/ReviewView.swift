import StoreKit
import SwiftUI
import UIKit

/// Public reviews and private notes for the makers (Ustaz Aarif Raziff and Nasar Digital).
/// No sign in and no server: review buttons open the store or Google, private notes open
/// the site's note page with the words filled in. Same as the web and Android apps.
enum Reviews {
    /// The number in the App Store link (apps.apple.com/app/id1234567890). Empty until the
    /// app is live on the App Store; the App Store button stays hidden until then.
    static let appStoreID = ""
    /// Nasar Digital's Google review page (Google Business Profile).
    static let googleReview = URL(string: "https://g.page/r/CSq5hZxhRs1BEBM/review")!
    static let feedbackEmail = "salam@prayertimes.asia"
    static let notePage = "https://prayertimes.asia/note.html"

    /// The site's note page with the form already filled in. Sending it there thanks the person and emails a confirmation.
    static func noteURL(about: String, note: String, place: String = "") -> URL? {
        var c = URLComponents(string: notePage)
        var items = [URLQueryItem(name: "note_is_about", value: about),
                     URLQueryItem(name: "note_to_the_makers", value: note.trimmingCharacters(in: .whitespacesAndNewlines))]
        let p = place.trimmingCharacters(in: .whitespacesAndNewlines)
        if !p.isEmpty { items.append(URLQueryItem(name: "note_masjid_or_place", value: p)) }
        c?.queryItems = items
        return c?.url
    }

    struct Link: Identifiable {
        let id: String
        let title: String
        let subtitle: String
        let icon: String
        let url: URL
    }

    /// Where someone can leave a public review from an iPhone.
    static func links(appStoreID: String = appStoreID) -> [Link] {
        var out: [Link] = []
        if !appStoreID.isEmpty, let url = URL(string: "https://apps.apple.com/app/id\(appStoreID)?action=write-review") {
            out.append(Link(id: "appstore", title: W("review.appStore"), subtitle: W("review.appStoreSub"), icon: "star", url: url))
        }
        out.append(Link(id: "google", title: W("review.google"), subtitle: W("review.googleSub"), icon: "mappin.circle", url: googleReview))
        return out
    }
}

/// "Rate and review": write once, each button copies the words, paste in each place.
struct ReviewView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var words = ""
    @State private var copiedFor: String?
    @State private var showNote = false

    private var links: [Reviews.Link] {
        // `-review-stores` (screenshots): show the App Store button before the app is live.
        Reviews.links(appStoreID: ProcessInfo.processInfo.arguments.contains("-review-stores") ? "0000000000" : Reviews.appStoreID)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(W("review.intro"))
                        .font(.subheadline)
                    VStack(alignment: .leading, spacing: 8) {
                        step(1, W("review.step1b"), stepRest("review.step1"))
                        step(2, W("review.step2b"), stepRest("review.step2"))
                        step(3, W("review.step3b"), stepRest("review.step3", ["paste": W("review.paste")]))
                    }
                    .padding(.vertical, 4)
                }
                Section {
                    TextField(W("feedback.kindHint"), text: $words, axis: .vertical)
                        .lineLimit(4...8)
                        .onChange(of: words) { _, _ in copiedFor = nil }
                        .accessibilityLabel(W("review.yourReview"))
                }
                Section {
                    ForEach(links) { link in
                        Button { tap(link) } label: {
                            HStack(spacing: 12) {
                                Image(systemName: link.icon).font(.title3).foregroundStyle(Theme.accentText).frame(width: 26)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(link.title).foregroundStyle(.primary)
                                    Text(copiedFor == link.id ? W("review.copiedHow") : link.subtitle)
                                        .font(.footnote).foregroundStyle(.secondary)
                                }
                                Spacer(minLength: 4)
                                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(.tertiary)
                            }
                        }
                    }
                }
                Section {
                    Button { showNote = true } label: {
                        Label(W("review.private"), systemImage: "envelope")
                    }
                }
            }
            .navigationTitle(W("settings.rate"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(W("common.done")) { save(); dismiss() } } }
            .onAppear { words = model.prefs.reviewDraft }
            .onDisappear { save() }
            .sheet(isPresented: $showNote) { NoteView() }
        }
    }

    /// The sentence after the bold start of a step, from the shared line ("{b} in the box below...").
    private func stepRest(_ key: String, _ extra: [String: String] = [:]) -> String {
        var args: [String: CustomStringConvertible] = ["b": ""]
        for (k, v) in extra { args[k] = v }
        return W(key, args).trimmingCharacters(in: .whitespaces)
    }

    private func step(_ n: Int, _ bold: String, _ rest: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("\(n).").font(.subheadline.weight(.heavy)).foregroundStyle(Theme.accentText)
            (Text(bold).bold() + Text(" " + rest)).font(.subheadline)
        }
    }

    private func save() { if model.prefs.reviewDraft != words { model.prefs.reviewDraft = words } }

    private func tap(_ link: Reviews.Link) {
        let text = words.trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty { UIPasteboard.general.string = text; copiedFor = link.id }
        model.prefs.reviewTappedAt = Date().timeIntervalSince1970
        save()
        openURL(link.url)
    }
}

/// "A note to the makers": a private note that opens the site note page, filled in.
struct NoteView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var kind: Kind = .kind
    @State private var text = ""
    @State private var addDetails = true
    @State private var mayShare = false
    @State private var copied = false

    enum Kind: String, CaseIterable, Identifiable {
        case kind, idea, time, broke
        var id: String { rawValue }
        var label: String {
            switch self {
            case .kind: W("feedback.kind")
            case .idea: W("feedback.idea")
            case .time: W("feedback.time")
            case .broke: W("feedback.broke")
            }
        }
        var icon: String {
            switch self {
            case .kind: "heart"
            case .idea: "lightbulb"
            case .time: "clock"
            case .broke: "wrench.adjustable"
            }
        }
        var hint: String {
            switch self {
            case .kind: W("feedback.kindHint")
            case .idea: W("feedback.ideaHint")
            case .time: W("feedback.timeHint")
            case .broke: W("feedback.brokeHint")
            }
        }
    }

    /// The email the note becomes (same wording as the web and Android apps).
    static func email(kind: Kind, text: String, details: String?, mayShare: Bool) -> (subject: String, body: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        var lines = [trimmed.isEmpty ? "(no words)" : trimmed, ""]
        if kind == .kind { lines.append(mayShare ? "You may share these words on the website, without my name." : "Please keep these words private.") }
        if let details { lines += ["", details] }
        let body = lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines) + "\n"
        return ("\(kind.label) | Prayer Times Asia", body)
    }

    private var details: String? {
        guard addDetails else { return nil }
        var s = "Version \(Bundle.main.appVersion), iPhone"
        if let p = model.activePlace { s += ", \(p.name)" + (p.countryCode.map { " (\($0))" } ?? "") }
        return s + ", \(model.sourceShort)"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(W("feedback.intro"))
                        .font(.subheadline)
                    Picker(W("phone.review.about"), selection: $kind) {
                        ForEach(Kind.allCases) { k in Label(k.label, systemImage: k.icon).tag(k) }
                    }
                }
                Section {
                    TextField(kind.hint, text: $text, axis: .vertical).lineLimit(5...10)
                        .onChange(of: text) { _, _ in copied = false }
                        .accessibilityLabel(W("feedback.yourNote"))
                }
                Section {
                    Toggle(isOn: $addDetails) {
                        VStack(alignment: .leading) {
                            Text(W("feedback.addDetails"))
                            Text(W("feedback.addDetailsSub")).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                    if kind == .kind {
                        Toggle(isOn: $mayShare) {
                            VStack(alignment: .leading) {
                                Text(W("feedback.mayShare"))
                                Text(W("feedback.mayShareSub")).font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                Section {
                    Button { send() } label: { Label(W("phone.review.send"), systemImage: "paperplane.fill").bold() }
                    Button { copyNote() } label: { Label(copied ? W("common.copied") : W("feedback.copy"), systemImage: "doc.on.doc") }
                } footer: {
                    Text(W("phone.review.opensNote"))
                }
            }
            .navigationTitle(W("feedback.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button(W("common.done")) { dismiss() } } }
        }
    }

    private func send() {
        let mail = Self.email(kind: kind, text: text, details: details, mayShare: mayShare)
        if let url = Reviews.noteURL(about: kind == .time ? "A prayer time looks wrong" : kind.label, note: mail.body) { openURL(url) }
    }

    private func copyNote() {
        let mail = Self.email(kind: kind, text: text, details: details, mayShare: mayShare)
        UIPasteboard.general.string = "To \(Reviews.feedbackEmail)\n\(mail.subject)\n\n\(mail.body)"
        copied = true
    }
}

/// Once ever, after ten separate days of use and never close to a prayer: one quiet line
/// asking for a review. Closing it or using it ends it.
struct ReviewLine: View {
    @Environment(AppModel.self) private var model
    let now: Date
    @State private var showReview = false

    var body: some View {
        // The sheet sits outside the `if`, so it stays up after the line itself goes away.
        VStack(spacing: 0) {
            if !model.prefs.noteCardDone && model.prefs.reviewTappedAt == 0 && model.isCalmForReview(at: now, days: 10) {
                line
            }
        }
        .sheet(isPresented: $showReview) { ReviewView() }
    }

    private var line: some View {
            HStack(spacing: 10) {
                Image(systemName: "star").foregroundStyle(Theme.accentText)
                Text(W("today.reviewAsk"))
                    .font(.subheadline.weight(.semibold)).lineLimit(3).minimumScaleFactor(0.85)
                Spacer(minLength: 4)
                Button(W("today.review")) { model.prefs.noteCardDone = true; showReview = true }
                    .font(.subheadline.weight(.bold))
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.sunArc)
                    .foregroundStyle(.black.opacity(0.8))
                Button { withAnimation { model.prefs.noteCardDone = true } } label: {
                    Image(systemName: "xmark").font(.caption.weight(.bold)).opacity(0.6).frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(W("common.notNow"))
            }
            .padding(.leading, 14).padding(.trailing, 8).padding(.vertical, 8)
            .background(Color.primary.opacity(0.08), in: RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(Color.primary.opacity(0.1), lineWidth: 1))
    }
}

/// Apple's own star box (it decides whether to show; at most three times a year).
/// We only ask at a calm moment: 14+ days of use, not near a prayer, at most every 4 months,
/// and never in the same open as our own review line.
struct StarBoxAsker: ViewModifier {
    @Environment(AppModel.self) private var model
    @Environment(\.requestReview) private var requestReview

    func body(content: Content) -> some View {
        content.task {
            try? await Task.sleep(for: .seconds(6))
            guard !ProcessInfo.processInfo.arguments.contains(where: { $0.hasPrefix("-demo") }) else { return }
            let p = model.prefs
            let now = Date()
            guard p.hasOnboarded, model.isCalmForReview(at: now, days: 14),
                  now.timeIntervalSince1970 - p.starBoxAskedAt > 120 * 86_400,
                  p.noteCardDone || p.reviewTappedAt > 0 else { return }
            model.prefs.starBoxAskedAt = now.timeIntervalSince1970
            requestReview()
        }
    }
}

extension View {
    func asksForStarsWhenCalm() -> some View { modifier(StarBoxAsker()) }
}
