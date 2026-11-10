"""Prints TestFlight crash reports testers shared (App Store Connect API, CI only).

Uses the same API key secrets as release.yml. When a tester taps Share on the
"Crashed" dialog, the report shows up here with its crash log.
"""
import base64
import json
import os
import time
import urllib.error
import urllib.request

import jwt  # PyJWT

key = base64.b64decode(os.environ['APPLE_API_KEY_BASE64']).decode()
token = jwt.encode(
    {'iss': os.environ['APPLE_API_ISSUER_ID'], 'iat': int(time.time()), 'exp': int(time.time()) + 900,
     'aud': 'appstoreconnect-v1'},
    key, algorithm='ES256', headers={'kid': os.environ['APPLE_API_KEY_ID'], 'typ': 'JWT'})


def get(path):
    req = urllib.request.Request('https://api.appstoreconnect.apple.com' + path,
                                 headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, path, e.read()[:500])
        return {'data': []}


app = get('/v1/apps?filter[bundleId]=com.prayertimesasia.app')['data'][0]
subs = get(f"/v1/apps/{app['id']}/betaFeedbackCrashSubmissions?limit=20")
print('Crash submissions:', len(subs['data']))
for s in subs['data'][:8]:
    a = s['attributes']
    print('=' * 80)
    print(json.dumps({k: a.get(k) for k in ('createdDate', 'comment', 'deviceModel', 'osVersion', 'appPlatform',
                                             'buildBundleId', 'locale', 'batteryPercentage')}))
    log = get(f"/v1/betaFeedbackCrashSubmissions/{s['id']}/crashLog")
    text = (log.get('data') or {}).get('attributes', {}).get('logText') if isinstance(log.get('data'), dict) else None
    print(text[:20000] if text else json.dumps(log)[:2000])
