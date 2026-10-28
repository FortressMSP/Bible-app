import { useSyncExternalStore } from "react";

export type Route =
  | { name: "home" }
  | { name: "book"; book: string }
  | { name: "read"; book: string; chapter: number };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "book" && parts[1]) return { name: "book", book: parts[1] };
  if (parts[0] === "read" && parts[1]) return { name: "read", book: parts[1], chapter: Math.max(1, Number(parts[2]) || 1) };
  return { name: "home" };
}

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parse(hash);
}

export const href = {
  home: () => "#/",
  book: (book: string) => `#/book/${book}`,
  read: (book: string, chapter: number) => `#/read/${book}/${chapter}`,
};

export function navigate(to: string) {
  window.location.hash = to;
}

/** Update the URL without triggering a route change (used while scrolling). */
export function replaceQuietly(to: string) {
  history.replaceState(history.state, "", to);
}
