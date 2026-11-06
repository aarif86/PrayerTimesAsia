import Foundation

/// An .ics calendar file of the next 30 days of prayer times, each with an
/// alert, made on the phone. "Only Zohor and Asar" is for a work or school
/// calendar, so meetings and classes don't land on prayer time. Same format
/// as the web app's calendar download.
enum CalendarFile {
    @MainActor static func make(model: AppModel, prayers: [Prayer], days: Int = 30) -> URL? {
        guard let place = model.activePlace else { return nil }
        let stamp: (Date) -> String = { d in
            let f = DateFormatter()
            f.locale = Locale(identifier: "en_US_POSIX")
            f.timeZone = TimeZone(identifier: "UTC")
            f.dateFormat = "yyyyMMdd'T'HHmmss'Z'"
            return f.string(from: d)
        }
        let esc: (String) -> String = {
            $0.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: ",", with: "\\,")
                .replacingOccurrences(of: ";", with: "\;").replacingOccurrences(of: "\n", with: "\\n")
        }
        let now = Date.now
        var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Prayer Times Asia//iOS//EN", "CALSCALE:GREGORIAN",
                     "METHOD:PUBLISH", "X-WR-CALNAME:\(esc("Prayer times · \(place.name)"))"]
        let early = model.prefs.reminderMinutesBefore
        for i in 0..<days {
            guard let day = model.day(containing: now.addingTimeInterval(Double(i) * 86_400)) else { continue }
            for p in prayers {
                let t = day.time(p)
                let name = p.name(model.naming, isFriday: model.isFriday(t))
                let source = day.officialSource ?? "\(model.method.shortName) method"
                lines += ["BEGIN:VEVENT",
                          "UID:ios-\(day.year)-\(day.month)-\(day.day)-\(p.rawValue)-\(String(format: "%.3f", place.coordinates.latitude))@prayertimes.asia",
                          "DTSTAMP:\(stamp(now))", "DTSTART:\(stamp(t))", "DURATION:PT15M", "SUMMARY:\(esc(name))",
                          "DESCRIPTION:\(esc("\(name) begins \(model.formatted(t)) in \(place.name). Source: \(source)."))",
                          "TRANSP:TRANSPARENT",
                          "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:\(esc(name))", "TRIGGER:PT0M", "END:VALARM"]
                if early > 0 {
                    lines += ["BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:\(esc("\(name) in \(early) min"))",
                              "TRIGGER:-PT\(early)M", "END:VALARM"]
                }
                lines.append("END:VEVENT")
            }
        }
        lines.append("END:VCALENDAR")
        let slug = place.name.lowercased().map { $0.isLetter || $0.isNumber ? String($0) : "-" }.joined()
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("prayer-times-\(prayers.count == 2 ? "work-" : "")\(slug).ics")
        do {
            try (lines.joined(separator: "\r\n") + "\r\n").write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch { return nil }
    }
}
