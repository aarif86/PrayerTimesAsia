import SwiftUI

/// The app is free and built fisabilillah by Nasar Pte Ltd. The only promotion
/// in it is for the makers' own services - no ad networks, nothing tracked:
/// each card just opens the website, which has the WhatsApp contact.
enum MakersOffer: String, CaseIterable, Identifiable {
    case badal, digital
    var id: String { rawValue }

    var title: String {
        switch self {
        case .badal: "Badal Haji & Umrah"
        case .digital: "NasarDigital"
        }
    }

    var subtitle: String {
        switch self {
        case .badal: "Performed in Makkah for loved ones who have passed on or cannot go"
        case .digital: "Digital marketing from the team behind this app"
        }
    }

    var symbol: String {
        switch self {
        case .badal: "building.columns.fill"
        case .digital: "megaphone.fill"
        }
    }

    var site: String {
        switch self {
        case .badal: "Badal.sg"
        case .digital: "nasardigital.com"
        }
    }

    /// The website, tagged with where in the app it was tapped so visits show
    /// in the site's own analytics. The app itself records nothing.
    func url(from placement: String) -> URL {
        let base = switch self {
        case .badal: "https://badal.sg"
        case .digital: "https://nasardigital.com"
        }
        return URL(string: "\(base)/?utm_source=prayertimesasia&utm_medium=app&utm_campaign=\(placement)")!
    }

    /// Badal is offered to Singaporeans for now (Badal.my is coming); everyone
    /// else sees NasarDigital.
    static func featured(for country: String) -> MakersOffer {
        country == "SG" ? .badal : .digital
    }
}

extension AppModel {
    /// Where the user lives, for which offer is relevant: home country, else where they are now.
    var offerCountry: String { prefs.home?.countryCode ?? profile.code }
}

/// A slim card that opens the offer's website.
struct MakersCard: View {
    let offer: MakersOffer
    let placement: String

    var body: some View {
        Link(destination: offer.url(from: placement)) {
            HStack(spacing: 12) {
                Image(systemName: offer.symbol)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.accent)
                    .frame(width: 34, height: 34)
                    .background(Theme.accent.opacity(0.18), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 1) {
                    Text(offer.title).font(.subheadline.weight(.semibold))
                    Text(offer.subtitle).font(.caption).foregroundStyle(.secondary)
                        .lineLimit(2).multilineTextAlignment(.leading)
                }
                Spacer(minLength: 4)
                Text(offer.site).font(.caption.weight(.semibold)).foregroundStyle(Theme.accent)
                Image(systemName: "arrow.up.right").font(.caption2.weight(.bold)).foregroundStyle(Theme.accent)
            }
            .padding(.horizontal, 12).padding(.vertical, 9)
            .background(Color.primary.opacity(0.06), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens \(offer.site) in Safari")
    }
}
