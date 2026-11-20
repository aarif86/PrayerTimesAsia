#!/usr/bin/env python3
"""Put the TestFlight words from ios/TestFlight/ on App Store Connect (CI only).

    python3 tools/testflight_words.py --check            # check the text files, no network
    python3 tools/testflight_words.py                    # latest build
    python3 tools/testflight_words.py --build 41 --wait  # that build, waiting for Apple to see it

Sets "What to Test" (betaBuildLocalizations.whatsNew) on the build, and the beta
description and feedback email (betaAppLocalizations) on the app, for en-US.
Uses the same API key secrets as release.yml.
"""
import argparse
import base64
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'ios' / 'TestFlight'
LOCALE = 'en-US'
FEEDBACK_EMAIL = 'salam@prayertimes.asia'
CLOSING = 'Always follow your local religious authority.'


def load():
    words = {
        'whatsNew': (ROOT / f'WhatToTest.{LOCALE}.txt').read_text(encoding='utf-8').strip(),
        'description': (ROOT / f'BetaDescription.{LOCALE}.txt').read_text(encoding='utf-8').strip(),
    }
    problems = []
    for name, text in words.items():
        if len(text) > 4000:
            problems.append(f'{name} is {len(text)} characters, the limit is 4000')
        if re.search(r'[:–—]| - ', re.sub(r'https?://\S+', '', text)):
            problems.append(f'{name} has a colon or a dash (public wording rule)')
        if not text.endswith(CLOSING):
            problems.append(f'{name} must end with "{CLOSING}"')
    if problems:
        sys.exit('TestFlight words need a fix:\n  ' + '\n  '.join(problems))
    return words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--build', help='build number (CFBundleVersion); default is the latest')
    ap.add_argument('--wait', action='store_true', help='wait up to 40 minutes for Apple to list the build')
    args = ap.parse_args()
    words = load()
    if args.check:
        print('TestFlight words look fine.')
        return

    import jwt  # PyJWT

    key = base64.b64decode(os.environ['APPLE_API_KEY_BASE64']).decode()

    def token():
        now = int(time.time())
        return jwt.encode({'iss': os.environ['APPLE_API_ISSUER_ID'], 'iat': now, 'exp': now + 900,
                           'aud': 'appstoreconnect-v1'},
                          key, algorithm='ES256', headers={'kid': os.environ['APPLE_API_KEY_ID'], 'typ': 'JWT'})

    def call(method, path, body=None):
        req = urllib.request.Request('https://api.appstoreconnect.apple.com' + path, method=method,
                                     data=json.dumps(body).encode() if body else None,
                                     headers={'Authorization': f'Bearer {token()}',
                                              'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            raise RuntimeError(f'{method} {path} -> {e.code} {e.read().decode()[:500]}') from None

    apps = call('GET', '/v1/apps?filter[bundleId]=com.prayertimesasia.app')['data']
    if not apps:
        sys.exit('No app with bundle id com.prayertimesasia.app in App Store Connect')
    app_id = apps[0]['id']

    # Beta description and feedback email (one per app).
    locs = call('GET', f'/v1/apps/{app_id}/betaAppLocalizations')['data']
    attrs = {'description': words['description'], 'feedbackEmail': FEEDBACK_EMAIL,
             'marketingUrl': 'https://prayertimes.asia', 'privacyPolicyUrl': 'https://prayertimes.asia/privacy.html'}
    mine = next((l for l in locs if l['attributes']['locale'] == LOCALE), None)
    if mine:
        call('PATCH', f"/v1/betaAppLocalizations/{mine['id']}",
             {'data': {'type': 'betaAppLocalizations', 'id': mine['id'], 'attributes': attrs}})
    else:
        call('POST', '/v1/betaAppLocalizations',
             {'data': {'type': 'betaAppLocalizations', 'attributes': {**attrs, 'locale': LOCALE},
                       'relationships': {'app': {'data': {'type': 'apps', 'id': app_id}}}}})
    print('Beta description and feedback email set.')

    # Find the build.
    query = f'/v1/builds?filter[app]={app_id}&sort=-uploadedDate&limit=1'
    if args.build:
        query += f'&filter[version]={args.build}'
    deadline = time.time() + (40 * 60 if args.wait else 0)
    while True:
        found = call('GET', query)['data']
        if found:
            break
        if time.time() > deadline:
            sys.exit(f'Build {args.build or "(latest)"} is not in App Store Connect yet. '
                     'Run the TestFlight words workflow again once Apple has processed it.')
        print('Waiting for Apple to list the build...')
        time.sleep(60)
    build = found[0]
    number = build['attributes']['version']

    # What to Test, retried while Apple is still processing the build.
    while True:
        try:
            locs = call('GET', f"/v1/builds/{build['id']}/betaBuildLocalizations")['data']
            mine = next((l for l in locs if l['attributes']['locale'] == LOCALE), None)
            if mine:
                call('PATCH', f"/v1/betaBuildLocalizations/{mine['id']}",
                     {'data': {'type': 'betaBuildLocalizations', 'id': mine['id'],
                               'attributes': {'whatsNew': words['whatsNew']}}})
            else:
                call('POST', '/v1/betaBuildLocalizations',
                     {'data': {'type': 'betaBuildLocalizations',
                               'attributes': {'locale': LOCALE, 'whatsNew': words['whatsNew']},
                               'relationships': {'build': {'data': {'type': 'builds', 'id': build['id']}}}}})
            break
        except RuntimeError as e:
            if time.time() > deadline:
                raise
            print(f'Not yet ({e}). Trying again in a minute.')
            time.sleep(60)
    print(f'What to Test set on build {number}.')


if __name__ == '__main__':
    main()
