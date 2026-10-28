import { memo, useEffect, useRef, useState, type PointerEvent } from "react";
import { CHAPTER_COUNTS, getBook, nextBook } from "../data/books";
import { CANON } from "../data/canon";
import type { Section } from "../lib/commentary";
import { liveStreak, isSaved, toast, todayCount, toggleSaved, useProgress } from "../lib/progress";
import { loadVerse } from "../lib/scripture";
import { notesForPassage, passageRange, reflectionFor, type Slide } from "../lib/slides";
import { ProgressRing } from "./ProgressRing";

interface Props {
  slide: Slide;
  active: boolean;
  onNotes: (slide: Slide, section?: Section) => void;
}

const hueFor = (book: string) => {
  const i = CANON.findIndex((b) => b.id === book);
  return (i * 47 + 20) % 360;
};

export const SlideView = memo(function SlideView({ slide, active, onNotes }: Props) {
  const style = { "--hue": hueFor(slide.book) } as React.CSSProperties;
  return (
    <section className={`slide slide-${slide.kind}${active ? " is-active" : ""}`} data-kind={slide.kind} style={style}>
      <Body slide={slide} onNotes={onNotes} />
    </section>
  );
});

function Body({ slide, onNotes }: Omit<Props, "active">) {
  const book = getBook(slide.book)!;
  switch (slide.kind) {
    case "book-cover":
      return (
        <div className="slide-inner center">
          <p className="eyebrow">
            {book.testament === "OT" ? "Old Testament" : "New Testament"} · {book.genre}
          </p>
          <h1 className="cover-title">{book.name}</h1>
          <p className="cover-tagline">{book.tagline}</p>
          <dl className="cover-meta">
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
                {CHAPTER_COUNTS[book.id]} chapter{CHAPTER_COUNTS[book.id] === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>
        </div>
      );

    case "book-preview":
      return (
        <div className="slide-inner">
          <p className="eyebrow">Before you begin {book.name}</p>
          <p className="big-text">{book.preview}</p>
          <div className="chips">
            {book.themes.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        </div>
      );

    case "book-watch":
      return (
        <div className="slide-inner">
          <p className="eyebrow">Watch for</p>
          <ol className="watch">
            {book.watchFor.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ol>
          <KeyVerse book={book.id} refText={book.keyVerse} />
        </div>
      );

    case "chapter-intro": {
      const items = slide.notes.outline.length
        ? slide.notes.outline.map((o) => ({ title: o.title, ref: o.from ? `${o.from}${o.to !== o.from ? `–${o.to}` : ""}` : "" }))
        : slide.data.passages.filter((p) => p.heading).map((p) => ({ title: p.heading!, ref: String(p.verses[0].v) }));
      return (
        <div className="slide-inner">
          <p className="eyebrow">
            {book.name} · {slide.chapter} of {CHAPTER_COUNTS[book.id]}
          </p>
          <h2 className="chapter-title">Chapter {slide.chapter}</h2>
          {slide.data.title && <p className="superscription">{slide.data.title}</p>}
          <p className="meta-line">
            ≈ {slide.minutes} min · {slide.data.translation}
          </p>
          {items.length > 0 && (
            <>
              <p className="label">In this chapter</p>
              <ul className="outline">
                {items.slice(0, 6).map((o, i) => (
                  <li key={i}>
                    <span>{o.title}</span>
                    {o.ref && <small>v{o.ref}</small>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {slide.data.copyright && <p className="copyright">{slide.data.copyright}</p>}
        </div>
      );
    }

    case "passage":
      return <PassageCard slide={slide} onNotes={onNotes} />;

    case "insight":
      return (
        <div className="slide-inner center">
          <p className="eyebrow">Matthew Henry on {book.name} {slide.chapter}:{slide.section.from}{slide.section.to !== slide.section.from ? `–${slide.section.to}` : ""}</p>
          <blockquote className="insight-quote">“{slide.line}”</blockquote>
          <button className="pill-btn" onClick={() => onNotes(slide, slide.section)}>
            Read the full note
          </button>
        </div>
      );

    case "chapter-end":
      return <ChapterEnd slide={slide} />;

    case "book-end": {
      const next = nextBook(book.id)!;
      return (
        <div className="slide-inner scrolly">
          <div className="celebrate" aria-hidden>
            🎉
          </div>
          <p className="eyebrow">You finished</p>
          <h2 className="chapter-title">{book.name}</h2>
          <p className="body-text">{book.summary}</p>
          <p className="label">Take these with you</p>
          <ol className="watch small">
            {book.takeaways.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
          <p className="teaser">
            <strong>Up next: {next.name}.</strong> {book.bridge}
          </p>
          <p className="keep-going">↑ keep swiping</p>
        </div>
      );
    }
  }
}

function PassageCard({ slide, onNotes }: { slide: Extract<Slide, { kind: "passage" }>; onNotes: Props["onNotes"] }) {
  const book = getBook(slide.book)!;
  const { from, to } = passageRange(slide.passage);
  const ref = { book: slide.book, chapter: slide.chapter, from, to };
  const progress = useProgress();
  const saved = isSaved(progress, ref);
  const hasNotes = notesForPassage(slide.notes, slide.passage).length > 0;
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  const wordCount = slide.passage.verses.reduce((n, v) => n + v.t.split(/\s+/).length, 0);
  const size = wordCount < 25 ? "xl" : wordCount < 45 ? "lg" : "md";
  const label = `${book.name} ${slide.chapter}:${from}${to !== from ? `–${to}` : ""}`;

  const like = (x: number, y: number) => {
    toggleSaved(ref, true);
    navigator.vibrate?.(12);
    const id = Date.now();
    setHearts((h) => [...h, { id, x, y }]);
    setTimeout(() => setHearts((h) => h.filter((p) => p.id !== id)), 900);
  };

  // Double-tap anywhere on the text to save, like a post.
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const now = Date.now();
    const l = lastTap.current;
    if (now - l.t < 320 && Math.abs(e.clientX - l.x) < 30 && Math.abs(e.clientY - l.y) < 30) {
      const box = e.currentTarget.getBoundingClientRect();
      like(e.clientX - box.left, e.clientY - box.top);
      lastTap.current = { t: 0, x: 0, y: 0 };
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };

  const share = async () => {
    const text = `“${slide.passage.verses.map((v) => v.t.replace(/\n/g, " ")).join(" ")}” — ${label} ${slide.data.translation}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ icon: "📋", title: "Copied to clipboard" });
      }
    } catch {
      // share sheet dismissed
    }
  };

  return (
    <>
      <div className="passage-area" onPointerUp={onPointerUp}>
        {slide.passage.heading && <p className="passage-heading">{slide.passage.heading}</p>}
        <div className={`passage-text size-${size}${slide.passage.poetry ? " poetry" : ""}`}>
          {slide.passage.verses.map((v, i) => (
            <span key={i} className="verse">
              {(!v.cont || i === 0) && <sup>{v.v}</sup>}
              {slide.passage.poetry
                ? v.t.split("\n").map((line, j) => (
                    <span key={j} className="line">
                      {line}
                    </span>
                  ))
                : `${v.t} `}
            </span>
          ))}
        </div>
        <p className="passage-ref">
          {label} <span>{slide.data.translation}</span>
        </p>
        {hearts.map((h) => (
          <span key={h.id} className="heart-burst" style={{ left: h.x, top: h.y }} aria-hidden>
            ❤️
          </span>
        ))}
      </div>

      <div className="rail">
        <button className={`rail-btn${saved ? " on" : ""}`} onClick={() => toggleSaved(ref)} aria-pressed={saved} aria-label={saved ? "Unsave" : "Save"}>
          <span className="rail-icon">{saved ? "❤️" : "🤍"}</span>
          <span>{saved ? "Saved" : "Save"}</span>
        </button>
        <button className={`rail-btn${hasNotes ? "" : " dim"}`} onClick={() => onNotes(slide)} aria-label="Commentary">
          <span className="rail-icon">📜</span>
          <span>Notes</span>
        </button>
        <button className="rail-btn" onClick={share} aria-label="Share">
          <span className="rail-icon">↗</span>
          <span>Share</span>
        </button>
      </div>

      <div className="chapter-dots" aria-label={`Card ${slide.index} of ${slide.of} in this chapter`}>
        {slide.index}/{slide.of}
      </div>
    </>
  );
}

function ChapterEnd({ slide }: { slide: Extract<Slide, { kind: "chapter-end" }> }) {
  const book = getBook(slide.book)!;
  const progress = useProgress();
  const total = CHAPTER_COUNTS[book.id];
  const streak = liveStreak(progress);
  const today = todayCount(progress);
  const recap = slide.notes.outline.length
    ? slide.notes.outline.map((o) => o.title)
    : slide.data.passages.filter((p) => p.heading).map((p) => p.heading!);
  const nextTitle = slide.next?.outline[0]?.title;
  const done = progress.completed[book.id]?.includes(slide.chapter) ?? false;

  return (
    <div className="slide-inner">
      <div className={`done-check${done ? "" : " skimmed"}`} aria-hidden>
        {done ? "✓" : "…"}
      </div>
      <h2 className="chapter-title small">
        {book.name} {slide.chapter} {done ? "complete" : "skimmed"}
      </h2>
      {!done && <p className="meta-line">Swipe back through this chapter to count it toward your streak.</p>}
      <div className="stat-row">
        <span>🔥 {streak} day streak</span>
        <span className="goal">
          <ProgressRing value={today / progress.dailyGoal} size={22} stroke={3} label="Daily goal" /> {today}/{progress.dailyGoal} today
        </span>
      </div>
      {recap.length > 0 && (
        <>
          <p className="label">What you just read</p>
          <ul className="recap">
            {recap.slice(0, 5).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}
      <div className="reflect">
        <span aria-hidden>💭</span>
        <p>{reflectionFor(book.id, slide.chapter)}</p>
      </div>
      {slide.chapter < total && (
        <p className="teaser">
          <strong>Up next · Chapter {slide.chapter + 1}</strong>
          {nextTitle ? ` — ${nextTitle}` : ""}
        </p>
      )}
      <p className="keep-going">↑ keep swiping</p>
    </div>
  );
}

function KeyVerse({ book, refText }: { book: string; refText: string }) {
  const [verse, setVerse] = useState<{ text: string; translation: string }>();
  useEffect(() => {
    let live = true;
    loadVerse(book, refText).then((v) => live && setVerse(v), () => {});
    return () => {
      live = false;
    };
  }, [book, refText]);
  if (!verse) return null;
  return (
    <blockquote className="key-verse">
      “{verse.text}”
      <cite>
        {getBook(book)!.name} {refText} {verse.translation}
      </cite>
    </blockquote>
  );
}
