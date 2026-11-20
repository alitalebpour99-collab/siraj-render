// storyboard.json of one «چراغ» video (style bible v2 §6; storyboard-fa.md §2): the concept the
// code picked, the anchor, every sound in its place, the texts exactly as served, and a shot every
// 1–2.5 s, each locked to a word of the qari or the narrator, with its picture, motion, text,
// sound, transition, length and meaning. The director (scripts/chiragh/director.mjs) writes it;
// the composition (Chiragh.tsx) draws ONLY what it says; the QA gate (scripts/chiragh/qa.mjs)
// checks the video against it. Pure helpers here are shared by all three: this file imports nothing.

export type Word = { text: string; start: number; end: number };
export type Labeled = { x: number; y: number; text: string; size: number; group: string; font?: "fa" | "en" | "quran"; anchor?: "start" | "middle" | "end" };
export type InlineArt = {
  id: string;
  tags: string[];
  figures: false;
  groups: Array<{ id: string; paths: string[]; weight?: number; gold?: boolean; fill?: boolean }>;
  regions: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  labels?: Labeled[];
};

/** A piece of an ayah's stored text shown at once (joined in order they give the stored text back). */
export type Chunk = { text: string; from: number; to: number; words: Word[] };
export type Verse = {
  id: string;
  /** null: the basmala line before ayah 1 */
  ayah: number | null;
  surah: number;
  /** «112:1», for the gate and the caption only */
  key: string;
  /** "word": each word has its own time from the recitation; "verse": the whole verse is lit while recited */
  mode: "word" | "verse";
  chunks: Chunk[];
  /** the seal's digits (Arabic-Indic) or "" for the basmala */
  seal: string;
  translation: string | null;
  /** the translation in the order it is shown (whole sentences), each with its time */
  transChunks: Array<{ text: string; from: number; to: number; words: Word[] | null }>;
  /** «سورهٔ نور، آیهٔ ۳۵؛ ترجمهٔ مکارم» / "24:35 · Pickthall" */
  refLine: string;
  /** when the verse block is on screen */
  from: number;
  to: number;
};
export type Caption = { id: string; text: string; from: number; to: number; words: Word[] | null; keyword: string | null };
export type Sound = { who: "qari" | "narrator"; id: string; file: string; at: number; seconds: number };

export type Camera = { region: string; scale: number };
export type Shot = {
  n: number;
  start: number;
  dur: number;
  beat: number;
  /** the word the shot is locked to: its track, the unit, the word's index and its time */
  at_word: { track: "qari" | "narrator" | "none"; unit: string; index: number; time: number; text: string };
  picture: { layer: "anchor"; art: string; region: string; draw: string[] };
  motion: { camera: "push" | "pan" | "pull" | "breathe"; to: Camera; object: string[] };
  text: { layer: "verse" | "caption" | "title"; ref: string | null; keyword: string | null };
  sound: { who: "qari" | "narrator" | "silence"; music: null; sfx: null };
  transition_out: "soft-fade" | "lamp-rise" | "line-carry" | "push-through";
  meaning: string;
};

export type Storyboard = {
  video_id: string;
  project: "siraj";
  style: "chiragh";
  template: TemplateId;
  lang: "en" | "fa";
  idea_family: string;
  concept: {
    one_line: string;
    hook: { type: string; text: string };
    key_word: { verse: string; index: number } | null;
    twist_at_beat: number;
    ending: { type: "loop" | "callback" | "question"; links_to: string };
    new_because: string[];
    by: string;
  };
  fingerprint: Fingerprint;
  anchor: { art: string; inline: InlineArt | null; regions: string[] };
  title: { main: string; sub: string };
  fps: number;
  total: number;
  sounds: Sound[];
  verses: Verse[];
  captions: Caption[];
  shots: Shot[];
  cover_at: number;
  badge: { from: number; to: number } | null;
  credits: string;
  checks: { max_static_s: number; min_shot_s: number; max_shot_s: number; sync_tolerance_s: number };
};

export const TEMPLATES = ["verse-by-verse", "night-verse", "word-choice", "distances", "only-counts", "path", "writing"] as const;
export type TemplateId = (typeof TEMPLATES)[number];

export type Fingerprint = { template: string; idea_family: string; hook_type: string; ending_type: string; anchor_asset: string; objects: string[]; opening_shot: string; key: string };

/* ---------------- the pure helpers (composition, director, gate) ---------------- */

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/** The shot on screen at time t (seconds). */
export function shotAt(sb: Pick<Storyboard, "shots">, t: number): Shot {
  let cur = sb.shots[0]!;
  for (const s of sb.shots) if (s.start <= t + 1e-6) cur = s;
  return cur;
}

/** How far each group of the anchor is drawn at time t: a group draws over 1.4 s (or its shot) from its shot's start. */
export function drawProgress(sb: Pick<Storyboard, "shots">, t: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sb.shots) {
    const len = Math.max(0.6, Math.min(1.4, s.dur));
    s.picture.draw.forEach((g, i) => {
      const at = s.start + (i * len) / Math.max(1, s.picture.draw.length) / 2;
      out[g] = Math.max(out[g] ?? 0, clamp01((t - at) / len));
    });
  }
  return out;
}

/** The camera at time t: it moves to the shot's target over its first 0.8 s, then breathes. */
export function cameraAt(sb: Pick<Storyboard, "shots">, t: number): { region: string; scale: number; prev: Camera; k: number; breathe: number } {
  const shots = sb.shots;
  let i = 0;
  for (let k = 0; k < shots.length; k++) if (shots[k]!.start <= t + 1e-6) i = k;
  const s = shots[i]!;
  const prev = i > 0 ? shots[i - 1]!.motion.to : { region: s.motion.to.region, scale: s.motion.to.scale * 0.94 };
  const move = Math.min(0.8, s.dur * 0.6);
  const k = ease((t - s.start) / move);
  const breathe = clamp01((t - s.start) / Math.max(0.1, s.dur));
  return { region: s.motion.to.region, scale: s.motion.to.scale, prev, k, breathe };
}

/** How lit a verse word is at time t (0 waiting … 1 recited): the light comes in 3 frames before the word is heard, so the light's middle is on the word's first sound. */
export function litAmount(w: Word, t: number): number {
  return clamp01((t - (w.start - 0.05)) / 0.1);
}
/** How strongly a word is the one being recited now (the glow): up while it is recited, down after. */
export function glowAmount(w: Word, t: number): number {
  if (t < w.start - 0.05) return 0;
  if (t <= w.end) return clamp01((t - (w.start - 0.05)) / 0.1);
  return clamp01(1 - (t - w.end) / 0.35);
}

/** Every word event of the storyboard's sounds, in time order (the lock points of the shots). */
export function wordEvents(sb: Pick<Storyboard, "verses" | "captions">): Array<{ track: "qari" | "narrator"; unit: string; index: number; time: number; text: string }> {
  const ev: Array<{ track: "qari" | "narrator"; unit: string; index: number; time: number; text: string }> = [];
  for (const v of sb.verses) {
    if (v.mode !== "word") continue;
    let k = 0;
    for (const c of v.chunks) for (const w of c.words) ev.push({ track: "qari", unit: v.id, index: k++, time: w.start, text: w.text });
  }
  for (const c of sb.captions) (c.words ?? []).forEach((w, k) => ev.push({ track: "narrator", unit: c.id, index: k, time: w.start, text: w.text }));
  for (const v of sb.verses) for (const tc of v.transChunks) (tc.words ?? []).forEach((w, k) => ev.push({ track: "narrator", unit: `${v.id}:t`, index: k, time: w.start, text: w.text }));
  return ev.sort((a, b) => a.time - b.time);
}

/** The fingerprint's tokens (for the Jaccard likeness of two videos). */
export function fingerprintTokens(f: Fingerprint): Set<string> {
  return new Set([`t:${f.template}`, `f:${f.idea_family}`, `h:${f.hook_type}`, `e:${f.ending_type}`, `a:${f.anchor_asset}`, `o:${f.opening_shot}`, `k:${f.key}`, ...f.objects.map((o) => `x:${o}`)]);
}
export function likeness(a: Fingerprint, b: Fingerprint): number {
  const A = fingerprintTokens(a);
  const B = fingerprintTokens(b);
  let both = 0;
  for (const x of A) if (B.has(x)) both++;
  return both / Math.max(1, A.size + B.size - both);
}
