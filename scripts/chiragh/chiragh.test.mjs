// «چراغ» on made-up material (placeholder words only; no text of the Quran here).
import assert from "node:assert/strict";
import { test } from "node:test";
import { ART, star } from "../../src/chiragh/art.ts";
import { drawProgress, likeness, litAmount } from "../../src/chiragh/storyboard.ts";
import { refine } from "./align-refine.mjs";
import { ruleConcepts, validConcept } from "./concept.mjs";
import { dataArt } from "./data-art.mjs";
import { checkStoryboard, chunkTranslation, chunkVerse, direct } from "./director.mjs";
import { templateOf } from "./material.mjs";
import { rank, ruleBreaks } from "./pick.mjs";
import { stillness } from "./qa.mjs";

const words = (n, from, step = 0.6) => Array.from({ length: n }, (_, k) => ({ start: from + k * step, end: from + k * step + step * 0.9 }));
const text = (n, tag = "w") => Array.from({ length: n }, (_, k) => `${tag}${k + 1}`).join(" ");

function material({ template = "verse-by-verse", ayahs = 3, perAyah = 7, narr = true } = {}) {
  const verses = [];
  const lines = [];
  const order = [];
  for (let a = 1; a <= ayahs; a++) {
    const id = `a${a}`;
    verses.push({ id, ayah: a, surah: 999, key: `999:${a}`, text: text(perAyah, `v${a}x`), translation: text(9, `t${a}x`), refLine: `ref ${a}`, seal: String(a), clip: { file: `qari/x/q-${a}.wav`, seconds: perAyah * 0.6 + 0.3, mode: "word", words: words(perAyah, 0.1) } });
    order.push({ kind: "qari", verse: id });
    if (narr) {
      lines.push({ id, text: text(9, `t${a}x`), say: text(9, `t${a}x`), file: `voice/x/n-${id}.wav`, seconds: 3.2, words: null, verse: id });
      order.push({ kind: "narr", line: id });
    }
  }
  return { id: "test-1", template, lang: "en", title: { main: "Placeholder", sub: "Verse by verse" }, hooks: ["Placeholder"], verses, lines, order, data: null, credits: "Sources", families: ["key-word", "question-verse", "night-and-day"], anchorFixed: null };
}

test("the library draws no figure and no hexagram, and every group and region is named", () => {
  assert.throws(() => star(0, 0, 10, 0.5, 6));
  for (const a of Object.values(ART)) {
    assert.equal(a.figures, false, a.id);
    assert.ok(a.groups.length >= 3, a.id);
    assert.ok(a.regions.some((r) => r.id === "whole"), a.id);
    for (const g of a.groups) for (const d of g.paths) assert.ok(/^M/.test(d) && !/NaN/.test(d), `${a.id}/${g.id}`);
  }
});

test("a verse cut in pieces gives its stored text back exactly", () => {
  const t = `${text(23)} ۞ w24`;
  const times = Array.from({ length: 24 }, (_, k) => ({ start: k, end: k + 0.9 }));
  const chunks = chunkVerse(t, times, 9);
  assert.equal(chunks.map((c) => c.text).join(""), t);
  assert.ok(chunks.every((c) => c.words.length <= 9));
  const long = `${text(40, "s")}. ${text(30, "u")}. ${text(5, "z")}.`;
  assert.equal(chunkTranslation(long, 30).join(""), long);
});

test("every shot lasts 1–2.5 s, starts on a word, and the shots fill the video", () => {
  const m = material();
  const c = ruleConcepts(m, [])[0];
  assert.ok(validConcept(c, m).ok);
  const sb = direct(m, c, { videoId: "t" });
  assert.deepEqual(checkStoryboard(sb), []);
  for (const s of sb.shots) {
    assert.ok(s.dur >= 1 - 1e-6 && s.dur <= 2.5 + 1e-6, `shot ${s.n} ${s.dur}`);
    assert.equal(s.sound.music, null);
  }
  const locked = sb.shots.filter((s, i) => i > 0 && s.at_word.track !== "none" && !s.at_word.after).length;
  assert.ok(locked / (sb.shots.length - 1) > 0.8, `locked ${locked}/${sb.shots.length - 1}`);
  // the key word starts a shot
  if (sb.concept.key_word) assert.ok(sb.shots.some((s) => s.text.keyword), "the key word has its shot");
  // every group of the anchor is drawn before the close
  const p = drawProgress(sb, sb.total - 1.0);
  for (const g of ART[sb.anchor.art].groups) assert.equal(p[g.id], 1, g.id);
  // the narrator never speaks over the qari
  const s = [...sb.sounds].sort((a, b) => a.at - b.at);
  for (let i = 1; i < s.length; i++) assert.ok(s[i].at >= s[i - 1].at + s[i - 1].seconds - 1e-6);
});

test("the word light is half-way on the word's first sound", () => {
  assert.ok(Math.abs(litAmount({ start: 2, end: 2.5 }, 2) - 0.5) < 1e-9);
  assert.equal(litAmount({ start: 2, end: 2.5 }, 1.9), 0);
});

test("code picks the concept least like the recent videos and keeps the repeat rules", () => {
  const m = material();
  const cs = ruleConcepts(m, []);
  const first = rank(m, cs, [])[0];
  const recent = [first.fp, first.fp];
  const again = rank(m, cs, recent);
  assert.notEqual(again[0].c.anchor.art, first.c.anchor.art);
  assert.ok(ruleBreaks(first.fp, recent).length > 0);
  assert.equal(likeness(first.fp, first.fp), 1);
});

test("the seven templates", () => {
  assert.equal(templateOf({ kind: "verse" }), "verse-by-verse");
  assert.equal(templateOf({ kind: "verse", night: { id: "x" } }), "night-verse");
  assert.equal(templateOf({ kind: "insight", format: "word-choice" }), "word-choice");
  assert.equal(templateOf({ kind: "insight", format: "one-line" }), "distances");
  assert.equal(templateOf({ kind: "insight", format: "only" }), "only-counts");
  assert.equal(templateOf({ kind: "waiting", format: "writing" }), "writing");
  assert.equal(templateOf({ kind: "path" }), "path");
  assert.equal(templateOf({ kind: "counts" }), null);
  for (const [t, props] of [
    ["distances", { lang: "fa", data: { verses: 78, places: [13, 16, 18, 21] }, numbers: { times: 4 } }],
    ["only-counts", { lang: "en", data: { lit: Array.from({ length: 114 }, (_, i) => i % 3 === 0), focus: 55 }, numbers: { without: 29 } }],
    ["word-choice", { lang: "fa", data: { root: [0x633, 0x643, 0x646], refs: ["30:21", "10:67"], absentLetters: [0x639, 0x634, 0x642] }, numbers: { absent: 0 } }],
    ["path", { lang: "fa", places: [{ name: "a", lat: 21.4, lon: 39.8, source: "s" }, { name: "b", lat: 24.5, lon: 39.6, source: "s" }] }],
  ]) {
    const a = dataArt(t, props);
    assert.equal(a.figures, false);
    for (const g of a.groups) for (const d of g.paths) assert.ok(!/NaN/.test(d), `${t}/${g.id}`);
  }
});

test("word starts move onto the dip in the sound, and only there", () => {
  // loud words of 0.5 s with a 60 ms dip at 0.53 s (the segment said 0.5 s)
  const env = Array.from({ length: 120 }, (_, i) => (i >= 53 && i < 59 ? 30 : 1000));
  const r = refine([{ start: 0, end: 0.5 }, { start: 0.5, end: 1.1 }], { env, stepMs: 10 });
  assert.ok(Math.abs(r.words[1].start - 0.58) < 0.03, String(r.words[1].start));
  const flat = refine([{ start: 0, end: 0.5 }, { start: 0.5, end: 1.1 }], { env: Array(120).fill(1000), stepMs: 10 });
  assert.equal(flat.words[1].start, 0.5);
});

test("a picture that does not change for 3 s is found", () => {
  const frame = (v) => Buffer.alloc(100, v);
  const frames = [...Array(10).fill(0).map((_, i) => frame(i * 20)), ...Array(30).fill(0).map(() => frame(200)), ...Array(10).fill(0).map((_, i) => frame(i * 20))];
  const s = stillness(frames, 10);
  assert.ok(s.longest >= 2.9 && s.longest <= 3.6, String(s.longest));
});

test("a verse read by the narrator (no recitation) is shown piece by piece across the reading", () => {
  const m = material({ ayahs: 1, perAyah: 25 });
  m.verses[0].clip = null;
  m.verses[0].readBy = "a1";
  m.order = [{ kind: "narr", line: "a1" }];
  m.lines[0].seconds = 12;
  const sb = direct(m, ruleConcepts(m, [])[0], { videoId: "t" });
  const v = sb.verses[0];
  assert.equal(v.mode, "verse");
  assert.ok(v.chunks.length >= 3);
  for (const c of v.chunks) assert.ok(c.to - c.from > 2, `piece ${c.from}-${c.to}`);
});
