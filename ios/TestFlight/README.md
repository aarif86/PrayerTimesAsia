# TestFlight words

What testers read in the TestFlight app.

| File | Where it shows | Limit |
|---|---|---|
| `WhatToTest.en-US.txt` | "What to Test" on each build | 4,000 characters |
| `BetaDescription.en-US.txt` | The app's description on the TestFlight page | 4,000 characters |

**Update `WhatToTest.en-US.txt` before every "Release to TestFlight" run**, so it
describes that build. The release sends it automatically once Apple has the build.
To change the words on a build that is already out, edit the files on `main` and run
the **TestFlight words** workflow (Actions tab, Run workflow). No new build needed.

Public wording rules apply. Plain words, no colons or dashes, and end with
"Always follow your local religious authority." `python3 tools/testflight_words.py --check`
checks this, and the CI workflow runs it on every pull request.

The feedback email shown to testers is salam@prayertimes.asia.
