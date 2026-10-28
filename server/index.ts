import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { ApiBibleError } from "./apibible.ts";
import { getChapter, isBook, NotFound } from "./scripture.ts";
import { CHAPTER_COUNTS } from "../src/data/books.ts";

const app = express();

app.get("/api/chapter/:book/:chapter", async (req, res) => {
  const { book } = req.params;
  const chapter = Number(req.params.chapter);
  if (!isBook(book) || !Number.isInteger(chapter) || chapter < 1 || chapter > CHAPTER_COUNTS[book]) {
    res.status(404).json({ error: "Unknown chapter" });
    return;
  }
  try {
    const data = await getChapter(book, chapter);
    res.set("Cache-Control", "private, max-age=300").json(data);
  } catch (err) {
    if (err instanceof NotFound) {
      res.status(404).json({ error: "Unknown chapter" });
    } else if (err instanceof ApiBibleError) {
      console.error(err.message);
      res.status(502).json({ error: "Scripture service unavailable" });
    } else {
      console.error(err);
      res.status(500).json({ error: "Something went wrong" });
    }
  }
});

const dist = path.resolve("dist");
if (process.env.NODE_ENV === "production" && existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h", setHeaders: (res, file) => file.endsWith("sw.js") && res.set("Cache-Control", "no-cache") }));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
