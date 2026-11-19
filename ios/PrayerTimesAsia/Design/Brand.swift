import SwiftUI

/// The app icon's look, carried inside the app: the navy compass ring, the faint
/// fine-line kawung batik and the cream hand-stitching (brand guide, November 2026).
/// Kawung only ever sits on solid navy, never behind body text on the sky.
enum Brand {
    static let nightNavy = Color(red: 0x15 / 255, green: 0x1A / 255, blue: 0x45 / 255)
    static let duskIndigo = Color(red: 0x3A / 255, green: 0x34 / 255, blue: 0x80 / 255)
    static let compassRing = Color(red: 0x26 / 255, green: 0x2B / 255, blue: 0x5E / 255)
    static let stitchCream = Color(red: 0xF2 / 255, green: 0xEE / 255, blue: 0xE9 / 255)
    static let stitchThread = Color(red: 0xF2 / 255, green: 0xE6 / 255, blue: 0xCF / 255)
    static let moonText = Color(red: 0xEE / 255, green: 0xF0 / 255, blue: 0xFA / 255)
    /// The N on the navy ring: the icon's coral, a touch lighter so it reads at text size (5.5:1).
    static let northOnRing = Color(red: 0xF2 / 255, green: 0x8B / 255, blue: 0x78 / 255)
    /// Width of the navy compass ring on the Qibla dial. N E S W and the Ka'bah sit on it.
    static let bezel: CGFloat = 58
}

/// Fine-line kawung batik: four ellipse petals and a dot, on a 45° grid, like the icon.
struct KawungPattern: View {
    var tile: CGFloat = 18
    var color: Color = .white

    var body: some View {
        Canvas { ctx, size in
            let s = tile / 40
            var petals = Path()
            for (cx, cy, rx, ry) in [(20.0, 10.0, 5.6, 9.2), (20.0, 30.0, 5.6, 9.2), (10.0, 20.0, 9.2, 5.6), (30.0, 20.0, 9.2, 5.6)] {
                petals.addEllipse(in: CGRect(x: (cx - rx) * s, y: (cy - ry) * s, width: 2 * rx * s, height: 2 * ry * s))
            }
            let dot = Path(ellipseIn: CGRect(x: 18.2 * s, y: 18.2 * s, width: 3.6 * s, height: 3.6 * s))
            ctx.translateBy(x: size.width / 2, y: size.height / 2)
            ctx.rotate(by: .degrees(45))
            let n = Int((hypot(size.width, size.height) / tile / 2).rounded(.up)) + 1
            for gx in -n...n {
                for gy in -n...n {
                    let move = CGAffineTransform(translationX: CGFloat(gx) * tile, y: CGFloat(gy) * tile)
                    ctx.stroke(petals.applying(move), with: .color(color), lineWidth: 1.8 * s)
                    ctx.fill(dot.applying(move), with: .color(color))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

/// A ring between two radii, centred in its frame.
struct RingBand: Shape {
    let outer: CGFloat
    let inner: CGFloat

    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.addEllipse(in: CGRect(x: rect.midX - outer, y: rect.midY - outer, width: 2 * outer, height: 2 * outer))
        p.addEllipse(in: CGRect(x: rect.midX - inner, y: rect.midY - inner, width: 2 * inner, height: 2 * inner))
        return p
    }
}

/// The icon's compass ring for the Qibla dial: cream edge, navy band, kawung at 20%, stitches on both edges.
struct CompassBezel: View {
    let size: CGFloat

    var body: some View {
        let outer = size / 2 - 3, inner = size / 2 - Brand.bezel
        let stitch = StrokeStyle(lineWidth: 1.4, lineCap: .round, dash: [4, 3.2])
        ZStack {
            Circle().stroke(Brand.stitchCream, lineWidth: 3).frame(width: 2 * outer + 3, height: 2 * outer + 3)
            RingBand(outer: outer, inner: inner).fill(Brand.compassRing, style: FillStyle(eoFill: true))
            KawungPattern().opacity(0.2).clipShape(RingBand(outer: outer, inner: inner), style: FillStyle(eoFill: true))
            Circle().stroke(Brand.stitchThread.opacity(0.5), style: stitch).frame(width: 2 * (outer - 5), height: 2 * (outer - 5))
            Circle().stroke(Brand.stitchThread.opacity(0.5), style: stitch).frame(width: 2 * (inner + 5), height: 2 * (inner + 5))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

/// The card at the top of Settings: the app icon on navy with kawung and stitching.
struct AppCard: View {
    var body: some View {
        HStack(spacing: 14) {
            Image("AppIconImage")
                .resizable()
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                .shadow(color: .black.opacity(0.3), radius: 7, y: 4)
            VStack(alignment: .leading, spacing: 2) {
                Text("Prayer Times Asia").font(.title3.weight(.bold)).foregroundStyle(.white)
                Text("Built fisabilillah in Singapore").font(.subheadline).foregroundStyle(Brand.moonText.opacity(0.88))
                Text("Version \(Bundle.main.appVersion)").font(.footnote).foregroundStyle(Brand.moonText.opacity(0.75))
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Brand.moonText.opacity(0.75))
        }
        .padding(18)
        .background {
            ZStack {
                Brand.compassRing
                KawungPattern().opacity(0.16)
            }
        }
        .overlay {
            RoundedRectangle(cornerRadius: 17, style: .continuous)
                .strokeBorder(Brand.stitchThread.opacity(0.45), style: StrokeStyle(lineWidth: 1.4, dash: [4, 3.2]))
                .padding(6)
        }
        .clipShape(RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
        .environment(\.colorScheme, .dark)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Sources and credits")
    }
}

