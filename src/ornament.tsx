// Siraj's ornaments, drawn here from geometry (no picture, no figure): the night with its
// generated star lattice, the mushaf frame with its two gold hairlines and its band, the
// cartouche of a surah's name, the seal at the end of an ayah, the lamp mark.
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, easeInOut } from "./theme";

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Eight-pointed star (two overlapping squares) as a closed path, as Siraj's mark draws it. */
export function starPath(cx: number, cy: number, outer: number, inner = outer * (Math.SQRT1_2 / Math.cos(Math.PI / 8))) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 8;
    pts.push(`${r2(cx + radius * Math.cos(angle))} ${r2(cy + radius * Math.sin(angle))}`);
  }
  return `M${pts.join("L")}Z`;
}

/** A rounded rectangle as a path (for even-odd bands). */
function roundRect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/**
 * The night: lapis gradient, a lattice of eight-pointed stars and small crosses (generated,
 * one tile repeated), faint in the middle where the text stands, and a brass light that
 * breathes very slowly. The lattice drifts a few pixels a second.
 */
export const Night: React.FC<{ still?: boolean; glowY?: number }> = ({ still, glowY = 0.43 }) => {
  const frame = useCurrentFrame();
  const f = still ? 0 : frame;
  const { width, height } = useVideoConfig();
  const T = 168;
  const R = T / 2;
  const drift = f * 0.22;
  const breathe = still ? 0 : Math.sin((f / 30) * ((2 * Math.PI) / 9)) * 0.025;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.night} 0%, ${C.night2} 52%, ${C.night} 100%)` }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="lattice" width={T} height={T} patternUnits="userSpaceOnUse" patternTransform={`translate(0 ${r2(drift % T)})`}>
            <path d={starPath(R, R, R)} fill="none" stroke={C.gold} strokeWidth={1.6} strokeLinejoin="round" />
            <path d={starPath(R, R, R * 0.72)} fill="none" stroke={C.gold} strokeWidth={1} strokeLinejoin="round" opacity={0.7} />
            <circle cx={R} cy={R} r={T * 0.09} fill="none" stroke={C.gold} strokeWidth={1} opacity={0.8} />
            {[
              [0, 0],
              [T, 0],
              [0, T],
              [T, T],
            ].map(([x, y]) => (
              <path key={`${x}-${y}`} d={`M${x} ${y! - T * 0.2}L${x! + T * 0.2} ${y}L${x} ${y! + T * 0.2}L${x! - T * 0.2} ${y}Z`} fill="none" stroke={C.gold} strokeWidth={1.3} />
            ))}
          </pattern>
          <radialGradient id="latticeMask" cx="50%" cy={`${glowY * 100}%`} r="70%">
            <stop offset="0%" stopColor="#fff" stopOpacity={0.18} />
            <stop offset="55%" stopColor="#fff" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#fff" stopOpacity={1} />
          </radialGradient>
          <mask id="latticeFade">
            <rect width={width} height={height} fill="url(#latticeMask)" />
          </mask>
          <radialGradient id="glow" cx="50%" cy={`${glowY * 100}%`} r="55%">
            <stop offset="0%" stopColor={C.brass} stopOpacity={0.13 + breathe} />
            <stop offset="60%" stopColor={C.brass} stopOpacity={0.03} />
            <stop offset="100%" stopColor={C.brass} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
            <stop offset="65%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.45} />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#lattice)" mask="url(#latticeFade)" opacity={0.12} />
        <rect width={width} height={height} fill="url(#glow)" />
        <rect width={width} height={height} fill="url(#vignette)" />
      </svg>
    </AbsoluteFill>
  );
};

/**
 * The mushaf frame of Siraj's surah page: a gold hairline, the lapis band with its four-point
 * stars, a second gold hairline inside. It is drawn in at the start as on the site: from the
 * middle of the upper edge out to its corners, then down both sides.
 */
export const MushafFrame: React.FC<{ drawn?: boolean; inset?: number }> = ({ drawn, inset = 30 }) => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const band = 24;
  const o = inset;
  const b0 = o + 7;
  const b1 = b0 + band;
  const inner = b1 + 9;
  const open = drawn ? 1 : interpolate(f, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  const down = drawn ? 1 : interpolate(f, [12, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  const strip = o + band + 40;
  const clip = `inset(0 ${r2(50 * (1 - open))}% ${r2((height - strip) * (1 - down))}px ${r2(50 * (1 - open))}%)`;
  const t = band;
  return (
    <AbsoluteFill style={{ clipPath: clip }}>
      <svg width={width} height={height}>
        <defs>
          <pattern id="band" width={t} height={t} patternUnits="userSpaceOnUse" x={b0} y={b0}>
            <rect width={t} height={t} fill={C.band} />
            <circle cx={t / 2} cy={t / 2} r={t * 0.36} fill={C.star} opacity={0.92} />
            {[
              [0, 0],
              [t, 0],
              [0, t],
              [t, t],
            ].map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x} cy={y} r={t * 0.51} fill={C.band} />
                <circle cx={x} cy={y} r={t * 0.07} fill={C.star} />
              </g>
            ))}
          </pattern>
          <linearGradient id="bandShade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={C.bandDeep} stopOpacity={0} />
            <stop offset="100%" stopColor={C.bandDeep} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <path
          d={`${roundRect(b0, b0, width - 2 * b0, height - 2 * b0, 12)}${roundRect(b1, b1, width - 2 * b1, height - 2 * b1, 6)}`}
          fillRule="evenodd"
          fill="url(#band)"
        />
        <path
          d={`${roundRect(b0, b0, width - 2 * b0, height - 2 * b0, 12)}${roundRect(b1, b1, width - 2 * b1, height - 2 * b1, 6)}`}
          fillRule="evenodd"
          fill="url(#bandShade)"
        />
        <rect x={o} y={o} width={width - 2 * o} height={height - 2 * o} rx={18} fill="none" stroke={C.gold} strokeWidth={3} />
        <rect x={inner} y={inner} width={width - 2 * inner} height={height - 2 * inner} rx={6} fill="none" stroke={C.gold} strokeWidth={1.6} />
      </svg>
    </AbsoluteFill>
  );
};

/** A seal: an eight-point star around a ring, gold lines and a faint gold fill. */
export const Seal: React.FC<{ size: number; turn?: number; style?: React.CSSProperties }> = ({ size, turn = 0, style }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" style={{ transform: `rotate(${turn}deg)`, ...style }}>
    <path d="M20 2.5 24.6 8.9 32.4 7.6 31.1 15.4 37.5 20 31.1 24.6 32.4 32.4 24.6 31.1 20 37.5 15.4 31.1 7.6 32.4 8.9 24.6 2.5 20 8.9 15.4 7.6 7.6 15.4 8.9Z" fill={C.gold} fillOpacity={0.14} stroke={C.gold} strokeWidth={1.2} strokeLinejoin="round" />
    <circle cx={20} cy={20} r={10.2} fill="none" stroke={C.gold} strokeWidth={0.9} />
  </svg>
);

/** The seal at the end of an ayah, with its number; sized in em so it follows the text. */
export const AyahSeal: React.FC<{ label: string; font: string }> = ({ label, font }) => (
  <span style={{ position: "relative", display: "inline-block", width: "1.15em", height: "1.15em", verticalAlign: "-0.28em", marginInline: "0.08em" }}>
    <svg viewBox="0 0 40 40" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <path d="M20 2.5 24.6 8.9 32.4 7.6 31.1 15.4 37.5 20 31.1 24.6 32.4 32.4 24.6 31.1 20 37.5 15.4 31.1 7.6 32.4 8.9 24.6 2.5 20 8.9 15.4 7.6 7.6 15.4 8.9Z" fill={C.gold} fillOpacity={0.14} stroke={C.gold} strokeWidth={1.3} strokeLinejoin="round" />
      <circle cx={20} cy={20} r={10.2} fill="none" stroke={C.gold} strokeWidth={1} />
    </svg>
    <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: font, fontSize: "0.4em", lineHeight: 1, color: C.ink, direction: "rtl" }}>{label}</span>
  </span>
);

/** The cartouche of a surah's name: pointed lapis plate, gold hairline above and below. */
export const Cartouche: React.FC<{ children: React.ReactNode; height: number; open?: number; style?: React.CSSProperties }> = ({ children, height, open = 1, style }) => {
  const point = height * 0.32;
  const a = 32 * (1 - open);
  const clip =
    open >= 1
      ? `polygon(0 50%, ${point}px 0, calc(100% - ${point}px) 0, 100% 50%, calc(100% - ${point}px) 100%, ${point}px 100%)`
      : `polygon(${a}% 50%, calc(${a}% + ${point}px) 0, calc(${100 - a}% - ${point}px) 0, ${100 - a}% 50%, calc(${100 - a}% - ${point}px) 100%, calc(${a}% + ${point}px) 100%)`;
  return (
    <div style={{ position: "relative", display: "inline-grid", placeItems: "center", minHeight: height, paddingInline: point + 44, ...style }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: clip,
          background: `linear-gradient(${C.star}bb, ${C.star}bb) 0 7px / 100% 2px no-repeat, linear-gradient(${C.star}bb, ${C.star}bb) 0 calc(100% - 8px) / 100% 2px no-repeat, linear-gradient(160deg, ${C.band}, ${C.bandDeep})`,
        }}
      />
      <div style={{ position: "relative", opacity: open }}>{children}</div>
    </div>
  );
};

/** A small gold star between two fading hairlines. */
export const Divider: React.FC<{ width?: number; style?: React.CSSProperties }> = ({ width = 300, style }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, ...style }}>
    <div style={{ width: width / 2 - 30, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.gold})` }} />
    <svg width={30} height={30} viewBox="0 0 30 30">
      <path d={starPath(15, 15, 13)} fill={C.gold} fillOpacity={0.25} stroke={C.gold} strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
    <div style={{ width: width / 2 - 30, height: 1.5, background: `linear-gradient(90deg, ${C.gold}, transparent)` }} />
  </div>
);

/** Siraj's lamp mark (brand/mark.ts): a lamp with its flame inside an eight-fold star halo. */
export const SirajMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <path d={starPath(32, 32, 28.6)} fill="#2a4f86" stroke="#2a4f86" strokeWidth={3} strokeLinejoin="round" />
    <path d={starPath(32, 32, 24.2)} fill="none" stroke="#f6efe0" strokeOpacity={0.55} strokeWidth={0.8} strokeLinejoin="round" />
    <path
      d="M16.4 32.6C19.4 32.8 23 34.2 25.8 35.4H51C51 39.6 45.4 42.8 38.4 42.8C31.8 42.8 26.6 40.6 24.2 38.6C21.8 37.2 19.2 36 16.6 35.4C15.6 35.2 15.5 32.8 16.4 32.6ZM33.4 42.4H43.4L45 45.8H31.8Z"
      fill="#f6efe0"
    />
    <path d="M17.4 17.4C20.9 21.8 22.4 24.9 22.4 27.8C22.4 30.7 20.2 32.9 17.4 32.9C14.6 32.9 12.4 30.7 12.4 27.8C12.4 24.9 13.9 21.8 17.4 17.4Z" fill="#e0ac4f" />
    <path d="M17.4 23.8C19 25.8 19.6 27.2 19.6 28.6C19.6 30.1 18.7 31.2 17.4 31.2C16.1 31.2 15.2 30.1 15.2 28.6C15.2 27.2 15.8 25.8 17.4 23.8Z" fill="#fff3d1" />
  </svg>
);
