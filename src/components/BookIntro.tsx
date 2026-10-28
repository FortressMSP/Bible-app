import { useEffect, useState } from "react";
import { CHAPTER_COUNTS, getBook } from "../data/books";
import { loadVerse } from "../lib/scripture";
import { useProgress } from "../lib/progress";
import { href } from "../lib/router";

export function BookIntro({ bookId }: { bookId: string }) {
  const book = getBook(bookId)!;
  const count = CHAPTER_COUNTS[bookId];
  const progress = useProgress();
  const done = new Set(progress.completed[bookId] ?? []);
  const [keyVerse, setKeyVerse] = useState<{ text: string; translation: string }>();

  useEffect(() => {
    window.scrollTo({ top: 0 });
    let live = true;
    loadVerse(bookId, book.keyVerse).then((v) => live && setKeyVerse(v), () => {});
    return () => {
      live = false;
    };
  }, [bookId, book.keyVerse]);

  const resume =
    progress.last?.book === bookId ? progress.last.chapter : Array.from({ length: count }, (_, i) => i + 1).find((n) => !done.has(n));
  const started = done.size > 0;

  return (
    <div className="intro">
      <header className="intro-bar">
        <a className="icon-btn" href={href.home()} aria-label="Back to library">
          ←
        </a>
        <span className="muted">{book.testament === "OT" ? "Old Testament" : "New Testament"} · {book.genre}</span>
      </header>

      <section className="intro-hero">
        <h1>{book.name}</h1>
        <p className="intro-tagline">{book.tagline}</p>
        <dl className="intro-meta">
          <div>
            <dt>Written by</dt>
            <dd>{book.author}</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>{book.written}</dd>
          </div>
          <div>
            <dt>Length</dt>
            <dd>
              {count} chapter{count === 1 ? "" : "s"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <p className="card-kicker">Before you begin</p>
        <p className="intro-preview">{book.preview}</p>
        <div className="chips">
          {book.themes.map((t) => (
            <span key={t} className="chip static">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="card-kicker">Watch for</p>
        <ol className="watch-list">
          {book.watchFor.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ol>
      </section>

      {keyVerse && (
        <blockquote className="key-verse">
          “{keyVerse.text}”
          <cite>
            {book.name} {book.keyVerse} {keyVerse.translation}
          </cite>
        </blockquote>
      )}

      <a className="primary-btn" href={href.read(bookId, resume ?? 1)}>
        {started && resume ? `Keep swiping at chapter ${resume}` : `Start swiping ${book.name}`}
      </a>

      <section className="chapters">
        <h2>Chapters</h2>
        <div className="chapter-grid">
          {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
            <a key={n} className={done.has(n) ? "done" : ""} href={href.read(bookId, n)} aria-label={`Chapter ${n}${done.has(n) ? ", read" : ""}`}>
              {n}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
