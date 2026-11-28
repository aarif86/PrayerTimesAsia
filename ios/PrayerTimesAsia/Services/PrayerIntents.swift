import AppIntents
import Foundation

/// Siri, Shortcuts, the Action button and Spotlight. Each one reads the
/// snapshot the app keeps in the App Group (the same one the widgets use), so
/// it answers at once, offline, without opening the app.

enum PrayerChoice: String, AppEnum {
    case fajr, sunrise, dhuhr, asr, maghrib, isha

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Prayer")
    static let caseDisplayRepresentations: [PrayerChoice: DisplayRepresentation] = [
        .fajr: "Fajr (Subuh)", .sunrise: "Sunrise (Syuruk)", .dhuhr: "Dhuhr (Zohor)",
        .asr: "Asr", .maghrib: "Maghrib", .isha: "Isha (Isyak)"
    ]

    var prayer: Prayer { Prayer(rawValue: rawValue) ?? .fajr }
}

struct NextPrayerIntent: AppIntent {
    static let title: LocalizedStringResource = "Next prayer"
    static let description = IntentDescription("Says which prayer is next, how long until it and its time.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let line = PrayerSpeech.nextLine(WidgetSnapshot.load())
        return .result(value: line, dialog: "\(line)")
    }
}

struct PrayerTimeIntent: AppIntent {
    static let title: LocalizedStringResource = "Time of a prayer"
    static let description = IntentDescription("Says the time of one prayer today.")
    static let openAppWhenRun = false

    @Parameter(title: "Prayer", requestValueDialog: "Which prayer?")
    var prayer: PrayerChoice

    static var parameterSummary: some ParameterSummary { Summary("Time of \(\.$prayer)") }

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let line = PrayerSpeech.timeLine(prayer.prayer, WidgetSnapshot.load())
        return .result(value: line, dialog: "\(line)")
    }
}

struct TodayTimesIntent: AppIntent {
    static let title: LocalizedStringResource = "Today's prayer times"
    static let description = IntentDescription("Says all five prayer times for today.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult & ReturnsValue<String> & ProvidesDialog {
        let line = PrayerSpeech.todayLine(WidgetSnapshot.load())
        return .result(value: line, dialog: "\(line)")
    }
}

/// The phrases Siri knows without the person setting anything up.
struct PrayerShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: NextPrayerIntent(),
                    phrases: ["Next prayer in \(.applicationName)",
                              "When is the next prayer in \(.applicationName)",
                              "What is the next prayer in \(.applicationName)"],
                    shortTitle: "Next prayer", systemImageName: "clock")
        AppShortcut(intent: PrayerTimeIntent(),
                    phrases: ["What time is \(\.$prayer) in \(.applicationName)",
                              "\(\.$prayer) time in \(.applicationName)"],
                    shortTitle: "Time of a prayer", systemImageName: "sun.horizon")
        AppShortcut(intent: TodayTimesIntent(),
                    phrases: ["Today's prayer times in \(.applicationName)",
                              "Prayer times today in \(.applicationName)"],
                    shortTitle: "Today's times", systemImageName: "calendar")
    }
}
