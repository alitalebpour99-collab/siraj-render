// Numbers in words, for the free voices only: the counts and surah-card sentences of a job
// carry digits («6,236», «۶٬۲۳۶»), and Kokoro and Piper read words more surely than digits.
// The screen keeps the digits (`show`); only what is voiced (`say`) gets the words, and only
// for these factual sentences — a translation line is always voiced exactly as served.

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 6236 → "six thousand two hundred and thirty-six" (0 … 999,999). */
export function enWords(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 1e6) throw new Error(`enWords: ${n}`);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${enWords(n % 100)}` : ""}`;
  const rest = n % 1000;
  return `${enWords(Math.floor(n / 1000))} thousand${rest ? (rest < 100 ? ` and ${enWords(rest)}` : ` ${enWords(rest)}`) : ""}`;
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

/** 6236 → «شش هزار و دویست و سی و شش» (0 … 999,999). */
export function faWords(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 1e6) throw new Error(`faWords: ${n}`);
  if (n === 0) return "صفر";
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = thousands ? `${thousands === 1 ? "" : `${faBelowThousand(thousands)} `}هزار` : "";
  return [head, rest ? faBelowThousand(rest) : ""].filter(Boolean).join(" و ");
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatin = (s) => s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

/** A factual sentence with its numbers in words (digits with , or ٬ group separators). */
export function spoken(text, lang) {
  return text.replace(/[0-9۰-۹٠-٩]+(?:[,٬][0-9۰-۹٠-٩]{3})*/g, (m) => {
    const n = Number(toLatin(m).replace(/[,٬]/g, ""));
    if (!Number.isInteger(n) || n >= 1e6) return m;
    return lang === "fa" ? faWords(n) : enWords(n);
  });
}
