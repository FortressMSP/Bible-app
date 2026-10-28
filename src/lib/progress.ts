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
}

const KEY = "scroll-bible-progress-v1";
const initial: Progress = {
  completed: {},
  finishedBooks: [],
  streak: { count: 0, best: 0 },
  today: { chapters: 0 },
  dailyGoal: 3,
  deepDives: 0,
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
