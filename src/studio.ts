// The control room's «استودیو» (service §4.7) as the videos read it: the ground (look), how
// much things move (motion), the brass motes, the mushaf frame and the ending. One look per
// render: `applyStudio` sets the palette before anything is drawn (every component reads C at
// render time), so the four looks need no second copy of any component. No music in any look.
import type { Look, Studio } from "./props";
import { C } from "./theme";

export const DEFAULT_STUDIO: Studio = {
  template: null,
  look: "lapis",
  motion: "medium",
  particles: true,
  frame: true,
  seriesNumber: true,
  wordGlow: true,
  pace: "normal",
  hook: "name-number",
  ending: "loop",
  maxSeconds: null,
  story: false,
  carousel: false,
};

const LAPIS = { ...C };

/** The palettes: lapis night (Siraj's own), Thursday night (violet, candle-warm), muted pewter (no glow), mushaf paper. */
const LOOKS: Record<Look, Partial<typeof C>> = {
  lapis: {},
  night: { night: "#120f26", night2: "#1f1a3d", deep: "#0a0818", band: "#3a2f6b", bandDeep: "#221b45", gold: "#e6bd72", brass: "#f0c27a", star: "#f3d48f" },
  pewter: { night: "#1a1d24", night2: "#262a33", deep: "#121419", band: "#3a3f4a", bandDeep: "#2a2e36", gold: "#b9bcc4", brass: "#d6d8dd", brassDeep: "#9da1aa", star: "#d6d8dd", ink: "#e4e5e8", translation: "#c9cbd0", quiet: "#8d929c", turquoise: "#9fb3c8" },
  paper: { night: "#efe6d2", night2: "#e6dac0", deep: "#d9cba9", band: "#7a5a2a", bandDeep: "#5e431c", gold: "#9a6a1e", brass: "#a8741f", brassDeep: "#7f5514", star: "#7a4f10", ink: "#2a2116", translation: "#3b3022", quiet: "#6d5f4a", turquoise: "#2f7f78" },
};

/**
 * The lamp look of the set style (owner, 2026-11-13; Siraj's own, never another brand's): warm
 * cream, a deep emerald for the light of the words and the lines, dark ink for the text, a small
 * golden glow only behind the lamp (src/lamp/Ground.tsx). No mushaf frame, no arabesque.
 */
export const LAMP: Partial<typeof C> = {
  night: "#f7f0e2",
  night2: "#f0e5cf",
  deep: "#e8dabe",
  band: "#125c4a",
  bandDeep: "#0c4538",
  gold: "#14684f",
  brass: "#0f5f4a",
  brassDeep: "#0b4b3a",
  star: "#123d31",
  ink: "#2b241a",
  translation: "#3a3125",
  quiet: "#6e6250",
  turquoise: "#b07a22",
};

export type LookFlags = { glow: boolean; motes: boolean; paper: boolean; lamp: boolean };
export const flags = { glow: true, motes: true, paper: false, lamp: false };
/** Entrance lengths are multiplied by this (calm is slower, lively quicker). */
export const motion = { k: 1, drift: 1 };

/** The studio of a render, with the defaults for what the job left out (an old job has none). */
export function studioOf(s: Partial<Studio> | null | undefined): Studio {
  return { ...DEFAULT_STUDIO, ...(s ?? {}) };
}

/**
 * Sets the palette and the motion of this render; returns the studio in force. With the set
 * style's lamp the look is the lamp's whatever the studio's ground says (its motion stays).
 */
export function applyStudio(s: Partial<Studio> | null | undefined, lamp = false): Studio {
  const st = studioOf(s);
  Object.assign(C, LAPIS, lamp ? LAMP : (LOOKS[st.look] ?? {}));
  flags.lamp = lamp;
  flags.glow = !lamp && st.look !== "pewter";
  flags.paper = lamp || st.look === "paper";
  flags.motes = !lamp && st.particles && st.look !== "pewter";
  motion.k = st.motion === "calm" ? 1.3 : st.motion === "lively" ? 0.78 : 1;
  motion.drift = st.motion === "calm" ? 0.7 : st.motion === "lively" ? 1.35 : 1;
  return st;
}

/** A length in frames scaled by the motion setting. */
export const mk = (frames: number) => Math.round(frames * motion.k);
