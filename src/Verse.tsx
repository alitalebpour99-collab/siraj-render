// «Verse & meaning» (en) / «آیه و معنی» (fa): a complete unit, a whole surah or its opening
// section, ayah by ayah. The qari's own recitation (cut in the run, never committed) with each
// Arabic word lit in brass as he recites it; then the translation fades in under it and the
// narrator (a synthetic voice) reads it, never over the qari. An opening card first, the
// sources last. Every ayah and translation string is the API's, rendered exactly as stored;
// nothing here holds sacred or translated text. No music, no bed.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { splitLeadingBasmala } from "./basmala";
import { Fit } from "./Fit";
import { L, SITE, firstUrl, host } from "./labels";
import { Lamp, World } from "./light";
import { AyahSeal, Cartouche, Divider, MushafFrame, Seal, SirajMark } from "./ornament";
import type { QariClip, VerseProps, WordTime } from "./props";
import { applyStudio, flags } from "./studio";
import { C, FONT, SAFE, W, arNum, easeInOut, easeOut, fadeIn, fadeOut, faNum, rise } from "./theme";
import { VT, verseTimeline, type VerseCard } from "./timelines";
import { pieces, wordParts } from "./words";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const H_BOTTOM = 1920 - SAFE.bottom + 20;

// ---------- the light of a word ----------

type RGBA = [number, number, number, number];
const DIM_DARK: RGBA = [243, 234, 214, 0.5];
const SETTLED_DARK: RGBA = [231, 186, 98, 1];
const HOT_DARK: RGBA = [255, 219, 140, 1];
// on the mushaf paper the ink is dark and the light is a deeper brass
const DIM_PAPER: RGBA = [42, 33, 22, 0.42];
const SETTLED_PAPER: RGBA = [122, 79, 16, 1];
const HOT_PAPER: RGBA = [168, 102, 12, 1];
// in the lamp look (2026-11-14) the ink is dark on cream and the light is a deep emerald
// the lamp style keeps every word at 7:1 or more on the cream (review of 2026-11-14: the waiting words were 2:1):
// a word not yet recited is a warm brown, a recited one deep emerald, the word being recited a brighter emerald
const DIM_LAMP: RGBA = [74, 64, 52, 1];
const SETTLED_LAMP: RGBA = [22, 50, 40, 1];
const HOT_LAMP: RGBA = [10, 82, 64, 1];
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [0, 1, 2, 3].map((i) => a[i]! + (b[i]! - a[i]!) * t) as RGBA;
const rgba = (c: RGBA) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;

/** A word blooms when the qari reaches it, stays bright while he recites it, then settles. */
function wordLook(t: number, w: WordTime): React.CSSProperties {
  if (flags.lamp) {
    if (t < w.start) return { color: rgba(DIM_LAMP) };
    const lit = clamp01((t - w.start) / 0.14);
    const hot = t <= w.end ? 1 : easeOut(clamp01(1 - (t - w.end) / 0.75));
    const color = mix(mix(DIM_LAMP, SETTLED_LAMP, lit), HOT_LAMP, hot * lit);
    // a small warm halo only on the word being recited
    return hot * lit > 0.02 ? { color: rgba(color), textShadow: `0 0 ${(4 + 12 * hot * lit).toFixed(1)}px rgba(236,184,82,${(0.5 * hot * lit).toFixed(3)})` } : { color: rgba(color) };
  }
  const [DIM, SETTLED, HOT] = flags.paper ? [DIM_PAPER, SETTLED_PAPER, HOT_PAPER] : [DIM_DARK, SETTLED_DARK, HOT_DARK];
  if (t < w.start) return { color: rgba(DIM) };
  const lit = clamp01((t - w.start) / 0.14);
  const hot = t <= w.end ? 1 : easeOut(clamp01(1 - (t - w.end) / 0.75));
  const glow = lit * (0.28 + 0.72 * hot);
  const color = mix(mix(DIM, SETTLED, lit), HOT, hot * lit * 0.85);
  // a settled word keeps one soft layer of light (two blurred layers on every word of a long verse
  // made «Every Letter» the slowest render, S3e); the word being recited keeps both, as before
  if (hot === 0 && !flags.paper) return { color: rgba(color), textShadow: `0 0 ${(5 + 19 * glow).toFixed(1)}px rgba(224,172,79,${(0.16 + 0.56 * glow).toFixed(3)})` };
  return {
    color: rgba(color),
    textShadow: flags.paper ? `0 0 ${(4 + 10 * glow).toFixed(1)}px rgba(200,140,40,${(0.1 + 0.3 * glow).toFixed(3)})` : `0 0 ${(5 + 19 * glow).toFixed(1)}px rgba(224,172,79,${(0.16 + 0.56 * glow).toFixed(3)}), 0 0 ${(2 + 7 * glow).toFixed(1)}px rgba(255,232,176,${(0.08 + 0.5 * glow).toFixed(3)})`,
  };
}

/** The timing of each word of `text` in a clip; the whole clip for every word in a fallback. */
function timesFor(clip: QariClip, count: number): WordTime[] {
  if (clip.mode === "word" && clip.words.length === count) return clip.words;
  return Array.from({ length: count }, () => ({ start: 0, end: clip.seconds }));
}

/**
 * Stored text set word by word, each word lit by its own timing (or, with no recitation, set
 * plainly in ink); `after` (the ayah's seal) stays on one line with the last word, as in S1.
 */
export const LitText: React.FC<{ text: string; clip: QariClip | null | undefined; t: number; after?: React.ReactNode; plain?: string }> = ({ text, clip, t, after, plain = C.ink }) => {
  const { parts, count } = wordParts(text);
  const times = clip ? timesFor(clip, count) : null;
  let last = -1;
  parts.forEach((part, i) => {
    if (part.word !== null) last = i;
  });
  const span = (i: number) => {
    const part = parts[i]!;
    if (part.word === null || !times) return <React.Fragment key={i}>{part.text}</React.Fragment>;
    return (
      <span key={i} style={wordLook(t, times[part.word]!)}>
        {part.text}
      </span>
    );
  };
  const head = after && last >= 0 ? parts.slice(0, last) : parts;
  return (
    <span style={times ? undefined : { color: plain }}>
      {head.map((_, i) => span(i))}
      {after && last >= 0 ? (
        <span style={{ whiteSpace: "nowrap" }}>
          {span(last)}
          {parts.slice(last + 1).map((p) => p.text)}
          {" "}
          {after}
        </span>
      ) : null}
    </span>
  );
};

/** The translation line, each word brightening as the narrator says it (when ElevenLabs gave word timings). */
export const SpokenText: React.FC<{ text: string; words: Array<[number, number]> | undefined; t: number }> = ({ text, words, t }) => {
  const list = pieces(text);
  const count = list.filter((p) => p.word !== null).length;
  if (!words || words.length !== count) return <>{text}</>;
  return (
    <>
      {list.map((p, i) => {
        if (p.word === null) return <React.Fragment key={i}>{p.text}</React.Fragment>;
        const [s] = words[p.word]!;
        const k = clamp01((t * 1000 - s) / 160);
        return (
          // the lamp style shows the translation while the qari recites: a word not yet said stays readable (4.5:1 or more)
          <span key={i} style={{ opacity: flags.lamp ? 0.8 + 0.2 * k : 0.58 + 0.42 * k }}>
            {p.text}
          </span>
        );
      })}
    </>
  );
};

// ---------- the cards ----------

// (2026-11-20) The classic verse Reel is gone: every verse is drawn in «چراغ» (src/chiragh/Chiragh.tsx). LitText stays for the formats that still show a verse inside their own picture.
