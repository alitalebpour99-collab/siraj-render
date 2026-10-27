// The interface words of the insight videos (S3b): the chip of each format and series, the
// rule box under every count, small labels. No sacred text, no translation: names come from
// the API and the Tanzil metadata, sentences from the job's narration.
import type { InsightFormat, Lang } from "./props";
import { faNum } from "./theme";

type Words = Record<Lang, string>;

export const FORMAT_NAME: Record<InsightFormat, Words> = {
  only: { en: "The Only…", fa: "فقط یکی…" },
  "myth-fact": { en: "The Counts Test", fa: "آزمون شمارش" },
  "meccan-medinan": { en: "Meccan · Medinan", fa: "مکی و مدنی" },
  counted: { en: "Counted", fa: "شمارش" },
  "mushaf-map": { en: "The Mushaf Map", fa: "نقشهٔ مصحف" },
  middle: { en: "The Middle", fa: "وسط قرآن" },
  "revelation-order": { en: "Revelation Order", fa: "ترتیب نزول" },
  "one-line": { en: "One Line, Many Times", fa: "یک جمله، چند بار" },
  "opening-letters": { en: "The Opening Letters", fa: "حروف آغاز سوره‌ها" },
  "every-letter": { en: "Every Letter", fa: "همهٔ حروف" },
  quiz: { en: "Quiz", fa: "مسابقه" },
};

/** The chip at the top: the series with its number, or the format's name. */
export function chipOf(format: InsightFormat, lang: Lang, n: number | null) {
  const name = FORMAT_NAME[format][lang];
  if (n === null) return name;
  return lang === "fa" ? `${name} · شمارهٔ ${faNum(n)}` : `${name} № ${n}`;
}

const TANZIL = { en: "Tanzil Simple 1.1", fa: "متن تنزیل ساده ۱٫۱" };
const NO_BASMALA = { en: "the Basmala at a surah's head not counted", fa: "بسم‌اللهِ آغاز سوره‌ها شمرده نشده" };

/** The rule box: how the number was counted (research R1–R8), per episode or per format. */
export function ruleOf(format: InsightFormat, episode: string, lang: Lang, numbers: Record<string, unknown>): string {
  const fa = lang === "fa";
  const pages = Number(numbers.totalPages ?? 604);
  const p = fa ? faNum(pages) : String(pages);
  const j = (xs: string[]) => xs.join(" · ");
  switch (`${format}/${episode}`) {
    case "only/no-allah":
    case "only/allah-every-verse":
      return fa
        ? j([TANZIL.fa, "نام با شکل دقیقش، با پیشوندهای چسبیده (و، ف، ب، ل، ت)، بی پسوند", NO_BASMALA.fa])
        : j([TANZIL.en, "the name in its exact form, with attached prefixes (wa-, fa-, bi-, li-, ta-), no suffixes", NO_BASMALA.en]);
    case "only/longest-verse":
      return fa ? j([TANZIL.fa, "کلمه: هر تکهٔ جدا با فاصله که حرف دارد", NO_BASMALA.fa]) : j([TANZIL.en, "a word: a space-separated piece with a letter", NO_BASMALA.en]);
    case "myth-fact/verses-6666":
      return fa ? "شمارش کوفی آیه‌ها، چنان‌که در متن و فرادادهٔ تنزیل است · شمارش‌های مکتب‌های دیگر: سیوطی، الاتقان" : "Kufan count of the verses, as in the Tanzil text and metadata · the other schools' counts: al-Suyuti, al-Itqan";
    case "counted/basmala":
      return fa ? j([TANZIL.fa, "چهار کلمهٔ آیهٔ ۱:۱، بی اعتنا به اعراب", "در آغاز هر سوره و درون آیه‌ها"]) : j([TANZIL.en, "the four words of 1:1, vowel marks ignored", "at the head of each surah and inside verses"]);
    case "mushaf-map/believers":
      return fa
        ? j([TANZIL.fa, "چهار کلمهٔ نخست آیهٔ ۲:۱۰۴، پشت سر هم، بی اعتنا به اعراب", `${p} صفحه و مکی و مدنی از فرادادهٔ تنزیل`])
        : j([TANZIL.en, "the first four words of 2:104, in a row, vowel marks ignored", `${p} pages and Meccan / Medinan from the Tanzil metadata`]);
    case "middle/three":
      return fa
        ? j(["آیه: شمارش کوفی", "کلمه: هر تکهٔ جدا که حرف دارد", "حرف: حرف‌های عربی، بی اعراب", NO_BASMALA.fa])
        : j(["verses: Kufan count", "words: space-separated pieces with a letter", "letters: the Arabic letters, marks not counted", NO_BASMALA.en]);
    default:
      break;
  }
  switch (format) {
    case "meccan-medinan":
      return fa ? "مکی و مدنی به برچسب فرادادهٔ تنزیل؛ دربارهٔ چند سوره نظرها فرق دارد · ترفندی برای یادسپاری، نه نشانه" : "Meccan and Medinan as labelled in the Tanzil metadata; scholars differ on a few surahs · a memory trick, not a sign";
    case "revelation-order":
      return fa ? "ترتیب نزولی که فرادادهٔ تنزیل آورده: یکی از ترتیب‌های سنتی، در کنار فهرست‌های دیگر" : "The revelation order listed in the Tanzil metadata: one traditional order among others";
    case "one-line":
      return fa ? j([TANZIL.fa, "آیه‌هایی که حرف به حرف یکسان‌اند، با اعراب"]) : j([TANZIL.en, "verses equal letter for letter, marks included"]);
    case "opening-letters":
      return fa ? j(["فهرست ۲۹ سوره: شماره‌ها", "حروف: نخستین کلمهٔ آیهٔ نخست (و آیهٔ دوم، اگر آن هم یک کلمه باشد)", "بی بسم‌الله"]) : j(["the 29 surahs: a list of numbers", "the letters: the first word of verse 1 (and of verse 2 when that is one word too)", "the Basmala not counted"]);
    case "every-letter":
      return fa ? j([TANZIL.fa, "هر ۲۸ حرف، دست‌کم یک بار", "أ إ آ ٱ همان ا، ة همان ت، ى همان ي", NO_BASMALA.fa]) : j([TANZIL.en, "each of the 28 letters at least once", "أ إ آ ٱ as ا, ة as ت, ى as ي", NO_BASMALA.en]);
    case "quiz":
      return fa ? "از متن و فرادادهٔ تنزیل" : "From the Tanzil text and metadata";
    default:
      return fa ? TANZIL.fa : TANZIL.en;
  }
}

export const I_WORDS = {
  en: {
    claim: "The claim",
    count: "Our count",
    verdict: (holds: boolean) => (holds ? "Verdict: it holds" : "Verdict: it fails"),
    kufan: "Kufan count, as in Tanzil",
    times: "times",
    verses: "verses",
    surahs: "surahs",
    pages: (n: string) => `of ${n} pages`,
    words: "words",
    surah: (n: number) => `Surah ${n}`,
    meccan: "Meccan",
    medinan: "Medinan",
    mushafOrder: "in the order of the book",
    revelationOrder: "in the revelation order (Tanzil)",
    samePlace: "the same place in both",
    byVerses: "by verses",
    byWords: "by words",
    byLetters: "by letters",
    page: (n: number) => `page ${n}`,
    letters: "letters",
    next: "The next part tomorrow",
    sources: "Sources",
    quranText: "Quran text",
    metadata: "Metadata",
    recitation: "Recitation",
    translation: "Translation",
    voice: "synthetic voice · it reads the narration only",
    options: ["A", "B", "C"],
    answer: "Answer",
    verseOf: (s: number, a: number) => `${s}:${a}`,
    without: "without it",
    with: "with it",
  },
  fa: {
    claim: "ادعا",
    count: "شمارش ما",
    verdict: (holds: boolean) => (holds ? "نتیجه: درست است" : "نتیجه: درست نیست"),
    kufan: "شمارش کوفی، چنان‌که در تنزیل است",
    times: "بار",
    verses: "آیه",
    surahs: "سوره",
    pages: (n: string) => `از ${n} صفحه`,
    words: "کلمه",
    surah: (n: number) => `سورهٔ ${faNum(n)}`,
    meccan: "مکی",
    medinan: "مدنی",
    mushafOrder: "به ترتیب مصحف",
    revelationOrder: "به ترتیب نزول (تنزیل)",
    samePlace: "در هر دو یک جا",
    byVerses: "به آیه",
    byWords: "به کلمه",
    byLetters: "به حرف",
    page: (n: number) => `صفحهٔ ${faNum(n)}`,
    letters: "حرف",
    next: "بخش بعد فردا",
    sources: "منابع",
    quranText: "متن قرآن",
    metadata: "فراداده",
    recitation: "تلاوت",
    translation: "ترجمه",
    voice: "صدای مصنوعی · فقط جمله‌های شمارش را می‌خواند",
    options: ["الف", "ب", "ج"],
    answer: "پاسخ",
    verseOf: (s: number, a: number) => `${faNum(s)}:${faNum(a)}`,
    without: "بی آن",
    with: "با آن",
  },
};
