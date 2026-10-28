# Scroll — a Bible reader built to keep you reading

Scroll lets you move through the Bible book by book, chapter by chapter, in one continuous feed. It frames every step with context so you know what to look for and come away with something to think about.

## What it does

- **Book previews.** Before you open a book you see who wrote it and when, a short preview, its key themes, three things to watch for, and its key verse. All 66 books have hand-written previews.
- **Chapter previews.** Each chapter opens with an AI-generated card: an evocative title, a hook, where you are in the story, and three questions to keep in mind.
- **Continuous scroll.** Chapters load into one feed as you go. You never hit a "next page" button.
- **Chapter summaries.** At the end of each chapter you get a recap, key moments, a reflection question, and an *Up next* teaser for the following chapter.
- **Book summaries.** Finishing a book shows a celebration, a big-picture summary, three takeaways, and a teaser that hands off to the next book.
- **Passage commentary.** Tap **✦ Go deeper** on any paragraph or stanza. You get background, meaning, cross-references, and a "for today" thought. Suggested follow-up questions (or your own question) keep the conversation going, and each answer suggests more.
- **Engagement hooks.** Daily streak 🔥, a daily chapter goal (tap the ring to change it), milestone and deep-dive toasts, per-book progress rings, "continue reading", and a verse of the day.

Scripture text is the **World English Bible** (public domain). The build step generates it from the [`world-english-bible`](https://www.npmjs.com/package/world-english-bible) package.

## Running it

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # enables previews, summaries and commentary
npm run dev                           # web on http://localhost:5173, API on :8787
```

Production:

```bash
npm run build
npm start          # serves the built app and the API on $PORT (default 8787)
```

Without an API key the app still works fully as a reader. The AI cards fall back to the book's own "watch for" prompts, a generic reflection question, and the next chapter's opening line as the teaser. To work on the UI without spending tokens, run the server with `INSIGHT_MOCK=1` to get placeholder content.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Claude API key (or any credential the Anthropic SDK resolves) |
| `BIBLE_MODEL` | `claude-opus-5-5` | Model used for insights |
| `INSIGHT_CACHE_DIR` | `.cache/insights` | Where generated insights are cached |
| `INSIGHT_MOCK` | — | `1` returns placeholder insights |
| `PORT` | `8787` | API / production server port |

## How it's built

```
scripts/build-bible.mjs   WEB JSON  ->  public/bible/<book>.json (chapters -> passages -> verses)
src/data/books-*.ts       hand-written previews/summaries for all 66 books
server/insights.ts        Claude calls with JSON-schema structured output, disk cache, request dedupe
src/components/Reader.tsx continuous scroll, chapter tracking, completion and streaks
src/components/CommentarySheet.tsx  passage commentary + follow-up Q&A
```

- The server reads the scripture text itself, so clients only send references (book, chapter, passage index) and can't inject arbitrary prompts. The one exception is the free-text follow-up question, which is capped at 300 characters.
- Every insight is generated once and cached on disk by (model, kind, reference, question). Each chapter preview, summary and commentary is paid for only once across all readers. The client also prefetches the next chapter's preview while you read.
- Requests use the `fallbacks: "default"` server-side refusal fallback, so if the model declines a request the API retries it on a recommended fallback model.
- Reading progress lives in the browser's `localStorage`. There are no accounts.

### Things to consider before a public launch

- Add rate limiting on `/api/insight` (follow-up questions are free text and not shared across users, so they're the main cost driver).
- You can pre-generate all chapter previews and summaries (2,378 requests) with a batch job so first readers never wait.
- Accounts and sync, if you want streaks to follow people across devices.
