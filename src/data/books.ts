import { OT_BOOKS } from "./books-ot";
import { NT_BOOKS } from "./books-nt";
import { CANON } from "./canon";
import type { BookInfo } from "./types";

export const BOOKS: BookInfo[] = [...OT_BOOKS, ...NT_BOOKS];

const byId = new Map(BOOKS.map((b) => [b.id, b]));
const order = new Map(CANON.map((b, i) => [b.id, i]));

/** Chapter counts per book (WEB). */
export const CHAPTER_COUNTS: Record<string, number> = {
  genesis: 50, exodus: 40, leviticus: 27, numbers: 36, deuteronomy: 34, joshua: 24, judges: 21,
  ruth: 4, "1samuel": 31, "2samuel": 24, "1kings": 22, "2kings": 25, "1chronicles": 29,
  "2chronicles": 36, ezra: 10, nehemiah: 13, esther: 10, job: 42, psalms: 150, proverbs: 31,
  ecclesiastes: 12, songofsolomon: 8, isaiah: 66, jeremiah: 52, lamentations: 5, ezekiel: 48,
  daniel: 12, hosea: 14, joel: 3, amos: 9, obadiah: 1, jonah: 4, micah: 7, nahum: 3, habakkuk: 3,
  zephaniah: 3, haggai: 2, zechariah: 14, malachi: 4, matthew: 28, mark: 16, luke: 24, john: 21,
  acts: 28, romans: 16, "1corinthians": 16, "2corinthians": 13, galatians: 6, ephesians: 6,
  philippians: 4, colossians: 4, "1thessalonians": 5, "2thessalonians": 3, "1timothy": 6,
  "2timothy": 4, titus: 3, philemon: 1, hebrews: 13, james: 5, "1peter": 5, "2peter": 3,
  "1john": 5, "2john": 1, "3john": 1, jude: 1, revelation: 22,
};

export const getBook = (id: string) => byId.get(id);

export function nextBook(id: string): BookInfo | undefined {
  const i = order.get(id);
  return i === undefined ? undefined : byId.get(CANON[(i + 1) % CANON.length].id);
}
