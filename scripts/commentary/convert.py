"""raw.json (from extract.py) -> public/commentary/<bookId>.json"""
import json, re, sys
raw = json.load(open(sys.argv[1])); out = sys.argv[2]; ids = sys.argv[3].split(",")
assert len(raw) == 66 == len(ids)

def unwrap(s):
    s = re.sub(r"#([^|#]+)\|", r"(\1)", s)          # cross refs "#Mt 5:28|" -> "(Mt 5:28)"
    paras = re.split(r"\n\s*\n", s)
    return [re.sub(r"\s+", " ", p).strip() for p in paras if p.strip()]

RANGE = re.compile(r"^(\d+)(?:\s*[-,]\s*(\d+))?\.?\s+")
OUT_ITEM = re.compile(r"(.+?)\s*\((\d+)(?:\s*[-,]\s*(\d+))?\)")

def outline(text):
    text = re.sub(r"\s+", " ", text.lstrip("* ")).strip()
    items = [{"title": m.group(1).strip(" .;,"), "from": int(m.group(2)), "to": int(m.group(3) or m.group(2))} for m in OUT_ITEM.finditer(text)]
    return items or ([{"title": text, "from": 0, "to": 0}] if text else [])

stats = {"chapters": 0, "empty": 0}
for (name, book), bid in zip(raw.items(), ids):
    intro = unwrap(book["intro"].lstrip("* ")) if book["intro"].startswith("**") else []
    chapters = []
    heads = [c["heading"] for c in book["chapters"]]
    for ci, ch in enumerate(book["chapters"]):
        stats["chapters"] += 1
        h = ch["heading"]
        # Empty slots are linked to the next entry; drop headings that leaked from a later chapter/book.
        leaked = (ci + 1 < len(heads) and h == heads[ci + 1] and not ch["sections"]) or (h.startswith("**") and ci > 0)
        outl = []
        if not leaked:
            parts = re.split(r"\n\s*\n", h)
            for part in parts:
                part = part.strip()
                if part.startswith("**"):
                    if ci == 0 and not intro: intro = unwrap(part.lstrip("* "))
                elif part.startswith("*"):
                    outl = outline(part)
        secs = []
        for s in ch["sections"]:
            t = s["text"]; m = RANGE.match(t)
            frm, to = (int(m.group(1)), int(m.group(2) or m.group(1))) if m else (s["v"], s["v"])
            if m: t = t[m.end():]
            secs.append({"from": frm, "to": max(to, frm), "text": unwrap(t)})
        if not secs: stats["empty"] += 1
        chapters.append({"outline": outl, "sections": secs})
    json.dump({"id": bid, "intro": intro, "chapters": chapters}, open(f"{out}/{bid}.json", "w"), separators=(",", ":"))
print(stats)
