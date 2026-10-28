import { useEffect, useState } from "react";

export interface ChapterPreview {
  title: string;
  hook: string;
  context: string;
  thinkAbout: string[];
}
export interface ChapterSummary {
  summary: string;
  keyMoments: string[];
  reflection: string;
  nextTeaser: string;
}
export interface Commentary {
  heading: string;
  context: string;
  meaning: string;
  connections: { ref: string; note: string }[];
  application: string;
  goDeeper: string[];
}
export interface Answer {
  answer: string;
  goDeeper: string[];
}

type Req =
  | { kind: "chapter-preview" | "chapter-summary"; book: string; chapter: number }
  | { kind: "commentary"; book: string; chapter: number; passage: number }
  | { kind: "ask"; book: string; chapter: number; passage: number; question: string };

type ResultFor<R extends Req> = R["kind"] extends "chapter-preview"
  ? ChapterPreview
  : R["kind"] extends "chapter-summary"
    ? ChapterSummary
    : R["kind"] extends "commentary"
      ? Commentary
      : Answer;

export class InsightError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const cache = new Map<string, Promise<unknown>>();

export function fetchInsight<R extends Req>(req: R): Promise<ResultFor<R>> {
  const key = JSON.stringify(req);
  let p = cache.get(key);
  if (!p) {
    p = fetch("/api/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    }).then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new InsightError(body.error ?? "The study guide is unavailable", body.code ?? "network");
      return body;
    });
    // Let failures be retried later (but keep "not configured" sticky for the session).
    p.catch((e) => {
      if (!(e instanceof InsightError && e.code === "ai_unavailable")) cache.delete(key);
    });
    cache.set(key, p);
  }
  return p as Promise<ResultFor<R>>;
}

export type InsightState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: InsightError };

/** Fetches an insight when `req` is non-null. Pass null to defer (e.g. until visible). */
export function useInsight<R extends Req>(req: R | null): InsightState<ResultFor<R>> {
  const key = req ? JSON.stringify(req) : null;
  const [state, setState] = useState<{ key: string | null; value: InsightState<ResultFor<R>> }>({
    key: null,
    value: { status: "loading" },
  });

  useEffect(() => {
    if (!req || !key) return;
    let live = true;
    fetchInsight(req).then(
      (data) => live && setState({ key, value: { status: "ready", data } }),
      (e) =>
        live &&
        setState({
          key,
          value: { status: "error", error: e instanceof InsightError ? e : new InsightError(String(e), "network") },
        }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? state.value : { status: "loading" };
}
