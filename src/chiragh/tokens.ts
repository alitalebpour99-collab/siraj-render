// «چراغ» (Chiragh), Siraj's ONE video style (owner, 2026-11-20; style bible v2): warm cream,
// emerald for the Arabic, the ayah numbers and every line, a warm gold only for the flame and the
// lamp's halo. One grid for every template: the title on top, the anchor's line art in the
// middle, the text under it, the lamp low with its halo. No music, no figure, no hexagram, no
// generated calligraphy. This file imports nothing so that the scripts (node) can read it too.

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export const INK = {
  cream: "#f6efdf",
  cream2: "#efe4cc",
  paper: "#e9dcbf",
  emerald: "#0e5a45",
  emeraldDeep: "#0a4535",
  emeraldSoft: "#2c6553",
  /** a waiting (not yet recited) word: a soft emerald, 4.6:1 on the cream; the recited word turns deep emerald (10:1) */
  waiting: "#3d7564",
  ink: "#2a2318",
  translation: "#362c1f",
  quiet: "#5a4d3a",
  gold: "#d9a441",
  goldSoft: "rgba(232,184,92,0.55)",
  flame: "#f3c25a",
} as const;

export const FONT = {
  quran: "'Amiri Quran', serif",
  fa: "Vazirmatn, sans-serif",
  en: "'EB Garamond', serif",
  naskh: "'Noto Naskh Arabic', serif",
};

/**
 * The fixed grid (pixels of the 1080×1920 frame). Text stays inside the apps' safe zones measured
 * on the owner's screenshots (src/lamp/zones.ts): x 56–888, y 232–1583.
 */
export const GRID = {
  safe: { left: 56, right: 888, top: 232, bottom: 1583 },
  colX: 472,
  colW: 792,
  title: { top: 236, h: 140 },
  /** the anchor's stage: the line art lives here and the camera moves inside it */
  stage: { top: 380, bottom: 1040, left: 0, right: 1080 },
  text: { top: 1046, bottom: 1580 },
  lamp: { x: 472, y: 1716, size: 150 },
} as const;

/** A shot lasts 1–2.5 s in Siraj (calm, but never still). */
export const SHOT = { min: 1.0, max: 2.5, ideal: 1.7 } as const;

/** The project's transitions (nothing else is allowed in a storyboard). */
export const TRANSITIONS = ["soft-fade", "lamp-rise", "line-carry", "push-through"] as const;
export type Transition = (typeof TRANSITIONS)[number];

/** Arabic-Indic and Persian digits. */
const AR = "٠١٢٣٤٥٦٧٨٩";
const FA = "۰۱۲۳۴۵۶۷۸۹";
export const arNum = (n: number) => String(n).replace(/\d/g, (d) => AR[Number(d)]!);
export const faNum = (n: number) => String(n).replace(/\d/g, (d) => FA[Number(d)]!);
