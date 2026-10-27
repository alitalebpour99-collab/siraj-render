// When everything happens in each video, in frames at 30 fps: one place, so that the
// compositions, the render's sound checks and the log agree. Only type imports, so that the
// build scripts can use it too (node --experimental-strip-types).
//
// The rule of the sound (owner, 2026-10-24): the qari recites each ayah (the basmala first,
// before ayah 1); then the translation fades in and the narrator reads it, never over the
// qari; then a breath. No music, no bed. Counts and surah cards have the narrator only.
import type { CardProps, CountsProps, Metric, Narration, Voice, VerseProps } from "./props";

export const FPS = 30;
export const fr = (seconds: number) => Math.ceil(seconds * FPS);

/** Someone heard in the video: from `frame` for `seconds`. */
export type Speaker = { who: string; kind: "qari" | "narrator"; frame: number; seconds: number };

/* ---------- Verse & meaning ---------- */

export const VT = {
  /** cross-fade between cards */
  XF: 18,
  /** the opening card (silent), with its cross-fade into the first ayah */
  INTRO: 90,
  /** the qari begins this far into a card, once the Arabic has faded in */
  QARI_AT: 18,
  /** between the basmala and ayah 1 */
  BASMALA_GAP: 6,
  /** between the end of the recitation and the translation */
  TR_GAP: 8,
  TR_IN: 14,
  /** the narrator begins this long after the translation begins to fade in */
  NARR_AFTER_TR: 8,
  /** after the narrator, before the card begins to fade out */
  BREATH: 4,
  /** a card stays at least this long, so a short ayah can still be read in calm */
  MIN_CARD: 120,
  /** without a recitation: the Arabic stands alone at least this long before the translation */
  READ_MIN: 36,
  /** the sources card at the end (silent) */
  OUTRO: 165,
};

export type VerseCard = {
  index: number;
  ayah: number;
  /** absolute frame where the card begins (its fade-in overlaps the card before) */
  from: number;
  dur: number;
  /** the rest are frames from the card's start */
  basmalaAt: number | null;
  verseAt: number;
  qariEnd: number;
  trAt: number;
  narrAt: number;
  narrEnd: number;
  /** the qari is heard on this card */
  recited: boolean;
};

export type VerseTimeline = {
  intro: { from: number; dur: number };
  cards: VerseCard[];
  outro: { from: number; dur: number };
  total: number;
  speakers: Speaker[];
};

const byId = (voice: Voice | null | undefined) => new Map((voice?.lines ?? []).map((l) => [l.id, l]));

export function verseTimeline(p: Pick<VerseProps, "ayahs" | "qari" | "voice">): VerseTimeline {
  const lines = byId(p.voice);
  const speakers: Speaker[] = [];
  let at = VT.INTRO - VT.XF;
  const cards = p.ayahs.map((a, index): VerseCard => {
    const clip = p.qari?.verses?.find((v) => v.ayah === a.ayahNumber) ?? null;
    const basmala = index === 0 ? (p.qari?.basmala ?? null) : null;
    const basmalaAt = basmala ? VT.QARI_AT : null;
    const verseAt = basmala ? VT.QARI_AT + fr(basmala.seconds) + VT.BASMALA_GAP : VT.QARI_AT;
    // without the qari, the time a calm reader needs for a look at the Arabic
    const arabic = clip ? fr(clip.seconds) : Math.max(VT.READ_MIN, Math.ceil(a.text.length * 0.5));
    const qariEnd = verseAt + arabic;
    const trAt = qariEnd + VT.TR_GAP;
    const narrAt = trAt + VT.NARR_AFTER_TR;
    const line = lines.get(`a${a.ayahNumber}`);
    // without a voice, the time a calm reader needs for the translation
    const speak = line ? fr(line.seconds) : Math.max(60, 24 + Math.ceil(a.translation.length * 2.4));
    const narrEnd = narrAt + speak;
    // the last XF frames of a card are its cross-fade into the next one
    const dur = Math.max(VT.MIN_CARD, narrEnd + VT.BREATH + VT.XF);
    if (basmala && basmalaAt !== null) speakers.push({ who: "qari basmala", kind: "qari", frame: at + basmalaAt, seconds: basmala.seconds });
    if (clip) speakers.push({ who: `qari ${a.ayahNumber}`, kind: "qari", frame: at + verseAt, seconds: clip.seconds });
    if (line) speakers.push({ who: `narrator ${a.ayahNumber}`, kind: "narrator", frame: at + narrAt, seconds: line.seconds });
    const card = { index, ayah: a.ayahNumber, from: at, dur, basmalaAt, verseAt, qariEnd, trAt, narrAt, narrEnd, recited: Boolean(clip) };
    at += dur - VT.XF;
    return card;
  });
  return { intro: { from: 0, dur: VT.INTRO }, cards, outro: { from: at, dur: VT.OUTRO }, total: at + VT.OUTRO, speakers };
}

/** Absolute seconds of every lit word of every clip, for the log and the record (no text). */
export function wordTable(p: Pick<VerseProps, "ayahs" | "qari" | "voice">) {
  const t = verseTimeline(p);
  const rows: { clip: string; mode: string; word: number; start: number; end: number }[] = [];
  for (const card of t.cards) {
    const pieces = [
      { clip: card.index === 0 ? (p.qari?.basmala ?? null) : null, at: card.basmalaAt },
      { clip: p.qari?.verses.find((v) => v.ayah === card.ayah) ?? null, at: card.verseAt },
    ];
    for (const { clip, at } of pieces) {
      if (!clip || at === null) continue;
      const zero = (card.from + at) / FPS;
      clip.words.forEach((w, i) => rows.push({ clip: clip.verseKey, mode: clip.mode, word: i + 1, start: Math.round((zero + w.start) * 1000) / 1000, end: Math.round((zero + w.end) * 1000) / 1000 }));
    }
  }
  return rows;
}

/* ---------- Scenes with narrated lines (counts, surah card) ---------- */

export const ST = { IN: 12, LEAD: 10, GAP: 16, TAIL: 28, OUT: 12 };

export type ScenePlan = { id: string; lines: string[]; min: number };

export type SceneLine = { id: string; from: number; len: number; file: string | null; show: string; words: Array<[number, number]> | null };
export type Scene = { id: string; from: number; dur: number; lines: SceneLine[] };
export type SceneTimeline = { scenes: Scene[]; total: number; speakers: Speaker[] };

/** The scenes of each counts metric and the narration lines each one carries, in order. */
export const COUNT_SCENES: Record<Metric, ScenePlan[]> = {
  overview: [
    { id: "total", lines: ["total"], min: 150 },
    { id: "places", lines: ["places", "placeVerses"], min: 210 },
    { id: "chart", lines: ["longest", "shortest"], min: 240 },
    { id: "end", lines: ["end"], min: 180 },
  ],
  "revelation-order": [
    { id: "order", lines: ["first", "opening", "medinan"], min: 300 },
    { id: "end", lines: ["end"], min: 180 },
  ],
  prostrations: [
    { id: "sajdas", lines: ["places", "obligatory"], min: 270 },
    { id: "end", lines: ["end"], min: 180 },
  ],
  divisions: [
    { id: "divisions", lines: ["divisions"], min: 240 },
    { id: "end", lines: ["end"], min: 150 },
  ],
};

export const CARD_SCENES: ScenePlan[] = [
  { id: "title", lines: ["title"], min: 120 },
  { id: "facts", lines: ["facts", "parts", "sajda"], min: 240 },
  { id: "end", lines: ["end"], min: 150 },
];

/** The narration ids a plan carries (every id of the job's narration must be one of them). */
export const planIds = (plan: ScenePlan[]) => plan.flatMap((s) => s.lines);

export function scenesTimeline(plan: ScenePlan[], narration: Narration[], voice: Voice | null | undefined): SceneTimeline {
  const voiced = byId(voice);
  const said = new Map(narration.map((n) => [n.id, n]));
  const speakers: Speaker[] = [];
  let at = 0;
  const scenes = plan.map((s): Scene => {
    let cursor = at + ST.IN + ST.LEAD;
    const lines = s.lines
      .filter((id) => said.has(id))
      .map((id): SceneLine => {
        const n = said.get(id)!;
        const line = voiced.get(id);
        const words = n.say.split(/\s+/).filter(Boolean).length;
        const len = line ? fr(line.seconds) : Math.max(45, Math.ceil(words * 0.42 * FPS));
        if (line) speakers.push({ who: `narrator ${id}`, kind: "narrator", frame: cursor, seconds: line.seconds });
        const item = { id, from: cursor, len, file: line?.file ?? null, show: n.show, words: line?.words?.length ? line.words : null };
        cursor += len + ST.GAP;
        return item;
      });
    const dur = Math.max(s.min, cursor - ST.GAP + ST.TAIL + ST.OUT - at);
    const scene = { id: s.id, from: at, dur, lines };
    at += dur;
    return scene;
  });
  return { scenes, total: at, speakers };
}

export const countsTimeline = (p: Pick<CountsProps, "metric" | "narration" | "voice">) => scenesTimeline(COUNT_SCENES[p.metric], p.narration, p.voice);
export const cardTimeline = (p: Pick<CardProps, "narration" | "voice">) => scenesTimeline(CARD_SCENES, p.narration, p.voice);

/* ---------- Insight videos (S3b) ---------- */

type ClipLite = { id: string; ayah: number | null; file: string; seconds: number };
/** One recited clip in an insight scene: absolute frame and length. */
export type ReciteClip = { id: string; ayah: number | null; from: number; len: number; file: string; seconds: number };
export type InsightScene = Scene & { clips: ReciteClip[] };
export type InsightTimeline = { scenes: InsightScene[]; total: number; speakers: Speaker[]; loopFrames: number };

/** The first narrated line starts this early, so the hook is heard within the first second. */
export const IT = { FIRST: 8, CLIP_GAP: 6, CLIP_IN: 16, LOOP: 15 };

/**
 * The scenes of an insight video, from the plan the job's format carries: narrated lines one
 * after another (never two at once), the qari's clips in the «recite» scene (after the
 * narrator, never over him), a silent «think» scene of the quiz, and the frames of the loop
 * back to the opening at the very end.
 */
export function insightTimeline(p: { scenes: ScenePlan[]; narration: Narration[]; voice: Voice | null | undefined; qari?: { basmala?: ClipLite | null; verses: ClipLite[] } | null; loop?: boolean }): InsightTimeline {
  const voiced = byId(p.voice);
  const said = new Map(p.narration.map((n) => [n.id, n]));
  const speakers: Speaker[] = [];
  let at = 0;
  const scenes = p.scenes.map((s, si): InsightScene => {
    let cursor = at + (si === 0 ? IT.FIRST : ST.IN + ST.LEAD);
    const clips: ReciteClip[] = [];
    if (s.id === "recite" && p.qari) {
      cursor = at + IT.CLIP_IN;
      for (const c of [p.qari.basmala ?? null, ...p.qari.verses].filter((x): x is NonNullable<typeof x> => Boolean(x))) {
        const len = fr(c.seconds);
        clips.push({ id: c.id, ayah: c.ayah, from: cursor, len, file: c.file, seconds: c.seconds });
        speakers.push({ who: `qari ${c.ayah ?? "basmala"}`, kind: "qari", frame: cursor, seconds: c.seconds });
        cursor += len + IT.CLIP_GAP;
      }
      cursor += ST.GAP - IT.CLIP_GAP;
    }
    const lines = s.lines
      .filter((id) => said.has(id))
      .map((id): SceneLine => {
        const n = said.get(id)!;
        const line = voiced.get(id);
        const words = n.say.split(/\s+/).filter(Boolean).length;
        const len = line ? fr(line.seconds) : Math.max(45, Math.ceil(words * 0.42 * FPS));
        if (line) speakers.push({ who: `narrator ${id}`, kind: "narrator", frame: cursor, seconds: line.seconds });
        const item = { id, from: cursor, len, file: line?.file ?? null, show: n.show, words: line?.words?.length ? line.words : null };
        cursor += len + ST.GAP;
        return item;
      });
    const dur = Math.max(s.min, cursor - ST.GAP + ST.TAIL + ST.OUT - at);
    const scene = { id: s.id, from: at, dur, lines, clips };
    at += dur;
    return scene;
  });
  const loopFrames = p.loop ? IT.LOOP : 0;
  return { scenes, total: at + loopFrames, speakers, loopFrames };
}

/* ---------- The sound check ---------- */

/**
 * Who is heard when, in seconds, and the first pair that overlaps (or null). A qari and a
 * narrator, or two lines, must never be heard at the same time.
 */
export function speakerWindows(speakers: Speaker[]) {
  const segs = [...speakers]
    .sort((a, b) => a.frame - b.frame)
    .map((s) => ({ who: s.who, kind: s.kind, from: Math.round((s.frame / FPS) * 1000) / 1000, to: Math.round((s.frame / FPS + s.seconds) * 1000) / 1000 }));
  let overlap: string | null = null;
  for (let i = 1; i < segs.length; i++) {
    if (segs[i]!.from < segs[i - 1]!.to - 0.001) {
      overlap = `${segs[i]!.who} begins before ${segs[i - 1]!.who} ends`;
      break;
    }
  }
  return { segs, overlap };
}
