# Night notes, #89 iPhone accessibility

Round 1: added PrayerTimesAsiaUITests (XCUITest performAccessibilityAudit) on 11 screens, normal and largest text.
First CI run is a discovery run: every issue is listed with an A11Y-ISSUE line. Next: fix what it finds.
Round 2 (local, not pushed until round 1 CI finishes, to avoid cancelling it): widgets and Live Activity combined into one VoiceOver stop each, icons hidden, circular widget reads full time.
Already fine before tonight: Reduce Motion (OpeningView, LivingSky), labels on the Prayer screen's icon buttons.
Round 1 CI: test target failed to build (.action and .parentChild are macOS only). Removed.
