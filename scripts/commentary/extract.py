"""Extract Matthew Henry's Concise Commentary (SWORD RawCom, KJV versification) to JSON."""
import json, re, struct, sys
from pysword.books import BibleStructure

src, out = sys.argv[1], sys.argv[2]
p = src + "/modules/comments/rawcom/mhcc/"
bs = BibleStructure("kjv")
books = bs.get_books()

def entries(t):
    idx = open(p + f"{t}.vss", "rb").read(); dat = open(p + t, "rb").read()
    return [struct.unpack("<IH", idx[i*6:i*6+6]) + (dat,) for i in range(len(idx)//6)]

def clean(b):
    s = b.decode("cp1252", errors="replace").replace("\r", "")
    return s

result = {}
for t in ("ot", "nt"):
    ents = entries(t)
    i = 2  # 0: testament heading, 1: module heading
    for book in books[t]:
        off, size, dat = ents[i]; i += 1
        intro = clean(dat[off:off+size]).strip()
        chapters = []
        for c, vcount in enumerate(book.chapter_lengths, 1):
            off, size, dat = ents[i]; i += 1
            heading = clean(dat[off:off+size]).strip()
            seen = set(); sections = []
            for v in range(1, vcount + 1):
                off, size, dat = ents[i]; i += 1
                if size == 0 or off in seen: continue
                seen.add(off)
                sections.append({"v": v, "text": clean(dat[off:off+size]).strip()})
            chapters.append({"heading": heading, "sections": sections})
        result[book.name] = {"intro": intro, "chapters": chapters}
    assert i == len(ents), (t, i, len(ents))
json.dump(result, open(out, "w"), indent=0)
print("ok", len(result))
