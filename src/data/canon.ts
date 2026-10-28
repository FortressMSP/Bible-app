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

/** USFM book codes used by API.Bible, in canonical order. */
export const USFM = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH",
  "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS",
  "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
  "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH",
  "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
];

export interface Verse {
  v: number;
  t: string;
  /** Continuation of a verse that began in the previous passage. */
  cont?: boolean;
}
export interface Passage {
  /** Section heading printed above this passage (e.g. NKJV "The Fall of Man"). */
  heading?: string;
  poetry: boolean;
  verses: Verse[];
}

/** One chapter as served by /api/chapter/:book/:chapter. */
export interface ChapterData {
  book: string;
  chapter: number;
  /** Translation abbreviation shown with the text, e.g. "NKJV". */
  translation: string;
  copyright: string;
  /** Superscription such as a psalm title. */
  title?: string;
  passages: Passage[];
  /** API.Bible Fair Use Management System token to report when the text is shown. */
  fumsId?: string;
  /** FUMS script location from API.Bible (`meta.fumsJsInclude`), usually without a scheme. */
  fumsScript?: string;
}
