// The narrator's reading layer (S3d, owner 2026-10-28: «راوی بد میخونه فارسی رو»). What is on
// screen (`show`) keeps its digits and references; what the narrator hears (`say`) is plain
// spoken Persian: numbers in words, a reference as «سورهٔ پنجاه و پنج، آیهٔ یک», no colon,
// semicolon, bracket or Latin letter (ElevenLabs misreads them). The episodes build their
// Persian `say` lines with these words (scripts/episodes.mjs); `readingProblems` is the guard
// the tests run on every one of them. English keeps its numerals (they are read well).
// `spoken` is for the free voices only (Kokoro, Piper): it turns what is left into words. A
// translation line is never touched: it is voiced exactly as served.

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enBelowThousand(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${enBelowThousand(n % 100)}` : ""}`;
}

/** 6236 → "six thousand two hundred and thirty-six" (0 … 999,999,999). */
export function enWords(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 1e9) throw new Error(`enWords: ${n}`);
  if (n < 1000) return enBelowThousand(n);
  const parts = [];
  const millions = Math.floor(n / 1e6);
  const thousands = Math.floor((n % 1e6) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(`${enBelowThousand(millions)} million`);
  if (thousands) parts.push(`${enBelowThousand(thousands)} thousand`);
  if (rest) parts.push(rest < 100 ? `and ${enBelowThousand(rest)}` : enBelowThousand(rest));
  return parts.join(" ");
}

const FA_ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const FA_TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const FA_TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const FA_HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];

function faBelowThousand(n) {
  const parts = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(FA_HUNDREDS[h]);
  if (rest >= 10 && rest < 20) parts.push(FA_TEENS[rest - 10]);
  else {
    if (rest >= 20) parts.push(FA_TENS[Math.floor(rest / 10)]);
    if (rest % 10) parts.push(FA_ONES[rest % 10]);
  }
  return parts.join(" و ");
}

/** 6236 → «شش هزار و دویست و سی و شش»; 1000 → «هزار»; 2,000,000 → «دو میلیون» (0 … 999,999,999). */
export function faWords(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 1e9) throw new Error(`faWords: ${n}`);
  if (n === 0) return "صفر";
  const millions = Math.floor(n / 1e6);
  const thousands = Math.floor((n % 1e6) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (millions) parts.push(`${faBelowThousand(millions)} میلیون`);
  if (thousands) parts.push(thousands === 1 && !millions ? "هزار" : `${faBelowThousand(thousands)} هزار`);
  if (rest) parts.push(faBelowThousand(rest));
  return parts.join(" و ");
}

/**
 * The ordinal: «پنجم», «سوم», «سی‌ام», «صد و سوم» (after a noun: «سورهٔ پنجم»), or with
 * `before` the form that stands before it: «پنجمین», «صد و سومین» («پنجمین سوره»); one is
 * «یکم» / «نخستین».
 */
export function faOrdinal(n, { before = false } = {}) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`faOrdinal: ${n}`);
  if (n === 1) return before ? "نخستین" : "یکم";
  const w = faWords(n);
  const base = w.endsWith("سه") ? `${w.slice(0, -2)}سوم` : w.endsWith("ی") ? `${w}‌ام` : `${w}م`;
  return before ? `${base}ین` : base;
}

/** «۱، ۹ و ۱۱۲» as words: «یک، نه و صد و دوازده». */
export function faNumberList(ns) {
  const s = ns.map((n) => faWords(Number(n)));
  if (s.length < 2) return s.join("");
  return `${s.slice(0, -1).join("، ")} و ${s[s.length - 1]}`;
}

/** "55:1" → «سورهٔ پنجاه و پنج، آیهٔ یک»; "55:1-4" → «سورهٔ پنجاه و پنج، آیه‌های یک تا چهار». */
export function faRef(ref) {
  const m = String(toLatin(ref)).match(/^\s*(\d+)\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*$/);
  if (!m) throw new Error(`faRef: ${ref}`);
  const [, s, a, b] = m;
  const surah = `سورهٔ ${faWords(Number(s))}`;
  return b ? `${surah}، آیه‌های ${faWords(Number(a))} تا ${faWords(Number(b))}` : `${surah}، آیهٔ ${faWords(Number(a))}`;
}

/**
 * A surah's name as served (Arabic script) made easy to read in a Persian sentence: a closing
 * «ة» as «ه» (البقرة → البقره), the Arabic «ي ى ك» as Persian «ی ک». Nothing else changes.
 */
export const faName = (name) => String(name).replace(/ة(?=\s|$)/g, "ه").replace(/[يى]/g, "ی").replace(/ك/g, "ک");

/** The names the narrator says, with the vowels that make them read right (owner, 2026-10-28). */
export const FA_SOURCE = {
  /** the Tanzil project: the text of the Quran and its metadata */
  tanzil: "پروژهٔ تَنزیل",
  /** «the text of the Quran of the Tanzil project» */
  text: "متنِ قرآنِ پروژهٔ تَنزیل",
  /** «the data of the Tanzil project» (the metadata: places, order, pages, parts) */
  data: "داده‌های پروژهٔ تَنزیل",
};

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatin = (s) => String(s).replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

/**
 * What a Persian `say` line must not hold (the guard of the tests): digits (Persian,
 * Arabic-Indic or ASCII), Latin letters, a colon or a semicolon, brackets. [] when it is clean.
 */
export function readingProblems(text) {
  const out = [];
  if (/[0-9۰-۹٠-٩]/.test(text)) out.push("a digit");
  if (/[A-Za-z]/.test(text)) out.push("a Latin letter");
  if (/[:：]/.test(text)) out.push("a colon");
  if (/[;؛]/.test(text)) out.push("a semicolon");
  if (/[()[\]{}]/.test(text)) out.push("a bracket");
  return out;
}

/** A factual sentence with its numbers (and, in Persian, its references) in words: for the free voices. */
export function spoken(text, lang) {
  let out = text;
  if (lang === "fa") out = out.replace(/[0-9۰-۹٠-٩]+\s*:\s*[0-9۰-۹٠-٩]+(?:\s*[-–]\s*[0-9۰-۹٠-٩]+)?/g, (m) => faRef(m));
  return out.replace(/[0-9۰-۹٠-٩]+(?:[,٬][0-9۰-۹٠-٩]{3})*/g, (m) => {
    const n = Number(toLatin(m).replace(/[,٬]/g, ""));
    if (!Number.isInteger(n) || n >= 1e9) return m;
    return lang === "fa" ? faWords(n) : enWords(n);
  });
}
