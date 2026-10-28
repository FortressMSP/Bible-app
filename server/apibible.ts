// API.Bible client: fetches a chapter as JSON content and flattens it into passages.
// Docs: https://docs.api.bible — requests need an `api-key` header; each response carries
// a FUMS token in `meta.fumsId` that the client must report when the text is displayed.
import type { ChapterData, Passage } from "../src/data/canon.ts";

export const API_BASE = process.env.BIBLE_API_BASE ?? "https://rest.api.bible/v1";

/** A node of API.Bible's `content-type=json` chapter content. */
export interface ContentNode {
  type: "tag" | "text";
  name?: string;
  text?: string;
  attrs?: Record<string, unknown> & { style?: string; verseId?: string; number?: string };
  items?: ContentNode[];
}

interface ChapterResponse {
  data: { id: string; number: string; copyright?: string; content: ContentNode[] };
  meta?: { fumsId?: string; fumsToken?: string; fumsJsInclude?: string };
}

export class ApiBibleError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiBibleGet<T>(pathAndQuery: string, apiKey: string): Promise<T> {
  const res = await fetch(`${API_BASE}${pathAndQuery}`, { headers: { "api-key": apiKey, accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiBibleError(`API.Bible ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  return (await res.json()) as T;
}

export async function fetchChapter(opts: {
  apiKey: string;
  bibleId: string;
  usfm: string;
  book: string;
  chapter: number;
  translation: string;
}): Promise<ChapterData> {
  const query = new URLSearchParams({
    "content-type": "json",
    "include-notes": "false",
    "include-titles": "true",
    "include-chapter-numbers": "false",
    "include-verse-numbers": "true",
    "include-verse-spans": "false",
  });
  const res = await apiBibleGet<ChapterResponse>(
    `/bibles/${encodeURIComponent(opts.bibleId)}/chapters/${opts.usfm}.${opts.chapter}?${query}`,
    opts.apiKey,
  );
  return {
    book: opts.book,
    chapter: opts.chapter,
    translation: opts.translation,
    copyright: res.data.copyright?.trim() ?? "",
    fumsId: res.meta?.fumsId ?? res.meta?.fumsToken,
    fumsScript: res.meta?.fumsJsInclude,
    ...parseContent(res.data.content),
  };
}

// USFM paragraph styles.
const POETRY = /^(q\d?|qr|qc|qm\d?|qa)$/;
const HEADING = /^(s\d?|ms\d?|mr|sp|qa)$/;
const SKIP = /^(r|sr|mt\d?|cl|cd|toc\d?|h|ide|rem)$/;
const BLANK = /^(b|nb)$/;
// Character styles whose text should never be read as scripture.
const SKIP_CHAR = /^(f|fr|fq|fqa|fk|ft|fl|fv|x|xo|xt|xk|xq|v|ca|va|vp)$/;

/** Turn API.Bible JSON content into passages (paragraph or stanza each) with verse text. */
export function parseContent(content: ContentNode[]): Pick<ChapterData, "passages" | "title"> {
  const passages: Passage[] = [];
  let title: string | undefined;
  let pendingHeading: string | undefined;
  let current: Passage | null = null;
  let lastVerse = 0;
  let lastWasPoetry = false;

  const textOf = (node: ContentNode): string =>
    node.type === "text" ? (node.text ?? "") : (node.items ?? []).map(textOf).join("");

  const verseNumber = (node: ContentNode): number | undefined => {
    const id = node.attrs?.verseId;
    if (typeof id === "string") {
      const n = Number(id.split(".").pop());
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };

  /** Collect [verse, text] runs from a paragraph, in order. */
  const collect = (node: ContentNode, out: [number, string][]) => {
    if (node.type === "text") {
      const v = verseNumber(node) ?? lastVerse;
      if (v && node.text) out.push([v, node.text]);
      return;
    }
    const style = node.attrs?.style ?? "";
    if (node.name === "verse") {
      const n = Number(node.attrs?.number);
      if (Number.isFinite(n) && n > 0) lastVerse = n;
      return; // the verse marker's own text is just the number
    }
    if (node.name === "note" || SKIP_CHAR.test(style)) return;
    for (const child of node.items ?? []) collect(child, out);
  };

  for (const para of content) {
    if (para.type !== "tag") continue;
    const style = para.attrs?.style ?? "p";
    if (SKIP.test(style)) continue;
    if (style === "d") {
      title = clean(textOf(para));
      continue;
    }
    if (HEADING.test(style)) {
      const h = clean(textOf(para));
      if (h) pendingHeading = h;
      current = null;
      continue;
    }
    if (BLANK.test(style)) {
      current = null;
      continue;
    }

    const runs: [number, string][] = [];
    collect(para, runs);
    if (!runs.length) continue;

    const poetry = POETRY.test(style);
    // Consecutive poetry lines form one stanza; prose paragraphs are passages on their own.
    if (!current || !poetry || !lastWasPoetry || pendingHeading) {
      current = { poetry, verses: [] };
      if (pendingHeading) current.heading = pendingHeading;
      pendingHeading = undefined;
      passages.push(current);
    }
    lastWasPoetry = poetry;

    let lineStarted = false;
    for (const [v, raw] of runs) {
      const text = raw.replace(/\s+/g, " ");
      if (!text.trim()) continue;
      const last = current.verses[current.verses.length - 1];
      if (last && last.v === v) {
        last.t += poetry && !lineStarted ? `\n${text.trim()}` : text;
      } else {
        const prevPassage = passages[passages.length - 2];
        const continued =
          current.verses.length === 0 && prevPassage?.verses[prevPassage.verses.length - 1]?.v === v;
        current.verses.push({ v, t: text.trimStart(), ...(continued ? { cont: true } : {}) });
      }
      lineStarted = true;
    }
  }

  for (const p of passages) for (const v of p.verses) v.t = v.t.replace(/ +\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return { passages: passages.filter((p) => p.verses.length), ...(title ? { title } : {}) };
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
