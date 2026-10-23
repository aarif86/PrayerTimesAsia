import ARKit
import Combine
import RealityKit
import SwiftUI

/// Falak through the camera: on the floor in front of you, a virtual tongkat
/// istiwa', the shadow it should cast right now, and the qibla line. If real
/// shadows around you lie along the virtual one, the qibla line is right too -
/// the sun checks the phone's compass.
struct FalakARScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .bottom) {
            if ARWorldTrackingConfiguration.isSupported, let place = model.activePlace {
                TimelineView(.periodic(from: .now, by: 15)) { context in
                    let sun = Falak.sunPosition(at: context.date, coordinates: place.coordinates)
                    FalakARView(qibla: Geo.qiblaBearing(from: place.coordinates), sun: sun)
                        .ignoresSafeArea()
                }
            } else {
                Color.black.ignoresSafeArea()
                VStack(spacing: 10) {
                    Image(systemName: "arkit").font(.system(size: 44))
                    Text("Needs a camera with AR").font(.headline)
                    Text("This view uses the camera to draw the qibla and the stick's shadow on the floor. It isn't available on this device.")
                        .font(.footnote).multilineTextAlignment(.center).opacity(0.8)
                }
                .foregroundStyle(.white)
                .padding(32)
                .frame(maxHeight: .infinity)
            }
            legend
        }
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.headline).frame(width: 40, height: 40)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .padding(16)
            .accessibilityLabel("Close")
        }
    }

    private var legend: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Point the camera at the floor until the stick appears.")
                .font(.subheadline.weight(.semibold))
            Label("Gold line: the qibla", systemImage: "line.diagonal").foregroundStyle(Theme.gold)
            Label("Dark bar: where a stick's shadow falls right now", systemImage: "line.diagonal")
            Text("Outdoors in sunshine, real shadows should lie along the dark bar. If they don't, move away from metal and wave the phone in a figure-8 to recalibrate the compass. Never look at the sun.")
                .font(.caption).opacity(0.85)
        }
        .font(.footnote)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
    }
}

private struct FalakARView: UIViewRepresentable {
    let qibla: Double
    let sun: Falak.SunPosition

    final class Coordinator {
        /// Kept turned to true north every frame, whatever way the plane anchor faces.
        let compass = Entity()
        let shadow = ModelEntity()
        var updates: Cancellable?
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> ARView {
        let view = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
        let config = ARWorldTrackingConfiguration()
        // y up, -z true north (from the compass), x east.
        config.worldAlignment = .gravityAndHeading
        config.planeDetection = [.horizontal]
        view.session.run(config)

        let anchor = AnchorEntity(plane: .horizontal, minimumBounds: [0.2, 0.2])
        let c = context.coordinator
        anchor.addChild(c.compass)

        let stickHeight: Float = 0.3
        let stick = ModelEntity(mesh: .generateBox(size: [0.012, stickHeight, 0.012], cornerRadius: 0.004),
                                materials: [SimpleMaterial(color: .white, isMetallic: false)])
        stick.position = [0, stickHeight / 2, 0]
        c.compass.addChild(stick)

        let qiblaLength: Float = 1.2
        let line = ModelEntity(mesh: .generateBox(size: [0.02, 0.002, qiblaLength]),
                               materials: [SimpleMaterial(color: UIColor(red: 1, green: 0.84, blue: 0.5, alpha: 1), isMetallic: true)])
        let kaaba = ModelEntity(mesh: .generateBox(size: 0.06, cornerRadius: 0.004),
                                materials: [SimpleMaterial(color: .black, isMetallic: false)])
        Self.lay(line, bearing: qibla, length: qiblaLength)
        kaaba.position = Self.direction(qibla) * qiblaLength
        kaaba.position.y = 0.03
        c.compass.addChild(line)
        c.compass.addChild(kaaba)

        c.shadow.model = ModelComponent(mesh: .generateBox(size: [0.03, 0.001, 1]),
                                        materials: [SimpleMaterial(color: UIColor(white: 0, alpha: 0.6), isMetallic: false)])
        c.compass.addChild(c.shadow)
        updateShadow(c.shadow, stickHeight: stickHeight)

        view.scene.addAnchor(anchor)
        let compass = c.compass
        c.updates = view.scene.subscribe(to: SceneEvents.Update.self) { _ in
            compass.setOrientation(simd_quatf(angle: 0, axis: [0, 1, 0]), relativeTo: nil)
        }
        return view
    }

    func updateUIView(_ view: ARView, context: Context) {
        updateShadow(context.coordinator.shadow, stickHeight: 0.3)
    }

    static func dismantleUIView(_ view: ARView, coordinator: Coordinator) {
        coordinator.updates?.cancel()
        view.session.pause()
    }

    private func updateShadow(_ shadow: ModelEntity, stickHeight: Float) {
        guard sun.altitude > 1 else { shadow.isEnabled = false; return }
        shadow.isEnabled = true
        let length = min(2, Float(Falak.shadowLength(height: Double(stickHeight), altitude: sun.altitude)))
        shadow.scale = [1, 1, length]
        Self.lay(shadow, bearing: sun.azimuth + 180, length: length)
    }

    /// Unit vector along the floor for a compass bearing (x east, -z north).
    private static func direction(_ bearing: Double) -> SIMD3<Float> {
        let b = Float(bearing * .pi / 180)
        return [sin(b), 0, -cos(b)]
    }

    /// Turn a box whose length runs along z so it starts at the stick and points along `bearing`.
    private static func lay(_ entity: ModelEntity, bearing: Double, length: Float) {
        entity.orientation = simd_quatf(angle: -Float(bearing * .pi / 180), axis: [0, 1, 0])
        entity.position = direction(bearing) * (length / 2)
        entity.position.y = 0.001
    }
}
