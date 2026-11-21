# Releasing updates

The app is live on Google Play, so every public update reaches real people at prayer time. Fix as often as you like in testing. Send to the public in batches, after testing.

## What the stores allow (checked 21 November 2026)

Neither store sets a limit on how often you can publish an update. The limits that matter are review time and the risk of shipping a bug to everyone.

**Google Play** ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/9859654))

- Every update is reviewed. It usually takes a few hours, and can take up to 7 days or longer.
- Sending a new change while one is still in review may move the app to the back of the review queue. Never stack updates. Wait for the one in review to clear.
- Every upload needs a higher version code. Our workflow uses the run number, so this is automatic.
- **Internal testing** holds up to 100 testers. Builds reach them within minutes, with no normal review ([testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334)).
- **Staged rollout** sends an update to a share of users you choose. The share never rises by itself. You can halt it, then resume. You cannot lower it ([staged rollouts](https://support.google.com/googleplay/android-developer/answer/6346149)). A fully rolled out release can also be halted ([halting](https://support.google.com/googleplay/android-developer/answer/16285429)).
- **Managed publishing** lets you decide when an approved update goes live.
- The "12 testers for 14 days" rule is only for personal accounts made after 13 November 2023 ([rule](https://support.google.com/googleplay/android-developer/answer/14151465)). Our account belongs to Nasar Pte Ltd and the app is already live, so it does not apply.

**Apple** ([App Review](https://developer.apple.com/distribute/app-review/))

- Apple aims to review half of all submissions within 24 hours and 90% within 48 hours.
- A fast review can be requested only for real urgency, such as a critical bug, and only after submitting ([expedited review](https://developer.apple.com/help/app-review/after-submitting-for-review/request-expedited-review/)).
- **Phased release** spreads an update over 7 days (1%, 2%, 5%, 10%, 20%, 50%, 100%). It can be paused for up to 30 days, or released to everyone at once. People can still update by hand from the App Store ([phased release](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/)).
- **TestFlight** builds last 90 days. Up to 100 internal testers and 10,000 outside testers. The first build for outside testers needs a short Apple check ([TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)).
- App Review Guidelines 2.2 says test versions belong in TestFlight, not the App Store.

## Our rhythm

**1. Every day while fixing.** Merge to `main` as usual. Nothing reaches the public.

- Android testers use the [test APK link](https://github.com/aarif86/PrayerTimesAsia/releases/download/android-test/prayer-times-asia.apk). The Android workflow refreshes it after every green build on `main`.
- iPhone testers get a new build when the owner runs **Release to TestFlight**.

**2. When a batch is ready.** Run **Release to Google Play** (track `internal`). Download the `.aab` from the run page and upload it in Play Console under Test and release, Internal testing. Test on real phones for a day or two. Check prayer times, alarms, adhan, widgets and the first launch.

**3. Public release, once every 1 to 2 weeks.**

- Google Play. Promote the same tested build to Production with a staged rollout at **10%**. Watch Android vitals in Play Console (crashes and freezes), new reviews and the salam@prayertimes.asia inbox. If all is calm after 2 days, raise to **50%**, then **100%** after 2 more days. If something breaks, halt the rollout.
- App Store. Submit the tested TestFlight build with phased release turned on. Pause it if something breaks.
- Only one update in review per store at a time.

**4. Urgent fix outside the rhythm.** Only for

- wrong prayer times,
- the app crashing when it opens,
- alarms or adhan not sounding,
- a warning or removal notice from a store.

Fix it, test it on the internal track and TestFlight for a few hours, then send it. For Apple, request an expedited review. Everything else waits for the next batch.

**Nothing goes to the public without the owner's OK.**
