import { test } from "node:test";
import assert from "node:assert/strict";
import { parseContent, type ContentNode } from "./apibible.ts";

// Shape of API.Bible `content-type=json` output (abridged, placeholder wording).
const t = (verseId: string, text: string): ContentNode => ({ type: "text", text, attrs: { verseId } });
const v = (n: number): ContentNode => ({ type: "tag", name: "verse", attrs: { number: String(n), style: "v" }, items: [{ type: "text", text: String(n) }] });
const para = (style: string, ...items: ContentNode[]): ContentNode => ({ type: "tag", name: "para", attrs: { style }, items });

test("prose: headings, paragraphs, verses split across paragraphs, notes skipped", () => {
  const { passages, title } = parseContent([
    para("s1", { type: "text", text: "The First Section" }),
    para("p", v(1), t("GEN.1.1", "Alpha one. "), v(2), t("GEN.1.2", "Beta two begins")),
    para(
      "p",
      t("GEN.1.2", "and beta continues. "),
      { type: "tag", name: "note", attrs: { style: "f" }, items: [{ type: "text", text: "footnote" }] },
      v(3),
      { type: "tag", name: "char", attrs: { style: "wj" }, items: [t("GEN.1.3", "Words in red, ")] },
      t("GEN.1.3", "then plain."),
    ),
    para("r", { type: "text", text: "(Ps. 1:1)" }),
    para("s1", { type: "text", text: "Second Section" }),
    para("p", v(4), t("GEN.1.4", "Gamma four.")),
  ]);
  assert.equal(title, undefined);
  assert.deepEqual(passages, [
    { heading: "The First Section", poetry: false, verses: [{ v: 1, t: "Alpha one." }, { v: 2, t: "Beta two begins" }] },
    { poetry: false, verses: [{ v: 2, t: "and beta continues.", cont: true }, { v: 3, t: "Words in red, then plain." }] },
    { heading: "Second Section", poetry: false, verses: [{ v: 4, t: "Gamma four." }] },
  ]);
});

test("poetry: psalm title, lines joined per verse, stanzas split by blank", () => {
  const { passages, title } = parseContent([
    para("d", { type: "text", text: "A Psalm of Someone." }),
    para("q1", v(1), t("PSA.23.1", "Line one A,")),
    para("q2", t("PSA.23.1", "line one B.")),
    para("q1", v(2), t("PSA.23.2", "Line two.")),
    para("b"),
    para("q1", v(3), t("PSA.23.3", "Line three.")),
  ]);
  assert.equal(title, "A Psalm of Someone.");
  assert.deepEqual(passages, [
    { poetry: true, verses: [{ v: 1, t: "Line one A,\nline one B." }, { v: 2, t: "Line two." }] },
    { poetry: true, verses: [{ v: 3, t: "Line three." }] },
  ]);
});
