import { useEffect } from "react";
import { getBook } from "./data/books";
import { useRoute } from "./lib/router";
import { Home } from "./components/Home";
import { BookIntro } from "./components/BookIntro";
import { Reader } from "./components/Reader";
import { Toasts } from "./components/Toasts";

export function App() {
  const route = useRoute();
  const screen = `${route.name}/${"book" in route ? route.book : ""}`;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);
  let page;
  if (route.name === "book" && getBook(route.book)) page = <BookIntro bookId={route.book} />;
  else if (route.name === "read" && getBook(route.book)) page = <Reader key={route.book} bookId={route.book} chapter={route.chapter} />;
  else page = <Home />;
  return (
    <>
      {page}
      <Toasts />
    </>
  );
}
