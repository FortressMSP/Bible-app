import { memo, useState } from "react";
import type { Chapter, Passage } from "../data/canon";
import { getBook } from "../data/books";
import { useInsight } from "../lib/insights";
import { useInView } from "./useInView";
import type { PassageTarget } from "./CommentarySheet";

const wordsIn = (ch: Chapter) =>
  ch.passages.reduce((n, p) => n + p.verses.reduce((m, v) => m + v.t.split(/\s+/).length, 0), 0);

const firstLine = (ch?: Chapter) => {
  const v = ch?.passages[0]?.verses[0];
  if (!v) return "";
  const t = v.t.replace(/\n/g, " ");
  return t.length > 140 ? `${t.slice(0, 140).replace(/\s+\S*$/, "")}…` : t;
};

interface Props {
  bookId: string;
  chapter: Chapter;
  nextChapter?: Chapter;
  total: number;
  done: boolean;
  onOpenPassage: (t: PassageTarget) => void;
}

export const ChapterBlock = memo(function ChapterBlock({ bookId, chapter, nextChapter, total, done, onOpenPassage }: Props) {
  const n = chapter.n;
  const minutes = Math.max(1, Math.round(wordsIn(chapter) / 230));

  // Start fetching the summary a little before the reader gets there.
  const [nearEndRef, nearEnd] = useInView<HTMLDivElement>("900px", true);

  return (
    <article className="chapter" data-chapter={n}>
      <ChapterPreviewCard bookId={bookId} chapter={chapter} total={total} minutes={minutes} />

      <h2 className="chapter-heading">
        <span>Chapter</span> {n}
      </h2>
      {chapter.title && <p className="psalm-title">{chapter.title}</p>}

      <div className="scripture">
        {chapter.passages.map((p, i) => (
          <PassageView key={i} passage={p} onOpen={() => onOpenPassage({ bookId, chapter: n, passage: i, data: p })} />
        ))}
      </div>

      <div ref={nearEndRef} />
      {/* The reader marks the chapter complete when this scrolls into view. */}
      <div className="chapter-end-marker" data-chapter-end={n} />
      <ChapterSummaryCard
        bookId={bookId}
        chapter={n}
        total={total}
        load={nearEnd}
        done={done}
        nextOpening={firstLine(nextChapter)}
      />
    </article>
  );
});

function PassageView({ passage, onOpen }: { passage: Passage; onOpen: () => void }) {
  const first = passage.verses[0].v;
  const last = passage.verses[passage.verses.length - 1].v;
  return (
    <section className={`passage${passage.poetry ? " poetry" : ""}`}>
      <p>
        {passage.verses.map((v, i) => (
          <span key={i} className="verse">
            {!v.cont && <sup>{v.v}</sup>}
            {passage.poetry
              ? v.t.split("\n").map((line, j) => (
                  <span key={j} className="line">
                    {line}
                  </span>
                ))
              : `${v.t} `}
          </span>
        ))}
      </p>
      <button className="deeper-btn" onClick={onOpen} aria-label={`Commentary on verses ${first} to ${last}`}>
        <span aria-hidden>✦</span> Go deeper
        <span className="deeper-ref">
          v{first}
          {last !== first ? `–${last}` : ""}
        </span>
      </button>
    </section>
  );
}

function ChapterPreviewCard({ bookId, chapter, total, minutes }: { bookId: string; chapter: Chapter; total: number; minutes: number }) {
  const state = useInsight({ kind: "chapter-preview", book: bookId, chapter: chapter.n });
  const book = getBook(bookId)!;
  const [open, setOpen] = useState(true);

  const meta = (
    <div className="card-meta">
      <span>
        {book.name} {chapter.n}/{total}
      </span>
      <span>· {minutes} min read</span>
    </div>
  );

  if (state.status === "loading") {
    return (
      <div className="card preview-card">
        {meta}
        <div className="shimmer w60" />
        <div className="shimmer" />
        <div className="shimmer w80" />
      </div>
    );
  }

  if (state.status === "error") {
    // Offline / not configured: fall back to the book's own prompts.
    const prompt = book.watchFor[(chapter.n - 1) % book.watchFor.length];
    return (
      <div className="card preview-card">
        {meta}
        <p className="card-kicker">As you read</p>
        <p className="preview-hook">{prompt}</p>
      </div>
    );
  }

  const p = state.data;
  return (
    <div className="card preview-card">
      {meta}
      <h3 className="preview-title">{p.title}</h3>
      <p className="preview-hook">{p.hook}</p>
      {open && (
        <>
          <p className="preview-context">{p.context}</p>
          <p className="card-kicker">Think about</p>
          <ul className="think-list">
            {p.thinkAbout.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </>
      )}
      <button className="link-btn" onClick={() => setOpen(!open)}>
        {open ? "Hide preview" : "Show more"}
      </button>
    </div>
  );
}

function ChapterSummaryCard({
  bookId,
  chapter,
  total,
  load,
  done,
  nextOpening,
}: {
  bookId: string;
  chapter: number;
  total: number;
  load: boolean;
  done: boolean;
  nextOpening: string;
}) {
  const state = useInsight(load ? { kind: "chapter-summary", book: bookId, chapter } : null);
  const isLast = chapter === total;

  return (
    <div className={`card summary-card${done ? " is-done" : ""}`}>
      <div className="summary-badge">
        <span className="check">{done ? "✓" : "•"}</span> Chapter {chapter} {done ? "complete" : ""}
      </div>

      {state.status === "loading" && (
        <>
          <div className="shimmer" />
          <div className="shimmer w80" />
          <div className="shimmer w60" />
        </>
      )}

      {state.status === "ready" && (
        <>
          <p className="card-kicker">Recap</p>
          <p>{state.data.summary}</p>
          <ul className="moments">
            {state.data.keyMoments.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <div className="reflection">
            <span aria-hidden>💭</span>
            <p>{state.data.reflection}</p>
          </div>
        </>
      )}

      {state.status === "error" && (
        <div className="reflection">
          <span aria-hidden>💭</span>
          <p>What stood out to you most in this chapter — and why do you think it was included?</p>
        </div>
      )}

      {!isLast && (
        <div className="up-next">
          <p className="card-kicker">Up next · Chapter {chapter + 1}</p>
          <p className="up-next-teaser">
            {state.status === "ready" && state.data.nextTeaser ? state.data.nextTeaser : `“${nextOpening}”`}
          </p>
          <span className="scroll-cue" aria-hidden>
            ↓ keep scrolling
          </span>
        </div>
      )}
    </div>
  );
}
