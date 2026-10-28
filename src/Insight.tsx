// The insight videos of S3b: The Only…, The Counts Test (myth vs fact), Meccan · Medinan,
// Counted, the Mushaf Map, the Middle, Revelation Order, One Line Many Times, the Opening
// Letters, Every Letter and the Quiz. One engine, one ground: the night, the mushaf frame and the
// brass light; each format has its own focal picture (a strip of the 114 surahs, the map of the
// 604 pages, 114 flying tiles, a ladder, the alphabet, a timer ring). Every number was counted at
// render time from Siraj's API and the Tanzil metadata (scripts/insights.mjs) and is printed with
// its rule; every Arabic string is a span of the stored text; the narration is the job's fixed
// sentences, set word by word as the voice says them. The qari recites, never under the voice.
// No music, no figures.
import React from "react";
import { AbsoluteFill, Audio, Freeze, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { splitLeadingBasmala } from "./basmala";
import { Fit } from "./Fit";
import { BAND } from "./layout";
import { FORMAT_NAME, I_WORDS, chipOf, ruleOf } from "./insightWords";
import { SITE, host } from "./labels";
import { Lamp, World } from "./light";
import { AyahSeal, Cartouche, MushafFrame, Seal, SirajMark } from "./ornament";
import type { IndexSurah, InsightProps, Lang, QariClip } from "./props";
import { applyStudio, flags, mk } from "./studio";
import { C, FONT, W, arNum, easeInOut, easeOut, enNum, faGrouped, faNum } from "./theme";
import { ST, insightTimeline, type InsightScene, type SceneLine } from "./timelines";
import { LitText } from "./Verse";
import { pieces, wordCount } from "./words";

/* ---------- layout: every text stays inside the 4:5 band (y 285–1635) and above the caption zone ---------- */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const c01 = (v: number) => Math.max(0, Math.min(1, v));
const ui = (lang: Lang) => (lang === "fa" ? FONT.fa : FONT.en);
const nIn = (lang: Lang, n: number) => (lang === "fa" ? faGrouped(n) : enNum(n));
const dIn = (lang: Lang, n: number) => (lang === "fa" ? faNum(n) : String(n));
const ramp = (f: number, at: number, len = 30, ease = easeOut) => interpolate(f, [at, at + Math.max(1, mk(len))], [0, 1], { ...clamp, easing: ease });
const countUp = (f: number, at: number, to: number, len = 42) => Math.round(to * ramp(f, at, len));
const arr = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number) : []);
const bools = (v: unknown): boolean[] => (Array.isArray(v) ? v.map(Boolean) : []);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const lineAt = (s: InsightScene, id: string, fallback: number) => {
  const l = s.lines.find((x) => x.id === id);
  return l ? l.from - s.from : fallback;
};
/** Between two parts of a label: a middle dot in English; in Persian a comma (a dot beside Persian digits reads as zero). */
const sep = (lang: Lang) => (lang === "fa" ? "، " : " · ");
const refIn = (lang: Lang, r: string) => (lang === "fa" ? r.split(":").map((x) => faNum(Number(x))).join(":") : r);

/* ---------- kinetic type ---------- */

const GOLD = /[0-9۰-۹٠-٩]|[«»"]/;

/** A sentence set word by word: each word rises out of a soft blur at its own frame; numbers in brass. */
const Kinetic: React.FC<{ text: string; f: number; at: number[]; color?: string }> = ({ text, f, at, color = C.ink }) => {
  const list = pieces(text);
  return (
    <>
      {list.map((part, i) => {
        if (part.word === null) return <React.Fragment key={i}>{part.text}</React.Fragment>;
        const o = c01((f - (at[part.word] ?? 0)) / mk(7));
        const gold = GOLD.test(part.text);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: o,
              transform: `translateY(${((1 - o) * 20).toFixed(1)}px) scale(${(0.94 + 0.06 * o).toFixed(3)})`,
              filter: o < 1 ? `blur(${((1 - o) * 5).toFixed(1)}px)` : undefined,
              color: gold ? C.brass : color,
              textShadow: gold && flags.glow ? `0 0 ${(18 * o).toFixed(1)}px rgba(224,172,79,0.45)` : undefined,
            }}
          >
            {part.text}
          </span>
        );
      })}
    </>
  );
};

/** When each word of a narrated line appears (scene frames): the voice's own word times when they line up, else spread over the line. */
function wordFrames(line: SceneLine, rel: number, fast = false): number[] {
  const count = pieces(line.show).filter((x) => x.word !== null).length;
  if (fast) return Array.from({ length: count }, (_, k) => -8 + k * 2.4);
  if (line.words && line.words.length === count) return line.words.map(([s]) => rel + (s / 1000) * 30 - 3);
  return Array.from({ length: count }, (_, k) => rel - 2 + (k / Math.max(1, count)) * line.len * 0.82);
}

/** A narrated line in the caption zone (or anywhere): set as the voice says it, gone after it. */
const Said: React.FC<{ line: SceneLine; s: InsightScene; lang: Lang; top?: number; height?: number; max?: number; keep?: boolean; fast?: boolean; color?: string }> = ({ line, s, lang, top = BAND.capTop, height = BAND.capH, max, keep, fast, color }) => {
  const f = useCurrentFrame();
  const rel = line.from - s.from;
  const fa = lang === "fa";
  const end = keep ? s.dur : rel + line.len + ST.GAP;
  const o = Math.min(fast ? 1 : c01((f - rel + 6) / 6), c01((end - f) / 8));
  return (
    <div style={{ position: "absolute", top, left: 0, width: W, height, display: "flex", alignItems: "center", justifyContent: "center", opacity: o }}>
      <Fit
        width={860}
        maxHeight={height}
        max={max ?? (fa ? 44 : 50)}
        min={26}
        measureKey={line.show}
        lang={lang}
        dir={fa ? "rtl" : "ltr"}
        style={{ fontFamily: ui(lang), fontWeight: fa ? 500 : 500, lineHeight: fa ? 1.75 : 1.3, textAlign: "center", textWrap: "balance" }}
      >
        <Kinetic text={line.show} f={f} at={wordFrames(line, rel, fast)} color={color} />
      </Fit>
    </div>
  );
};

/** The captions of a scene (all its lines but those a view sets itself). */
const Captions: React.FC<{ s: InsightScene; lang: Lang; skip?: string[] }> = ({ s, lang, skip = [] }) => (
  <>
    {s.lines
      .filter((l) => !skip.includes(l.id))
      .map((l) => (
        <Said key={l.id} line={l} s={s} lang={lang} />
      ))}
  </>
);

/** A big brass number that counts up and settles with a breath of light. */
const BigNumber: React.FC<{ lang: Lang; value: number; f: number; at: number; size: number; color?: string; len?: number; suffix?: string }> = ({ lang, value, f, at, size, color = C.brass, len = 40, suffix }) => {
  const k = ramp(f, at, len);
  const settle = interpolate(f, [at + mk(len) - 4, at + mk(len) + 10, at + mk(len) + 30], [0, 1, 0], clamp);
  return (
    <div
      dir="ltr"
      style={{
        fontFamily: ui(lang),
        fontWeight: 500,
        fontSize: size,
        lineHeight: 1,
        color,
        fontVariantNumeric: "lining-nums tabular-nums",
        opacity: c01(k * 3),
        transform: `scale(${(0.9 + 0.1 * k + 0.03 * settle).toFixed(4)})`,
        textShadow: flags.glow ? `0 0 ${(30 + 40 * settle).toFixed(0)}px rgba(224,172,79,${(0.3 + 0.35 * settle).toFixed(2)})` : undefined,
      }}
    >
      {nIn(lang, Math.round(value * k))}
      {suffix ? <span style={{ fontSize: size * 0.42, marginInlineStart: size * 0.06 }}>{suffix}</span> : null}
    </div>
  );
};

const Label: React.FC<{ lang: Lang; children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({ lang, children, size = 40, color = C.ink, style }) => (
  <div dir={lang === "fa" ? "rtl" : "ltr"} style={{ fontFamily: ui(lang), fontSize: size, color, textAlign: "center", lineHeight: lang === "fa" ? 1.7 : 1.25, ...style }}>
    {children}
  </div>
);

/* ---------- the 114 surahs as one strip ---------- */

const STRIP = { left: 92, width: 896, height: 170 };

/**
 * The 114 surahs as thin bars, lit by a light that runs along the strip (right to left in
 * Persian, as the mushaf is read); `focus` bars carry a ring and their name.
 */
const Strip114: React.FC<{ p: InsightProps; f: number; at: number; top: number; lit: (n: number) => number; focus?: number[]; twice?: number[]; dimLit?: number; pulseDark?: number }> = ({ p, f, at, top, lit, focus = [], twice = [], dimLit = 0, pulseDark = 0 }) => {
  const fa = p.lang === "fa";
  const n = p.surahs.length || 114;
  const step = STRIP.width / n;
  const sweep = interpolate(f, [at, at + mk(54)], [-4, n + 4], clamp);
  const x = (num: number) => (fa ? STRIP.left + (n - num) * step : STRIP.left + (num - 1) * step);
  const head = fa ? STRIP.left + (n - sweep) * step : STRIP.left + sweep * step;
  return (
    <div style={{ position: "absolute", top, left: 0, width: W, height: STRIP.height + 120 }}>
      <svg width={W} height={STRIP.height + 120} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {Array.from({ length: n }, (_, i) => {
          const num = i + 1;
          const on = lit(num);
          const passed = c01((sweep - num) / 3);
          const v = on * passed;
          const dark = on === 0 ? pulseDark * (0.5 + 0.5 * Math.sin(f / 5 + num)) : 0;
          const h = STRIP.height * (0.62 + 0.38 * v) + (focus.includes(num) ? 18 : 0);
          return (
            <rect
              key={num}
              x={x(num) + step * 0.16}
              y={STRIP.height - h}
              width={step * 0.68}
              height={h}
              rx={1.5}
              fill={v > 0 ? C.brass : dark > 0 ? C.turquoise : `${C.ink}`}
              opacity={v > 0 ? (0.35 + 0.65 * v) * (1 - dimLit * 0.6) : dark > 0 ? 0.25 + 0.6 * dark : 0.13}
            />
          );
        })}
        {twice.map((num) => (
          <circle key={`t${num}`} cx={x(num) + step / 2} cy={-14} r={5} fill={C.star} opacity={c01((sweep - num) / 3)} />
        ))}
        {flags.glow && sweep > 0 && sweep < n ? <circle cx={head} cy={STRIP.height / 2} r={70} fill="url(#sweep)" /> : null}
        <defs>
          <radialGradient id="sweep">
            <stop offset="0%" stopColor="#ffe6b0" stopOpacity={0.55} />
            <stop offset="100%" stopColor="#ffe6b0" stopOpacity={0} />
          </radialGradient>
        </defs>
        {focus.map((num) => {
          const o = c01((sweep - num) / 3);
          return <rect key={`f${num}`} x={x(num) - 4} y={-26} width={step + 8} height={STRIP.height + 34} rx={6} fill="none" stroke={C.star} strokeWidth={2.5} opacity={o} />;
        })}
        <line x1={STRIP.left} x2={STRIP.left + STRIP.width} y1={STRIP.height + 6} y2={STRIP.height + 6} stroke={C.gold} strokeWidth={1.2} opacity={0.6} />
      </svg>
      <div dir="ltr" style={{ position: "absolute", top: STRIP.height + 14, left: STRIP.left, width: STRIP.width, display: "flex", justifyContent: "space-between", fontFamily: ui(p.lang), fontSize: 26, color: C.quiet }}>
        <span>{dIn(p.lang, fa ? n : 1)}</span>
        <span>{dIn(p.lang, fa ? 1 : n)}</span>
      </div>
      {focus.slice(0, 1).map((num) => {
        const s = p.surahs[num - 1];
        const o = c01((sweep - num) / 3);
        const cx = x(num) + step / 2;
        const left = Math.max(110, Math.min(W - 110, cx));
        return s ? (
          <div key={`l${num}`} style={{ position: "absolute", top: STRIP.height + 50, left: left - 200, width: 400, display: "flex", flexDirection: "column", alignItems: "center", opacity: o }}>
            <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 44, lineHeight: 1.4, color: C.star }}>
              {s.nameArabic}
            </div>
          </div>
        ) : null;
      })}
    </div>
  );
};

/* ---------- the 604 pages as a map ---------- */

const MAP = { cell: 21, gap: 4.6, cols: 30 };

/**
 * The mushaf as a map: one column per part (juz), from the right, its pages from the top.
 * Lit pages catch the light as it falls across the map.
 */
const PageMap: React.FC<{ p: InsightProps; f: number; at: number; top: number; lit: Set<number>; scale?: number; dim?: number; markers?: Array<{ page: number; o: number; label: string }>; runner?: number | null }> = ({ p, f, at, top, lit, scale = 1, dim = 0, markers = [], runner = null }) => {
  const juz = arr(p.data.pageJuz);
  const place = strs(p.data.pagePlace);
  const pages = juz.length;
  const first = new Map<number, number>();
  juz.forEach((j, i) => {
    if (!first.has(j)) first.set(j, i);
  });
  const step = (MAP.cell + MAP.gap) * scale;
  // centred: the first part at the right, as the mushaf opens
  const right = (W + MAP.cols * step - MAP.gap * scale) / 2;
  const pos = (i: number) => {
    const j = juz[i] ?? 1;
    const row = i - (first.get(j) ?? 0);
    return { x: right - (j - 1) * step - MAP.cell * scale, y: row * step };
  };
  const rows = Math.max(...[...first.keys()].map((j) => juz.filter((x) => x === j).length), 1);
  const width = W;
  return (
    <svg width={width} height={rows * step + 40} style={{ position: "absolute", top, left: 0, overflow: "visible" }}>
      {juz.map((j, i) => {
        const { x, y } = pos(i);
        const page = i + 1;
        const fall = at + (j - 1) * 2.2 + (y / step) * 0.6;
        const k = c01((f - fall) / mk(10));
        const on = lit.has(page);
        const medinan = place[i] === "medinan";
        // unlit pages keep a faint tint of their surah's place, so the lit ones show where they fall
        const fill = medinan ? C.turquoise : C.brass;
        const o = on ? (0.3 + 0.7 * k) * (1 - dim) : (medinan ? 0.13 : 0.08) * c01((f - at + 10) / 10);
        return <rect key={page} x={x} y={y} width={MAP.cell * scale} height={MAP.cell * scale} rx={3 * scale} fill={fill} opacity={o} />;
      })}
      {runner !== null && runner >= 1 && runner <= pages
        ? (() => {
            const { x, y } = pos(Math.round(runner) - 1);
            return flags.glow ? <circle cx={x + (MAP.cell * scale) / 2} cy={y + (MAP.cell * scale) / 2} r={34 * scale} fill="url(#runner)" /> : <rect x={x - 3} y={y - 3} width={MAP.cell * scale + 6} height={MAP.cell * scale + 6} fill="none" stroke={C.star} strokeWidth={2} />;
          })()
        : null}
      <defs>
        <radialGradient id="runner">
          <stop offset="0%" stopColor="#fff1c9" stopOpacity={0.95} />
          <stop offset="40%" stopColor="#f0c46a" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#f0c46a" stopOpacity={0} />
        </radialGradient>
      </defs>
      {markers.map((m) => {
        const { x, y } = pos(m.page - 1);
        return (
          <g key={m.label} opacity={m.o}>
            <rect x={x - 5} y={y - 5} width={MAP.cell * scale + 10} height={MAP.cell * scale + 10} rx={5} fill="none" stroke={C.star} strokeWidth={3} />
            <circle cx={x + (MAP.cell * scale) / 2} cy={y + (MAP.cell * scale) / 2} r={6} fill={C.star} />
          </g>
        );
      })}
    </svg>
  );
};

/* ---------- 114 tiles that fly to the revelation order ---------- */

const TILE = { cols: 12, cell: 58, gap: 7 };

const Tiles: React.FC<{ p: InsightProps; f: number; at: number; top: number; focus: number[] }> = ({ p, f, at, top, focus }) => {
  const fa = p.lang === "fa";
  const order = arr(p.data.order);
  const places = strs(p.data.places);
  const step = TILE.cell + TILE.gap;
  const gridW = TILE.cols * step - TILE.gap;
  const left = (W - gridW) / 2;
  const at2 = (k: number) => {
    const col = k % TILE.cols;
    const row = Math.floor(k / TILE.cols);
    return { x: left + (fa ? TILE.cols - 1 - col : col) * step, y: row * step };
  };
  return (
    <div style={{ position: "absolute", top, left: 0, width: W, height: 10 * step }}>
      {order.map((o, i) => {
        const num = i + 1;
        const a = at2(i);
        const b = at2(o - 1);
        const still = a.x === b.x && a.y === b.y;
        const t = interpolate(f, [at + o * 0.55, at + o * 0.55 + mk(34)], [0, 1], { ...clamp, easing: easeInOut });
        const lift = Math.sin(Math.PI * t);
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t - lift * 70;
        const isFocus = focus.includes(num);
        const glow = isFocus ? c01((f - at - 20) / 20) : 0;
        // once settled, a light reads the order tile by tile, again and again
        const settled = at + 114 * 0.55 + mk(34);
        const wave = f > settled ? Math.max(0, 1 - Math.abs(((f - settled) * 1.4) % 150 - o) / 6) : 0;
        const color = places[i] === "medinan" ? C.turquoise : C.brass;
        return (
          <div
            key={num}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: TILE.cell,
              height: TILE.cell,
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              border: `1.5px solid ${isFocus ? C.star : color}`,
              background: isFocus ? `rgba(227,192,120,${(0.25 + 0.65 * glow).toFixed(2)})` : wave > 0 ? `rgba(227,192,120,${(0.18 + 0.4 * wave).toFixed(2)})` : `${color}2e`,
              transform: `scale(${(1 + 0.22 * lift + 0.12 * glow).toFixed(3)})`,
              zIndex: isFocus ? 3 : lift > 0.05 ? 2 : 1,
              boxShadow: (isFocus || lift > 0.05) && flags.glow ? `0 ${(10 * lift).toFixed(0)}px ${(18 + 20 * glow).toFixed(0)}px rgba(${isFocus ? "227,192,120" : "0,0,0"},${(isFocus ? 0.6 * glow : 0.4 * lift).toFixed(2)})` : "none",
              fontFamily: ui(p.lang),
              fontSize: 27,
              fontVariantNumeric: "lining-nums tabular-nums",
              color: isFocus && glow > 0.5 ? C.night : C.ink,
              opacity: still && !isFocus ? 0.85 : 1,
            }}
          >
            {dIn(p.lang, num)}
          </div>
        );
      })}
    </div>
  );
};

/* ---------- views ---------- */

type ViewProps = { p: InsightProps; s: InsightScene };

const surahOf = (p: InsightProps, n: number | null | undefined): IndexSurah | null => (n ? (p.surahs[n - 1] ?? null) : null);

/** The focal picture under the hook, one per format. */
const Hero: React.FC<{ p: InsightProps; f: number; cover?: boolean }> = ({ p, f, cover }) => {
  const fa = p.lang === "fa";
  const w = I_WORDS[p.lang];
  const n = p.numbers;
  const at = cover ? -999 : -10;
  const box: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 16 };
  switch (p.format) {
    case "only": {
      if (p.episode === "longest-verse") {
        const [s, a] = String(n.verse).split(":").map(Number);
        return (
          <div style={box}>
            <BigNumber lang={p.lang} value={Number(n.words)} f={f} at={at + 4} size={250} />
            <Label lang={p.lang} size={54}>{w.words}</Label>
            <Label lang={p.lang} size={40} color={C.gold}>{w.verseOf(s ?? 0, a ?? 0)}</Label>
          </div>
        );
      }
      const s = surahOf(p, Number(n.surah));
      const open = cover ? 1 : ramp(f, -6, 22, easeInOut);
      return s ? (
        <div style={box}>
          <Label lang={p.lang} size={44} color={C.gold} style={{ letterSpacing: fa ? 0 : "0.18em", textTransform: fa ? "none" : "uppercase" }}>
            {w.surah(s.number)}
          </Label>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Seal size={90} turn={f * 0.4} />
            <Cartouche height={200} open={open}>
              <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 96, lineHeight: 1.5, color: C.star, paddingBottom: 34, textShadow: flags.glow ? "0 0 24px rgba(224,172,79,0.45)" : undefined }}>
                {s.nameArabic}
              </div>
            </Cartouche>
            <Seal size={90} turn={-f * 0.4} />
          </div>
          <Label lang={p.lang} size={44} color={C.translation}>{`${nIn(p.lang, s.ayahCount)} ${w.verses}`}</Label>
        </div>
      ) : null;
    }
    case "myth-fact":
      return (
        <div style={box}>
          <Label lang={p.lang} size={40} color={C.quiet} style={{ letterSpacing: fa ? 0 : "0.16em", textTransform: fa ? "none" : "uppercase" }}>
            {w.claim}
          </Label>
          <div dir="ltr" style={{ fontFamily: ui(p.lang), fontSize: 260, lineHeight: 1, color: C.ink, fontVariantNumeric: "lining-nums", opacity: cover ? 1 : ramp(f, -8, 14) }}>
            {nIn(p.lang, Number(n.claim))}
            <span style={{ color: C.brass }}>{fa ? "؟" : "?"}</span>
          </div>
        </div>
      );
    case "meccan-medinan":
      return (
        <div style={{ display: "flex", gap: 110, alignItems: "flex-end" }} dir={fa ? "rtl" : "ltr"}>
          {[
            [Number(n.meccan), w.meccan, C.brass],
            [Number(n.medinan), w.medinan, C.turquoise],
          ].map(([v, label, color]) => (
            <div key={String(label)} style={box}>
              <BigNumber lang={p.lang} value={Number(v)} f={f} at={at + 2} size={230} color={String(color)} />
              <Label lang={p.lang} size={50}>{String(label)}</Label>
            </div>
          ))}
        </div>
      );
    case "counted":
      return (
        <div style={box}>
          <BigNumber lang={p.lang} value={Number(n.total)} f={f} at={at + 4} size={300} />
          <Label lang={p.lang} size={54}>{w.times}</Label>
        </div>
      );
    case "mushaf-map":
      return (
        <div style={box}>
          {p.spans.form ? (
            <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 76, lineHeight: 1.6, color: C.star, opacity: cover ? 1 : ramp(f, -6, 16), textShadow: flags.glow ? "0 0 22px rgba(224,172,79,0.4)" : undefined }}>
              {p.spans.form}
            </div>
          ) : null}
          <BigNumber lang={p.lang} value={Number(n.occurrences)} f={f} at={at + 6} size={220} suffix="×" />
        </div>
      );
    case "middle":
      return (
        <div style={{ ...box, width: W, height: 380, position: "relative" }}>
          <PageMap p={p} f={cover ? 999 : f + 30} at={0} top={0} lit={new Set()} scale={0.56} runner={cover ? null : interpolate(f, [-10, 75], [1, Number(p.pages) / 2], clamp)} />
        </div>
      );
    case "revelation-order": {
      if (p.episode === "fatiha-fifth") {
        const s = surahOf(p, Number(n.surah));
        return s ? (
          <div style={box}>
            <Cartouche height={170}>
              <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 80, lineHeight: 1.5, color: C.star, paddingBottom: 28 }}>
                {s.nameArabic}
              </div>
            </Cartouche>
            <BigNumber lang={p.lang} value={Number(n.order)} f={f} at={at + 6} size={220} />
          </div>
        ) : null;
      }
      return (
        <div style={box}>
          <BigNumber lang={p.lang} value={Number(n.count)} f={f} at={at + 4} size={300} />
          <Label lang={p.lang} size={50}>{w.samePlace}</Label>
        </div>
      );
    }
    case "one-line":
      return (
        <div style={box}>
          <BigNumber lang={p.lang} value={Number(n.times)} f={f} at={at + 4} size={300} suffix="×" />
          <Label lang={p.lang} size={46} color={C.translation}>{`${w.surah(Number(n.surah))}${sep(p.lang)}${nIn(p.lang, Number(n.verses))} ${w.verses}`}</Label>
        </div>
      );
    case "opening-letters": {
      const groups = p.spans.groups;
      const g = Number((p.data.groupOf as Record<string, number> | undefined)?.[String(n.surah)] ?? -1);
      return (
        <div style={box}>
          <BigNumber lang={p.lang} value={Number(n.surahs)} f={f} at={at + 4} size={250} />
          <Label lang={p.lang} size={46}>{FORMAT_NAME["opening-letters"][p.lang]}</Label>
          {groups[g] ? (
            <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 92, lineHeight: 1.5, color: C.star, opacity: cover ? 1 : ramp(f, 10, 20), textShadow: flags.glow ? "0 0 26px rgba(224,172,79,0.45)" : undefined }}>
              {groups[g]}
            </div>
          ) : null}
        </div>
      );
    }
    case "every-letter":
      return <Alphabet p={p} f={f} lit={() => (cover ? 1 : 0.18 + 0.1 * Math.sin(f / 9))} size={98} />;
    case "names":
    case "closing-names":
      return (
        <div style={box}>
          {p.spans.form ? (
            <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
              <Seal size={300} turn={f * 0.2} style={{ position: "absolute", opacity: 0.35 }} />
              <div lang="ar" dir="rtl" style={{ position: "relative", fontFamily: FONT.quran, fontSize: p.format === "names" ? 120 : 84, lineHeight: 1.6, color: C.star, opacity: cover ? 1 : ramp(f, -6, 20), textShadow: flags.glow ? "0 0 28px rgba(224,172,79,0.5)" : undefined }}>
                {p.spans.form}
              </div>
            </div>
          ) : null}
          <BigNumber lang={p.lang} value={Number(p.format === "names" ? n.occurrences : n.verses)} f={f} at={at + 8} size={200} suffix={p.format === "names" ? "×" : undefined} />
        </div>
      );
    case "quiz":
      return <Options p={p} f={f} at={cover ? -999 : 6} reveal={0} />;
    default:
      return null;
  }
};

/** The hook: the first sentence, big, already standing in the first frame, over the format's picture. */
const HookView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const first = s.lines[0];
  const out = c01((s.dur - f) / ST.OUT);
  const fa = p.lang === "fa";
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Lamp warm={0.5 + 0.5 * ramp(f, 0, 30)} cy={0.42} />
      {first ? <Said line={first} s={s} lang={p.lang} top={BAND.visTop} height={300} max={fa ? 76 : 84} keep fast /> : null}
      <div style={{ position: "absolute", top: 720, left: 0, width: W, height: BAND.visBottom - 720, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Hero p={p} f={f} />
      </div>
      {s.lines.slice(1).map((l) => (
        <Said key={l.id} line={l} s={s} lang={p.lang} />
      ))}
    </AbsoluteFill>
  );
};

/** The Only… / Counted / Opening Letters: the 114 strip with its number. */
const StripView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const w = I_WORDS[p.lang];
  const n = p.numbers;
  const d = p.data;
  const out = c01((s.dur - f) / ST.OUT);
  const second = lineAt(s, s.lines[1]?.id ?? "", s.dur * 0.55);
  let lit: (num: number) => number = () => 0;
  let focus: number[] = [];
  let twice: number[] = [];
  let head: React.ReactNode = null;
  let pulseDark = 0;
  let below: React.ReactNode = null;
  if (p.format === "only" && p.episode === "longest-verse") {
    return <LongestView p={p} s={s} />;
  }
  if (p.format === "only") {
    const flagsLit = bools(d.lit);
    const share = arr(d.share);
    lit = (num) => (share.length ? Math.max(0.12, share[num - 1] ?? 0) * (flagsLit[num - 1] ? 1 : 0.55) : flagsLit[num - 1] ? 1 : 0);
    focus = [Number(d.focus)];
    if (p.episode === "allah-every-verse" && n.closest) focus = [Number(d.focus)];
    const showWithout = ramp(f, second - 4, 16);
    pulseDark = p.episode === "no-allah" ? showWithout : 0;
    head =
      p.episode === "no-allah" ? (
        <div style={{ display: "flex", gap: 90, alignItems: "flex-end" }} dir={p.lang === "fa" ? "rtl" : "ltr"}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <BigNumber lang={p.lang} value={Number(n.occurrences)} f={f} at={6} size={170} />
            <Label lang={p.lang} size={38}>{w.times}</Label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: showWithout }}>
            <BigNumber lang={p.lang} value={Number(n.without)} f={f} at={second} size={170} color={C.turquoise} />
            <Label lang={p.lang} size={38}>{`${w.surahs} ${w.without}`}</Label>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 90, alignItems: "flex-end" }} dir={p.lang === "fa" ? "rtl" : "ltr"}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <BigNumber lang={p.lang} value={Number(n.with)} f={f} at={6} size={170} />
            <Label lang={p.lang} size={38}>{`${w.surah(Number(n.surah))}${sep(p.lang)}${nIn(p.lang, Number(n.verses))} ${w.verses}`}</Label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: ramp(f, second - 4, 16) }}>
            <BigNumber lang={p.lang} value={Number(n.closestWith)} f={f} at={second} size={170} color={C.turquoise} />
            <Label lang={p.lang} size={38}>{`${w.surah(Number(n.closest))}${sep(p.lang)}${nIn(p.lang, Number(n.closestVerses))} ${w.verses}`}</Label>
          </div>
        </div>
      );
  } else if (p.format === "counted") {
    const flagsLit = bools(d.lit);
    lit = (num) => (flagsLit[num - 1] ? 1 : 0);
    twice = arr(d.twice);
    focus = arr(d.without);
    pulseDark = ramp(f, second - 4, 16);
    head = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <BigNumber lang={p.lang} value={Number(n.total)} f={f} at={-30} size={200} />
        <div dir="ltr" style={{ fontFamily: ui(p.lang), fontSize: 50, color: C.translation, fontVariantNumeric: "lining-nums", opacity: ramp(f, 30, 16) }}>
          {`${nIn(p.lang, Number(n.openings))} + ${nIn(p.lang, strs(n.inside).length)}`}
        </div>
      </div>
    );
  } else if (p.format === "names" || p.format === "closing-names") {
    const flagsLit = bools(d.lit);
    lit = (num) => (flagsLit[num - 1] ? 1 : 0);
    head = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {p.spans.form ? (
          <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 70, lineHeight: 1.6, color: C.star }}>
            {p.spans.form}
          </div>
        ) : null}
        <BigNumber lang={p.lang} value={Number(p.format === "names" ? n.occurrences : n.verses)} f={f} at={-30} size={150} />
        <Label lang={p.lang} size={36}>{p.format === "names" ? `${nIn(p.lang, Number(n.verses))} ${w.verses}${sep(p.lang)}${nIn(p.lang, Number(n.surahs))} ${w.surahs}` : `${w.verses}${sep(p.lang)}${nIn(p.lang, Number(n.surahs))} ${w.surahs}`}</Label>
      </div>
    );
  } else if (p.format === "opening-letters") {
    const list = arr(d.list);
    lit = (num) => (list.includes(num) ? 1 : 0);
    focus = [Number(n.surah)];
    const groupOf = (d.groupOf ?? {}) as Record<string, number>;
    const fg = groupOf[String(n.surah)];
    head = (
      <div style={{ display: "flex", gap: 80, alignItems: "flex-end" }} dir={p.lang === "fa" ? "rtl" : "ltr"}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <BigNumber lang={p.lang} value={Number(n.letters)} f={f} at={6} size={160} />
          <Label lang={p.lang} size={36}>{w.letters}</Label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <BigNumber lang={p.lang} value={Number(n.combinations)} f={f} at={16} size={160} color={C.turquoise} />
          <Label lang={p.lang} size={36}>{p.lang === "fa" ? "ترکیب" : "combinations"}</Label>
        </div>
      </div>
    );
    below = (
      <div dir="rtl" style={{ position: "absolute", top: 965, left: 90, width: W - 180, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 22px" }}>
        {p.spans.groups.map((g, i) => {
          const o = ramp(f, 40 + i * 3, 12);
          const on = i === fg;
          return (
            <span key={i} lang="ar" style={{ fontFamily: FONT.quran, fontSize: on ? 56 : 46, lineHeight: 1.5, color: on ? C.star : C.ink, opacity: o * (on ? 1 : 0.6), textShadow: on && flags.glow ? "0 0 20px rgba(224,172,79,0.6)" : undefined }}>
              {g}
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: BAND.visTop + 10, left: 0, width: W, display: "flex", justifyContent: "center" }}>{head}</div>
      <Strip114 p={p} f={f} at={12} top={p.format === "opening-letters" ? 620 : 740} lit={lit} focus={focus} twice={twice} pulseDark={pulseDark} />
      {below}
      <Captions s={s} lang={p.lang} />
    </AbsoluteFill>
  );
};

/** The Only… · the longest verse: two bars, its words against the next one's. */
const LongestView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const w = I_WORDS[p.lang];
  const n = p.numbers;
  const out = c01((s.dur - f) / ST.OUT);
  const second = lineAt(s, "without", s.dur * 0.5);
  const bars: Array<[string, number, string, number]> = [
    [String(n.verse), Number(n.words), C.brass, 6],
    [String(n.next), Number(n.nextWords), C.turquoise, second],
  ];
  const max = Math.max(...bars.map((b) => b[1]));
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: BAND.visTop + 60, left: 140, width: W - 280, display: "flex", flexDirection: "column", gap: 70 }}>
        {bars.map(([ref, v, color, at]) => {
          const g = ramp(f, at, 34, easeInOut);
          return (
            <div key={ref} style={{ display: "flex", flexDirection: "column", gap: 14, opacity: c01(g * 4) }}>
              <div dir={p.lang === "fa" ? "rtl" : "ltr"} style={{ display: "flex", justifyContent: "space-between", fontFamily: ui(p.lang), fontSize: 46, color: C.ink }}>
                <span dir="ltr">{refIn(p.lang, ref)}</span>
                <span style={{ color }}>{`${nIn(p.lang, Math.round(v * g))} ${w.words}`}</span>
              </div>
              <div style={{ height: 40, borderRadius: 6, background: `${C.ink}14`, overflow: "hidden", direction: p.lang === "fa" ? "rtl" : "ltr" }}>
                <div style={{ width: `${(100 * v * g) / max}%`, height: "100%", borderRadius: 6, background: color, boxShadow: flags.glow ? `0 0 24px ${color}88` : undefined }} />
              </div>
            </div>
          );
        })}
      </div>
      <Captions s={s} lang={p.lang} />
    </AbsoluteFill>
  );
};

/** The Counts Test · our count against the claim. */
const MythCountView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const w = I_WORDS[p.lang];
  const n = p.numbers;
  const fa = p.lang === "fa";
  const out = c01((s.dur - f) / ST.OUT);
  const strike = ramp(f, 10, 18, easeInOut);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: BAND.visTop + 10, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <Label lang={p.lang} size={34} color={C.quiet}>{w.claim}</Label>
        <div dir="ltr" style={{ position: "relative", fontFamily: ui(p.lang), fontSize: 120, lineHeight: 1, color: C.quiet, fontVariantNumeric: "lining-nums" }}>
          {nIn(p.lang, Number(n.claim))}
          <div style={{ position: "absolute", left: -10, top: "52%", height: 6, width: `calc(${(strike * 100).toFixed(1)}% + 20px)`, background: C.brass, borderRadius: 3, transform: "rotate(-4deg)" }} />
        </div>
        <div style={{ height: 50 }} />
        <Label lang={p.lang} size={38} color={C.gold} style={{ letterSpacing: fa ? 0 : "0.16em", textTransform: fa ? "none" : "uppercase" }}>
          {w.count}
        </Label>
        <BigNumber lang={p.lang} value={Number(n.ayahs)} f={f} at={22} size={260} len={48} />
        <Label lang={p.lang} size={44}>{`${w.verses}${sep(p.lang)}${nIn(p.lang, Number(n.surahs))} ${w.surahs}`}</Label>
        <Label lang={p.lang} size={34} color={C.quiet} style={{ opacity: ramp(f, 60, 16) }}>
          {w.kufan}
        </Label>
      </div>
      <Captions s={s} lang={p.lang} />
    </AbsoluteFill>
  );
};

/** The Counts Test · the verdict. */
const VerdictView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const w = I_WORDS[p.lang];
  const n = p.numbers;
  const out = c01((s.dur - f) / ST.OUT);
  const at = lineAt(s, "verdict", s.dur * 0.5);
  const v = ramp(f, at - 4, 14);
  const pulse = interpolate(f, [at + 6, at + 16, at + 34], [0, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: BAND.visTop + 230, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 80 }} dir={p.lang === "fa" ? "rtl" : "ltr"}>
        <div style={{ display: "flex", gap: 80, alignItems: "center" }}>
          {[
            [Number(n.claim), w.claim, C.quiet],
            [Number(n.ayahs), w.count, C.brass],
          ].map(([val, label, color]) => (
            <div key={String(label)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div dir="ltr" style={{ fontFamily: ui(p.lang), fontSize: 150, lineHeight: 1, color: String(color), fontVariantNumeric: "lining-nums", textDecoration: color === C.quiet ? "line-through" : undefined, textDecorationColor: C.brass }}>
                {nIn(p.lang, Number(val))}
              </div>
              <Label lang={p.lang} size={34} color={C.quiet}>{String(label)}</Label>
            </div>
          ))}
        </div>
        <div style={{ opacity: v, transform: `scale(${(0.9 + 0.1 * v + 0.05 * pulse).toFixed(3)})`, padding: "18px 46px", borderRadius: 18, border: `2.5px solid ${C.brass}`, background: `rgba(224,172,79,${(0.1 + 0.25 * pulse).toFixed(2)})`, boxShadow: flags.glow ? `0 0 ${(20 + 40 * pulse).toFixed(0)}px rgba(224,172,79,0.45)` : undefined }}>
          <Label lang={p.lang} size={70} color={C.star}>{w.verdict(Boolean(n.holds))}</Label>
        </div>
      </div>
      <Captions s={s} lang={p.lang} />
    </AbsoluteFill>
  );
};

/** Meccan · Medinan · the 286 memory trick: the digits split into the two numbers. */
const TrickView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const w = I_WORDS[p.lang];
  const n = p.numbers;
  const out = c01((s.dur - f) / ST.OUT);
  const digits = String(n.longestAyahs).split("");
  const rel = lineAt(s, "trick", 10);
  const a = ramp(f, rel + 30, 16);
  const b = ramp(f, rel + 62, 16);
  const s2 = surahOf(p, Number(n.longest));
  const D = (k: number) => (p.lang === "fa" ? faNum(Number(digits[k])) : digits[k]);
  const size = 300;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: BAND.visTop + 40, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        {s2 ? (
          <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 70, lineHeight: 1.5, color: C.star, opacity: ramp(f, 0, 14), marginBottom: 46 }}>
            {s2.nameArabic}
          </div>
        ) : null}
        <div dir="ltr" style={{ position: "relative", display: "flex", fontFamily: ui(p.lang), fontSize: size, lineHeight: 1.15, fontVariantNumeric: "lining-nums tabular-nums", opacity: ramp(f, 0, 12) }}>
          {digits.map((_, k) => {
            const inMed = k < 2 ? b : 0;
            const inMec = k > 0 ? a : 0;
            const color = inMed > 0.5 && k === 0 ? C.turquoise : inMec > 0.5 ? C.brass : inMed > 0.5 ? C.turquoise : C.ink;
            return (
              <span key={k} style={{ color, padding: "0 6px", textShadow: flags.glow && (inMec > 0.5 || inMed > 0.5) ? `0 0 30px ${color}88` : undefined }}>
                {D(k)}
              </span>
            );
          })}
          <div style={{ position: "absolute", top: -26, right: 0, width: "64%", height: 24, borderTop: `4px solid ${C.brass}`, borderLeft: `4px solid ${C.brass}`, borderRight: `4px solid ${C.brass}`, borderRadius: "10px 10px 0 0", opacity: a }} />
          <div style={{ position: "absolute", bottom: -26, left: 0, width: "64%", height: 24, borderBottom: `4px solid ${C.turquoise}`, borderLeft: `4px solid ${C.turquoise}`, borderRight: `4px solid ${C.turquoise}`, borderRadius: "0 0 10px 10px", opacity: b }} />
        </div>
        <div style={{ display: "flex", gap: 90, marginTop: 70 }} dir={p.lang === "fa" ? "rtl" : "ltr"}>
          <div style={{ opacity: a, transform: `translateY(${((1 - a) * 20).toFixed(0)}px)` }}>
            <Label lang={p.lang} size={56} color={C.brass}>{`${nIn(p.lang, Number(n.meccan))} ${w.meccan}`}</Label>
          </div>
          <div style={{ opacity: b, transform: `translateY(${((1 - b) * 20).toFixed(0)}px)` }}>
            <Label lang={p.lang} size={56} color={C.turquoise}>{`${nIn(p.lang, Number(n.medinan))} ${w.medinan}`}</Label>
          </div>
        </div>
      </div>
      <Captions s={s} lang={p.lang} />
    </AbsoluteFill>
  );
};

/** Meccan · Medinan · the surahs fall like grains into two columns. */
const ColumnsView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const w = I_WORDS[p.lang];
  const n = p.numbers;
  const places = strs(p.data.places);
  const out = c01((s.dur - f) / ST.OUT);
  const G = { size: 24, gap: 6, cols: 8 };
  const base = 1110;
  const col = (place: string, x0: number, color: string) => {
    const idx = places.map((pl, i) => (pl === place ? i + 1 : 0)).filter(Boolean);
    return idx.map((num, k) => {
      const c = k % G.cols;
      const r = Math.floor(k / G.cols);
      const t = ramp(f, 6 + k * 0.9, 18, easeOut);
      const y = base - (r + 1) * (G.size + G.gap) - (1 - t) * 520;
      return <div key={num} style={{ position: "absolute", left: x0 + c * (G.size + G.gap), top: y, width: G.size, height: G.size, borderRadius: 4, background: color, opacity: 0.25 + 0.7 * t }} />;
    });
  };
  const colW = G.cols * (G.size + G.gap) - G.gap;
  const fa = p.lang === "fa";
  const xMec = fa ? W / 2 + 60 : W / 2 - 60 - colW;
  const xMed = fa ? W / 2 - 60 - colW : W / 2 + 60;
  const versesAt = lineAt(s, "verses", 30);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {col("meccan", xMec, C.brass)}
      {col("medinan", xMed, C.turquoise)}
      {[
        [xMec, Number(n.meccan), w.meccan, C.brass, Number(n.meccanAyahs)],
        [xMed, Number(n.medinan), w.medinan, C.turquoise, Number(n.medinanAyahs)],
      ].map(([x, v, label, color, ayahs]) => (
        <div key={String(label)} style={{ position: "absolute", top: base + 14, left: Number(x) - 60, width: colW + 120, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Label lang={p.lang} size={40} color={String(color)}>{`${nIn(p.lang, Number(v))} ${String(label)}`}</Label>
        </div>
      ))}
      <div style={{ position: "absolute", top: BAND.visTop, left: 0, width: W, display: "flex", justifyContent: "center", gap: 120 }} dir={fa ? "rtl" : "ltr"}>
        {[
          [Number(n.meccanAyahs), C.brass],
          [Number(n.medinanAyahs), C.turquoise],
        ].map(([v, color]) => (
          <div key={String(color)} style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: ramp(f, versesAt - 4, 14) }}>
            <BigNumber lang={p.lang} value={Number(v)} f={f} at={versesAt} size={110} color={String(color)} />
            <Label lang={p.lang} size={34} color={C.quiet}>{w.verses}</Label>
          </div>
        ))}
      </div>
      <Captions s={s} lang={p.lang} />
    </AbsoluteFill>
  );
};

/** The Mushaf Map and the Middle: the 604 pages, the light falling across them. */
const MapView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const w = I_WORDS[p.lang];
  const n = p.numbers;
  const out = c01((s.dur - f) / ST.OUT);
  const fa = p.lang === "fa";
  const top = 540;
  if (p.format === "middle") {
    const marks = (Array.isArray(p.data.marks) ? p.data.marks : []) as Array<{ id: string; page: number }>;
    const labels: Record<string, string> = { verses: w.byVerses, words: w.byWords, letters: w.byLetters };
    const refs: Record<string, string> = { verses: strs(n.byVerse).map((r) => refIn(p.lang, r)).join(fa ? " و " : "–"), words: refIn(p.lang, String(n.byWord)), letters: refIn(p.lang, String(n.byLetter)) };
    const m2 = marks.map((m) => ({ ...m, o: ramp(f, lineAt(s, m.id, 30) - 2, 12) }));
    const lastOn = [...m2].reverse().find((m) => m.o > 0);
    const runner = lastOn ? null : interpolate(f, [0, 40], [1, Number(p.pages) / 2], clamp);
    return (
      <AbsoluteFill style={{ opacity: out }}>
        <div style={{ position: "absolute", top: BAND.visTop - 10, left: 90, width: W - 180, display: "flex", flexDirection: "column", gap: 4 }} dir={fa ? "rtl" : "ltr"}>
          {m2.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", opacity: 0.25 + 0.75 * m.o, fontFamily: ui(p.lang), fontSize: 38, color: m === lastOn ? C.star : C.ink, borderBottom: `1px solid ${C.gold}44`, paddingBlock: 6 }}>
              <span>{labels[m.id]}</span>
              <span dir="ltr" style={{ color: C.brass }}>{refs[m.id]}</span>
              <span style={{ fontSize: 30, color: C.quiet }}>{w.page(m.page)}</span>
            </div>
          ))}
        </div>
        <PageMap p={p} f={f} at={0} top={top + 40} lit={new Set()} markers={m2.map((m) => ({ page: m.page, o: m.o, label: m.id }))} runner={runner} />
        <Captions s={s} lang={p.lang} />
      </AbsoluteFill>
    );
  }
  const lit = new Set(arr(p.data.lit));
  const placeAt = lineAt(s, "place", s.dur * 0.6);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: BAND.visTop, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 22 }} dir={fa ? "rtl" : "ltr"}>
          <BigNumber lang={p.lang} value={Number(n.pages)} f={f} at={10} size={130} len={60} />
          <Label lang={p.lang} size={42}>{w.pages(nIn(p.lang, Number(n.totalPages)))}</Label>
        </div>
        <div style={{ display: "flex", gap: 40, opacity: ramp(f, placeAt - 4, 14), marginTop: 8 }} dir={fa ? "rtl" : "ltr"}>
          {[
            [C.brass, w.meccan, Number(n.meccan)],
            [C.turquoise, w.medinan, Number(n.medinan)],
          ].map(([color, label, v]) => (
            <span key={String(label)} style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: ui(p.lang), fontSize: 36, color: C.ink }}>
              <span style={{ width: 24, height: 24, borderRadius: 5, background: String(color), display: "inline-block" }} />
              {`${String(label)}${sep(p.lang)}${nIn(p.lang, Number(v))}`}
            </span>
          ))}
        </div>
      </div>
      <PageMap p={p} f={f} at={8} top={top + 30} lit={lit} />
      <Captions s={s} lang={p.lang} />
    </AbsoluteFill>
  );
};

/** Revelation Order: the tiles leave the book's order for the revelation order. */
const TilesView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const w = I_WORDS[p.lang];
  const out = c01((s.dur - f) / ST.OUT);
  const at = 24;
  const moved = ramp(f, at + 40, 30);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: BAND.visTop, left: 0, width: W, height: 80 }}>
        <Label lang={p.lang} size={42} color={C.gold} style={{ position: "absolute", width: W, opacity: 1 - moved }}>
          {w.mushafOrder}
        </Label>
        <Label lang={p.lang} size={42} color={C.gold} style={{ position: "absolute", width: W, opacity: moved }}>
          {w.revelationOrder}
        </Label>
      </div>
      <Tiles p={p} f={f} at={at} top={BAND.visTop + 110} focus={arr(p.data.focus)} />
      <Captions s={s} lang={p.lang} />
    </AbsoluteFill>
  );
};

/** One Line Many Times: a ladder of the surah's verses, the repeats lit as the light runs down. */
const LadderView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const n = p.numbers;
  const places = arr(p.data.places);
  const verses = Number(p.data.verses);
  const out = c01((s.dur - f) / ST.OUT);
  const top = BAND.visTop + 215;
  const height = BAND.visBottom - top;
  const step = height / Math.max(1, verses);
  const run = interpolate(f, [6, 6 + mk(70)], [0, verses + 2], clamp);
  const line = p.recite?.ayahs[0]?.text ?? null;
  let k = 0;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {line ? (
        <div style={{ position: "absolute", top: BAND.visTop - 10, left: 0, width: W, display: "flex", justifyContent: "center" }}>
          <Fit width={860} maxHeight={130} max={60} min={30} measureKey={line} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.6, textAlign: "center", color: C.star }}>
            {line}
          </Fit>
        </div>
      ) : null}
      <svg width={W} height={height + 10} style={{ position: "absolute", top, left: 0 }}>
        {Array.from({ length: verses }, (_, i) => {
          const a = i + 1;
          const on = places.includes(a);
          const passed = c01((run - a) / 2);
          const y = i * step;
          const wide = on ? 560 : 300;
          if (on) k++;
          return <rect key={a} x={(W - wide) / 2} y={y} width={wide} height={Math.max(2, step * 0.58)} rx={2} fill={on ? C.brass : C.ink} opacity={on ? 0.2 + 0.8 * passed : 0.12} />;
        })}
      </svg>
      {places.map((a, i) => {
        const passed = c01((run - a) / 2);
        const left = i % 2 === 0;
        return (
          <div key={a} dir="ltr" style={{ position: "absolute", top: top + (a - 1) * step - 12, ...(left ? { right: W / 2 + 300 } : { left: W / 2 + 300 }), fontFamily: ui(p.lang), fontSize: 22, color: C.brass, opacity: passed }}>
            {dIn(p.lang, a)}
          </div>
        );
      })}
      <div style={{ position: "absolute", top: top - 66, width: W, display: "flex", justifyContent: "center" }}>
        <Label lang={p.lang} size={42} color={C.ink}>
          <span style={{ color: C.brass }}>{nIn(p.lang, Math.min(places.length, Math.round(places.filter((a) => a <= run).length)))}</span>
          {` / ${nIn(p.lang, Number(n.times))}`}
        </Label>
      </div>
      <Captions s={s} lang={p.lang} />
      {void k}
    </AbsoluteFill>
  );
};

/** The alphabet as a grid of 28 letters; `lit(i)` is how bright letter i is. */
const Alphabet: React.FC<{ p: InsightProps; f: number; lit: (i: number) => number; size?: number }> = ({ p, lit, size = 92 }) => {
  const codes = arr(p.data.alphabet);
  return (
    <div dir="rtl" style={{ display: "grid", gridTemplateColumns: `repeat(7, ${size + 14}px)`, gap: 12, justifyContent: "center" }}>
      {codes.map((code, i) => {
        const k = c01(lit(i));
        return (
          <div key={i} style={{ height: size + 14, display: "grid", placeItems: "center", borderRadius: 14, border: `1.5px solid ${C.gold}${k > 0.5 ? "" : "55"}`, background: `rgba(224,172,79,${(0.05 + 0.3 * k).toFixed(2)})`, transform: `scale(${(0.95 + 0.08 * k).toFixed(3)})` }}>
            <span lang="ar" style={{ fontFamily: FONT.quran, fontSize: size * 0.62, lineHeight: 1, color: k > 0.5 ? C.star : C.ink, opacity: 0.35 + 0.65 * k, textShadow: k > 0.5 && flags.glow ? `0 0 ${(22 * k).toFixed(0)}px rgba(255,214,140,0.8)` : undefined, paddingBottom: size * 0.12 }}>
              {String.fromCodePoint(code)}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/** The qari's clip timing of one word (seconds from the clip start), or a share of the clip. */
function wordStart(clip: QariClip | null | undefined, word: number, count: number): number {
  if (!clip) return 0;
  if (clip.mode === "word" && clip.words.length === count) return clip.words[word]?.start ?? 0;
  return (word / Math.max(1, count)) * clip.seconds;
}

/** Every Letter's line on screen: one of the verses that hold all the letters (fixed words, the counted numbers). */
const everyTitle = (p: InsightProps) => I_WORDS[p.lang].everyTitle(nIn(p.lang, strs(p.numbers.verses).length), nIn(p.lang, Number(p.numbers.letters)));
/** …and the other verses that hold them, by reference. */
const everyOther = (p: InsightProps) => {
  const others = strs(p.numbers.verses).filter((v) => v !== String(p.numbers.verse));
  return others.length ? I_WORDS[p.lang].everyOther(others.map((r) => refIn(p.lang, r)).join(sep(p.lang))) : "";
};

/** The recited verses: the qari with the word light; the letters of «every letter» light as he reaches them. */
const ReciteView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const r = p.recite;
  const out = c01((s.dur - f) / ST.OUT);
  if (!r) return null;
  const fa = p.lang === "fa";
  const clipOf = (a: number) => p.qari?.verses.find((v) => v.ayah === a) ?? null;
  const startOf = (a: number) => {
    const c = s.clips.find((x) => x.ayah === a);
    return c ? c.from - s.from : 12;
  };
  const body = (a: number, text: string) => {
    const split = splitLeadingBasmala(r.surah.number, a, text, r.opening);
    return split ? split.rest : text;
  };
  const refText = r.from === r.to ? refIn(p.lang, `${r.surah.number}:${r.from}`) : `${refIn(p.lang, `${r.surah.number}:${r.from}`)}–${dIn(p.lang, r.to)}`;
  const warm = ramp(f, 4, 20);
  if (p.format === "every-letter") {
    const a = r.ayahs[0]!;
    const text = body(a.ayahNumber, a.text);
    const clip = clipOf(a.ayahNumber);
    const count = wordCount(text);
    const fw = arr(p.data.firstWord);
    const t0 = startOf(a.ayahNumber);
    const litAt = fw.map((w) => t0 + wordStart(clip, Math.max(0, w), count) * 30);
    const tSec = (f - t0) / 30;
    const done = litAt.filter((x) => f >= x).length;
    return (
      <AbsoluteFill style={{ opacity: out }}>
        <Lamp warm={warm} cy={0.36} />
        <div style={{ position: "absolute", top: BAND.visTop - 6, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          {/* the hook from the first frame, on screen: the qari fills the minute (S3e) */}
          <div dir={fa ? "rtl" : "ltr"} style={{ opacity: c01((f + 8) / 8) }}>
            <Fit width={900} maxHeight={120} max={fa ? 44 : 46} min={26} measureKey={everyTitle(p)} lang={p.lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: ui(p.lang), fontWeight: 600, lineHeight: fa ? 1.6 : 1.25, textAlign: "center", color: C.ink, textWrap: "balance" }}>
              {everyTitle(p)}
            </Fit>
          </div>
          <Alphabet p={p} f={f} lit={(i) => c01((f - (litAt[i] ?? 1e9)) / 6)} size={64} />
          <Label lang={p.lang} size={40} color={C.gold}>
            <span dir="ltr">{`${nIn(p.lang, done)} / ${nIn(p.lang, fw.length)}${sep(p.lang)}${refText}`}</span>
          </Label>
        </div>
        <div style={{ position: "absolute", top: 820, left: 0, width: W, display: "flex", justifyContent: "center" }}>
          <Fit width={880} maxHeight={BAND.capTop + BAND.capH - 830} max={44} min={20} measureKey={text} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.85, textAlign: "center" }}>
            <LitText text={text} clip={p.studio.wordGlow ? clip : null} t={tSec} after={<AyahSeal label={fa ? faNum(a.ayahNumber) : arNum(a.ayahNumber)} font={fa ? FONT.fa : FONT.quran} />} />
          </Fit>
        </div>
      </AbsoluteFill>
    );
  }
  const many = r.ayahs.length > 1;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Lamp warm={warm} cy={0.45} />
      <div style={{ position: "absolute", top: BAND.visTop, left: 0, width: W, display: "flex", justifyContent: "center" }}>
        <Label lang={p.lang} size={40} color={C.gold}>
          <span dir="ltr">{refText}</span>
        </Label>
      </div>
      <div style={{ position: "absolute", top: BAND.visTop + 80, left: 0, width: W, height: BAND.capTop + BAND.capH - BAND.visTop - 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: many ? 10 : 30 }}>
        {r.ayahs.map((a) => {
          const text = body(a.ayahNumber, a.text);
          const clip = clipOf(a.ayahNumber);
          const t0 = startOf(a.ayahNumber);
          const o = many ? c01((f - t0 + 10) / 8) * 0.65 + 0.35 : 1;
          return (
            <div key={a.ayahNumber} style={{ display: "flex", flexDirection: "column", alignItems: "center", opacity: o }}>
              <Fit width={860} maxHeight={many ? 150 : 420} max={many ? 78 : 104} min={34} measureKey={text} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.85, textAlign: "center", textWrap: "balance" }}>
                <LitText text={text} clip={p.studio.wordGlow ? clip : null} t={(f - t0) / 30} after={<AyahSeal label={fa ? faNum(a.ayahNumber) : arNum(a.ayahNumber)} font={fa ? FONT.fa : FONT.quran} />} />
              </Fit>
              {a.translation && !many ? (
                <div style={{ marginTop: 26, opacity: c01((f - t0 - 20) / 14) }}>
                  <Fit width={820} maxHeight={220} max={fa ? 40 : 44} min={24} measureKey={a.translation} lang={p.lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: ui(p.lang), lineHeight: fa ? 1.8 : 1.35, textAlign: "center", color: C.translation, textWrap: "balance" }}>
                    {a.translation}
                  </Fit>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** The quiz's three options; `reveal` (0–1) lights the answer and dims the rest. */
const Options: React.FC<{ p: InsightProps; f: number; at: number; reveal: number }> = ({ p, f, at, reveal }) => {
  const w = I_WORDS[p.lang];
  const opts = arr(p.data.options);
  const answer = Number(p.data.answer);
  const fa = p.lang === "fa";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26, width: 840 }} dir={fa ? "rtl" : "ltr"}>
      {opts.map((num, i) => {
        const s = surahOf(p, num);
        const o = ramp(f, at + i * 5, 12);
        const right = num === answer;
        const k = right ? reveal : 0;
        return (
          <div
            key={num}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 26,
              padding: "20px 34px",
              borderRadius: 18,
              border: `2px solid ${right && reveal > 0.5 ? C.brass : `${C.ink}55`}`,
              background: right ? `rgba(224,172,79,${(0.06 + 0.88 * k).toFixed(2)})` : `${C.ink}0a`,
              opacity: o * (1 - (right ? 0 : 0.55 * reveal)),
              transform: `translateY(${((1 - o) * 24).toFixed(0)}px) scale(${(1 + 0.04 * k).toFixed(3)})`,
              boxShadow: right && flags.glow ? `0 0 ${(40 * k).toFixed(0)}px rgba(224,172,79,${(0.5 * k).toFixed(2)})` : undefined,
            }}
          >
            <span style={{ fontFamily: ui(p.lang), fontSize: 46, color: right && k > 0.5 ? C.night : C.gold, width: 70 }}>{w.options[i]}</span>
            <span style={{ fontFamily: ui(p.lang), fontSize: 52, color: right && k > 0.5 ? C.night : C.ink }}>{w.surah(num)}</span>
            {s ? (
              <span lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 54, lineHeight: 1.4, color: right && k > 0.5 ? C.night : C.star, marginInlineStart: "auto" }}>
                {s.nameArabic}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

/** The quiz · three seconds to think: a ring empties, 3 · 2 · 1. */
const ThinkView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const left = c01(1 - f / s.dur);
  const sec = Math.max(1, Math.ceil((left * s.dur) / 30));
  const R = 110;
  const L = 2 * Math.PI * R;
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: BAND.visTop + 30, left: 0, width: W, display: "flex", justifyContent: "center" }}>
        <svg width={280} height={280} viewBox="0 0 280 280">
          <circle cx={140} cy={140} r={R} fill="none" stroke={`${C.ink}33`} strokeWidth={14} />
          <circle cx={140} cy={140} r={R} fill="none" stroke={C.brass} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${(L * left).toFixed(1)} ${L.toFixed(1)}`} transform="rotate(-90 140 140)" />
          <text x={140} y={168} textAnchor="middle" fontSize={96} fill={C.ink} fontFamily={p.lang === "fa" ? "Vazirmatn" : "EB Garamond"}>
            {dIn(p.lang, sec)}
          </text>
        </svg>
      </div>
      <div style={{ position: "absolute", top: 760, left: 0, width: W, display: "flex", justifyContent: "center" }}>
        <Options p={p} f={999} at={0} reveal={0} />
      </div>
    </AbsoluteFill>
  );
};

/** The quiz · the answer flashes, with its source. */
const AnswerView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const out = c01((s.dur - f) / ST.OUT);
  const reveal = ramp(f, 0, 10);
  const flash = interpolate(f, [2, 8, 24], [0, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ background: `radial-gradient(50% 30% at 50% 45%, rgba(255,226,160,${(0.25 * flash).toFixed(2)}), transparent 70%)` }} />
      <div style={{ position: "absolute", top: BAND.visTop + 20, left: 0, width: W, display: "flex", justifyContent: "center" }}>
        <Label lang={p.lang} size={44} color={C.gold} style={{ letterSpacing: p.lang === "fa" ? 0 : "0.16em", textTransform: p.lang === "fa" ? "none" : "uppercase" }}>
          {I_WORDS[p.lang].answer}
        </Label>
      </div>
      <div style={{ position: "absolute", top: 560, left: 0, width: W, display: "flex", justifyContent: "center" }}>
        <Options p={p} f={999} at={0} reveal={reveal} />
      </div>
      <Captions s={s} lang={p.lang} />
    </AbsoluteFill>
  );
};

/** The sources and the ending (loop back, «the next part tomorrow», or the source card). */
const EndView: React.FC<ViewProps> = ({ p, s }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const w = I_WORDS[p.lang];
  const q = p.source.quran;
  const m = p.source.surahMetadata;
  const label = { fontFamily: ui(p.lang), fontSize: 26, fontWeight: 600, letterSpacing: fa ? 0 : "0.16em", textTransform: fa ? "none" : "uppercase", color: C.gold } as const;
  const big = { fontFamily: FONT.en, fontSize: 34, color: C.ink, lineHeight: 1.3, textAlign: "center", maxWidth: 860, direction: "ltr" } as const;
  const block = (at: number, children: React.ReactNode) => <div style={{ opacity: ramp(f, at, 14), display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>{children}</div>;
  const qari = p.qari?.reciter.name ?? null;
  // the translation is named only where the video showed it (one recited ayah, not the alphabet view)
  const tr = p.recite && p.recite.ayahs.length === 1 && p.format !== "every-letter" ? p.recite.translation : null;
  return (
    <AbsoluteFill>
      <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: BAND.visTop, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <div style={{ opacity: ramp(f, 0, 14) }}>
          <SirajMark size={88} />
        </div>
        {p.format === "every-letter" && everyOther(p) && !s.lines.length
          ? block(
              2,
              <div dir={fa ? "rtl" : "ltr"} style={{ fontFamily: ui(p.lang), fontSize: 38, color: C.ink, lineHeight: 1.5 }}>
                {everyOther(p)}
              </div>,
            )
          : null}
        {block(
          4,
          <>
            <div style={label}>{w.quranText}</div>
            <div style={big}>{`${q.publisher}, ${host(q.canonicalUrl)} · ${q.sourceTitle}`}</div>
          </>,
        )}
        {block(
          10,
          <>
            <div style={label}>{w.metadata}</div>
            <div style={big}>{[m.title, m.licenseName].filter(Boolean).join(" · ")}</div>
          </>,
        )}
        {tr
          ? block(
              14,
              <>
                <div style={label}>{w.translation}</div>
                <div style={{ ...big, direction: fa ? "rtl" : "ltr", fontFamily: ui(p.lang) }}>{tr.translatorName}</div>
              </>,
            )
          : null}
        {qari
          ? block(
              18,
              <>
                <div style={label}>{w.recitation}</div>
                <div style={{ ...big, color: C.gold }}>{`${qari} · Quran Foundation`}</div>
              </>,
            )
          : null}
        <div style={{ opacity: ramp(f, 22, 14), display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 6 }}>
          <div style={{ fontFamily: FONT.en, fontSize: 44, color: C.gold, letterSpacing: "0.04em", direction: "ltr" }}>{SITE}</div>
          {p.voice.lines.length ? <div style={{ fontFamily: ui(p.lang), fontSize: 25, color: C.quiet }}>{w.voice}</div> : null}
          {p.studio.ending === "next" ? (
            <div style={{ marginTop: 14, padding: "12px 34px", borderRadius: 999, border: `2px solid ${C.brass}`, fontFamily: ui(p.lang), fontSize: 40, color: C.star }}>{w.next}</div>
          ) : null}
        </div>
      </div>
      <Captions s={s} lang={p.lang} />
    </AbsoluteFill>
  );
};

const VIEWS: Record<string, React.FC<ViewProps>> = {
  hook: HookView,
  claim: HookView,
  question: HookView,
  count: StripView,
  strip: StripView,
  map: MapView,
  tiles: TilesView,
  trick: TrickView,
  columns: ColumnsView,
  ladder: LadderView,
  recite: ReciteView,
  think: ThinkView,
  answer: AnswerView,
  note: VerdictView,
  end: EndView,
};

const viewOf = (p: InsightProps, id: string): React.FC<ViewProps> => (p.format === "myth-fact" && id === "count" ? MythCountView : (VIEWS[id] ?? EndView));

/* ---------- the chip and the rule box ---------- */

const Chip: React.FC<{ p: InsightProps; f: number }> = ({ p, f }) => {
  const fa = p.lang === "fa";
  const n = p.studio.seriesNumber ? (p.series?.n ?? null) : null;
  return (
    <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: BAND.chip, left: 0, width: W, display: "flex", justifyContent: "center", opacity: c01((f + 10) / 10) }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "8px 26px", borderRadius: 999, border: `1.5px solid ${C.gold}88`, background: `${C.night}aa` }}>
        <Seal size={30} />
        <span style={{ fontFamily: ui(p.lang), fontSize: fa ? 33 : 30, fontWeight: 500, letterSpacing: fa ? 0 : "0.14em", textTransform: fa ? "none" : "uppercase", color: C.gold }}>{chipOf(p.format, p.lang, n)}</span>
      </div>
    </div>
  );
};

const RuleBox: React.FC<{ p: InsightProps; o: number }> = ({ p, o }) => {
  const fa = p.lang === "fa";
  const text = ruleOf(p.format, p.episode, p.lang, p.numbers);
  return (
    <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: BAND.rule, left: (W - 880) / 2, width: 880, height: BAND.ruleH, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: o }}>
      <div style={{ width: 200, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }} />
      <Fit width={880} maxHeight={BAND.ruleH - 14} max={26} min={18} measureKey={text} lang={p.lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: ui(p.lang), lineHeight: fa ? 1.7 : 1.35, textAlign: "center", color: C.quiet }}>
        {text}
      </Fit>
    </div>
  );
};

/* ---------- the reel ---------- */

export const InsightReel: React.FC<InsightProps> = (raw) => {
  const studio = applyStudio(raw.studio);
  const p = { ...raw, studio };
  const t = insightTimeline({ scenes: p.scenes, narration: p.narration, voice: p.voice, qari: p.qari, loop: studio.ending === "loop" });
  const f = useCurrentFrame();
  const first = t.scenes[0]!;
  const last = t.scenes[t.scenes.length - 1]!;
  const ruleOn = Math.min(c01((f - (t.scenes[1]?.from ?? 0) + 6) / 12), c01((last.from - f + 6) / 12));
  const Hook = viewOf(p, first.id);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={t.total} seed={7 + p.format.length * 3 + p.episode.length} muted />
      {studio.frame ? <MushafFrame /> : null}
      <Chip p={p} f={f} />
      {t.scenes.map((s) => {
        const View = viewOf(p, s.id);
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
            <View p={p} s={s} />
          </Sequence>
        );
      })}
      <RuleBox p={p} o={ruleOn} />
      {t.loopFrames ? (
        <Sequence from={t.total - t.loopFrames} durationInFrames={t.loopFrames} name="loop">
          <LoopIn frames={t.loopFrames}>
            <Freeze frame={0}>
              <Hook p={p} s={first} />
            </Freeze>
          </LoopIn>
        </Sequence>
      ) : null}
      {t.scenes.flatMap((s) =>
        s.lines.map((l) =>
          l.file ? (
            <Sequence key={`v-${l.id}`} from={l.from} durationInFrames={l.len + 2} name={`voice ${l.id}`}>
              <Audio src={staticFile(l.file)} />
            </Sequence>
          ) : null,
        ),
      )}
      {t.scenes.flatMap((s) =>
        s.clips.map((c) => (
          <Sequence key={`q-${c.id}`} from={c.from} durationInFrames={c.len + 2} name={`qari ${c.id}`}>
            <Audio src={staticFile(c.file)} />
          </Sequence>
        )),
      )}
    </AbsoluteFill>
  );
};

const LoopIn: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: c01((f + 1) / frames), background: C.night }}>{children}</AbsoluteFill>;
};

/* ---------- covers and slides ---------- */

/** The cover (1080×1920) and the grid crop (1080×1350): chip, the format's picture, the hook, the rule. */
export const InsightCover: React.FC<InsightProps> = (raw) => {
  const studio = applyStudio(raw.studio);
  const p = { ...raw, studio };
  const { height } = useVideoConfig();
  const tall = height > 1500;
  const fa = p.lang === "fa";
  // Every Letter has no narration since S3e: its line on screen is its hook
  const hook = p.narration[0]?.show ?? (p.format === "every-letter" ? everyTitle(p) : "");
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={1} still seed={7 + p.format.length * 3 + p.episode.length} />
      {studio.frame ? <MushafFrame drawn /> : null}
      <Lamp warm={0.7} cy={0.45} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: tall ? 60 : 18, paddingInline: 70, paddingBottom: tall ? 0 : 10 }}>
        <div dir={fa ? "rtl" : "ltr"} style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "8px 26px", borderRadius: 999, border: `1.5px solid ${C.gold}88` }}>
          <Seal size={30} />
          <span style={{ fontFamily: ui(p.lang), fontSize: 30, letterSpacing: fa ? 0 : "0.14em", textTransform: fa ? "none" : "uppercase", color: C.gold }}>{chipOf(p.format, p.lang, studio.seriesNumber ? (p.series?.n ?? null) : null)}</span>
        </div>
        <div style={{ transform: `scale(${tall ? 1.22 : 0.78})`, marginBlock: tall ? 60 : -60 }}>
          <Hero p={p} f={999} cover />
        </div>
        <Fit width={900} maxHeight={tall ? 300 : 200} max={fa ? (tall ? 72 : 60) : tall ? 80 : 66} min={34} measureKey={hook} lang={p.lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: ui(p.lang), lineHeight: fa ? 1.7 : 1.25, textAlign: "center", color: C.ink, textWrap: "balance" }}>
          {hook}
        </Fit>
        <div style={{ fontFamily: FONT.en, fontSize: 32, color: C.gold, letterSpacing: "0.04em" }}>{SITE}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The quiz's carousel twin (1080×1350): 1 the question and options, 2 «?», 3 the answer and its source. */
export const InsightSlide: React.FC<InsightProps & { slide?: number }> = (raw) => {
  const studio = applyStudio(raw.studio);
  const p = { ...raw, studio };
  const k = raw.slide ?? 1;
  const fa = p.lang === "fa";
  const question = p.narration.find((l) => l.id === "question")?.show ?? p.narration[0]?.show ?? "";
  const answer = p.narration.find((l) => l.id === "answer")?.show ?? "";
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={1} still seed={11} />
      {studio.frame ? <MushafFrame drawn inset={26} /> : null}
      <Lamp warm={0.6} cy={0.45} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, paddingInline: 70 }}>
        <span style={{ fontFamily: ui(p.lang), fontSize: 30, letterSpacing: fa ? 0 : "0.14em", textTransform: fa ? "none" : "uppercase", color: C.gold }}>{`${chipOf(p.format, p.lang, null)} · ${dIn(p.lang, k)}/${dIn(p.lang, 3)}`}</span>
        {k === 2 ? (
          <div style={{ fontFamily: ui(p.lang), fontSize: 420, lineHeight: 1, color: C.brass }}>{fa ? "؟" : "?"}</div>
        ) : (
          <>
            <Fit width={900} maxHeight={220} max={fa ? 60 : 66} min={32} measureKey={k === 3 ? answer : question} lang={p.lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: ui(p.lang), lineHeight: fa ? 1.7 : 1.25, textAlign: "center", color: C.ink, textWrap: "balance" }}>
              {k === 3 ? answer : question}
            </Fit>
            <Options p={p} f={999} at={0} reveal={k === 3 ? 1 : 0} />
            {k === 3 ? <div style={{ fontFamily: ui(p.lang), fontSize: 24, color: C.quiet, maxWidth: 880, textAlign: "center" }}>{ruleOf(p.format, p.episode, p.lang, p.numbers)}</div> : null}
          </>
        )}
        <div style={{ fontFamily: FONT.en, fontSize: 30, color: C.gold }}>{SITE}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
