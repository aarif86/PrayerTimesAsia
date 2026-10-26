# testdata/ - the expected prayer times every app is tested against

One copy, read by all of:

- the iPhone tests (`ios/PrayerTimesAsiaTests/ExpectedTimes.swift`)
- the Android tests (`android/core/src/test/.../ExpectedTimes.kt`)
- the web tests (`web/tests/engine.test.ts`, `web/tests/reference.test.ts`)
- `tools/reference_engine.py` (the official days)

So a wrong time in any app fails that app's build.

| File | What's in it |
|---|---|
| `expected-times.json` | **official**: days copied from MUIS / JAKIM timetables (an app may be 0-2 min later, sunrise 0-1 min earlier, never earlier). **exact**: what the apps show, to the minute. Places and method ids are shared by all three apps. |
| `reference-2026.json` | Every day of 2026 for Singapore, Kuala Lumpur and Jakarta from `tools/reference_engine.py` `final_minutes` (minutes after local midnight). Each app must be within 1 minute, and exact on more than 99.5%. |

Adding a day: add it to `official.days` (with its source) or `exact.days`, then
push. All three app workflows run on pull requests that touch this folder.
These files are only for tests; the apps never download them (unlike `data/`).
