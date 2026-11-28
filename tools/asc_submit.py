#!/usr/bin/env python3
"""Send the waiting iPhone version to App Review (CI only, by hand).

  MODE=read   python3 tools/asc_submit.py   # show the waiting version, its build, text and screenshots
  MODE=submit python3 tools/asc_submit.py   # pick the build, manual release, phased release, Add for Review
  MODE=release python3 tools/asc_submit.py  # owner said release: release the approved version now (phased),
                                            # or, if Apple is still reviewing it, release it as soon as approved

Run only after the owner says go. It never touches the store text or the
screenshots already saved in App Store Connect, apart from filling an empty
"What's New" box. With manual release, nothing reaches the App Store until
the owner presses Release in App Store Connect after Apple approves.
BUILD (optional) is the build number to pick; otherwise the newest build of
this version. Uses the same API key secrets as release.yml.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from asc_listing import BUNDLE, call  # noqa: E402

MODE = os.environ.get("MODE", "read")
BUILD = os.environ.get("BUILD", "").strip()

WHATS_NEW = {
    "en": ("Widgets now follow the look you pick, in light and dark. The app and its alerts speak your "
           "language, English, Malay or Indonesian, and prayer names no longer change it. "
           "Cleaner Prayer dial around midnight and noon, and easier reading at the largest text size."),
    "ms": ("Widget kini mengikut rupa yang anda pilih, dalam mod cerah dan gelap. Aplikasi dan amaran "
           "menggunakan bahasa anda, Inggeris, Melayu atau Indonesia, dan nama solat tidak lagi mengubahnya. "
           "Dail solat lebih kemas pada tengah malam dan tengah hari, serta lebih mudah dibaca pada saiz teks terbesar."),
    "id": ("Widget kini mengikuti tampilan yang Anda pilih, dalam mode terang dan gelap. Aplikasi dan pengingat "
           "memakai bahasa Anda, Inggris, Melayu atau Indonesia, dan nama salat tidak lagi mengubahnya. "
           "Dial salat lebih rapi pada tengah malam dan tengah hari, serta lebih mudah dibaca pada ukuran teks terbesar."),
}


def lang_of(locale):
    return locale.split("-")[0]


def main():
    app = call("GET", f"/v1/apps?filter[bundleId]={BUNDLE}")["data"][0]
    app_id = app["id"]
    versions = call("GET", f"/v1/apps/{app_id}/appStoreVersions?filter[platform]=IOS&limit=5")["data"]
    for v in versions:
        a = v["attributes"]
        print("Version", a["versionString"], a["appStoreState"], "release:", a.get("releaseType"), v["id"])
    if MODE == "release":
        ready = [v for v in versions if v["attributes"]["appStoreState"] == "PENDING_DEVELOPER_RELEASE"]
        if not ready:
            review = [v for v in versions if v["attributes"]["appStoreState"] in ("WAITING_FOR_REVIEW", "IN_REVIEW")]
            if not review:
                sys.exit("Nothing approved or in review. Not released.")
            v = review[0]
            call("PATCH", f"/v1/appStoreVersions/{v['id']}", {"data": {
                "type": "appStoreVersions", "id": v["id"], "attributes": {"releaseType": "AFTER_APPROVAL"}}})
            print(f"\nDone. Version {v['attributes']['versionString']} is still with App Review "
                  f"({v['attributes']['appStoreState']}). It will be released as soon as Apple approves it, phased over 7 days.")
            return
        v = ready[0]
        call("POST", "/v1/appStoreVersionReleaseRequests", {"data": {
            "type": "appStoreVersionReleaseRequests",
            "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": v["id"]}}}}})
        print(f"\nDone. Version {v['attributes']['versionString']} released. Phased release starts now.")
        return

    waiting = [v for v in versions if v["attributes"]["appStoreState"] in
               ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED")]
    if not waiting:
        sys.exit("No version is waiting to be sent for review.")
    version = waiting[0]
    vid, vstr = version["id"], version["attributes"]["versionString"]
    print(f"\nWaiting version {vstr} ({vid})")

    # Text and screenshots already saved on the version.
    problems = []
    locs = call("GET", f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations")["data"]
    for loc in locs:
        a = loc["attributes"]
        print(f"\n[{a['locale']}] description starts: {(a.get('description') or '')[:90]!r}")
        print(f"[{a['locale']}] what's new: {(a.get('whatsNew') or '')[:90]!r}")
        sets = call("GET", f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets")["data"]
        for s in sets:
            shots = call("GET", f"/v1/appScreenshotSets/{s['id']}/appScreenshots?limit=20")["data"]
            names = [x["attributes"].get("fileName") for x in shots]
            states = {(x["attributes"].get("assetDeliveryState") or {}).get("state") for x in shots}
            print(f"[{a['locale']}] {s['attributes']['screenshotDisplayType']}: {len(shots)} {names} {states}")
        if not a.get("description"):
            problems.append(f"{a['locale']} has no description")
        if not any(s["attributes"]["screenshotDisplayType"].startswith("APP_IPHONE") for s in sets):
            problems.append(f"{a['locale']} has no iPhone screenshots")

    # Builds of this version.
    builds = call("GET", f"/v1/builds?filter[app]={app_id}&filter[preReleaseVersion.version]={vstr}"
                         f"&sort=-uploadedDate&limit=10")["data"]
    for b in builds:
        a = b["attributes"]
        print(f"Build {vstr} ({a['version']}) {a['processingState']} expired={a.get('expired')} {b['id']}")
    cur = call("GET", f"/v1/appStoreVersions/{vid}/build").get("data")
    print("Build on the version now:", cur and cur["id"])
    phased = call("GET", f"/v1/appStoreVersions/{vid}/appStoreVersionPhasedRelease").get("data")
    print("Phased release:", phased and phased["attributes"])

    if MODE != "submit":
        if problems:
            print("\nNeeds a look:", "; ".join(problems))
        return
    if problems:
        sys.exit("Not sent. Needs a look: " + "; ".join(problems))

    # 1. The build, once Apple has finished processing it (up to 40 minutes).
    def pick():
        found = call("GET", f"/v1/builds?filter[app]={app_id}&filter[preReleaseVersion.version]={vstr}"
                            f"&sort=-uploadedDate&limit=10")["data"]
        if BUILD:
            found = [b for b in found if b["attributes"]["version"] == BUILD]
        return found[0] if found else None

    build = None
    for _ in range(80):
        build = pick()
        state = build and build["attributes"]["processingState"]
        if state == "VALID":
            break
        if state in ("FAILED", "INVALID"):
            sys.exit(f"Build {build['attributes']['version']} is {state}. Not sent.")
        print("Waiting for the build to finish processing:", state)
        time.sleep(30)
    else:
        sys.exit("The build did not finish processing in time. Not sent.")
    bnum = build["attributes"]["version"]
    call("PATCH", f"/v1/appStoreVersions/{vid}/relationships/build", {"data": {"type": "builds", "id": build["id"]}})
    print(f"OK    build {vstr} ({bnum}) picked")

    # 2. Manual release: the owner presses Release after approval.
    call("PATCH", f"/v1/appStoreVersions/{vid}", {"data": {
        "type": "appStoreVersions", "id": vid, "attributes": {"releaseType": "MANUAL"}}})
    print("OK    manual release")

    # 3. Phased release over 7 days, starting when the owner releases.
    if not phased:
        call("POST", "/v1/appStoreVersionPhasedReleases", {"data": {
            "type": "appStoreVersionPhasedReleases", "attributes": {"phasedReleaseState": "INACTIVE"},
            "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
    print("OK    phased release")

    # 4. What's New, only where the box is empty.
    for loc in locs:
        a = loc["attributes"]
        text = WHATS_NEW.get(lang_of(a["locale"]))
        if text and not (a.get("whatsNew") or "").strip():
            call("PATCH", f"/v1/appStoreVersionLocalizations/{loc['id']}", {"data": {
                "type": "appStoreVersionLocalizations", "id": loc["id"], "attributes": {"whatsNew": text}}})
            print(f"OK    {a['locale']} what's new filled")

    # 5. Add for Review: reuse an open submission or start one, add the version, submit.
    open_subs = call("GET", f"/v1/reviewSubmissions?filter[app]={app_id}&filter[platform]=IOS"
                            f"&filter[state]=READY_FOR_REVIEW")["data"]
    if open_subs:
        sub = open_subs[0]
    else:
        sub = call("POST", "/v1/reviewSubmissions", {"data": {
            "type": "reviewSubmissions", "attributes": {"platform": "IOS"},
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})["data"]
    items = call("GET", f"/v1/reviewSubmissions/{sub['id']}/items")["data"]
    if not items:
        call("POST", "/v1/reviewSubmissionItems", {"data": {
            "type": "reviewSubmissionItems",
            "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub["id"]}},
                              "appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}})
    call("PATCH", f"/v1/reviewSubmissions/{sub['id']}", {"data": {
        "type": "reviewSubmissions", "id": sub["id"], "attributes": {"submitted": True}}})
    print(f"\nDone. Version {vstr} ({bnum}) is with App Review. Manual release, phased over 7 days.")


if __name__ == "__main__":
    main()
