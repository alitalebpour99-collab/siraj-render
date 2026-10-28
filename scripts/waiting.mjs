// The props of the Persian templates on the books Siraj serves beside the Quran (S3e) — the
// Nahj al-balagha saying, the Kumayl passage of Thursday night, the dhikr Story, the short tafsir
// carousel — and of the occasion and the Mirror: props/<job>.json for scripts/fetch.mjs, which
// routes every format of WAITING_FORMATS here.
//
// Every text is read from Siraj in the run, exactly as served (scripts/books.mjs says where and
// how), and checked: the release the job names, the SHA-256 of every string the service planned
// with (`expect.textHashes`), the numbers. Nothing in a job carries a text of a book; the job names
// a place (a saying's number, a dua's key and lines, a tafsir record), and only the service's own
// fixed lines (the source said by its name, «the rest on Siraj») come in `narration`. The narrator
// reads the Persian only, never the Arabic. The log shows ids, counts and lengths only.
//
// ---------------------------------------------------------------------------------------------
// The job's props (job.props), per format. Every format may also carry `studio` (its look
// defaults to the format's own) and `voice` (`voice.engine: "none"` makes the video silent).
//
//   nahj-hikma (fa)  «حکمت n · نهج‌البلاغه»
//     nahj: { number }                       // the saying (books.mjs nahjPath); one record, fits FIT.nahj
//     narration: [{ id: "src", show, say }]  // optional: the source said by name (a fixed line)
//     expect: { textRelease (the book's release), textHashes: [arabic, persian], numbers: { hikma } }
//   kumayl (fa)      «شب جمعه · دعای کمیل · بندهای a تا b»
//     dua: { key, from, to }                 // Mafatih Novin's Kumayl (MAFATIH.kumayl), whole lines a–b
//     narration: [{ id: "rest", show, say }] // optional: «the rest on Siraj» (a fixed line)
//     expect: { textRelease, textHashes: [ar a, fa a, ar a+1, fa a+1, …], numbers: { from, to } }
//   dua-story (fa)   «ذکر امروز · <weekday>» (a Story of about nine seconds)
//     dhikr: { day: "sat"|…|"fri", key, line } // the weekday's dua (MAFATIH.weekdays) and its line
//     expect: { textRelease, textHashes: [arabic, persian], numbers: { day, line } }
//   For these three the narrator's lines are the served Persian (tr1 …, books.mjs trParts; one a
//   line of the dua) and the fixed lines above, which are plain spoken Persian (scripts/spoken.mjs).
//
//   tafsir (fa)      «تفسیر نمونه · سورهٔ n، آیه‌های a تا b» (a carousel of five slides, silent)
//     tafsir: { record, surah, from, to }    // a Tafsir Nemooneh record and the ayahs it explains (≤ 4)
//     expect: { textRelease, translationRelease, ayahHashes, sourceRelease (the tafsir's release),
//               textHashes: [the record], numbers: { surah, from, to, record, slides, pieces } }
//     slide 1 the ayahs (Arabic and Makarem's Persian, from the Quran API), 2–4 whole sentences of
//     the record (books.mjs tafsirSlides), 5 the source and where the rest is.
//
//   occasion (fa, en) «بنا بر اعلام <authority>» (always the muted pewter look, calm motion)
//     occasion: { authority (1–80), name (1–60), line (1–220), url? }  // the service's fixed lines
//     narration optional: `name` and `line`, each reading exactly the occasion's name / line.
//
//   mirror (en, fa)  «The Mirror» / «آینه» (approve-first: its narration is prose the owner approved)
//     mirror: { surah, scholar: { name, work }, sections: [{ from, to }, …] (3–15, odd, in order,
//               covering the surah), center, recite: { ayahs: [a, b] } }
//     narration (required): ids hook, fold, fold2?, pair, pair2?, end — hook at least.
// ---------------------------------------------------------------------------------------------
import { API, DataChanged, UA, check, checkTrust, releaseOf, same, sha256, siraj, sleep } from "./lib.mjs";
import { FIT, MAFATIH, NAHJ, WEEKDAYS, dayIndex, duaLineUrl, duaPassage, duaPath, nahjFits, nahjPath, quranPath, readDuaPage, readHadithPage, slideText, storyLine, tafsirSlides, trParts, wordsOf } from "./books.mjs";
import { readingProblems } from "./spoken.mjs";
import { FIXED_LINES, MIRROR_LINES, TAFSIR_SLIDES, TR_LINES, WAITING_LANGS, WAITING_LOOK, scenesOf } from "../src/waitingPlan.ts";

export { WEEKDAYS };

/** The formats this file draws. */
export const WAITING_FORMATS = new Set(Object.keys(WAITING_LANGS));

const isStr = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isInt = (v, min, max = Number.MAX_SAFE_INTEGER) => Number.isInteger(v) && v >= min && v <= max;
const absent = (v) => v === undefined || v === null;
const isUrl = (v) => typeof v === "string" && v.length <= 300 && /^https:\/\/\S+$/.test(v);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const SITE = "https://siraj.ahura.cloud";

/* ---------- how Siraj is read (the tests pass their own) ---------- */

/** A page of Siraj's reader, as HTML (retried; the error names the path and the status only). */
async function page(path) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${API}${path}`, { headers: { accept: "text/html", ...UA }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) throw Object.assign(new Error(`${path}: HTTP 404`), { final: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      if (error.final || attempt >= 4) throw new Error(`${path}: ${error.message}`);
      await sleep(1500 * attempt);
    }
  }
}

/** One Tafsir Nemooneh record from /api/quran/exegesis/<id>, its guarantees and its hash checked. */
async function exegesis(id) {
  const body = await siraj(`/api/quran/exegesis/${id}`);
  check(body.service === "siraj-public-quran-exegesis", "exegesis: service");
  check(body.trust?.verbatim_text_only === true && body.trust?.text_hash_verified_at_read_time === true && body.trust?.ai_can_publish === false, "exegesis: the API's guarantees");
  check(body.recordId === id && typeof body.text === "string" && body.text.length > 0, `exegesis ${id}`);
  check(sha256(body.text) === body.textHashSha256, `the hash of exegesis ${id}`);
  return body;
}

export const IO = { page, exegesis, verses: (job, surah, ayahs) => versesOf(job, surah, ayahs) };

/* ---------- the shape of a job (no network) ---------- */

/** The service's fixed lines of a job (src, rest): known ids only, plain spoken Persian. */
function fixedLines(p, allowed) {
  const given = Array.isArray(p.narration) ? p.narration : [];
  const seen = new Set();
  return given.map((l) => {
    check(l && allowed.includes(l.id) && !seen.has(l.id), `${p.format}: the fixed line ${l?.id} has one place (${allowed.join(", ") || "none"})`);
    seen.add(l.id);
    check(isStr(l.show, 300) && isStr(l.say, 300), `${p.format}: the fixed line ${l.id}`);
    if (p.lang === "fa") check(readingProblems(l.say).length === 0, `${p.format}: the fixed line ${l.id} is spoken Persian (${readingProblems(l.say).join(", ")})`);
    return { id: l.id, show: l.show, say: l.say };
  });
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
  if (p.lang === "fa") given.forEach((l) => check(readingProblems(l.say).length === 0, `occasion: ${l.id} is spoken Persian`));
  return { occasion: { authority: x.authority, name: x.name, line: x.line, url: x.url ?? null }, narration: given.map((l) => ({ id: l.id, show: l.show, say: l.say })) };
}

/** The studio of a waiting job: the job's own, its look defaulting to the format's (the occasion is always muted). */
function studioFor(p) {
  const s = p.studio && typeof p.studio === "object" ? p.studio : {};
  if (p.format === "occasion") return { ...s, look: "pewter", motion: "calm", particles: false };
  return { ...s, look: s.look ?? WAITING_LOOK[p.format] };
}

/**
 * The checked shape of a waiting job, before anything is read: the place it names, the fixed
 * lines, the scenes, the facts it will show; `need` says what is to be read from Siraj. Throws on
 * a bad shape (CheckError) or when the facts differ from `expect.numbers` (DataChanged).
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
    source: { quran: { releaseKey: null }, surahMetadata: { sha256: null }, text: null },
    texts: [],
    studio: studioFor(p),
    facts: {},
  };
  const need = { page: null, exegesis: null, verses: null };
  let bands = 1;
  if (f === "nahj-hikma") {
    const x = p.nahj;
    check(x && isInt(x.number, NAHJ.first, NAHJ.last), `nahj-hikma: nahj.number (${NAHJ.first}–${NAHJ.last})`);
    props.narration = fixedLines(p, FIXED_LINES[f]);
    props.facts = { hikma: x.number };
    need.page = { path: nahjPath(x.number) };
  } else if (f === "kumayl") {
    const x = p.dua;
    check(x && x.key === MAFATIH.kumayl, "kumayl: dua.key is Dua Kumayl in Mafatih Novin");
    check(isInt(x.from, 1, 1000) && isInt(x.to, x.from, 1000) && x.to - x.from < FIT.kumayl.lines, `kumayl: dua { from, to }, at most ${FIT.kumayl.lines} lines`);
    props.narration = fixedLines(p, FIXED_LINES[f]);
    props.facts = { from: x.from, to: x.to };
    bands = x.to - x.from + 1;
    need.page = { path: duaPath(x.key) };
  } else if (f === "dua-story") {
    const x = p.dhikr;
    check(x && WEEKDAYS.includes(x.day), `dua-story: dhikr.day (${WEEKDAYS.join("|")})`);
    check(x.key === MAFATIH.weekdays[dayIndex(x.day)], "dua-story: dhikr.key is the weekday's dua (Siraj's own row of the days)");
    check(isInt(x.line, 1, 1000), "dua-story: dhikr.line");
    props.narration = fixedLines(p, FIXED_LINES[f]);
    props.facts = { day: x.day, line: x.line };
    need.page = { path: duaPath(x.key) };
  } else if (f === "tafsir") {
    const x = p.tafsir;
    check(x && isInt(x.record, 1, 1e9) && isInt(x.surah, 1, 114) && isInt(x.from, 1, 286) && isInt(x.to, x.from, 286) && x.to - x.from < FIT.tafsir.ayahs, `tafsir: { record, surah, from, to } of at most ${FIT.tafsir.ayahs} ayahs`);
    check(!(Array.isArray(p.narration) && p.narration.length), "tafsir: the carousel has no narration");
    need.exegesis = { id: x.record };
    need.verses = { surah: x.surah, ayahs: range(x.from, x.to) };
    props.facts = { surah: x.surah, from: x.from, to: x.to, record: x.record };
  } else if (f === "occasion") {
    const o = occasionOf(p);
    props.occasion = o.occasion;
    props.narration = o.narration;
  } else {
    const m = mirrorOf(p);
    props.mirror = m.mirror;
    props.narration = m.narration;
    need.verses = { surah: m.mirror.surah, ayahs: m.mirror.pair };
    props.facts = { surah: m.mirror.surah, sections: m.mirror.sections.length, center: m.mirror.center, pair: m.mirror.pair };
  }
  props.scenes = scenesOf(f, bands);
  // what is known before reading is compared now; the rest after the read (factsAfterRead)
  for (const [k, v] of Object.entries(job.expect?.numbers ?? {})) if (k in props.facts && !same(props.facts[k], v)) throw new DataChanged(`${f}: ${k}`);
  return { props, need: need.page || need.exegesis || need.verses ? need : null };
}

/* ---------- reading Siraj ---------- */

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

/** The served strings against the hashes the service planned with, in order. */
function checkHashes(job, texts) {
  const want = job.expect?.textHashes;
  check(Array.isArray(want) && want.length > 0, "expect.textHashes names the planned texts");
  if (!same(texts.map((t) => t.textHashSha256), want)) throw new DataChanged("text hashes");
}

/** The narrator's lines of the served Persian, one id each (tr1 …): the words of the text, in order. */
function trLines(parts) {
  check(parts.length >= 1 && parts.length <= TR_LINES.length, `one to ${TR_LINES.length} lines of the translation`);
  return parts.map((t, i) => ({ id: TR_LINES[i], show: t, say: t }));
}

const ON_SCREEN = {
  nahj: { title: "نهج‌البلاغه", publisher: "دفتر آیت‌الله مکارم شیرازی" },
  mafatih: { title: "مفاتیح نوین", publisher: "آیت‌الله ناصر مکارم شیرازی" },
};

/** props/<id>.json for a waiting format (fetch.mjs writes it): the texts read from Siraj and checked. */
export async function waitingProps(job, io = IO) {
  const { props, need } = waitingShape(job);
  const e = job.expect ?? {};
  const f = props.format;
  if (f === "nahj-hikma") {
    const pg = readHadithPage(await io.page(need.page.path));
    check(pg.records.length === 1, "nahj-hikma: the saying is one record (a saying of several parts is not drawn)");
    const r = pg.records[0];
    if (pg.releaseKey !== e.textRelease) throw new DataChanged("the book's release");
    const n = props.facts.hikma;
    props.texts = [
      { locator: `${NAHJ.work}:${n}:ar`, textHashSha256: sha256(r.arabic) },
      { locator: `${NAHJ.work}:${n}:fa`, textHashSha256: sha256(r.persian) },
    ];
    checkHashes(job, props.texts);
    check(nahjFits(r), "nahj-hikma: the saying fits its frame and a minute");
    props.text = { kind: "nahj", number: n, day: null, lines: [{ number: n, arabic: r.arabic, persian: r.persian }], source: { ...ON_SCREEN.nahj, url: r.sourceUrl ?? `${SITE}${need.page.path}`, siraj: `${SITE}${need.page.path}` } };
    props.narration = [...trLines(trParts(r.persian, 4)), ...props.narration];
    props.source.text = { releaseKey: pg.releaseKey };
  } else if (f === "kumayl" || f === "dua-story") {
    const pg = readDuaPage(await io.page(need.page.path));
    if (pg.releaseKey !== e.textRelease) throw new DataChanged("the book's release");
    const key = f === "kumayl" ? job.props.dua.key : job.props.dhikr.key;
    const [a, b] = f === "kumayl" ? [props.facts.from, props.facts.to] : [props.facts.line, props.facts.line];
    const lines = range(a, b).map((n) => pg.lines.find((l) => l.number === n));
    if (lines.some((l) => !l)) throw new DataChanged("the dua's lines");
    props.texts = lines.flatMap((l) => [
      { locator: `${MAFATIH.work}:${key}:${l.number}:ar`, textHashSha256: sha256(l.arabic) },
      { locator: `${MAFATIH.work}:${key}:${l.number}:fa`, textHashSha256: sha256(l.persian) },
    ]);
    checkHashes(job, props.texts);
    // the same fixed rule as the planner's: the passage is the lines it chose, the line the one it chose
    if (f === "kumayl") check(same(duaPassage(pg.lines, a), { from: a, to: b }), "kumayl: the passage follows the rule (whole lines that fit)");
    else check(storyLine(pg.lines, a) === a, "dua-story: the line follows the rule (short enough for a Story)");
    const next = b < pg.lines.length ? b + 1 : null;
    props.text = {
      kind: f === "kumayl" ? "kumayl" : "dhikr",
      number: null,
      day: f === "dua-story" ? props.facts.day : null,
      lines: lines.map((l) => ({ number: l.number, arabic: l.arabic, persian: l.persian })),
      source: { ...ON_SCREEN.mafatih, url: pg.sourceUrl ?? "https://mafatih.makarem.ir/", siraj: next ? duaLineUrl(SITE, key, next) : `${SITE}${duaPath(key)}` },
      total: pg.lines.length,
    };
    props.narration = [...trLines(lines.map((l) => wordsOf(l.persian).join(" "))), ...props.narration];
    props.source.text = { releaseKey: pg.releaseKey };
  } else if (f === "tafsir") {
    const x = job.props.tafsir;
    const rec = await io.exegesis(x.record);
    if (rec.release?.releaseKey !== e.sourceRelease) throw new DataChanged("the tafsir's release");
    const rg = rec.range ?? {};
    check(rg.startSurahNumber === x.surah && rg.endSurahNumber === x.surah && rg.startAyahNumber === x.from && rg.endAyahNumber === x.to, "tafsir: the record explains the ayahs of the job");
    props.texts = [{ locator: rec.locator ?? `exegesis:${x.record}`, textHashSha256: rec.textHashSha256 }];
    checkHashes(job, props.texts);
    const cut = tafsirSlides(rec.text);
    check(cut, "tafsir: the record gives its slides by the rule (whole sentences)");
    const v = await io.verses(job, x.surah, range(x.from, x.to));
    const arabic = v.ayahs.reduce((k, a) => k + a.text.length, 0);
    const persian = v.ayahs.reduce((k, a) => k + a.translation.length, 0);
    check(arabic <= FIT.tafsir.arabic && persian <= FIT.tafsir.translation, "tafsir: the ayahs fit their slide");
    props.source = { quran: v.quran, surahMetadata: v.metadata, text: { releaseKey: rec.release.releaseKey } };
    props.tafsir = {
      verse: { surah: v.surah, from: x.from, to: x.to, ayahs: v.ayahs, opening: v.opening, basmala: false, translation: v.translation },
      slides: cut.slides.map((s, k) => slideText(s, cut.more && k === cut.slides.length - 1)),
      work: { title: String(rec.workTitle ?? ""), author: String(rec.author ?? "") },
      source: { url: rec.locator ?? null, publisher: String(rec.release.publisher ?? ""), siraj: `${SITE}${quranPath(x.surah)}` },
    };
    props.facts = { ...props.facts, slides: TAFSIR_SLIDES, pieces: cut.pieces };
    props.scenes = scenesOf(f);
  } else if (f === "mirror") {
    const v = await io.verses(job, need.verses.surah, need.verses.ayahs);
    props.source = { quran: v.quran, surahMetadata: v.metadata, text: null };
    check(props.mirror.sections[props.mirror.sections.length - 1].to === v.surah.ayahCount, "mirror: the sections cover the whole surah");
    // the two paired verses, recited by the qari (scripts/qari.mjs cuts the clips of `recite.ayahs`)
    props.recite = { surah: v.surah, from: need.verses.ayahs[0], to: need.verses.ayahs[1], ayahs: v.ayahs, opening: v.opening, basmala: false, translation: v.translation };
  }
  for (const [k, val] of Object.entries(e.numbers ?? {})) if (!same(props.facts[k], val)) throw new DataChanged(`${f}: ${k}`);
  const lengths = props.text ? `, lines ${props.text.lines.map((l) => `${l.arabic.length}/${l.persian.length}`).join(" ")}` : props.tafsir ? `, slides ${props.tafsir.slides.map((t) => t.length).join("/")}` : "";
  console.log(`${job.id}: ${f} (${props.lang}), ${props.narration.length} narration lines (${props.narration.map((l) => l.id).join(",")}), ${props.scenes.length} scenes${lengths}${props.silent ? ", silent" : ""}`);
  return props;
}
