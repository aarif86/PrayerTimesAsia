import SwiftUI

/// The five looks' colours for the widgets and their preview, taken from the Prayer
/// screen's looks (Look.swift in the app). Every colour is dynamic, so a widget follows
/// Light and Dark by itself. Lives in Shared because the widget extension does not
/// compile the app's Design folder.
struct WidgetPal {
    var fg: Color
    var fg2: Color
    /// The card behind the prayer list.
    var card: Color
    /// The highlighted row (the next prayer).
    var cur: Color
    /// Words and shapes in the look's accent (the countdown, the gold dot).
    var acc: Color
    /// Colour Bands header and date bar, Calm Gold ring.
    var bar: Color
    /// Big and Simple's prayer name.
    var hero: Color

    static func of(_ style: TodayStyle) -> WidgetPal {
        switch style.look {
        case .bands:
            WidgetPal(fg: .wdyn(0x1D1D20, 0xF4F2EE), fg2: .wdyn(0x55555C, 0xC7C7CC), card: .clear,
                      cur: .clear, acc: .wdyn(0xA9560F, 0xF2A65A), bar: .wdyn(0xE4E1DA, 0x3D3D3D), hero: .wdyn(0x1D1D20, 0xF4F2EE))
        case .gold:
            WidgetPal(fg: .wdyn(0x151A45, 0xEEF0FA), fg2: .wdyn(0x5B6188, 0xA9B2D6),
                      card: .wdyn(Color.white, Color.white.opacity(0.07)),
                      cur: .wdyn(Color(hex6: 0x8A6A14, 0.14), Color(hex6: 0xE2B65A, 0.16)),
                      acc: .wdyn(0x8A6A14, 0xD4B25A), bar: .wdyn(0x8A6A14, 0xD4B25A), hero: .wdyn(0x151A45, 0xEEF0FA))
        case .simple:
            WidgetPal(fg: .wdyn(0x0E1236, 0xFFFFFF), fg2: .wdyn(0x2E345E, 0xDDE0F2),
                      card: .wdyn(Color.white.opacity(0.8), Color.white.opacity(0.12)),
                      cur: .wdyn(Color(hex6: 0x151A45, 0.12), Color.white.opacity(0.2)),
                      acc: .wdyn(0xB2541F, 0xF7BD8F), bar: .clear, hero: .wdyn(0x4B3CBF, 0xB2A8FF))
        default:
            WidgetPal(fg: .wdyn(0x151A45, 0xEEF0FA), fg2: .wdyn(0x4A5080, 0xB9C0E2),
                      card: .wdyn(Color.white.opacity(0.62), Color.white.opacity(0.1)),
                      cur: .wdyn(Color(hex6: 0x151A45, 0.12), Color.white.opacity(0.2)),
                      acc: .wdyn(0xB2541F, 0xF7BD8F), bar: .clear, hero: .wdyn(0x151A45, 0xEEF0FA))
        }
    }
}

extension Color {
    init(hex6 hex: UInt32, _ opacity: Double = 1) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255, opacity: opacity)
    }
    static func wdyn(_ light: Color, _ dark: Color) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light) })
    }
    static func wdyn(_ light: UInt32, _ dark: UInt32) -> Color { wdyn(Color(hex6: light), Color(hex6: dark)) }
}

/// What sits behind a widget: the Living Sky (washed bright in Light), Colour Bands' flat
/// page, or Calm Gold's flat navy (warm white in Light).
struct WidgetBackdrop: View {
    @Environment(\.colorScheme) private var scheme
    let snapshot: WidgetSnapshot?
    let date: Date
    let style: TodayStyle

    var body: some View {
        switch style.look {
        case .bands:
            Color.wdyn(0xF2F0EB, 0x232326)
        case .gold:
            LinearGradient(colors: [.wdyn(0xFBFAF7, 0x0B0F2A), .wdyn(0xF1EEE8, 0x151A45)], startPoint: .top, endPoint: .bottom)
        default:
            let base = snapshot?.day(containing: date).map { SkyColors.at(date, day: $0) } ?? .night
            let c = scheme == .light ? base.daylight : base.readable
            ZStack {
                LinearGradient(colors: [c.top.color, c.bottom.color], startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [c.glow.color.opacity(scheme == .light ? 0.12 : 0.2), .clear],
                               center: UnitPoint(x: 0.5, y: 1.1), startRadius: 4, endRadius: 260)
            }
        }
    }
}
