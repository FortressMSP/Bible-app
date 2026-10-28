// Converts the World English Bible (public domain) from the `world-english-bible`
// npm package into compact per-book JSON files the app loads on demand.
//
// Output: public/bible/<bookId>.json
//   { id, chapters: [{ n, title?, passages: [{ poetry, verses: [{ v, t, cont? }] }] }] }
//
// A "passage" is one paragraph (prose) or stanza (poetry) as laid out in the WEB.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const srcDir = path.join(path.dirname(require.resolve("world-english-bible/package.json")), "json");
const outDir = path.join(here, "..", "public", "bible");

const BOOK_IDS = [
  "genesis", "exodus", "leviticus", "numbers", "deuteronomy", "joshua", "judges", "ruth",
  "1samuel", "2samuel", "1kings", "2kings", "1chronicles", "2chronicles", "ezra", "nehemiah",
  "esther", "job", "psalms", "proverbs", "ecclesiastes", "songofsolomon", "isaiah", "jeremiah",
  "lamentations", "ezekiel", "daniel", "hosea", "joel", "amos", "obadiah", "jonah", "micah",
  "nahum", "habakkuk", "zephaniah", "haggai", "zechariah", "malachi",
  "matthew", "mark", "luke", "john", "acts", "romans", "1corinthians", "2corinthians",
  "galatians", "ephesians", "philippians", "colossians", "1thessalonians", "2thessalonians",
  "1timothy", "2timothy", "titus", "philemon", "hebrews", "james", "1peter", "2peter",
  "1john", "2john", "3john", "jude", "revelation",
];

const clean = (s) => s.replace(/\s+/g, " ").trim();

function convertBook(id) {
  const items = JSON.parse(readFileSync(path.join(srcDir, `${id}.json`), "utf8"));
  const chapters = [];
  let chapter = null;
  let passage = null;
  let pendingTitle = null;
  let lastVerseKey = null;

  const getChapter = (n) => {
    if (!chapter || chapter.n !== n) {
      chapter = { n, passages: [] };
      if (pendingTitle) {
        chapter.title = pendingTitle;
        pendingTitle = null;
      }
      chapters.push(chapter);
      passage = null;
    }
    return chapter;
  };

  for (const item of items) {
    switch (item.type) {
      case "header":
        pendingTitle = clean(item.value);
        break;
      case "paragraph start":
      case "stanza start":
        passage = { poetry: item.type === "stanza start", verses: [], open: true };
        break;
      case "paragraph end":
      case "stanza end":
        if (passage) passage.open = false;
        break;
      case "paragraph text":
      case "line text": {
        const ch = getChapter(item.chapterNumber);
        const poetry = item.type === "line text";
        // Text can arrive outside an explicit start marker (or a paragraph can span
        // a chapter break); open a fresh passage when needed.
        if (!passage || !passage.open) passage = { poetry, verses: [], open: true };
        if (!ch.passages.includes(passage)) ch.passages.push(passage);

        const text = clean(item.value);
        if (!text) break;
        const key = `${item.chapterNumber}:${item.verseNumber}`;
        const last = passage.verses[passage.verses.length - 1];
        if (last && last.v === item.verseNumber) {
          last.t += (poetry ? "\n" : " ") + text;
        } else {
          const verse = { v: item.verseNumber, t: text };
          // Verse that began in a previous passage: render without a number.
          if (key === lastVerseKey) verse.cont = true;
          passage.verses.push(verse);
        }
        lastVerseKey = key;
        break;
      }
      default:
        break;
    }
  }

  for (const ch of chapters) {
    ch.passages = ch.passages
      .filter((p) => p.verses.length)
      .map(({ poetry, verses }) => ({ poetry, verses }));
  }
  return { id, chapters };
}

const marker = path.join(outDir, "revelation.json");
const pkgFile = path.join(srcDir, "revelation.json");
if (existsSync(marker) && statSync(marker).mtimeMs > statSync(fileURLToPath(import.meta.url)).mtimeMs
    && statSync(marker).mtimeMs > statSync(pkgFile).mtimeMs) {
  console.log("bible data up to date");
} else {
  mkdirSync(outDir, { recursive: true });
  let verses = 0;
  let chapterCount = 0;
  for (const id of BOOK_IDS) {
    const book = convertBook(id);
    chapterCount += book.chapters.length;
    for (const c of book.chapters) {
      verses += new Set(c.passages.flatMap((p) => p.verses.map((v) => v.v))).size;
    }
    writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(book));
  }
  console.log(`wrote ${BOOK_IDS.length} books, ${chapterCount} chapters, ${verses} verses to public/bible/`);
}
