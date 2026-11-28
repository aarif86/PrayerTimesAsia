import SwiftUI

/// The large Home Screen widget, as it will look in each of the five looks, with how to add it.
struct WidgetPreviewView: View {
    @Environment(AppModel.self) private var model
    @State private var style: TodayStyle?

    var body: some View {
        let style = (self.style ?? demoStyle ?? model.prefs.todayStyle).look
        let snapshot = WidgetBridge.snapshot(model)
        ScrollView {
            VStack(spacing: 18) {
                // The five looks by their full names, side by side, so none is cut short.
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(TodayStyle.looks) { look in
                            Button { self.style = look } label: {
                                Text(look.label)
                                    .font(.system(size: 15, weight: .semibold))
                                    .padding(.horizontal, 14).padding(.vertical, 8)
                                    .background(look == style ? Color.primary.opacity(0.16) : Color.primary.opacity(0.06), in: Capsule())
                                    .foregroundStyle(.primary)
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(look == style ? .isSelected : [])
                        }
                    }
                    .padding(.horizontal, 20)
                }
                TimetableCard(snapshot: snapshot, date: .now, style: style)
                    .frame(width: 338, height: 354)
                    .background(TimetableCard.background(snapshot, at: .now, style: style))
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .shadow(color: .black.opacity(0.2), radius: 14, y: 6)
                Text(W("phone.widget.howTo"))
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }
            .padding(.vertical, 12)
        }
        .background(SkyNow())
        .navigationTitle(W("widget.big"))
        .navigationBarTitleDisplayMode(.inline)
    }

    /// `-widget-style <style>` (CI screenshots).
    private var demoStyle: TodayStyle? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-widget-style"), i + 1 < args.count else { return nil }
        return TodayStyle(rawValue: args[i + 1])
    }
}
