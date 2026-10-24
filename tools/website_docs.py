#!/usr/bin/env python3
"""Write docs/website/changelog.md and roadmap.md from their JSON sources.

Edit the JSON (it is what the website will read), then run:
    python3 tools/website_docs.py
"""
import json
from datetime import date
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent / "docs" / "website"
LABEL = {"new": "New", "improved": "Improved", "fixed": "Fixed"}
STATUS = {"now": "Now", "next": "Next", "later": "Later", "done": "Done"}


def nice(d: str) -> str:
    return date.fromisoformat(d).strftime("%-d %B %Y")


def changelog() -> str:
    data = json.loads((DIR / "changelog.json").read_text())
    out = ["# Changelog", "", f"What's new in {data['app']}, newest first.", ""]
    for r in data["releases"]:
        out += [f"## {r['title']}", "", f"*{r['version']} (build {r['build']}) · {nice(r['date'])}*", "", r["summary"], ""]
        for kind in ("new", "improved", "fixed"):
            items = [c["text"] for c in r["changes"] if c["type"] == kind]
            if items:
                out += [f"**{LABEL[kind]}**", ""] + [f"- {t}" for t in items] + [""]
    return "\n".join(out)


def roadmap() -> str:
    data = json.loads((DIR / "roadmap.json").read_text())
    out = ["# Roadmap", "", f"Where {data['app']} is heading.", ""]
    for status in ("now", "next", "later"):
        items = [i for i in data["roadmap"] if i["status"] == status]
        if items:
            out += [f"## {STATUS[status]}", ""] + [f"- **{i['title']}** - {i['text']}" for i in items] + [""]
    out += ["## Feature requests", "", "| Request | Status |", "|---|---|"]
    for r in data["requests"]:
        status = f"Done in build {r['build']}" if r["status"] == "done" else STATUS[r["status"]]
        out.append(f"| {r['title']} | {status} |")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    (DIR / "changelog.md").write_text(changelog())
    (DIR / "roadmap.md").write_text(roadmap())
    print("Wrote changelog.md and roadmap.md")
