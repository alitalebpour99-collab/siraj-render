// The props of the templates that wait for Siraj's API (S3b) — the Persian Nahj al-balagha
// saying, the Kumayl passage of Thursday night, the dhikr Story, the short tafsir carousel, the
// occasion — and of the Mirror (approve-first): props/<job>.json for scripts/fetch.mjs, which
// routes every format of WAITING_FORMATS here. None of them is in the worker's CAN: they stay off
// until Siraj's API serves their texts (the Mirror until the owner turns it on).
//
// Siraj's API does not serve Nahj al-balagha, Mafatih or the tafsir yet, so the job carries those
// texts, exactly as the service will have them from the API; this file checks their shape and
// copies them verbatim (nothing here types, trims, joins or translates a text). The Quran text
// the tafsir carousel and the Mirror show IS served: it is read from Siraj's API in the run and
// checked against the job's `expect`, as for every other format. The log shows ids, counts and
// lengths only.
//
// ---------------------------------------------------------------------------------------------
// The job's props (job.props), per format. Every format may also carry `studio` (the control
// room's studio; its look defaults to the format's own) and `voice` (as for every job;
// `voice.engine: "none"` makes the video silent). `expect.numbers`, when given, is compared key
// for key with the facts listed here (and repeated in the manifest).
//
//   nahj-hikma (fa)  «حکمت n · نهج‌البلاغه»
//     text: { number,                       // the saying's number (facts: { hikma })
//             arabic,                       // the Arabic, verbatim (1–400 characters)
//             persian,                      // the Persian translation, verbatim (1–600)
//             source: { title, translator, publisher, url, releaseKey? },
//             textHashSha256? }             // sha256 of `arabic` when the API names one
//   kumayl (fa)      «شب جمعه · دعای کمیل · بند n»
//     text: { number,                       // the passage (band) number (facts: { passage })
//             arabic (1–600), persian (1–900),
//             source: { title, translator?, publisher, url, releaseKey? }, textHashSha256? }
//   dua-story (fa)   «ذکر امروز · <weekday>» (a Story of about 9 s)
//     text: { day: "sat"|"sun"|"mon"|"tue"|"wed"|"thu"|"fri",
//             count?,                       // how many times the dhikr is said (the ring counts to it)
//             arabic (1–160), persian (1–240),
//             source: { title, translator?, publisher, url, releaseKey? }, textHashSha256? }
//             (facts: { day, count? })
//   For these three, `narration` is optional: one to four lines tr1…tr4 whose `show` is the
//   served Persian split at its spaces and whose `say` is exactly its `show` (the narrator reads
//   the translation only, never the Arabic); without it the whole Persian is one line, tr1. The
//   dhikr Story takes one line (tr1).
//
//   tafsir (fa)      «تفسیر نمونه · جلد v، ص p» (a carousel of 1 + paragraphs slides, silent)
//     tafsir: { verse: { surah, from, to },  // at most three ayahs; Arabic + Makarem from the API
//               paragraphs: [ … ],           // one to four paragraphs of the record, verbatim (≤ 700 each)
//               volume?, page?,              // only when the record has them
//               source: { title, publisher, url, releaseKey? } }
//     no narration. expect: { textRelease, translationRelease?, ayahHashes? }.
//     (facts: { surah, from, to, slides, volume?, page? })
//
//   occasion (fa, en) «بنا بر اعلام <authority>» (always the muted pewter look, calm motion)
//     occasion: { authority (1–80), name (1–60), line (1–220), url? }
//     narration optional: `name` and `line`, each reading exactly the occasion's name / line.
//
//   mirror (en, fa)  «The Mirror» / «آینه» (approve-first: its narration is prose the owner approved)
//     mirror: { surah,
//               scholar: { name, work },     // always on screen, with «one reading»
//               sections: [{ from, to }, …], // 3–15, an odd number, in order, covering the surah
//               center,                      // the index of the middle section: (sections − 1) / 2
//               recite: { ayahs: [a, b] } }  // one verse of a section and one of its pair (a < b)
//     narration (required): ids hook, fold, fold2?, pair, pair2?, end — hook at least.
//     expect: { textRelease, translationRelease?, ayahHashes? (of a and b) }.
//     (facts: { surah, sections, center, pair: [a, b] })
// ---------------------------------------------------------------------------------------------
import { DataChanged, check, checkTrust, releaseOf, same, sha256, siraj } from "./lib.mjs";
import { MIRROR_LINES, TAFSIR_MAX_SLIDES, TR_LINES, WAITING_LANGS, WAITING_LOOK, scenesOf } from "../src/waitingPlan.ts";

/** The formats this file draws. */
export const WAITING_FORMATS = new Set(Object.keys(WAITING_LANGS));

export const WEEKDAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

/** How long a text may be and still stand calmly in its frame (characters). */
const LIMITS = {
  "nahj-hikma": { arabic: 400, persian: 600 },
  kumayl: { arabic: 600, persian: 900 },
  "dua-story": { arabic: 160, persian: 240 },
};

const isStr = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isInt = (v, min, max = Number.MAX_SAFE_INTEGER) => Number.isInteger(v) && v >= min && v <= max;
const absent = (v) => v === undefined || v === null;
const flat = (s) => s.replace(/\s+/gu, " ").trim();
const isUrl = (v) => typeof v === "string" && v.length <= 300 && /^https:\/\/\S+$/.test(v);

function sourceOf(s, what, { translator = false } = {}) {
  check(s && typeof s === "object", `${what}: source`);
  check(isStr(s.title, 120), `${what}: source.title`);
  check(isStr(s.publisher, 160), `${what}: source.publisher`);
  check(isUrl(s.url), `${what}: source.url (https)`);
  check(translator ? isStr(s.translator, 120) : absent(s.translator) || isStr(s.translator, 120), `${what}: source.translator`);
  check(absent(s.releaseKey) || isStr(s.releaseKey, 160), `${what}: source.releaseKey`);
  return { title: s.title, publisher: s.publisher, url: s.url, translator: s.translator ?? null, releaseKey: s.releaseKey ?? null };
}

/** A Nahj saying, a Kumayl passage or the day's dhikr, checked and copied as the job carries it. */
function textOf(p) {
  const f = p.format;
  const x = p.text;
  const lim = LIMITS[f];
  check(x && typeof x === "object", `${f}: props.text`);
  check(isStr(x.arabic, lim.arabic), `${f}: text.arabic (1–${lim.arabic} characters)`);
  check(isStr(x.persian, lim.persian), `${f}: text.persian (1–${lim.persian} characters)`);
  if (!absent(x.textHashSha256)) {
    check(/^[0-9a-f]{64}$/.test(x.textHashSha256), `${f}: text.textHashSha256`);
    check(sha256(x.arabic) === x.textHashSha256, `${f}: the Arabic is the text its hash names`);
  }
  const text = { number: null, day: null, count: null, arabic: x.arabic, persian: x.persian, textHashSha256: x.textHashSha256 ?? null, source: sourceOf(x.source, f, { translator: f === "nahj-hikma" }) };
  if (f === "dua-story") {
    check(WEEKDAYS.includes(x.day), `${f}: text.day (${WEEKDAYS.join("|")})`);
    check(absent(x.count) || isInt(x.count, 1, 1000), `${f}: text.count (1–1000)`);
    text.day = x.day;
    text.count = x.count ?? null;
  } else {
    check(isInt(x.number, 1, 10000), `${f}: text.number`);
    text.number = x.number;
  }
  return text;
}

/** The narrator's lines of a translated text: the served translation, split at its spaces only. */
function translationLines(p, persian, ids) {
  const given = Array.isArray(p.narration) && p.narration.length ? p.narration : [{ id: ids[0], show: persian, say: persian }];
  check(given.length <= ids.length, `${p.format}: at most ${ids.length} narration lines`);
  given.forEach((l, i) => {
    check(l && l.id === ids[i], `${p.format}: narration line ${i + 1} is ${ids[i]}`);
    check(isStr(l.show, 1000) && l.say === l.show, `${p.format}: narration ${ids[i]} reads exactly what it shows`);
  });
  check(flat(given.map((l) => l.show).join(" ")) === flat(persian), `${p.format}: the narration is the served translation, split at its spaces`);
  return given.map((l) => ({ id: l.id, show: l.show, say: l.say }));
}

function tafsirOf(p) {
  const x = p.tafsir;
  check(x && typeof x === "object", "tafsir: props.tafsir");
  const v = x.verse;
  check(v && isInt(v.surah, 1, 114) && isInt(v.from, 1, 286) && isInt(v.to, v.from, 286) && v.to - v.from <= 2, "tafsir: verse { surah, from, to } of at most three ayahs");
  const most = TAFSIR_MAX_SLIDES - 1;
  check(Array.isArray(x.paragraphs) && x.paragraphs.length >= 1 && x.paragraphs.length <= most, `tafsir: 1–${most} paragraphs`);
  x.paragraphs.forEach((t, i) => check(isStr(t, 700), `tafsir: paragraph ${i + 1} (1–700 characters)`));
  check(absent(x.volume) || isInt(x.volume, 1, 99), "tafsir: volume");
  check(absent(x.page) || isInt(x.page, 1, 3000), "tafsir: page");
  check(!(Array.isArray(p.narration) && p.narration.length), "tafsir: the carousel has no narration");
  return { at: { surah: v.surah, from: v.from, to: v.to }, paragraphs: [...x.paragraphs], volume: x.volume ?? null, page: x.page ?? null, source: sourceOf(x.source, "tafsir") };
}

function occasionOf(p) {
  const x = p.occasion;
  check(x && typeof x === "object", "occasion: props.occasion");
  check(isStr(x.authority, 80), "occasion: authority (1–80 characters)");
  check(isStr(x.name, 60), "occasion: name (1–60 characters)");
  check(isStr(x.line, 220), "occasion: line (1–220 characters)");
  check(absent(x.url) || isUrl(x.url), "occasion: url (https)");
  const own = { name: x.name, line: x.line };
  const given = Array.isArray(p.narration) && p.narration.length ? p.narration : [{ id: "name", show: x.name, say: x.name }, { id: "line", show: x.line, say: x.line }];
  const ids = ["name", "line"];
  check(given.length <= 2, "occasion: at most two narration lines");
  given.forEach((l, i) => {
    check(l && l.id === ids[i], `occasion: narration line ${i + 1} is ${ids[i]}`);
    check(l.show === own[l.id] && l.say === l.show, `occasion: narration ${l.id} reads exactly the occasion's ${l.id}`);
  });
  return { occasion: { authority: x.authority, name: x.name, line: x.line, url: x.url ?? null }, narration: given.map((l) => ({ id: l.id, show: l.show, say: l.say })) };
}

function mirrorOf(p) {
  const x = p.mirror;
  check(x && typeof x === "object", "mirror: props.mirror");
  check(isInt(x.surah, 1, 114), "mirror: surah");
  check(x.scholar && isStr(x.scholar.name, 80) && isStr(x.scholar.work, 120), "mirror: scholar { name, work }");
  const s = x.sections;
  check(Array.isArray(s) && s.length >= 3 && s.length <= 15 && s.length % 2 === 1, "mirror: 3–15 sections, an odd number (a ring around one centre)");
  s.forEach((sec, i) => {
    check(sec && isInt(sec.from, 1, 286) && isInt(sec.to, sec.from, 286), `mirror: section ${i + 1} { from, to }`);
    check(i === 0 ? sec.from === 1 : sec.from === s[i - 1].to + 1, `mirror: section ${i + 1} begins where the one before it ends`);
  });
  const m = (s.length - 1) / 2;
  check(x.center === m, `mirror: center is the middle section (${m})`);
  const pair = x.recite?.ayahs;
  check(Array.isArray(pair) && pair.length === 2 && pair.every((a) => isInt(a, 1, 286)) && pair[0] < pair[1], "mirror: recite.ayahs [a, b] with a before b");
  const at = (a) => s.findIndex((sec) => a >= sec.from && a <= sec.to);
  const i = at(pair[0]);
  const j = at(pair[1]);
  check(i >= 0 && j >= 0 && i !== j && i + j === 2 * m, "mirror: the two recited verses stand in paired sections");
  const n = p.narration;
  check(Array.isArray(n) && n.length > 0, "mirror: the approved narration lines");
  const seen = new Set();
  for (const l of n) {
    check(l && MIRROR_LINES.includes(l.id) && !seen.has(l.id), `mirror: narration line ${l?.id} has one place in the video`);
    seen.add(l.id);
    check(isStr(l.show, 400) && isStr(l.say, 400), `mirror: narration ${l.id}`);
  }
  check(seen.has("hook"), "mirror: the narration has its hook");
  return {
    mirror: { surah: x.surah, scholar: { name: x.scholar.name, work: x.scholar.work }, sections: s.map((sec) => ({ from: sec.from, to: sec.to })), center: m, pair: [pair[0], pair[1]] },
    narration: n.map((l) => ({ id: l.id, show: l.show, say: l.say })),
  };
}

/** The studio of a waiting job: the job's own, its look defaulting to the format's (the occasion is always muted). */
function studioFor(p) {
  const s = p.studio && typeof p.studio === "object" ? p.studio : {};
  if (p.format === "occasion") return { ...s, look: "pewter", motion: "calm", particles: false };
  return { ...s, look: s.look ?? WAITING_LOOK[p.format] };
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);

/**
 * The checked props of a waiting job without what Siraj's API serves (no network): the texts the
 * job carries, the narration, the scenes and the facts; `need` names the Quran verses still to
 * read (the tafsir's verse, the Mirror's pair), or null. Throws on a bad shape.
 */
export function waitingShape(job) {
  const p = job?.props ?? {};
  const f = p.format;
  check(WAITING_FORMATS.has(f), `a waiting format (${f})`);
  check(WAITING_LANGS[f].includes(p.lang), `${f} is drawn in ${WAITING_LANGS[f].join(", ")}`);
  const props = {
    kind: "waiting",
    id: job.id,
    lang: p.lang,
    format: f,
    scenes: [],
    narration: [],
    text: null,
    tafsir: null,
    occasion: null,
    mirror: null,
    recite: null,
    silent: f === "tafsir" || p.voice?.engine === "none",
    source: { quran: { releaseKey: null }, surahMetadata: { sha256: null } },
    studio: studioFor(p),
    facts: {},
  };
  let need = null;
  let slides = 1;
  if (f === "nahj-hikma" || f === "kumayl" || f === "dua-story") {
    const text = textOf(p);
    props.text = text;
    props.narration = translationLines(p, text.persian, f === "dua-story" ? ["tr1"] : TR_LINES);
    props.facts = f === "nahj-hikma" ? { hikma: text.number } : f === "kumayl" ? { passage: text.number } : { day: text.day, ...(text.count ? { count: text.count } : {}) };
  } else if (f === "tafsir") {
    const t = tafsirOf(p);
    props.tafsir = { verse: null, paragraphs: t.paragraphs, volume: t.volume, page: t.page, source: t.source };
    need = { surah: t.at.surah, ayahs: range(t.at.from, t.at.to) };
    slides = 1 + t.paragraphs.length;
    props.facts = { surah: t.at.surah, from: t.at.from, to: t.at.to, slides, ...(t.volume ? { volume: t.volume } : {}), ...(t.page ? { page: t.page } : {}) };
  } else if (f === "occasion") {
    const o = occasionOf(p);
    props.occasion = o.occasion;
    props.narration = o.narration;
  } else {
    const m = mirrorOf(p);
    props.mirror = m.mirror;
    props.narration = m.narration;
    need = { surah: m.mirror.surah, ayahs: m.mirror.pair };
    props.facts = { surah: m.mirror.surah, sections: m.mirror.sections.length, center: m.mirror.center, pair: m.mirror.pair };
  }
  props.scenes = scenesOf(f, slides);
  for (const [k, v] of Object.entries(job.expect?.numbers ?? {})) if (!same(props.facts[k], v)) throw new DataChanged(`${f}: ${k}`);
  return { props, need };
}

/** Quran verses from Siraj's API, checked as every format checks them: trust, release, hashes, `expect`. */
async function versesOf(job, surahNo, list) {
  const e = job.expect ?? {};
  const lang = job.props.lang;
  check(typeof e.textRelease === "string" && e.textRelease.length > 0, "expect.textRelease names the Quran text");
  // imported here, not at the top: fetch.mjs imports this file
  const { readIndex } = await import("./fetch.mjs");
  const idx = await readIndex();
  if (idx.release.releaseKey !== e.textRelease) throw new DataChanged("text release");
  const s = idx.surahs[surahNo - 1];
  for (const n of list) check(n <= s.ayahCount, `verse ${surahNo}:${n} is inside the surah`);
  const rel = encodeURIComponent(e.textRelease);
  const ayahs = [];
  let translation = null;
  for (const n of list) {
    const body = await siraj(`/api/quran/${surahNo}?from=${n}&to=${n}&lang=${lang}&exegesis=0&release=${rel}`);
    checkTrust(body, `verse ${surahNo}:${n}`);
    if (body.release?.releaseKey !== e.textRelease) throw new DataChanged(`text release of ${surahNo}:${n}`);
    const a = body.ayahs?.[0];
    check(body.ayahs?.length === 1 && a.surahNumber === surahNo && a.ayahNumber === n && typeof a.text === "string" && a.text.length > 0, `verse ${surahNo}:${n}`);
    check(sha256(a.text) === a.textHashSha256, `the hash of ${surahNo}:${n}`);
    check(!body.translationGap && body.translation?.language === lang && typeof a.translation === "string" && a.translation.length > 0, `the translation of ${surahNo}:${n}`);
    if (e.translationRelease && body.translation?.release?.releaseKey !== e.translationRelease) throw new DataChanged("translation release");
    const tr = body.translation;
    translation ??= { title: tr.title, translatorName: tr.translatorName, language: tr.language, termsText: tr.release?.translation?.termsText ?? null, release: releaseOf(tr.release) };
    ayahs.push({ ayahNumber: a.ayahNumber, text: a.text, translation: a.translation, locator: a.locator, textHashSha256: a.textHashSha256 });
  }
  if (e.ayahHashes && !same(ayahs.map((a) => a.textHashSha256), e.ayahHashes)) throw new DataChanged("ayah hashes");
  // the stored 1:1 of the same release, so a first ayah's basmala line can be set apart (as Siraj's reader does)
  let opening = null;
  if (list.includes(1) && surahNo !== 1 && surahNo !== 9) {
    const one = await siraj(`/api/quran/1?from=1&to=1&translation=0&release=${rel}`);
    checkTrust(one, "opening");
    check(one.release?.releaseKey === e.textRelease && one.ayahs?.length === 1, "opening ayah of the same release");
    opening = one.ayahs[0].text;
  }
  const m = idx.surahMetadataSource;
  return {
    surah: { number: surahNo, ayahCount: s.ayahCount, nameArabic: s.nameArabic, revelationPlace: s.revelationPlace, revelationOrder: s.revelationOrder },
    ayahs,
    translation,
    opening,
    quran: releaseOf(idx.release),
    metadata: { title: m.title, url: m.url, licenseName: m.licenseName, licenseUrl: m.licenseUrl, sha256: m.sha256 },
  };
}

/** props/<id>.json for a waiting format (fetch.mjs writes it): the job's texts, and the Quran verses from Siraj's API. */
export async function waitingProps(job) {
  const { props, need } = waitingShape(job);
  if (need) {
    const v = await versesOf(job, need.surah, need.ayahs);
    props.source = { quran: v.quran, surahMetadata: v.metadata };
    const unit = { surah: v.surah, from: need.ayahs[0], to: need.ayahs[need.ayahs.length - 1], ayahs: v.ayahs, opening: v.opening, basmala: false, translation: v.translation };
    if (props.format === "mirror") {
      check(props.mirror.sections[props.mirror.sections.length - 1].to === v.surah.ayahCount, "mirror: the sections cover the whole surah");
      // the two paired verses, recited by the qari (scripts/qari.mjs cuts the clips of `recite.ayahs`)
      props.recite = unit;
    } else {
      // the carousel is silent: its verse is shown, never recited
      props.tafsir.verse = unit;
    }
  }
  const lengths = props.text ? `, text ${props.text.arabic.length}/${props.text.persian.length}` : props.tafsir ? `, paragraphs ${props.tafsir.paragraphs.map((t) => t.length).join("/")}` : "";
  console.log(`${job.id}: ${props.format} (${props.lang}), ${props.narration.length} narration lines (${props.narration.map((l) => l.id).join(",")}), ${props.scenes.length} scenes${lengths}${props.silent ? ", silent" : ""}${need ? `, verses ${need.surah}:${need.ayahs.join(",")}` : ""}`);
  return props;
}
