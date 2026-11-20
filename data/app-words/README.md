# data/app-words: every word on the app screens, in English, Malay and Indonesian

One file per language (`en.json`, `ms.json`, `id.json`) with the same keys. The
web, iPhone and Android apps will all read these lines, the way they all read
`testdata/` today. The apps switch over screen by screen (issues #83, #84, #85).

- Keys look like `screen.name`, for example `settings.alerts` or `qibla.step1`.
  Lines that only the phone apps show start with `phone.` or `widget.`.
- `{n}`, `{name}`, `{place}` and the other words in braces are filled in by the
  app. Every language must use the same ones as English.
- A key ending in `_one` is the line for exactly one, like `{n} day to go`.
- No colons or dashes. A hyphen inside a word, like kira-kira or al-Fitr, is fine. Malay is bahasa baku, as in Berita Harian, with no "lah"
  or slang. Indonesian is plain standard Indonesian.
- Prayer names are not in this list. They follow the prayer names setting, so a
  line uses `{name}` or `{prayer}` where a prayer name goes.
- Not in this list on purpose, and never translated here: hadith and ayah text,
  doa and niat (Arabic and rumi), Raya greetings, and the app's name.
- The Ramadan page and card keep their own list in `data/ramadan-words.json`
  for now. Keys starting with `ramadan.` are not allowed here, so the two never
  clash.

Check after editing:

    python3 tools/check_app_words.py              (fails on any problem)
    python3 tools/check_app_words.py --coverage   (lists iPhone and Android screen
                                                   text that is not in the list yet)

The web tests (`web/tests/appWords.test.ts`) run the same checks on every pull
request. Every new Malay and Indonesian line needs a native speaker's read
before launch.
