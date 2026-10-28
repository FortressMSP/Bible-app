import { useEffect } from "react";
import { getBook } from "./data/books";
import { useRoute, useRouteKey } from "./lib/router";
import { Home } from "./components/Home";
import { BookIntro } from "./components/BookIntro";
import { Feed } from "./components/Feed";
import { Toasts } from "./components/Toasts";

export function App() {
  const route = useRoute();
  const key = useRouteKey();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [key]);

  let page;
  if (route.name === "book" && getBook(route.book)) page = <BookIntro bookId={route.book} />;
  else if (route.name === "read" && getBook(route.book)) page = <Feed key={key} book={route.book} chapter={route.chapter} />;
  else page = <Home />;
  return (
    <>
      {page}
      <Toasts />
    </>
  );
}
