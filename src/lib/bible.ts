import type { BookText } from "../data/canon";

const cache = new Map<string, Promise<BookText>>();

export function loadBook(id: string): Promise<BookText> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/bible/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load ${id}`);
      return r.json() as Promise<BookText>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** Look up a single verse ("chapter:verse") as plain text. */
export function verseText(book: BookText, ref: string): string | undefined {
  const [c, v] = ref.split(":").map(Number);
  const parts = book.chapters[c - 1]?.passages.flatMap((p) => p.verses.filter((x) => x.v === v).map((x) => x.t));
  return parts?.length ? parts.join(" ").replace(/\n/g, " ") : undefined;
}
