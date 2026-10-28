// node --test scripts/reading.test.mjs
// The narrator's reading layer (S3d): numbers in words, spoken references, and the guard that no
// Persian `say` line of any episode holds a digit, a Latin letter, a colon, a semicolon or a
// bracket. Placeholders only: the numbers below are made up in the shape of the real counts and
// the surah name is a made-up word; no text of the Quran or of a translation.
import assert from "node:assert/strict";
import test from "node:test";
import { INSIGHTS, insightIds } from "./episodes.mjs";
import { enWords, faName, faNumberList, faOrdinal, faRef, faWords, readingProblems, spoken } from "./spoken.mjs";

test("faWords: 0, 1–20, tens, hundreds, thousands and millions", () => {
  assert.equal(faWords(0), "صفر");
  const oneToTwenty = ["یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده", "بیست"];
  oneToTwenty.forEach((w, i) => assert.equal(faWords(i + 1), w, `${i + 1}`));
  assert.deepEqual([30, 40, 50, 60, 70, 80, 90].map(faWords), ["سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"]);
  assert.equal(faWords(21), "بیست و یک");
  assert.equal(faWords(99), "نود و نه");
  assert.deepEqual([100, 200, 300, 400, 500, 600, 700, 800, 900].map(faWords), ["صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"]);
  assert.equal(faWords(114), "صد و چهارده");
  assert.equal(faWords(286), "دویست و هشتاد و شش");
  assert.equal(faWords(604), "ششصد و چهار");
  assert.equal(faWords(1000), "هزار");
  assert.equal(faWords(1001), "هزار و یک");
  assert.equal(faWords(1623), "هزار و ششصد و بیست و سه");
  assert.equal(faWords(2000), "دو هزار");
  assert.equal(faWords(2699), "دو هزار و ششصد و نود و نه");
  assert.equal(faWords(6236), "شش هزار و دویست و سی و شش");
  assert.equal(faWords(6666), "شش هزار و ششصد و شصت و شش");
  assert.equal(faWords(77797), "هفتاد و هفت هزار و هفتصد و نود و هفت");
  assert.equal(faWords(323671), "سیصد و بیست و سه هزار و ششصد و هفتاد و یک");
  assert.equal(faWords(1_000_000), "یک میلیون");
  assert.equal(faWords(2_500_000), "دو میلیون و پانصد هزار");
  assert.equal(faWords(1_234_567), "یک میلیون و دویست و سی و چهار هزار و پانصد و شصت و هفت");
  assert.throws(() => faWords(-1));
  assert.throws(() => faWords(1.5));
  assert.throws(() => faWords(1e9));
});

test("enWords reaches the millions", () => {
  assert.equal(enWords(6236), "six thousand two hundred and thirty-six");
  assert.equal(enWords(1_000_000), "one million");
  assert.equal(enWords(1_000_005), "one million and five");
  assert.equal(enWords(2_500_000), "two million five hundred thousand");
});

test("ordinals, lists and references are spoken", () => {
  assert.equal(faOrdinal(5), "پنجم");
  assert.equal(faOrdinal(5, { before: true }), "پنجمین");
  assert.equal(faOrdinal(3), "سوم");
  assert.equal(faOrdinal(30), "سی‌ام");
  assert.equal(faOrdinal(103, { before: true }), "صد و سومین");
  assert.equal(faOrdinal(1, { before: true }), "نخستین");
  assert.equal(faOrdinal(21), "بیست و یکم");
  assert.equal(faNumberList([1, 9, 112]), "یک، نه و صد و دوازده");
  assert.equal(faRef("55:1"), "سورهٔ پنجاه و پنج، آیهٔ یک");
  assert.equal(faRef("۵۵:۱"), "سورهٔ پنجاه و پنج، آیهٔ یک");
  assert.equal(faRef("۵۵:۱–۴"), "سورهٔ پنجاه و پنج، آیه‌های یک تا چهار");
  assert.equal(faName("ابجة"), "ابجه");
  assert.equal(spoken("در ۵۵:۱ و ۶٬۲۳۶ آیه", "fa"), "در سورهٔ پنجاه و پنج، آیهٔ یک و شش هزار و دویست و سی و شش آیه");
});

test("the guard sees digits of every script, Latin letters, colons, semicolons and brackets", () => {
  assert.deepEqual(readingProblems("یک جملهٔ پاک، با ویرگول."), []);
  assert.ok(readingProblems("۱۱۴ سوره").length);
  assert.ok(readingProblems("١١٤ سوره").length);
  assert.ok(readingProblems("114 سوره").length);
  assert.ok(readingProblems("متن Tanzil").length);
  assert.ok(readingProblems("نتیجه: نه").length);
  assert.ok(readingProblems("یک؛ دو").length);
  assert.ok(readingProblems("یک (دو)").length);
});

/* ---------- every Persian say line of every episode ---------- */

const NAME = String.fromCodePoint(0x627, 0x644, 0x633, 0x648, 0x631, 0x629); // a made-up name ending in ة
/** Made-up numbers in the shape of each episode's facts; a second set takes the other branches. */
const FIXTURES = {
  only: {
    "no-allah": [{ surah: 55, verses: 78, occurrences: 2699, without: 29 }],
    "allah-every-verse": [{ surah: 58, verses: 22, with: 22, closest: 7, closestWith: 12, closestVerses: 20 }],
    "longest-verse": [{ verse: "2:282", words: 128, next: "33:53", nextWords: 92 }],
  },
  "myth-fact": { "verses-6666": [{ claim: 6666, ayahs: 6236, surahs: 114, holds: false }] },
  "meccan-medinan": { "memory-286": [{ meccan: 86, medinan: 28, meccanAyahs: 4613, medinanAyahs: 1623, longest: 2, longestAyahs: 286 }] },
  counted: {
    basmala: [
      { total: 114, openings: 113, inside: ["27:30"], without: [9] },
      { total: 115, openings: 112, inside: ["27:30", "11:41"], without: [9, 1] },
    ],
  },
  "mushaf-map": {
    believers: [
      { occurrences: 89, pages: 80, totalPages: 604, surahs: 22, meccan: 0, medinan: 89, mankind: 20, mankindMeccan: 10, mankindMedinan: 10 },
      { occurrences: 89, pages: 80, totalPages: 604, surahs: 22, meccan: 3, medinan: 86, mankind: 20, mankindMeccan: 10, mankindMedinan: 10 },
    ],
  },
  middle: {
    three: [
      { verses: 6236, words: 77797, letters: 323671, byVerse: ["18:74", "18:75"], byWord: "18:74", wordAt: 38899, byLetter: "18:19", letterAt: 161836 },
      { verses: 6236, words: 77797, letters: 323671, byVerse: ["17:110", "18:1"], byWord: "18:74", wordAt: 38899, byLetter: "18:19", letterAt: 161836 },
    ],
  },
  "revelation-order": {
    "same-place": [{ same: [1, 9, 54, 112, 113], count: 5 }],
    "fatiha-fifth": [{ surah: 1, order: 5, first: [96, 68, 73, 74, 1, 111] }],
  },
  "one-line": { refrain: [{ surah: 55, verses: 78, times: 31, first: 13, last: 77 }] },
  "opening-letters": {
    group: [
      { surahs: 29, letters: 14, combinations: 14, alone: 10, surah: 19 },
      { surahs: 29, letters: 13, combinations: 14, alone: 10, surah: 19 },
    ],
  },
  "every-letter": {
    first: [
      { verses: ["3:154", "48:29"], letters: 28, verse: "3:154" },
      { verses: ["3:154", "48:29", "2:1"], letters: 28, verse: "3:154" },
    ],
  },
  names: {
    maryam: [{ name: "maryam", occurrences: 34, verses: 34, surahs: 12, refs: [] }],
    muhammad: [{ name: "muhammad", occurrences: 4, verses: 4, surahs: 4, refs: ["3:144", "33:40", "47:2", "48:29"] }],
  },
  "closing-names": { "ghafur-rahim": [{ pair: "ghafur-rahim", verses: 42, surahs: 20 }] },
  quiz: { "no-basmala": [{ answer: 9, options: [1, 9, 112] }] },
};

test("every Persian say line of every episode is plain spoken Persian", () => {
  let checked = 0;
  for (const [format, def] of Object.entries(INSIGHTS)) {
    const ids = new Set(insightIds(format));
    for (const [episode, ep] of Object.entries(def.episodes)) {
      const sets = FIXTURES[format]?.[episode];
      assert.ok(sets?.length, `a fixture for ${format}/${episode} (add one with the episode)`);
      for (const n of sets) {
        const fa = ep.lines("fa", n, { name: NAME, tname: "x" });
        const en = ep.lines("en", n, { name: NAME, tname: "x" });
        assert.deepEqual(fa.map((l) => l.id), en.map((l) => l.id), `${format}/${episode}: the same lines in both languages`);
        for (const l of fa) {
          assert.ok(ids.has(l.id), `${format}/${episode}/${l.id} has a place`);
          assert.deepEqual(readingProblems(l.say), [], `${format}/${episode}/${l.id}: ${readingProblems(l.say).join(", ")}`);
          assert.ok(!/روی صفحه است/.test(l.say), `${format}/${episode}/${l.id}: the source is named, not pointed at`);
          assert.ok(!/فراداده/.test(l.say), `${format}/${episode}/${l.id}: no bookish «فراداده»`);
          if (/تنزیل|تَنزیل/.test(l.say)) assert.ok(/تَنزیل/.test(l.say), `${format}/${episode}/${l.id}: «تَنزیل» with its fatha`);
          checked++;
        }
        for (const l of en) assert.ok(!/source is on screen/i.test(l.say), `${format}/${episode}/${l.id} (en): the source is named`);
      }
    }
  }
  assert.ok(checked > 60, `${checked} lines checked`);
});
