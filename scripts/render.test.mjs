// node --experimental-strip-types --test scripts/
// Placeholders only: no text of the Quran or of a translation is used here.
import assert from "node:assert/strict";
import test from "node:test";
import { splitLeadingBasmala } from "../src/basmala.ts";
import { COUNT_SCENES, VT, countsTimeline, planIds, speakerWindows, verseTimeline } from "../src/timelines.ts";
import { pieces, wordCount, wordParts } from "../src/words.ts";
import { alignClip, cutPoints, segmentWordCount } from "./align.mjs";
import { manifestOf } from "./manifest.mjs";
import { enWords, faWords, spoken } from "./spoken.mjs";
import { cardNumbers, countNumbers, crossCheck, juzOf, pageOf, parseTanzil } from "./tanzil.mjs";

test("word parts give the text back exactly and count words with letters", () => {
  const text = "w1 w2  w3́ ́ w4";
  const { parts, count } = wordParts(text);
  assert.equal(parts.map((p) => p.text).join(""), text);
  assert.equal(count, 4); // the lone mark belongs to the word before it
  assert.equal(wordCount("one"), 1);
  assert.equal(wordCount(""), 0);
  // a translation line: every space-separated piece is a word, the line comes back exactly
  const line = "t1 (t2) — t3";
  const ps = pieces(line);
  assert.equal(ps.map((p) => p.text).join(""), line);
  assert.equal(ps.filter((p) => p.word !== null).length, 4);
});

test("the basmala split leaves the rest with its own word count", () => {
  const split = splitLeadingBasmala(112, 1, "b1 b2 b3 b4 w1 w2 w3", "b1 b2 b3 b4");
  assert.ok(split);
  assert.equal(split.basmala + split.rest, "b1 b2 b3 b4 w1 w2 w3");
  assert.equal(wordCount(split.rest), 3);
  assert.equal(splitLeadingBasmala(9, 1, "b1 b2 b3 b4 w1", "b1 b2 b3 b4"), null);
});

test("segments and cut points: no gap, no overlap, bare entries ignored", () => {
  assert.deepEqual(segmentWordCount([[1, 0, 10], [1], [2, 10, 20], [2]]), { count: 2, contiguous: true });
  const ts = [
    { verse_key: "x:1", timestamp_from: 0, timestamp_to: 2980, segments: [[1, 0, 430], [2, 430, 2915]] },
    { verse_key: "x:2", timestamp_from: 2980, timestamp_to: 5510, segments: [[1, 2915, 3965], [2, 3965, 5400]] },
    { verse_key: "x:3", timestamp_from: 5510, timestamp_to: 8490, segments: [[1, 5465, 8380]] },
  ];
  assert.deepEqual(cutPoints(ts, 8400).map((c) => [c.fromMs, c.toMs]), [
    [0, 2915],
    [2915, 5465],
    [5465, 8400],
  ]);
  const ok = alignClip({ sirajWords: 2, segments: ts[1].segments, fromMs: 2915, toMs: 5465 });
  assert.equal(ok.mode, "word");
  assert.equal(alignClip({ sirajWords: 3, segments: ts[1].segments, fromMs: 2915, toMs: 5465 }).mode, "verse");
  // a licensed per-ayah file: its segments on the file's own clock
  const own = alignClip({ sirajWords: 2, segments: [[1, 0, 600], [2, 600, 1500]], fromMs: 0, toMs: 1600 });
  assert.deepEqual(own.words, [
    { start: 0, end: 0.6 },
    { start: 0.6, end: 1.5 },
  ]);
});

const ayah = (n) => ({ ayahNumber: n, text: `ARABIC-PLACEHOLDER-${n}`, translation: `TRANSLATION-PLACEHOLDER-${n}`, locator: `112:${n}`, textHashSha256: "0".repeat(64) });
const clip = (n, seconds) => ({ id: `q${n}`, ayah: n, file: `qari/x/q-${n}.wav`, seconds, mode: "word", words: [{ start: 0, end: seconds }], sirajWords: 1, qfWords: 1, verseKey: `112:${n}` });

test("verse timeline: the qari first (the basmala before ayah 1), then the narrator, never over each other", () => {
  const p = {
    ayahs: [ayah(1), ayah(2), ayah(3)],
    qari: { basmala: { ...clip(0, 6), id: "qb", ayah: null }, verses: [clip(1, 2.9), clip(2, 2.5), clip(3, 7.2)] },
    voice: { engine: "kokoro", voice: "k", lines: [1, 2, 3].map((n) => ({ id: `a${n}`, file: `voice/x/n-a${n}.wav`, seconds: 2 + n })) },
  };
  const t = verseTimeline(p);
  assert.equal(t.cards.length, 3);
  assert.equal(t.cards[0].basmalaAt, VT.QARI_AT);
  assert.ok(t.cards[0].verseAt > t.cards[0].basmalaAt + 6 * 30);
  assert.deepEqual(t.speakers.map((s) => s.who), ["qari basmala", "qari 1", "narrator 1", "qari 2", "narrator 2", "qari 3", "narrator 3"]);
  const { overlap, segs } = speakerWindows(t.speakers);
  assert.equal(overlap, null);
  for (let i = 1; i < segs.length; i++) assert.ok(segs[i].from >= segs[i - 1].to);
  assert.equal(t.total, t.outro.from + VT.OUTRO);
  // a narrator line made longer than its card would allow is caught
  assert.match(speakerWindows([...t.speakers, { who: "late", kind: "narrator", frame: t.speakers[1].frame, seconds: 1 }]).overlap, /begins before/);
});

test("verse timeline without a recitation or a voice: calm reading times, nobody speaks", () => {
  const t = verseTimeline({ ayahs: [ayah(1), ayah(2)], qari: null, voice: { engine: "none", voice: null, lines: [] } });
  assert.equal(t.speakers.length, 0);
  for (const c of t.cards) {
    assert.equal(c.recited, false);
    assert.ok(c.dur >= VT.MIN_CARD);
  }
});

test("counts timeline: each metric's lines in their scenes, the voice in order", () => {
  for (const [metric, plan] of Object.entries(COUNT_SCENES)) {
    const narration = planIds(plan).map((id) => ({ id, show: `SHOW ${id}`, say: `SAY ${id}` }));
    const voice = { engine: "kokoro", voice: "k", lines: narration.map((n) => ({ id: n.id, file: `voice/x/n-${n.id}.wav`, seconds: 3 })) };
    const t = countsTimeline({ metric, narration, voice });
    assert.equal(t.scenes.length, plan.length, metric);
    assert.equal(t.speakers.length, narration.length, metric);
    assert.equal(speakerWindows(t.speakers).overlap, null, metric);
  }
});

test("numbers are said in words for the free voices only", () => {
  assert.equal(enWords(6236), "six thousand two hundred and thirty-six");
  assert.equal(enWords(114), "one hundred and fourteen");
  assert.equal(faWords(6236), "شش هزار و دویست و سی و شش");
  assert.equal(faWords(1000), "هزار");
  assert.equal(faWords(114), "صد و چهارده");
  assert.equal(spoken("X has 114 Y and 6,236 Z.", "en"), "X has one hundred and fourteen Y and six thousand two hundred and thirty-six Z.");
  assert.equal(spoken("الف ۱۱۴ ب ۶٬۲۳۶ ج", "fa"), "الف صد و چهارده ب شش هزار و دویست و سی و شش ج");
});

/** A tiny Tanzil-shaped metadata file: three surahs, numbers only. */
const XML = [
  '<quran type="metadata">',
  '<suras alias="chapters">',
  '<sura index="1" ayas="7" start="0" name="N1" tname="T-One" ename="E1" type="Meccan" order="5" rukus="1"/>',
  '<sura index="2" ayas="10" start="7" name="N2" tname="T-Two" ename="E2" type="Medinan" order="87" rukus="2"/>',
  '<sura index="3" ayas="7" start="17" name="N3" tname="T-Three" ename="E3" type="Meccan" order="1" rukus="1"/>',
  "</suras>",
  '<juzs alias="parts"><juz index="1" sura="1" aya="1"/><juz index="2" sura="2" aya="6"/></juzs>',
  '<rukus alias="sections"><ruku index="1" sura="1" aya="1"/><ruku index="2" sura="2" aya="1"/><ruku index="3" sura="2" aya="6"/><ruku index="4" sura="3" aya="1"/></rukus>',
  '<pages><page index="1" sura="1" aya="1"/><page index="2" sura="2" aya="1"/><page index="3" sura="2" aya="8"/><page index="4" sura="3" aya="1"/></pages>',
  '<sajdas><sajda index="1" sura="2" aya="9" type="recommended"/><sajda index="2" sura="3" aya="7" type="obligatory"/></sajdas>',
  "</quran>",
].join("\n");

test("the numbers are counted from the metadata as the service counts them", () => {
  const meta = parseTanzil(XML);
  const index = {
    surahs: [
      { surahNumber: 1, ayahCount: 7, nameArabic: "N1", revelationPlace: "meccan", revelationOrder: 5 },
      { surahNumber: 2, ayahCount: 10, nameArabic: "N2", revelationPlace: "medinan", revelationOrder: 87 },
      { surahNumber: 3, ayahCount: 7, nameArabic: "N3", revelationPlace: "meccan", revelationOrder: 1 },
    ],
    surahMetadataSource: { sha256: meta.sha256 },
  };
  crossCheck(meta, index);
  assert.throws(() => crossCheck(meta, { ...index, surahMetadataSource: { sha256: "f".repeat(64) } }), /SHA-256/);
  assert.deepEqual(countNumbers(index, meta, "overview"), { surahs: 3, ayahs: 24, meccanSurahs: 2, meccanAyahs: 14, medinanSurahs: 1, medinanAyahs: 10, longestAyahs: 10, longest: [2], shortestAyahs: 7, shortest: [1, 3] });
  assert.deepEqual(countNumbers(index, meta, "revelation-order"), { first: 3, last: 2, openingOrder: 5, firstMedinan: 2, firstMedinanOrder: 87 });
  assert.deepEqual(countNumbers(index, meta, "prostrations"), { places: 2, obligatory: 1, refs: "2:9, 3:7", obligatoryRefs: "3:7" });
  assert.deepEqual(countNumbers(index, meta, "divisions"), { juz: 2, rukus: 4, pages: 4, surahs: 3 });
  assert.equal(juzOf(meta, 2, 5), 1);
  assert.equal(juzOf(meta, 2, 6), 2);
  assert.equal(pageOf(meta, 2, 10), 3);
  assert.deepEqual(cardNumbers(index, meta, 2), { surah: 2, ayahCount: 10, order: 87, rukus: 2, juz: [1, 2], pages: [2, 3] });
});

test("the manifest carries keys, hashes and numbers, and says what read and who recited", () => {
  const props = {
    kind: "verse",
    ayahs: [ayah(1)],
    source: { quran: { releaseKey: "tq" }, translation: { release: { releaseKey: "tr" } }, surahMetadata: { sha256: "m" } },
    facts: { surah: 112, from: 1, to: 1 },
  };
  const m = manifestOf(props, { engine: "kokoro", voice: "kokoro-82m:x:0.9", lines: [{ id: "a1" }] }, { recitationId: 7, reciter: { name: "Reciter Placeholder" }, source: "quran-com-public", previewOnly: true }, 41.234);
  assert.deepEqual(m, {
    seconds: 41.23,
    voice: { engine: "kokoro", voice: "kokoro-82m:x:0.9" },
    recitation: { recitationId: 7, reciterName: "Reciter Placeholder", source: "quran-com-public", previewOnly: true },
    source: { quran: { releaseKey: "tq" }, translation: { releaseKey: "tr" }, metadataSha256: "m" },
    ayahs: [{ locator: "112:1", textHashSha256: "0".repeat(64) }],
    facts: { surah: 112, from: 1, to: 1 },
  });
  assert.doesNotMatch(JSON.stringify(m), /PLACEHOLDER-1/);
  assert.equal(manifestOf({ ...props, kind: "counts", ayahs: [] }, { engine: "piper", voice: null, lines: [] }, null, 20).voice.engine, "none");
});
