// The plan of the templates that wait for Siraj's API (S3b) and of the Mirror, shared by the
// compositions (src/Waiting.tsx), the props builder (scripts/waiting.mjs) and its tests: the
// formats and their languages, the look of each one, its scenes (frames at 30 fps, with the
// narration ids each scene carries) and where its text stands. No imports and no text, so that
// the build scripts can read it too (node --experimental-strip-types).

export type WaitingFormat = "nahj-hikma" | "kumayl" | "dua-story" | "tafsir" | "occasion" | "mirror";
export type WaitingLang = "en" | "fa";
type Plan = { id: string; lines: string[]; min: number };
type Box = readonly [number, number];

/** The languages each format is drawn in (the service's brands for it). */
export const WAITING_LANGS: Record<WaitingFormat, WaitingLang[]> = {
  "nahj-hikma": ["fa"],
  kumayl: ["fa"],
  "dua-story": ["fa"],
  tafsir: ["fa"],
  occasion: ["fa", "en"],
  mirror: ["en", "fa"],
};

/** The look a format takes when the studio names none (the occasion is always pewter: no glow, no motes). */
export const WAITING_LOOK: Record<WaitingFormat, "lapis" | "night" | "pewter"> = {
  "nahj-hikma": "lapis",
  kumayl: "night",
  "dua-story": "night",
  tafsir: "lapis",
  occasion: "pewter",
  mirror: "lapis",
};

/** The narrator's lines of a served translation, in order (a Kumayl passage: one a line of the dua). */
export const TR_LINES = ["tr1", "tr2", "tr3", "tr4", "tr5", "tr6"];

/** The service's own fixed lines a format may carry (plain spoken Persian): the source said by name, «the rest on Siraj». */
export const FIXED_LINES: Record<WaitingFormat, string[]> = { "nahj-hikma": ["src"], kumayl: ["rest"], "dua-story": [], tafsir: [], occasion: [], mirror: [] };

/** The narration ids of the Mirror (approved prose, read by the narrator; never over the qari). */
export const MIRROR_LINES = ["hook", "fold", "fold2", "pair", "pair2", "end"];

/** The tafsir carousel: the ayahs, three slides of whole sentences, the source and where the rest is. */
export const TAFSIR_SLIDES = 5;

/** The silent Reel twin of the carousel: each slide stands 3.5 s, then turns. */
export const tafsirScenes = (): Plan[] => Array.from({ length: TAFSIR_SLIDES }, (_, i) => ({ id: `slide${i + 1}`, lines: [], min: 105 }));

/** Kumayl: the candle, then each line of the passage (its Arabic, its Persian read), then «the rest on Siraj». */
export const kumaylScenes = (bands: number): Plan[] => [
  { id: "candle", lines: [], min: 75 },
  ...Array.from({ length: Math.max(1, Math.min(TR_LINES.length, bands)) }, (_, k) => ({ id: `b${k + 1}`, lines: [TR_LINES[k]!], min: 105 })),
  { id: "end", lines: ["rest"], min: 120 },
];

/**
 * The scenes of each format. The narrator's lines follow one another; the qari is heard only in
 * the Mirror's «recite» scene, before its narration and never under it (insightTimeline).
 */
export const WAITING_SCENES: Record<Exclude<WaitingFormat, "tafsir" | "kumayl">, Plan[]> = {
  // the Arabic words appear slowly and a brass line opens; the Persian as the narrator reads it; the source said by name
  "nahj-hikma": [
    { id: "open", lines: [], min: 135 },
    { id: "read", lines: TR_LINES, min: 180 },
    { id: "end", lines: ["src"], min: 90 },
  ],
  // the day's dhikr and its ring filling (a Story of about nine seconds)
  "dua-story": [
    { id: "dhikr", lines: ["tr1"], min: 225 },
    { id: "end", lines: [], min: 45 },
  ],
  // very slow: the authority, the occasion's name, its line
  occasion: [
    { id: "main", lines: ["name", "line"], min: 360 },
    { id: "end", lines: [], min: 90 },
  ],
  // the sections in order, the fold onto the pairs, the qari's two paired verses, the sources
  mirror: [
    { id: "hook", lines: ["hook"], min: 150 },
    { id: "fold", lines: ["fold", "fold2"], min: 270 },
    { id: "recite", lines: [], min: 150 },
    { id: "pair", lines: ["pair", "pair2"], min: 150 },
    { id: "end", lines: ["end"], min: 150 },
  ],
};

/** The scene plan of one job (`bands`: the lines of a Kumayl passage). */
export const scenesOf = (format: WaitingFormat, bands = 1): Plan[] => (format === "tafsir" ? tafsirScenes() : format === "kumayl" ? kumaylScenes(bands) : WAITING_SCENES[format]);

/**
 * Where text stands, [top, bottom] in pixels of the 1080×1920 frame. Every box sits inside the
 * 4:5 feed crop and above Instagram's caption zone (y 285–1580, src/layout.ts).
 */
export const WBOX = {
  chip: [296, 356],
  caption: [1178, 1414],
  /** the source line, and at the end the site and the voice label */
  foot: [1424, 1574],
  nahj: { arabic: [392, 756], line: [772, 796], persian: [812, 1160] },
  kumayl: { candle: [380, 590], arabic: [600, 900], persian: [920, 1404] },
  story: { ring: [384, 872], arabic: [892, 1124], persian: [1142, 1404] },
  occasion: { authority: [548, 610], name: [626, 846], line: [892, 1164] },
  mirror: { surah: [376, 470], bars: [486, 1160], verses: [716, 1160], end: [380, 1160] },
} as const satisfies Record<string, Box | Record<string, Box>>;

/** The tafsir slide (1080×1350); in the Reel the slide stands in the 4:5 crop, from y 285. */
export const SLIDE = {
  width: 1080,
  height: 1350,
  top: 285,
  chip: [84, 136],
  ref: [160, 210],
  arabic: [222, 640],
  translation: [664, 1100],
  paragraph: [168, 1100],
  mark: [1134, 1180],
  source: [1186, 1222],
  site: [1226, 1262],
} as const;

const SLIDE_TEXT: Box[] = [SLIDE.chip, SLIDE.ref, SLIDE.arabic, SLIDE.translation, SLIDE.paragraph, SLIDE.mark, SLIDE.source, SLIDE.site];

/** Every text box of a format in the Reel frame (for the safe-frame check). */
export function textBoxes(format: WaitingFormat): Box[] {
  const foot: Box[] = [WBOX.foot];
  switch (format) {
    case "nahj-hikma":
      return [WBOX.chip, WBOX.nahj.arabic, WBOX.nahj.persian, ...foot];
    case "kumayl":
      return [WBOX.chip, WBOX.kumayl.arabic, WBOX.kumayl.persian, ...foot];
    case "dua-story":
      return [WBOX.chip, WBOX.story.ring, WBOX.story.arabic, WBOX.story.persian, ...foot];
    case "occasion":
      return [WBOX.occasion.authority, WBOX.occasion.name, WBOX.occasion.line, ...foot];
    case "mirror":
      return [WBOX.chip, WBOX.mirror.surah, WBOX.mirror.bars, WBOX.mirror.verses, WBOX.mirror.end, WBOX.caption, ...foot];
    case "tafsir":
      return SLIDE_TEXT.map(([a, b]) => [a + SLIDE.top, b + SLIDE.top] as const);
  }
}

/** Every text box of a tafsir slide, in the slide's own frame. */
export const slideBoxes = (): Box[] => SLIDE_TEXT;
