// The only sentences the narrator of a qari preview says besides the translation: a factual
// intro (the surah's number, its name, its number of verses) and a factual credit at the end.
// No religious claim, commentary or translation is written here.

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 112 → "one hundred and twelve" (1–999). */
export function enWords(n) {
  if (!Number.isInteger(n) || n < 0 || n > 999) throw new Error(`enWords: ${n}`);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${enWords(n % 100)}` : ""}`;
}

const FA_ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const FA_TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const FA_TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const FA_HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];

/** 103 → «صد و سه» (1–999). */
export function faWords(n) {
  if (!Number.isInteger(n) || n < 1 || n > 999) throw new Error(`faWords: ${n}`);
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

/** 103 → «صد و سوم»; 112 → «صد و دوازدهم»; 30 → «سی‌ام». */
export function faOrdinal(n) {
  const words = faWords(n).split(" و ");
  const last = words.pop();
  const ordinal = last === "سه" ? "سوم" : last === "سی" ? "سی‌ام" : n === 1 ? "اول" : `${last}م`;
  return [...words, ordinal].join(" و ");
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Surah one hundred and twelve, Al-Ikhlas. Four verses." / «سورهٔ صد و سوم، عصر. سه آیه.» */
export function introLine(sample, ayahCount) {
  if (sample.lang === "fa") return `سورهٔ ${faOrdinal(sample.surah)}، ${sample.nameFa}. ${faWords(ayahCount)} آیه.`;
  return `Surah ${enWords(sample.surah)}, ${sample.nameLatin}. ${cap(enWords(ayahCount))} ${ayahCount === 1 ? "verse" : "verses"}.`;
}

/** The spoken credit at the end: who recites, whose translation, and that the narrator is synthetic. */
export function outroLine(sample, translatorName) {
  if (sample.lang === "fa") return `تلاوت ${sample.reciter.nameFa}. ترجمهٔ آیت‌الله مکارم شیرازی. صدای راوی مصنوعی است.`;
  return `Recitation by ${sample.reciter.name}. Translation by ${translatorName}. The narrating voice is synthetic.`;
}
