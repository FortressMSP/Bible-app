import { useEffect, useState } from "react";

/**
 * Observe an element; returns a callback ref and whether it is within `margin` of the viewport.
 * With `once`, it stays true after the first time it becomes visible.
 */
export function useInView<T extends Element>(margin = "0px", once = false): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) io.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, margin, once]);

  return [setEl, inView];
}
