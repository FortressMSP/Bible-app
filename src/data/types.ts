export type Testament = "OT" | "NT";

/** Hand-written, static content shown before and after each book. */
export interface BookInfo {
  /** Matches the generated data file name, e.g. "1samuel", "songofsolomon". */
  id: string;
  name: string;
  testament: Testament;
  genre: string;
  author: string;
  /** Approximate date of writing, e.g. "c. 1440–1400 BC". */
  written: string;
  /** One punchy line that makes someone want to open the book. */
  tagline: string;
  /** 2–4 sentence preview shown before entering the book. */
  preview: string;
  themes: string[];
  /** Three things to look for / think about while reading. */
  watchFor: string[];
  /** Key verse reference within this book, "chapter:verse" (e.g. "1:1"). */
  keyVerse: string;
  /** End-of-book summary, one or two paragraphs. */
  summary: string;
  /** Three short takeaways shown after finishing the book. */
  takeaways: string[];
  /** One-sentence teaser that hands off to the next book in canonical order. */
  bridge: string;
}
