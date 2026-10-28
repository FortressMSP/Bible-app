import Anthropic from "@anthropic-ai/sdk";
import { betaJSONSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getChapter, getBookName, chapterText, passageText, passageRef } from "./bible.ts";

const MODEL = process.env.BIBLE_MODEL ?? "claude-opus-5-5";
const CACHE_DIR = process.env.INSIGHT_CACHE_DIR ?? path.resolve(".cache/insights");

const SYSTEM = `You are the study guide inside a Bible reading app. Readers scroll through the World English Bible (WEB) book by book, chapter by chapter, and you give them short, vivid context that makes them want to keep reading.

Guidelines:
- Be accurate and historically informed. Draw on mainstream scholarship and the broad Christian tradition; where traditions or scholars genuinely differ, say so briefly instead of picking a side.
- Write warmly and concretely for an ordinary reader. No jargon without a quick explanation. No sermonizing.
- Only quote scripture from the text you are given; for other passages, cite the reference (e.g. "Isaiah 53:5") rather than quoting.
- Keep within the requested lengths. Short and punchy beats long and thorough.`;

const str = { type: "string" } as const;
const strList = (n: number) => ({ type: "array", items: str, minItems: n, maxItems: n }) as const;

const SCHEMAS = {
  "chapter-preview": {
    type: "object",
    additionalProperties: false,
    required: ["title", "hook", "context", "thinkAbout"],
    properties: {
      title: { type: "string", description: "Evocative 2–6 word title for the chapter" },
      hook: { type: "string", description: "1–2 sentence teaser that creates curiosity without spoiling the ending" },
      context: { type: "string", description: "1–2 sentences: where we are in the story/argument and what just happened" },
      thinkAbout: { ...strList(3), description: "Three short questions to keep in mind while reading" },
    },
  },
  "chapter-summary": {
    type: "object",
    additionalProperties: false,
    required: ["summary", "keyMoments", "reflection", "nextTeaser"],
    properties: {
      summary: { type: "string", description: "3–4 sentence recap of the chapter" },
      keyMoments: { ...strList(3), description: "Three key moments or ideas, each one sentence, with verse refs" },
      reflection: { type: "string", description: "One personal reflection question" },
      nextTeaser: {
        type: "string",
        description: "One suspenseful sentence teasing what comes next (empty string if this is the last chapter of the book)",
      },
    },
  },
  commentary: {
    type: "object",
    additionalProperties: false,
    required: ["heading", "context", "meaning", "connections", "application", "goDeeper"],
    properties: {
      heading: { type: "string", description: "Short heading for the passage" },
      context: { type: "string", description: "Historical, cultural or literary background (2–4 sentences)" },
      meaning: { type: "string", description: "What the passage says and why it matters (3–5 sentences); explain key words" },
      connections: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ref", "note"],
          properties: { ref: str, note: { type: "string", description: "One sentence on how it connects" } },
        },
      },
      application: { type: "string", description: "1–2 sentences on what this could mean for a reader today" },
      goDeeper: { ...strList(3), description: "Three intriguing follow-up questions a curious reader might ask next" },
    },
  },
  ask: {
    type: "object",
    additionalProperties: false,
    required: ["answer", "goDeeper"],
    properties: {
      answer: { type: "string", description: "Clear answer in 1–3 short paragraphs" },
      goDeeper: { ...strList(3), description: "Three further follow-up questions" },
    },
  },
} as const;

export type InsightKind = keyof typeof SCHEMAS;
export const INSIGHT_KINDS = Object.keys(SCHEMAS) as InsightKind[];

export interface InsightRequest {
  kind: InsightKind;
  book: string;
  chapter: number;
  passage?: number;
  question?: string;
}

export class InsightError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    try {
      client = new Anthropic();
    } catch {
      throw new InsightError("AI insights are not configured on this server", 503, "ai_unavailable");
    }
  }
  return client;
}

async function buildPrompt(req: InsightRequest): Promise<{ context: string; task: string }> {
  const name = getBookName(req.book);
  const ch = await getChapter(req.book, req.chapter);
  if (!ch) throw new InsightError("Unknown chapter", 404, "not_found");
  const context = `<chapter book="${name}" chapter="${req.chapter}">\n${chapterText(ch)}\n</chapter>`;

  switch (req.kind) {
    case "chapter-preview":
      return {
        context,
        task: `The reader is about to start ${name} ${req.chapter}. Write a preview that makes them eager to read it.`,
      };
    case "chapter-summary": {
      const next = await getChapter(req.book, req.chapter + 1);
      const nextBit = next
        ? `\n\nFor the teaser only, here is the opening of the next chapter:\n<next_chapter>\n${chapterText(next).slice(0, 1200)}\n</next_chapter>`
        : `\n\nThis is the final chapter of ${name}; set nextTeaser to "".`;
      return {
        context,
        task: `The reader just finished ${name} ${req.chapter}. Summarize it and leave them wanting to read on.${nextBit}`,
      };
    }
    case "commentary":
    case "ask": {
      const p = ch.passages[req.passage ?? -1];
      if (!p) throw new InsightError("Unknown passage", 404, "not_found");
      const ref = passageRef(name, req.chapter, p);
      const focus = `<passage ref="${ref}">\n${passageText(p)}\n</passage>`;
      if (req.kind === "commentary") {
        return { context, task: `${focus}\n\nWrite commentary on ${ref} for a reader who tapped it to learn more.` };
      }
      return {
        context,
        task: `${focus}\n\nThe reader is studying ${ref} and asks:\n<question>\n${req.question}\n</question>\nAnswer in the context of this passage. If the question is unrelated to the Bible, gently steer back to the passage.`,
      };
    }
  }
}

function cacheKey(req: InsightRequest): string {
  const q = req.question?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  return createHash("sha256")
    .update(JSON.stringify([MODEL, req.kind, req.book, req.chapter, req.passage ?? null, q]))
    .digest("hex");
}

async function generate(req: InsightRequest): Promise<unknown> {
  const { context, task } = await buildPrompt(req);
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: req.kind === "commentary" || req.kind === "ask" ? "medium" : "low",
        format: betaJSONSchemaOutputFormat(SCHEMAS[req.kind]),
      },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            // Chapter text first so preview, summary and passage requests for the
            // same chapter can share a cached prefix.
            { type: "text", text: context, cache_control: { type: "ephemeral" } },
            { type: "text", text: task },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof InsightError) throw err;
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new InsightError("AI insights are not configured on this server", 503, "ai_unavailable");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new InsightError("Too many requests, try again shortly", 429, "rate_limited");
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      throw new InsightError("The study guide is unavailable right now", 502, "upstream_error");
    }
    if (err instanceof Error && /api key|apiKey|authentication/i.test(err.message)) {
      throw new InsightError("AI insights are not configured on this server", 503, "ai_unavailable");
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new InsightError("The study guide couldn't answer that one", 422, "refused");
  }
  if (!response.parsed_output) {
    throw new InsightError("The study guide returned an incomplete answer", 502, "bad_output");
  }
  return response.parsed_output;
}

const inflight = new Map<string, Promise<unknown>>();

/** Returns a cached insight or generates (and caches) a new one. */
export async function getInsight(req: InsightRequest): Promise<unknown> {
  if (process.env.INSIGHT_MOCK === "1") return mockInsight(req);
  const key = cacheKey(req);
  const file = path.join(CACHE_DIR, `${key}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    // not cached yet
  }

  let pending = inflight.get(key);
  if (!pending) {
    pending = generate(req)
      .then(async (data) => {
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(file, JSON.stringify(data));
        return data;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

/** Placeholder content for working on the UI without an API key (INSIGHT_MOCK=1). */
async function mockInsight(req: InsightRequest): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 600));
  const where = `${getBookName(req.book)} ${req.chapter}`;
  switch (req.kind) {
    case "chapter-preview":
      return {
        title: `Mock title for ${where}`,
        hook: "A placeholder hook that would tease what happens in this chapter.",
        context: "Placeholder context about where this chapter sits in the story.",
        thinkAbout: ["First question to consider?", "Second question to consider?", "Third question to consider?"],
      };
    case "chapter-summary":
      return {
        summary: `Placeholder recap of ${where}.`,
        keyMoments: ["Key moment one (v1).", "Key moment two (v5).", "Key moment three (v10)."],
        reflection: "A placeholder reflection question?",
        nextTeaser: "A placeholder cliffhanger for the next chapter…",
      };
    case "commentary":
      return {
        heading: `Mock commentary on passage ${req.passage} of ${where}`,
        context: "Placeholder historical background.",
        meaning: "Placeholder explanation of the passage.",
        connections: [{ ref: "John 1:1", note: "Placeholder connection." }],
        application: "Placeholder application.",
        goDeeper: ["Follow-up question A?", "Follow-up question B?", "Follow-up question C?"],
      };
    case "ask":
      return { answer: `Placeholder answer to: ${req.question}`, goDeeper: ["Further question D?", "Further question E?", "Further question F?"] };
  }
}
