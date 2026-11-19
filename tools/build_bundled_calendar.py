#!/usr/bin/env python3
"""Copy data/calendar.json into the iPhone and Android apps, so the authority's
Islamic calendar (MUIS month starts, Ramadan and Raya dates) works offline and
on the very first open. The web app imports the JSON file directly.

    python3 tools/build_bundled_calendar.py          # write both copies
    python3 tools/build_bundled_calendar.py --check  # fail if a copy is out of date

Run it after every change to data/calendar.json.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'data' / 'calendar.json'
SWIFT = ROOT / 'ios' / 'PrayerTimesAsia' / 'Core' / 'BundledCalendar.swift'
KOTLIN = ROOT / 'android' / 'core' / 'src' / 'main' / 'kotlin' / 'com' / 'prayertimesasia' / 'core' / 'BundledCalendar.kt'

data = json.loads(SRC.read_text(encoding='utf-8'))
text = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
assert '"""' not in text and '$' not in text

swift = f'''// Written by tools/build_bundled_calendar.py from data/calendar.json. Do not edit by hand.
import Foundation

/// The calendar data shipped inside the app, used until the app downloads a newer copy.
enum BundledCalendar {{
    static let json = #"""
{text}
"""#

    static let dataset: CalendarDataset = (try? JSONDecoder().decode(CalendarDataset.self, from: Data(json.utf8)))
        ?? CalendarDataset(version: 1, licence: "CC-BY-4.0", announcements: [])
}}
'''

kotlin = f'''// Written by tools/build_bundled_calendar.py from data/calendar.json. Do not edit by hand.
package com.prayertimesasia.core

/** The calendar data shipped inside the app, used until the app downloads a newer copy. */
object BundledCalendar {{
    const val JSON: String = """{text}"""

    val dataset: CalendarDataset by lazy {{ runCatching {{ CalendarDataset.decode(JSON) }}.getOrDefault(CalendarDataset.empty) }}
}}
'''

if '--check' in sys.argv:
    stale = [p.relative_to(ROOT) for p, want in ((SWIFT, swift), (KOTLIN, kotlin)) if not p.exists() or p.read_text(encoding='utf-8') != want]
    if stale:
        print('Out of date, run python3 tools/build_bundled_calendar.py:', *stale)
        sys.exit(1)
    print('Bundled calendar copies are up to date')
else:
    SWIFT.write_text(swift, encoding='utf-8')
    KOTLIN.write_text(kotlin, encoding='utf-8')
    print('Wrote', SWIFT.relative_to(ROOT), 'and', KOTLIN.relative_to(ROOT))
