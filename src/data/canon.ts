import type { Testament } from "./types";

/** The 66 books in canonical order; ids match the generated public/bible/<id>.json files. */
export const CANON: { id: string; name: string; testament: Testament }[] = [
  ["genesis", "Genesis"], ["exodus", "Exodus"], ["leviticus", "Leviticus"], ["numbers", "Numbers"],
  ["deuteronomy", "Deuteronomy"], ["joshua", "Joshua"], ["judges", "Judges"], ["ruth", "Ruth"],
  ["1samuel", "1 Samuel"], ["2samuel", "2 Samuel"], ["1kings", "1 Kings"], ["2kings", "2 Kings"],
  ["1chronicles", "1 Chronicles"], ["2chronicles", "2 Chronicles"], ["ezra", "Ezra"],
  ["nehemiah", "Nehemiah"], ["esther", "Esther"], ["job", "Job"], ["psalms", "Psalms"],
  ["proverbs", "Proverbs"], ["ecclesiastes", "Ecclesiastes"], ["songofsolomon", "Song of Solomon"],
  ["isaiah", "Isaiah"], ["jeremiah", "Jeremiah"], ["lamentations", "Lamentations"],
  ["ezekiel", "Ezekiel"], ["daniel", "Daniel"], ["hosea", "Hosea"], ["joel", "Joel"], ["amos", "Amos"],
  ["obadiah", "Obadiah"], ["jonah", "Jonah"], ["micah", "Micah"], ["nahum", "Nahum"],
  ["habakkuk", "Habakkuk"], ["zephaniah", "Zephaniah"], ["haggai", "Haggai"],
  ["zechariah", "Zechariah"], ["malachi", "Malachi"],
  ["matthew", "Matthew"], ["mark", "Mark"], ["luke", "Luke"], ["john", "John"], ["acts", "Acts"],
  ["romans", "Romans"], ["1corinthians", "1 Corinthians"], ["2corinthians", "2 Corinthians"],
  ["galatians", "Galatians"], ["ephesians", "Ephesians"], ["philippians", "Philippians"],
  ["colossians", "Colossians"], ["1thessalonians", "1 Thessalonians"],
  ["2thessalonians", "2 Thessalonians"], ["1timothy", "1 Timothy"], ["2timothy", "2 Timothy"],
  ["titus", "Titus"], ["philemon", "Philemon"], ["hebrews", "Hebrews"], ["james", "James"],
  ["1peter", "1 Peter"], ["2peter", "2 Peter"], ["1john", "1 John"], ["2john", "2 John"],
  ["3john", "3 John"], ["jude", "Jude"], ["revelation", "Revelation"],
].map(([id, name], i) => ({ id, name, testament: i < 39 ? "OT" : "NT" }));

export interface Verse {
  v: number;
  t: string;
  /** Continuation of a verse that began in the previous passage. */
  cont?: boolean;
}
export interface Passage {
  poetry: boolean;
  verses: Verse[];
}
export interface Chapter {
  n: number;
  title?: string;
  passages: Passage[];
}
export interface BookText {
  id: string;
  chapters: Chapter[];
}
