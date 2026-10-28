import { useEffect, useMemo, useState } from "react";
import { BOOKS, CHAPTER_COUNTS, getBook } from "../data/books";
import type { Testament } from "../data/types";
import { loadBook, verseText } from "../lib/bible";
import { dayKey, liveStreak, setDailyGoal, todayCount, totalCompleted, useProgress } from "../lib/progress";
import { href } from "../lib/router";
import { ProgressRing } from "./ProgressRing";

export function Home() {
  const progress = useProgress();
  const streak = liveStreak(progress);
  const today = todayCount(progress);
  const total = totalCompleted(progress);
  const [tab, setTab] = useState<Testament>(() => {
    const last = progress.last && getBook(progress.last.book);
    return last ? last.testament : "OT";
  });

  const last = progress.last && getBook(progress.last.book) ? progress.last : undefined;
  const lastBook = last && getBook(last.book)!;

  const groups = useMemo(() => {
    const map = new Map<string, typeof BOOKS>();
    for (const b of BOOKS.filter((b) => b.testament === tab)) {
      map.set(b.genre, [...(map.get(b.genre) ?? []), b]);
    }
    return [...map.entries()];
  }, [tab]);

  return (
    <div className="home">
      <header className="home-header">
        <div>
          <h1 className="logo">Scroll</h1>
          <p className="muted">The whole story, one chapter at a time.</p>
        </div>
        <div className="stats">
          <div className="stat" title={`Best streak: ${progress.streak.best} days`}>
            <span className={`flame${streak ? "" : " dim"}`}>🔥</span>
            <strong>{streak}</strong>
            <span>day streak</span>
          </div>
          <button
            className="stat goal"
            title="Tap to change your daily goal"
            onClick={() => setDailyGoal(progress.dailyGoal >= 5 ? 1 : progress.dailyGoal + 1)}
          >
            <ProgressRing value={today / progress.dailyGoal} size={40} label={`${today} of ${progress.dailyGoal} chapters today`} />
            <strong>
              {today}/{progress.dailyGoal}
            </strong>
            <span>today</span>
          </button>
        </div>
      </header>

      {last && lastBook ? (
        <a className="continue-card" href={href.read(last.book, last.chapter)}>
          <span className="card-kicker">Continue reading</span>
          <strong>
            {lastBook.name} {last.chapter}
          </strong>
          <span className="muted">{lastBook.tagline}</span>
          <div className="continue-bar">
            <div style={{ width: `${((progress.completed[last.book]?.length ?? 0) / CHAPTER_COUNTS[last.book]) * 100}%` }} />
          </div>
          <span className="cta">Pick up where you left off →</span>
        </a>
      ) : (
        <a className="continue-card" href={href.book("genesis")}>
          <span className="card-kicker">Start the journey</span>
          <strong>In the beginning…</strong>
          <span className="muted">Begin with Genesis, or start anywhere below. The Gospel of John is a great first read too.</span>
          <span className="cta">Open Genesis →</span>
        </a>
      )}

      <VerseOfTheDay />

      {total > 0 && (
        <p className="journey muted">
          {total} of 1,189 chapters read · {plural(progress.finishedBooks.length, "book")} finished ·{" "}
          {plural(progress.deepDives, "deep dive")}
        </p>
      )}

      <div className="tabs" role="tablist">
        {(["OT", "NT"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "OT" ? "Old Testament" : "New Testament"}
          </button>
        ))}
      </div>

      {groups.map(([genre, books]) => (
        <section key={genre} className="genre">
          <h2>{genre}</h2>
          <div className="book-grid">
            {books.map((b) => {
              const done = progress.completed[b.id]?.length ?? 0;
              const count = CHAPTER_COUNTS[b.id];
              const finished = progress.finishedBooks.includes(b.id) && done === count;
              return (
                <a key={b.id} className={`book-card${finished ? " finished" : ""}`} href={href.book(b.id)}>
                  <div className="book-card-top">
                    <strong>{b.name}</strong>
                    {done > 0 && <ProgressRing value={done / count} size={22} stroke={3} label={`${done} of ${count} chapters`} />}
                  </div>
                  <span className="book-tagline">{b.tagline}</span>
                  <span className="book-count">
                    {count} chapter{count === 1 ? "" : "s"}
                    {finished ? " · ✓" : ""}
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
      <footer className="foot muted">Scripture: World English Bible (public domain).</footer>
    </div>
  );
}

function VerseOfTheDay() {
  // Rotate through each book's key verse, one per day.
  const book = useMemo(() => {
    const d = dayKey();
    const n = d.split("-").reduce((a, x) => a * 31 + Number(x), 7);
    return BOOKS[n % BOOKS.length];
  }, []);
  const [text, setText] = useState<string>();
  useEffect(() => {
    let live = true;
    loadBook(book.id).then((t) => live && setText(verseText(t, book.keyVerse)), () => {});
    return () => {
      live = false;
    };
  }, [book]);
  if (!text) return null;
  const [c] = book.keyVerse.split(":");
  return (
    <a className="votd" href={href.read(book.id, Number(c))}>
      <span className="card-kicker">Verse of the day</span>
      <blockquote>“{text}”</blockquote>
      <span className="votd-ref">
        {book.name} {book.keyVerse} →
      </span>
    </a>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
