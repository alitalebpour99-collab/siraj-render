// The few interface words of the videos (not sacred text, not translation): headers, units,
// source labels. Names, titles, attributions and terms come from the API.
import { faGrouped, faNum } from "./theme";

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

export const L = {
  en: {
    surah: (n: number) => `Surah ${n}`,
    verses: (n: number) => `${n} ${n === 1 ? "verse" : "verses"}`,
    header: (n: number, k: number, total: number) => `Surah ${n} · Verse ${k} of ${total}`,
    withTranslation: (translator: string) => `Arabic text with the English of ${translator}`,
    sources: "Sources",
    quranText: "Quran text",
    translation: "Translation",
    voice: "synthetic voice · it reads the translation only",
    site: "siraj.ahura.cloud",
  },
  fa: {
    surah: (n: number) => `سورهٔ ${faNum(n)}`,
    verses: (n: number) => `${faGrouped(n)} آیه`,
    header: (n: number, k: number, total: number) => `سورهٔ ${faNum(n)} · آیهٔ ${faNum(k)} از ${faNum(total)}`,
    withTranslation: (translator: string) => `متن عربی با ترجمهٔ فارسی ${translator}`,
    sources: "منابع",
    quranText: "متن قرآن",
    tanzil: "پروژهٔ تنزیل",
    translation: "ترجمه",
    translationSource: "منبع ترجمه",
    translatorSite: "سایت قرآن دفتر مترجم",
    translationFile: "فایل ترجمه",
    voice: "صدای مصنوعی · فقط ترجمه خوانده می‌شود",
    site: "siraj.ahura.cloud",
  },
};
