// Serves chapters from API.Bible (NKJV) when configured, otherwise from the bundled
// World English Bible so the app can be developed without a key.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CANON, USFM, type ChapterData, type Passage } from "../src/data/canon.ts";
import { fetchChapter } from "./apibible.ts";

const API_KEY = process.env.BIBLE_API_KEY;
const BIBLE_ID = process.env.BIBLE_ID;
const TRANSLATION = process.env.BIBLE_TRANSLATION ?? "NKJV";
// Keep fetched text only briefly, in memory: API.Bible's terms limit storing licensed text.
const CACHE_TTL_MS = Number(process.env.BIBLE_CACHE_TTL_MINUTES ?? 60) * 60_000;
const CACHE_MAX = 300;

const index = new Map(CANON.map((b, i) => [b.id, i]));
export const isBook = (id: string) => index.has(id);

export const usingApiBible = Boolean(API_KEY && BIBLE_ID);
if (API_KEY && !BIBLE_ID) {
  console.warn("BIBLE_API_KEY is set but BIBLE_ID is not; run `npm run find-bible` to look up the NKJV id.");
}
console.log(usingApiBible ? `Scripture: API.Bible ${TRANSLATION} (${BIBLE_ID})` : "Scripture: World English Bible (dev fallback)");

const cache = new Map<string, { at: number; data: Promise<ChapterData> }>();

export async function getChapter(book: string, chapter: number): Promise<ChapterData | undefined> {
  const i = index.get(book);
  if (i === undefined) return undefined;
  const key = `${book}.${chapter}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const data = usingApiBible
    ? fetchChapter({ apiKey: API_KEY!, bibleId: BIBLE_ID!, usfm: USFM[i], book, chapter, translation: TRANSLATION })
    : fromWeb(book, chapter);
  cache.delete(key);
  cache.set(key, { at: Date.now(), data });
  data.catch(() => cache.delete(key));
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  return data;
}

interface WebBook {
  chapters: { n: number; title?: string; passages: Passage[] }[];
}
const webBooks = new Map<string, Promise<WebBook>>();

async function fromWeb(book: string, chapter: number): Promise<ChapterData> {
  let b = webBooks.get(book);
  if (!b) {
    b = readFile(path.resolve(".data/web", `${book}.json`), "utf8").then((s) => JSON.parse(s) as WebBook);
    webBooks.set(book, b);
  }
  const ch = (await b).chapters[chapter - 1];
  if (!ch) throw new NotFound();
  return {
    book,
    chapter,
    translation: "WEB",
    copyright: "World English Bible — public domain. Development text; configure API.Bible for the NKJV.",
    passages: ch.passages,
    ...(ch.title ? { title: ch.title } : {}),
  };
}

export class NotFound extends Error {}
