#!/usr/bin/env python3
"""Puts the anonymous visitor count script on every public website page.

Usage: inject_visitor_counts.py SITE_DIR APP_ID

The App ID comes from config/analytics.json (empty means counting is off, so nothing
is added). Pages that already carry the script (the home page and classic page), the
web app and TV screen, the 404 page, search-engine files and the two form pages that
carry a person's details in the link (verify.html and note.html) are left alone.
The script never loads for browsers that send Global Privacy Control.
"""
import pathlib
import re
import sys

SKIP_NAMES = {"404.html", "verify.html", "note.html", "announcement.html"}
SKIP_DIRS = {"app", "tv"}

SNIPPET = """  <!-- Anonymous visitor counts (TelemetryDeck: no cookies, no IP addresses kept). Nothing loads for browsers that ask sites not to track. See docs/analytics.md. -->
  <script>
    (function () {
      var id = '%s';
      if (!id || navigator.globalPrivacyControl) return;
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://cdn.telemetrydeck.com/websdk/telemetrydeck.min.js';
      s.setAttribute('data-app-id', id);
      document.head.appendChild(s);
      window.PTA_TD = id;
      var t = document.createElement('script');
      t.async = true;
      t.src = 'https://prayertimes.asia/track.js';
      document.head.appendChild(t);
    })();
  </script>
"""


def main() -> int:
    root = pathlib.Path(sys.argv[1])
    app_id = re.sub(r"[^A-Za-z0-9-]", "", sys.argv[2] if len(sys.argv) > 2 else "")
    if not app_id:
        print("Website visitor counts: off (no App ID)")
        return 0
    done = 0
    for page in sorted(root.rglob("*.html")):
        rel = page.relative_to(root)
        if rel.parts[0] in SKIP_DIRS or page.name in SKIP_NAMES or page.name.startswith("google"):
            continue
        text = page.read_text(encoding="utf-8")
        if "cdn.telemetrydeck.com" in text or "</head>" not in text:
            continue
        page.write_text(text.replace("</head>", SNIPPET % app_id + "</head>", 1), encoding="utf-8")
        done += 1
    print(f"Website visitor counts: added to {done} more pages")
    return 0


if __name__ == "__main__":
    sys.exit(main())
