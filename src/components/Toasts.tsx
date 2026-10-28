import { useEffect, useState } from "react";
import { onToast, type Toast } from "../lib/progress";

export function Toasts() {
  const [items, setItems] = useState<(Toast & { id: number })[]>([]);
  useEffect(
    () =>
      onToast((t) => {
        const id = Date.now() + Math.random();
        setItems((list) => [...list, { ...t, id }]);
        setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 4200);
      }),
    [],
  );
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast-icon">{t.icon}</span>
          <div>
            <strong>{t.title}</strong>
            {t.body && <p>{t.body}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
