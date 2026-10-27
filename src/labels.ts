// The few interface words of the videos (not sacred text, not translation): headers, units,
// source labels, counting rules. Names, titles, attributions, terms and the narration come
// from the API, the Tanzil metadata or the job.
import { enNum, faGrouped, faNum } from "./theme";

/** "tanzil.net" from "https://tanzil.net/download/"; with `keepPath`, "tanzil.net/trans". */
export function host(url: string, keepPath = false) {
  try {
    const u = new URL(url);
    const h = u.host.replace(/^www\./, "");
    const p = u.pathname.replace(/\/+$/, "");
    return keepPath && p ? `${h}${p}` : h;
  } catch {
    return url;
  }
}

/** The first web address inside an attribution text (for its host), or null. */
export function firstUrl(text: string | null | undefined) {
  const m = text?.match(/https?:\/\/[^\s,;)»]+/);
  return m ? m[0] : null;
}

export const SITE = "siraj.ahura.cloud";

export const L = {
  en: {
    surah: (n: number) => `Surah ${n}`,
    of: (n: number, total: number) => `Surah ${n} of ${total}`,
    verses: (n: number) => `${enNum(n)} ${n === 1 ? "verse" : "verses"}`,
    range: (a: number, b: number) => (a === b ? `Verse ${a}` : `Verses ${a}–${b}`),
    opening: "the opening section",
    ref: (name: string, n: number, k: number) => `${name} · ${n}:${k}`,
    withTranslation: (translator: string) => `Arabic text with the English of ${translator}`,
    recitedBy: (qari: string) => `Recited by ${qari}`,
    sources: "Sources",
    quranText: "Quran text",
    translation: "Translation",
    recitation: "Recitation",
    recitationLine: (qari: string) => `${qari} · Quran Foundation`,
    voice: "synthetic voice · it reads the translation only",
    voiceFacts: "synthetic voice · it reads the narration",
    countedFrom: "Counted from",
    rules: "Counting rule",
    meccan: "Meccan",
    medinan: "Medinan",
  },
  fa: {
    surah: (n: number) => `سورهٔ ${faNum(n)}`,
    of: (n: number, total: number) => `سورهٔ ${faNum(n)} از ${faNum(total)}`,
    verses: (n: number) => `${faGrouped(n)} آیه`,
    range: (a: number, b: number) => (a === b ? `آیهٔ ${faNum(a)}` : `آیه‌های ${faNum(a)} تا ${faNum(b)}`),
    opening: "بخش آغازین سوره",
    ref: (_name: string, n: number, k: number) => `سورهٔ ${faNum(n)} · آیهٔ ${faNum(k)}`,
    withTranslation: (translator: string) => `متن عربی با ترجمهٔ فارسی ${translator}`,
    recitedBy: (qari: string) => `با تلاوت ${qari}`,
    sources: "منابع",
    quranText: "متن قرآن",
    tanzil: "پروژهٔ تنزیل",
    translation: "ترجمه",
    translationSource: "منبع ترجمه",
    translatorSite: "سایت قرآن دفتر مترجم",
    translationFile: "فایل ترجمه",
    recitation: "تلاوت",
    recitationLine: (qari: string) => `${qari} · Quran Foundation`,
    voice: "صدای مصنوعی · فقط ترجمه خوانده می‌شود",
    voiceFacts: "صدای مصنوعی · جمله‌های شمارش را می‌خواند",
    countedFrom: "شمرده از",
    rules: "قاعدهٔ شمارش",
    meccan: "مکی",
    medinan: "مدنی",
  },
};

/** The words of the counts videos, per metric (numbers come from the metadata at render time). */
export const C_WORDS = {
  en: {
    header: "The Quran · counts",
    surahs: "surahs",
    verses: "verses",
    kufan: "Kufan verse count, as in the Tanzil text",
    placesTitle: "Meccan and Medinan",
    placesRule: "as labelled in the Tanzil metadata",
    placesNote: "Scholars differ on the label of some surahs; these are the labels of the Tanzil metadata.",
    surahsLabel: "Surahs",
    versesLabel: "Verses",
    chartTitle: "Verses in each surah",
    chartAxis: "surahs in the order of the mushaf",
    surahWord: (k: number) => (k > 1 ? "Surahs" : "Surah"),
    eachVerses: (n: number, many: boolean) => `${enNum(n)} verses${many ? " each" : ""}`,
    orderTitle: "The order of revelation",
    orderRule: "as listed in the Tanzil metadata",
    orderFirst: "first",
    orderLast: "last",
    orderCell: (order: number) => `${order}`,
    orderLegend: "each cell: a surah, in its place in this order",
    sajdaTitle: "Places of prostration",
    sajdaRule: "as marked in the Tanzil metadata",
    obligatory: "obligatory",
    recommended: "recommended",
    divisionsTitle: "How the Quran is divided",
    divisionsRule: "as divided in the Tanzil metadata",
    parts: "parts (juz)",
    sections: "sections (ruku)",
    pages: "pages",
    rule: {
      overview: "Kufan verse count, as in the Tanzil text. Meccan and Medinan as labelled in the Tanzil metadata.",
      "revelation-order": "The revelation order listed in the Tanzil metadata: one traditional order among others.",
      prostrations: "Places of prostration and their kind as marked in the Tanzil metadata.",
      divisions: "Parts, sections and pages as the Tanzil metadata divides the text.",
    },
  },
  fa: {
    header: "قرآن · شمارش‌ها",
    surahs: "سوره",
    verses: "آیه",
    kufan: "شمارش کوفی آیه‌ها، چنان‌که در متن تنزیل است",
    placesTitle: "مکی و مدنی",
    placesRule: "به دسته‌بندی فرادادهٔ تنزیل",
    placesNote: "دربارهٔ مکی یا مدنی بودن چند سوره نظرها فرق دارد؛ این‌ها برچسب‌های فرادادهٔ تنزیل است.",
    surahsLabel: "سوره‌ها",
    versesLabel: "آیه‌ها",
    chartTitle: "شمار آیه‌های هر سوره",
    chartAxis: "سوره‌ها به ترتیب مصحف",
    surahWord: (k: number) => (k > 1 ? "سوره‌های" : "سورهٔ"),
    eachVerses: (n: number, many: boolean) => `${faGrouped(n)} آیه${many ? "، هر کدام" : ""}`,
    orderTitle: "ترتیب نزول",
    orderRule: "به فهرست فرادادهٔ تنزیل",
    orderFirst: "نخست",
    orderLast: "آخر",
    orderCell: (order: number) => faNum(order),
    orderLegend: "هر خانه یک سوره است، در جای خود در این ترتیب",
    sajdaTitle: "جای سجده‌ها",
    sajdaRule: "چنان‌که در فرادادهٔ تنزیل نشان داده شده",
    obligatory: "واجب",
    recommended: "مستحب",
    divisionsTitle: "بخش‌های قرآن",
    divisionsRule: "به بخش‌بندی فرادادهٔ تنزیل",
    parts: "جزء",
    sections: "رکوع",
    pages: "صفحه",
    rule: {
      overview: "شمارش کوفی آیه‌ها، چنان‌که در متن تنزیل است؛ مکی و مدنی به برچسب فرادادهٔ تنزیل.",
      "revelation-order": "ترتیب نزولی که فرادادهٔ تنزیل آورده: یکی از ترتیب‌های سنتی.",
      prostrations: "جای سجده‌ها و نوع آن‌ها چنان‌که در فرادادهٔ تنزیل نشان داده شده.",
      divisions: "جزء، رکوع و صفحه به بخش‌بندی فرادادهٔ تنزیل.",
    },
  },
};

/** The words of the surah card. */
export const K_WORDS = {
  en: {
    of: (total: number) => `of ${total}`,
    series: "Surah",
    verses: "Verses",
    place: "Revealed",
    order: "Revelation order",
    orderValue: (n: number) => `no. ${n}`,
    sections: "Sections (ruku)",
    juz: "Part (juz)",
    pages: "Pages",
    span: (a: number, b: number) => (a === b ? `${a}` : `${a}–${b}`),
    sajda: "Prostration",
    sajdaValue: (refs: string) => refs,
    rule: "Every number from the Tanzil Quran metadata; Meccan and Medinan and the revelation order as Tanzil lists them.",
  },
  fa: {
    of: (total: number) => `از ${faNum(total)}`,
    series: "سورهٔ",
    verses: "آیه‌ها",
    place: "نزول",
    order: "ترتیب نزول",
    orderValue: (n: number) => `شمارهٔ ${faNum(n)}`,
    sections: "رکوع‌ها",
    juz: "جزء",
    pages: "صفحه",
    span: (a: number, b: number) => (a === b ? faNum(a) : `${faNum(a)} تا ${faNum(b)}`),
    sajda: "سجده",
    sajdaValue: (refs: string) => refs,
    rule: "همهٔ عددها از فرادادهٔ قرآن تنزیل؛ مکی و مدنی و ترتیب نزول به فهرست تنزیل.",
  },
};
