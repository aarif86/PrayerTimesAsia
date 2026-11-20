import SwiftUI

/// The app is free and built fisabilillah in Singapore by Ustaz Aarif Raziff and Ustazah Nasibah Hamzah, with Nasar Digital (Nasar Pte Ltd).
/// The cards are our own services and, from time to time, a hand picked halal
/// sponsor for the user's country (CommunityCard, data/community-cards.json).
/// No outside ads, nothing tracked: each card just opens the website.
/// The name of the card space. One place to change it (Makers.tsx and Makers.kt have the same).
let picksName = "Barakah Picks"

extension AppModel {
    /// Where the user lives, for which cards are relevant: home country, else where they are now.
    var offerCountry: String { prefs.home?.countryCode ?? profile.code }
}

/// A slim card that opens the offer's website.
struct MakersCard: View {
    let card: CommunityCard
    let placement: String
    /// One line, for the Prayer screen where every point of height counts.
    var compact = false
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button {
            model.countCard(.tapped, card: card, placement: placement)
            openURL(card.url(from: placement))
        } label: {
            HStack(spacing: 12) {
                Group {
                    switch card.icon {
                    case .kaaba: KaabaGlyph().frame(width: compact ? 15 : 18, height: compact ? 15 : 18)
                    case .globe: Image(systemName: "globe")
                    case .shop: Image(systemName: "storefront")
                    case .heart: Image(systemName: "heart")
                    }
                }
                .font(.subheadline.weight(.semibold)).foregroundStyle(Theme.accentText)
                .frame(width: compact ? 28 : 34, height: compact ? 28 : 34)
                .background(Theme.accent.opacity(0.18), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(card.isSponsor ? "\(picksName) · Sponsored" : picksName)
                        .textCase(.uppercase).font(.system(size: 10, weight: .bold)).tracking(0.6).foregroundStyle(.secondary)
                    Text(card.title).font(.subheadline.weight(.semibold)).lineLimit(1)
                    if !compact {
                        Text(card.subtitle).font(.caption).foregroundStyle(.secondary)
                            .lineLimit(2).multilineTextAlignment(.leading)
                    }
                }
                Spacer(minLength: 4)
                Text(card.site).font(.caption.weight(.semibold)).foregroundStyle(Theme.accentText)
                Image(systemName: "arrow.up.right").font(.caption2.weight(.bold)).foregroundStyle(Theme.accentText)
            }
            .padding(.horizontal, 12).padding(.vertical, compact ? 6 : 9)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .onAppear { model.countCard(.seen, card: card, placement: placement) }
        .accessibilityLabel("\(picksName)\(card.isSponsor ? ", sponsored" : ""). \(card.title)")
        .accessibilityHint("Opens \(card.site) in Safari")
    }
}

/// Today's one community card, below the times and only with Show more open
/// (docs/community-cards.md). Never in the half hour before Berbuka in Ramadan.
struct CommunityCardSlot: View {
    @Environment(AppModel.self) private var model
    let now: Date
    let next: (prayer: Prayer, time: Date)?

    var body: some View {
        if let card = CommunityCard.ofTheDay(for: model.offerCountry, on: now), !nearBerbuka {
            MakersCard(card: card, placement: "prayer", compact: true)
        }
    }

    private var nearBerbuka: Bool {
        guard let next, next.prayer == .maghrib, next.time.timeIntervalSince(now) < 30 * 60 else { return false }
        return model.season(at: now).phase == .ramadan
    }
}

/// "About" behind the (i) on the Masjid tab: who built the app, and their services.
struct MakersSheet: View {
    let placement: String
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    HadithView(id: .fixedTimes, tag: "Al Quran")
                    Text("Built fisabilillah").font(Theme.display(26, .bold))
                    Text("Prayer Times Asia is free, with no outside ads and nothing tracked. It is built and looked after by Ustaz Aarif Raziff and Ustazah Nasibah Hamzah, with the team at Nasar Digital (Nasar Pte Ltd).")
                        .foregroundStyle(.secondary)
                    ForEach(CommunityCard.ours(for: model.offerCountry)) { card in
                        MakersCard(card: card, placement: placement)
                    }
                }
                .padding(Theme.gutter)
            }
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}
