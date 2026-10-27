// The counting of the insight templates (S3b): pure functions over Siraj's surah index, the
// hash-checked Tanzil metadata and the whole Tanzil Simple text, all read at render time. The
// service counts with a copy of this file (service/src/content/insightCore.ts), so that the
// manifest's facts can be compared number for number. Nothing here holds or prints a text:
// search forms are LOCATORS (a verse and a word span of it), never typed words, and every
// result is numbers, locators and spans of the stored text.
//
// The rules (research/viral-insights.md §3; printed on screen as each video's «rule box»):
//   R1 verses   Tanzil metadata, Kufan count.
//   R2 text     Tanzil Simple via Siraj. For matching, the marks are removed (\p{M} and the
//               tatweel), أ إ آ ٱ → ا and ى → ي. The Basmala stored at the head of verse 1 of
//               surahs 2–114 (not 9) is not part of the verse, as in Siraj's reader.
//   R3 word     a whitespace token of that text with at least one Arabic letter.
//   R4 letter   an Arabic letter character (U+0621–U+063A, U+0641–U+064A) after R2's marks go.
//   R5 form     the exact written form (R2), alone or with attached prefixes: wa-, fa-, the
//               interrogative a-, bi-, ka-, ta-, li- (lil- before the article). No suffixes.
//   R7 place    Tanzil's Meccan / Medinan label and revelation order.
//   R8 pages    the 604 pages, 30 parts and the places of prostration of the Tanzil metadata.

import { splitLeadingBasmala } from "../src/basmala.ts";

/* ---------- R2–R4 ---------- */

const MARKS = /[\p{M}ـ]/gu;
/** A token as matched: marks and the tatweel removed, hamza-seated alifs as ا, ى as ي. */
export const plain = (s) => s.replace(MARKS, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي");
const isLetterCode = (k) => (k >= 0x621 && k <= 0x63a) || (k >= 0x641 && k <= 0x64a);
/** R4: the letters of a string (marks never count). */
export const letterCount = (s) => {
  let n = 0;
  for (const c of s.replace(MARKS, "")) if (isLetterCode(c.codePointAt(0))) n++;
  return n;
};
/** R3: the words of a string, with their character offsets in it. */
export function wordsOf(s) {
  const out = [];
  for (const m of s.matchAll(/\S+/gu)) {
    if ([...m[0]].some((c) => isLetterCode(c.codePointAt(0)))) out.push({ at: m.index, end: m.index + m[0].length, raw: m[0], plain: plain(m[0]) });
  }
  return out;
}

/** The 28 letters of the alphabet, in their order, as code points (no text: numbers). */
export const ALPHABET = [0x627, 0x628, 0x62a, 0x62b, 0x62c, 0x62d, 0x62e, 0x62f, 0x630, 0x631, 0x632, 0x633, 0x634, 0x635, 0x636, 0x637, 0x638, 0x639, 0x63a, 0x641, 0x642, 0x643, 0x644, 0x645, 0x646, 0x647, 0x648, 0x64a];
/** For «every letter»: أ إ آ ٱ count as ا, ة as ت, ى as ي (hamza on و or ي and the lone hamza count as none). */
const asAlphabet = (k) => (k === 0x623 || k === 0x625 || k === 0x622 || k === 0x671 ? 0x627 : k === 0x629 ? 0x62a : k === 0x649 ? 0x64a : k);

/* ---------- The text ---------- */

/**
 * The text model: every verse of the release with its stored text, the Basmala line of verse 1
 * apart (R2), and its page and part. `text` is { surahs: [{ n, ayahs: [{ n, text, hash }] }] }.
 */
export function model(index, meta, text) {
  const opening = text.surahs[0]?.ayahs[0]?.text ?? null;
  const pages = meta.pages;
  const juzs = meta.juzs;
  const pos = (s, a) => s * 10_000 + a;
  let pi = 0;
  let ji = 0;
  const verses = [];
  for (const s of text.surahs) {
    const info = index.surahs[s.n - 1];
    for (const a of s.ayahs) {
      const split = splitLeadingBasmala(s.n, a.n, a.text, opening);
      const body = split ? split.rest : a.text;
      const p = pos(s.n, a.n);
      while (pi + 1 < pages.length && pos(pages[pi + 1].sura, pages[pi + 1].aya) <= p) pi++;
      while (ji + 1 < juzs.length && pos(juzs[ji + 1].sura, juzs[ji + 1].aya) <= p) ji++;
      verses.push({ s: s.n, a: a.n, text: a.text, body, basmala: split ? split.basmala : null, place: info.revelationPlace, page: pages[pi].index, juz: juzs[ji].index, words: wordsOf(body) });
    }
  }
  return { verses, opening, bySurah: (n) => verses.filter((v) => v.s === n), at: (s, a) => verses.find((v) => v.s === s && v.a === a) };
}

/* ---------- Search forms (locators, R5) ---------- */

/**
 * A search form is a locator into the stored text, never a typed word:
 *   { verse: "1:1", from: 1, to: 1 }   words 1..1 (0-based, R3 words) of that verse's body
 *   { verse: "1:1" }                    the whole body of the verse (all its words)
 * `prefixes: true` allows R5's attached prefixes on the first word.
 */
export function formWords(m, form) {
  const [s, a] = form.verse.split(":").map(Number);
  const v = m.at(s, a);
  if (!v) throw new Error(`form ${form.verse}: no such verse`);
  const from = form.from ?? 0;
  const to = form.to ?? v.words.length - 1;
  if (from < 0 || to >= v.words.length || to < from) throw new Error(`form ${form.verse}: words ${from}-${to} of ${v.words.length}`);
  return { verse: v, from, to, plain: v.words.slice(from, to + 1).map((w) => w.plain), text: v.body.slice(v.words[from].at, v.words[to].end) };
}

/** R5's written prefixes around a form (as plain strings). */
export function variants(base) {
  const out = new Set();
  for (const q of ["", "ا"])
    for (const c of ["", "و", "ف"])
      for (const p of ["", "ب", "ك", "ت", "ل"]) {
        const core = p === "ل" && base.startsWith("ال") ? `لل${base.slice(2)}`.replace(/^للل/, "لل") : p + base;
        out.add(q + c + core);
      }
  return out;
}

/** Every place where the form's words stand in a row in a verse body (R2/R3/R5). */
export function findForm(m, form) {
  const f = formWords(m, form);
  const first = form.prefixes ? variants(f.plain[0]) : new Set([f.plain[0]]);
  const rest = f.plain.slice(1);
  const hits = [];
  for (const v of m.verses) {
    for (let i = 0; i + rest.length < v.words.length; i++) {
      if (!first.has(v.words[i].plain)) continue;
      let ok = true;
      for (let k = 0; k < rest.length && ok; k++) ok = v.words[i + 1 + k].plain === rest[k];
      if (ok) hits.push({ s: v.s, a: v.a, word: i, page: v.page, juz: v.juz, place: v.place });
    }
  }
  return { form: f, hits };
}

/* ---------- Facts per template ---------- */

const ref = (v) => `${v.s}:${v.a}`;
const uniq = (xs) => [...new Set(xs)];

/** Counted · the Basmala (the whole of 1:1): the surah openings (R2's lines) and the verses that hold it. */
export function basmalaFacts(m) {
  const want = wordsOf(m.opening).map((w) => w.plain).join(" ");
  const openings = m.verses.filter((v) => v.a === 1 && (v.s === 1 || (v.basmala && wordsOf(v.basmala).map((w) => w.plain).join(" ") === want))).map((v) => v.s);
  const inside = findForm(m, { verse: "1:1" }).hits.filter((h) => !(h.s === 1 && h.a === 1));
  const without = [];
  for (let n = 1; n <= 114; n++) if (!openings.includes(n)) without.push(n);
  return { total: openings.length + inside.length, openings: openings.length, insideRefs: inside.map((h) => `${h.s}:${h.a}`), without, surahsLit: uniq([...openings, ...inside.map((h) => h.s)]), twice: uniq(inside.map((h) => h.s)).filter((n) => openings.includes(n)) };
}

/** Counted / Mushaf Map · a form: occurrences, verses, surahs, pages and the Meccan / Medinan split. */
export function formFacts(m, form) {
  const { form: f, hits } = findForm(m, form);
  return {
    occurrences: hits.length,
    verses: uniq(hits.map((h) => `${h.s}:${h.a}`)).length,
    surahs: uniq(hits.map((h) => h.s)),
    pages: uniq(hits.map((h) => h.page)),
    meccan: hits.filter((h) => h.place === "meccan").length,
    medinan: hits.filter((h) => h.place === "medinan").length,
    first: hits.length ? `${hits[0].s}:${hits[0].a}` : null,
    last: hits.length ? `${hits[hits.length - 1].s}:${hits[hits.length - 1].a}` : null,
    perSurah: Object.fromEntries(uniq(hits.map((h) => h.s)).map((n) => [n, hits.filter((h) => h.s === n).length])),
    words: f.to - f.from + 1,
    source: form.verse,
  };
}

/** Names that close verses: the verses whose last `last` words (R2) are those of the form's verse. */
export function endingFacts(m, form) {
  const [s, a] = form.verse.split(":").map(Number);
  const v = m.at(s, a);
  if (!v || v.words.length < form.last) throw new Error(`ending ${form.verse}: no such verse or too short`);
  const key = v.words.slice(-form.last).map((w) => w.plain).join(" ");
  const hits = m.verses.filter((x) => x.words.length >= form.last && x.words.slice(-form.last).map((w) => w.plain).join(" ") === key);
  return {
    verses: hits.length,
    surahs: uniq(hits.map((h) => h.s)),
    perSurah: Array.from({ length: 114 }, (_, i) => hits.filter((h) => h.s === i + 1).length),
    first: hits.length ? ref(hits[0]) : null,
    text: v.body.slice(v.words[v.words.length - form.last].at, v.words[v.words.length - 1].end),
  };
}

/** The Only… · a name: surahs where no verse body holds it, and surahs where every verse does. */
export function nameFacts(m, form) {
  const { hits } = findForm(m, { ...form, prefixes: true });
  const versesWith = new Set(hits.map((h) => `${h.s}:${h.a}`));
  const per = [];
  for (let n = 1; n <= 114; n++) {
    const vs = m.bySurah(n);
    per.push({ n, verses: vs.length, with: vs.filter((v) => versesWith.has(ref(v))).length });
  }
  const without = per.filter((x) => x.with === 0).map((x) => x.n);
  const every = per.filter((x) => x.with === x.verses).map((x) => x.n);
  const closest = per.filter((x) => x.with < x.verses).sort((a, b) => b.with / b.verses - a.with / a.verses || b.with - a.with)[0];
  return { occurrences: hits.length, without, every, closest: closest ? { surah: closest.n, with: closest.with, verses: closest.verses } : null, perSurah: per.map((x) => x.with) };
}

/** One Line N Times: the verse string repeated most often inside a surah (exact equality of stored strings). */
export function repeatFacts(m, surah) {
  const vs = m.bySurah(surah);
  const groups = new Map();
  for (const v of vs) groups.set(v.text, [...(groups.get(v.text) ?? []), v.a]);
  const best = [...groups.values()].sort((a, b) => b.length - a.length || a[0] - b[0])[0] ?? [];
  return { surah, verses: vs.length, times: best.length, places: best, first: best[0] ?? null, last: best[best.length - 1] ?? null };
}

/** The most repeated lines of all surahs, for choosing an episode (surah, times). */
export function repeatsAll(m) {
  const out = [];
  for (let n = 1; n <= 114; n++) {
    const r = repeatFacts(m, n);
    if (r.times > 1) out.push({ surah: n, times: r.times, first: r.first });
  }
  return out.sort((a, b) => b.times - a.times || a.surah - b.surah);
}

/** Every Letter: the verses whose body holds all 28 letters (أ إ آ ٱ as ا, ة as ت, ى as ي). */
export function everyLetterFacts(m) {
  const found = [];
  for (const v of m.verses) {
    const seen = new Set();
    for (const c of v.body.replace(MARKS, "")) seen.add(asAlphabet(c.codePointAt(0)));
    if (ALPHABET.every((k) => seen.has(k))) found.push(ref(v));
  }
  return { verses: found, letters: ALPHABET.length };
}

/**
 * For one verse body: the word (R3, 0-based) where each of the 28 letters first appears, so the
 * letters light as the qari reaches them. Word indexes follow src/words.ts (pieces with a letter).
 */
export function firstLetterWords(body) {
  const ws = wordsOf(body);
  return ALPHABET.map((k) => ws.findIndex((w) => [...w.raw.replace(MARKS, "")].some((c) => asAlphabet(c.codePointAt(0)) === k)));
}

/** The Middle: by verses (R1), by words (R3) and by letters (R4), and the page that holds each. */
export function middleFacts(m) {
  const vs = m.verses;
  const n = vs.length;
  const byVerse = n % 2 === 0 ? [ref(vs[n / 2 - 1]), ref(vs[n / 2])] : [ref(vs[(n - 1) / 2])];
  const words = vs.reduce((k, v) => k + v.words.length, 0);
  const letters = vs.reduce((k, v) => k + letterCount(v.body), 0);
  const find = (total, of) => {
    const half = Math.ceil(total / 2);
    let acc = 0;
    for (const v of vs) {
      const k = of(v);
      if (acc + k >= half) return { verse: ref(v), page: v.page, juz: v.juz, inVerse: half - acc, of: k, at: half };
      acc += k;
    }
    return null;
  };
  const mv = vs[Math.floor((n - 1) / 2)];
  return {
    verses: n,
    words,
    letters,
    byVerse: { verses: byVerse, page: mv.page, juz: mv.juz },
    byWord: find(words, (v) => v.words.length),
    byLetter: find(letters, (v) => letterCount(v.body)),
    pages: m.verses[m.verses.length - 1].page,
  };
}

/** The Only… · facts from the metadata and the text (no typed text: numbers and locators). */
export function onlyFacts(index, meta, m, fact) {
  const surahs = index.surahs;
  switch (fact) {
    case "no-basmala": {
      const b = basmalaFacts(m);
      return { without: b.without, twice: b.twice };
    }
    case "same-place":
      return { surahs: surahs.filter((s) => s.surahNumber === s.revelationOrder).map((s) => s.surahNumber) };
    case "longest-verse": {
      const sorted = [...m.verses].sort((a, b) => b.words.length - a.words.length);
      return { verse: ref(sorted[0]), words: sorted[0].words.length, letters: letterCount(sorted[0].body), next: ref(sorted[1]), nextWords: sorted[1].words.length };
    }
    case "shortest-surah": {
      const per = surahs.map((s) => ({ n: s.surahNumber, verses: s.ayahCount, words: m.bySurah(s.surahNumber).reduce((k, v) => k + v.words.length, 0) }));
      const min = Math.min(...per.map((x) => x.verses));
      const fewest = per.filter((x) => x.verses === min).sort((a, b) => a.words - b.words);
      return { verses: min, surahs: fewest.map((x) => x.n), words: fewest.map((x) => x.words) };
    }
    default:
      throw new Error(`the only: ${fact}`);
  }
}

/** Meccan · Medinan (R7): surahs and verses of each, and the digits of the longest surah's verse count. */
export function placeFacts(index) {
  const s = index.surahs;
  const by = (p) => s.filter((x) => x.revelationPlace === p);
  const longest = [...s].sort((a, b) => b.ayahCount - a.ayahCount)[0];
  const meccan = by("meccan").length;
  const medinan = by("medinan").length;
  const digits = String(longest.ayahCount);
  // the memory trick holds only when the digits really give both numbers (it is shown as a trick, never a sign)
  const trick = digits.length === 3 && digits.slice(1) === String(meccan) && digits.slice(0, 2) === String(medinan);
  return { surahs: s.length, meccan, medinan, meccanAyahs: by("meccan").reduce((k, x) => k + x.ayahCount, 0), medinanAyahs: by("medinan").reduce((k, x) => k + x.ayahCount, 0), longest: longest.surahNumber, longestAyahs: longest.ayahCount, trick };
}

/** Revelation order (R7): where each surah stands in Tanzil's list, and the surahs at the same place in both. */
export function orderFacts(index, focus) {
  const s = index.surahs;
  const byOrder = [...s].sort((a, b) => a.revelationOrder - b.revelationOrder).map((x) => x.surahNumber);
  return { first: byOrder.slice(0, 5), last: byOrder.slice(-5), focus, focusOrder: focus ? s[focus - 1].revelationOrder : null, samePlace: s.filter((x) => x.surahNumber === x.revelationOrder).map((x) => x.surahNumber) };
}

/**
 * Opening letters: the 29 surahs (a list of numbers, metadata) and their letters, read from the
 * text: the first word of verse 1's body, and for a surah whose first two verses are one word
 * each, both. Distinct letters and groups are counted from those words.
 */
export function openingFacts(m, list) {
  const groups = list.map((n) => {
    const v1 = m.at(n, 1);
    const v2 = m.at(n, 2);
    const words = [v1.words[0]];
    if (v1.words.length === 1 && v2?.words.length === 1) words.push(v2.words[0]);
    return { n, words: words.map((w) => w.plain), alone: v1.words.length === 1 };
  });
  const letters = new Set(groups.flatMap((g) => [...g.words.join("")].map((c) => c.codePointAt(0))));
  const combos = new Set(groups.map((g) => g.words.join(" ")));
  // the longest run of consecutive surah numbers whose first word is the same letters
  let run = { from: groups[0].n, to: groups[0].n, len: 1 };
  let cur = { ...run };
  for (let i = 1; i < groups.length; i++) {
    if (groups[i].n === groups[i - 1].n + 1 && groups[i].words[0] === groups[i - 1].words[0]) cur = { from: cur.from, to: groups[i].n, len: cur.len + 1 };
    else cur = { from: groups[i].n, to: groups[i].n, len: 1 };
    if (cur.len > run.len) run = { ...cur };
  }
  return { surahs: list.length, letters: letters.size, combinations: combos.size, aloneAsVerse: groups.filter((g) => g.alone).length, run: run.len > 1 ? [run.from, run.to] : null, groupOf: Object.fromEntries(groups.map((g) => [g.n, [...combos].indexOf(g.words.join(" "))])) };
}

/** The 29 surahs that open with the separate letters (a list of numbers: the metadata of this template). */
export const OPENING_LETTER_SURAHS = [2, 3, 7, 10, 11, 12, 13, 14, 15, 19, 20, 26, 27, 28, 29, 30, 31, 32, 36, 38, 40, 41, 42, 43, 44, 45, 46, 50, 68];
