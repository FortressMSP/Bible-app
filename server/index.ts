import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { getInsight, InsightError, INSIGHT_KINDS, type InsightRequest } from "./insights.ts";
import { isBook } from "./bible.ts";

const app = express();
app.use(express.json({ limit: "8kb" }));

app.post("/api/insight", async (req, res) => {
  const { kind, book, chapter, passage, question } = req.body ?? {};
  if (
    !INSIGHT_KINDS.includes(kind) ||
    typeof book !== "string" ||
    !isBook(book) ||
    !Number.isInteger(chapter) ||
    chapter < 1 ||
    (passage !== undefined && !Number.isInteger(passage)) ||
    ((kind === "commentary" || kind === "ask") && passage === undefined) ||
    (kind === "ask" && (typeof question !== "string" || !question.trim() || question.length > 300))
  ) {
    res.status(400).json({ error: "Invalid request", code: "bad_request" });
    return;
  }
  const request: InsightRequest = { kind, book, chapter, passage, question: kind === "ask" ? question : undefined };
  try {
    res.json(await getInsight(request));
  } catch (err) {
    if (err instanceof InsightError) {
      res.status(err.status).json({ error: err.message, code: err.code });
    } else {
      console.error(err);
      res.status(500).json({ error: "Something went wrong", code: "internal" });
    }
  }
});

const dist = path.resolve("dist");
if (process.env.NODE_ENV === "production" && existsSync(dist)) {
  app.use(express.static(dist, { maxAge: "1h" }));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
