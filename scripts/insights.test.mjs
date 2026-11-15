// node --experimental-strip-types --test scripts/insights.test.mjs
// Placeholders only: the "verses" here are made-up strings of alphabet letters (no text of the
// Quran or of a translation), built from code points so that nothing sacred is typed.
import assert from "node:assert/strict";
import test from "node:test";
import { INSIGHTS, insightIds } from "./episodes.mjs";
import { ALPHABET, findForm, firstLetterWords, formWords, letterCount, lettersInRow, middleFacts, model, plain, repeatFacts, variants, wordsOf } from "./insights.mjs";
import { NIGHT_SERIES, NIGHT_THEMES } from "../src/night.ts";
import { wordsOf as screenWords } from "../src/lamp/zones.ts";
import { verseTimeline } from "../src/timelines.ts";
import { safeFrame } from "../src/layout.ts";
import { insightTimeline, speakerWindows } from "../src/timelines.ts";

const L = (...codes) => String.fromCodePoint(...codes);
// made-up words of alphabet letters
const A = L(0x627, 0x628, 0x62a); // three letters
const B = L(0x62c, 0x62d); // two letters
const Cw = L(0x633, 0x634, 0x635, 0x636); // four letters
const FATHA = L(0x64e);
const WA = L(0x648);
const OPEN = `${A} ${B}`; // the made-up "1:1"

/** A tiny fake release: three surahs, the first verse of 2 and 3 carrying the made-up opening. */
function fake() {
  const index = { surahs: [1, 2, 3].map((n) => ({ surahNumber: n, ayahCount: n === 1 ? 2 : 3, revelationPlace: n === 3 ? "medinan" : "meccan", revelationOrder: [2, 1, 3][n - 1], nameArabic: `s${n}` })) };
  const meta = { pages: [{ index: 1, sura: 1, aya: 1 }, { index: 2, sura: 2, aya: 1 }, { index: 3, sura: 3, aya: 2 }], juzs: [{ index: 1, sura: 1, aya: 1 }, { index: 2, sura: 3, aya: 1 }], suras: [1, 2, 3].map((n) => ({ tname: `t${n}` })) };
  const text = {
    surahs: [
      { n: 1, ayahs: [{ n: 1, text: OPEN }, { n: 2, text: `${Cw}${FATHA} ${A}` }] },
      { n: 2, ayahs: [{ n: 1, text: `${OPEN} ${Cw} ${WA}${A}` }, { n: 2, text: `${B} ${Cw}` }, { n: 3, text: `${B} ${Cw}` }] },
      { n: 3, ayahs: [{ n: 1, text: `${OPEN} ${B}` }, { n: 2, text: `${Cw} ${OPEN} ${Cw}` }, { n: 3, text: `${B} ${Cw}` }] },
    ],
  };
  return { index, meta, m: model(index, meta, text) };
}

test("plain drops the marks; letters and words follow the rules", () => {
  assert.equal(plain(`${Cw}${FATHA}`), Cw);
  assert.equal(letterCount(`${Cw}${FATHA} ${A}`), 7);
  assert.equal(wordsOf(`${A} ${L(0x6d6)} ${B}`).length, 2); // a lone pause mark is no word
});

test("the opening line is set apart from verse 1, as Siraj's reader does", () => {
  const { m } = fake();
  const v = m.at(2, 1);
  assert.equal(v.basmala + v.body, v.text);
  assert.equal(v.words.length, 2);
  assert.equal(m.at(1, 1).basmala, null); // surah 1: the opening IS verse 1
});

test("forms are locators; prefixes only when asked", () => {
  const { m } = fake();
  assert.deepEqual(formWords(m, { verse: "1:1", from: 0, to: 0 }).plain, [A]);
  assert.ok(variants(A).has(WA + A));
  const bare = findForm(m, { verse: "1:1", from: 0, to: 0 }).hits.length;
  const withPrefix = findForm(m, { verse: "1:1", from: 0, to: 0, prefixes: true }).hits.length;
  assert.equal(withPrefix, bare + 1); // the wa- form in 2:1
  // the whole made-up opening inside a verse body (3:2), and as 1:1 itself
  const inside = findForm(m, { verse: "1:1" }).hits.map((h) => `${h.s}:${h.a}`);
  assert.deepEqual(inside, ["1:1", "3:2"]);
});

test("repeats are exact equality of the stored verses", () => {
  const { m } = fake();
  assert.deepEqual(repeatFacts(m, 2), { surah: 2, verses: 3, times: 2, places: [2, 3], first: 2, last: 3, gaps: { one: 0, two: 0, more: 0 }, lead: 1 });
});

test("one line: the distances between repeats are counted in verses between them", () => {
  // a made-up surah of 9 verses whose line stands at 2, 4, 7 and 8
  const R = `${B} ${Cw}`;
  const ayahs = Array.from({ length: 9 }, (_, i) => ({ n: i + 1, text: [2, 4, 7, 8].includes(i + 1) ? R : `${A} ${L(0x641 + i)}` }));
  const index = { surahs: [{ surahNumber: 1, ayahCount: 9, revelationPlace: "meccan", revelationOrder: 1, nameArabic: "s1" }] };
  const meta = { pages: [{ index: 1, sura: 1, aya: 1 }], juzs: [{ index: 1, sura: 1, aya: 1 }], suras: [{ tname: "t1" }] };
  const m = model(index, meta, { surahs: [{ n: 1, ayahs }] });
  const f = repeatFacts(m, 1);
  assert.deepEqual(f.places, [2, 4, 7, 8]);
  assert.deepEqual(f.gaps, { one: 1, two: 1, more: 0 }); // 4−2−1 = 1, 7−4−1 = 2, 8−7−1 = 0 (side by side: none of the three)
  assert.equal(f.lead, 1);
});

test("letters in a row: inside any word, marks ignored; a zero when no word holds them", () => {
  const { m } = fake();
  // ت ج ح never stand in a row in the fake text; ب ت (inside A) do
  assert.equal(lettersInRow(m, [0x62a, 0x62c, 0x62d]).words, 0);
  const bt = lettersInRow(m, [0x628, 0x62a]);
  assert.ok(bt.words > 0 && bt.verses > 0 && bt.surahs.length > 0);
});

test("word-choice is approve-each and Persian only; its scenes recite the ayah twice", () => {
  const def = INSIGHTS["word-choice"];
  assert.equal(def.approveEach, true);
  assert.deepEqual(def.episodes.sakan.langs, ["fa"]);
  assert.deepEqual(def.scenes.map((x) => x.id).filter((id) => id === "recite" || id === "again"), ["recite", "again"]);
  const voice = { engine: "elevenlabs", voice: "x", lines: [] };
  const qari = { basmala: null, verses: [{ id: "q1", ayah: 21, file: "q.wav", seconds: 5 }] };
  const t = insightTimeline({ scenes: def.scenes, narration: [], voice, qari, loop: true });
  assert.equal(t.speakers.filter((x) => x.kind === "qari").length, 2);
  assert.equal(speakerWindows(t.speakers).overlap, null);
});

test("tonight's verse: short titles, mercy only, one second after the qari, no narrator", () => {
  const ids = new Set();
  for (const th of NIGHT_THEMES) {
    assert.ok(!ids.has(th.id), th.id);
    ids.add(th.id);
    assert.ok(th.from >= 1 && th.to >= th.from && th.to - th.from <= 1, th.id);
    for (const lang of ["fa", "en"]) assert.ok(screenWords(th.title[lang]).length + screenWords(NIGHT_SERIES[lang]).length <= 7, `${th.id} ${lang}: 7 framing words at most`);
  }
  const ayahs = [{ ayahNumber: 28, text: `${A} ${B}`, translation: "x".repeat(200), locator: "", textHashSha256: "" }];
  const qari = { source: "quran-com-public", previewOnly: true, recitationId: 7, reciter: { name: "r", style: null, qirat: null }, basmala: null, verses: [{ id: "q", ayah: 28, file: "q.wav", seconds: 6, mode: "word", words: [], sirajWords: 2, qfWords: 2, verseKey: "13:28" }], fallbacks: [] };
  const night = verseTimeline({ ayahs, qari, voice: { engine: "none", voice: null, lines: [] }, style: { lamp: true }, night: NIGHT_THEMES[0] });
  const plainT = verseTimeline({ ayahs, qari, voice: { engine: "none", voice: null, lines: [] }, style: { lamp: true } });
  const c = night.cards[0];
  assert.ok(c.narrEnd - c.qariEnd <= 40, `about a second after the qari (${c.narrEnd - c.qariEnd} frames)`);
  assert.ok(night.total < plainT.total);
  assert.equal(night.speakers.filter((x) => x.kind === "narrator").length, 0);
});

test("the middle by verses, words and letters", () => {
  const { m } = fake();
  const f = middleFacts(m);
  assert.equal(f.verses, 8);
  assert.deepEqual(f.byVerse.verses, ["2:2", "2:3"]);
  assert.equal(f.words, m.verses.reduce((k, v) => k + v.words.length, 0));
  assert.ok(f.byWord.verse && f.byLetter.verse);
});

test("every letter: the word where each letter first stands", () => {
  const fw = firstLetterWords(`${A} ${B}`);
  assert.equal(fw.length, ALPHABET.length);
  assert.equal(fw[0], 0); // alif in the first word
  assert.equal(fw[ALPHABET.indexOf(0x62c)], 1);
  assert.equal(fw[ALPHABET.indexOf(0x63a)], -1); // not there
});

test("every episode's sentences have their place in the scenes", () => {
  for (const [format, def] of Object.entries(INSIGHTS)) {
    const ids = new Set(insightIds(format));
    assert.ok(def.scenes.length >= 2, format);
    for (const ep of Object.keys(def.episodes)) assert.ok(def.episodes[ep].lines, `${format}/${ep}`);
    assert.ok(ids.size >= 1, format);
  }
});

test("insight timeline: narrator lines and the qari never overlap; the loop adds its frames", () => {
  const voice = { engine: "elevenlabs", voice: "x", lines: [{ id: "hook", file: "a.wav", seconds: 3 }, { id: "end", file: "b.wav", seconds: 2 }] };
  const narration = [{ id: "hook", show: "h", say: "h" }, { id: "end", show: "e", say: "e" }];
  const qari = { basmala: null, verses: [{ id: "q1", ayah: 1, file: "q.wav", seconds: 4 }, { id: "q2", ayah: 2, file: "q2.wav", seconds: 2 }] };
  const scenes = [{ id: "hook", lines: ["hook"], min: 30 }, { id: "recite", lines: [], min: 30 }, { id: "end", lines: ["end"], min: 30 }];
  const t = insightTimeline({ scenes, narration, voice, qari, loop: true });
  assert.equal(t.speakers.length, 4);
  assert.equal(speakerWindows(t.speakers).overlap, null);
  assert.ok(t.scenes[0].lines[0].from < 30); // the hook is heard in the first second
  assert.equal(t.total, t.scenes.at(-1).from + t.scenes.at(-1).dur + t.loopFrames);
  assert.ok(t.loopFrames > 0);
});

test("every text block of an insight video sits inside the 4:5 crop", () => {
  assert.equal(safeFrame(), true);
  assert.equal(safeFrame([[100, 400]]), false);
});
