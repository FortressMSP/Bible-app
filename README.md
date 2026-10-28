# Scroll — swipe through Scripture

Scroll is the Reels/TikTok-style feed, but for the Bible. It's built to replace doom scrolling: one full-screen card per swipe, and the feed never runs out. It flows passage by passage, chapter by chapter, and book by book through the whole Bible, then loops from Revelation back to Genesis.

It makes **no AI requests**. Scripture is the **New King James Version** via [API.Bible](https://api.bible). Commentary is **Matthew Henry's Concise Commentary** (public domain), bundled with the app.

## The feed

Every swipe snaps to exactly one card:

| Card | What it shows |
| --- | --- |
| **Book cover** | Book name, tagline, author, date and length |
| **Before you begin** | Hand-written book preview and themes |
| **Watch for** | Three things to look for, plus the key verse |
| **Chapter intro** | Chapter number, psalm title, reading time, and Henry's outline of the chapter ("In this chapter") |
| **Passage** | One paragraph or stanza (long ones are split at verse boundaries), with NKJV section headings |
| **Insight** | A quotable line from Matthew Henry, dropped in between passages, with *Read the full note* |
| **Chapter complete** | ✓ with a recap, your streak and daily goal, a reflection question, and an *Up next* teaser |
| **Book complete** | 🎉 with a book summary and takeaways; the next book's cover follows right after |

On passage cards:
- **Double-tap** to save (heart burst), or use the ❤️ button.
- **📜 Notes** opens Matthew Henry's commentary on those verses in a bottom sheet.
- **↗ Share** opens the native share sheet, or copies to the clipboard.

Engagement hooks:
- Daily streak 🔥 and a daily chapter goal (tap the ring on the home screen to change it).
- Milestone toasts and "N minutes in Scripture" nudges.
- A progress bar per chapter.
- Saved passages, continue reading, and a verse of the day.

A chapter only counts toward your streak if you actually viewed at least half of its passage cards. Flinging past a chapter shows it as *skimmed* instead.

Keyboard: ↓/↑, j/k, Space and PageUp/PageDown move between cards.

## Setup

```bash
npm install
cp .env.example .env          # add BIBLE_API_KEY
npm run find-bible            # prints the NKJV id for your key; put it in BIBLE_ID
npm run dev                   # http://localhost:5173 (API on :8787)
```

Production (serves the built app and the API from one Node process):

```bash
npm run build
npm start                     # PORT defaults to 8787
```

Without `BIBLE_API_KEY` and `BIBLE_ID`, the server falls back to the public-domain World English Bible. Use this for development and design work only. The translation label on every card shows which text you're seeing.

### Install on a phone

The app is a Progressive Web App. Open it in Safari (iOS) or Chrome (Android) and choose **Add to Home Screen**. It then launches full-screen like a native app. The service worker caches only the app shell and the public-domain commentary. NKJV text is always fetched live.

## API.Bible licensing notes

- The API key stays on the server. Browsers call `/api/chapter/:book/:chapter`, and the server calls API.Bible.
- Fetched chapters are cached **in server memory only**, for `BIBLE_CACHE_TTL_MINUTES` (default 60), up to 300 chapters. Nothing is written to disk, and browsers don't store scripture text. Saved passages store references only.
- **FUMS:** each chapter response's `meta.fumsId` is passed to the browser. The browser reports it through API.Bible's FUMS script (`meta.fumsJsInclude`) when that text is shown: passages, key verses, verse of the day.
- The `copyright` string from API.Bible is shown on each chapter intro card, and the translation label appears on every passage.
- **Check before launch:** confirm these settings match your license. In particular, check whether reusing a cached response's `fumsId` for later views is acceptable, or whether the cache should be shortened.

## Commentary

`public/commentary/<book>.json` holds Matthew Henry's Concise Commentary on the Whole Bible, marked "Public Domain — Copy Freely". It was extracted from the CrossWire SWORD module packaged by Debian/Ubuntu as `sword-comm-mhcc`. To regenerate it:

```bash
pip install pysword
python3 scripts/commentary/extract.py /usr/share/sword raw.json    # path containing modules/comments/rawcom/mhcc
python3 scripts/commentary/convert.py raw.json public/commentary genesis,exodus,...,revelation
```

`convert.py`'s third argument is the 66 book ids in canonical order, comma-separated (see `src/data/canon.ts`).

Known gaps: the module has no section notes for 140 of 1,189 chapters (139 have neither notes nor an outline), Psalm 23 and Psalm 150 among them. On those chapters the *Notes* button is dimmed, and the intro card falls back to the NKJV section headings.

## Project layout

```
server/index.ts            Express: /api/chapter + production static hosting
server/scripture.ts        API.Bible (NKJV) or WEB fallback, in-memory cache
server/apibible.ts         API.Bible client + JSON content parser (tested in apibible.test.ts)
src/lib/slides.ts          builds feed cards from chapters + commentary
src/components/Feed.tsx    full-screen snap feed, windowed rendering, infinite loading
src/components/SlideView.tsx  card designs
src/components/NotesSheet.tsx Matthew Henry bottom sheet
src/data/books-*.ts        hand-written previews/summaries for all 66 books
public/commentary/         Matthew Henry's Concise Commentary (public domain)
scripts/build-bible.mjs    WEB development text -> .data/web
scripts/find-bible.mjs     look up your NKJV Bible id
```

`npm test` runs the API.Bible parser tests. `npm run typecheck` runs the type checker.
