#!/usr/bin/env python3
"""Checks the shared app word list in data/app-words/ (en.json, ms.json, id.json).

    python3 tools/check_app_words.py              (fails on any problem)
    python3 tools/check_app_words.py --coverage   (also lists iPhone and Android
                                                   screen text not in the list yet)

Rules, the same as data/ramadan-words.json:
- every key is in every language, and no language has extra keys
- every line has the same {holes} as English, and nothing else in braces
- a key ending in _one is the single form of the key without it
- no colons or dashes (a hyphen inside a word, like kira-kira or al-Fitr, is fine),
  no spaces at either end, nothing empty
- Malay has no "lah"
- no key clashes with the Ramadan words, which stay in data/ramadan-words.json
  until the apps switch over
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIR = ROOT / "data/app-words"
LANGS = ["en", "ms", "id"]
HOLE = re.compile(r"\{([a-z]+)\}")
KEY = re.compile(r"^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+(_one)?$")

problems = []
words = {lang: json.loads((DIR / f"{lang}.json").read_text(encoding="utf-8")) for lang in LANGS}
en = words["en"]

for k in en:
    if not KEY.match(k):
        problems.append(f"en: key {k!r} should look like screen.name")
    if k.endswith("_one") and k[:-4] not in en:
        problems.append(f"en: {k} has no {k[:-4]}")

for lang in LANGS:
    w = words[lang]
    for k in en:
        if k not in w:
            problems.append(f"{lang}: missing {k}")
    for k, line in w.items():
        if k not in en:
            problems.append(f"{lang}: {k} is not in English")
            continue
        if not isinstance(line, str) or not line:
            problems.append(f"{lang}.{k} is empty")
            continue
        if line != line.strip():
            problems.append(f"{lang}.{k} starts or ends with a space")
        if sorted(HOLE.findall(line)) != sorted(HOLE.findall(en[k])):
            problems.append(f"{lang}.{k} has other {{holes}} than English")
        if re.sub(HOLE, "", line).count("{") or re.sub(HOLE, "", line).count("}"):
            problems.append(f"{lang}.{k} has a broken {{hole}}")
        if re.search(r"[:–—]|(?<!\w)-|-(?!\w)", line):
            problems.append(f"{lang}.{k} has a colon or dash")
        if lang == "ms" and re.search(r"\blah\b", line, re.I):
            problems.append(f"ms.{k} uses lah")

ramadan = json.loads((ROOT / "data/ramadan-words.json").read_text(encoding="utf-8"))
for k in en:
    if k.startswith("ramadan."):
        problems.append(f"{k}: Ramadan words live in data/ramadan-words.json for now")

if problems:
    print("\n".join(problems))
    sys.exit(f"{len(problems)} problems in data/app-words")

n = len([k for k in en if not k.endswith("_one")])
print(f"App words OK, {n} lines in {len(LANGS)} languages, plus {len(ramadan['en'])} Ramadan lines in data/ramadan-words.json")

if "--coverage" in sys.argv:
    def norm(s):
        return re.sub(r"[^a-z0-9]+", " ", re.sub(HOLE, " ", s.replace("\\n", " ").lower())).strip()
    known = {norm(s) for d in (en, ramadan["en"]) for s in d.values()}
    def screen_text(globs, pattern):
        found = set()
        for g in globs:
            for f in ROOT.glob(g):
                for m in re.finditer(pattern, f.read_text(encoding="utf-8")):
                    s = m.group(1)
                    if re.search(r"[A-Za-z]{2}", s) and "\\(" not in s and "$" not in s:
                        found.add(s)
        return found
    for name, globs, pattern in [
        ("iPhone", ["ios/PrayerTimesAsia/**/*.swift"], r'(?:Text|Label|Button|Toggle|Section|navigationTitle)\(\s*"([^"]+)"'),
        ("Android", ["android/app/src/main/**/*.kt"], r'(?:Text|label|title|contentDescription)\s*[=(]\s*"([^"]+)"'),
    ]:
        found = screen_text(globs, pattern)
        missing = sorted(s for s in found if norm(s) not in known)
        print(f"\n{name}: {len(found) - len(missing)} of {len(found)} screen lines are in the list. Not in it yet:")
        for s in missing:
            print(f"  {s}")
