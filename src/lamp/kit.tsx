// The lamp look's few pieces (Siraj's own look of the set style, 2026-11-14): the warm cream
// ground with a small golden glow behind a simple modern oil lamp, the slow camera, and the
// channel badge. Light, calm and respectful: things only drift, breathe and push in slowly;
// nothing shakes, flashes or cuts. No manuscript border, no arabesque, no figure.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Motes } from "../light";
import { motion } from "../studio";
import { C, FONT, easeInOut, easeOut } from "../theme";
import { COL_X, ZONES } from "./zones";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const TAU = Math.PI * 2;

/** A wave that is at the same place on the first and the last frame (so the Reel loops). */
export const loopWave = (f: number, total: number, turns = 1) => Math.sin((TAU * turns * f) / Math.max(1, total));
/** 0 at the first and the last frame, 1 in the middle: the ground's slow push in and back. */
export const breath = (f: number, total: number) => Math.sin((Math.PI * Math.min(Math.max(f, 0), total)) / Math.max(1, total));

/** The lamp: a low oil lamp with its spout, foot and handle in emerald lines, a small golden flame. */
export const Emblem: React.FC<{ size: number; flicker?: number; warm?: number }> = ({ size, flicker = 0, warm = 0.6 }) => {
  const h = size * 0.82;
  const sy = 1 + 0.05 * flicker;
  return (
    <svg width={size} height={h} viewBox="0 0 120 98" style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id="lamp-flame" cx="50%" cy="70%" r="65%">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="45%" stopColor="#f3c25a" />
          <stop offset="100%" stopColor="#d9902a" />
        </radialGradient>
      </defs>
      <g transform={`translate(104 50) scale(1 ${sy.toFixed(3)}) skewX(${(2.5 * flicker).toFixed(2)}) translate(-104 -50)`} opacity={0.75 + 0.25 * warm}>
        <path d="M104 50C97.5 43.5 98.5 33 105.5 21C111.5 32.5 112.5 43.5 106.5 50Z" fill="url(#lamp-flame)" />
        <path d="M105 48C102.4 45 102.8 39.6 105.6 34.4C108.2 39.6 108.6 45 106.2 48Z" fill="#fffaf0" opacity={0.85} />
      </g>
      <g fill="none" stroke={C.brass} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 60C24 47 43 41.5 62 42.5C77 43.3 91 47.5 103 51.5C95 56 82 62.5 66 65.5C47 69 26 70 24 60Z" fill={`${C.night}`} />
        <path d="M44.5 43.6C47 40.6 55.5 40 59.5 42.6" />
        <path d="M25 55.5C13 51.5 7.5 63 15 67C18.5 69 22.5 66.5 25.5 64" />
        <path d="M48 67.5L44 79H74L70 66.2" />
        <path d="M38 83H80" />
      </g>
    </svg>
  );
};

/**
 * The ground of every lamp Reel: cream, a small golden glow behind the lamp that warms while the
 * qari recites, a few golden motes, and a camera that pushes in from the first frame and is back
 * home on the last one. `lamp` null: the glow only (the insight videos keep their own picture).
 */
export const Ground: React.FC<{ total: number; still?: boolean; lamp?: { x: number; y: number; size: number } | null; glow?: { x: number; y: number } | null; warm?: number; seed?: number }> = ({ total, still, lamp = { x: COL_X, y: 430, size: 132 }, glow, warm = 0.5, seed = 5 }) => {
  const now = useCurrentFrame();
  const f = still ? 0 : now;
  const k = still ? 0 : breath(f, total);
  // a small push already in the first second and a half, then the slow breath of the whole Reel
  const early = still ? 0 : interpolate(f, [0, 45], [0, 1], { ...clamp, easing: easeOut }) * interpolate(f, [total - 45, total], [1, 0], { ...clamp, easing: easeInOut });
  const scale = 1 + 0.012 * early + 0.02 * k * motion.drift;
  const at = glow ?? (lamp ? { x: lamp.x, y: lamp.y - 6 } : { x: COL_X, y: 760 });
  const pulse = still ? 0 : loopWave(f, total, Math.max(1, Math.round(total / 150)));
  const float = still ? 0 : 3 * loopWave(f, total, Math.max(1, Math.round(total / 120)));
  const flicker = still ? 0 : 0.6 * loopWave(f, total, Math.max(2, Math.round(total / 22))) + 0.4 * loopWave(f, total, Math.max(3, Math.round(total / 9)));
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #f8f2e6 0%, ${C.night} 45%, ${C.night2} 100%)` }}>
      <AbsoluteFill style={{ transform: `scale(${scale.toFixed(4)})`, transformOrigin: `${at.x}px ${at.y}px`, willChange: "transform" }}>
        <div
          style={{
            position: "absolute",
            left: at.x - 420,
            top: at.y - 420,
            width: 840,
            height: 840,
            borderRadius: "50%",
            opacity: Math.min(1, 0.62 + 0.3 * warm + 0.06 * pulse),
            background: "radial-gradient(circle, rgba(242,196,96,0.58) 0%, rgba(242,196,96,0.26) 24%, rgba(242,196,96,0.08) 46%, rgba(242,196,96,0) 64%)",
          }}
        />
        {lamp ? (
          <div style={{ position: "absolute", left: lamp.x - lamp.size / 2, top: lamp.y - lamp.size * 0.5 + float, width: lamp.size }}>
            <Emblem size={lamp.size} flicker={flicker} warm={warm} />
          </div>
        ) : null}
        {still ? null : <Motes count={14} seed={seed} boost={0.55} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(120% 80% at 50% 42%, rgba(120,90,40,0) 58%, rgba(120,90,40,0.12) 100%)" }} />
    </AbsoluteFill>
  );
};

/** The channel badge: «سراج» or «Siraj», a tiny heart and a tiny follow mark, small, in the bottom safe area. */
export const Badge: React.FC<{ lang: "en" | "fa"; len: number }> = ({ lang, len }) => {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [0, 8], [0, 1], { ...clamp, easing: easeInOut }), interpolate(f, [len - 8, len], [1, 0], { ...clamp, easing: easeInOut }));
  const y = interpolate(f, [0, 10], [10, 0], { ...clamp, easing: easeOut });
  const fa = lang === "fa";
  const mark = 30;
  return (
    <div
      data-role="badge"
      data-b="badge"
      dir={fa ? "rtl" : "ltr"}
      style={{
        position: "absolute",
        left: ZONES.left + 26,
        top: ZONES.bottom - 92 + y,
        height: 66,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 22px",
        borderRadius: 999,
        border: `2px solid ${C.gold}`,
        background: "rgba(255,252,244,0.94)",
        boxShadow: "0 6px 18px rgba(80,60,20,0.12)",
        opacity: o,
      }}
    >
      <span style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: fa ? 34 : 36, fontWeight: fa ? 700 : 600, lineHeight: 1, color: C.gold, letterSpacing: fa ? 0 : "0.04em" }}>{fa ? "سراج" : "Siraj"}</span>
      <svg width={mark} height={mark} viewBox="0 0 24 24" aria-hidden>
        <path d="M12 20.5C6.6 16.4 3.5 13.4 3.5 9.6C3.5 7 5.5 5 8 5C9.7 5 11.1 5.9 12 7.3C12.9 5.9 14.3 5 16 5C18.5 5 20.5 7 20.5 9.6C20.5 13.4 17.4 16.4 12 20.5Z" fill={`${C.gold}22`} stroke={C.gold} strokeWidth={1.8} strokeLinejoin="round" />
      </svg>
      <svg width={mark} height={mark} viewBox="0 0 24 24" aria-hidden>
        <circle cx={12} cy={12} r={9} fill="none" stroke={C.gold} strokeWidth={1.8} />
        <path d="M12 7.8V16.2M7.8 12H16.2" stroke={C.gold} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    </div>
  );
};
