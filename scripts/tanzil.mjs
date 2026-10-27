// The Tanzil Quran metadata (tanzil.net, CC BY 3.0): sections (ruku), parts (juz), pages and
// places of prostration, and the numbers each video shows, counted here at render time. Siraj's
// API names this exact file and its SHA-256 (surahMetadataSource.sha256): a copy with another
// hash, or one that disagrees with the API's surah list, is not used at all. The counting is
// the service's own (service/src/content/facts.ts, siraj/tanzil.ts), so that the manifest's
// facts can be compared number for number. Numbers and names only, no Quran text.
import { check, sha256 } from "./lib.mjs";

export const TANZIL_URL = process.env.TANZIL_METADATA_URL ?? "https://tanzil.net/res/text/metadata/quran-data.xml";

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-z]+)="([^"]*)"/g)) out[m[1]] = m[2].replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  return out;
}

const marks = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}\\s[^>]*/>`, "g"))].map((m) => attrs(m[0]));

export function parseTanzil(xml) {
  const suras = marks(xml, "sura").map((a) => ({
    index: Number(a.index),
    ayas: Number(a.ayas),
    name: a.name ?? "",
    tname: a.tname ?? "",
    ename: a.ename ?? "",
    type: a.type === "Medinan" ? "Medinan" : "Meccan",
    order: Number(a.order),
    rukus: Number(a.rukus),
  }));
  const mark = (a) => ({ index: Number(a.index), sura: Number(a.sura), aya: Number(a.aya) });
  return {
    sha256: sha256(xml),
    suras,
    juzs: marks(xml, "juz").map(mark),
    rukus: marks(xml, "ruku").map(mark),
    pages: marks(xml, "page").map(mark),
    sajdas: marks(xml, "sajda").map((a) => ({ ...mark(a), type: a.type ?? "" })),
  };
}

/** Throws unless the metadata agrees with Siraj's surah list in every number and name. */
export function crossCheck(meta, index) {
  check(meta.sha256 === index.surahMetadataSource.sha256, "the Tanzil metadata is the file Siraj names (SHA-256)");
  check(meta.suras.length === index.surahs.length, "metadata surah count");
  for (const s of index.surahs) {
    const m = meta.suras[s.surahNumber - 1];
    check(m && m.index === s.surahNumber, `metadata surah ${s.surahNumber}`);
    check(m.ayas === s.ayahCount, `metadata ayah count of ${s.surahNumber}`);
    check(m.order === s.revelationOrder, `metadata order of ${s.surahNumber}`);
    check(m.type.toLowerCase() === s.revelationPlace, `metadata place of ${s.surahNumber}`);
    check(m.name === s.nameArabic, `metadata name of ${s.surahNumber}`);
  }
  check(meta.suras.reduce((a, s) => a + s.rukus, 0) === meta.rukus.length, "metadata section count");
}

/** The metadata file Siraj names, downloaded and checked against the index. */
export async function loadTanzil(index) {
  let xml = null;
  for (let attempt = 1; attempt <= 4 && xml === null; attempt++) {
    try {
      const res = await fetch(TANZIL_URL, { headers: { "user-agent": "siraj-render" }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      xml = await res.text();
    } catch (error) {
      if (attempt >= 4) throw new Error(`Tanzil metadata: ${error.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  const meta = parseTanzil(xml);
  crossCheck(meta, index);
  return meta;
}

/* ---------- Lookups (as the service) ---------- */

export const rukuStarts = (meta, surah) => meta.rukus.filter((r) => r.sura === surah).map((r) => r.aya);
const position = (sura, aya) => sura * 10_000 + aya;

/** The mark (part or page) a position falls in. */
function within(list, sura, aya) {
  const p = position(sura, aya);
  let found = list[0]?.index ?? 1;
  for (const m of list) {
    if (position(m.sura, m.aya) <= p) found = m.index;
    else break;
  }
  return found;
}

export const juzOf = (meta, sura, aya) => within(meta.juzs, sura, aya);
export const pageOf = (meta, sura, aya) => within(meta.pages, sura, aya);
export const sajdasIn = (meta, sura) => meta.sajdas.filter((s) => s.sura === sura);

/* ---------- The numbers of each format (as the service's facts.ts) ---------- */

const ref = (sura, aya) => `${sura}:${aya}`;

/** The numbers of a counts metric, keyed as the service's `expect.numbers` (without `metric`). */
export function countNumbers(index, meta, metric) {
  const surahs = index.surahs;
  if (metric === "overview") {
    const by = (place) => surahs.filter((s) => s.revelationPlace === place);
    const max = Math.max(...surahs.map((s) => s.ayahCount));
    const min = Math.min(...surahs.map((s) => s.ayahCount));
    return {
      surahs: surahs.length,
      ayahs: surahs.reduce((a, s) => a + s.ayahCount, 0),
      meccanSurahs: by("meccan").length,
      meccanAyahs: by("meccan").reduce((a, s) => a + s.ayahCount, 0),
      medinanSurahs: by("medinan").length,
      medinanAyahs: by("medinan").reduce((a, s) => a + s.ayahCount, 0),
      longestAyahs: max,
      longest: surahs.filter((s) => s.ayahCount === max).map((s) => s.surahNumber),
      shortestAyahs: min,
      shortest: surahs.filter((s) => s.ayahCount === min).map((s) => s.surahNumber),
    };
  }
  if (metric === "revelation-order") {
    const byOrder = [...surahs].sort((a, b) => a.revelationOrder - b.revelationOrder);
    const firstMedinan = byOrder.find((s) => s.revelationPlace === "medinan");
    return {
      first: byOrder[0].surahNumber,
      last: byOrder[byOrder.length - 1].surahNumber,
      openingOrder: surahs[0].revelationOrder,
      firstMedinan: firstMedinan?.surahNumber ?? 0,
      firstMedinanOrder: firstMedinan?.revelationOrder ?? 0,
    };
  }
  if (metric === "prostrations") {
    const obligatory = meta.sajdas.filter((s) => s.type === "obligatory");
    return {
      places: meta.sajdas.length,
      obligatory: obligatory.length,
      refs: meta.sajdas.map((s) => ref(s.sura, s.aya)).join(", "),
      obligatoryRefs: obligatory.map((s) => ref(s.sura, s.aya)).join(", "),
    };
  }
  check(metric === "divisions", `metric ${metric}`);
  return { juz: meta.juzs.length, rukus: meta.rukus.length, pages: meta.pages.length, surahs: surahs.length };
}

/** The facts of a surah card, keyed as the service's `expect.numbers`. */
export function cardNumbers(index, meta, n) {
  const s = index.surahs[n - 1];
  check(s && s.surahNumber === n, `surah ${n} in the index`);
  const m = meta.suras[n - 1];
  return {
    surah: n,
    ayahCount: s.ayahCount,
    order: s.revelationOrder,
    rukus: m.rukus,
    juz: [juzOf(meta, n, 1), juzOf(meta, n, s.ayahCount)],
    pages: [pageOf(meta, n, 1), pageOf(meta, n, s.ayahCount)],
  };
}
