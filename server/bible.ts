import { readFile } from "node:fs/promises";
import path from "node:path";
import { CANON, type BookText, type Chapter, type Passage } from "../src/data/canon.ts";

const DATA_DIR = path.resolve("public/bible");
const names = new Map(CANON.map((b) => [b.id, b.name]));
const books = new Map<string, Promise<BookText>>();

export const isBook = (id: string) => names.has(id);
export const getBookName = (id: string) => names.get(id) ?? id;

export async function getChapter(book: string, chapter: number): Promise<Chapter | undefined> {
  if (!isBook(book)) return undefined;
  let text = books.get(book);
  if (!text) {
    text = readFile(path.join(DATA_DIR, `${book}.json`), "utf8").then((s) => JSON.parse(s) as BookText);
    books.set(book, text);
  }
  return (await text).chapters[chapter - 1];
}

export const passageText = (p: Passage) =>
  p.verses.map((v) => (v.cont ? v.t : `[${v.v}] ${v.t}`)).join(p.poetry ? "\n" : " ");

export const chapterText = (ch: Chapter) =>
  (ch.title ? `(${ch.title})\n` : "") + ch.passages.map(passageText).join("\n\n");

export function passageRef(bookName: string, chapter: number, p: Passage): string {
  const first = p.verses[0].v;
  const last = p.verses[p.verses.length - 1].v;
  return `${bookName} ${chapter}:${first}${last !== first ? `–${last}` : ""}`;
}
