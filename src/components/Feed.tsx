import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CHAPTER_COUNTS, getBook, nextBook } from "../data/books";
import { loadChapter } from "../lib/scripture";
import { chapterCommentary, loadCommentary, type Section } from "../lib/commentary";
import { reportFums } from "../lib/fums";
import { addFeedTime, completeChapter, finishBook, setLastRead } from "../lib/progress";
import { href, replaceQuietly } from "../lib/router";
import { bookIntroSlides, chapterSlides, notesForPassage, passageRange, type Slide } from "../lib/slides";
import { SlideView } from "./SlideView";
import { NotesSheet } from "./NotesSheet";

interface Pos {
  book: string;
  chapter: number;
}

/** How many cards on either side of the visible one are actually rendered. */
const WINDOW = 2;
/** Start loading the next chapter when this many cards remain. */
const PREFETCH = 8;

async function buildChapter({ book, chapter }: Pos): Promise<Slide[]> {
  const [data, notes] = await Promise.all([loadChapter(book, chapter), loadCommentary(book).catch(() => undefined)]);
  const next = chapter < CHAPTER_COUNTS[book] ? chapterCommentary(notes, chapter + 1) : undefined;
  return chapterSlides(book, data, chapterCommentary(notes, chapter), next);
}

const after = ({ book, chapter }: Pos): Pos =>
  chapter < CHAPTER_COUNTS[book] ? { book, chapter: chapter + 1 } : { book: nextBook(book)!.id, chapter: 1 };

export interface NotesTarget {
  title: string;
  book: string;
  chapter: number;
  from: number;
  to: number;
  sections: Section[];
}

export function Feed({ book, chapter }: Pos) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [active, setActive] = useState(0);
  const [error, setError] = useState(false);
  const [notes, setNotes] = useState<NotesTarget | null>(null);
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem("scroll-swiped");
    } catch {
      return true;
    }
  });

  const range = useRef({ first: { book, chapter }, last: { book, chapter } });
  const busy = useRef({ next: false, prev: false });
  /** Key of the card to keep on screen after cards are inserted above it. */
  const anchor = useRef<string | null>(null);
  const activeRef = useRef(0);
  activeRef.current = active;

  // Initial chapter (with the book's intro cards when starting at chapter 1).
  useEffect(() => {
    let live = true;
    buildChapter({ book, chapter }).then(
      (s) => live && setSlides([...(chapter === 1 ? bookIntroSlides(book) : []), ...s]),
      () => live && setError(true),
    );
    return () => {
      live = false;
    };
  }, [book, chapter]);

  const appendNext = useCallback(async () => {
    if (busy.current.next) return;
    busy.current.next = true;
    const pos = after(range.current.last);
    try {
      const s = await buildChapter(pos);
      range.current.last = pos;
      setSlides((cur) => [...cur, ...(pos.chapter === 1 ? bookIntroSlides(pos.book) : []), ...s]);
    } catch {
      // try again on the next scroll
    } finally {
      busy.current.next = false;
    }
  }, []);

  const prependPrev = useCallback(async () => {
    const { first } = range.current;
    if (busy.current.prev || first.chapter <= 1) return;
    busy.current.prev = true;
    const pos = { book: first.book, chapter: first.chapter - 1 };
    try {
      const s = await buildChapter(pos);
      const add = [...(pos.chapter === 1 ? bookIntroSlides(pos.book) : []), ...s];
      range.current.first = pos;
      setSlides((cur) => {
        anchor.current = cur[activeRef.current]?.key ?? null;
        return [...add, ...cur];
      });
    } catch {
      // ignore; the reader can still swipe forward
    } finally {
      busy.current.prev = false;
    }
  }, []);

  // Keep the visible card in place when cards are inserted above it. Set the position
  // absolutely (all cards share one height): browsers may also re-snap on their own.
  useLayoutEffect(() => {
    const el = feedRef.current;
    if (!el || !anchor.current) return;
    const i = slides.findIndex((s) => s.key === anchor.current);
    anchor.current = null;
    if (i >= 0) {
      el.scrollTop = i * el.clientHeight;
      activeRef.current = i;
      setActive(i);
    }
  }, [slides]);

  const onScroll = () => {
    const el = feedRef.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / el.clientHeight);
    if (i !== active) setActive(i);
    if (hint && el.scrollTop > 40) {
      setHint(false);
      try {
        localStorage.setItem("scroll-swiped", "1");
      } catch {
        // ignore
      }
    }
  };

  // React to the visible card: load more, sync the URL, track progress, report FUMS.
  const current = slides[active];
  useEffect(() => {
    if (!slides.length) return;
    // activeRef reflects an anchor correction made earlier in this commit.
    if (slides.length - activeRef.current <= PREFETCH) appendNext();
    if (activeRef.current <= 1) prependPrev();
  }, [active, slides.length, appendNext, prependPrev]);

  // A chapter counts as read only if at least half of its passage cards were on screen.
  const viewed = useRef(new Map<string, Set<number>>());
  useEffect(() => {
    if (!current) return;
    if (current.kind === "passage") {
      const k = `${current.book}.${current.chapter}`;
      viewed.current.set(k, (viewed.current.get(k) ?? new Set()).add(current.index));
    }
    if ("chapter" in current) {
      replaceQuietly(href.read(current.book, current.chapter));
      setLastRead(current.book, current.chapter);
    }
    if (current.kind === "passage" || current.kind === "chapter-intro") reportFums(current.data.fumsId, current.data.fumsScript);
    if (current.kind === "chapter-end") {
      const seen = viewed.current.get(`${current.book}.${current.chapter}`)?.size ?? 0;
      const cards = slides.find((s) => s.kind === "passage" && s.book === current.book && s.chapter === current.chapter);
      if (cards?.kind === "passage" && seen >= Math.ceil(cards.of / 2)) completeChapter(current.book, current.chapter);
    }
    if (current.kind === "book-end") finishBook(current.book);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Gentle "time well spent" nudges while the feed is on screen.
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && addFeedTime(15_000), 15_000);
    return () => clearInterval(id);
  }, []);

  const go = useCallback((delta: number) => {
    const el = feedRef.current;
    if (el) el.scrollTo({ top: (Math.round(el.scrollTop / el.clientHeight) + delta) * el.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (notes) return;
      if (["ArrowDown", "PageDown", "j", " "].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowUp", "PageUp", "k"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, notes]);

  const openNotes = useCallback((slide: Slide, section?: Section) => {
    if (slide.kind === "passage") {
      const { from, to } = passageRange(slide.passage);
      setNotes({
        title: `${getBook(slide.book)!.name} ${slide.chapter}:${from}${to !== from ? `–${to}` : ""}`,
        book: slide.book,
        chapter: slide.chapter,
        from,
        to,
        sections: notesForPassage(slide.notes, slide.passage),
      });
    } else if (slide.kind === "insight" && section) {
      setNotes({
        title: `${getBook(slide.book)!.name} ${slide.chapter}:${section.from}${section.to !== section.from ? `–${section.to}` : ""}`,
        book: slide.book,
        chapter: slide.chapter,
        from: section.from,
        to: section.to,
        sections: [section],
      });
    }
  }, []);
  const closeNotes = useCallback(() => setNotes(null), []);

  const info = current && getBook(current.book);
  const progress =
    current?.kind === "passage" ? current.index / current.of : current?.kind === "chapter-end" || current?.kind === "book-end" ? 1 : current?.kind === "insight" ? undefined : 0;

  return (
    <div className="feed-shell">
      <header className="feed-top">
        <a className="feed-btn" href={href.home()} aria-label="Home">
          ✕
        </a>
        {info && (
          <a className="feed-label" href={href.book(info.id)}>
            <strong>{info.name}</strong>
            {"chapter" in current ? <span> · {current.chapter}</span> : null}
          </a>
        )}
        <span className="feed-btn" aria-hidden />
        {progress !== undefined && (
          <div className="feed-progress">
            <div style={{ transform: `scaleX(${progress})` }} />
          </div>
        )}
      </header>

      <div className="feed" ref={feedRef} onScroll={onScroll}>
        {error && (
          <section className="slide slide-center">
            <p>Couldn’t load this chapter. Check your connection and try again.</p>
          </section>
        )}
        {!error && !slides.length && (
          <section className="slide slide-center">
            <div className="spinner" aria-label="Loading" />
          </section>
        )}
        {slides.map((s, i) =>
          Math.abs(i - active) <= WINDOW ? (
            <SlideView key={s.key} slide={s} active={i === active} onNotes={openNotes} />
          ) : (
            <section key={s.key} className="slide" data-kind={s.kind} aria-hidden />
          ),
        )}
        {slides.length > 0 && (
          // Not a snap target: browsers re-snap to the previously snapped element when
          // content changes, and this one moves to the end every time a chapter is added.
          <section className="slide slide-center feed-tail">
            <div className="spinner" aria-label="Loading more" />
          </section>
        )}
      </div>

      {hint && slides.length > 0 && (
        <div className="swipe-hint" aria-hidden>
          <span>↑</span>
          Swipe up
        </div>
      )}
      {notes && <NotesSheet target={notes} onClose={closeNotes} />}
    </div>
  );
}
