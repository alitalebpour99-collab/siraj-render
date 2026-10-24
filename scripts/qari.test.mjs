// node --experimental-strip-types --test scripts/
// Placeholders only: no text of the Quran or of a translation is used here.
import assert from "node:assert/strict";
import test from "node:test";
import { splitLeadingBasmala } from "../src/basmala.ts";
import { wordCount, wordParts } from "../src/words.ts";
import { alignClip, cutPoints, segmentWordCount } from "./align.mjs";
import { PREVIEWS } from "./samples.mjs";
import { enWords, faOrdinal, faWords, introLine, outroLine } from "./say.mjs";

test("word parts give the text back exactly and count words with letters", () => {
  const text = "w1 w2  w3́ ́ w4";
  const { parts, count } = wordParts(text);
  assert.equal(parts.map((p) => p.text).join(""), text);
  assert.equal(count, 4); // the lone mark belongs to the word before it
  assert.deepEqual(
    parts.filter((p) => p.word !== null).map((p) => p.word),
    [0, 1, 2, 2, 3],
  );
  assert.equal(wordCount("one"), 1);
  assert.equal(wordCount(""), 0);
});

test("the basmala split leaves the rest with its own word count", () => {
  const split = splitLeadingBasmala(112, 1, "b1 b2 b3 b4 w1 w2 w3", "b1 b2 b3 b4");
  assert.ok(split);
  assert.equal(split.basmala + split.rest, "b1 b2 b3 b4 w1 w2 w3");
  assert.equal(wordCount(split.basmala), 4);
  assert.equal(wordCount(split.rest), 3);
  assert.equal(splitLeadingBasmala(9, 1, "b1 b2 b3 b4 w1", "b1 b2 b3 b4"), null);
});

test("segments: bare entries are ignored, gaps are seen", () => {
  assert.deepEqual(segmentWordCount([[1, 0, 10], [1], [2, 10, 20], [2]]), { count: 2, contiguous: true });
  assert.deepEqual(segmentWordCount([[1, 0, 10], [3, 10, 20]]), { count: 2, contiguous: false });
});

test("cut points follow each other without gap or overlap", () => {
  const ts = [
    { verse_key: "x:1", timestamp_from: 0, timestamp_to: 2980, segments: [[1, 0, 430], [2, 430, 2915]] },
    { verse_key: "x:2", timestamp_from: 2980, timestamp_to: 5510, segments: [[1, 2915, 3965], [2, 3965, 5400]] },
    { verse_key: "x:3", timestamp_from: 5510, timestamp_to: 8490, segments: [[1, 5465, 8380]] },
  ];
  const cuts = cutPoints(ts, 8400);
  assert.deepEqual(cuts.map((c) => [c.fromMs, c.toMs]), [
    [0, 2915],
    [2915, 5465],
    [5465, 8400],
  ]);
});

test("alignment: word timings when the counts agree, the whole verse when they differ", () => {
  const segments = [[1, 2915, 3965], [2, 3965, 5400]];
  const ok = alignClip({ sirajWords: 2, segments, fromMs: 2915, toMs: 5465 });
  assert.equal(ok.mode, "word");
  assert.deepEqual(ok.words, [
    { start: 0, end: 1.05 },
    { start: 1.05, end: 2.485 },
  ]);
  const off = alignClip({ sirajWords: 3, segments, fromMs: 2915, toMs: 5465 });
  assert.equal(off.mode, "verse");
  assert.equal(off.qfWords, 2);
  assert.deepEqual(off.words, [{ start: 0, end: 2.55 }]);
});

test("the narrator's own lines are factual and short", () => {
  assert.equal(enWords(112), "one hundred and twelve");
  assert.equal(enWords(4), "four");
  assert.equal(faWords(103), "صد و سه");
  assert.equal(faOrdinal(103), "صد و سوم");
  assert.equal(faOrdinal(112), "صد و دوازدهم");
  assert.equal(introLine(PREVIEWS["en-qari"], 4), "Surah one hundred and twelve, Al-Ikhlas. Four verses.");
  assert.equal(introLine(PREVIEWS["fa-qari"], 3), "سورهٔ صد و سوم، عصر. سه آیه.");
  for (const s of Object.values(PREVIEWS)) assert.ok(outroLine(s, "T").length < 120);
});
