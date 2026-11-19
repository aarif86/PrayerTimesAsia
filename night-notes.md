# Night notes, #83 web app uses the shared word list

Round 1
- Added pref appLanguageOverride (null = browser languages; ms, id, else en), store.appLang, core/appWords.ts with t().
- Demo ?lang=ms|id, demo default English.
- Added settings.language + settings.languageFoot to the word list.
Next: Settings row, App key by language, then switch screens to t() (script for exact literals).

Round 2
- Swapped ~396 exact English literals in web/src/ui to tr('key') with a script (Guide and Ramadan keep their own word lists).
- Fixed: tab labels made a function (were frozen at load); kept 'Current location' (stored place name) and the credits English.
- Settings has a Language group. html lang follows the app language.
- typecheck, 291 tests, build green.
Next: lines with {holes} (templates), labels in prefs.ts (APPEARANCE_LABEL, TODAY_STYLE_LABEL), dates in app locale, leftover check test, screenshots.
