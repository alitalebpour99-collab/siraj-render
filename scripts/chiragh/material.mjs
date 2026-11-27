// What one «چراغ» video is made of, from the job's props (Siraj's API, exactly as served), the
// narrator's lines (scripts/voice.mjs) and the qari's clips with their word times
// (scripts/qari.mjs, refined against the clip's own sound: align-refine.mjs). Nothing here
// writes a text of its own: the titles, the hooks and the sources lines are the approved fixed
// lines of each template (or the job's own approved lines); the concept writer may only CHOOSE
// among them. Logs carry ids, counts and seconds only.
import { wordParts } from "../../src/words.ts";
import { splitLeadingBasmala } from "../../src/basmala.ts";
import { NIGHT_SERIES } from "../../src/night.ts";
import { hookHead } from "../../src/lamp/zones.ts";
import { dataArt } from "./data-art.mjs";
// a surah's Persian name, the same rule as the source lines (owner 27 Nov: «سورهٔ ناس», not «سورهٔ الناس»)
import { faSurahName } from "../writing.mjs";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const faNum = (n) => String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
export const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
/** «·» and «|» never stand beside Persian (the owner's rule). */
const noBars = (s) => String(s).replace(/\s*[·|]\s*/g, "، ");

/** Which of the seven templates draws this job (null: a format that is not one of the seven). */
export function templateOf(props) {
  if (props.kind === "verse") return props.night ? "night-verse" : "verse-by-verse";
  if (props.kind === "insight") {
    if (props.format === "word-choice") return "word-choice";
    if (props.format === "one-line") return "distances";
    if (["only", "myth-fact", "counted", "meccan-medinan", "mushaf-map", "middle", "revelation-order", "opening-letters"].includes(props.format)) return "only-counts";
    return null;
  }
  if (props.kind === "waiting" && props.format === "writing") return "writing";
  if (props.kind === "path") return "path";
  return null;
}

/** The idea families of each template (style bible v2 §4). */
export const FAMILIES = {
  "verse-by-verse": ["key-word", "question-verse", "night-and-day"],
  "night-verse": ["key-word", "night-and-day", "question-verse"],
  "word-choice": ["root", "places", "forgotten-meaning"],
  distances: ["distance", "first-and-last", "only-once"],
  "only-counts": ["only-once", "first-and-last", "distance"],
  path: ["path", "one-day", "place"],
  writing: ["one-sentence", "key-word", "place"],
};
/** The hook types a concept may name (storyboard-fa.md §3). */
export const HOOK_TYPES = ["question", "odd-number", "wrong-belief", "object-close-up", "before-after", "countdown"];

const words = (s) => wordParts(s).count;

/** The qari's clip of an ayah (or the basmala: ayah null) with its word times in seconds of the clip. */
function clipOf(qari, ayah) {
  if (!qari) return null;
  const c = ayah === null ? qari.basmala : qari.verses.find((v) => v.ayah === ayah);
  return c ? { file: c.file, seconds: c.seconds, mode: c.mode, words: c.words } : null;
}
const lineOf = (voice, id) => (voice?.lines ?? []).find((l) => l.id === id) ?? null;

/** The verses of a verse job, each as shown: the basmala line apart (its own clip), every text exactly as stored. */
function versesOf(props, qari, recite, refLine) {
  const out = [];
  const unit = recite;
  const split = unit.from === 1 ? splitLeadingBasmala(unit.surah.number, 1, unit.ayahs[0].text, unit.opening) : null;
  if (split && (props.kind === "verse" || unit.basmala)) {
    out.push({ id: "b", ayah: null, surah: unit.surah.number, key: `${unit.surah.number}:1 basmala`, text: split.basmala, translation: null, refLine: "", seal: "", clip: clipOf(qari, null) });
  }
  for (const a of unit.ayahs) {
    const text = a.ayahNumber === 1 && split ? split.rest : a.text;
    out.push({ id: `a${a.ayahNumber}`, ayah: a.ayahNumber, surah: unit.surah.number, key: `${unit.surah.number}:${a.ayahNumber}`, text, translation: a.translation ?? null, refLine: refLine(a.ayahNumber), seal: arNum(a.ayahNumber), clip: clipOf(qari, a.ayahNumber), locator: a.locator });
  }
  return out;
}

/** The reciters' names in Persian (the Persian card never shows a Latin name). */
export const RECITERS_FA = { 7: "مشاری راشد العفاسی" };

/** The sources line of the close (one line; the details are in the caption). */
function creditsOf(lang, translator, qari) {
  const reciter = qari ? (lang === "fa" ? (RECITERS_FA[qari.recitationId] ?? null) : qari.reciter?.name ?? null) : null;
  if (lang === "fa") return noBars(["متن: پروژهٔ تنزیل", translator ? `ترجمه: ${translator}` : null, reciter ? `قاری: ${reciter}` : null].filter(Boolean).join("؛ "));
  return ["Text: Tanzil Project", translator ? `Translation: ${translator}` : null, reciter ? `Recitation: ${reciter}` : null].filter(Boolean).join(" · ");
}

/**
 * The material of one video: its template, titles, the hooks it may open with, the verses (with
 * the qari's clips), the narrator's lines, the order in which they sound, the data picture of the
 * counting templates, and the sources line.
 */
export function materialOf(props, voice, qari) {
  const template = templateOf(props);
  if (!template) throw new Error(`chiragh: ${props.kind}/${props.format ?? ""} is not one of the seven templates`);
  const lang = props.lang;
  const fa = lang === "fa";
  const m = { id: props.id, template, lang, title: null, hooks: [], verses: [], lines: [], order: [], data: null, credits: "", families: FAMILIES[template], anchorFixed: null };

  if (props.kind === "verse") {
    const s = props.surah;
    const tr = props.source.translation.translatorName;
    const refLine = props.night
      ? (k) => (fa ? `سورهٔ ${faSurahName(s.nameArabic)}، آیهٔ ${faNum(k)}؛ ترجمهٔ ${tr}` : `${s.number}:${k} · ${tr}`)
      : (k) => (fa ? `آیهٔ ${faNum(k)} از ${faNum(props.ayahs.length)}؛ ترجمهٔ ${tr}` : `${s.number}:${k} · ${tr}`);
    m.verses = versesOf(props, qari, { ...props, basmala: true }, refLine);
    if (props.night) {
      m.title = { main: props.night.title[lang], sub: NIGHT_SERIES[lang] };
    } else {
      m.title = fa ? { main: `سورهٔ ${faSurahName(s.nameArabic)}`, sub: props.whole ? "آیه به آیه، با معنا" : `آیه‌های ${faNum(props.from)} تا ${faNum(props.to)}، با معنا` } : { main: `Surah ${s.tname}`, sub: props.whole ? "Verse by verse, with meaning" : `Verses ${props.from}–${props.to}, with meaning` };
    }
    m.hooks = [m.title.main];
    for (const v of m.verses) {
      if (v.clip) m.order.push({ kind: "qari", verse: v.id });
      // the narrator reads the translation after the qari, never over him (none at night)
      const l = !props.night && v.ayah !== null ? lineOf(voice, `a${v.ayah}`) : null;
      if (l) {
        m.lines.push({ id: l.id, text: v.translation, say: v.translation, file: l.file, seconds: l.seconds, words: l.words ?? null, verse: v.id });
        m.order.push({ kind: "narr", line: l.id });
      }
    }
    m.credits = creditsOf(lang, tr, qari);
    return m;
  }

  if (props.kind === "insight") {
    const series = props.series?.n ? (fa ? `شمارهٔ ${faNum(props.series.n)}` : `No. ${props.series.n}`) : "";
    const hookLine = props.narration.find((n) => n.id === "hook");
    const head = hookLine ? hookHead(hookLine.show, hookLine.head) : null;
    m.hooks = head ? [head] : [];
    const sub = { "word-choice": fa ? "چرا این واژه؟" : "Why this word?", distances: fa ? "فاصله‌ها، شمرده از متن" : "The distances, counted", "only-counts": fa ? "شمرده از متن قرآن" : "Counted from the text" }[template];
    m.title = { main: head ?? sub, sub: [sub, series].filter(Boolean).join(fa ? "، " : " · ") };
    const tr = props.recite?.translation?.translatorName ?? null;
    if (props.recite) {
      const r = props.recite;
      m.verses = versesOf(props, qari, r, (k) => (fa ? `سورهٔ ${faSurahName(r.surah.nameArabic)}، آیهٔ ${faNum(k)}${tr ? `؛ ترجمهٔ ${tr}` : ""}` : `${r.surah.number}:${k}${tr ? ` · ${tr}` : ""}`));
    }
    for (const sc of props.scenes) {
      if (sc.id === "recite" || (!sc.lines.length && sc.id.startsWith("recite"))) {
        for (const v of m.verses) if (v.clip) m.order.push({ kind: "qari", verse: v.id });
        continue;
      }
      for (const id of sc.lines) {
        const n = props.narration.find((x) => x.id === id);
        const l = lineOf(voice, id);
        if (!n) continue;
        // «چرا این واژه؟»: the tafsir's one sentence stands on screen exactly as Siraj served it, after its line
        const shown = id === "tafsir" && props.spans?.tafsir ? `${n.show} «${props.spans.tafsir}»` : n.show;
        m.lines.push({ id, text: shown, say: n.say, file: l?.file ?? null, seconds: l?.seconds ?? Math.max(2.2, words(n.show) * 0.42), words: l?.words && n.say === shown ? l.words : null, scene: sc.id });
        m.order.push({ kind: "narr", line: id, silent: !l });
      }
    }
    m.data = dataArt(template, props);
    m.anchorFixed = m.data?.id ?? null;
    // «چرا این واژه؟»: the key word is the word the episode is about (its place in the stored text), never a model's choice
    const form = props.data?.form;
    if (template === "word-choice" && form && props.recite && `${props.recite.surah.number}:${props.recite.from}` === form.verse) m.forcedKey = { verse: `a${props.recite.from}`, index: form.from };
    m.credits = creditsOf(lang, tr, qari);
    return m;
  }

  if (props.kind === "waiting" && props.format === "writing") {
    const x = props.writing;
    m.title = { main: x.title, sub: "نوشته‌ای از سراج" };
    m.hooks = [x.title];
    for (const sc of props.scenes) {
      const band = /^s(\d+)b(\d+)$/.exec(sc.id);
      for (const id of sc.lines) {
        const n = props.narration.find((y) => y.id === id);
        const l = lineOf(voice, id);
        if (!n) continue;
        if (band) {
          const sec = x.sections[Number(band[1]) - 1];
          const wl = sec?.lines[Number(band[2]) - 1];
          if (wl) {
            const vid = `w${band[1]}b${band[2]}`;
            m.verses.push({ id: vid, ayah: wl.number, surah: 0, key: sec.ref, text: wl.arabic, translation: wl.persian, refLine: sec.ref, seal: sec.kind === "quran" ? arNum(wl.number) : "", clip: null, readBy: id });
          }
        }
        m.lines.push({ id, text: n.show, say: n.say, file: l?.file ?? null, seconds: l?.seconds ?? Math.max(2.2, words(n.show) * 0.42), words: null, verse: band ? `w${band[1]}b${band[2]}` : null, scene: sc.id });
        m.order.push({ kind: "narr", line: id, silent: !l });
      }
    }
    m.credits = noBars((x.sources ?? []).slice(0, 2).join("؛ "));
    return m;
  }

  // «راه»: a line map of places, each with its source (props.places from Siraj's sourced data); nothing is placed without one
  if (props.kind === "path") {
    for (const p of props.places ?? []) if (!p.source) throw new Error("path: a place without its source");
    m.title = { main: props.title, sub: fa ? "راه، روی نقشه" : "The road, on the map" };
    m.hooks = [props.title];
    for (const n of props.narration ?? []) {
      const l = lineOf(voice, n.id);
      m.lines.push({ id: n.id, text: n.show, say: n.say, file: l?.file ?? null, seconds: l?.seconds ?? Math.max(2.2, words(n.show) * 0.42), words: l?.words && n.say === n.show ? l.words : null });
      m.order.push({ kind: "narr", line: n.id, silent: !l });
    }
    m.data = dataArt("path", props);
    m.anchorFixed = "linemap";
    m.credits = noBars((props.sources ?? []).join("؛ "));
    return m;
  }
  throw new Error("chiragh: no material");
}

/** The words a concept may light as its key word: every word of every verse, by index (the stored text cut at its spaces). */
export function keyWordChoices(m) {
  const out = [];
  for (const v of m.verses) {
    if (v.ayah === null) continue;
    const parts = wordParts(v.text).parts.filter((p) => p.word !== null);
    const seen = new Set();
    for (const p of parts) {
      if (seen.has(p.word)) continue;
      seen.add(p.word);
      out.push({ verse: v.id, index: p.word, text: p.text });
    }
  }
  return out;
}
