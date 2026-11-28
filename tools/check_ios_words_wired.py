#!/usr/bin/env python3
"""Fails if an iPhone screen still passes hard-coded English to a screen call.

    python3 tools/check_ios_words_wired.py

Text("Settings") must be Text(W("tab.settings")), so Malay and Indonesian show
when they are chosen in Settings > Language. The words live in data/app-words.
Names that never change (the app name) are allowed below.
"""
import glob, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CALLS = {"Text", "Label", "Button", "Toggle", "Section", "Picker", "Link", "LabeledContent", "TextField",
         "NavigationLink", "DisclosureGroup", ".navigationTitle", ".accessibilityLabel", ".accessibilityHint",
         ".accessibilityValue", ".settingsPage", "SettingsRow", "CardTitle", "Chip", "ContentUnavailableView"}
# Allowed as they are: the app's name and a few lines that are the same in every language.
ALLOWED = {"Prayer Times Asia", "Prayer Times\nAsia", "Prayer Times Asia · prayertimes.asia", "Ramadan Kareem",
           "Taqabbalallahu minna wa minkum", "OK"}
# Files that are not screens, or whose text is data with its own language tables.
SKIP = ("Data.swift", "AppWords.swift", "WakeUpMetadata.swift", "PrayerTimesAsiaWidgets")

def parse_strings(src):
    """yield (start,end,parts) for single-line normal string literals; parts: list of ('t',text_raw)|('i',expr)"""
    i=0;n=len(src);out=[]
    while i<n:
        c=src[i]
        if src.startswith('//',i):
            j=src.find('\n',i); i=n if j<0 else j; continue
        if src.startswith('/*',i):
            j=src.find('*/',i); i=n if j<0 else j+2; continue
        if src.startswith('"""',i):
            j=src.find('"""',i+3); i=n if j<0 else j+3; continue
        if c=='#' and re.match(r'#+"',src[i:i+4]):
            m=re.match(r'(#+)"',src[i:]); close='"'+m.group(1)
            j=src.find(close,i+len(m.group(0))); i=n if j<0 else j+len(close); continue
        if c=='"':
            st=i;i+=1;parts=[];buf=''
            ok=True
            while i<n:
                d=src[i]
                if d=='\\':
                    if src[i+1]=='(':
                        if buf: parts.append(('t',buf)); buf=''
                        depth=1;j=i+2
                        # scan nested expr, skipping nested strings
                        while j<n and depth:
                            e=src[j]
                            if e=='"':
                                # nested string: skip using recursion
                                sub=parse_one(src,j)
                                if sub is None: ok=False;break
                                j=sub; continue
                            if e=='(':depth+=1
                            elif e==')':depth-=1
                            j+=1
                        if not ok:break
                        parts.append(('i',src[i+2:j-1])); i=j; continue
                    buf+=src[i:i+2]; i+=2; continue
                if d=='"': 
                    if buf: parts.append(('t',buf))
                    out.append((st,i+1,parts)); i+=1; break
                if d=='\n': ok=False;break
                buf+=d;i+=1
            if not ok: i=st+1
            continue
        i+=1
    return out
def parse_one(src,i):
    # returns end index after the string literal starting at i (handles interpolation)
    n=len(src);i+=1
    while i<n:
        d=src[i]
        if d=='\\':
            if src[i+1]=='(':
                depth=1;j=i+2
                while j<n and depth:
                    e=src[j]
                    if e=='"':
                        j=parse_one(src,j);
                        if j is None:return None
                        continue
                    if e=='(':depth+=1
                    elif e==')':depth-=1
                    j+=1
                i=j;continue
            i+=2;continue
        if d=='"':return i+1
        if d=='\n':return None
        i+=1
    return None
def ctx(src,st):
    k=st-1
    while k>=0 and src[k] in ' \t\n': k-=1
    # labelled arg like "title:"?
    if k>=0 and src[k]==':':
        m=re.search(r'\(\s*(\w+)\s*:$',src[max(0,k-40):k+1])
    if k>=0 and src[k]=='(':
        m=re.search(r'(\.?\w+)$',src[max(0,k-40):k])
        return m.group(1) if m else None
    return None

bad = []
for f in sorted(glob.glob(str(ROOT / "ios/PrayerTimesAsia/**/*.swift"), recursive=True)):
    if any(x in f for x in SKIP):
        continue
    src = open(f, encoding="utf-8").read()
    for st, en, parts in parse_strings(src):
        if ctx(src, st) not in CALLS:
            continue
        raw = "".join(p[1] if p[0] == "t" else "\u0001" for p in parts)
        if not re.search(r"[A-Za-z]{2}", raw) or raw in ALLOWED or raw.strip() in ALLOWED:
            continue
        bad.append(f"{pathlib.Path(f).relative_to(ROOT)}:{src.count(chr(10), 0, st) + 1}  {raw[:70]}")
if bad:
    print('Hard-coded English on iPhone screens (use W("key") and data/app-words):')
    print("\n".join("  " + b for b in bad))
    sys.exit(1)
print("iPhone screens read all their words from the word list")
