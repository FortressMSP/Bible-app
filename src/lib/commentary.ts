// Matthew Henry's Concise Commentary on the Whole Bible (public domain), pre-converted
// into public/commentary/<book>.json by scripts/commentary/.

export interface OutlineItem {
  title: string;
  from: number;
  to: number;
}
export interface Section {
  from: number;
  to: number;
  /** Paragraphs. */
  text: string[];
}
export interface ChapterCommentary {
  outline: OutlineItem[];
  sections: Section[];
}
export interface BookCommentary {
  id: string;
  intro: string[];
  chapters: ChapterCommentary[];
}

const cache = new Map<string, Promise<BookCommentary>>();
const EMPTY: ChapterCommentary = { outline: [], sections: [] };

export function loadCommentary(book: string): Promise<BookCommentary> {
  let p = cache.get(book);
  if (!p) {
    p = fetch(`/commentary/${book}.json`).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load commentary for ${book}`);
      return r.json() as Promise<BookCommentary>;
    });
    p.catch(() => cache.delete(book));
    cache.set(book, p);
  }
  return p;
}

export const chapterCommentary = (book: BookCommentary | undefined, chapter: number) =>
  book?.chapters[chapter - 1] ?? EMPTY;

/** Sections whose verse range overlaps [from, to]. */
export const sectionsFor = (ch: ChapterCommentary, from: number, to: number) =>
  ch.sections.filter((s) => s.from <= to && s.to >= from);

/** A short, quotable sentence from a section, for "insight" slides. */
export function pithyLine(section: Section): string | undefined {
  const sentences = section.text
    .join(" ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 50 && s.length <= 200 && !/[(#:]/.test(s) && /[.!]$/.test(s));
  let best: string | undefined;
  let bestScore = -Infinity;
  for (const s of sentences) {
    const score =
      -Math.abs(s.length - 110) / 20 + (/\b(we|us|our)\b/i.test(s) ? 3 : 0) + (/\b(God|Christ|grace|faith|love)\b/.test(s) ? 1 : 0) + (s.endsWith("!") ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}
