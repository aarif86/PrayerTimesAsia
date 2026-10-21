"""Validates data/mosques.json so a bad record can never reach the app. Run in CI."""
import json
import os
import re
import sys

path = os.path.join(os.path.dirname(__file__), '..', 'data', 'mosques.json')
d = json.load(open(path))
errors = []
assert d.get('version') == 1, 'version must be 1'
ids = set()
for i, m in enumerate(d.get('mosques', [])):
    where = f"mosques[{i}] ({m.get('id')})"
    for key in ('id', 'name', 'lat', 'lng', 'country', 'source', 'verifiedAt', 'grade'):
        if key not in m:
            errors.append(f'{where}: missing {key}')
    if m.get('id') in ids:
        errors.append(f'{where}: duplicate id')
    ids.add(m.get('id'))
    if not (-90 <= m.get('lat', 999) <= 90 and -180 <= m.get('lng', 999) <= 180):
        errors.append(f'{where}: bad coordinates')
    if m.get('grade') not in ('B', 'C'):
        errors.append(f"{where}: grade must be B or C (A is official sources, D is calculation)")
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(m.get('verifiedAt', ''))):
        errors.append(f'{where}: verifiedAt must be YYYY-MM-DD')
    fp = m.get('fingerprint')
    if fp:
        if not 10 <= fp.get('fajrAngle', 0) <= 22:
            errors.append(f'{where}: fajrAngle out of range')
        if (fp.get('ishaAngle') is None) == (fp.get('ishaInterval') is None):
            errors.append(f'{where}: set exactly one of ishaAngle / ishaInterval')
        if fp.get('asrFactor') not in (1, 2):
            errors.append(f'{where}: asrFactor must be 1 or 2')
        for k, v in fp.get('offsets', {}).items():
            if k not in ('fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha') or not -10 <= v <= 15:
                errors.append(f'{where}: bad offset {k}={v}')
    for k, rule in (m.get('jamaah') or {}).items():
        if k not in ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha') or len([x for x in rule.values() if x is not None]) != 1:
            errors.append(f'{where}: jamaah.{k} needs exactly one of fixed / afterMinutes / beforeSunriseMinutes')
        if rule.get('fixed') and not re.fullmatch(r'\d{2}:\d{2}', rule['fixed']):
            errors.append(f'{where}: jamaah.{k}.fixed must be HH:MM')
    if m.get('jumuah') and not re.fullmatch(r'\d{2}:\d{2}', m['jumuah']):
        errors.append(f'{where}: jumuah must be HH:MM')
print(f"{len(d.get('mosques', []))} mosque profile(s) checked")
if errors:
    print('\n'.join(errors))
    sys.exit(1)
