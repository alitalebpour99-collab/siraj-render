// node --experimental-strip-types --test scripts/waiting.test.mjs
// Placeholders only: no text of the Quran, of a hadith, a dua, a tafsir or Nahj al-balagha (and
// no translation of one) is used here — "a1 a2" stands for an Arabic text, "ف۱ ف۲" for its Persian.
import assert from "node:assert/strict";
import test from "node:test";
import { CheckError, DataChanged, sha256 } from "./lib.mjs";
import { WAITING_FORMATS, WEEKDAYS, waitingProps, waitingShape } from "./waiting.mjs";
import { CROP, safeFrame } from "../src/layout.ts";
import { FPS, insightTimeline, speakerWindows } from "../src/timelines.ts";
import { SLIDE, TAFSIR_MAX_SLIDES, WAITING_LANGS, WAITING_SCENES, slideBoxes, textBoxes } from "../src/waitingPlan.ts";

const SRC = { title: "t1", translator: "tr1", publisher: "p1", url: "https://example.org/x" };
const job = (props, extra = {}) => ({ id: "w-test", props, expect: {}, ...extra });
const words = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`).join(" ");
const FA = (n) => words("ف", n);
const AR = (n) => words("a", n);

const FIXTURES = {
  "nahj-hikma": () => ({ format: "nahj-hikma", lang: "fa", text: { number: 12, arabic: AR(14), persian: FA(20), source: { ...SRC } } }),
  kumayl: () => ({
    format: "kumayl",
    lang: "fa",
    text: { number: 3, arabic: AR(30), persian: FA(36), source: { ...SRC, translator: undefined } },
    narration: [
      { id: "tr1", show: FA(18), say: FA(18) },
      { id: "tr2", show: words("ف", 36).split(" ").slice(18).join(" "), say: words("ف", 36).split(" ").slice(18).join(" ") },
    ],
  }),
  "dua-story": () => ({ format: "dua-story", lang: "fa", text: { day: "mon", count: 100, arabic: AR(4), persian: FA(6), source: { ...SRC } } }),
  tafsir: () => ({ format: "tafsir", lang: "fa", tafsir: { verse: { surah: 2, from: 3, to: 4 }, paragraphs: [FA(40), FA(30), FA(50), FA(20)], volume: 1, page: 75, source: { title: "t1", publisher: "p1", url: "https://example.org/t" } } }),
  occasion: () => ({ format: "occasion", lang: "fa", occasion: { authority: "o1", name: "n1 n2", line: FA(12) } }),
  mirror: () => ({
    format: "mirror",
    lang: "en",
    mirror: {
      surah: 9,
      scholar: { name: "s1", work: "w1" },
      sections: [
        { from: 1, to: 3 },
        { from: 4, to: 6 },
        { from: 7, to: 7 },
        { from: 8, to: 10 },
        { from: 11, to: 13 },
      ],
      center: 2,
      recite: { ayahs: [2, 12] },
    },
    narration: [
      { id: "hook", show: words("h", 10), say: words("h", 10) },
      { id: "fold", show: words("f", 20), say: words("f", 20) },
      { id: "pair", show: words("p", 16), say: words("p", 16) },
      { id: "end", show: words("e", 8), say: words("e", 8) },
    ],
  }),
};

/** One broken copy per format: each must be refused. */
const BROKEN = {
  "nahj-hikma": [
    (p) => delete p.text.source.translator, // the translator is named on screen
    (p) => (p.text.arabic = "a".repeat(401)),
    (p) => (p.narration = [{ id: "tr1", show: p.text.persian, say: "x1 x2" }]), // the narrator reads only what is served
    (p) => (p.narration = [{ id: "tr1", show: "ف۱ف۲", say: "ف۱ف۲" }]), // not the served Persian
    (p) => (p.text.number = 0),
  ],
  kumayl: [(p) => delete p.text.number, (p) => (p.narration = [p.narration[1], p.narration[0]])],
  "dua-story": [(p) => (p.text.day = "monday"), (p) => (p.narration = [{ id: "tr1", show: "ف۱ ف۲ ف۳", say: "ف۱ ف۲ ف۳" }, { id: "tr2", show: "ف۴ ف۵ ف۶", say: "ف۴ ف۵ ف۶" }]), (p) => (p.text.count = 0)],
  tafsir: [
    (p) => p.tafsir.paragraphs.push(FA(3)), // five paragraphs: six slides
    (p) => (p.tafsir.verse = { surah: 2, from: 1, to: 4 }),
    (p) => (p.narration = [{ id: "tr1", show: FA(2), say: FA(2) }]), // the carousel is silent
    (p) => (p.tafsir.paragraphs[0] = "ف".repeat(701)),
  ],
  occasion: [(p) => (p.narration = [{ id: "name", show: "n9", say: "n9" }]), (p) => (p.lang = "de"), (p) => (p.occasion.url = "http://example.org")],
  mirror: [
    (p) => p.mirror.sections.pop(), // an even number of sections has no centre
    (p) => (p.mirror.sections[1] = { from: 5, to: 6 }), // a gap
    (p) => (p.mirror.recite.ayahs = [2, 9]), // 2 is in the first section, 9 in the fourth: not a pair
    (p) => (p.mirror.center = 1),
    (p) => (p.narration = p.narration.filter((l) => l.id !== "hook")),
    (p) => (p.narration = [...p.narration, { id: "extra", show: "x1", say: "x1" }]),
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
});

for (const f of Object.keys(FIXTURES)) {
  test(`${f}: a good job's props pass the shape check; broken ones are refused`, () => {
    const { props } = waitingShape(job(FIXTURES[f]()));
    assert.equal(props.kind, "waiting");
    assert.equal(props.format, f);
    assert.ok(props.scenes.length >= 2);
    for (const [i, breakIt] of BROKEN[f].entries()) {
      const p = FIXTURES[f]();
      breakIt(p);
      assert.throws(() => waitingShape(job(p)), CheckError, `${f} broken copy ${i + 1}`);
    }
  });
}

test("texts are copied verbatim, the narration is the served translation", () => {
  const p = FIXTURES["nahj-hikma"]();
  const { props } = waitingShape(job(p));
  assert.equal(props.text.arabic, p.text.arabic);
  assert.equal(props.text.persian, p.text.persian);
  assert.deepEqual(props.narration, [{ id: "tr1", show: p.text.persian, say: p.text.persian }]);
  assert.deepEqual(props.facts, { hikma: 12 });
  assert.equal(props.text.source.translator, "tr1");
  // the kumayl passage in two lines, split at a space
  const k = waitingShape(job(FIXTURES.kumayl())).props;
  assert.deepEqual(k.narration.map((l) => l.id), ["tr1", "tr2"]);
  assert.equal(k.narration.map((l) => l.show).join(" "), k.text.persian);
  assert.equal(k.studio.look, "night");
  // a hash, when the job names one, is the hash of the Arabic
  const h = FIXTURES["dua-story"]();
  h.text.textHashSha256 = sha256(h.text.arabic);
  assert.equal(waitingShape(job(h)).props.text.textHashSha256, h.text.textHashSha256);
  h.text.textHashSha256 = sha256("a0");
  assert.throws(() => waitingShape(job(h)), CheckError);
});

test("the facts are checked against the job's expect.numbers", () => {
  assert.equal(waitingShape(job(FIXTURES.kumayl(), { expect: { numbers: { passage: 3 } } })).props.facts.passage, 3);
  assert.throws(() => waitingShape(job(FIXTURES.kumayl(), { expect: { numbers: { passage: 4 } } })), DataChanged);
  const t = waitingShape(job(FIXTURES.tafsir())).props;
  assert.deepEqual(t.facts, { surah: 2, from: 3, to: 4, slides: 5, volume: 1, page: 75 });
  const m = waitingShape(job(FIXTURES.mirror())).props;
  assert.deepEqual(m.facts, { surah: 9, sections: 5, center: 2, pair: [2, 12] });
});

test("what is still to read from the API, and what is silent", () => {
  const t = waitingShape(job(FIXTURES.tafsir()));
  assert.deepEqual(t.need, { surah: 2, ayahs: [3, 4] });
  assert.equal(t.props.silent, true);
  assert.equal(t.props.scenes.length, 5);
  const m = waitingShape(job(FIXTURES.mirror()));
  assert.deepEqual(m.need, { surah: 9, ayahs: [2, 12] });
  assert.equal(m.props.silent, false);
  assert.equal(waitingShape(job(FIXTURES["nahj-hikma"]())).need, null);
  const quiet = FIXTURES["dua-story"]();
  quiet.voice = { engine: "none" };
  assert.equal(waitingShape(job(quiet)).props.silent, true);
});

test("the studio: the format's look by default, the job's own when it names one, the occasion always muted", () => {
  assert.equal(waitingShape(job(FIXTURES["nahj-hikma"]())).props.studio.look, "lapis");
  assert.equal(waitingShape(job({ ...FIXTURES["nahj-hikma"](), studio: { look: "paper", ending: "source" } })).props.studio.look, "paper");
  const o = waitingShape(job({ ...FIXTURES.occasion(), studio: { look: "lapis", particles: true } })).props.studio;
  assert.equal(o.look, "pewter");
  assert.equal(o.particles, false);
  assert.equal(o.motion, "calm");
  assert.equal(waitingShape(job({ ...FIXTURES.occasion(), lang: "en" })).props.lang, "en");
});

test("a job without verses to read is built without the network", async () => {
  const { props } = waitingShape(job(FIXTURES.occasion()));
  assert.deepEqual(await waitingProps(job(FIXTURES.occasion())), props);
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

test("nahj-hikma: 15–25 s, the narrator after the Arabic has appeared", () => {
  const p = waitingShape(job(FIXTURES["nahj-hikma"]())).props;
  const t = timeline(p, voiceOf({ tr1: 8 }));
  sound(p, t);
  assert.ok(seconds(t) >= 15 && seconds(t) <= 25, `${seconds(t)} s`);
  assert.ok(t.speakers[0].frame >= WAITING_SCENES["nahj-hikma"][0].min);
  const silent = timeline(p, null);
  assert.ok(seconds(silent) >= 15 && seconds(silent) <= 25, `${seconds(silent)} s without a voice`);
});

test("kumayl: 20–30 s, the passage's lines one after another", () => {
  const p = waitingShape(job(FIXTURES.kumayl())).props;
  const t = timeline(p, voiceOf({ tr1: 6, tr2: 5.5 }));
  const segs = sound(p, t);
  assert.deepEqual(segs.map((s) => s.who), ["narrator tr1", "narrator tr2"]);
  assert.ok(seconds(t) >= 20 && seconds(t) <= 30, `${seconds(t)} s`);
});

test("dua-story: at most 10 s, silent or with the narrator", () => {
  const p = waitingShape(job(FIXTURES["dua-story"]())).props;
  const narrated = timeline(p, voiceOf({ tr1: 5 }));
  sound(p, narrated);
  assert.ok(seconds(narrated) <= 10 && seconds(narrated) >= 8, `${seconds(narrated)} s`);
  const q = FIXTURES["dua-story"]();
  q.voice = { engine: "none" };
  const quiet = waitingShape(job(q)).props;
  const t = timeline(quiet, voiceOf({ tr1: 5 }));
  assert.equal(t.speakers.length, 0);
  assert.ok(seconds(t) <= 10 && seconds(t) >= 8, `${seconds(t)} s`);
});

test("occasion: about 15 s, very slow", () => {
  const p = waitingShape(job(FIXTURES.occasion())).props;
  for (const voice of [voiceOf({ name: 2, line: 4.5 }), null]) {
    const t = timeline(p, voice);
    sound(p, t);
    assert.ok(seconds(t) >= 14 && seconds(t) <= 17, `${seconds(t)} s`);
  }
});

test("mirror: 45–75 s, the qari's two verses in their own scene, the narrator never over him", () => {
  const p = waitingShape(job(FIXTURES.mirror())).props;
  const t = timeline(p, voiceOf({ hook: 5, fold: 11, pair: 8, end: 5 }), { basmala: null, verses: [clip(2, 6.5), clip(12, 7.2)] });
  const segs = sound(p, t);
  assert.deepEqual(segs.map((s) => s.who), ["narrator hook", "narrator fold", "qari 2", "qari 12", "narrator pair", "narrator end"]);
  const rec = t.scenes.find((s) => s.id === "recite");
  assert.equal(rec.clips.length, 2);
  for (const c of rec.clips) assert.ok(c.from >= rec.from && c.from + c.len <= rec.from + rec.dur);
  assert.ok(seconds(t) >= 45 && seconds(t) <= 75, `${seconds(t)} s`);
  // a longer narration still fits: the scenes grow with their lines
  const long = timeline(p, voiceOf({ hook: 7, fold: 16, pair: 12, end: 7 }), { basmala: null, verses: [clip(2, 9), clip(12, 9)] });
  sound(p, long);
  assert.ok(seconds(long) <= 75, `${seconds(long)} s`);
});

test("tafsir: a silent twin of the carousel, one scene per slide", () => {
  const p = waitingShape(job(FIXTURES.tafsir())).props;
  const t = timeline(p, voiceOf({}));
  assert.equal(t.speakers.length, 0);
  assert.equal(t.scenes.length, 5);
  assert.ok(t.scenes.every((s) => s.dur >= 3 * FPS));
  const one = FIXTURES.tafsir();
  one.tafsir.paragraphs = [FA(5)];
  assert.equal(waitingShape(job(one)).props.scenes.length, 2);
  assert.equal(TAFSIR_MAX_SLIDES, 5);
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
