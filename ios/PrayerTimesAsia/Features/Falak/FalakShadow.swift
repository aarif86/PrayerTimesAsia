import AVFoundation
import CoreMotion
import SwiftUI

// Falak for everyone (Nov 2026): your own body is the shadow stick.
// Shadow steps (count heel to toe, nothing to type) and the shadow camera
// (point the phone at your shadow and tap its head). Works with no signal.
// Same maths as web core/falak.ts and web/src/ui/FalakShadow.tsx.

// MARK: - Shadow steps

struct ShadowStepsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                if let place = model.activePlace {
                    let ymd = model.ymd(.now)
                    let plan = Falak.shadowDay(year: ymd.0, month: ymd.1, day: ymd.2, coordinates: place.coordinates)
                    let target = Falak.asrSteps(plan, school: model.asrSchool)
                    let asr = Prayer.asr.name(model.naming)
                    VStack(spacing: 20) {
                        VStack(spacing: 4) {
                            Text("\(asr) begins when your shadow reaches")
                                .font(.subheadline).opacity(0.75).multilineTextAlignment(.center)
                            Text(Falak.stepsText(target))
                                .font(Theme.display(96, .bold)).monospacedDigit()
                                .foregroundStyle(Theme.gold)
                            Text("steps").font(.title3.weight(.semibold))
                            Text("Today in \(place.name)").font(.footnote).opacity(0.6)
                        }
                        .padding(.top, 8)
                        .accessibilityElement(children: .combine)

                        StepsPicture().frame(height: 120).accessibilityHidden(true)

                        VStack(spacing: 0) {
                            step(1, "Stand with the sun behind you", "Your shadow falls ahead of you.")
                            Divider().padding(.leading, 56)
                            step(2, "Mark where your head's shadow ends", "A slipper or a stone is enough.")
                            Divider().padding(.leading, 56)
                            step(3, "Walk to it, heel to toe", "Count each foot as you go.")
                            Divider().padding(.leading, 56)
                            step(4, "Compare with \(Falak.stepsText(target))", "More steps means \(asr) has begun.")
                        }
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.corner, style: .continuous))

                        Text("A person is about 7 of their own feet tall, so this works for anyone, tall or short.")
                            .font(.footnote).opacity(0.75).frame(maxWidth: .infinity, alignment: .leading)
                        HadithView(id: .falakFeet, style: .line)
                        Label("Look at the ground, never at the sun.", systemImage: "eye.trianglebadge.exclamationmark.fill")
                            .font(.footnote.weight(.semibold)).foregroundStyle(Theme.warning)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Text("For learning. Always follow your local religious authority.")
                            .font(.footnote).opacity(0.7).multilineTextAlignment(.center)
                    }
                    .padding(.horizontal, Theme.gutter)
                    .padding(.bottom, 32)
                } else {
                    Text("Choose a place first.").font(.headline).padding(40)
                }
            }
            .navigationTitle("Shadow steps")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }

    private func step(_ n: Int, _ title: String, _ sub: String) -> some View {
        HStack(spacing: 14) {
            Text("\(n)").font(.headline).monospacedDigit()
                .frame(width: 30, height: 30)
                .background(Theme.gold.opacity(0.22), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.body.weight(.semibold))
                Text(sub).font(.footnote).opacity(0.7)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
    }
}

/// A person with the sun behind them and footsteps along their shadow.
private struct StepsPicture: View {
    var body: some View {
        Canvas { ctx, size in
            let w = size.width, ground = size.height - 18
            let personX = w * 0.2, bodyH: CGFloat = 70
            // Sun behind, top left.
            ctx.fill(Path(ellipseIn: CGRect(x: 6, y: 4, width: 26, height: 26)), with: .color(Color(red: 1, green: 0.8, blue: 0.3)))
            // Ground.
            var g = Path(); g.move(to: CGPoint(x: 0, y: ground)); g.addLine(to: CGPoint(x: w, y: ground))
            ctx.stroke(g, with: .color(.primary.opacity(0.25)), lineWidth: 1)
            // Shadow.
            let len = w * 0.62
            ctx.fill(Path(roundedRect: CGRect(x: personX, y: ground - 3, width: len, height: 6), cornerRadius: 3), with: .color(.primary.opacity(0.35)))
            // Footsteps.
            for i in 0..<8 {
                let x = personX + 10 + CGFloat(i) * (len - 14) / 8
                ctx.fill(Path(ellipseIn: CGRect(x: x, y: ground + 6 + CGFloat(i % 2) * 5, width: 10, height: 5)), with: .color(Theme.gold))
            }
            // Head ring at the shadow tip.
            ctx.stroke(Path(ellipseIn: CGRect(x: personX + len - 7, y: ground - 7, width: 14, height: 14)), with: .color(Theme.gold), lineWidth: 2.5)
            // Person.
            ctx.fill(Path(ellipseIn: CGRect(x: personX - 7, y: ground - bodyH - 2, width: 14, height: 14)), with: .color(.primary))
            ctx.fill(Path(roundedRect: CGRect(x: personX - 6, y: ground - bodyH + 12, width: 12, height: bodyH - 12), cornerRadius: 5), with: .color(.primary))
        }
    }
}

// MARK: - Shadow camera

/// Hold the phone at your chest with the sun behind you, point it at your
/// shadow and tap the head. The phone's tilt turns that tap into steps, so
/// your height never needs to be typed. A white line glows where the shadow's
/// head will be at Asr, and turns green once it has begun.
struct ShadowCameraView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var motion = PitchMotion()
    @State private var camera = CameraFeed()
    /// Where the user tapped, as a share of the screen height, with the pitch at that moment.
    @State private var tap: (y: CGFloat, pitch: Double)?
    @State private var speaker = AVSpeechSynthesizer()

    private let verticalFOV: Double = 60
    private let green = Color(red: 0.2, green: 0.95, blue: 0.45)

    var body: some View {
        GeometryReader { geo in
            let h = geo.size.height
            let focal = Double(h / 2) / tan(verticalFOV / 2 * .pi / 180)
            ZStack {
                if camera.authorized {
                    CameraPreview(session: camera.session).ignoresSafeArea()
                } else {
                    Color.black.ignoresSafeArea()
                }
                if let place = model.activePlace {
                    TimelineView(.periodic(from: .now, by: 15)) { context in
                        overlay(place: place, now: context.date, w: geo.size.width, h: h, focal: focal)
                    }
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { location in
                guard motion.available, model.activePlace != nil else { return }
                tap = (location.y / max(h, 1), motion.pitch)
                announce(focal: focal, h: h)
            }
        }
        .background(Color.black)
        .preferredColorScheme(.dark)
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark").font(.headline).frame(width: 40, height: 40)
                    .background(.ultraThinMaterial, in: Circle())
            }
            .padding(16)
            .accessibilityLabel("Close")
        }
        .onAppear { motion.start(); camera.start() }
        .onDisappear { motion.stop(); camera.stop() }
    }

    private func depression(y: CGFloat, pitch: Double, h: CGFloat, focal: Double) -> Double {
        pitch + atan(Double(y * h - h / 2) / focal) * 180 / .pi
    }

    private func reading(place: Place, now: Date, h: CGFloat, focal: Double) -> Falak.CameraReading? {
        guard let tap else { return nil }
        return Falak.cameraReading(depression: depression(y: tap.y, pitch: tap.pitch, h: h, focal: focal), at: now,
                                   coordinates: place.coordinates, timeZone: model.timeZone, school: model.asrSchool)
    }

    @ViewBuilder
    private func overlay(place: Place, now: Date, w: CGFloat, h: CGFloat, focal: Double) -> some View {
        let ymd = model.ymd(now)
        let plan = Falak.shadowDay(year: ymd.0, month: ymd.1, day: ymd.2, coordinates: place.coordinates)
        let target = Falak.asrSteps(plan, school: model.asrSchool)
        let asr = Prayer.asr.name(model.naming)
        let sun = Falak.sunPosition(at: now, coordinates: place.coordinates)
        let r = reading(place: place, now: now, h: h, focal: focal)
        let begun = r?.asrBegun == true
        let asrDep = Falak.depression(phoneHeight: Falak.chestHeight, distance: target / Falak.feetPerBody)
        let lineY = CGFloat(Double(h / 2) + focal * tan((asrDep - motion.pitch) * .pi / 180))
        let asrTime = model.asrSchool == .hanafi ? plan.asrHanafi : plan.asrShafii

        ZStack {
            // The Asr line, glowing so it stands out in bright sun.
            if sun.altitude > 2, motion.available, lineY > 0, lineY < h {
                Capsule()
                    .fill(begun ? green : .white)
                    .frame(height: 5)
                    .shadow(color: (begun ? green : .white).opacity(0.9), radius: 10)
                    .shadow(color: .black.opacity(0.6), radius: 2)
                    .padding(.horizontal, 24)
                    .position(x: w / 2, y: lineY)
                    .accessibilityHidden(true)
            }
            // The head of your shadow.
            if let tap {
                Circle()
                    .stroke(begun ? green : .white, lineWidth: 4)
                    .frame(width: 46, height: 46)
                    .shadow(color: .black.opacity(0.6), radius: 3)
                    .position(x: w / 2, y: tap.y * h)
                    .accessibilityHidden(true)
            }
            VStack {
                pill(r: r, begun: begun, asr: asr)
                    .padding(.top, 60)
                Spacer()
                sheet(r: r, target: target, asr: asr, asrTime: asrTime, sun: sun, now: now, plan: plan)
            }
        }
        .animation(.smooth, value: begun)
    }

    @ViewBuilder
    private func pill(r: Falak.CameraReading?, begun: Bool, asr: String) -> some View {
        if let r {
            let text = r.asrBegun == nil ? "Before noon" : (begun ? "✓ \(asr) has begun" : "Not yet")
            Text(text)
                .font(.headline)
                .padding(.horizontal, 18).padding(.vertical, 10)
                .foregroundStyle(begun ? Color.black : Color.white)
                .background(begun ? AnyShapeStyle(green) : AnyShapeStyle(Material.ultraThinMaterial), in: Capsule())
        }
    }

    private func sheet(r: Falak.CameraReading?, target: Double, asr: String, asrTime: Date?, sun: Falak.SunPosition,
                       now: Date, plan: Falak.ShadowDay) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if sun.altitude <= 2 {
                Text("Shadow readings start after sunrise. Come back in daylight.").font(.subheadline.weight(.semibold))
            } else if !motion.available {
                Text("This device can't tell its tilt, so the camera can't measure. Use shadow steps instead.")
                    .font(.subheadline.weight(.semibold))
            } else if let r {
                if r.asrBegun == nil {
                    Text("The shadow is still shrinking. Come back after \(model.formatted(plan.noon)).")
                        .font(.subheadline.weight(.semibold))
                } else {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Your shadow").font(.subheadline).opacity(0.75)
                        Spacer()
                        Text(r.steps.isFinite ? Falak.stepsText(r.steps) : "–").font(Theme.display(28, .bold)).monospacedDigit()
                        Text("of \(Falak.stepsText(target)) steps").font(.subheadline).opacity(0.75)
                    }
                    ProgressView(value: min(max(r.steps.isFinite ? r.steps / target : 1, 0), 1))
                        .tint(r.asrBegun == true ? green : .white)
                    if r.asrBegun == false, let asrTime {
                        let mins = Int((asrTime.timeIntervalSince(now) / 60).rounded())
                        if mins > 0 { Text("\(asr) in about \(mins) min").font(.subheadline.weight(.semibold)) }
                    }
                    if let official = model.day(containing: now) {
                        Text("Your timetable says \(model.formatted(official.time(.asr)))").font(.footnote).opacity(0.75)
                    }
                    Text(r.asrBegun == true ? "Two taps and a soft voice. No need to look." : "A gentle tap now. Two taps when \(asr) begins.")
                        .font(.footnote).opacity(0.7)
                    Text("Tap again to move the mark").font(.caption).opacity(0.55)
                }
            } else {
                how(1, "Sun behind you, hold the phone at your chest")
                how(2, "Point it down at your shadow")
                how(3, "Tap the head of your shadow")
            }
            Text("An estimate from the phone's tilt, for learning. Always follow your local religious authority.")
                .font(.caption2).opacity(0.55)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
    }

    private func how(_ n: Int, _ text: String) -> some View {
        HStack(spacing: 12) {
            Text("\(n)").font(.subheadline.weight(.bold)).frame(width: 26, height: 26)
                .background(.white.opacity(0.18), in: Circle())
            Text(text).font(.subheadline.weight(.semibold))
        }
    }

    /// Haptics and a soft voice, so the user can hold the phone without reading it.
    private func announce(focal: Double, h: CGFloat) {
        guard let place = model.activePlace, let r = reading(place: place, now: .now, h: h, focal: focal) else { return }
        let asr = Prayer.asr.name(model.naming)
        if r.asrBegun == true {
            let g = UINotificationFeedbackGenerator()
            g.notificationOccurred(.success)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { g.notificationOccurred(.success) }
            say("\(asr) has begun.")
        } else {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            if r.asrBegun == false { say("Not yet.") }
        }
    }

    private func say(_ text: String) {
        speaker.stopSpeaking(at: .immediate)
        let u = AVSpeechUtterance(string: text)
        u.volume = 0.8
        speaker.speak(u)
    }
}

/// How far the back camera points below the horizon, in degrees.
@MainActor
@Observable
final class PitchMotion {
    private(set) var pitch: Double = 45
    var available: Bool { manager.isDeviceMotionAvailable }
    @ObservationIgnored private let manager = CMMotionManager()

    func start() {
        guard manager.isDeviceMotionAvailable else { return }
        manager.deviceMotionUpdateInterval = 1 / 20
        manager.startDeviceMotionUpdates(to: .main) { [weak self] data, _ in
            guard let g = data?.gravity else { return }
            // The back camera looks along -z; gravity points down. Face up and
            // flat (straight down) is 90°, upright is 0°.
            let p = asin(min(1, max(-1, -g.z))) * 180 / .pi
            MainActor.assumeIsolated { self?.pitch = p }
        }
    }

    func stop() { manager.stopDeviceMotionUpdates() }
}

/// The back camera, shown full screen. Nothing is recorded or sent.
@MainActor
@Observable
final class CameraFeed {
    private(set) var authorized = false
    @ObservationIgnored let session = AVCaptureSession()
    @ObservationIgnored private var configured = false

    func start() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: run()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { ok in
                Task { @MainActor in if ok { self.run() } }
            }
        default: authorized = false
        }
    }

    private func run() {
        authorized = true
        if !configured {
            session.beginConfiguration()
            if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
               let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) {
                session.addInput(input)
            }
            session.commitConfiguration()
            configured = true
        }
        let s = session
        DispatchQueue.global(qos: .userInitiated).async { s.startRunning() }
    }

    func stop() {
        let s = session
        DispatchQueue.global(qos: .userInitiated).async { s.stopRunning() }
    }
}

private struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }

    func makeUIView(context: Context) -> PreviewView {
        let v = PreviewView()
        v.previewLayer.session = session
        v.previewLayer.videoGravity = .resizeAspectFill
        return v
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}
}
