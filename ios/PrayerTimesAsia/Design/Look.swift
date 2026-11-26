import SwiftUI

// The five looks' colours, ported one to one from the web app (web/src/ui/screens.css:
// the `.v12s` tokens read by Qibla, Falak, Masjid and Settings, and the `.v12` Prayer
// screen tokens). Every colour is dynamic, so it follows Light and Dark by itself.
// A look only changes colour, shape and its signature, never the layout of shared parts.

extension Color {
    /// 0xRRGGBB, with an optional opacity.
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255, opacity: opacity)
    }

    /// One colour on light, another on dark.
    static func dyn(_ light: Color, _ dark: Color) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light) })
    }

    static func dyn(_ light: UInt32, _ dark: UInt32) -> Color { dyn(Color(hex: light), Color(hex: dark)) }
}

extension EnvironmentValues {
    /// The look the person picked (Settings, Look and feel). Set once at the root.
    @Entry var look: TodayStyle = .centre
}

struct LookPalette {
    /// Words: main, second, third (web --s-tx, --s-tx2, --s-tx3).
    var tx: Color
    var tx2: Color
    var tx3: Color
    /// Cards on the page, their edge and the line between rows.
    var card: Color
    var stroke: Color
    var sep: Color
    /// The look's colour for shapes, for words, for the big button and the words on it.
    var ac: Color
    var actx: Color
    var btn: Color
    var onBtn: Color
    /// A soft wash of the accent (the current row, a picked chip).
    var tint: Color
    /// Card corners: 20 in every look, square in Colour Bands.
    var radius: CGFloat
    /// Falak sky card in daylight: top and bottom of the sky, the ground, the stick.
    var fk1: Color
    var fk2: Color
    var ground: Color
    var stick: Color
    /// The app accent (tab bar, links, menu icons): web --accent.
    var accent: Color

    static func of(_ look: TodayStyle) -> LookPalette {
        switch look {
        case .bands: bands
        case .gold: gold
        case .simple: simple
        default: base
        }
    }

    /// Centre Dial and Sun Path (and the retired looks).
    static let base = LookPalette(
        tx: .dyn(0x151A45, 0xEEF0FA), tx2: .dyn(0x4A5080, 0xB9C0E2), tx3: .dyn(0x6E7499, 0x8E97C4),
        card: .dyn(Color.white.opacity(0.62), Color.white.opacity(0.09)),
        stroke: .dyn(Color.white.opacity(0.75), Color.white.opacity(0.14)),
        sep: .dyn(Color(hex: 0x151A45, opacity: 0.09), Color.white.opacity(0.1)),
        ac: .dyn(0xC9622A, 0xF7BD8F), actx: .dyn(0xB2541F, 0xF7BD8F), btn: .dyn(0xB2541F, 0xF7BD8F),
        onBtn: .dyn(0xFFFFFF, 0x2A1500),
        tint: .dyn(Color(hex: 0xB2541F, opacity: 0.12), Color(hex: 0xF7BD8F, opacity: 0.16)),
        radius: 20,
        fk1: .dyn(0x8EB9E8, 0x241F66), fk2: .dyn(0xEAF1F8, 0x4D4B9C), ground: .dyn(0xE5CE98, 0x2D2C66), stick: .dyn(0x3A3A3A, 0xEEF0FA),
        accent: .dyn(0xB2541F, 0xF7BD8F))

    /// Big and Simple: stronger words, a firmer card.
    static let simple: LookPalette = {
        var p = base
        p.tx = .dyn(0x0E1236, 0xFFFFFF); p.tx2 = .dyn(0x2E345E, 0xDDE0F2); p.tx3 = .dyn(0x4B5078, 0xBEC4E2)
        p.card = .dyn(Color.white.opacity(0.8), Color.white.opacity(0.12))
        return p
    }()

    /// Colour Bands: flat charcoal (or warm paper), square corners, orange accent.
    static let bands = LookPalette(
        tx: .dyn(0x1D1D20, 0xF4F2EE), tx2: .dyn(0x55555C, 0xC7C7CC), tx3: .dyn(0x80808A, 0x98989E),
        card: .dyn(0xFFFFFF, 0x2C2C30),
        stroke: .dyn(Color.black.opacity(0.08), Color.white.opacity(0.08)),
        sep: .dyn(Color.black.opacity(0.09), Color.white.opacity(0.1)),
        ac: .dyn(0xC4691C, 0xF2A65A), actx: .dyn(0xA9560F, 0xF2A65A), btn: .dyn(0xA9560F, 0xF2A65A),
        onBtn: .dyn(0xFFFFFF, 0x1A1000),
        tint: .dyn(Color(hex: 0xC4691C, opacity: 0.12), Color(hex: 0xF2A65A, opacity: 0.16)),
        radius: 0,
        fk1: .dyn(0x3A6F63, 0x3A6F63), fk2: .dyn(0x3A6F63, 0x3A6F63), ground: .dyn(0xAB8D3A, 0xAB8D3A), stick: .dyn(0xFFFFFF, 0xFFFFFF),
        accent: .dyn(0xA9560F, 0xF2A65A))

    /// Calm Gold: flat navy (or warm white) and one gold accent.
    static let gold = LookPalette(
        tx: .dyn(0x151A45, 0xEEF0FA), tx2: .dyn(0x5B6188, 0xA9B2D6), tx3: .dyn(0x8B90AE, 0x7E88B3),
        card: .dyn(Color.white, Color.white.opacity(0.07)),
        stroke: .dyn(Color(hex: 0x151A45, opacity: 0.07), Color.white.opacity(0.09)),
        sep: .dyn(Color(hex: 0x151A45, opacity: 0.08), Color.white.opacity(0.08)),
        ac: .dyn(0xE2B65A, 0xE2B65A), actx: .dyn(0x8A6410, 0xE2B65A), btn: .dyn(0xE2B65A, 0xE2B65A),
        onBtn: .dyn(0x151100, 0x151100),
        tint: .dyn(Color(hex: 0xE2B65A, opacity: 0.2), Color(hex: 0xE2B65A, opacity: 0.14)),
        radius: 20,
        fk1: .dyn(0xF6F2E8, 0x0B0F2A), fk2: .dyn(0xFBFAF7, 0x1C2258), ground: .dyn(0xEADFC0, 0x151A45), stick: .dyn(0x151A45, 0xEEF0FA),
        accent: .dyn(0x8A6A14, 0xD4B25A))

    /// Calm Gold's small icons and dots on white: a deeper gold so they stay visible.
    static let goldIcon = Color.dyn(0xA87A12, 0xE2B65A)
}

extension TodayStyle {
    var palette: LookPalette { LookPalette.of(self) }
}

/// What sits behind every tab: the Living Sky, Colour Bands' flat page, or Calm Gold's
/// flat navy (warm white in Light).
struct LookBackdrop: View {
    @Environment(\.look) private var look
    var sky: SkyColors

    var body: some View {
        switch look {
        case .bands:
            Color.dyn(0xF2F0EB, 0x232326).ignoresSafeArea()
        case .gold:
            LinearGradient(colors: [.dyn(0xFBFAF7, 0x0B0F2A), .dyn(0xF1EEE8, 0x151A45)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
        default:
            LivingSkyBackground(colors: sky)
        }
    }
}

/// A card in the look's colours: the glass card on the sky, a flat card in Colour Bands
/// (square) and Calm Gold.
struct LookCard: ViewModifier {
    @Environment(\.look) private var look
    var padding: CGFloat = 16

    func body(content: Content) -> some View {
        let p = look.palette
        let shape = RoundedRectangle(cornerRadius: p.radius, style: .continuous)
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                if look == .bands || look == .gold {
                    shape.fill(p.card)
                } else {
                    ZStack { shape.fill(.ultraThinMaterial); shape.fill(p.card) }
                }
            }
            .overlay(shape.strokeBorder(p.stroke, lineWidth: 1))
    }
}

extension View {
    func lookCard(padding: CGFloat = 16) -> some View { modifier(LookCard(padding: padding)) }
}

/// A fixed point size from the web look that still grows with the phone's text size
/// (the same scale the Prayer screen uses).
private struct LookFont: ViewModifier {
    @Environment(\.dynamicTypeSize) private var typeSize
    var size: CGFloat
    var weight: Font.Weight
    var design: Font.Design

    func body(content: Content) -> some View {
        content.font(.system(size: size * V12Type.scale(typeSize), weight: weight, design: design))
    }
}

extension View {
    func lookFont(_ size: CGFloat, _ weight: Font.Weight = .regular, design: Font.Design = .default) -> some View {
        modifier(LookFont(size: size, weight: weight, design: design))
    }
}
