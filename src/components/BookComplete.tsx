import { useEffect } from "react";
import { CHAPTER_COUNTS, getBook, nextBook } from "../data/books";
import { finishBook, useProgress } from "../lib/progress";
import { href } from "../lib/router";
import { useInView } from "./useInView";

export function BookComplete({ bookId }: { bookId: string }) {
  const book = getBook(bookId)!;
  const next = nextBook(bookId)!;
  const progress = useProgress();
  const read = progress.completed[bookId]?.length ?? 0;
  const total = CHAPTER_COUNTS[bookId];
  const [ref, seen] = useInView<HTMLDivElement>("0px", true);

  useEffect(() => {
    if (seen) finishBook(bookId);
  }, [seen, bookId]);

  return (
    <section className="book-complete" ref={ref}>
      <div className="celebrate" aria-hidden>
        🎉
      </div>
      <p className="card-kicker">You reached the end of</p>
      <h2>{book.name}</h2>
      <p className="muted">
        {read} of {total} chapters read{read < total ? " — revisit the ones you skipped anytime" : " — every single one"}
      </p>

      <div className="card">
        <p className="card-kicker">The big picture</p>
        {book.summary.split(/\n\n+/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="card-kicker">Take these with you</p>
        <ol className="takeaways">
          {book.takeaways.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </div>

      <a className="next-book" href={href.book(next.id)}>
        <span className="card-kicker">Up next</span>
        <strong>{next.name}</strong>
        <span className="next-tagline">{next.tagline}</span>
        <p>{book.bridge}</p>
        <span className="cta">Preview {next.name} →</span>
      </a>
    </section>
  );
}
