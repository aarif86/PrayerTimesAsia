#!/usr/bin/env python3
"""Fill the App Store listing in App Store Connect from docs/store-listings (CI only).

  MODE=read  python3 tools/asc_listing.py   # print what App Store Connect has now
  MODE=write python3 tools/asc_listing.py   # write text, screenshots, review note, build

Never submits for review. Uses the same API key secrets as release.yml.
Text comes from docs/store-listings/<en|ms|id>.md, screenshots from
design/store/app-store/<en|ms|id>/. App Privacy answers and the EU trader
question are not in Apple's API and are filled in by hand.
"""
import base64
import glob
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.request

import jwt  # PyJWT

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODE = os.environ.get("MODE", "read")
BUNDLE = "com.prayertimesasia.app"
API = "https://api.appstoreconnect.apple.com"
SITE = "https://prayertimes.asia"
PRIVACY = "https://aarif86.github.io/PrayerTimesAsia/privacy.html"
SUPPORT = "https://aarif86.github.io/PrayerTimesAsia/"
LANGS = {"en": None, "ms": "ms", "id": "id"}  # None = the app's primary locale
SHOT_TYPES = {"iphone": "APP_IPHONE_67", "ipad": "APP_IPAD_PRO_3GEN_129"}

REVIEW_NOTES = """Prayer Times Asia shows the five daily Muslim prayer times and the qibla (direction of Makkah). It is free, has no account, no ads and no in-app purchases.

Location: the app asks for location while in use, to pick the official timetable for the user's country and zone (MUIS in Singapore, JAKIM in Malaysia, Kemenag in Indonesia) and to point the qibla compass. Times are worked out or looked up on the device. Exact coordinates are never sent anywhere. If location is declined, the user can pick a city from the list.

To see travel mode without travelling, open the Prayer tab, tap the place name and pick a city in Vietnam or Japan. A welcome card explains how the times changed, and the Journey screen shows the traveller (musafir) rules.

To see the Ramadan features outside Ramadan, open Settings, Ramadan and Syawal, Try Ramadan.

Notifications and alarms are optional prayer alerts the user turns on. Alarms use AlarmKit so a Subuh (dawn) wake up alarm can ring like a clock alarm.

The app is open source (GNU AGPL 3.0)."""

_tok = {"t": None, "exp": 0}


def token():
    if time.time() > _tok["exp"] - 60:
        key = base64.b64decode(os.environ["APPLE_API_KEY_BASE64"]).decode()
        now = int(time.time())
        _tok["t"] = jwt.encode({"iss": os.environ["APPLE_API_ISSUER_ID"], "iat": now, "exp": now + 1100,
                                "aud": "appstoreconnect-v1"}, key, algorithm="ES256",
                               headers={"kid": os.environ["APPLE_API_KEY_ID"], "typ": "JWT"})
        _tok["exp"] = now + 1100
    return _tok["t"]


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"{method} {path} -> {e.code} {detail[:1500]}") from None


problems = []


def attempt(label, fn):
    try:
        out = fn()
        print(f"OK    {label}")
        return out
    except Exception as e:  # keep going, report at the end
        print(f"FAIL  {label}\n      {e}")
        problems.append(label)
        return None


def boxes(lang):
    text = open(os.path.join(ROOT, f"docs/store-listings/{lang}.md"), encoding="utf-8").read()
    # Only the App Store section (before "## Google Play").
    app_store = text.split("## Google Play")[0]
    found = dict(re.findall(r"^### ([^\n]+?) \(limit \d+\)\n\n```text\n(.*?)\n```", app_store, re.M | re.S))
    return found


def main():
    app = call("GET", f"/v1/apps?filter[bundleId]={BUNDLE}")["data"][0]
    app_id, primary = app["id"], app["attributes"]["primaryLocale"]
    print("App:", app["attributes"]["name"], app_id, "primary locale:", primary,
          "contentRights:", app["attributes"].get("contentRightsDeclaration"))

    versions = call("GET", f"/v1/apps/{app_id}/appStoreVersions?filter[platform]=IOS&limit=5")["data"]
    for v in versions:
        print("Version", v["attributes"]["versionString"], v["attributes"]["appStoreState"], v["id"],
              "copyright:", v["attributes"].get("copyright"))
    version = next(v for v in versions if v["attributes"]["appStoreState"] in
                   ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"))
    vid = version["id"]

    infos = call("GET", f"/v1/apps/{app_id}/appInfos")["data"]
    info = next(i for i in infos if i["attributes"].get("appStoreState", i["attributes"].get("state")) != "READY_FOR_SALE")
    info_id = info["id"]
    print("AppInfo", info_id, info["attributes"])
    cats = call("GET", f"/v1/appInfos/{info_id}?include=primaryCategory,secondaryCategory")
    print("Categories:", [c["id"] for c in cats.get("included", [])])

    info_locs = {l["attributes"]["locale"]: l for l in call("GET", f"/v1/appInfos/{info_id}/appInfoLocalizations")["data"]}
    ver_locs = {l["attributes"]["locale"]: l for l in
                call("GET", f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations")["data"]}
    print("AppInfo locales:", {k: v["attributes"] for k, v in info_locs.items()})
    print("Version locales:", {k: {a: (b[:40] if isinstance(b, str) else b) for a, b in v["attributes"].items()}
                               for k, v in ver_locs.items()})

    builds = call("GET", f"/v1/builds?filter[app]={app_id}&sort=-uploadedDate&limit=5")["data"]
    for b in builds:
        a = b["attributes"]
        print(f"Build {a['version']} {a['processingState']} expired={a.get('expired')} uploaded={a['uploadedDate']} {b['id']}")
    cur = call("GET", f"/v1/appStoreVersions/{vid}/build").get("data")
    print("Build on the version now:", cur and cur["id"])
    try:
        rd = call("GET", f"/v1/appStoreVersions/{vid}/appStoreReviewDetail").get("data")
        print("Review detail:", rd and {k: (v[:60] if isinstance(v, str) else v) for k, v in rd["attributes"].items()})
    except Exception as e:
        rd = None
        print("Review detail: none yet", str(e)[:200])
    age = attempt("read age rating", lambda: call("GET", f"/v1/appInfos/{info_id}/ageRatingDeclaration")["data"])
    if age:
        print("Age rating:", age["attributes"])

    if MODE != "write":
        return

    # Categories and content rights.
    attempt("categories Reference + Travel", lambda: call("PATCH", f"/v1/appInfos/{info_id}", {"data": {
        "type": "appInfos", "id": info_id, "relationships": {
            "primaryCategory": {"data": {"type": "appCategories", "id": "REFERENCE"}},
            "secondaryCategory": {"data": {"type": "appCategories", "id": "TRAVEL"}}}}}))
    # Masjid lists come from OpenStreetMap (credited) and times follow public
    # authority timetables, so the honest answer is "uses third party content".
    attempt("content rights", lambda: call("PATCH", f"/v1/apps/{app_id}", {"data": {
        "type": "apps", "id": app_id, "attributes": {"contentRightsDeclaration": "USES_THIRD_PARTY_CONTENT"}}}))
    attempt("version copyright", lambda: call("PATCH", f"/v1/appStoreVersions/{vid}", {"data": {
        "type": "appStoreVersions", "id": vid, "attributes": {"copyright": "2026 Nasar Pte Ltd"}}}))

    # Age rating, every question answered with none / no.
    if age:
        yes_no = ("advertising", "gambling", "healthOrWellnessTopics", "lootBox", "messagingAndChat",
                  "parentalControls", "ageAssurance", "socialMedia", "socialMediaAgeRestricted",
                  "unrestrictedWebAccess", "userGeneratedContent", "seventeenPlus")
        levels = ("alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated",
                  "gunsOrOtherWeapons", "medicalOrTreatmentInformation", "profanityOrCrudeHumor",
                  "sexualContentGraphicAndNudity", "sexualContentOrNudity", "horrorOrFearThemes",
                  "matureOrSuggestiveThemes", "violenceCartoonOrFantasy",
                  "violenceRealisticProlongedGraphicOrSadistic", "violenceRealistic")
        attrs = {k: False for k in yes_no if k in age["attributes"]}
        attrs.update({k: "NONE" for k in levels if k in age["attributes"]})
        attempt("age rating all none", lambda: call("PATCH", f"/v1/ageRatingDeclarations/{age['id']}", {"data": {
            "type": "ageRatingDeclarations", "id": age["id"], "attributes": attrs}}))

    for lang, locale in LANGS.items():
        locale = locale or primary
        b = boxes(lang)
        # App info (name, subtitle, privacy link).
        ia = {"name": b["App name"], "subtitle": b["Subtitle"], "privacyPolicyUrl": PRIVACY}
        if locale in info_locs:
            lid = info_locs[locale]["id"]
            attempt(f"{locale} name and subtitle", lambda: call("PATCH", f"/v1/appInfoLocalizations/{lid}", {"data": {
                "type": "appInfoLocalizations", "id": lid, "attributes": ia}}))
        else:
            attempt(f"{locale} name and subtitle (new language)", lambda: call("POST", "/v1/appInfoLocalizations", {"data": {
                "type": "appInfoLocalizations", "attributes": {"locale": locale, **ia},
                "relationships": {"appInfo": {"data": {"type": "appInfos", "id": info_id}}}}}))
        # Version text.
        va = {"description": b["Description"], "keywords": b["Keywords"],
              "promotionalText": b["Promotional text"], "supportUrl": SUPPORT, "marketingUrl": SUPPORT}
        if locale in ver_locs:
            vlid = ver_locs[locale]["id"]
            attempt(f"{locale} description, keywords, promo", lambda: call("PATCH", f"/v1/appStoreVersionLocalizations/{vlid}", {"data": {
                "type": "appStoreVersionLocalizations", "id": vlid, "attributes": va}}))
        else:
            made = attempt(f"{locale} description, keywords, promo (new language)", lambda: call("POST", "/v1/appStoreVersionLocalizations", {"data": {
                "type": "appStoreVersionLocalizations", "attributes": {"locale": locale, **va},
                "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}}))
            if not made:
                continue
            vlid = made["data"]["id"]
        for kind, display in SHOT_TYPES.items():
            files = sorted(glob.glob(os.path.join(ROOT, f"design/store/app-store/{lang}/{kind}-*.png")),
                           key=lambda p: int(re.search(r"-(\d+)\.png$", p).group(1)))
            attempt(f"{locale} {kind} screenshots ({len(files)})", lambda: upload_set(vlid, display, files))

    # Build: the newest processed, unexpired one.
    valid = [b for b in builds if b["attributes"]["processingState"] == "VALID" and not b["attributes"].get("expired")]
    if valid:
        bid = valid[0]["id"]
        attempt(f"pick build {valid[0]['attributes']['version']}", lambda: call("PATCH", f"/v1/appStoreVersions/{vid}/relationships/build",
                                                                              {"data": {"type": "builds", "id": bid}}))
    else:
        problems.append("no valid build to pick")

    # App Review note (contact details are left as they are, or filled by hand).
    ra = {"notes": REVIEW_NOTES, "demoAccountRequired": False, "contactEmail": "salam@prayertimes.asia",
          "contactFirstName": "Aarif", "contactLastName": "Raziff"}
    if rd:
        attempt("App Review note", lambda: call("PATCH", f"/v1/appStoreReviewDetails/{rd['id']}", {"data": {
            "type": "appStoreReviewDetails", "id": rd["id"], "attributes": ra}}))
    else:
        # Apple wants a phone number with the contact name. Without one, save
        # the note alone; the contact is added by hand on the version page.
        made = attempt("App Review note (new)", lambda: call("POST", "/v1/appStoreReviewDetails", {"data": {
            "type": "appStoreReviewDetails", "attributes": ra,
            "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}}))
        if not made:
            problems.pop()
            attempt("App Review note only (contact phone to add by hand)", lambda: call("POST", "/v1/appStoreReviewDetails", {"data": {
                "type": "appStoreReviewDetails", "attributes": {"notes": REVIEW_NOTES, "demoAccountRequired": False},
                "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}}))

    print("\nDone. Nothing was submitted for review.")
    if problems:
        print("Needs a look:", "; ".join(problems))
        raise SystemExit(1)


def upload_set(vlid, display, files):
    sets = call("GET", f"/v1/appStoreVersionLocalizations/{vlid}/appScreenshotSets")["data"]
    s = next((x for x in sets if x["attributes"]["screenshotDisplayType"] == display), None)
    if s is None:
        s = call("POST", "/v1/appScreenshotSets", {"data": {"type": "appScreenshotSets",
            "attributes": {"screenshotDisplayType": display},
            "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": vlid}}}}})["data"]
    # Replace what is there.
    for old in call("GET", f"/v1/appScreenshotSets/{s['id']}/appScreenshots")["data"]:
        call("DELETE", f"/v1/appScreenshots/{old['id']}")
    for path in files:
        blob = open(path, "rb").read()
        shot = call("POST", "/v1/appScreenshots", {"data": {"type": "appScreenshots",
            "attributes": {"fileName": os.path.basename(path), "fileSize": len(blob)},
            "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": s["id"]}}}}})["data"]
        for op in shot["attributes"]["uploadOperations"]:
            part = blob[op["offset"]:op["offset"] + op["length"]]
            req = urllib.request.Request(op["url"], data=part, method=op["method"],
                                         headers={h["name"]: h["value"] for h in op["requestHeaders"]})
            urllib.request.urlopen(req, timeout=120).read()
        call("PATCH", f"/v1/appScreenshots/{shot['id']}", {"data": {"type": "appScreenshots", "id": shot["id"],
            "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(blob).hexdigest()}}})
    return True


if __name__ == "__main__":
    main()
