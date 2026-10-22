import SwiftUI

/// The large Home Screen widget, as it will look, with how to add it.
struct WidgetPreviewView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.55, green: 0.66, blue: 0.68), Color(red: 0.45, green: 0.5, blue: 0.62)],
                           startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()
            VStack(spacing: 20) {
                TimetableCard(snapshot: WidgetBridge.snapshot(model), date: .now)
                    .frame(width: 338, height: 354)
                    .background(Color(white: 0.13))
                    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                    .shadow(color: .black.opacity(0.25), radius: 16, y: 8)
                Text("Touch and hold your Home Screen, tap Edit, then Add Widget and search for Prayer Times Asia. Choose \"Today's timetable\".")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 32)
            }
        }
        .navigationTitle("Big widget")
        .navigationBarTitleDisplayMode(.inline)
    }
}
