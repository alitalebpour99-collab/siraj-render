// The light of the qari previews, all generated (no picture, no figure): brass motes drifting
// up through the night, a large girih rosette turning very slowly behind the text, and the
// lamp glow that warms while the qari recites. Every mote is placed by a fixed seed, so each
// frame is the same on every render.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { starPath } from "./ornament";
import { C } from "./theme";

/** A small fixed-seed random generator (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Mote = { x: number; y: number; size: number; rise: number; swayA: number; swayT: number; phase: number; twT: number; tw: number; base: number; soft: boolean };

function makeMotes(count: number, seed: number, width: number, height: number): Mote[] {
  const rnd = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const soft = i % 7 === 0; // a few large, soft, slow ones for depth
    return {
      x: rnd() * width,
      y: rnd() * height,
      size: soft ? 46 + rnd() * 50 : 9 + rnd() * 17,
      rise: soft ? 4 + rnd() * 6 : 9 + rnd() * 22,
      swayA: 8 + rnd() * 26,
      swayT: 7 + rnd() * 9,
      phase: rnd() * Math.PI * 2,
      twT: 2.8 + rnd() * 4.5,
      tw: rnd() * Math.PI * 2,
      base: soft ? 0.08 + rnd() * 0.08 : 0.35 + rnd() * 0.5,
      soft,
    };
  });
}

const MOTE_BG = `radial-gradient(circle, rgba(255,236,190,0.95) 0%, rgba(240,196,106,0.7) 18%, rgba(224,172,79,0.22) 46%, rgba(224,172,79,0) 70%)`;
const SOFT_BG = `radial-gradient(circle, rgba(240,196,106,0.55) 0%, rgba(224,172,79,0.18) 45%, rgba(224,172,79,0) 72%)`;

/** Brass motes rising slowly, each swaying and twinkling on its own clock. */
export const Motes: React.FC<{ count?: number; seed?: number; still?: boolean; boost?: number }> = ({ count = 56, seed = 112, still, boost = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const motes = React.useMemo(() => makeMotes(count, seed, width, height), [count, seed, width, height]);
  const t = still ? 0 : frame / fps;
  const margin = 120;
  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      {motes.map((m, i) => {
        const span = height + 2 * margin;
        const y = ((((m.y - m.rise * t + margin) % span) + span) % span) - margin;
        const x = m.x + m.swayA * Math.sin((2 * Math.PI * t) / m.swayT + m.phase);
        const twinkle = 0.55 + 0.45 * Math.sin((2 * Math.PI * t) / m.twT + m.tw);
        const opacity = Math.min(1, m.base * twinkle * (m.soft ? 1 : boost));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: m.size,
              height: m.size,
              borderRadius: "50%",
              background: m.soft ? SOFT_BG : MOTE_BG,
              opacity,
              transform: `translate(${(x - m.size / 2).toFixed(1)}px, ${(y - m.size / 2).toFixed(1)}px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** A sixteen-fold girih rosette (two eight-point stars at three sizes, rings, petals, rays). */
export const Rosette: React.FC<{ size?: number; cx?: number; cy?: number; opacity?: number; turn?: number }> = ({ size = 1500, cx = 540, cy = 880, opacity = 0.1, turn = 0 }) => {
  const R = size / 2;
  const c = R;
  const petals = Array.from({ length: 16 }, (_, i) => (i * Math.PI * 2) / 16);
  const rays = Array.from({ length: 32 }, (_, i) => (i * Math.PI * 2) / 32);
  return (
    <div style={{ position: "absolute", left: cx - R, top: cy - R, width: size, height: size, opacity, transform: `rotate(${turn.toFixed(3)}deg)` }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g fill="none" stroke={C.gold} strokeLinejoin="round">
          <circle cx={c} cy={c} r={R * 0.97} strokeWidth={1.6} />
          <circle cx={c} cy={c} r={R * 0.9} strokeWidth={0.9} />
          {[0.86, 0.6, 0.34].map((k) => (
            <React.Fragment key={k}>
              <path d={starPath(c, c, R * k)} strokeWidth={1.4} />
              <path d={starPath(c, c, R * k)} strokeWidth={1.4} transform={`rotate(22.5 ${c} ${c})`} />
            </React.Fragment>
          ))}
          {petals.map((a, i) => (
            <circle key={`p${i}`} cx={c + Math.cos(a) * R * 0.73} cy={c + Math.sin(a) * R * 0.73} r={R * 0.06} strokeWidth={1} />
          ))}
          {rays.map((a, i) => (
            <line key={`r${i}`} x1={c + Math.cos(a) * R * 0.16} y1={c + Math.sin(a) * R * 0.16} x2={c + Math.cos(a) * R * 0.3} y2={c + Math.sin(a) * R * 0.3} strokeWidth={0.8} />
          ))}
          <circle cx={c} cy={c} r={R * 0.14} strokeWidth={1.2} />
        </g>
      </svg>
    </div>
  );
};

/** The lamp glow behind the Arabic; `warm` (0–1) is how much the recitation lights it. */
export const Lamp: React.FC<{ warm: number; cy?: number }> = ({ warm, cy = 0.42 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      opacity: 0.35 + 0.65 * warm,
      background: `radial-gradient(46% 26% at 50% ${cy * 100}%, ${C.brass}38 0%, ${C.brass}14 55%, ${C.brass}00 100%)`,
    }}
  />
);
