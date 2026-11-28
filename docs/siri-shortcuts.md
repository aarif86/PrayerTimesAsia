# Siri and Shortcuts for the next prayer (iPhone)

Three actions appear in Siri, Spotlight, the Shortcuts app and the Action button, with no setup:

- Next prayer: "Hey Siri, next prayer in Prayer Times Asia" says "Zohor is in 53 minutes, at 1:10 PM."
- Time of a prayer: "What time is Asar in Prayer Times Asia".
- Today's prayer times: all five.

They read the same snapshot the widgets use (App Group), so they answer offline, at once, without opening the app. Syuruk is never the "next prayer". Wording follows the App words choice (English, Malay, Indonesian). If the app has never been opened, Siri asks the person to open it once.

Code: ios/PrayerTimesAsia/Services/PrayerIntents.swift, Core/PrayerSpeech.swift, tests in PrayerSpeechTests.swift.

Not tested on a real iPhone (no Mac). To check: build, say each phrase, try the Action button, try Malay and Indonesian App words, check Siri accepts the phrases (App Shortcuts phrases must contain the app name).
Camera Qibla already exists inside Falak. Apple Watch is planned separately.
