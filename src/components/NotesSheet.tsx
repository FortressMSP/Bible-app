import { useEffect } from "react";
import { recordDeepDive } from "../lib/progress";
import type { NotesTarget } from "./Feed";

/** Bottom sheet with Matthew Henry's Concise Commentary for a passage. */
export function NotesSheet({ target, onClose }: { target: NotesTarget; onClose: () => void }) {
  useEffect(() => {
    if (target.sections.length) recordDeepDive();
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Commentary on ${target.title}`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <header className="sheet-header">
          <div>
            <p className="sheet-kicker">Matthew Henry’s Commentary</p>
            <h3>{target.title}</h3>
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="sheet-body">
          {target.sections.length === 0 && (
            <p className="muted">Matthew Henry’s Concise Commentary has no notes on these verses. Keep swiping — there’s more ahead.</p>
          )}
          {target.sections.map((s) => (
            <section key={s.from} className="note">
              <h4>
                Verses {s.from}
                {s.to !== s.from ? `–${s.to}` : ""}
              </h4>
              {s.text.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </section>
          ))}
          <p className="sheet-source">Matthew Henry’s Concise Commentary on the Whole Bible (1706; public domain).</p>
        </div>
      </div>
    </div>
  );
}
