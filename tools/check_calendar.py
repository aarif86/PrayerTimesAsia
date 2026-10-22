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

if errors:
    print('\n'.join(errors)); sys.exit(1)
print(f"calendar.json OK: {len(data['announcements'])} announcements")
