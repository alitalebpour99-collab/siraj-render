// node --experimental-strip-types --test scripts/waiting.test.mjs
// Placeholders only: no text of the Quran, of a hadith, a dua, a tafsir or Nahj al-balagha (and
// no translation of one) is used here — "a1 a2" stands for an Arabic text, "ف۱ ف۲" for its Persian,
// and the reader pages are made-up pages in the shape of Siraj's.
import assert from "node:assert/strict";
import test from "node:test";
import { CheckError, DataChanged, sha256 } from "./lib.mjs";
import { MAFATIH, NAHJ, duaPath, nahjPath } from "./books.mjs";
import { WAITING_FORMATS, WEEKDAYS, waitingProps, waitingShape } from "./waiting.mjs";
import { CROP, safeFrame } from "../src/layout.ts";
import { FPS, insightTimeline, speakerWindows } from "../src/timelines.ts";
import { SLIDE, TAFSIR_SLIDES, WAITING_LANGS, WAITING_SCENES, slideBoxes, textBoxes } from "../src/waitingPlan.ts";

const words = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`).join(" ");
const FA = (n) => words("ف", n);
const AR = (n) => words("a", n);
/** Made-up Persian words without a digit (for the fixed lines, which must be plain spoken Persian). */
const LET = (n) => Array.from({ length: n }, (_, i) => ["الف", "به", "پا", "تا", "ثا", "جیم", "چه", "حا"][i % 8]).join(" ");
const job = (props, expect = {}) => ({ id: "w-test", props, expect: { numbers: {}, ...expect } });

const NAHJ_RELEASE = "nahj-release-x1";
const DUA_RELEASE = "mafatih-release-x1";
/** A made-up saying page in the shape of Siraj's hadith reader (one record, or several). */
const hadithPage = (records, release = NAHJ_RELEASE) =>
  `<html><body><ol class="hadith-list" role="list">${records
    .map(
      (r, i) =>
        `<li id="h-${i + 1}" class="hadith"><p class="hadith__text verbatim" lang="ar" dir="rtl">${r.ar}</p><p class="hadith__translation verbatim" lang="fa" dir="rtl">${r.fa}</p><div class="hadith__links"><a class="text-link" href="https://example.org/w/${i + 1}" rel="noopener">x</a><a class="text-link" href="/hadith/${release}%3Arec%3A${100 + i}">y</a></div></li>`,
    )
    .join("")}</ol></body></html>`;
/** A made-up dua page in the shape of Siraj's duas reader. */
const duaPage = (lines, release = DUA_RELEASE) =>
  `<html><body><ol class="dua-text">${lines
    .map((l, i) => `<li id="l-${i + 1}" class="dua-line"><span class="dua-line__number">${i + 1}</span><p class="dua-line__text verbatim" lang="ar" dir="rtl">${l.ar}</p><p class="dua-line__translation verbatim" lang="fa" dir="rtl">${l.fa}</p></li>`)
    .join("")}</ol><dl><dd><bdi class="hash">retrieved-2026-01-01</bdi></dd><dd><bdi class="hash">${release}</bdi></dd></dl><a class="text-link" href="https://mafatih.makarem.ir/" rel="noopener">s</a></body></html>`;

const SAYING = { ar: AR(14), fa: `${FA(3)}:\n${FA(16)}` };
// each line about a hundred characters of Persian: three of them fit the narrator's half-minute, four do not
const KUMAYL = Array.from({ length: 12 }, () => ({ ar: AR(10), fa: FA(28) }));
const DAY = Array.from({ length: 6 }, (_, i) => ({ ar: AR(i === 0 ? 40 : 6), fa: FA(i === 0 ? 40 : 7) }));
const hashes = (pairs) => pairs.flatMap((x) => [sha256(x.ar), sha256(x.fa)]);

/** An exegesis record made up in the shape of /api/quran/exegesis/<id>: ayahs, two headings, then prose. */
const RECORD_TEXT = ["a1 a2", "ب۱:", "ف۱ ف۲.", "ت۱:", "عنوان", ...Array.from({ length: 9 }, (_, i) => `${FA(30 + i)}.`)].join("\n\n");
const RECORD = (id = 7, over = {}) => ({
  service: "siraj-public-quran-exegesis",
  recordId: id,
  text: RECORD_TEXT,
  textHashSha256: sha256(RECORD_TEXT),
  range: { startSurahNumber: 2, startAyahNumber: 3, endSurahNumber: 2, endAyahNumber: 4 },
  workTitle: "w1 w2",
  author: "n1 n2",
  locator: "https://example.org/t?s=2&v=3",
  release: { releaseKey: "tafsir-release-x1", publisher: "p1" },
  trust: { verbatim_text_only: true, text_hash_verified_at_read_time: true, ai_can_publish: false },
  ...over,
});
const VERSES = (job, surah, ayahs) => ({
  surah: { number: surah, ayahCount: 286, nameArabic: "n1", revelationPlace: "medinan", revelationOrder: 87 },
  ayahs: ayahs.map((n) => ({ ayahNumber: n, text: AR(6), translation: FA(9), locator: `x ${surah}:${n}`, textHashSha256: sha256(`v${n}`) })),
  translation: { title: "t1", translatorName: "tr1", language: "fa", termsText: null, release: { releaseKey: "tr-x1" } },
  opening: null,
  quran: { releaseKey: "quran-x1" },
  metadata: { sha256: "m1" },
});
const io = (pages = {}, record = RECORD()) => ({ page: async (path) => pages[path] ?? (() => { throw new Error(`${path}: HTTP 404`); })(), exegesis: async () => record, verses: async (...a) => VERSES(...a) });

const SRC_LINE = { id: "src", show: `${LET(3)} · ${LET(2)}`, say: `${LET(3)}، ${LET(2)}` };
const REST_LINE = { id: "rest", show: LET(4), say: LET(4) };

const FIXTURES = {
  "nahj-hikma": () => job({ format: "nahj-hikma", lang: "fa", nahj: { number: 12 }, narration: [SRC_LINE] }, { textRelease: NAHJ_RELEASE, textHashes: hashes([SAYING]), numbers: { hikma: 12 } }),
  kumayl: () => job({ format: "kumayl", lang: "fa", dua: { key: MAFATIH.kumayl, from: 1, to: 3 }, narration: [REST_LINE] }, { textRelease: DUA_RELEASE, textHashes: hashes(KUMAYL.slice(0, 3)), numbers: { from: 1, to: 3 } }),
  "dua-story": () => job({ format: "dua-story", lang: "fa", dhikr: { day: "mon", key: MAFATIH.weekdays[1], line: 2 } }, { textRelease: DUA_RELEASE, textHashes: hashes([DAY[1]]), numbers: { day: "mon", line: 2 } }),
  tafsir: () => job({ format: "tafsir", lang: "fa", tafsir: { record: 7, surah: 2, from: 3, to: 4 } }, { textRelease: "quran-x1", sourceRelease: "tafsir-release-x1", textHashes: [sha256(RECORD_TEXT)], numbers: { surah: 2, from: 3, to: 4, record: 7, slides: 5 } }),
  occasion: () => job({ format: "occasion", lang: "fa", occasion: { authority: "o1", name: LET(2), line: LET(12) } }),
  mirror: () =>
    job(
      {
        format: "mirror",
        lang: "en",
        mirror: { surah: 9, scholar: { name: "s1", work: "w1" }, sections: [{ from: 1, to: 3 }, { from: 4, to: 6 }, { from: 7, to: 7 }, { from: 8, to: 10 }, { from: 11, to: 286 }], center: 2, recite: { ayahs: [2, 12] } },
        narration: [
          { id: "hook", show: words("h", 10), say: words("h", 10) },
          { id: "fold", show: words("f", 20), say: words("f", 20) },
          { id: "pair", show: words("p", 16), say: words("p", 16) },
          { id: "end", show: words("e", 8), say: words("e", 8) },
        ],
      },
      { textRelease: "quran-x1" },
    ),
};
const PAGES = { [nahjPath(12)]: hadithPage([SAYING]), [duaPath(MAFATIH.kumayl)]: duaPage(KUMAYL), [duaPath(MAFATIH.weekdays[1])]: duaPage(DAY) };

/** One broken copy per format: each must be refused before anything is read. */
const BROKEN = {
  "nahj-hikma": [(j) => (j.props.nahj.number = 0), (j) => (j.props.nahj.number = 481), (j) => (j.props.narration = [{ ...SRC_LINE, say: `${LET(2)} ۱۲` }]), (j) => (j.props.narration = [{ ...SRC_LINE, id: "rest" }]), (j) => delete j.props.nahj],
  kumayl: [(j) => (j.props.dua.key = "1"), (j) => (j.props.dua.to = 9), (j) => (j.props.dua.from = 0), (j) => (j.props.narration = [{ ...REST_LINE, say: `${LET(1)}: ${LET(2)}` }])],
  "dua-story": [(j) => (j.props.dhikr.day = "monday"), (j) => (j.props.dhikr.key = MAFATIH.weekdays[2]), (j) => (j.props.dhikr.line = 0), (j) => (j.props.narration = [SRC_LINE])],
  tafsir: [(j) => (j.props.tafsir.to = 8), (j) => (j.props.narration = [{ id: "tr1", show: FA(2), say: FA(2) }]), (j) => delete j.props.tafsir.record],
  occasion: [(j) => (j.props.narration = [{ id: "name", show: "n9", say: "n9" }]), (j) => (j.props.lang = "de"), (j) => (j.props.occasion.url = "http://example.org")],
  mirror: [
    (j) => j.props.mirror.sections.pop(), // an even number of sections has no centre
    (j) => (j.props.mirror.sections[1] = { from: 5, to: 6 }), // a gap
    (j) => (j.props.mirror.recite.ayahs = [2, 9]), // 2 is in the first section, 9 in the fourth: not a pair
    (j) => (j.props.mirror.center = 1),
    (j) => (j.props.narration = j.props.narration.filter((l) => l.id !== "hook")),
  ],
};

test("six waiting formats, each with its languages, scenes and fixtures", () => {
  assert.deepEqual([...WAITING_FORMATS].sort(), ["dua-story", "kumayl", "mirror", "nahj-hikma", "occasion", "tafsir"]);
  assert.deepEqual(WAITING_LANGS.mirror, ["en", "fa"]);
  for (const f of WAITING_FORMATS) {
    assert.ok(FIXTURES[f], f);
    assert.ok(BROKEN[f]?.length, f);
  }
  assert.equal(WEEKDAYS.length, 7);
  assert.equal(NAHJ.part, 3);
});

for (const f of Object.keys(FIXTURES)) {
  test(`${f}: a good job passes the shape check; broken ones are refused`, () => {
    const { props } = waitingShape(FIXTURES[f]());
    assert.equal(props.kind, "waiting");
    assert.equal(props.format, f);
    assert.ok(props.scenes.length >= 2);
    for (const [i, breakIt] of BROKEN[f].entries()) {
      const j = FIXTURES[f]();
      breakIt(j);
      assert.throws(() => waitingShape(j), CheckError, `${f} broken copy ${i + 1}`);
    }
  });
}

test("a saying is read from its page: verbatim, hash-checked, the narrator reads its Persian then the source", async () => {
  const p = await waitingProps(FIXTURES["nahj-hikma"](), io(PAGES));
  assert.equal(p.text.lines[0].arabic, SAYING.ar);
  assert.equal(p.text.lines[0].persian, SAYING.fa);
  assert.deepEqual(p.narration.map((l) => l.id), ["tr1", "tr2", "src"]);
  // the narrator's lines are the served Persian in its own lines, word for word
  assert.equal(p.narration.filter((l) => l.id.startsWith("tr")).map((l) => l.say).join(" "), SAYING.fa.replace(/\s+/g, " "));
  assert.deepEqual(p.facts, { hikma: 12 });
  assert.equal(p.source.text.releaseKey, NAHJ_RELEASE);
  assert.deepEqual(p.texts.map((t) => t.textHashSha256), hashes([SAYING]));
  // a changed text, another release, a saying of two records: refused
  const changed = FIXTURES["nahj-hikma"]();
  changed.expect.textHashes = hashes([{ ...SAYING, fa: FA(3) }]);
  await assert.rejects(waitingProps(changed, io(PAGES)), DataChanged);
  await assert.rejects(waitingProps(FIXTURES["nahj-hikma"](), io({ [nahjPath(12)]: hadithPage([SAYING], "other-release") })), DataChanged);
  await assert.rejects(waitingProps(FIXTURES["nahj-hikma"](), io({ [nahjPath(12)]: hadithPage([SAYING, SAYING]) })), CheckError);
  // markup inside a verbatim element means the page is not what this reader knows
  await assert.rejects(waitingProps(FIXTURES["nahj-hikma"](), io({ [nahjPath(12)]: hadithPage([{ ...SAYING, ar: "<b>a1</b>" }]) })));
});

test("Kumayl: whole lines by the rule, one narrator line each, then «the rest» with the exact address", async () => {
  const p = await waitingProps(FIXTURES.kumayl(), io(PAGES));
  assert.deepEqual(p.text.lines.map((l) => l.number), [1, 2, 3]);
  assert.deepEqual(p.narration.map((l) => l.id), ["tr1", "tr2", "tr3", "rest"]);
  assert.equal(p.narration[1].say, KUMAYL[1].fa);
  assert.equal(p.text.source.siraj, `https://siraj.ahura.cloud${duaPath(MAFATIH.kumayl)}#l-4`);
  assert.deepEqual(p.scenes.map((s) => s.id), ["candle", "b1", "b2", "b3", "end"]);
  assert.equal(p.studio.look, "night");
  // lines the rule would not have chosen (fewer than fit) are refused
  const short = FIXTURES.kumayl();
  short.props.dua.to = 2;
  short.expect.textHashes = hashes(KUMAYL.slice(0, 2));
  short.expect.numbers = { from: 1, to: 2 };
  await assert.rejects(waitingProps(short, io(PAGES)), CheckError);
});

test("the dhikr Story: the weekday's dua, its line by the rule", async () => {
  const p = await waitingProps(FIXTURES["dua-story"](), io(PAGES));
  assert.deepEqual(p.facts, { day: "mon", line: 2 });
  assert.deepEqual(p.narration.map((l) => l.id), ["tr1"]);
  assert.equal(p.text.day, "mon");
  // line 1 is too long for a Story: the rule passes it over, so a job naming it is refused
  const one = FIXTURES["dua-story"]();
  one.props.dhikr.line = 1;
  one.expect.textHashes = hashes([DAY[0]]);
  one.expect.numbers = { day: "mon", line: 1 };
  await assert.rejects(waitingProps(one, io(PAGES)), CheckError);
  const quiet = FIXTURES["dua-story"]();
  quiet.props.voice = { engine: "none" };
  assert.equal(waitingShape(quiet).props.silent, true);
});

test("the tafsir carousel: the record's hash, its release, whole sentences on three slides", async () => {
  const p = await waitingProps(FIXTURES.tafsir(), io());
  assert.equal(p.tafsir.slides.length, 3);
  for (const s of p.tafsir.slides) for (const piece of s.replace(/ …$/, "").split("\n")) assert.ok(RECORD_TEXT.includes(piece), "every piece is the record's own text");
  assert.equal(p.facts.slides, TAFSIR_SLIDES);
  assert.equal(p.source.text.releaseKey, "tafsir-release-x1");
  assert.equal(p.source.quran.releaseKey, "quran-x1");
  assert.equal(p.silent, true);
  assert.equal(p.scenes.length, TAFSIR_SLIDES);
  assert.equal(p.tafsir.source.siraj, "https://siraj.ahura.cloud/quran/2");
  await assert.rejects(waitingProps(FIXTURES.tafsir(), io({}, RECORD(7, { release: { releaseKey: "other", publisher: "p1" } }))), DataChanged);
  await assert.rejects(waitingProps(FIXTURES.tafsir(), io({}, RECORD(7, { range: { startSurahNumber: 2, startAyahNumber: 3, endSurahNumber: 2, endAyahNumber: 5 } }))), CheckError);
});

test("the facts are checked against the job's expect.numbers", async () => {
  const j = FIXTURES.kumayl();
  j.expect.numbers = { from: 2, to: 3 };
  assert.throws(() => waitingShape(j), DataChanged);
  const m = waitingShape(FIXTURES.mirror()).props;
  assert.deepEqual(m.facts, { surah: 9, sections: 5, center: 2, pair: [2, 12] });
  const t = FIXTURES.tafsir();
  t.expect.numbers.slides = 4;
  await assert.rejects(waitingProps(t, io()), DataChanged);
});

test("the studio: the format's look by default, the job's own when it names one, the occasion always muted", () => {
  assert.equal(waitingShape(FIXTURES["nahj-hikma"]()).props.studio.look, "lapis");
  const paper = FIXTURES["nahj-hikma"]();
  paper.props.studio = { look: "paper", ending: "source" };
  assert.equal(waitingShape(paper).props.studio.look, "paper");
  const o = FIXTURES.occasion();
  o.props.studio = { look: "lapis", particles: true };
  const s = waitingShape(o).props.studio;
  assert.equal(s.look, "pewter");
  assert.equal(s.particles, false);
  assert.equal(s.motion, "calm");
});

test("an occasion is built without the network", async () => {
  const { props } = waitingShape(FIXTURES.occasion());
  assert.deepEqual(await waitingProps(FIXTURES.occasion(), io()), props);
});

/* ---------- the timelines ---------- */

const voiceOf = (seconds) => ({ engine: "piper", voice: "x", lines: Object.entries(seconds).map(([id, s]) => ({ id, file: `voice/w/n-${id}.wav`, seconds: s })) });
const clip = (ayah, seconds) => ({ id: `q${ayah}`, ayah, file: `qari/w/q-${ayah}.wav`, seconds });
const timeline = (props, voice, qari = null) => insightTimeline({ scenes: props.scenes, narration: props.narration, voice: props.silent ? null : voice, qari, loop: true });
const seconds = (t) => t.total / FPS;

/** Never two voices at once, every narration line has its place, every scene in order. */
function sound(props, t) {
  const { overlap, segs } = speakerWindows(t.speakers);
  assert.equal(overlap, null);
  for (let i = 1; i < segs.length; i++) assert.ok(segs[i].from >= segs[i - 1].to);
  assert.deepEqual(t.scenes.flatMap((s) => s.lines.map((l) => l.id)).sort(), props.narration.map((l) => l.id).sort());
  for (let i = 1; i < t.scenes.length; i++) assert.equal(t.scenes[i].from, t.scenes[i - 1].from + t.scenes[i - 1].dur);
  return segs;
}

test("nahj-hikma: 15–30 s, the narrator after the Arabic has appeared, the source last", async () => {
  const p = await waitingProps(FIXTURES["nahj-hikma"](), io(PAGES));
  const t = timeline(p, voiceOf({ tr1: 1.5, tr2: 6, src: 4 }));
  const segs = sound(p, t);
  assert.deepEqual(segs.map((s) => s.who), ["narrator tr1", "narrator tr2", "narrator src"]);
  assert.ok(seconds(t) >= 15 && seconds(t) <= 30, `${seconds(t)} s`);
  assert.ok(t.speakers[0].frame >= WAITING_SCENES["nahj-hikma"][0].min);
});

test("kumayl: within a minute, the passage's lines one after another, the rest last", async () => {
  const p = await waitingProps(FIXTURES.kumayl(), io(PAGES));
  const t = timeline(p, voiceOf({ tr1: 6, tr2: 5.5, tr3: 7, rest: 4 }));
  const segs = sound(p, t);
  assert.deepEqual(segs.map((s) => s.who), ["narrator tr1", "narrator tr2", "narrator tr3", "narrator rest"]);
  assert.ok(seconds(t) >= 20 && seconds(t) <= 60, `${seconds(t)} s`);
});

test("dua-story: about nine seconds, silent or with the narrator", async () => {
  const p = await waitingProps(FIXTURES["dua-story"](), io(PAGES));
  const narrated = timeline(p, voiceOf({ tr1: 5 }));
  sound(p, narrated);
  assert.ok(seconds(narrated) <= 10 && seconds(narrated) >= 8, `${seconds(narrated)} s`);
  const t = timeline({ ...p, silent: true }, voiceOf({ tr1: 5 }));
  assert.equal(t.speakers.length, 0);
  assert.ok(seconds(t) <= 10 && seconds(t) >= 8, `${seconds(t)} s`);
});

test("occasion: about 15 s, very slow", () => {
  const p = waitingShape(FIXTURES.occasion()).props;
  for (const voice of [voiceOf({ name: 2, line: 4.5 }), null]) {
    const t = timeline(p, voice);
    sound(p, t);
    assert.ok(seconds(t) >= 14 && seconds(t) <= 17, `${seconds(t)} s`);
  }
});

test("mirror: 45–75 s, the qari's two verses in their own scene, the narrator never over him", () => {
  const p = waitingShape(FIXTURES.mirror()).props;
  const t = timeline(p, voiceOf({ hook: 5, fold: 11, pair: 8, end: 5 }), { basmala: null, verses: [clip(2, 6.5), clip(12, 7.2)] });
  const segs = sound(p, t);
  assert.deepEqual(segs.map((s) => s.who), ["narrator hook", "narrator fold", "qari 2", "qari 12", "narrator pair", "narrator end"]);
  const rec = t.scenes.find((s) => s.id === "recite");
  assert.equal(rec.clips.length, 2);
  for (const c of rec.clips) assert.ok(c.from >= rec.from && c.from + c.len <= rec.from + rec.dur);
  assert.ok(seconds(t) >= 45 && seconds(t) <= 75, `${seconds(t)} s`);
});

test("tafsir: a silent twin of the carousel, one scene per slide", async () => {
  const p = await waitingProps(FIXTURES.tafsir(), io());
  const t = timeline(p, voiceOf({}));
  assert.equal(t.speakers.length, 0);
  assert.equal(t.scenes.length, TAFSIR_SLIDES);
  assert.ok(t.scenes.every((s) => s.dur >= 3 * FPS));
});

/* ---------- where the text stands ---------- */

test("every text box of every format sits inside the 4:5 crop and above the caption zone", () => {
  assert.equal(safeFrame([[CROP.top - 10, CROP.top + 50]]), false); // the check bites
  for (const f of WAITING_FORMATS) {
    const boxes = textBoxes(f);
    assert.ok(boxes.length >= 3, f);
    for (const [a, b] of boxes) assert.ok(a < b, `${f}: ${a}–${b}`);
    assert.ok(safeFrame(boxes), f);
  }
  // inside a slide: clear of the drawn frame (its inner hairline at ~66 px from each edge)
  for (const [a, b] of slideBoxes()) assert.ok(a >= 70 && b <= SLIDE.height - 70, `slide ${a}–${b}`);
  assert.equal(SLIDE.top, CROP.top);
});
