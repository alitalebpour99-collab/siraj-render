// The control room's «استودیو» (service §4.7) as the videos read it: the ground (look), how
// much things move (motion), the brass motes, the mushaf frame and the ending. One look per
// render: `applyStudio` sets the palette before anything is drawn (every component reads C at
// render time), so the four looks need no second copy of any component. No music in any look.
import type { Studio } from "./props";
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
  quiet: "#5a4f41",
  turquoise: "#7d4f0c", // a deep amber, 5:1 on the cream (the second colour of the counts)
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
export function applyStudio(s: Partial<Studio> | null | undefined, _lamp = true): Studio {
  const st = studioOf(s);
  // ONE style (owner, 2026-11-20: «چراغ»): every format is drawn in the cream, emerald and lamp
  // palette, whatever look an old job or the room still names. The lapis, night, pewter and
  // paper looks are gone; the seven templates are drawn by src/chiragh/Chiragh.tsx itself.
  Object.assign(C, LAPIS, LAMP);
  flags.lamp = true;
  flags.glow = false;
  flags.paper = true;
  flags.motes = false;
  motion.k = st.motion === "calm" ? 1.3 : st.motion === "lively" ? 0.78 : 1;
  motion.drift = st.motion === "calm" ? 0.7 : st.motion === "lively" ? 1.35 : 1;
  return st;
}

/** A length in frames scaled by the motion setting. */
export const mk = (frames: number) => Math.round(frames * motion.k);
