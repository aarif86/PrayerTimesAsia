import SwiftUI

/// The quick guide: swipe cards a new user sees once, right after choosing their
/// place. Each card is a small phone playing the real app, with a finger that taps
/// the exact button. Skip at any time; Settings > Help opens it again. Same cards,
/// steps and words as the web and Android (data/guide-words.json).
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
        VStack(spacing: 14) {
            FeatureTabs(cards: cards, page: $page, lang: lang)
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
        model.prefs.guideShown = true
        dismiss()
    }
}

/// One named tab per feature along the bottom, so people see what they are learning and can jump to any of it.
private struct FeatureTabs: View {
    let cards: [String]
    @Binding var page: Int
    let lang: RamadanContent.Lang

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(Array(cards.enumerated()), id: \.offset) { n, id in
                        Button { withAnimation { page = n } } label: { tab(id, n) }
                            .buttonStyle(.plain)
                            .id(n)
                            .accessibilityAddTraits(n == page ? .isSelected : [])
                    }
                }
                .padding(.horizontal, 20)
            }
            .onChange(of: page) { _, now in withAnimation(.smooth) { proxy.scrollTo(now, anchor: .center) } }
        }
        .accessibilityLabel(GuideWords.word(lang, "of", ["n": "\(page + 1)", "t": "\(cards.count)"]))
    }

    private func tab(_ id: String, _ n: Int) -> some View {
        let on = n == page
        return HStack(spacing: 6) {
            FeatureIcon(id: id).frame(width: 16, height: 16)
            Text(GuideWords.word(lang, "\(id)_tab")).font(.system(size: 13.5, weight: .bold, design: .rounded))
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .foregroundStyle(on ? GuideCard.navy : Color.white.opacity(n < page ? 0.85 : 0.62))
        .background(on ? GuideCard.gold : Color.white.opacity(0.07), in: Capsule())
        .overlay(Capsule().stroke(on ? GuideCard.gold : Color.white.opacity(0.1), lineWidth: 1))
    }
}

private struct FeatureIcon: View {
    let id: String

    var body: some View {
        switch id {
        case "prayer": Image("Tab-prayer").resizable().scaledToFit()
        case "qibla": Image("Tab-qibla").resizable().scaledToFit()
        case "masjid": Image("Tab-masjid").resizable().scaledToFit()
        case "falak": Image("Tab-falak").resizable().scaledToFit()
        case "travel": Image("Tab-journey").resizable().scaledToFit()
        case "buttons": Image(systemName: "circle.circle").resizable().scaledToFit()
        case "looks": Image(systemName: "paintpalette.fill").resizable().scaledToFit()
        case "alerts": Image(systemName: "bell.fill").resizable().scaledToFit()
        case "print": Image(systemName: "printer.fill").resizable().scaledToFit()
        default: Image(systemName: "gearshape.fill").resizable().scaledToFit()
        }
    }
}

/// One card: its title and a small phone playing the real app.
private struct GuideCard: View {
    let id: String
    let lang: RamadanContent.Lang
    let first: Bool
    let on: Bool

    static let gold = Color(red: 0.97, green: 0.74, blue: 0.56)
    static let navy = Color(red: 0.08, green: 0.10, blue: 0.27)

    var body: some View {
        VStack(spacing: 0) {
            if first {
                Text(GuideWords.word(lang, "hello"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Self.gold)
                    .padding(.top, 8)
            }
            Text(GuideWords.word(lang, "\(id)_title"))
                .font(Theme.display(28, .heavy))
                .multilineTextAlignment(.center)
                .padding(.top, first ? 4 : 10)
                .padding(.bottom, 12)
            PhoneDemo(id: id, lang: lang, on: on)
        }
        .padding(.horizontal, 28)
        .opacity(on ? 1 : 0.4)
        .offset(y: on ? 0 : 12)
        .animation(.smooth(duration: 0.5), value: on)
    }
}

/// A small phone playing the real app: a gold box lights the button, a finger
/// glides to it and taps, and the next screen shows what the tap does. It plays
/// by itself; tapping the phone or a step number moves on.
private struct PhoneDemo: View {
    let id: String
    let lang: RamadanContent.Lang
    let on: Bool
    @State private var k = 0
    @State private var press = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var steps: [GuideWords.Step] { GuideWords.steps[id] ?? [] }

    var body: some View {
        let steps = self.steps
        let s = steps[min(k, steps.count - 1)]
        VStack(spacing: 0) {
            Button { k = (k + 1) % steps.count } label: {
                PhoneScreen(steps: steps, k: k, press: press, on: on && !reduceMotion)
            }
            .buttonStyle(.plain)
            .frame(maxHeight: 470)
            .accessibilityLabel(GuideWords.word(lang, s.say))
            .accessibilityHint(GuideWords.word(lang, "next"))
            Text(GuideWords.word(lang, s.say))
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .multilineTextAlignment(.center)
                .lineLimit(2, reservesSpace: true)
                .frame(maxWidth: 340)
                .padding(.top, 16)
                .id(k)
                .transition(.opacity)
                .accessibilityHidden(true)
            HStack(spacing: 8) {
                ForEach(0..<steps.count, id: \.self) { n in
                    Button { k = n } label: {
                        Text("\(n + 1)")
                            .font(.system(size: 12.5, weight: .heavy, design: .rounded))
                            .frame(width: 26, height: 26)
                            .foregroundStyle(n == k ? GuideCard.navy : n < k ? GuideCard.gold : Color.white.opacity(0.7))
                            .background(n == k ? GuideCard.gold : Color.clear, in: Circle())
                            .overlay(Circle().stroke(n == k ? GuideCard.gold : n < k ? GuideCard.gold.opacity(0.7) : Color.white.opacity(0.3), lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(GuideWords.word(lang, "step", ["n": "\(n + 1)", "t": "\(steps.count)"]))
                }
            }
            .padding(.top, 8).padding(.bottom, 10)
        }
        .animation(.easeInOut(duration: 0.35), value: k)
        .task(id: "\(on)-\(k)") {
            guard on else { k = 0; press = false; return }
            press = false
            let slow = reduceMotion ? 1.8 : 1.0
            if s.tap {
                try? await Task.sleep(for: .seconds(1.25 * slow))
                if Task.isCancelled { return }
                withAnimation(.easeOut(duration: 0.18)) { press = true }
                try? await Task.sleep(for: .seconds(1.05 * slow))
            } else {
                try? await Task.sleep(for: .seconds(2.7 * slow))
            }
            if Task.isCancelled { return }
            k = (k + 1) % steps.count
        }
    }
}

/// The phone itself: the app screens crossfading, the gold box, the ripple and the finger.
private struct PhoneScreen: View {
    let steps: [GuideWords.Step]
    let k: Int
    let press: Bool
    let on: Bool
    @State private var glow = false

    var body: some View {
        let s = steps[min(k, steps.count - 1)]
        ZStack {
            ForEach(Array(steps.enumerated()), id: \.offset) { n, st in
                Image("Guide-step-\(st.shot)").resizable().scaledToFill()
                    .opacity(n == k ? 1 : 0)
            }
        }
        .aspectRatio(393.0 / 852.0, contentMode: .fit)
        .overlay {
            GeometryReader { g in
                let w = g.size.width, h = g.size.height
                // The fingertip rests just under the box so the button stays in sight; on the tab bar it rests on the button.
                let low = s.y + s.h > 0.9
                let tip = CGPoint(x: (s.x + s.w / 2) * w, y: low ? (s.y + s.h / 2) * h : (s.y + s.h) * h + 4)
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(GuideCard.gold, lineWidth: 2.5)
                        .shadow(color: GuideCard.gold.opacity(glow ? 0.95 : 0.5), radius: glow ? 10 : 6)
                        .frame(width: s.w * w + 8, height: s.h * h + 8)
                        .position(x: (s.x + s.w / 2) * w, y: (s.y + s.h / 2) * h)
                    Circle().stroke(.white, lineWidth: 3)
                        .frame(width: 44, height: 44)
                        .keyframeAnimator(initialValue: 0.0, trigger: press) { view, v in
                            view.scaleEffect(0.3 + 1.2 * v).opacity(press && v > 0 && v < 1 ? 1 - v : 0)
                        } keyframes: { _ in
                            MoveKeyframe(0.0)
                            LinearKeyframe(1.0, duration: 0.7)
                        }
                        .position(x: (s.x + s.w / 2) * w, y: (s.y + s.h / 2) * h)
                    Image(systemName: "hand.point.up.left.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(.white)
                        .shadow(color: .black.opacity(0.5), radius: 3, y: 2)
                        .scaleEffect(press ? 0.82 : 1, anchor: .topLeading)
                        .position(x: tip.x + 11, y: tip.y + 14)
                }
                .animation(.smooth(duration: 0.65), value: k)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .padding(5)
        .background(Color(red: 0.15, green: 0.17, blue: 0.37), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .shadow(color: .black.opacity(0.5), radius: 22, y: 18)
        .animation(.easeInOut(duration: 0.45), value: k)
        .onAppear { glow = false; withAnimation(on ? .easeInOut(duration: 0.7).repeatForever() : nil) { glow = on } }
        .onChange(of: on) { _, now in withAnimation(now ? .easeInOut(duration: 0.7).repeatForever() : nil) { glow = now } }
        .accessibilityHidden(true)
    }
}
