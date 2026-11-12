import Foundation

/// Women's days: the Ramadan fast record and the prayer tracker pause are one
/// fact, so marking it in one place marks it in the other. Pausing the tracker in
/// Ramadan shows those days as "Period" in the fast record; marking a fast day
/// "Period" pauses the tracker (today) or excuses that day (an earlier day).
/// Changing it back undoes both. Everything stays on this phone.
///
/// Same rules as web/src/core/womensDays.ts and android core WomensDays.kt.
/// Days are "yyyy-MM-dd" in the place's own calendar.
struct WomensDays: Equatable, Sendable {
    var fastLog: [String: FastMark]
    var excusedDays: Set<String>
    var trackerPausedSince: String?

    private static func add(_ key: String, _ n: Int) -> String { (CivilDay(key)?.adding(n) ?? CivilDay(year: 2000, month: 1, day: 1)).key }

    /// Every day from `from` to `to`, both included (at most a year).
    private static func span(_ from: String, _ to: String) -> [String] {
        guard let start = CivilDay(from) else { return [] }
        var out: [String] = []
        var d = start
        while d.key <= to && out.count < 366 { out.append(d.key); d = d.adding(1) }
        return out
    }

    private func inPause(_ key: String, today: String) -> Bool {
        guard let since = trackerPausedSince else { return false }
        return key >= since && key <= today
    }

    /// How a fast day went: what was marked, or "Period" for an unmarked Ramadan day inside a tracker pause.
    func mark(_ key: String, today: String, isRamadan: (String) -> Bool) -> FastMark? {
        fastLog[key] ?? (inPause(key, today: today) && isRamadan(key) ? .period : nil)
    }

    /// Writes "Period" into the fast record for the unmarked Ramadan days among `days`.
    private mutating func keepAsPeriod(_ days: [String], isRamadan: (String) -> Bool) {
        for k in days where fastLog[k] == nil && isRamadan(k) { fastLog[k] = .period }
    }

    /// Mark how a fast day went, and keep the prayer tracker in step.
    mutating func setFast(_ key: String, _ newMark: FastMark?, today: String, isRamadan: (String) -> Bool) {
        let before = mark(key, today: today, isRamadan: isRamadan)
        fastLog[key] = newMark
        if newMark == .period && before != .period {
            if inPause(key, today: today) { return }
            if key == today && trackerPausedSince == nil { trackerPausedSince = today } else { excusedDays.insert(key) }
            return
        }
        guard before == .period, newMark != .period else { return }
        // No longer a period day: the tracker counts it again.
        excusedDays.remove(key)
        guard let since = trackerPausedSince, inPause(key, today: today) else { return }
        // Split the pause around this day: the days before stay excused, the days after stay paused.
        let earlier = key > since ? Self.span(since, Self.add(key, -1)) : []
        keepAsPeriod(earlier, isRamadan: isRamadan)
        excusedDays.formUnion(earlier)
        trackerPausedSince = key < today ? Self.add(key, 1) : nil
    }

    /// Pause the tracker from today. Ramadan days in the pause read as "Period" until it ends.
    mutating func pause(today: String) { trackerPausedSince = today }

    /// End the pause: the paused days stay excused, and their Ramadan days stay "Period" in the fast record.
    mutating func endPause(today: String, isRamadan: (String) -> Bool) {
        guard let since = trackerPausedSince else { return }
        let days = Self.span(since, today)
        keepAsPeriod(days, isRamadan: isRamadan)
        excusedDays.formUnion(days)
        trackerPausedSince = nil
    }

    /// "Just today" in the tracker: excuse one day, and in Ramadan mark that fast "Period". Again to undo both.
    mutating func toggleExcused(_ key: String, isRamadan: (String) -> Bool) {
        if excusedDays.contains(key) {
            excusedDays.remove(key)
            if fastLog[key] == .period { fastLog[key] = nil }
        } else {
            excusedDays.insert(key)
            keepAsPeriod([key], isRamadan: isRamadan)
        }
    }
}
