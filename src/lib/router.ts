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

// Only real navigations (hashchange) change the route; replaceQuietly() updates the
// address bar while scrolling without remounting the feed.
let currentHash = window.location.hash;
const subscribe = (cb: () => void) => {
  const onChange = () => {
    currentHash = window.location.hash;
    cb();
  };
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => currentHash);
  return parse(hash);
}

/** Identity of the current navigation, for keying screens. */
export const useRouteKey = () => useSyncExternalStore(subscribe, () => currentHash);

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
