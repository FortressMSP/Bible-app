// Lists the Bibles your API.Bible key can access that match a translation (default NKJV),
// so you can set BIBLE_ID.  Usage: BIBLE_API_KEY=... npm run find-bible [-- NKJV]
const key = process.env.BIBLE_API_KEY;
const base = process.env.BIBLE_API_BASE ?? "https://rest.api.bible/v1";
const want = (process.argv[2] ?? "NKJV").toLowerCase();
if (!key) {
  console.error("Set BIBLE_API_KEY first.");
  process.exit(1);
}
const res = await fetch(`${base}/bibles?language=eng`, { headers: { "api-key": key } });
if (!res.ok) {
  console.error(`API.Bible responded ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const { data } = await res.json();
const matches = data.filter((b) =>
  [b.abbreviation, b.abbreviationLocal, b.name, b.nameLocal].some((s) => s?.toLowerCase().includes(want === "nkjv" ? "nkjv" : want)) ||
  (want === "nkjv" && /new king james/i.test(b.name)),
);
for (const b of matches.length ? matches : data) console.log(`${b.id}  ${b.abbreviationLocal ?? b.abbreviation}  ${b.name}`);
if (!matches.length) console.log(`\nNo match for "${want}" — listed every English Bible your key can access.`);
