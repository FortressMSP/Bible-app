import { useCallback, useEffect, useRef, useState } from "react";
import type { BookText } from "../data/canon";
import { CHAPTER_COUNTS, getBook } from "../data/books";
import { loadBook } from "../lib/bible";
import { fetchInsight } from "../lib/insights";
import { completeChapter, setLastRead, useProgress } from "../lib/progress";
import { href, replaceQuietly } from "../lib/router";
import { ChapterBlock } from "./ChapterBlock";
import { BookComplete } from "./BookComplete";
import { CommentarySheet, type PassageTarget } from "./CommentarySheet";
import { useInView } from "./useInView";

export function Reader({ bookId, chapter }: { bookId: string; chapter: number }) {
  const info = getBook(bookId)!;
  const count = CHAPTER_COUNTS[bookId];
  const start0 = Math.min(Math.max(1, chapter), count);

  const [text, setText] = useState<BookText | null>(null);
  const [error, setError] = useState(false);
  const [range, setRange] = useState({ start: start0, end: start0 });
  const [current, setCurrent] = useState(start0);
  const [target, setTarget] = useState<PassageTarget | null>(null);
  const progress = useProgress();
  const doneCount = progress.completed[bookId]?.length ?? 0;

  // A navigation to a chapter that isn't where we are (e.g. a link) restarts the reader there.
  const currentRef = useRef(current);
  currentRef.current = current;
  useEffect(() => {
    if (start0 !== currentRef.current) {
      setRange({ start: start0, end: start0 });
      setCurrent(start0);
      window.scrollTo({ top: 0 });
    }
  }, [start0]);

  useEffect(() => {
    let live = true;
    loadBook(bookId).then(
      (t) => live && setText(t),
      () => live && setError(true),
    );
    return () => {
      live = false;
    };
  }, [bookId]);

  // Track which chapter is on screen; keep the URL and "continue reading" in sync.
  // A chapter counts as read once its end is on screen, or once the reader scrolls
  // past an end that started out below the fold (fast flings can skip the viewport).
  const armed = useRef(new Set<number>());
  useEffect(() => {
    const onScroll = () => {
      const h = window.innerHeight;
      let visible = range.start;
      for (const el of document.querySelectorAll<HTMLElement>("[data-chapter]")) {
        if (el.getBoundingClientRect().top < h * 0.4) visible = Number(el.dataset.chapter);
      }
      setCurrent(visible);
      for (const el of document.querySelectorAll<HTMLElement>("[data-chapter-end]")) {
        const n = Number(el.dataset.chapterEnd);
        const top = el.getBoundingClientRect().top;
        if (top >= h) armed.current.add(n);
        else if (top >= 0 || armed.current.has(n)) completeChapter(bookId, n);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [bookId, range.start, range.end, text]);

  useEffect(() => {
    replaceQuietly(href.read(bookId, current));
    setLastRead(bookId, current);
  }, [bookId, current]);

  // Infinite scroll: append the next chapter as the reader nears the bottom,
  // and warm up its preview so the hook is ready the moment it appears.
  const [observeBottom, nearBottom] = useInView<HTMLDivElement>("1200px");
  const bottomEl = useRef<HTMLDivElement | null>(null);
  const bottomRef = useCallback(
    (el: HTMLDivElement | null) => {
      bottomEl.current = el;
      observeBottom(el);
    },
    [observeBottom],
  );
  useEffect(() => {
    if (!nearBottom || !text || range.end >= count) return;
    // Re-measure after layout: the observer's flag can lag behind a just-appended chapter.
    const id = requestAnimationFrame(() => {
      const top = bottomEl.current?.getBoundingClientRect().top ?? Infinity;
      if (top < window.innerHeight + 1200) setRange((r) => ({ ...r, end: Math.min(count, r.end + 1) }));
    });
    return () => cancelAnimationFrame(id);
  }, [nearBottom, text, range.end, count]);
  useEffect(() => {
    if (range.end < count) fetchInsight({ kind: "chapter-preview", book: bookId, chapter: range.end + 1 }).catch(() => {});
  }, [bookId, range.end, count]);

  const loadPrevious = () => {
    const before = document.documentElement.scrollHeight;
    setRange((r) => ({ ...r, start: Math.max(1, r.start - 1) }));
    requestAnimationFrame(() => window.scrollBy(0, document.documentElement.scrollHeight - before));
  };

  const closeSheet = useCallback(() => setTarget(null), []);

  const chapters = [];
  for (let n = range.start; n <= range.end; n++) chapters.push(n);
  const pct = Math.round((doneCount / count) * 100);

  return (
    <div className="reader">
      <header className="reader-bar">
        <a className="icon-btn" href={href.book(bookId)} aria-label={`Back to ${info.name}`}>
          ←
        </a>
        <div className="reader-bar-title">
          <strong>{info.name}</strong>
          <span>
            Chapter {current} of {count}
          </span>
        </div>
        <a className="icon-btn" href={href.home()} aria-label="Home">
          ⌂
        </a>
        <div className="reader-progress" aria-label={`${pct}% of ${info.name} read`}>
          <div style={{ width: `${pct}%` }} />
        </div>
      </header>

      {error && <p className="empty">Couldn’t load {info.name}. Check your connection and try again.</p>}
      {!text && !error && <div className="loading-page">Opening {info.name}…</div>}

      {text && (
        <main className="reader-body">
          {range.start > 1 && (
            <button className="load-prev" onClick={loadPrevious}>
              ↑ Read chapter {range.start - 1}
            </button>
          )}
          {chapters.map((n) => (
            <ChapterBlock
              key={n}
              bookId={bookId}
              chapter={text.chapters[n - 1]}
              total={count}
              nextChapter={text.chapters[n]}
              done={progress.completed[bookId]?.includes(n) ?? false}
              onOpenPassage={setTarget}
            />
          ))}
          {range.end === count ? <BookComplete bookId={bookId} /> : <div className="loading-more">Loading chapter {range.end + 1}…</div>}
          <div ref={bottomRef} className="bottom-sentinel" />
        </main>
      )}

      {target && <CommentarySheet target={target} onClose={closeSheet} />}
    </div>
  );
}
