# Website content

Everything the Prayer Times Asia website needs for its changelog, roadmap and
feature-request pages, kept with the code so it is updated with each release.

| File | What it is | Who reads it |
|---|---|---|
| `changelog.json` | Every TestFlight/App Store build: date, title, New / Improved / Fixed | The website's changelog page |
| `roadmap.json` | Now / Next / Later, plus feature requests and when they shipped | The roadmap and requests pages |
| `changelog.md`, `roadmap.md` | Readable versions, generated from the JSON | People browsing the repo |
| `build-log.md` | Every commit, oldest first, and why the big decisions were made | The "How it was built" story |

## Updating

1. After each release, add an entry at the top of `changelog.json` (and move
   finished roadmap items or requests to `done` in `roadmap.json`).
2. Run `python3 tools/website_docs.py` to refresh the `.md` files.
3. For a new commit-level history, append to `build-log.md`.

Public wording: plain English, user benefits first, and no other apps named -
say "inspired by" in general terms.
