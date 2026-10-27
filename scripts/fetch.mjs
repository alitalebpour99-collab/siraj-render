// Writes props/<job>.json from Siraj's public API and the Tanzil metadata, for one job of the
// Siraj Social service (docs/renderer-handoff.md §2, §4 of the service):
//   node scripts/fetch.mjs --job jobs/<id>.json
//
// Every sacred or translated string in a props file is a string the API served, kept exactly
// as served: nothing here types, trims, joins, "fixes" or translates one. What was fetched is
// checked against the job's `expect` (the same release keys, the same ayah hashes in the same
// order, the same numbers); when it differs nothing is rendered ("the API's data changed since
// planning"). The log shows counts, keys and lengths only.
import fs from "node:fs";
import path from "node:path";
import { splitLeadingBasmala } from "../src/basmala.ts";
import { INSIGHTS, episodeOf, insightIds } from "./episodes.mjs";
import { ALPHABET, OPENING_LETTER_SURAHS, firstLetterWords, formWords, model, wordsOf } from "./insights.mjs";
import { API, DataChanged, UA, check, checkTrust, jobArg, releaseOf, runMain, same, sha256, siraj, sleep } from "./lib.mjs";
import { cardNumbers, countNumbers, juzOf, loadTanzil } from "./tanzil.mjs";
import { CARD_SCENES, COUNT_SCENES, planIds } from "../src/timelines.ts";

/** The surah index of the exposed text release, checked as the service checks it. */
export async function readIndex() {
  const body = await siraj("/api/quran");
  checkTrust(body, "index");
  check(Array.isArray(body.surahs) && body.surahs.length === 114, "index: 114 surahs");
  body.surahs.forEach((s, i) => {
    check(s.surahNumber === i + 1, `index: surah order ${i + 1}`);
    check(Number.isInteger(s.ayahCount) && s.ayahCount > 0, `index: ayah count of ${i + 1}`);
    check(typeof s.nameArabic === "string" && s.nameArabic.length > 0, `index: name of ${i + 1}`);
    check(s.revelationPlace === "meccan" || s.revelationPlace === "medinan", `index: place of ${i + 1}`);
    check(Number.isInteger(s.revelationOrder), `index: order of ${i + 1}`);
  });
  const total = body.surahs.reduce((a, s) => a + s.ayahCount, 0);
  check(total === body.release?.recordCount, "index: the ayah total is the release's record count");
  check(/^[0-9a-f]{64}$/.test(body.surahMetadataSource?.sha256 ?? ""), "index: the metadata source has a hash");
  return body;
}

const metadataOf = (idx) => ({
  title: idx.surahMetadataSource.title,
  url: idx.surahMetadataSource.url,
  licenseName: idx.surahMetadataSource.licenseName,
  licenseUrl: idx.surahMetadataSource.licenseUrl,
  sha256: idx.surahMetadataSource.sha256,
  ...(idx.surahMetadataSource.copyrightNotice ? { copyrightNotice: idx.surahMetadataSource.copyrightNotice } : {}),
});

function surahInfo(idx, meta, n) {
  const s = idx.surahs[n - 1];
  const m = meta.suras[n - 1];
  return { number: n, ayahCount: s.ayahCount, nameArabic: s.nameArabic, revelationPlace: s.revelationPlace, revelationOrder: s.revelationOrder, tname: m.tname, ename: m.ename, rukus: m.rukus };
}

/** The job's `expect.numbers`, key for key, against what this run counted. */
function compareNumbers(expect, facts, what) {
  for (const [k, v] of Object.entries(expect?.numbers ?? {})) if (!same(facts[k], v)) throw new DataChanged(`${what}: ${k}`);
}

function narrationOf(job, plan) {
  const n = job.props.narration;
  check(Array.isArray(n) && n.length > 0, "the job has its narration lines");
  const allowed = new Set(planIds(plan));
  for (const line of n) {
    check(typeof line.id === "string" && allowed.has(line.id), `narration line ${line.id} has a place in the video`);
    check(typeof line.show === "string" && line.show.length > 0 && typeof line.say === "string" && line.say.length > 0, `narration line ${line.id}`);
  }
  return n.map((l) => ({ id: l.id, show: l.show, say: l.say }));
}

async function verseProps(job) {
  const p = job.props;
  const e = job.expect;
  check(Number.isInteger(p.surah) && Number.isInteger(p.from) && Number.isInteger(p.to) && p.from >= 1 && p.to >= p.from, "verse: surah, from, to");
  check(p.lang === "en" || p.lang === "fa", "verse: lang");
  const idx = await readIndex();
  if (idx.release.releaseKey !== e.textRelease || p.release?.text !== e.textRelease) throw new DataChanged("text release");
  const meta = await loadTanzil(idx);
  const surah = surahInfo(idx, meta, p.surah);
  check(p.to <= surah.ayahCount, "verse: the range is inside the surah");
  if (p.whole) check(p.from === 1 && p.to === surah.ayahCount, "verse: a whole surah is every ayah");

  const passagePath = `/api/quran/${p.surah}?from=${p.from}&to=${p.to}&lang=${p.lang}&exegesis=0&release=${encodeURIComponent(e.textRelease)}`;
  const passage = await siraj(passagePath);
  checkTrust(passage, "passage");
  if (passage.release?.releaseKey !== e.textRelease) throw new DataChanged("text release of the passage");
  check(passage.surahNumber === p.surah, "passage surah");
  check(!passage.translationGap, "the translation covers these ayahs");
  check(passage.translation?.language === p.lang, "translation language");
  if (e.translationRelease && passage.translation?.release?.releaseKey !== e.translationRelease) throw new DataChanged("translation release");
  check(Array.isArray(passage.ayahs) && passage.ayahs.length === p.to - p.from + 1, "every ayah of the range");
  passage.ayahs.forEach((a, i) => {
    check(a.surahNumber === p.surah && a.ayahNumber === p.from + i, `ayah order ${p.from + i}`);
    check(typeof a.text === "string" && a.text.length > 0, `ayah ${p.from + i} text`);
    check(typeof a.translation === "string" && a.translation.length > 0, `ayah ${p.from + i} translation`);
  });
  if (e.ayahHashes && !same(passage.ayahs.map((a) => a.textHashSha256), e.ayahHashes)) throw new DataChanged("ayah hashes");
  const facts = { surah: p.surah, from: p.from, to: p.to };
  compareNumbers(e, facts, "verse");

  // The stored text of ayah 1:1 of the same release, so that the basmala at the start of a
  // first ayah can be set on its own line, as Siraj's reader does (lib/quranBasmala.ts).
  const opening = await siraj(`/api/quran/1?from=1&to=1&translation=0&release=${encodeURIComponent(e.textRelease)}`);
  checkTrust(opening, "opening");
  check(opening.release?.releaseKey === e.textRelease && opening.ayahs?.length === 1, "opening ayah of the same release");

  const tr = passage.translation;
  const props = {
    kind: "verse",
    id: job.id,
    lang: p.lang,
    surah,
    surahTotal: idx.surahs.length,
    whole: Boolean(p.whole),
    from: p.from,
    to: p.to,
    opening: opening.ayahs[0].text,
    ayahs: passage.ayahs.map((a) => ({ ayahNumber: a.ayahNumber, text: a.text, translation: a.translation, locator: a.locator, textHashSha256: a.textHashSha256 })),
    source: {
      quran: releaseOf(passage.release),
      translation: { title: tr.title, translatorName: tr.translatorName, language: tr.language, termsText: tr.release?.translation?.termsText ?? null, release: releaseOf(tr.release) },
      translationNote: passage.translationNote ?? null,
      surahMetadata: metadataOf(idx),
    },
    facts,
    studio: p.studio ?? null,
  };
  console.log(`${job.id}: verse ${p.surah}:${p.from}-${p.to} (${p.whole ? "whole" : "part"}), ${props.ayahs.length} ayahs, text ${e.textRelease}, translation ${tr.release?.releaseKey}`);
  console.log(`${job.id}: lengths (text/translation) ${props.ayahs.map((a) => `${a.text.length}/${a.translation.length}`).join(" ")}`);
  return props;
}

async function metaProps(job) {
  const p = job.props;
  const e = job.expect;
  check(p.lang === "en" || p.lang === "fa", "lang");
  const idx = await readIndex();
  if (idx.release.releaseKey !== e.textRelease) throw new DataChanged("text release");
  if ((e.metadataSha256 && idx.surahMetadataSource.sha256 !== e.metadataSha256) || (p.metadataSha256 && p.metadataSha256 !== idx.surahMetadataSource.sha256)) throw new DataChanged("metadata hash");
  const meta = await loadTanzil(idx);
  return { idx, meta };
}

async function countsProps(job) {
  const p = job.props;
  check(Object.hasOwn(COUNT_SCENES, p.metric), `counts metric ${p.metric}`);
  const { idx, meta } = await metaProps(job);
  const facts = { metric: p.metric, ...countNumbers(idx, meta, p.metric) };
  compareNumbers(job.expect, facts, "counts");
  const props = {
    kind: "counts",
    id: job.id,
    lang: p.lang,
    metric: p.metric,
    surahs: idx.surahs.map((s) => ({ number: s.surahNumber, ayahCount: s.ayahCount, nameArabic: s.nameArabic, place: s.revelationPlace, order: s.revelationOrder })),
    numbers: facts,
    sajdas: meta.sajdas.map((s) => ({ sura: s.sura, aya: s.aya, type: s.type })),
    divisions: { surahs: idx.surahs.length, juz: meta.juzs.length, rukus: meta.rukus.length, pages: meta.pages.length },
    narration: narrationOf(job, COUNT_SCENES[p.metric]),
    source: { quran: releaseOf(idx.release), surahMetadata: metadataOf(idx) },
    facts,
  };
  console.log(`${job.id}: counts ${p.metric}, numbers ${Object.keys(facts).join(",")}, ${props.narration.length} narration lines (${props.narration.map((l) => l.id).join(",")})`);
  return props;
}

async function cardProps(job) {
  const p = job.props;
  check(Number.isInteger(p.surah) && p.surah >= 1 && p.surah <= 114, "card: surah");
  const { idx, meta } = await metaProps(job);
  const facts = cardNumbers(idx, meta, p.surah);
  compareNumbers(job.expect, facts, "surah card");
  check(p.series?.n === p.surah && p.series?.of === idx.surahs.length, "card: series number");
  const props = {
    kind: "surah-card",
    id: job.id,
    lang: p.lang,
    surah: surahInfo(idx, meta, p.surah),
    series: { n: p.series.n, of: p.series.of },
    juz: facts.juz,
    pages: facts.pages,
    sajdas: meta.sajdas.filter((s) => s.sura === p.surah).map((s) => ({ aya: s.aya, type: s.type })),
    narration: narrationOf(job, CARD_SCENES),
    source: { quran: releaseOf(idx.release), surahMetadata: metadataOf(idx) },
    facts,
  };
  // S3b: the opening ayah with the qari (the basmala line first, as in a verse video) and the
  // words of every verse for the ring, when the job asks for it
  if (p.recite) {
    const opening = await siraj(`/api/quran/1?from=1&to=1&translation=0&release=${encodeURIComponent(job.expect.textRelease)}`);
    checkTrust(opening, "opening");
    check(opening.release?.releaseKey === job.expect.textRelease && opening.ayahs?.length === 1, "opening ayah of the same release");
    props.recite = await reciteOf(job, idx, meta, { surah: p.surah, from: p.recite.from ?? 1, to: p.recite.to ?? 1, basmala: true }, opening.ayahs[0].text);
    const whole = await sirajPaced(`/api/quran/${p.surah}?from=1&to=${props.surah.ayahCount}&translation=0&exegesis=0&release=${encodeURIComponent(job.expect.textRelease)}`);
    checkTrust(whole, "card verses");
    props.verseWords = whole.ayahs.map((a) => {
      const split = splitLeadingBasmala(p.surah, a.ayahNumber, a.text, opening.ayahs[0].text);
      return wordsOf(split ? split.rest : a.text).length;
    });
  }
  props.studio = p.studio ?? null;
  console.log(`${job.id}: surah card ${p.surah} of ${p.series.of}, ${props.narration.length} narration lines (${props.narration.map((l) => l.id).join(",")})`);
  return props;
}

/* ---------- The insight formats (S3b) ---------- */

/**
 * A GET of Siraj's API that waits out its rate limit (60 requests a minute: HTTP 429 with
 * Retry-After) instead of failing; the error names the path and the status only.
 */
async function sirajPaced(pathAndQuery) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(`${API}${pathAndQuery}`, { headers: { accept: "application/json", ...UA }, signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      if (attempt >= 6) throw new Error(`${pathAndQuery.replace(/\?.*/, "")}: ${error.message}`);
      await sleep(2000 * attempt);
      continue;
    }
    if (res.status === 429 && attempt < 40) {
      await sleep(Math.max(1, Number(res.headers.get("retry-after")) || 2) * 1000 + 250);
      continue;
    }
    if (!res.ok) {
      if (res.status >= 500 && attempt < 6) {
        await sleep(2000 * attempt);
        continue;
      }
      throw new Error(`${pathAndQuery.replace(/\?.*/, "")}: HTTP ${res.status}`);
    }
    if (Number(res.headers.get("ratelimit-remaining") ?? 10) <= 1) await sleep(1100);
    return res.json();
  }
}

/** The whole text of the release (Tanzil Simple), surah by surah, checked: trust, release, order, hashes. Kept in memory only. */
export async function readText(idx, releaseKey) {
  const t0 = Date.now();
  const surahs = [];
  for (const s of idx.surahs) {
    const body = await sirajPaced(`/api/quran/${s.surahNumber}?from=1&to=${s.ayahCount}&translation=0&exegesis=0&release=${encodeURIComponent(releaseKey)}`);
    checkTrust(body, `text ${s.surahNumber}`);
    if (body.release?.releaseKey !== releaseKey) throw new DataChanged(`text release of surah ${s.surahNumber}`);
    check(Array.isArray(body.ayahs) && body.ayahs.length === s.ayahCount, `text: every ayah of surah ${s.surahNumber}`);
    const ayahs = body.ayahs.map((a, i) => {
      check(a.surahNumber === s.surahNumber && a.ayahNumber === i + 1 && typeof a.text === "string" && a.text.length > 0, `text: ayah ${s.surahNumber}:${i + 1}`);
      check(sha256(a.text) === a.textHashSha256, `text: the hash of ${s.surahNumber}:${i + 1}`);
      return { n: a.ayahNumber, text: a.text, hash: a.textHashSha256 };
    });
    surahs.push({ n: s.surahNumber, ayahs });
  }
  console.log(`text: ${surahs.length} surahs, ${surahs.reduce((k, s) => k + s.ayahs.length, 0)} ayahs, hashes checked, in ${Math.round((Date.now() - t0) / 1000)} s`);
  return { surahs };
}

/** Formats counted from the metadata alone (no text is read for them). */
const METADATA_ONLY = new Set(["myth-fact", "meccan-medinan", "revelation-order"]);

/** The verses an episode recites, with their translation for the screen, checked against the job. */
async function reciteOf(job, idx, meta, rec, opening) {
  if (!rec) return null;
  const p = job.props;
  const e = job.expect;
  const surah = surahInfo(idx, meta, rec.surah);
  check(Number.isInteger(rec.from) && Number.isInteger(rec.to) && rec.from >= 1 && rec.to >= rec.from && rec.to <= surah.ayahCount, "recite: the range is inside the surah");
  const passage = await sirajPaced(`/api/quran/${rec.surah}?from=${rec.from}&to=${rec.to}&lang=${p.lang}&exegesis=0&release=${encodeURIComponent(e.textRelease)}`);
  checkTrust(passage, "recite");
  if (passage.release?.releaseKey !== e.textRelease) throw new DataChanged("text release of the recited verses");
  check(Array.isArray(passage.ayahs) && passage.ayahs.length === rec.to - rec.from + 1, "recite: every ayah");
  const ayahs = passage.ayahs.map((a, i) => {
    check(a.surahNumber === rec.surah && a.ayahNumber === rec.from + i && typeof a.text === "string", `recite: ayah ${rec.from + i}`);
    return { ayahNumber: a.ayahNumber, text: a.text, translation: typeof a.translation === "string" ? a.translation : "", locator: a.locator, textHashSha256: a.textHashSha256 };
  });
  if (e.ayahHashes && !same(ayahs.map((a) => a.textHashSha256), e.ayahHashes)) throw new DataChanged("ayah hashes of the recited verses");
  const tr = passage.translation && !passage.translationGap ? { title: passage.translation.title, translatorName: passage.translation.translatorName, language: passage.translation.language, termsText: passage.translation.release?.translation?.termsText ?? null, release: releaseOf(passage.translation.release) } : null;
  return { surah, from: rec.from, to: rec.to, ayahs, opening, basmala: Boolean(rec.basmala), translation: tr };
}

async function insightProps(job) {
  const p = job.props;
  const def = INSIGHTS[p.format];
  check(def, `insight format ${p.format}`);
  check(typeof p.episode === "string" && def.episodes[p.episode], `episode ${p.format}/${p.episode}`);
  const { idx, meta } = await metaProps(job);
  if (idx.release.releaseKey !== job.expect.textRelease || (p.release?.text && p.release.text !== job.expect.textRelease)) throw new DataChanged("text release");
  const text = METADATA_ONLY.has(p.format) ? null : await readText(idx, job.expect.textRelease);
  const m = text ? model(idx, meta, text) : null;
  const ep = episodeOf({ index: idx, meta, m, lang: p.lang }, p.format, p.episode, p.pick ?? {});
  compareNumbers(job.expect, ep.numbers, `${p.format}/${p.episode}`);
  const opening = m?.opening ?? null;
  const rec = p.recite ?? ep.recite;
  const recite = await reciteOf(job, idx, meta, rec, opening);
  // what the picture needs beyond the numbers: the pages' parts and places, the alphabet, spans of the stored text
  const data = { ...ep.data };
  if (p.format === "mushaf-map" || p.format === "middle") {
    data.pageJuz = meta.pages.map((pg) => juzOf(meta, pg.sura, pg.aya));
    data.pagePlace = meta.pages.map((pg) => idx.surahs[pg.sura - 1].revelationPlace);
  }
  if (p.format === "every-letter" && recite) {
    const a = recite.ayahs[0];
    const split = splitLeadingBasmala(recite.surah.number, a.ayahNumber, a.text, opening);
    data.alphabet = ALPHABET;
    data.firstWord = firstLetterWords(split ? split.rest : a.text);
  }
  if (p.format === "every-letter" && !data.alphabet) data.alphabet = ALPHABET;
  const spans = { form: null, groups: [] };
  if (m && data.form) spans.form = formWords(m, data.form).text;
  if (m && p.format === "opening-letters") {
    const seen = new Set();
    for (const n of OPENING_LETTER_SURAHS) {
      const v1 = m.at(n, 1);
      const v2 = m.at(n, 2);
      const two = v1.words.length === 1 && v2?.words.length === 1;
      const key = [v1.words[0].plain, ...(two ? [v2.words[0].plain] : [])].join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      spans.groups.push(two ? `${v1.words[0].raw} ${v2.words[0].raw}` : v1.words[0].raw);
    }
  }
  const allowed = new Set(insightIds(p.format));
  const narration = Array.isArray(p.narration) && p.narration.length ? p.narration : ep.lines;
  for (const line of narration) {
    check(typeof line.id === "string" && allowed.has(line.id), `narration line ${line.id} has a place in the video`);
    check(typeof line.show === "string" && line.show.length > 0 && typeof line.say === "string" && line.say.length > 0, `narration line ${line.id}`);
  }
  const props = {
    kind: "insight",
    id: job.id,
    lang: p.lang,
    format: p.format,
    episode: p.episode,
    series: Number.isInteger(p.series?.n) ? { n: p.series.n } : null,
    scenes: def.scenes,
    numbers: ep.numbers,
    data,
    surahs: idx.surahs.map((s, i) => ({ number: s.surahNumber, nameArabic: s.nameArabic, tname: meta.suras[i].tname, ayahCount: s.ayahCount, place: s.revelationPlace, order: s.revelationOrder })),
    pages: meta.pages.length,
    spans,
    narration: narration.map((l) => ({ id: l.id, show: l.show, say: l.say })),
    recite,
    source: { quran: releaseOf(idx.release), surahMetadata: metadataOf(idx) },
    studio: p.studio ?? null,
    facts: ep.numbers,
  };
  console.log(`${job.id}: ${p.format}/${p.episode}, numbers ${Object.keys(ep.numbers).join(",")}, ${props.narration.length} narration lines${recite ? `, recites ${recite.surah.number}:${recite.from}-${recite.to}` : ""}`);
  return props;
}

/** props/<id>.json for one job; returns the props. */
export async function fetchJob(job) {
  const format = job.props?.format;
  const props = format === "verse" ? await verseProps(job) : format === "counts" ? await countsProps(job) : format === "surah-card" ? await cardProps(job) : INSIGHTS[format] ? await insightProps(job) : null;
  check(props, `a format this renderer draws (${format})`);
  props.sourceApi = API;
  props.fetchedAt = new Date().toISOString();
  fs.mkdirSync("props", { recursive: true });
  fs.writeFileSync(path.join("props", `${job.id}.json`), `${JSON.stringify(props, null, 1)}\n`);
  return props;
}

runMain(import.meta, async (args) => {
  await fetchJob(jobArg(args));
});
