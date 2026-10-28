import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Passage } from "../data/canon";
import { getBook } from "../data/books";
import { fetchInsight, useInsight, type Answer, InsightError } from "../lib/insights";
import { recordDeepDive } from "../lib/progress";

export interface PassageTarget {
  bookId: string;
  chapter: number;
  passage: number;
  data: Passage;
}

interface Turn {
  question: string;
  state: "loading" | "ready" | "error";
  answer?: Answer;
  error?: string;
}

export function CommentarySheet({ target, onClose }: { target: PassageTarget; onClose: () => void }) {
  const { bookId, chapter, passage, data } = target;
  const book = getBook(bookId)!;
  const first = data.verses[0].v;
  const last = data.verses[data.verses.length - 1].v;
  const ref = `${book.name} ${chapter}:${first}${last !== first ? `–${last}` : ""}`;

  const state = useInsight({ kind: "commentary", book: bookId, chapter, passage });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);
  const asked = useRef(new Set<string>());

  useEffect(() => {
    recordDeepDive();
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [onClose]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || asked.current.has(q)) return;
    asked.current.add(q);
    const index = turns.length;
    setTurns((t) => [...t, { question: q, state: "loading" }]);
    requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" }));
    fetchInsight({ kind: "ask", book: bookId, chapter, passage, question: q }).then(
      (answer) => setTurns((t) => t.map((x, i) => (i === index ? { ...x, state: "ready", answer } : x))),
      (e) =>
        setTurns((t) =>
          t.map((x, i) =>
            i === index ? { ...x, state: "error", error: e instanceof InsightError ? e.message : "Something went wrong" } : x,
          ),
        ),
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
    setDraft("");
  };

  const latestFollowUps =
    [...turns].reverse().find((t) => t.answer)?.answer?.goDeeper ?? (state.status === "ready" ? state.data.goDeeper : []);
  const unavailable = state.status === "error" && state.error.code === "ai_unavailable";

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Commentary on ${ref}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div>
            <p className="card-kicker">Go deeper</p>
            <h3>{state.status === "ready" ? state.data.heading : ref}</h3>
            {state.status === "ready" && <p className="sheet-ref">{ref}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="sheet-body" ref={bodyRef}>
          <blockquote className="sheet-quote">
            {data.verses.map((v) => v.t.replace(/\n/g, " ")).join(" ")}
          </blockquote>

          {state.status === "loading" && (
            <div className="sheet-loading">
              <div className="shimmer w60" />
              <div className="shimmer" />
              <div className="shimmer w80" />
              <div className="shimmer" />
              <p className="muted">Gathering context…</p>
            </div>
          )}

          {state.status === "error" && (
            <p className="muted">
              {unavailable
                ? "Commentary needs the study-guide server to be configured with a Claude API key. See the README for setup."
                : state.error.message}
            </p>
          )}

          {state.status === "ready" && (
            <>
              <Section icon="🏛️" title="Background">
                {state.data.context}
              </Section>
              <Section icon="📖" title="What it means">
                {state.data.meaning}
              </Section>
              <Section icon="🔗" title="Connections">
                <ul className="connections">
                  {state.data.connections.map((c, i) => (
                    <li key={i}>
                      <strong>{c.ref}</strong> — {c.note}
                    </li>
                  ))}
                </ul>
              </Section>
              <Section icon="🌱" title="For today">
                {state.data.application}
              </Section>
            </>
          )}

          {turns.map((t, i) => (
            <div key={i} className="turn">
              <p className="turn-q">{t.question}</p>
              {t.state === "loading" && <div className="shimmer w80" />}
              {t.state === "error" && <p className="muted">{t.error}</p>}
              {t.answer?.answer.split(/\n\n+/).map((para, j) => (
                <p key={j}>{para}</p>
              ))}
            </div>
          ))}

          {latestFollowUps.length > 0 && (
            <div className="followups">
              <p className="card-kicker">Keep exploring</p>
              {latestFollowUps
                .filter((q) => !asked.current.has(q))
                .map((q) => (
                  <button key={q} className="chip" onClick={() => ask(q)}>
                    {q}
                  </button>
                ))}
            </div>
          )}
        </div>

        {!unavailable && (
          <form className="ask-form" onSubmit={submit}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={300}
              placeholder="Ask your own question about this passage…"
              aria-label="Ask a question about this passage"
            />
            <button type="submit" disabled={!draft.trim()}>
              Ask
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="sheet-section">
      <h4>
        <span aria-hidden>{icon}</span> {title}
      </h4>
      <div>{children}</div>
    </section>
  );
}
