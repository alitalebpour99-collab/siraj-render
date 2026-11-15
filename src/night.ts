// «یک آیه برای امشب» (viral formats of 2026-11-15, §4.2, approved by the owner): one ayah (or two
// that belong together) a night, recited by the qari with the word light, the named translation
// standing with it from its first frame, then a second of silence and the loop. No narrator, no
// music. The title on screen from frame 0 is the THEME, which is a person's reading of the ayah:
// so every post of this format waits for the owner's yes in the bot (the service: approveEach),
// and this list itself is PROPOSED (2026-11-15) until the owner approves it. The service keeps a
// copy (service/src/content/night.ts); keep them in step. Titles: 5 words or fewer, so that with
// the series line («آیهٔ امشب», two words) the framing words of the first 1.5 s stay 7 or fewer.
// Only ayahs of mercy, rest and hope: never a standalone verse of fighting or punishment.
import type { Lang, NightTheme } from "./props";

export const NIGHT_SERIES: Record<Lang, string> = { fa: "آیهٔ امشب", en: "Tonight's verse" };

export const NIGHT_THEMES: NightTheme[] = [
  { id: "calm", surah: 13, from: 28, to: 28, title: { fa: "وقتی دلت آرام نیست", en: "When your heart is restless" } },
  { id: "tired", surah: 94, from: 5, to: 6, title: { fa: "وقتی خسته‌ای", en: "When you are tired" } },
  { id: "near", surah: 2, from: 186, to: 186, title: { fa: "وقتی احساس تنهایی می‌کنی", en: "When you feel alone" } },
  { id: "hope", surah: 39, from: 53, to: 53, title: { fa: "وقتی امیدت کم شده", en: "When hope runs low" } },
  { id: "patience", surah: 2, from: 153, to: 153, title: { fa: "برای روزهای سخت", en: "For the hard days" } },
  { id: "thanks", surah: 14, from: 7, to: 7, title: { fa: "برای شکرگزاری امشب", en: "A night of thanks" } },
  { id: "sleep", surah: 2, from: 255, to: 255, title: { fa: "پیش از خواب", en: "Before you sleep" } },
];

export const nightTheme = (id: string): NightTheme | undefined => NIGHT_THEMES.find((t) => t.id === id);
