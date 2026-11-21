#if targetEnvironment(macCatalyst)
import SwiftUI

/// Mouse manners on a Mac: a row lights up softly while the pointer is over it,
/// so it is clear what a click will act on.
struct MacHover: ViewModifier {
    var corner: CGFloat = 12
    @State private var over = false

    func body(content: Content) -> some View {
        content
            .background(RoundedRectangle(cornerRadius: corner, style: .continuous)
                .fill(Color.primary.opacity(over ? 0.07 : 0)))
            .onHover { inside in withAnimation(.easeOut(duration: 0.12)) { over = inside } }
    }
}
#endif
