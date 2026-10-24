// Writes props/<sample>.json from Siraj's public API, at build time.
//   node scripts/fetch.mjs en-verse        one sample
//   node scripts/fetch.mjs all             every sample in SAMPLES
//   node scripts/fetch.mjs en-qari fa-qari one or more samples or previews by name
//
// Every sacred or translated string in a props file is a string the API served, kept exactly
// as served: nothing here types, trims, joins, "fixes" or translates one. This file holds no
// text of the Quran or of a translation, and the log shows counts, keys and lengths only.
// The only sentences written here are the factual narration of the counts video, built from
// numbers the API's metadata gives (sentence templates below, in English).
import fs from "node:fs";
import path from "node:path";
import { ALL, SAMPLES } from "./samples.mjs";

const API = process.env.SIRAJ_API ?? "https://siraj.ahura.cloud";
const wants = process.argv.slice(2);
if (!wants.length) {
  console.error("usage: node scripts/fetch.mjs <sample|all> [more samples]");
  process.exit(2);
}
const names = wants[0] === "all" ? Object.keys(SAMPLES) : wants;
for (const name of names) if (!ALL[name]) throw new Error(`unknown sample ${name}`);

async function getJson(pathAndQuery) {
  const url = `${API}${pathAndQuery}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "siraj-render (github.com/alitalebpour99-collab/siraj-render)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { url, body: await res.json() };
    } catch (error) {
      if (attempt >= 4) throw new Error(`${pathAndQuery}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

function check(condition, message) {
  if (!condition) throw new Error(`check failed: ${message}`);
}

/** The API's own guarantees, checked on every read. */
function checkTrust(body, what) {
  check(body.service === "siraj-public-quran", `${what}: service`);
  check(body.trust?.verbatim_text_only === true, `${what}: verbatim_text_only`);
  check(body.trust?.text_hash_verified_at_read_time === true, `${what}: text hash verified`);
  check(body.trust?.ai_can_publish === false, `${what}: ai_can_publish is false`);
}

/** The release fields a source line is made of (no sacred text in them). */
const releaseOf = (r) =>
  r && {
    releaseKey: r.releaseKey,
    kind: r.kind,
    language: r.language,
    sourceTitle: r.sourceTitle,
    publisher: r.publisher,
    canonicalUrl: r.canonicalUrl,
    licenseName: r.licenseName,
    licenseUrl: r.licenseUrl,
    rightsStatus: r.rightsStatus,
    attributionText: r.attributionText,
    upstreamVersion: r.upstreamVersion,
    exposedAt: r.exposedAt,
    recordCount: r.recordCount,
    orthography: r.orthography ?? null,
  };

async function index() {
  const { url, body } = await getJson("/api/quran");
  checkTrust(body, "index");
  check(Array.isArray(body.surahs) && body.surahs.length > 0, "index: surahs");
  check(body.surahMetadataSource?.title, "index: surah metadata source is named");
  for (const s of body.surahs) {
    check(Number.isInteger(s.surahNumber) && Number.isInteger(s.ayahCount) && s.ayahCount > 0, `index: surah ${s.surahNumber}`);
    check(typeof s.nameArabic === "string" && s.nameArabic.length > 0, `index: name of surah ${s.surahNumber}`);
    check(s.revelationPlace === "meccan" || s.revelationPlace === "medinan", `index: place of surah ${s.surahNumber}`);
  }
  return { url, body };
}

async function verseProps(name, sample) {
  const { url: indexUrl, body: idx } = await index();
  const surah = idx.surahs.find((s) => s.surahNumber === sample.surah);
  check(surah, `surah ${sample.surah} in the index`);

  const passagePath = `/api/quran/${sample.surah}?lang=${sample.lang}`;
  const { url: passageUrl, body: passage } = await getJson(passagePath);
  checkTrust(passage, "passage");
  check(passage.release?.releaseKey === idx.release.releaseKey, "passage and index name the same text release");
  check(passage.surahNumber === sample.surah, "passage surah");
  check(passage.ayahCount === surah.ayahCount && passage.ayahs.length === surah.ayahCount, "the whole surah, every ayah");
  check(!passage.translationGap, "the translation covers this surah");
  check(passage.translation?.language === sample.lang, "translation language");
  passage.ayahs.forEach((a, i) => {
    check(a.surahNumber === sample.surah && a.ayahNumber === i + 1, `ayah order ${i + 1}`);
    check(typeof a.text === "string" && a.text.length > 0, `ayah ${i + 1} text`);
    check(typeof a.translation === "string" && a.translation.length > 0, `ayah ${i + 1} translation`);
  });

  // The stored text of ayah 1:1 of the same release, so that the basmala at the start of a
  // first ayah can be set on its own line, as Siraj's reader does (lib/quranBasmala.ts).
  const openingPath = `/api/quran/1?from=1&to=1&translation=0&release=${encodeURIComponent(passage.release.releaseKey)}`;
  const { body: opening } = await getJson(openingPath);
  checkTrust(opening, "opening");
  check(opening.release?.releaseKey === passage.release.releaseKey && opening.ayahs?.length === 1, "opening ayah of the same release");

  const tr = passage.translation;
  const props = {
    kind: sample.kind === "qari" ? "qari" : "verse",
    sample: name,
    lang: sample.lang,
    // the private qari previews: the surah's names for the cards, and how many surahs there are
    ...(sample.kind === "qari" ? { meta: { nameLatin: sample.nameLatin, nameFa: sample.nameFa, surahTotal: idx.surahs.length } } : {}),
    surah: {
      number: surah.surahNumber,
      ayahCount: surah.ayahCount,
      nameArabic: surah.nameArabic,
      revelationPlace: surah.revelationPlace,
      revelationOrder: surah.revelationOrder ?? null,
    },
    opening: opening.ayahs[0].text,
    ayahs: passage.ayahs.map((a) => ({
      ayahNumber: a.ayahNumber,
      text: a.text,
      translation: a.translation,
      locator: a.locator,
      textHashSha256: a.textHashSha256,
    })),
    source: {
      api: { index: indexUrl, passage: passageUrl, opening: `${API}${openingPath}` },
      fetchedAt: new Date().toISOString(),
      quran: releaseOf(passage.release),
      translation: {
        title: tr.title,
        translatorName: tr.translatorName,
        language: tr.language,
        termsText: tr.release?.translation?.termsText ?? null,
        release: releaseOf(tr.release),
      },
      translationNote: passage.translationNote ?? null,
      surahMetadata: idx.surahMetadataSource,
    },
  };
  console.log(
    `${name}: surah ${surah.surahNumber}, ${props.ayahs.length} ayahs, text release ${props.source.quran.releaseKey}, translation release ${props.source.translation.release?.releaseKey}`,
  );
  console.log(`${name}: lengths (text/translation) ${props.ayahs.map((a) => `${a.text.length}/${a.translation.length}`).join(" ")}; keys ${Object.keys(props).join(",")}`);
  return props;
}

// ---------- the counts video ----------

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
/** A whole number below a million in English words, for the voice only (the screen shows digits). */
function words(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 1e6) throw new Error(`words: ${n}`);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${words(n % 100)}` : ""}`;
  const rest = n % 1000;
  return `${words(Math.floor(n / 1000))} thousand${rest ? (rest < 100 ? ` and ${words(rest)}` : ` ${words(rest)}`) : ""}`;
}
const digits = (n) => new Intl.NumberFormat("en-US").format(n);
/** «A», «A and B», «A, B and C». */
const list = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
/** The same for the voice, with a comma before the last «and» when the items are long numbers in words. */
const listSay = (items) => (items.length < 3 ? list(items) : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`);

async function countsProps(name) {
  const { url: indexUrl, body: idx } = await index();
  const surahs = idx.surahs.map((s) => ({ number: s.surahNumber, ayahCount: s.ayahCount, nameArabic: s.nameArabic, place: s.revelationPlace }));
  surahs.forEach((s, i) => check(s.number === i + 1, `surah order ${i + 1}`));
  const total = surahs.reduce((a, s) => a + s.ayahCount, 0);
  // The metadata's verse count must be the number of verse records of the text release itself.
  check(total === idx.release.recordCount, `metadata ayah total ${total} equals the text release's record count ${idx.release.recordCount}`);
  const by = (place) => {
    const of = surahs.filter((s) => s.place === place);
    return { surahs: of.length, ayahs: of.reduce((a, s) => a + s.ayahCount, 0) };
  };
  const meccan = by("meccan");
  const medinan = by("medinan");
  const max = Math.max(...surahs.map((s) => s.ayahCount));
  const min = Math.min(...surahs.map((s) => s.ayahCount));
  const longest = surahs.filter((s) => s.ayahCount === max).map((s) => s.number);
  const shortest = surahs.filter((s) => s.ayahCount === min).map((s) => s.number);

  const surahWord = (ns) => (ns.length > 1 ? "Surahs" : "Surah");
  const each = (ns) => (ns.length > 1 ? " each" : "");
  // Facts only, each with its counting rule; `show` is what the screen prints, `say` what the voice reads.
  const narration = [
    {
      id: "total",
      show: `By the Kufan count, the Quran has ${digits(surahs.length)} surahs and ${digits(total)} verses.`,
      say: `By the Kufan count, the Quran has ${words(surahs.length)} surahs, and ${words(total)} verses.`,
    },
    {
      id: "places",
      show: `The Tanzil metadata labels ${digits(meccan.surahs)} surahs Meccan and ${digits(medinan.surahs)} Medinan.`,
      say: `The Tanzil metadata labels ${words(meccan.surahs)} surahs Meccan, and ${words(medinan.surahs)} Medinan.`,
    },
    {
      id: "placeVerses",
      show: `The Meccan surahs hold ${digits(meccan.ayahs)} verses. The Medinan surahs hold ${digits(medinan.ayahs)}.`,
      say: `The Meccan surahs hold ${words(meccan.ayahs)} verses. The Medinan surahs hold ${words(medinan.ayahs)}.`,
    },
    {
      id: "longest",
      show: `The longest ${longest.length > 1 ? "are" : "is"} ${surahWord(longest)} ${list(longest.map(digits))}, with ${digits(max)} verses${each(longest)}.`,
      say: `The longest ${longest.length > 1 ? "are" : "is"} ${surahWord(longest)} ${listSay(longest.map(words))}, with ${words(max)} verses${each(longest)}.`,
    },
    {
      id: "shortest",
      show: `The shortest ${shortest.length > 1 ? "are" : "is"} ${surahWord(shortest)} ${list(shortest.map(digits))}, with ${digits(min)} verses${each(shortest)}.`,
      say: `The shortest ${shortest.length > 1 ? "are" : "is"} ${surahWord(shortest)} ${listSay(shortest.map(words))}, with ${words(min)} verses${each(shortest)}.`,
    },
    {
      id: "end",
      show: "Every number here was counted from the Tanzil Quran metadata.",
      say: "Every number here was counted from the Tanzil Quran metadata.",
    },
  ];

  const props = {
    kind: "counts",
    sample: name,
    lang: "en",
    surahs,
    totals: { surahs: surahs.length, ayahs: total, meccan, medinan, longest: { ayahs: max, surahs: longest }, shortest: { ayahs: min, surahs: shortest } },
    narration,
    source: {
      api: { index: indexUrl },
      fetchedAt: new Date().toISOString(),
      quran: releaseOf(idx.release),
      surahMetadata: idx.surahMetadataSource,
    },
  };
  console.log(
    `${name}: ${surahs.length} surahs, ${total} ayahs (= text release record count), meccan ${meccan.surahs}/${meccan.ayahs}, medinan ${medinan.surahs}/${medinan.ayahs}, longest ${longest.join(",")} (${max}), shortest ${shortest.join(",")} (${min}), ${narration.length} narration lines`,
  );
  return props;
}

fs.mkdirSync("props", { recursive: true });
for (const name of names) {
  const sample = ALL[name];
  const props = sample.kind === "counts" ? await countsProps(name) : await verseProps(name, sample);
  const file = path.join("props", `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(props, null, 1) + "\n");
  console.log(`${name}: wrote ${file}`);
}
