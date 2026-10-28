import { useSyncExternalStore } from "react";

export interface Progress {
  /** Completed chapter numbers per book id. */
  completed: Record<string, number[]>;
  /** Books the reader has finished (saw the end-of-book summary). */
  finishedBooks: string[];
  last?: { book: string; chapter: number; at: number };
  streak: { count: number; lastDay?: string; best: number };
  today: { day?: string; chapters: number };
  dailyGoal: number;
  /** Total passages the reader opened commentary on. */
  deepDives: number;
  /** Saved (liked) passages, newest first. References only — no licensed text is stored. */
  saved: SavedRef[];
}

export interface SavedRef {
  book: string;
  chapter: number;
  from: number;
  to: number;
  at: number;
}

const KEY = "scroll-bible-progress-v1";
const initial: Progress = {
  completed: {},
  finishedBooks: [],
  streak: { count: 0, best: 0 },
  today: { chapters: 0 },
  dailyGoal: 3,
  deepDives: 0,
  saved: [],
};

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initial, ...JSON.parse(raw) };
  } catch {
    // storage unavailable — fall back to in-memory progress
  }
  return initial;
}

let state = load();
const listeners = new Set<() => void>();
const toastListeners = new Set<(t: Toast) => void>();

export interface Toast {
  icon: string;
  title: string;
  body?: string;
}

function set(next: Progress) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function toast(t: Toast) {
  toastListeners.forEach((l) => l(t));
}
export function onToast(l: (t: Toast) => void) {
  toastListeners.add(l);
  return () => void toastListeners.delete(l);
}

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

/** Streak as it should be displayed today (a missed day resets it). */
export function liveStreak(p: Progress): number {
  const { lastDay, count } = p.streak;
  return lastDay === dayKey() || lastDay === yesterdayKey() ? count : 0;
}

export function todayCount(p: Progress): number {
  return p.today.day === dayKey() ? p.today.chapters : 0;
}

export function useProgress(): Progress {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => state,
  );
}

export function setLastRead(book: string, chapter: number) {
  if (state.last?.book === book && state.last.chapter === chapter) return;
  set({ ...state, last: { book, chapter, at: Date.now() } });
}

const MILESTONES = [1, 10, 25, 50, 100, 250, 500, 750, 1000, 1189];

export function totalCompleted(p: Progress): number {
  return Object.values(p.completed).reduce((n, list) => n + list.length, 0);
}

/** Mark a chapter read; updates streak + daily goal and fires celebration toasts. */
export function completeChapter(book: string, chapter: number) {
  const done = state.completed[book] ?? [];
  if (done.includes(chapter)) return;

  const today = dayKey();
  const prevToday = todayCount(state);
  const streak = { ...state.streak };
  if (streak.lastDay !== today) {
    streak.count = streak.lastDay === yesterdayKey() ? streak.count + 1 : 1;
    streak.lastDay = today;
    streak.best = Math.max(streak.best, streak.count);
  }
  const next: Progress = {
    ...state,
    completed: { ...state.completed, [book]: [...done, chapter].sort((a, b) => a - b) },
    streak,
    today: { day: today, chapters: prevToday + 1 },
  };
  const firstToday = prevToday === 0;
  set(next);

  const total = totalCompleted(next);
  if (MILESTONES.includes(total)) {
    toast({ icon: "🏆", title: `${total} chapter${total === 1 ? "" : "s"} read!`, body: "Keep the momentum going." });
  } else if (next.today.chapters === next.dailyGoal) {
    toast({ icon: "🎯", title: "Daily goal reached!", body: `${next.dailyGoal} chapters today. Bonus chapters count too.` });
  } else if (firstToday && streak.count > 1) {
    toast({ icon: "🔥", title: `${streak.count}-day streak!`, body: "You showed up again today." });
  }
}

export function finishBook(book: string) {
  if (state.finishedBooks.includes(book)) return;
  set({ ...state, finishedBooks: [...state.finishedBooks, book] });
}

export function recordDeepDive() {
  const deepDives = state.deepDives + 1;
  set({ ...state, deepDives });
  if (deepDives === 1 || deepDives === 10 || deepDives === 50) {
    toast({ icon: "🔍", title: deepDives === 1 ? "First deep dive!" : `${deepDives} deep dives`, body: "Curiosity is a great teacher." });
  }
}

export function setDailyGoal(goal: number) {
  set({ ...state, dailyGoal: goal });
}

const sameRef = (a: Omit<SavedRef, "at">, b: Omit<SavedRef, "at">) =>
  a.book === b.book && a.chapter === b.chapter && a.from === b.from && a.to === b.to;

export const isSaved = (p: Progress, ref: Omit<SavedRef, "at">) => p.saved.some((s) => sameRef(s, ref));

/** Save or unsave a passage; returns the new saved state. */
export function toggleSaved(ref: Omit<SavedRef, "at">, save?: boolean): boolean {
  const has = isSaved(state, ref);
  const want = save ?? !has;
  if (want === has) return has;
  set({
    ...state,
    saved: want ? [{ ...ref, at: Date.now() }, ...state.saved] : state.saved.filter((s) => !sameRef(s, ref)),
  });
  if (want && state.saved.length === 1) toast({ icon: "❤️", title: "Saved!", body: "Find your saved passages on the home screen." });
  return want;
}

/** Minutes spent in the feed this session, for gentle "time well spent" nudges. */
let feedMs = 0;
const NUDGES = [5, 15, 30, 60];
export function addFeedTime(ms: number) {
  const before = Math.floor(feedMs / 60000);
  feedMs += ms;
  const after = Math.floor(feedMs / 60000);
  const hit = NUDGES.find((m) => before < m && after >= m);
  if (hit) toast({ icon: "🙌", title: `${hit} minutes in Scripture`, body: "That's time well spent." });
}
