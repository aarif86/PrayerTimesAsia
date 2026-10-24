import SwiftUI

/// The large Home Screen widget, as it will look in each style, with how to add it.
struct WidgetPreviewView: View {
    @Environment(AppModel.self) private var model
    @State private var style: TodayStyle?

    var body: some View {
        let style = self.style ?? demoStyle ?? model.prefs.todayStyle
        ZStack {
            LinearGradient(colors: [Color(red: 0.55, green: 0.66, blue: 0.68), Color(red: 0.45, green: 0.5, blue: 0.62)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            VStack(spacing: 20) {
                Picker("Style", selection: Binding(get: { style }, set: { self.style = $0 })) {
                    ForEach(TodayStyle.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 20)
                let snapshot = WidgetBridge.snapshot(model)
                TimetableCard(snapshot: snapshot, date: .now, style: style)
                    .frame(width: 338, height: 354)
                    .background(TimetableCard.background(snapshot, at: .now, style: style))
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .shadow(color: .black.opacity(0.25), radius: 16, y: 8)
                Text("Touch and hold your Home Screen, tap Edit, then Add Widget and search for Prayer Times Asia. Choose \"Today's timetable\". It follows your Prayer screen style; touch and hold it, then Edit Widget, to pick another.")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 32)
            }
        }
        .navigationTitle("Big widget")
        .navigationBarTitleDisplayMode(.inline)
    }

    /// `-widget-style <style>` (CI screenshots).
    private var demoStyle: TodayStyle? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-widget-style"), i + 1 < args.count else { return nil }
        return TodayStyle(rawValue: args[i + 1])
    }
}
