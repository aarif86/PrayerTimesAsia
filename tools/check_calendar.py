"""Check data/calendar.json (the calendar sanad). Run: python3 tools/check_calendar.py"""
import json, re, sys, pathlib

AUTHORITIES = {'MUIS', 'JAKIM', 'KEMENAG', 'MUHAMMADIYAH', 'KHEU', 'CHULARAJMONTRI', 'KMF', 'UMMALQURA', 'DIYANET'}
EVENTS = {'1_ramadan', '1_syawal', '10_zulhijjah', '1_muharram'}
BASES = {'rukyah', 'hisab', 'umm_al_qura', 'following_other_authority'}

path = pathlib.Path(__file__).resolve().parent.parent / 'data' / 'calendar.json'
data = json.loads(path.read_text())
errors = []
assert data.get('licence') == 'CC-BY-4.0', 'licence must be CC-BY-4.0'
seen = set()
for i, a in enumerate(data['announcements']):
    where = f"announcements[{i}]"
    if a.get('event') not in EVENTS: errors.append(f"{where}: unknown event {a.get('event')!r}")
    if a.get('authority') not in AUTHORITIES: errors.append(f"{where}: unknown authority {a.get('authority')!r} (add it to CalendarSanad.swift too)")
    if a.get('basis') not in BASES: errors.append(f"{where}: unknown basis {a.get('basis')!r}")
    if a.get('status') not in ('expected', 'announced'): errors.append(f"{where}: status must be expected or announced")
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(a.get('date'))): errors.append(f"{where}: date must be yyyy-MM-dd")
    if not isinstance(a.get('hijri_year'), int) or not 1440 <= a['hijri_year'] <= 1500: errors.append(f"{where}: hijri_year out of range")
    if a.get('status') == 'announced' and not str(a.get('source_url', '')).startswith('https://'):
        errors.append(f"{where}: an announced date needs an https source_url")
    key = (a.get('event'), a.get('hijri_year'), a.get('authority'), a.get('status'))
    if key in seen: errors.append(f"{where}: duplicate {key}")
    seen.add(key)

import datetime
starts = data.get('month_starts', [])
by_auth = {}
for i, m in enumerate(starts):
    where = f"month_starts[{i}]"
    if m.get('authority') not in AUTHORITIES: errors.append(f"{where}: unknown authority {m.get('authority')!r}")
    if not isinstance(m.get('hijri_month'), int) or not 1 <= m['hijri_month'] <= 12: errors.append(f"{where}: hijri_month must be 1 to 12")
    if not isinstance(m.get('hijri_year'), int) or not 1440 <= m['hijri_year'] <= 1500: errors.append(f"{where}: hijri_year out of range")
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(m.get('date'))): errors.append(f"{where}: date must be yyyy-MM-dd"); continue
    if not str(m.get('source_url', '')).startswith('https://'): errors.append(f"{where}: needs an https source_url")
    by_auth.setdefault(m.get('authority'), []).append(m)
for auth, ms in by_auth.items():
    ms.sort(key=lambda m: m['date'])
    for a, b in zip(ms, ms[1:]):
        gap = (datetime.date.fromisoformat(b['date']) - datetime.date.fromisoformat(a['date'])).days
        nxt = (a['hijri_year'] + (a['hijri_month'] == 12), a['hijri_month'] % 12 + 1)
        if (b['hijri_year'], b['hijri_month']) == nxt and gap not in (29, 30):
            errors.append(f"{auth} {a['hijri_month']}/{a['hijri_year']} lasts {gap} days (must be 29 or 30)")

if errors:
    print('\n'.join(errors)); sys.exit(1)
print(f"calendar.json OK: {len(data['announcements'])} announcements, {len(starts)} month starts")
