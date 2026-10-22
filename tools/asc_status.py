"""Prints TestFlight build status from the App Store Connect API (CI only).

Uses the same API key secrets as release.yml. Shows each recent build's
processing state and whether it is assigned to the internal testing groups.
"""
import base64
import json
import os
import time
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
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


apps = get('/v1/apps?filter[bundleId]=com.prayertimesasia.app')['data']
if not apps:
    raise SystemExit('No app with bundle id com.prayertimesasia.app in App Store Connect')
app = apps[0]
print('App:', app['attributes']['name'], app['id'])
builds = get(f"/v1/builds?filter[app]={app['id']}&sort=-uploadedDate&limit=5&include=buildBetaDetail")
details = {d['id']: d['attributes'] for d in builds.get('included', []) if d['type'] == 'buildBetaDetails'}
if not builds['data']:
    print('No builds found yet (still uploading/processing or rejected - check email).')
for b in builds['data']:
    a = b['attributes']
    bd_id = b['relationships']['buildBetaDetail']['data']['id']
    print(f"Build {a['version']}: processing={a['processingState']} uploaded={a['uploadedDate']} "
          f"expired={a.get('expired')} internal={details.get(bd_id, {}).get('internalBuildState')} "
          f"external={details.get(bd_id, {}).get('externalBuildState')}")
groups = get(f"/v1/apps/{app['id']}/betaGroups")['data']
for g in groups:
    ga = g['attributes']
    gb = get(f"/v1/betaGroups/{g['id']}/builds")['data']
    print(f"Group '{ga['name']}': internal={ga.get('isInternalGroup')} "
          f"autoDistribute={ga.get('hasAccessToAllBuilds')} builds={[x['attributes']['version'] for x in gb]}")
