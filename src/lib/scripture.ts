import { reportFums } from "./fums";
import type { ChapterData } from "../data/canon";

const cache = new Map<string, Promise<ChapterData>>();

export function loadChapter(book: string, chapter: number): Promise<ChapterData> {
  const key = `${book}/${chapter}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/chapter/${book}/${chapter}`).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load ${book} ${chapter}`);
      return r.json() as Promise<ChapterData>;
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
    // Keep only recent chapters in memory.
    if (cache.size > 40) cache.delete(cache.keys().next().value!);
  }
  return p;
}

/** Plain text of one verse ("chapter:verse" refs are resolved by the caller). */
export function verseText(ch: ChapterData, verse: number): string | undefined {
  const parts = ch.passages.flatMap((p) => p.verses.filter((v) => v.v === verse).map((v) => v.t));
  return parts.length ? parts.join(" ").replace(/\n/g, " ") : undefined;
}

/** Load the text of a "chapter:verse" reference within a book. */
/** Also reports the FUMS view, since callers display the result. */
export async function loadVerse(book: string, ref: string): Promise<{ text: string; translation: string } | undefined> {
  const [c, v] = ref.split(":").map(Number);
  const ch = await loadChapter(book, c);
  const text = verseText(ch, v);
  if (text) reportFums(ch.fumsId, ch.fumsScript);
  return text ? { text, translation: ch.translation } : undefined;
}
