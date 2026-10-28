// Turns books and chapters into the full-screen cards of the swipe feed.
import type { ChapterData, Passage } from "../data/canon";
import { CHAPTER_COUNTS } from "../data/books";
import { pithyLine, sectionsFor, type ChapterCommentary, type Section } from "./commentary";

export type Slide =
  | { kind: "book-cover"; key: string; book: string }
  | { kind: "book-preview"; key: string; book: string }
  | { kind: "book-watch"; key: string; book: string }
  | { kind: "chapter-intro"; key: string; book: string; chapter: number; data: ChapterData; notes: ChapterCommentary; minutes: number }
  | {
      kind: "passage";
      key: string;
      book: string;
      chapter: number;
      data: ChapterData;
      passage: Passage;
      /** 1-based position among this chapter's passage cards. */
      index: number;
      of: number;
      notes: ChapterCommentary;
    }
  | { kind: "insight"; key: string; book: string; chapter: number; section: Section; line: string }
  | { kind: "chapter-end"; key: string; book: string; chapter: number; data: ChapterData; notes: ChapterCommentary; next?: ChapterCommentary }
  | { kind: "book-end"; key: string; book: string };

/** Max words on one passage card before it is split at a verse boundary. */
const WORDS_PER_CARD = 70;

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

export const passageRange = (p: Passage) => ({ from: p.verses[0].v, to: p.verses[p.verses.length - 1].v });

/** Split long paragraphs/stanzas into card-sized pieces, keeping whole verses together. */
export function cardPassages(passages: Passage[]): Passage[] {
  const out: Passage[] = [];
  for (const p of passages) {
    let chunk: Passage = { ...p, verses: [] };
    let count = 0;
    for (const v of p.verses) {
      const n = words(v.t);
      if (chunk.verses.length && count + n > WORDS_PER_CARD) {
        out.push(chunk);
        chunk = { poetry: p.poetry, verses: [] };
        count = 0;
      }
      chunk.verses.push(v);
      count += n;
    }
    if (chunk.verses.length) out.push(chunk);
  }
  // Merge tiny cards (a lone short verse) into the previous one when it still fits.
  const merged: Passage[] = [];
  for (const p of out) {
    const prev = merged[merged.length - 1];
    const size = (x: Passage) => x.verses.reduce((n, v) => n + words(v.t), 0);
    if (prev && !p.heading && prev.poetry === p.poetry && size(p) < 12 && size(prev) + size(p) <= WORDS_PER_CARD) {
      prev.verses.push(...p.verses.map((v) => ({ ...v, cont: v.cont && prev.verses[prev.verses.length - 1]?.v === v.v })));
    } else {
      merged.push({ ...p, verses: [...p.verses] });
    }
  }
  return merged;
}

export function bookIntroSlides(book: string): Slide[] {
  return [
    { kind: "book-cover", key: `${book}:cover`, book },
    { kind: "book-preview", key: `${book}:preview`, book },
    { kind: "book-watch", key: `${book}:watch`, book },
  ];
}

export function chapterSlides(book: string, data: ChapterData, notes: ChapterCommentary, next?: ChapterCommentary): Slide[] {
  const chapter = data.chapter;
  const cards = cardPassages(data.passages);
  const totalWords = data.passages.reduce((n, p) => n + p.verses.reduce((m, v) => m + words(v.t), 0), 0);
  const slides: Slide[] = [
    { kind: "chapter-intro", key: `${book}:${chapter}:intro`, book, chapter, data, notes, minutes: Math.max(1, Math.round(totalWords / 200)) },
  ];

  // An insight card follows the passage that finishes each commentary section,
  // spaced out so they never come back-to-back.
  const pending = [...notes.sections];
  let sinceInsight = 0;
  cards.forEach((passage, i) => {
    slides.push({ kind: "passage", key: `${book}:${chapter}:p${i}`, book, chapter, data, passage, index: i + 1, of: cards.length, notes });
    sinceInsight++;
    const { to } = passageRange(passage);
    while (pending.length && pending[0].to <= to) {
      const section = pending.shift()!;
      const line = pithyLine(section);
      if (line && sinceInsight >= 2 && i < cards.length - 1) {
        slides.push({ kind: "insight", key: `${book}:${chapter}:i${section.from}`, book, chapter, section, line });
        sinceInsight = 0;
      }
    }
  });

  slides.push({ kind: "chapter-end", key: `${book}:${chapter}:end`, book, chapter, data, notes, next });
  if (chapter === CHAPTER_COUNTS[book]) slides.push({ kind: "book-end", key: `${book}:end`, book });
  return slides;
}

/** Commentary sections for a passage card. */
export const notesForPassage = (notes: ChapterCommentary, passage: Passage) => {
  const { from, to } = passageRange(passage);
  return sectionsFor(notes, from, to);
};

const REFLECTIONS = [
  "What does this chapter show you about who God is?",
  "Which verse would you want to remember this week?",
  "Where do you see yourself in this chapter?",
  "What surprised you most here?",
  "Is there a promise here to hold on to — or a warning to take seriously?",
  "How would you explain this chapter to a friend in one sentence?",
  "What question would you ask if you could talk to someone in this chapter?",
  "What is one thing you could do differently today because of this?",
  "What does this chapter reveal about human nature?",
  "Where do you see grace in this chapter?",
  "What would change if you really believed what you just read?",
  "Which word or phrase keeps coming back to you?",
];

export function reflectionFor(book: string, chapter: number): string {
  let h = chapter * 31;
  for (const c of book) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return REFLECTIONS[h % REFLECTIONS.length];
}
