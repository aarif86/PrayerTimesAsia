#!/usr/bin/env python3
"""Check the store listing text in docs/store-listings/*.md.

Every box is a ```text block under a heading that ends with "(limit N)".
Checks the length against N and the house style for public words
(no colons, no long dashes, no spaced hyphen used as a dash).

  python3 tools/check_store_copy.py          # prints a table, exits 1 on a problem
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOX = re.compile(r"^### ([^\n]+?) \(limit (\d+)\)\n\n```text\n(.*?)\n```", re.M | re.S)
# The "follow your local religious authority" line, in each language.
AUTHORITY = {"en": "follow your local religious authority", "ms": "ikut pihak berkuasa agama", "id": "ikuti otoritas agama"}
STYLE = [(":", "colon"), ("—", "long dash"), ("–", "dash"), (" - ", "dash")]


def main():
    problems = 0
    for path in sorted(glob.glob(os.path.join(ROOT, "docs/store-listings/*.md"))):
        lang = os.path.basename(path)[:-3]
        if lang == "README":
            continue
        for title, limit, text in BOX.findall(open(path, encoding="utf-8").read()):
            n, limit = len(text), int(limit)
            notes = []
            if n > limit:
                notes.append(f"too long by {n - limit}")
            for mark, name in STYLE:
                # Keep the email address and keyword lists out of the colon rule.
                if mark in text.replace("salam@prayertimes.asia", ""):
                    notes.append(name)
            if title.startswith(("Description", "Full description")):
                if AUTHORITY.get(lang, "") not in text.lower():
                    notes.append("missing the 'follow your local religious authority' line")
                if "Ustaz Aarif Raziff" not in text or "Ustazah Nasibah Hamzah" not in text:
                    notes.append("missing credit line")
            problems += bool(notes)
            print(f"{'FAIL' if notes else 'ok  '} {lang:3} {n:5}/{limit:<5} {title}  {', '.join(notes)}")
    if problems:
        print(f"\n{problems} box(es) need fixing")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
