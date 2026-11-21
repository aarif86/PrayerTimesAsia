#!/usr/bin/env python3
"""Open a public TestFlight link for the iPhone app (CI only).

    python3 tools/testflight_public.py           # look only: groups, link, review state
    python3 tools/testflight_public.py --go      # make the link and send the latest build to Apple

With a public link anyone can join the iPhone test by tapping it, with no email
and no invite to send by hand (Apple allows up to 10,000 testers). --go does the
one time setup on App Store Connect.

  1. Makes an outside testers group "Public testers" with a public link (or reuses it).
  2. Fills the Beta App Review contact if it is empty (TESTFLIGHT_CONTACT_PHONE).
  3. Adds the latest processed build to the group.
  4. Sends that build to Apple's Beta App Review (about a day the first time).
  5. Prints the link. It starts working once Apple approves the build.

Run "TestFlight words" first so the beta description and feedback email are set.
Uses the same API key secrets as release.yml.
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

GROUP = 'Public testers'
CONTACT = {'contactFirstName': 'Aarif', 'contactLastName': 'Raziff', 'contactEmail': 'salam@prayertimes.asia'}
NOTES = ('Prayer Times Asia shows the five daily prayer times, qibla and nearby masjids. '
         'No sign in is needed. Allow location, or pick a city in Settings.')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--go', action='store_true', help='make the link and submit the build (changes App Store Connect)')
    args = ap.parse_args()

    import jwt  # PyJWT

    key = base64.b64decode(os.environ['APPLE_API_KEY_BASE64']).decode()

    def token():
        now = int(time.time())
        return jwt.encode({'iss': os.environ['APPLE_API_ISSUER_ID'], 'iat': now, 'exp': now + 900,
                           'aud': 'appstoreconnect-v1'},
                          key, algorithm='ES256', headers={'kid': os.environ['APPLE_API_KEY_ID'], 'typ': 'JWT'})

    def call(method, path, body=None, ok=()):
        req = urllib.request.Request('https://api.appstoreconnect.apple.com' + path, method=method,
                                     data=json.dumps(body).encode() if body else None,
                                     headers={'Authorization': f'Bearer {token()}',
                                              'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            text = e.read().decode()[:800]
            if e.code in ok:
                return {'_error': e.code, '_text': text}
            raise RuntimeError(f'{method} {path} -> {e.code} {text}') from None

    apps = call('GET', '/v1/apps?filter[bundleId]=com.prayertimesasia.app')['data']
    if not apps:
        sys.exit('No app with bundle id com.prayertimesasia.app in App Store Connect')
    app_id = apps[0]['id']

    # 1. The group and its public link.
    groups = call('GET', f'/v1/apps/{app_id}/betaGroups?limit=50')['data']
    for g in groups:
        a = g['attributes']
        print(f"Group '{a['name']}': internal={a.get('isInternalGroup')} "
              f"publicLink={a.get('publicLinkEnabled')} {a.get('publicLink') or ''}")
    group = next((g for g in groups if g['attributes']['name'] == GROUP), None)

    review = call('GET', f'/v1/apps/{app_id}/betaAppReviewDetail')['data']
    ra = review['attributes']
    print('Beta App Review contact:', ra.get('contactFirstName'), ra.get('contactLastName'),
          ra.get('contactEmail'), 'phone set' if ra.get('contactPhone') else 'NO PHONE')

    builds = call('GET', f'/v1/builds?filter[app]={app_id}&filter[processingState]=VALID'
                         '&sort=-uploadedDate&limit=1&include=buildBetaDetail')
    if not builds['data']:
        sys.exit('No processed build yet. Run "Release to TestFlight" first.')
    build = builds['data'][0]
    detail = next((d['attributes'] for d in builds.get('included', []) if d['type'] == 'buildBetaDetails'), {})
    print(f"Latest build {build['attributes']['version']}: external={detail.get('externalBuildState')}")

    if not args.go:
        print('\nLook only. Run with "go" to make the public link and send this build to Apple.')
        return

    if not group:
        group = call('POST', '/v1/betaGroups', {'data': {
            'type': 'betaGroups',
            'attributes': {'name': GROUP, 'publicLinkEnabled': True, 'publicLinkLimitEnabled': False,
                           'feedbackEnabled': True},
            'relationships': {'app': {'data': {'type': 'apps', 'id': app_id}}}}})['data']
        print(f"Made group '{GROUP}'.")
    elif not group['attributes'].get('publicLinkEnabled'):
        group = call('PATCH', f"/v1/betaGroups/{group['id']}", {'data': {
            'type': 'betaGroups', 'id': group['id'],
            'attributes': {'publicLinkEnabled': True, 'publicLinkLimitEnabled': False}}})['data']
        print('Turned the public link on.')

    # 2. Who Apple's reviewer can contact.
    phone = os.environ.get('TESTFLIGHT_CONTACT_PHONE', '').strip()
    if not ra.get('contactPhone') and not phone:
        sys.exit('Apple needs a contact phone for Beta App Review. Add the TESTFLIGHT_CONTACT_PHONE '
                 'secret (for example +65 9123 4567) and run again.')
    attrs = {'demoAccountRequired': False, 'notes': ra.get('notes') or NOTES}
    for k, v in CONTACT.items():
        if not ra.get(k):
            attrs[k] = v
    if phone and not ra.get('contactPhone'):
        attrs['contactPhone'] = phone
    call('PATCH', f"/v1/betaAppReviewDetails/{review['id']}",
         {'data': {'type': 'betaAppReviewDetails', 'id': review['id'], 'attributes': attrs}})
    print('Beta App Review contact set.')

    # 3. The build into the group.
    call('POST', f"/v1/betaGroups/{group['id']}/relationships/builds",
         {'data': [{'type': 'builds', 'id': build['id']}]}, ok=(409,))
    print(f"Build {build['attributes']['version']} is in '{GROUP}'.")

    # 4. Send it to Beta App Review (409 means it is already there or approved).
    r = call('POST', '/v1/betaAppReviewSubmissions', {'data': {
        'type': 'betaAppReviewSubmissions',
        'relationships': {'build': {'data': {'type': 'builds', 'id': build['id']}}}}}, ok=(409, 422))
    if '_error' in r:
        print('Apple says:', r['_text'])
    else:
        print('Sent to Apple Beta App Review.')

    # 5. The link.
    group = call('GET', f"/v1/betaGroups/{group['id']}")['data']
    link = group['attributes'].get('publicLink')
    print(f'\nPUBLIC TESTFLIGHT LINK: {link}')
    out = os.environ.get('GITHUB_STEP_SUMMARY')
    if out and link:
        with open(out, 'a') as f:
            f.write(f'Public TestFlight link: {link}\n\nIt works once Apple approves the build.\n')


if __name__ == '__main__':
    main()
