#if targetEnvironment(macCatalyst)
import Foundation

/// Hands today's times to the Mac menu bar item (ios/MacMenuBar), which shows
/// the next prayer at the top of the screen. The item is a small Mac-only
/// piece packed inside the app; if it is missing, nothing happens.
@MainActor
enum MacMenuBar {
    private static var plugin: NSObject?
    private static var looked = false

    static func update(_ snapshot: WidgetSnapshot) {
        if !looked {
            looked = true
            guard let url = Bundle.main.builtInPlugInsURL?.appendingPathComponent("MacMenuBar.bundle"),
                  let bundle = Bundle(url: url) else { NSLog("MacMenuBar: not found inside the app"); return }
            do { try bundle.loadAndReturnError() } catch { NSLog("MacMenuBar: did not load: \(error)"); return }
            guard let type = bundle.principalClass as? NSObject.Type else {
                NSLog("MacMenuBar: no main class (\(String(describing: bundle.principalClass)))"); return
            }
            plugin = type.init()
            NSLog("MacMenuBar: loaded")
        }
        guard let plugin else { return }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: snapshot.timeZoneID) ?? .current
        var rows: [[String: Any]] = []
        for day in snapshot.days {
            for prayer in Prayer.allCases {
                guard let time = day.times[prayer.rawValue] else { continue }
                let friday = calendar.component(.weekday, from: time) == 6
                rows.append(["name": prayer.name(snapshot.naming, isFriday: friday),
                             "time": time,
                             "isPrayer": prayer.isObligatory])
            }
        }
        let info: [String: Any] = ["place": snapshot.placeName,
                                   "zone": snapshot.timeZoneID,
                                   "use24Hour": snapshot.use24Hour,
                                   "rows": rows]
        plugin.perform(NSSelectorFromString("update:"), with: info as NSDictionary)
    }
}
#endif
