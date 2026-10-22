import CoreMotion
import SwiftUI

/// A spirit level for the shadow stick. Lay the phone flat where the stick
/// will stand to check the ground; stand it on its edge against the stick to
/// check the stick is vertical. A tilt of 1° moves a 1 m stick's shadow tip
/// by about 1.7 cm - enough to shift a reading by a minute.
struct LevelView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var motion = LevelMotion()

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Picker("Check", selection: $motion.mode) {
                    Text("Ground (phone flat)").tag(LevelMotion.Mode.flat)
                    Text("Stick (phone upright)").tag(LevelMotion.Mode.upright)
                }
                .pickerStyle(.segmented)

                ZStack {
                    Circle().strokeBorder(Color.primary.opacity(0.25), lineWidth: 2)
                    Circle().strokeBorder(Color.primary.opacity(0.4), lineWidth: 1).frame(width: 60, height: 60)
                    Circle()
                        .fill(motion.isLevel ? Color.green : Color.orange)
                        .frame(width: 44, height: 44)
                        .offset(x: motion.bubble.width * 110, y: motion.bubble.height * 110)
                        .animation(.interpolatingSpring(stiffness: 120, damping: 14), value: motion.bubble)
                }
                .frame(width: 260, height: 260)

                VStack(spacing: 6) {
                    Text(motion.available ? String(format: "%.1f°", motion.tilt) : "-")
                        .font(Theme.display(54, .bold)).monospacedDigit()
                    Text(motion.available
                         ? (motion.isLevel ? "Level - good for a reading" : "Not level yet - adjust until the bubble turns green")
                         : "This device has no motion sensor.")
                        .font(.headline)
                        .foregroundStyle(motion.isLevel ? Color.green : Color.primary)
                }
                Text(motion.mode == .flat
                     ? "Lay the phone flat where the stick will stand. Within 0.5° is good."
                     : "Hold the phone's long edge against the stick. Within 0.5° of vertical is good.")
                    .font(.footnote).multilineTextAlignment(.center).opacity(0.75)
                Spacer()
            }
            .padding(24)
            .sensoryFeedback(.success, trigger: motion.isLevel) { _, now in now }
            .navigationTitle("Level")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .onAppear { motion.start() }
            .onDisappear { motion.stop() }
        }
    }
}

@MainActor
@Observable
final class LevelMotion {
    enum Mode: Hashable { case flat, upright }

    var mode: Mode = .flat
    private(set) var tilt: Double = 0
    /// -1...1 offset of the bubble.
    private(set) var bubble: CGSize = .zero
    var isLevel: Bool { available && tilt < 0.5 }
    var available: Bool { manager.isDeviceMotionAvailable }

    @ObservationIgnored private let manager = CMMotionManager()

    func start() {
        guard manager.isDeviceMotionAvailable else { return }
        manager.deviceMotionUpdateInterval = 1 / 30
        manager.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
            guard let g = data?.gravity else { return }
            MainActor.assumeIsolated { self?.update(g) }
        }
    }

    func stop() { manager.stopDeviceMotionUpdates() }

    private func update(_ g: CMAcceleration) {
        switch mode {
        case .flat:
            // Face up and flat: gravity is (0, 0, -1).
            tilt = acos(min(1, max(-1, -g.z))) * 180 / .pi
            bubble = CGSize(width: max(-1, min(1, -g.x * 4)), height: max(-1, min(1, g.y * 4)))
        case .upright:
            // Standing on its bottom edge: gravity is (0, -1, 0).
            tilt = acos(min(1, max(-1, -g.y))) * 180 / .pi
            bubble = CGSize(width: max(-1, min(1, -g.x * 4)), height: max(-1, min(1, g.z * 4)))
        }
    }
}
