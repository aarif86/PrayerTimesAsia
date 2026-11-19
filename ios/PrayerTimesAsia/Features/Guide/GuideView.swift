import SwiftUI

/// The quick guide: nine swipe cards a new user sees once, right after choosing
/// their place. Skip at any time; Settings > Help opens it again. Same cards and
/// words as the web and Android (data/guide-words.json).
struct GuideView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var lang: RamadanContent.Lang = .en
    @State private var page = 0
    @State private var started = false

    private let cards = GuideWords.cards
    private var last: Bool { page == cards.count - 1 }
    private func t(_ key: String, _ args: [String: String] = [:]) -> String { GuideWords.word(lang, key, args) }

    var body: some View {
        ZStack {
            RadialGradient(colors: [Color(red: 0.23, green: 0.20, blue: 0.50), Color(red: 0.08, green: 0.10, blue: 0.27), Color(red: 0.04, green: 0.06, blue: 0.16)],
                           center: .top, startRadius: 0, endRadius: 760)
                .ignoresSafeArea()
            VStack(spacing: 0) {
                topBar
                TabView(selection: $page) {
                    ForEach(Array(cards.enumerated()), id: \.offset) { n, id in
                        GuideCard(id: id, lang: lang, first: n == 0, on: page == n)
                            .tag(n)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(.smooth(duration: 0.45), value: page)
                bottomBar
            }
        }
        .foregroundStyle(.white)
        .environment(\.colorScheme, .dark)
        .onAppear {
            if !started { lang = GuideWords.startLanguage(naming: model.naming); started = true }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(t("label"))
    }

    private var topBar: some View {
        HStack {
            HStack(spacing: 2) {
                langButton(.en, "EN"); langButton(.ms, "BM"); langButton(.id, "ID")
            }
            .padding(3)
            .background(.white.opacity(0.1), in: Capsule())
            Spacer()
            if !last {
                Button(t("skip")) { finish() }
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.8))
            }
        }
        .padding(.horizontal, 20)
        .frame(minHeight: 44)
    }

    private func langButton(_ l: RamadanContent.Lang, _ label: String) -> some View {
        Button { withAnimation(.easeInOut(duration: 0.25)) { lang = l } } label: {
            Text(label)
                .font(.footnote.weight(.bold))
                .padding(.horizontal, 11).padding(.vertical, 6)
                .foregroundStyle(lang == l ? Color(red: 0.08, green: 0.10, blue: 0.27) : .white.opacity(0.7))
                .background(lang == l ? Color.white.opacity(0.92) : Color.clear, in: Capsule())
        }
        .accessibilityAddTraits(lang == l ? .isSelected : [])
    }

    private var bottomBar: some View {
        VStack(spacing: 16) {
            HStack(spacing: 7) {
                ForEach(0..<cards.count, id: \.self) { n in
                    Capsule()
                        .fill(n == page ? GuideCard.gold : Color.white.opacity(0.3))
                        .frame(width: n == page ? 22 : 7, height: 7)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: page)
            .accessibilityElement()
            .accessibilityLabel(t("of", ["n": "\(page + 1)", "t": "\(cards.count)"]))
            HStack {
                Button(t("back")) { withAnimation { page = max(0, page - 1) } }
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.75))
                    .opacity(page == 0 ? 0 : 1)
                    .disabled(page == 0)
                Spacer()
                Button {
                    if last { finish() } else { withAnimation { page += 1 } }
                } label: {
                    Text(last ? t("start") : t("next"))
                        .font(.body.weight(.bold))
                        .foregroundStyle(Color(red: 0.08, green: 0.10, blue: 0.27))
                        .padding(.horizontal, 26).padding(.vertical, 14)
                        .frame(minWidth: 112)
                        .background(.white, in: Capsule())
                }
            }
            .padding(.horizontal, 20)
        }
        .padding(.bottom, 12)
    }

    private func finish() {
        model.prefs.guideSeen = true
        dismiss()
    }
}

/// One card: a small moving picture, the words, and the tab bar with this card's tab lit.
private struct GuideCard: View {
    let id: String
    let lang: RamadanContent.Lang
    let first: Bool
    let on: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    static let gold = Color(red: 0.97, green: 0.74, blue: 0.56)

    var body: some View {
        VStack(spacing: 0) {
            Group {
                if id == "buttons" { AnyView(ButtonsScene(lang: lang, on: on)) } else { AnyView(GuideScene(id: id, on: on && !reduceMotion)) }
            }
            .padding(.top, 24)
            if first {
                Text(GuideWords.word(lang, "hello"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Self.gold)
                    .padding(.top, 18)
            }
            Text(GuideWords.word(lang, "\(id)_title"))
                .font(Theme.display(30, .heavy))
                .multilineTextAlignment(.center)
                .padding(.top, first ? 6 : 16)
                .padding(.bottom, 10)
            Text(GuideWords.word(lang, "\(id)_body"))
                .font(.body)
                .lineSpacing(3)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.88))
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 380)
            Text(GuideWords.word(lang, "find"))
                .font(.footnote.weight(.bold))
                .foregroundStyle(Self.gold)
                .padding(.top, 22)
            MiniTabs(lit: Self.tab(id), on: on && !reduceMotion)
                .padding(.top, 14)
            if id == "yours" {
                Text(GuideWords.word(lang, "again"))
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.65))
                    .padding(.top, 14)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 32)
        .opacity(on ? 1 : 0.4)
        .offset(y: on ? 0 : 12)
        .animation(.smooth(duration: 0.5), value: on)
        .accessibilityElement(children: .combine)
    }

    static func tab(_ id: String) -> Int {
        switch id {
        case "qibla": 1
        case "falak": 2
        case "masjid": 3
        case "yours": 4
        default: 0
        }
    }
}

/// The five tabs with their names, one lit and pointed at, so people learn where each part lives.
private struct MiniTabs: View {
    let lit: Int
    let on: Bool
    @State private var bob = false
    private static let names = ["Prayer", "Qibla", "Falak", "Masjid", "Settings"]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<5, id: \.self) { n in
                VStack(spacing: 3) {
                    icon(n).frame(width: 20, height: 20)
                    Text(Self.names[n]).font(.system(size: 10.5, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.8)
                }
                .frame(width: 56)
                .padding(.vertical, 6)
                .foregroundStyle(n == lit ? Color(red: 0.08, green: 0.10, blue: 0.27) : Color.white.opacity(0.45))
                .background(n == lit ? GuideCard.gold : Color.clear, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(alignment: .top) {
                    if n == lit {
                        Image(systemName: "arrowtriangle.down.fill").font(.system(size: 11))
                            .foregroundStyle(GuideCard.gold)
                            .offset(y: bob ? -10 : -14)
                            .animation(on ? .easeInOut(duration: 0.6).repeatForever() : .default, value: bob)
                    }
                }
            }
        }
        .padding(.horizontal, 8).padding(.vertical, 6)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityHidden(true)
        .onAppear { bob = on }
        .onChange(of: on) { _, now in bob = now }
    }

    @ViewBuilder private func icon(_ n: Int) -> some View {
        switch n {
        case 0: Image("Tab-prayer").resizable().scaledToFit()
        case 1: Image("Tab-qibla").resizable().scaledToFit()
        case 2: Image("Tab-falak").resizable().scaledToFit()
        case 3: Image("Tab-masjid").resizable().scaledToFit()
        default: Image(systemName: "gearshape.fill").resizable().scaledToFit()
        }
    }
}

/// The round buttons from the top of the Prayer screen, each with what it does.
private struct ButtonsScene: View {
    let lang: RamadanContent.Lang
    let on: Bool
    private static let rows: [(symbol: String, asset: Bool, key: String)] = [
        ("paintpalette.fill", false, "btn_look"),
        ("circle.lefthalf.filled", false, "btn_light"),
        ("alarm", false, "btn_alarm"),
        ("flame.fill", false, "btn_streak"),
        ("Tab-journey", true, "btn_travel"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(Self.rows.enumerated()), id: \.offset) { n, row in
                HStack(spacing: 12) {
                    Group {
                        if row.asset { Image(row.symbol).resizable().scaledToFit().frame(width: 17, height: 17) }
                        else { Image(systemName: row.symbol).font(.system(size: 16, weight: .semibold)) }
                    }
                    .foregroundStyle(Color(red: 0.08, green: 0.10, blue: 0.27))
                    .frame(width: 38, height: 38)
                    .background(Color(red: 0.91, green: 0.93, blue: 0.96), in: Circle())
                    Text(GuideWords.word(lang, row.key)).font(.subheadline.weight(.semibold))
                }
                .opacity(on ? 1 : 0)
                .offset(x: on ? 0 : -10)
                .animation(.smooth(duration: 0.45).delay(0.1 + Double(n) * 0.08), value: on)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

/// The picture at the top of each card: the navy compass ring with a gentle movement.
private struct GuideScene: View {
    let id: String
    let on: Bool

    var body: some View {
        Group {
            switch id {
            case "looks": AnyView(LooksScene(on: on))
            case "falak": AnyView(Ring { FalakScene(on: on) })
            default: AnyView(Ring { IconScene(id: id, on: on) })
            }
        }
        .accessibilityHidden(true)
    }
}

private struct Ring<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [Color(red: 0.15, green: 0.17, blue: 0.37), Color(red: 0.11, green: 0.13, blue: 0.31)],
                                     center: .center, startRadius: 0, endRadius: 88))
                .overlay(Circle().stroke(Color(red: 0.95, green: 0.93, blue: 0.91).opacity(0.18), lineWidth: 7))
                .overlay(Circle().inset(by: 12).stroke(Color(red: 0.95, green: 0.93, blue: 0.91).opacity(0.22), style: StrokeStyle(lineWidth: 1.5, dash: [4, 4])))
                .shadow(color: .black.opacity(0.35), radius: 24, y: 18)
            content
        }
        .frame(width: 176, height: 176)
    }
}

/// Prayer, alerts, Qibla, Masjid, travel and settings: an icon with its own movement.
private struct IconScene: View {
    let id: String
    let on: Bool
    @State private var moving = false

    var body: some View {
        ZStack {
            switch id {
            case "prayer":
                Circle().fill(Color(red: 0.89, green: 0.71, blue: 0.35)).frame(width: 16, height: 16)
                    .shadow(color: Color(red: 0.89, green: 0.71, blue: 0.35).opacity(0.7), radius: 8)
                    .offset(y: -80)
                    .rotationEffect(.degrees(moving ? 360 : 0))
                    .animation(on ? .linear(duration: 9).repeatForever(autoreverses: false) : .default, value: moving)
                Image("Tab-prayer").resizable().scaledToFit().frame(width: 78, height: 78)
            case "alerts":
                Image(systemName: "bell.and.waves.left.and.right").font(.system(size: 58, weight: .light))
                    .symbolEffect(.variableColor.iterative, options: .repeating, isActive: on)
                badge("alarm")
            case "qibla":
                Circle().inset(by: 22).stroke(Color(red: 0.89, green: 0.71, blue: 0.35), lineWidth: 3)
                    .shadow(color: Color(red: 0.89, green: 0.71, blue: 0.35).opacity(0.6), radius: 12)
                    .opacity(moving ? 1 : 0.2)
                    .animation(on ? .easeInOut(duration: 1.3).repeatForever().delay(1.5) : .default, value: moving)
                Image("Tab-qibla").resizable().scaledToFit().frame(width: 92, height: 92)
                    .rotationEffect(.degrees(moving ? 0 : -70))
                    .animation(on ? .spring(response: 1.4, dampingFraction: 0.45) : .default, value: moving)
            case "masjid":
                Image("Tab-masjid").resizable().scaledToFit().frame(width: 84, height: 84)
                Image(systemName: "mappin.circle.fill").font(.system(size: 30))
                    .foregroundStyle(Theme.north)
                    .offset(x: 40, y: moving ? -52 : -80)
                    .opacity(moving ? 1 : 0)
                    .animation(on ? .spring(response: 0.6, dampingFraction: 0.5).delay(0.3) : .default, value: moving)
            case "travel":
                Image(systemName: "airplane").font(.system(size: 26))
                    .foregroundStyle(GuideCard.gold)
                    .offset(x: moving ? 60 : -60, y: -52)
                    .opacity(moving ? 0.2 : 1)
                    .animation(on ? .easeInOut(duration: 3.2).repeatForever(autoreverses: false) : .default, value: moving)
                Image("Tab-journey").resizable().scaledToFit().frame(width: 74, height: 74)
                    .offset(y: moving ? 26 : 18)
                    .animation(on ? .easeInOut(duration: 0.8).repeatForever() : .default, value: moving)
            default:
                Image(systemName: "gearshape.fill").font(.system(size: 70))
                    .rotationEffect(.degrees(moving ? 360 : 0))
                    .animation(on ? .linear(duration: 10).repeatForever(autoreverses: false) : .default, value: moving)
                badge("calendar")
            }
        }
        .frame(width: 176, height: 176)
        .onAppear { moving = on }
        .onChange(of: on) { _, now in moving = now }
    }

    private func badge(_ symbol: String) -> some View {
        Image(systemName: symbol).font(.system(size: 22, weight: .semibold))
            .foregroundStyle(Color(red: 0.08, green: 0.10, blue: 0.27))
            .frame(width: 50, height: 50)
            .background(GuideCard.gold, in: Circle())
            .shadow(color: .black.opacity(0.3), radius: 8, y: 6)
            .offset(x: 55, y: 53)
    }
}

/// The sun crosses the sky and the stick's shadow swings round under it.
private struct FalakScene: View {
    let on: Bool
    @State private var moving = false

    var body: some View {
        ZStack {
            Capsule().fill(.white.opacity(0.4)).frame(width: 96, height: 2).offset(y: 32)
            // The shadow falls away from the sun: right in the morning, short at noon, left by Asar.
            HStack(spacing: 0) {
                Color.clear.frame(width: 44, height: 5)
                Capsule().fill(GuideCard.gold.opacity(0.6)).frame(width: 44, height: 5)
            }
            .scaleEffect(x: moving ? -1 : 1)
            .offset(y: 32)
            Capsule().fill(.white).frame(width: 4, height: 30).offset(y: 17)
            Circle().fill(Color(red: 0.89, green: 0.71, blue: 0.35)).frame(width: 16, height: 16)
                .shadow(color: Color(red: 0.89, green: 0.71, blue: 0.35).opacity(0.8), radius: 6)
                .offset(y: -70)
                .rotationEffect(.degrees(moving ? 62 : -62))
                .offset(y: 32)
        }
        .animation(on ? .easeInOut(duration: 5).repeatForever() : .default, value: moving)
        .onAppear { moving = on }
        .onChange(of: on) { _, now in moving = now }
    }
}

/// Real screenshots of the six Prayer screen looks, one after another.
private struct LooksScene: View {
    let on: Bool
    @State private var index = 0
    private static let looks = ["Guide-look-centre", "Guide-look-list", "Guide-look-dial", "Guide-look-sunPath", "Guide-look-bands", "Guide-look-simple"]

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                ForEach(0..<Self.looks.count, id: \.self) { n in
                    Image(Self.looks[n]).resizable().scaledToFill()
                        .opacity(n == index ? 1 : 0)
                }
            }
            .frame(width: 112, height: 236)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color(red: 0.15, green: 0.17, blue: 0.37), lineWidth: 4))
            .shadow(color: .black.opacity(0.45), radius: 20, y: 18)
            .animation(.easeInOut(duration: 0.6), value: index)
            Image(systemName: "paintpalette.fill").font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Color(red: 0.08, green: 0.10, blue: 0.27))
                .frame(width: 50, height: 50)
                .background(GuideCard.gold, in: Circle())
                .shadow(color: .black.opacity(0.3), radius: 8, y: 6)
                .offset(x: 24, y: 12)
        }
        .frame(width: 176, height: 250)
        .task(id: on) {
            while on && !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1.6))
                if on { index = (index + 1) % Self.looks.count }
            }
        }
    }
}
