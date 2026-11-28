import AppKit

/// The Mac menu bar item: the next prayer and how long until it, at the top
/// of the screen while the app is running. Click it for today's times.
///
/// A Mac app made from the iPhone code cannot reach the menu bar itself, so
/// this small piece is built for the Mac alone and loaded by the app
/// (App/MacMenuBar.swift), which hands it the times it has already worked out.
@objc(MenuBarPlugin)
final class MenuBarPlugin: NSObject {
    private struct Row { let name: String; let time: Date; let isPrayer: Bool }

    private var item: NSStatusItem?
    private var timer: Timer?
    private var rows: [Row] = []
    private var place = ""
    private var zone = TimeZone.current
    private var use24Hour = false

    /// Called by the app whenever the times change.
    /// Keys: place (String), zone (String), use24Hour (Bool), rows ([[name, time, isPrayer]]).
    @objc func update(_ info: NSDictionary) {
        place = info["place"] as? String ?? ""
        zone = (info["zone"] as? String).flatMap(TimeZone.init(identifier:)) ?? .current
        use24Hour = info["use24Hour"] as? Bool ?? false
        rows = (info["rows"] as? [NSDictionary] ?? []).compactMap {
            guard let name = $0["name"] as? String, let time = $0["time"] as? Date else { return nil }
            return Row(name: name, time: time, isPrayer: $0["isPrayer"] as? Bool ?? true)
        }.sorted { $0.time < $1.time }

        if item == nil {
            item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
            let t = Timer(timeInterval: 20, repeats: true) { [weak self] _ in self?.draw() }
            RunLoop.main.add(t, forMode: .common)
            timer = t
        }
        draw()
    }

    private func draw(now: Date = Date()) {
        guard let item else { return }
        if let next = rows.first(where: { $0.isPrayer && $0.time > now }) {
            item.button?.title = "\(next.name) \(Self.wait(next.time.timeIntervalSince(now)))"
        } else {
            item.button?.title = "Prayer Times Asia"
        }

        let menu = NSMenu()
        if !place.isEmpty { menu.addItem(label(place)) }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = zone
        let clock = DateFormatter()
        clock.timeZone = zone
        clock.dateFormat = use24Hour ? "HH:mm" : "h:mm a"
        for row in rows where calendar.isDate(row.time, inSameDayAs: now) {
            menu.addItem(label("\(row.name)   \(clock.string(from: row.time))"))
        }
        menu.addItem(.separator())
        let open = NSMenuItem(title: "Open Prayer Times Asia", action: #selector(openApp), keyEquivalent: "")
        open.target = self
        menu.addItem(open)
        let quit = NSMenuItem(title: "Quit", action: #selector(quitApp), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
        item.menu = menu
    }

    private func label(_ text: String) -> NSMenuItem {
        let item = NSMenuItem(title: text, action: nil, keyEquivalent: "")
        item.isEnabled = false
        return item
    }

    /// "in 1h 12m", "in 53m", "now".
    static func wait(_ seconds: TimeInterval) -> String {
        let minutes = Int((seconds / 60).rounded(.up))
        if minutes <= 0 { return "now" }
        if minutes < 60 { return "in \(minutes)m" }
        return "in \(minutes / 60)h \(minutes % 60)m"
    }

    @objc private func openApp() {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.windows.first { $0.canBecomeMain }?.makeKeyAndOrderFront(nil)
    }

    @objc private func quitApp() { NSApp.terminate(nil) }
}
