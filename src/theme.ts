// Siraj's look (PLAN.md «The look», the site's tokens.css and the dark mushaf page of
// styles/pages/modules.css): deep lapis night, brass gold for light and numbers.
import { Easing, interpolate } from "remotion";

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const C = {
  night: "#0c1a31", // --lapis-950
  night2: "#142a4a", // --lapis-900
  deep: "#081224",
  band: "#23467a", // --mushaf-band (dark)
  bandDeep: "#152c52",
  gold: "#d9b064", // --mushaf-gold (dark)
  brass: "#e0ac4f", // --brass-400
  brassDeep: "#c18b32", // --brass-500
  star: "#e3c078", // --mushaf-star
  ink: "#f3ead6", // --mushaf-ink (dark)
  translation: "#d3d8e3", // a step lighter than --mushaf-translation, for a small screen
  quiet: "#9aa3b8", // --mushaf-quiet
  turquoise: "#5fcfc8", // --turquoise-300
};

export const FONT = {
  quran: "'Amiri Quran', serif",
  fa: "Vazirmatn, sans-serif",
  en: "'EB Garamond', serif",
};

/**
 * Instagram draws its caption over the lowest 330 px of a Reel and its buttons along the
 * lower right; the feed crops a Reel to 4:5 around its middle. Text stays inside SAFE.
 */
export const SAFE = { top: 250, bottom: H - 340, left: 96, right: W - 150 };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** The site's calm curves: ease in and out, nothing springs. */
export const easeInOut = Easing.bezier(0.45, 0, 0.25, 1);
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
export const fadeIn = (f: number, from: number, len = 15) => interpolate(f, [from, from + len], [0, 1], { ...clamp, easing: easeInOut });
export const fadeOut = (f: number, until: number, len = 12) => interpolate(f, [until - len, until], [1, 0], { ...clamp, easing: easeInOut });
export const rise = (f: number, from: number, dist = 24, len = 22) => interpolate(f, [from, from + len], [dist, 0], { ...clamp, easing: easeOut });
export const grow = (f: number, from: number, len = 30) => interpolate(f, [from, from + len], [0, 1], { ...clamp, easing: easeInOut });

export const frames = (seconds: number) => Math.ceil(seconds * FPS);

const FA = "۰۱۲۳۴۵۶۷۸۹";
const AR = "٠١٢٣٤٥٦٧٨٩";
/** Persian digits (for Persian text). */
export const faNum = (n: number) => String(n).replace(/\d/g, (d) => FA[Number(d)]!);
/** Arabic-Indic digits (for the seal at the end of an ayah of Arabic text). */
export const arNum = (n: number) => String(n).replace(/\d/g, (d) => AR[Number(d)]!);
/** 6,236 */
export const enNum = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
/** ۶٬۲۳۶ */
// (\B would also match before the first Persian digit, which is not a word character for a
// regular expression, and put a separator in front of «۶۰۴»: only between two digits.)
export const faGrouped = (n: number) => faNum(Math.round(n)).replace(/(?<=[۰-۹])(?=([۰-۹]{3})+(?![۰-۹]))/g, "٬");
