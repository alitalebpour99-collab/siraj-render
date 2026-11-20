// <EmeraldLineArt>: an anchor drawn line by line (style bible v2 §6). Every path gets
// pathLength 1 and is revealed by its dash offset, so a group "draws on" like a pen; a soft
// emerald bloom (one blurred copy) gives the lines the reference's glow. The gold paths (the
// flame) fade in instead. Labels (numbers, letters of a root) come in with their group.
import React from "react";
import type { InlineArt } from "./storyboard";
import { FONT, INK } from "./tokens";

export const EmeraldLineArt: React.FC<{ art: InlineArt; progress: Record<string, number>; width?: number; height?: number; uid: string; flicker?: number }> = ({ art, progress, width = 1080, height = 600, uid, flicker = 0 }) => {
  const drawn = (g: string) => progress[g] ?? 0;
  const lines = art.groups.filter((g) => !g.gold && !g.fill);
  const gold = art.groups.filter((g) => g.gold || g.fill);
  const body = (bloom: boolean) =>
    lines.map((g) => {
      const p = drawn(g.id);
      if (p <= 0) return null;
      return (
        <g key={g.id} data-group={g.id}>
          {g.paths.map((d, i) => (
            <path
              key={i}
              d={d}
              pathLength={1}
              fill="none"
              stroke={INK.emerald}
              strokeWidth={(g.weight ?? 2.6) * (bloom ? 3.2 : 1)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 1"
              strokeDashoffset={1 - p}
              opacity={bloom ? 0.16 : 1}
            />
          ))}
        </g>
      );
    });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: "visible" }} data-art={art.id}>
      <defs>
        <filter id={`bloom-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <radialGradient id={`flame-${uid}`} cx="50%" cy="70%" r="70%">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="50%" stopColor={INK.flame} />
          <stop offset="100%" stopColor="#d9902a" />
        </radialGradient>
      </defs>
      <g filter={`url(#bloom-${uid})`}>{body(true)}</g>
      <g>{body(false)}</g>
      {gold.map((g) => {
        const p = drawn(g.id);
        if (p <= 0) return null;
        return (
          <g key={g.id} opacity={p} style={{ transformBox: "fill-box", transformOrigin: "50% 100%", transform: `scaleY(${(1 + 0.06 * flicker).toFixed(3)})` }}>
            {g.paths.map((d, i) => (g.fill ? <path key={i} d={d} fill={`url(#flame-${uid})`} /> : <path key={i} d={d} fill="none" stroke={INK.gold} strokeWidth={2.6} />))}
          </g>
        );
      })}
      {(art.labels ?? []).map((l, i) => {
        const p = drawn(l.group);
        if (p <= 0) return null;
        return (
          <text
            key={i}
            data-role="label"
            x={l.x}
            y={l.y}
            textAnchor={l.anchor ?? "middle"}
            dominantBaseline="middle"
            fontFamily={l.font === "quran" ? FONT.quran : l.font === "en" ? FONT.en : FONT.fa}
            fontSize={l.size}
            fontWeight={l.font === "fa" ? 700 : 500}
            fill={INK.emeraldDeep}
            opacity={Math.min(1, p * 1.6)}
            direction={l.font === "en" ? "ltr" : "rtl"}
          >
            {l.text}
          </text>
        );
      })}
    </svg>
  );
};
