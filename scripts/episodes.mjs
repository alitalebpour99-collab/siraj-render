// The insight formats of S3b, episode by episode: what each one counts (with scripts/insights.mjs,
// at render time) and the FIXED sentences its narrator reads, filled with those numbers. No AI
// writes a word here; no sentence holds a text of the Quran (the forms are locators). The
// service plans with a copy of this file (service/src/content/episodes.ts): the facts become the
// job's `expect.numbers` and the sentences its `narration` (show on screen, say voiced). The
// renderer checks the job's numbers against its own count and draws from `data`.
//
// The research behind the list: siraj-social/research/viral-insights.md (top 12, §6); its
// approve-first ideas are marked `needsApproval` and are never planned by the clock.
import { OPENING_LETTER_SURAHS, basmalaFacts, everyLetterFacts, formFacts, middleFacts, nameFacts, onlyFacts, openingFacts, orderFacts, placeFacts, repeatFacts } from "./insights.mjs";

/* ---------- Forms (locators, never typed words; research R5) ---------- */

/** The search forms the episodes use: a verse and a word span of its body (0-based words). */
export const FORMS = {
  /** the name Allah: word 2 of 1:1 (exact form + R5 prefixes) */
  allah: { verse: "1:1", from: 1, to: 1, prefixes: true },
  /** the call to the believers: the first four words of 2:104 */
  believers: { verse: "2:104", from: 0, to: 3 },
  /** the call to mankind: the first three words of 2:21 */
  mankind: { verse: "2:21", from: 0, to: 2 },
};

/* ---------- Numbers in words of each language ---------- */

const FA = "۰۱۲۳۴۵۶۷۸۹";
const faDigits = (n) => String(n).replace(/\d/g, (d) => FA[Number(d)]);
const enN = (n) => new Intl.NumberFormat("en-US").format(n);
const faN = (n) => faDigits(n).replace(/(?<=[۰-۹])(?=([۰-۹]{3})+(?![۰-۹]))/g, "٬");
const N = (lang, n) => (lang === "fa" ? faN(n) : enN(n));
const list = (lang, xs) => {
  const s = xs.map((x) => (lang === "fa" ? faDigits(x) : String(x)));
  if (s.length < 2) return s.join("");
  return lang === "fa" ? `${s.slice(0, -1).join("، ")} و ${s[s.length - 1]}` : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
};
/** "27:30" on screen; voiced as "Surah 27, verse 30". */
const refShow = (lang, r) => (lang === "fa" ? r.split(":").map(faDigits).join(":") : r);
const refSay = (lang, r) => {
  const [s, a] = r.split(":");
  return lang === "fa" ? `سورهٔ ${faDigits(s)}، آیهٔ ${faDigits(a)}` : `Surah ${s}, verse ${a}`;
};
const line = (id, show, say = show) => ({ id, show, say });

/* ---------- The catalogue ---------- */

/**
 * Each format: its scenes (the ids of the narration each scene carries, in order; `recite` is the
 * qari's scene), its episodes, and for an episode the facts (numbers for `expect`, data for the
 * picture) and the sentences. `ctx` = { index, meta, m (the text model), lang }.
 */
export const INSIGHTS = {
  only: {
    series: { en: "The Only…", fa: "فقط یکی…" },
    scenes: [
      { id: "hook", lines: ["hook"], min: 75 },
      { id: "count", lines: ["count", "without"], min: 150 },
      { id: "recite", lines: [], min: 60 },
      { id: "end", lines: ["end"], min: 90 },
    ],
    episodes: {
      "no-allah": {
        surah: 55,
        recite: { surah: 55, from: 1, to: 4 },
        facts: ({ index, m }, ep) => {
          const f = nameFacts(m, FORMS.allah);
          if (!f.without.includes(ep.surah)) throw new Error(`no-allah: surah ${ep.surah} holds the name`);
          return { numbers: { surah: ep.surah, verses: index.surahs[ep.surah - 1].ayahCount, occurrences: f.occurrences, without: f.without.length }, data: { lit: f.perSurah.map((k) => k > 0), focus: ep.surah, without: f.without, form: FORMS.allah } };
        },
        lines: (lang, n, s) =>
          lang === "fa"
            ? [
                line("hook", `سورهٔ ${s.name}، ${N(lang, n.verses)} آیه؛ و حتی یک بار نام «الله» در آن نیامده است.`),
                line("count", `در کل قرآن این نام ${N(lang, n.occurrences)} بار آمده است؛ شمرده از متن تنزیل، بی بسم‌الله.`),
                line("without", `${N(lang, n.without)} سوره این نام را ندارند. این سوره با نامی دیگر آغاز می‌شود.`),
                line("end", "شمرده از متن تنزیل؛ قاعدهٔ شمارش روی صفحه است."),
              ]
            : [
                line("hook", `Surah ${s.tname} has ${N(lang, n.verses)} verses, and not one of them says the name Allah.`),
                line("count", `Across the Quran the name appears ${N(lang, n.occurrences)} times, counted in the Tanzil text without the Basmala.`),
                line("without", `In all, ${N(lang, n.without)} surahs never use it. This one opens with another Name.`),
                line("end", "Counted from the Tanzil text, with the rule on screen."),
              ],
      },
      "allah-every-verse": {
        surah: 58,
        facts: ({ index, m }, ep) => {
          const f = nameFacts(m, FORMS.allah);
          if (!(f.every.length === 1 && f.every[0] === ep.surah)) throw new Error(`allah-every-verse: the surahs are ${f.every.join(",")}`);
          const verses = index.surahs[ep.surah - 1].ayahCount;
          return { numbers: { surah: ep.surah, verses, with: verses, closest: f.closest.surah, closestWith: f.closest.with, closestVerses: f.closest.verses }, data: { lit: f.perSurah.map((k, i) => k === index.surahs[i].ayahCount), share: f.perSurah.map((k, i) => k / index.surahs[i].ayahCount), focus: ep.surah, form: FORMS.allah } };
        },
        lines: (lang, n, s) =>
          lang === "fa"
            ? [
                line("hook", "فقط یک سوره در همهٔ آیه‌هایش نام «الله» را دارد."),
                line("count", `سورهٔ ${faDigits(n.surah)}، ${s.name}: هر ${N(lang, n.verses)} آیه.`),
                line("without", `پس از آن سورهٔ ${faDigits(n.closest)} است: ${N(lang, n.closestWith)} آیه از ${N(lang, n.closestVerses)}.`),
                line("end", "شمرده از متن تنزیل؛ قاعدهٔ شمارش روی صفحه است."),
              ]
            : [
                line("hook", "Only one surah has the name Allah in every verse."),
                line("count", `Surah ${n.surah}, ${s.tname}: all ${N(lang, n.verses)} of its verses.`),
                line("without", `The next closest is Surah ${n.closest}, with ${N(lang, n.closestWith)} of ${N(lang, n.closestVerses)}.`),
                line("end", "Counted from the Tanzil text, with the rule on screen."),
              ],
      },
      "longest-verse": {
        facts: ({ index, meta, m }) => {
          const f = onlyFacts(index, meta, m, "longest-verse");
          const [s, a] = f.verse.split(":").map(Number);
          return { numbers: { verse: f.verse, words: f.words, next: f.next, nextWords: f.nextWords }, data: { focus: s, ayah: a } };
        },
        lines: (lang, n) =>
          lang === "fa"
            ? [
                line("hook", "بلندترین آیهٔ قرآن کدام است؟"),
                line("count", `آیهٔ ${refShow(lang, n.verse)}، با ${N(lang, n.words)} کلمه.`, `${refSay(lang, n.verse)}، با ${N(lang, n.words)} کلمه.`),
                line("without", `پس از آن ${refShow(lang, n.next)} است، با ${N(lang, n.nextWords)} کلمه.`, `پس از آن ${refSay(lang, n.next)} است، با ${N(lang, n.nextWords)} کلمه.`),
                line("end", "کلمه‌ها در متن تنزیل شمرده شده‌اند؛ قاعده روی صفحه است."),
              ]
            : [
                line("hook", "Which is the longest verse of the Quran?"),
                line("count", `Verse ${refShow(lang, n.verse)}, with ${N(lang, n.words)} words.`, `${refSay(lang, n.verse)}, with ${N(lang, n.words)} words.`),
                line("without", `The next is ${refShow(lang, n.next)}, with ${N(lang, n.nextWords)}.`, `The next is ${refSay(lang, n.next)}, with ${N(lang, n.nextWords)}.`),
                line("end", "Words counted in the Tanzil text, with the rule on screen."),
              ],
      },
    },
  },

  "myth-fact": {
    series: { en: "The Counts Test", fa: "آزمون شمارش" },
    scenes: [
      { id: "claim", lines: ["hook"], min: 75 },
      { id: "count", lines: ["count"], min: 120 },
      { id: "note", lines: ["note", "verdict"], min: 150 },
      { id: "end", lines: ["end"], min: 75 },
    ],
    episodes: {
      "verses-6666": {
        myth: "verses-6666",
        facts: ({ index }) => {
          const ayahs = index.surahs.reduce((k, s) => k + s.ayahCount, 0);
          return { numbers: { claim: 6666, ayahs, surahs: index.surahs.length, holds: ayahs === 6666 }, data: { claim: 6666 } };
        },
        lines: (lang, n) =>
          lang === "fa"
            ? [
                line("hook", `قرآن ${N(lang, n.claim)} آیه دارد؟ بیایید بشماریم.`),
                line("count", `به شمارش کوفی، که در متن تنزیل آمده: ${N(lang, n.ayahs)} آیه در ${N(lang, n.surahs)} سوره.`),
                line("note", `مکتب‌های قدیمی دیگرِ شمارش، چند آیه را جور دیگری جدا کرده‌اند؛ هیچ‌کدام به ${N(lang, n.claim)} نمی‌رسد.`),
                line("verdict", "نتیجه: این عدد درست نیست. متن یکی است؛ فقط جای جداشدن آیه‌ها فرق دارد."),
                line("end", "عدد از فرادادهٔ تنزیل؛ منبع روی صفحه است."),
              ]
            : [
                line("hook", `Does the Quran have ${N(lang, n.claim)} verses? Let's count.`),
                line("count", `By the Kufan count used in the Tanzil text: ${N(lang, n.ayahs)} verses in ${N(lang, n.surahs)} surahs.`),
                line("note", `The other old schools of counting divide a few verses differently, and none of them reaches ${N(lang, n.claim)}.`),
                line("verdict", "Verdict: the claim fails. The text is the same; only the verse breaks differ."),
                line("end", "The number comes from the Tanzil metadata; the source is on screen."),
              ],
      },
    },
  },

  "meccan-medinan": {
    scenes: [
      { id: "hook", lines: ["hook"], min: 75 },
      { id: "trick", lines: ["trick"], min: 105 },
      { id: "columns", lines: ["verses", "note"], min: 165 },
      { id: "end", lines: ["end"], min: 75 },
    ],
    episodes: {
      "memory-286": {
        facts: ({ index }) => {
          const f = placeFacts(index);
          if (!f.trick) throw new Error("the 286 memory trick does not hold for this metadata");
          return { numbers: { meccan: f.meccan, medinan: f.medinan, meccanAyahs: f.meccanAyahs, medinanAyahs: f.medinanAyahs, longest: f.longest, longestAyahs: f.longestAyahs }, data: { places: index.surahs.map((s) => s.revelationPlace), lengths: index.surahs.map((s) => s.ayahCount), focus: f.longest } };
        },
        lines: (lang, n, s) =>
          lang === "fa"
            ? [
                line("hook", `${N(lang, n.meccan)} سورهٔ مکی و ${N(lang, n.medinan)} سورهٔ مدنی؛ کافی است عدد ${N(lang, n.longestAyahs)} یادت بماند.`),
                line("trick", `سورهٔ ${s.name}، بلندترین سوره، ${N(lang, n.longestAyahs)} آیه دارد؛ رقم‌هایش هر دو عدد را با هم دارند.`),
                line("verses", `سوره‌های مکی ${N(lang, n.meccanAyahs)} آیه دارند و سوره‌های مدنی ${N(lang, n.medinanAyahs)} آیه.`),
                line("note", "این فقط ترفندی برای یادسپاری است، نه نشانه. برچسب‌ها از تنزیل است و دربارهٔ چند سوره نظرها فرق دارد."),
                line("end", "همهٔ عددها از فرادادهٔ تنزیل شمرده شده‌اند."),
              ]
            : [
                line("hook", `${N(lang, n.meccan)} Meccan surahs, ${N(lang, n.medinan)} Medinan. Just remember ${N(lang, n.longestAyahs)}.`),
                line("trick", `Surah ${s.tname}, the longest, has ${N(lang, n.longestAyahs)} verses. Its digits hold both numbers.`),
                line("verses", `The Meccan surahs hold ${N(lang, n.meccanAyahs)} verses; the Medinan surahs hold ${N(lang, n.medinanAyahs)}.`),
                line("note", "A memory trick, not a sign. The labels are Tanzil's; scholars differ on a few surahs."),
                line("end", "Every number here was counted from the Tanzil metadata."),
              ],
      },
    },
  },

  counted: {
    scenes: [
      { id: "hook", lines: ["hook"], min: 75 },
      { id: "strip", lines: ["where", "without"], min: 165 },
      { id: "recite", lines: [], min: 60 },
      { id: "end", lines: ["end"], min: 75 },
    ],
    episodes: {
      basmala: {
        recite: { surah: 27, from: 30, to: 30 },
        facts: ({ m }) => {
          const f = basmalaFacts(m);
          return { numbers: { total: f.total, openings: f.openings, inside: f.insideRefs, without: f.without }, data: { lit: Array.from({ length: 114 }, (_, i) => f.surahsLit.includes(i + 1)), twice: f.twice, without: f.without, inside: f.insideRefs } };
        },
        lines: (lang, n) => {
          const inside = n.inside;
          const one = inside.length === 1;
          return lang === "fa"
            ? [
                line("hook", `بسم‌الله را شمردیم: ${N(lang, n.total)} بار.`),
                line("where", `${N(lang, n.openings)} بار در آغاز سوره‌ها، و ${one ? "یک بار" : `${N(lang, inside.length)} بار`} درون آیه: ${inside.map((r) => refShow(lang, r)).join("، ")}.`, `${N(lang, n.openings)} بار در آغاز سوره‌ها، و ${one ? "یک بار" : `${N(lang, inside.length)} بار`} درون آیه: ${inside.map((r) => refSay(lang, r)).join("، ")}.`),
                line("without", `فقط سورهٔ ${list(lang, n.without)} بی بسم‌الله آغاز می‌شود.`),
                line("end", "شمرده از متن تنزیل؛ قاعدهٔ شمارش روی صفحه است."),
              ]
            : [
                line("hook", `The Basmala, counted: ${N(lang, n.total)} times.`),
                line("where", `${N(lang, n.openings)} times at the head of a surah, and ${one ? "once" : `${N(lang, inside.length)} times`} inside a verse: ${inside.map((r) => refShow(lang, r)).join(", ")}.`, `${N(lang, n.openings)} times at the head of a surah, and ${one ? "once" : `${N(lang, inside.length)} times`} inside a verse: ${inside.map((r) => refSay(lang, r)).join(", ")}.`),
                line("without", `Only Surah ${list(lang, n.without)} opens without it.`),
                line("end", "Counted from the Tanzil text, with the rule on screen."),
              ];
        },
      },
    },
  },

  "mushaf-map": {
    scenes: [
      { id: "hook", lines: ["hook"], min: 75 },
      { id: "map", lines: ["pages", "place"], min: 195 },
      { id: "end", lines: ["end"], min: 75 },
    ],
    episodes: {
      believers: {
        form: "believers",
        facts: ({ meta, m }) => {
          const f = formFacts(m, FORMS.believers);
          const g = formFacts(m, FORMS.mankind);
          return { numbers: { occurrences: f.occurrences, pages: f.pages.length, totalPages: meta.pages.length, surahs: f.surahs.length, meccan: f.meccan, medinan: f.medinan, mankind: g.occurrences, mankindMeccan: g.meccan, mankindMedinan: g.medinan }, data: { lit: f.pages, form: FORMS.believers } };
        },
        lines: (lang, n) => {
          const all = n.meccan === 0;
          return lang === "fa"
            ? [
                line("hook", `یک خطاب، ${N(lang, n.occurrences)} بار. ببینید روی کدام صفحه‌ها می‌نشیند.`),
                line("pages", `روی ${N(lang, n.pages)} صفحه از ${N(lang, n.totalPages)} صفحهٔ مصحف، در ${N(lang, n.surahs)} سوره.`),
                line("place", all ? "همه‌اش در سوره‌هایی است که تنزیل مدنی می‌داند؛ حتی یک بار در سوره‌ای مکی نیامده." : `${N(lang, n.medinan)} بار در سوره‌های مدنی و ${N(lang, n.meccan)} بار در سوره‌های مکی.`),
                line("end", "شمرده از متن تنزیل؛ صفحه‌ها از فرادادهٔ تنزیل."),
              ]
            : [
                line("hook", `One call, ${N(lang, n.occurrences)} times. Watch where it falls.`),
                line("pages", `It stands on ${N(lang, n.pages)} of the ${N(lang, n.totalPages)} pages of the mushaf, in ${N(lang, n.surahs)} surahs.`),
                line("place", all ? "Every one of them is in a surah Tanzil labels Medinan. Not once in a Meccan surah." : `${N(lang, n.medinan)} in Medinan surahs, ${N(lang, n.meccan)} in Meccan ones.`),
                line("end", "Counted from the Tanzil text; the pages from the Tanzil metadata."),
              ];
        },
      },
    },
  },

  middle: {
    scenes: [
      { id: "hook", lines: ["hook"], min: 75 },
      { id: "map", lines: ["verses", "words", "letters"], min: 240 },
      { id: "end", lines: ["end"], min: 75 },
    ],
    episodes: {
      three: {
        facts: ({ meta, m }) => {
          const f = middleFacts(m);
          return {
            numbers: { verses: f.verses, words: f.words, letters: f.letters, byVerse: f.byVerse.verses, byWord: f.byWord.verse, wordAt: f.byWord.at, byLetter: f.byLetter.verse, letterAt: f.byLetter.at },
            data: { pages: meta.pages.length, marks: [{ id: "verses", page: f.byVerse.page }, { id: "words", page: f.byWord.page }, { id: "letters", page: f.byLetter.page }] },
          };
        },
        lines: (lang, n) => {
          const v = n.byVerse;
          return lang === "fa"
            ? [
                line("hook", "وسط قرآن کجاست؟ بستگی دارد چه بشماری."),
                line("verses", `به آیه‌ها، میان ${v.map((r) => refShow(lang, r)).join(" و ")}.`, `به آیه‌ها، میان ${v.map((r) => refSay(lang, r)).join(" و ")}.`),
                line("words", `به کلمه‌ها، در ${refShow(lang, n.byWord)}: کلمهٔ ${N(lang, n.wordAt)} از ${N(lang, n.words)}.`, `به کلمه‌ها، در ${refSay(lang, n.byWord)}: کلمهٔ ${N(lang, n.wordAt)} از ${N(lang, n.words)}.`),
                line("letters", `به حرف‌ها، در ${refShow(lang, n.byLetter)}. هر پاسخ قاعدهٔ خودش را دارد.`, `به حرف‌ها، در ${refSay(lang, n.byLetter)}. هر پاسخ قاعدهٔ خودش را دارد.`),
                line("end", "شمرده از متن تنزیل؛ قاعده‌ها روی صفحه است."),
              ]
            : [
                line("hook", "Where is the middle of the Quran? It depends what you count."),
                line("verses", `By verses, between ${v.map((r) => refShow(lang, r)).join(" and ")}.`, `By verses, between ${v.map((r) => refSay(lang, r)).join(" and ")}.`),
                line("words", `By words, at ${refShow(lang, n.byWord)}: word ${N(lang, n.wordAt)} of ${N(lang, n.words)}.`, `By words, at ${refSay(lang, n.byWord)}: word ${N(lang, n.wordAt)} of ${N(lang, n.words)}.`),
                line("letters", `By letters, at ${refShow(lang, n.byLetter)}. Each answer has its own rule.`, `By letters, at ${refSay(lang, n.byLetter)}. Each answer has its own rule.`),
                line("end", "Counted from the Tanzil text; the rules are on screen."),
              ];
        },
      },
    },
  },

  "revelation-order": {
    scenes: [
      { id: "hook", lines: ["hook"], min: 75 },
      { id: "tiles", lines: ["move", "note"], min: 210 },
      { id: "end", lines: ["end"], min: 75 },
    ],
    episodes: {
      "same-place": {
        facts: ({ index }) => {
          const f = orderFacts(index, null);
          return { numbers: { same: f.samePlace, count: f.samePlace.length }, data: { order: index.surahs.map((s) => s.revelationOrder), places: index.surahs.map((s) => s.revelationPlace), focus: f.samePlace } };
        },
        lines: (lang, n) =>
          lang === "fa"
            ? [
                line("hook", `فقط ${N(lang, n.count)} سوره در هر دو ترتیب جای یکسانی دارند.`),
                line("move", `در ترتیب مصحف و در ترتیب نزولی که تنزیل آورده، سوره‌های ${list(lang, n.same)} در همان شماره می‌مانند.`),
                line("note", "این یکی از ترتیب‌های سنتی نزول است؛ فهرست‌های دیگری هم هست."),
                line("end", "ترتیب از فرادادهٔ تنزیل."),
              ]
            : [
                line("hook", `Only ${N(lang, n.count)} surahs keep their place in both orders.`),
                line("move", `In the book's order and in the revelation order Tanzil lists, Surahs ${list(lang, n.same)} stay at the same number.`),
                line("note", "This is one traditional order of revelation; scholars have listed others."),
                line("end", "The order comes from the Tanzil metadata."),
              ],
      },
      "fatiha-fifth": {
        surah: 1,
        facts: ({ index }, ep) => {
          const f = orderFacts(index, ep.surah);
          return { numbers: { surah: ep.surah, order: f.focusOrder, first: f.first }, data: { order: index.surahs.map((s) => s.revelationOrder), places: index.surahs.map((s) => s.revelationPlace), focus: [ep.surah] } };
        },
        lines: (lang, n, s) =>
          lang === "fa"
            ? [
                line("hook", `نخستین سورهٔ کتاب، سورهٔ ${N(lang, n.order)}مِ نازل‌شده بود.`),
                line("move", `در ترتیب نزولی که تنزیل آورده، پیش از آن سوره‌های ${list(lang, n.first.slice(0, n.order - 1))} آمده‌اند.`),
                line("note", "این یکی از ترتیب‌های سنتی نزول است؛ فهرست‌های دیگری هم هست."),
                line("end", "ترتیب از فرادادهٔ تنزیل."),
              ]
            : [
                line("hook", `The first surah of the book was number ${N(lang, n.order)} to be revealed.`),
                line("move", `In the revelation order Tanzil lists, Surahs ${list(lang, n.first.slice(0, n.order - 1))} come before it.`),
                line("note", "This is one traditional order of revelation; scholars have listed others."),
                line("end", "The order comes from the Tanzil metadata."),
              ],
      },
    },
  },

  "one-line": {
    scenes: [
      { id: "hook", lines: ["hook"], min: 75 },
      { id: "recite", lines: [], min: 60 },
      { id: "ladder", lines: ["places"], min: 150 },
      { id: "end", lines: ["end"], min: 75 },
    ],
    episodes: {
      refrain: {
        surah: 55,
        recite: "repeated",
        facts: ({ m }, ep) => {
          const f = repeatFacts(m, ep.surah);
          return { numbers: { surah: ep.surah, verses: f.verses, times: f.times, first: f.first, last: f.last }, data: { places: f.places, verses: f.verses } };
        },
        lines: (lang, n) =>
          lang === "fa"
            ? [
                line("hook", `یک جمله، ${N(lang, n.times)} بار، در سوره‌ای ${N(lang, n.verses)} آیه‌ای.`),
                line("places", `اول در آیهٔ ${faDigits(n.first)}، آخر در آیهٔ ${faDigits(n.last)}؛ همان جمله، حرف به حرف.`),
                line("end", "آیه‌های یکسان در متن تنزیل پیدا شده‌اند، حرف به حرف."),
              ]
            : [
                line("hook", `One line, ${N(lang, n.times)} times, in a surah of ${N(lang, n.verses)} verses.`),
                line("places", `First at verse ${n.first}, last at verse ${n.last}. The same line, letter for letter.`),
                line("end", "Found in the Tanzil text by exact equality of the verses."),
              ],
      },
    },
  },

  "opening-letters": {
    scenes: [
      { id: "hook", lines: ["hook"], min: 75 },
      { id: "strip", lines: ["letters", "alone"], min: 165 },
      { id: "recite", lines: [], min: 60 },
      { id: "end", lines: ["end"], min: 75 },
    ],
    episodes: {
      group: {
        surah: 19,
        recite: "opening",
        facts: ({ m }, ep) => {
          const f = openingFacts(m, OPENING_LETTER_SURAHS);
          if (!OPENING_LETTER_SURAHS.includes(ep.surah)) throw new Error(`opening letters: ${ep.surah} is not on the list`);
          return { numbers: { surahs: f.surahs, letters: f.letters, combinations: f.combinations, alone: f.aloneAsVerse, surah: ep.surah }, data: { list: OPENING_LETTER_SURAHS, groupOf: f.groupOf, focus: ep.surah, run: f.run } };
        },
        lines: (lang, n) =>
          lang === "fa"
            ? [
                line("hook", `${N(lang, n.surahs)} سوره با حروفی آغاز می‌شوند که جدا جدا خوانده می‌شوند.`),
                line("letters", `${N(lang, n.letters)} حرف گوناگون، در ${N(lang, n.combinations)} ترکیب${n.letters * 2 === 28 ? "؛ درست نیمی از ۲۸ حرف الفبا" : ""}.`),
                line("alone", `در ${N(lang, n.alone)} سوره، این حروف خودشان یک آیهٔ کامل‌اند.`),
                line("end", "فهرست سوره‌ها از فراداده؛ حروف از متن تنزیل."),
              ]
            : [
                line("hook", `${N(lang, n.surahs)} surahs open with letters that are read one by one.`),
                line("letters", `${N(lang, n.letters)} different letters, in ${N(lang, n.combinations)} combinations${n.letters * 2 === 28 ? ": exactly half of the alphabet's 28" : ""}.`),
                line("alone", `In ${N(lang, n.alone)} surahs the letters are a whole verse of their own.`),
                line("end", "The surahs from the metadata; the letters from the Tanzil text."),
              ],
      },
    },
  },

  "every-letter": {
    scenes: [
      { id: "hook", lines: ["hook", "this"], min: 120 },
      { id: "recite", lines: [], min: 60 },
      { id: "end", lines: ["other", "end"], min: 120 },
    ],
    episodes: {
      first: {
        pick: 0,
        recite: "verse",
        facts: ({ m }, ep) => {
          const f = everyLetterFacts(m);
          const verse = f.verses[ep.pick ?? 0];
          if (!verse) throw new Error("every letter: no such verse");
          const [s, a] = verse.split(":").map(Number);
          return { numbers: { verses: f.verses, letters: f.letters, verse }, data: { surah: s, ayah: a } };
        },
        lines: (lang, n) => {
          const other = n.verses.filter((v) => v !== n.verse);
          return lang === "fa"
            ? [
                line("hook", `${n.verses.length === 2 ? "دو آیه" : `${N(lang, n.verses.length)} آیه`} در قرآن هر ${N(lang, n.letters)} حرف الفبا را دارند.`),
                line("this", `این یکی از آن‌هاست: ${refShow(lang, n.verse)}. با تلاوت، حرف‌ها یکی‌یکی روشن می‌شوند.`, `این یکی از آن‌هاست: ${refSay(lang, n.verse)}. با تلاوت، حرف‌ها یکی‌یکی روشن می‌شوند.`),
                line("other", `و دیگری ${other.map((r) => refShow(lang, r)).join("، ")} است.`, `و دیگری ${other.map((r) => refSay(lang, r)).join("، ")} است.`),
                line("end", "حرف‌ها در متن تنزیل شمرده شده‌اند؛ قاعده روی صفحه است."),
              ]
            : [
                line("hook", `${n.verses.length === 2 ? "Two verses" : `${N(lang, n.verses.length)} verses`} of the Quran hold all ${N(lang, n.letters)} letters of the alphabet.`),
                line("this", `This is one of them: ${refShow(lang, n.verse)}. Watch the letters light as it is recited.`, `This is one of them: ${refSay(lang, n.verse)}. Watch the letters light as it is recited.`),
                line("other", `The other is ${other.map((r) => refShow(lang, r)).join(", ")}.`, `The other is ${other.map((r) => refSay(lang, r)).join(", ")}.`),
                line("end", "Letters counted in the Tanzil text, with the rule on screen."),
              ];
        },
      },
    },
  },

  quiz: {
    scenes: [
      { id: "question", lines: ["question"], min: 75 },
      { id: "think", lines: [], min: 90 },
      { id: "answer", lines: ["answer"], min: 105 },
      { id: "end", lines: [], min: 45 },
    ],
    episodes: {
      "no-basmala": {
        options: [1, 9, 112],
        facts: ({ m }, ep) => {
          const f = basmalaFacts(m);
          if (f.without.length !== 1 || !ep.options.includes(f.without[0])) throw new Error("quiz no-basmala: the answer is not among the options");
          return { numbers: { answer: f.without[0], options: ep.options }, data: { answer: f.without[0], options: ep.options } };
        },
        lines: (lang, n, s) =>
          lang === "fa"
            ? [line("question", "کدام سوره با بسم‌الله آغاز نمی‌شود؟"), line("answer", `سورهٔ ${faDigits(n.answer)}، ${s.name}. همهٔ سوره‌های دیگر با آن آغاز می‌شوند.`)]
            : [line("question", "Which surah does not open with the Basmala?"), line("answer", `Surah ${n.answer}, ${s.tname}. Every other surah opens with it.`)],
      },
    },
  },
};

/** The narration ids of a format's scenes (a job's narration may hold only these). */
export const insightIds = (format) => INSIGHTS[format].scenes.flatMap((s) => s.lines);

/**
 * The facts and the sentences of one episode. `pick` overrides the episode's own surah, verse
 * or options (the planner's choice), e.g. { surah: 2 } for One Line N Times.
 */
export function episodeOf(ctx, format, episode, pick = {}) {
  const def = INSIGHTS[format]?.episodes?.[episode];
  if (!def) throw new Error(`no episode ${format}/${episode}`);
  const ep = { ...def, ...pick };
  const { numbers, data } = def.facts(ctx, ep);
  const focus = numbers.surah ?? data.focus ?? null;
  const surah = typeof focus === "number" ? { name: ctx.index.surahs[focus - 1].nameArabic, tname: ctx.meta.suras[focus - 1].tname } : { name: "", tname: "" };
  const answerSurah = numbers.answer ? { name: ctx.index.surahs[numbers.answer - 1].nameArabic, tname: ctx.meta.suras[numbers.answer - 1].tname } : null;
  const longest = numbers.longest ? { name: ctx.index.surahs[numbers.longest - 1].nameArabic, tname: ctx.meta.suras[numbers.longest - 1].tname } : null;
  const lines = def.lines(ctx.lang, numbers, answerSurah ?? longest ?? surah);
  return { numbers, data, lines, recite: reciteOf(ctx, ep, numbers, data) };
}

/** The verses the qari recites in an episode, or null. */
function reciteOf(ctx, ep, numbers, data) {
  const r = ep.recite;
  if (!r) return null;
  if (typeof r === "object") return { ...r };
  if (r === "repeated") return { surah: numbers.surah, from: numbers.first, to: numbers.first };
  if (r === "opening") return { surah: numbers.surah, from: 1, to: 1 };
  if (r === "verse") return { surah: data.surah, from: data.ayah, to: data.ayah };
  return null;
}
