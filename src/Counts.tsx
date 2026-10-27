// «Counts» / «شمارش‌ها»: numbers counted at render time from Siraj's surah index and the
// hash-checked Tanzil metadata, each with its counting rule. Four metrics: the overview (S1:
// totals, Meccan / Medinan, longest and shortest), the revelation order, the places of
// prostration and the divisions (parts, sections, pages). The narration is the job's factual
// sentences (`show` on screen, `say` voiced); no claim, no "numerical miracle".
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Fit } from "./Fit";
import { C_WORDS, L, SITE, host } from "./labels";
import { World } from "./light";
import { Divider, MushafFrame, SirajMark } from "./ornament";
import type { CountsProps, Lang } from "./props";
import { C, FONT, SAFE, W, easeInOut, easeOut, enNum, fadeIn, fadeOut, faGrouped, faNum, rise } from "./theme";
import { ST, countsTimeline, type Scene } from "./timelines";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OUT = ST.OUT;

export const numIn = (lang: Lang, n: number) => (lang === "fa" ? faGrouped(n) : enNum(n));
const digitsIn = (lang: Lang, n: number) => (lang === "fa" ? faNum(n) : String(n));
const uiFont = (lang: Lang) => (lang === "fa" ? FONT.fa : FONT.en);
const count = (f: number, from: number, to: number, len = 42) => Math.round(interpolate(f, [from, from + len], [0, to], { ...clamp, easing: easeOut }));
const list = (lang: Lang, items: string[]) =>
  items.length < 2 ? items.join("") : lang === "fa" ? `${items.slice(0, -1).join("، ")} و ${items[items.length - 1]}` : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
const nums = (p: CountsProps, k: string): number[] => (Array.isArray(p.numbers[k]) ? (p.numbers[k] as number[]) : []);
const n1 = (p: CountsProps, k: string): number => Number(p.numbers[k]);
/** The frame (in the scene) where the scene's k-th line begins, or a fallback. */
const lineAt = (s: Scene, id: string, fallback: number) => {
  const l = s.lines.find((x) => x.id === id);
  return l ? l.from - s.from : fallback;
};

const Rule: React.FC<{ children: React.ReactNode; opacity: number; lang: Lang }> = ({ children, opacity, lang }) => (
  <div style={{ fontFamily: uiFont(lang), fontStyle: lang === "fa" ? "normal" : "italic", fontSize: lang === "fa" ? 28 : 31, color: C.quiet, textAlign: "center", maxWidth: 840, lineHeight: lang === "fa" ? 1.8 : 1.35, opacity }}>
    {children}
  </div>
);

const Title: React.FC<{ lang: Lang; children: React.ReactNode; f: number }> = ({ lang, children, f }) => (
  <div style={{ opacity: fadeIn(f, 2), transform: `translateY(${rise(f, 2)}px)`, fontFamily: uiFont(lang), fontSize: lang === "fa" ? 60 : 68, color: C.ink, textAlign: "center" }}>{children}</div>
);

/* ---------- overview ---------- */

const Total: React.FC<{ p: CountsProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const w = C_WORDS[p.lang];
  const num = { fontFamily: p.lang === "fa" ? FONT.fa : FONT.en, fontWeight: 500, color: C.brass, lineHeight: 1, fontVariantNumeric: "lining-nums tabular-nums" } as const;
  const unit = { fontFamily: uiFont(p.lang), fontSize: 62, color: C.ink, letterSpacing: p.lang === "fa" ? 0 : "0.04em", marginTop: 6 } as const;
  return (
    <AbsoluteFill dir={p.lang === "fa" ? "rtl" : "ltr"} style={{ alignItems: "center", justifyContent: "center", paddingTop: 110, paddingBottom: 420, opacity: fadeOut(f, s.dur, OUT) }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{ opacity: fadeIn(f, 4), transform: `translateY(${rise(f, 4)}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ ...num, fontSize: p.lang === "fa" ? 250 : 290 }}>{numIn(p.lang, count(f, 6, n1(p, "surahs"), 40))}</div>
          <div style={unit}>{w.surahs}</div>
        </div>
        <Divider width={360} style={{ marginBlock: 22, opacity: fadeIn(f, 16) }} />
        <div style={{ opacity: fadeIn(f, 18), transform: `translateY(${rise(f, 18)}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ ...num, fontSize: p.lang === "fa" ? 200 : 230 }}>{numIn(p.lang, count(f, 20, n1(p, "ayahs"), 54))}</div>
          <div style={unit}>{w.verses}</div>
        </div>
        <div style={{ marginTop: 30 }}>
          <Rule opacity={fadeIn(f, 50)} lang={p.lang}>
            {w.kufan}
          </Rule>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Bar: React.FC<{ lang: Lang; label: string; value: number; of: number; color: string; f: number; at: number; unit: string }> = ({ lang, label, value, of, color, f, at, unit }) => {
  const g = interpolate(f, [at, at + 36], [0, 1], { ...clamp, easing: easeInOut });
  const full = 780;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: fadeIn(f, at - 4, 10) }}>
      <div style={{ display: "flex", justifyContent: "space-between", width: full, fontFamily: uiFont(lang), fontSize: 40, color: C.ink }}>
        <span>{label}</span>
        <span style={{ color, fontVariantNumeric: "lining-nums tabular-nums" }}>
          {numIn(lang, Math.round(value * g))} <span style={{ fontSize: 30, color: C.quiet }}>{unit}</span>
        </span>
      </div>
      <div style={{ width: full, height: 30, borderRadius: 4, background: "rgba(243,234,214,0.07)", overflow: "hidden" }}>
        <div style={{ width: full * (value / of) * g, height: "100%", borderRadius: 4, background: color }} />
      </div>
    </div>
  );
};

const Places: React.FC<{ p: CountsProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const w = C_WORDS[p.lang];
  const t = L[p.lang];
  const second = lineAt(s, "placeVerses", 90);
  const caps = { fontFamily: uiFont(p.lang), fontSize: 30, letterSpacing: p.lang === "fa" ? 0 : "0.16em", textTransform: p.lang === "fa" ? "none" : "uppercase", color: C.gold, width: 780 } as const;
  return (
    <AbsoluteFill dir={p.lang === "fa" ? "rtl" : "ltr"} style={{ alignItems: "center", justifyContent: "center", paddingTop: 110, paddingBottom: 420, opacity: fadeOut(f, s.dur, OUT) }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <Title lang={p.lang} f={f}>
          {w.placesTitle}
        </Title>
        <Rule opacity={fadeIn(f, 8)} lang={p.lang}>
          {w.placesRule}
        </Rule>
        <div style={{ height: 30 }} />
        <div style={{ ...caps, opacity: fadeIn(f, 12) }}>{w.surahsLabel}</div>
        <Bar lang={p.lang} label={t.meccan} value={n1(p, "meccanSurahs")} of={n1(p, "surahs")} color={C.brass} f={f} at={16} unit={w.surahs} />
        <Bar lang={p.lang} label={t.medinan} value={n1(p, "medinanSurahs")} of={n1(p, "surahs")} color={C.turquoise} f={f} at={26} unit={w.surahs} />
        <div style={{ height: 26 }} />
        <div style={{ ...caps, opacity: fadeIn(f, second - 6) }}>{w.versesLabel}</div>
        <Bar lang={p.lang} label={t.meccan} value={n1(p, "meccanAyahs")} of={n1(p, "ayahs")} color={C.brass} f={f} at={second} unit={w.verses} />
        <Bar lang={p.lang} label={t.medinan} value={n1(p, "medinanAyahs")} of={n1(p, "ayahs")} color={C.turquoise} f={f} at={second + 10} unit={w.verses} />
        <div style={{ height: 14 }} />
        <Rule opacity={fadeIn(f, second + 30)} lang={p.lang}>
          {w.placesNote}
        </Rule>
      </div>
    </AbsoluteFill>
  );
};

const CHART = { left: 104, width: 798, base: 1200, height: 470 };
/** The callouts stand between the legend and the top of the tallest bar. */
const CALLOUT_TOP = 478;

const Legend: React.FC<{ lang: Lang }> = ({ lang }) => {
  const pairs: Array<[string, string]> = [
    [C.brass, L[lang].meccan],
    [C.turquoise, L[lang].medinan],
  ];
  return (
  <div dir={lang === "fa" ? "rtl" : "ltr"} style={{ display: "flex", gap: 34, fontFamily: uiFont(lang), fontSize: 32, color: C.quiet }}>
    {pairs.map(([color, label]) => (
      <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-block", width: 22, height: 22, borderRadius: 3, background: color }} />
        {label}
      </span>
    ))}
  </div>
  );
};

const Chart: React.FC<{ p: CountsProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const w = C_WORDS[p.lang];
  const n = p.surahs.length;
  const step = CHART.width / n;
  const max = n1(p, "longestAyahs");
  const second = lineAt(s, "shortest", s.dur / 2);
  const showShort = interpolate(f, [second - 8, second + 8], [0, 1], { ...clamp, easing: easeInOut });
  const showLong = interpolate(f, [40, 56], [0, 1], clamp) * (1 - showShort);
  const longest = new Set(nums(p, "longest"));
  const shortest = new Set(nums(p, "shortest"));
  const lit = (num: number) => (longest.has(num) ? showLong : 0) + (shortest.has(num) ? showShort : 0);
  const anyLit = Math.max(showLong, showShort);
  // the Persian chart runs right to left, as its axis is read
  const x = (num: number) => (fa ? CHART.left + (n - num) * step : CHART.left + (num - 1) * step);
  const named = (list2: number[]) => list2.map((num) => p.surahs[num - 1]!);
  const callout = (items: ReturnType<typeof named>, ayahs: number, opacity: number, side: "left" | "right") => (
    <div style={{ position: "absolute", top: CALLOUT_TOP, ...(side === "left" ? { left: CHART.left } : { right: W - CHART.left - CHART.width }), opacity, display: "flex", flexDirection: "column", alignItems: side === "left" ? "flex-start" : "flex-end", gap: 4 }}>
      <div dir={fa ? "rtl" : "ltr"} style={{ fontFamily: uiFont(p.lang), fontSize: 46, color: C.ink }}>{`${w.surahWord(items.length)} ${list(p.lang, items.map((s2) => digitsIn(p.lang, s2.number)))}`}</div>
      <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", gap: 26, alignItems: "baseline" }}>
        {items.map((s2) => (
          <div key={s2.number} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: uiFont(p.lang), fontSize: 30, color: C.quiet, fontVariantNumeric: "lining-nums" }}>{digitsIn(p.lang, s2.number)}</span>
            <span lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 50, lineHeight: 1.5, color: C.star }}>
              {s2.nameArabic}
            </span>
          </div>
        ))}
      </div>
      <div dir={fa ? "rtl" : "ltr"} style={{ fontFamily: uiFont(p.lang), fontSize: 46, color: C.brass, fontVariantNumeric: "lining-nums" }}>
        {w.eachVerses(ayahs, items.length > 1)}
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ opacity: fadeOut(f, s.dur, OUT) }}>
      <div style={{ position: "absolute", top: SAFE.top + 70, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: fadeIn(f, 0) }}>
        <div style={{ fontFamily: uiFont(p.lang), fontSize: fa ? 56 : 64, color: C.ink }}>{w.chartTitle}</div>
        <Legend lang={p.lang} />
      </div>
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        {p.surahs.map((s2) => {
          const g = interpolate(f, [4 + s2.number * 0.22, 4 + s2.number * 0.22 + 24], [0, 1], { ...clamp, easing: easeOut });
          const h = Math.max(3, (s2.ayahCount / max) * CHART.height * g);
          const color = s2.place === "meccan" ? C.brass : C.turquoise;
          return <rect key={s2.number} x={x(s2.number) + step * 0.14} y={CHART.base - h} width={step * 0.72} height={h} rx={1} fill={color} opacity={0.82 - anyLit * 0.5 + lit(s2.number) * 0.68} />;
        })}
        {[...nums(p, "longest").map((num) => ({ num, o: showLong })), ...nums(p, "shortest").map((num) => ({ num, o: showShort }))].map(({ num, o }) => {
          const s2 = p.surahs[num - 1]!;
          const top = CHART.base - Math.max(3, (s2.ayahCount / max) * CHART.height) - 16;
          const cx = x(num) + step / 2;
          return <path key={`m${num}`} d={`M${cx} ${top}l-9 -16h18z`} fill={C.star} opacity={o} />;
        })}
        <line x1={CHART.left} x2={CHART.left + CHART.width} y1={CHART.base + 1} y2={CHART.base + 1} stroke={C.gold} strokeWidth={1.5} opacity={0.7} />
      </svg>
      <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: CHART.base + 16, left: CHART.left, width: CHART.width, display: "flex", justifyContent: "space-between", fontFamily: uiFont(p.lang), fontSize: 28, color: C.quiet, opacity: fadeIn(f, 6) }}>
        <span>{digitsIn(p.lang, 1)}</span>
        <span>{w.chartAxis}</span>
        <span>{digitsIn(p.lang, n)}</span>
      </div>
      {callout(named(nums(p, "longest")), n1(p, "longestAyahs"), showLong, fa ? "right" : "left")}
      {callout(named(nums(p, "shortest")), n1(p, "shortestAyahs"), showShort, fa ? "left" : "right")}
    </AbsoluteFill>
  );
};

/* ---------- revelation order ---------- */

const GRID = { cols: 12, cell: 62, gap: 9 };

const Order: React.FC<{ p: CountsProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const w = C_WORDS[p.lang];
  const byOrder = [...p.surahs].sort((a, b) => a.order - b.order);
  const atOpening = lineAt(s, "opening", s.dur * 0.4);
  const atMedinan = lineAt(s, "medinan", s.dur * 0.7);
  const firstLast = new Set([n1(p, "first"), n1(p, "last")]);
  const opening = 1;
  const firstMedinan = n1(p, "firstMedinan");
  // which cells are lit, line by line: first and last, then the book's opening, then the first Medinan
  const k1 = interpolate(f, [44, 60], [0, 1], clamp) * (1 - interpolate(f, [atOpening - 8, atOpening + 6], [0, 1], clamp));
  const k2 = interpolate(f, [atOpening - 2, atOpening + 12], [0, 1], clamp) * (1 - interpolate(f, [atMedinan - 8, atMedinan + 6], [0, 1], clamp));
  const k3 = interpolate(f, [atMedinan - 2, atMedinan + 12], [0, 1], clamp);
  const light = (num: number) => Math.max(firstLast.has(num) ? k1 : 0, num === opening ? k2 : 0, num === firstMedinan ? k3 : 0);
  const anyLit = Math.max(k1, k2, k3);
  const rows = Math.ceil(byOrder.length / GRID.cols);
  const gridW = GRID.cols * GRID.cell + (GRID.cols - 1) * GRID.gap;
  return (
    <AbsoluteFill style={{ opacity: fadeOut(f, s.dur, OUT) }}>
      <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: SAFE.top + 40, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <Title lang={p.lang} f={f}>
          {w.orderTitle}
        </Title>
        <Rule opacity={fadeIn(f, 6)} lang={p.lang}>
          {w.orderRule}
        </Rule>
        <div style={{ opacity: fadeIn(f, 10) }}>
          <Legend lang={p.lang} />
        </div>
      </div>
      <div
        dir={fa ? "rtl" : "ltr"}
        style={{ position: "absolute", top: 560, left: (W - gridW) / 2, width: gridW, display: "grid", gridTemplateColumns: `repeat(${GRID.cols}, ${GRID.cell}px)`, gridAutoRows: `${GRID.cell}px`, gap: GRID.gap }}
      >
        {byOrder.map((s2, i) => {
          const appear = interpolate(f, [8 + i * 0.25, 8 + i * 0.25 + 14], [0, 1], { ...clamp, easing: easeOut });
          const l = light(s2.number);
          const color = s2.place === "meccan" ? C.brass : C.turquoise;
          return (
            <div
              key={s2.number}
              style={{
                display: "grid",
                placeItems: "center",
                borderRadius: 8,
                border: `1.5px solid ${color}`,
                background: `${color}${l > 0.5 ? "cc" : "26"}`,
                opacity: appear * (1 - anyLit * 0.55 + l * 0.55),
                transform: `scale(${(1 + 0.18 * l).toFixed(3)})`,
                boxShadow: l > 0 ? `0 0 ${(26 * l).toFixed(1)}px rgba(227,192,120,${(0.7 * l).toFixed(3)})` : "none",
                fontFamily: uiFont(p.lang),
                fontSize: 26,
                fontVariantNumeric: "lining-nums tabular-nums",
                color: l > 0.5 ? C.night : C.ink,
              }}
            >
              {digitsIn(p.lang, s2.number)}
            </div>
          );
        })}
      </div>
      <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: 560 + rows * (GRID.cell + GRID.gap) + 8, width: W, textAlign: "center", fontFamily: uiFont(p.lang), fontSize: 27, color: C.quiet, opacity: fadeIn(f, 30) }}>
        {w.orderLegend}
      </div>
    </AbsoluteFill>
  );
};

/* ---------- prostrations ---------- */

const Sajdas: React.FC<{ p: CountsProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const w = C_WORDS[p.lang];
  const atObligatory = lineAt(s, "obligatory", s.dur * 0.5);
  const k = interpolate(f, [atObligatory - 4, atObligatory + 12], [0, 1], { ...clamp, easing: easeInOut });
  const ref = (sura: number, aya: number) => (fa ? `${faNum(sura)}:${faNum(aya)}` : `${sura}:${aya}`);
  return (
    <AbsoluteFill style={{ opacity: fadeOut(f, s.dur, OUT) }}>
      <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: SAFE.top + 20, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, opacity: fadeIn(f, 2), transform: `translateY(${rise(f, 2)}px)` }}>
          <span style={{ fontFamily: uiFont(p.lang), fontWeight: 500, fontSize: fa ? 150 : 170, lineHeight: 1, color: C.brass, fontVariantNumeric: "lining-nums" }}>{numIn(p.lang, count(f, 4, n1(p, "places"), 30))}</span>
          <span style={{ fontFamily: uiFont(p.lang), fontSize: fa ? 52 : 58, color: C.ink }}>{w.sajdaTitle}</span>
        </div>
        <Rule opacity={fadeIn(f, 8)} lang={p.lang}>
          {w.sajdaRule}
        </Rule>
      </div>
      <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: 570, left: 120, width: W - 240, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {p.sajdas.map((x, i) => {
          const s2 = p.surahs[x.sura - 1];
          const ob = x.type === "obligatory";
          const appear = interpolate(f, [12 + i * 2.5, 12 + i * 2.5 + 14], [0, 1], { ...clamp, easing: easeOut });
          const lit = ob ? k : 0;
          return (
            <div
              key={`${x.sura}:${x.aya}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "8px 6px 6px",
                borderRadius: 14,
                border: `1.5px solid ${C.gold}${ob ? "" : "99"}`,
                background: lit > 0 ? `rgba(224,172,79,${(0.85 * lit).toFixed(3)})` : "rgba(243,234,214,0.04)",
                opacity: appear * (1 - 0.45 * k * (ob ? 0 : 1)),
                boxShadow: lit > 0 ? `0 0 ${(28 * lit).toFixed(1)}px rgba(227,192,120,${(0.6 * lit).toFixed(3)})` : "none",
              }}
            >
              <span dir="ltr" style={{ fontFamily: uiFont(p.lang), fontSize: fa ? 34 : 38, lineHeight: 1.25, fontVariantNumeric: "lining-nums", color: lit > 0.5 ? C.night : C.ink }}>
                {ref(x.sura, x.aya)}
              </span>
              {s2 ? (
                <span lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 30, lineHeight: 1.45, color: lit > 0.5 ? C.night : C.star }}>
                  {s2.nameArabic}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: 1268, width: W, display: "flex", justifyContent: "center", gap: 40, fontFamily: uiFont(p.lang), fontSize: 30, color: C.quiet, opacity: fadeIn(f, atObligatory) }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 22, height: 22, borderRadius: 5, background: C.brass, display: "inline-block" }} />
          {`${w.obligatory} · ${numIn(p.lang, n1(p, "obligatory"))}`}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 22, height: 22, borderRadius: 5, border: `1.5px solid ${C.gold}99`, display: "inline-block" }} />
          {`${w.recommended} · ${numIn(p.lang, n1(p, "places") - n1(p, "obligatory"))}`}
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- divisions ---------- */

const Divisions: React.FC<{ p: CountsProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const w = C_WORDS[p.lang];
  const cells: Array<[number, string]> = [
    [p.divisions.surahs, w.surahs],
    [p.divisions.juz, w.parts],
    [p.divisions.rukus, w.sections],
    [p.divisions.pages, w.pages],
  ];
  return (
    <AbsoluteFill dir={fa ? "rtl" : "ltr"} style={{ alignItems: "center", justifyContent: "center", paddingTop: 80, paddingBottom: 420, opacity: fadeOut(f, s.dur, OUT) }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        <Title lang={p.lang} f={f}>
          {w.divisionsTitle}
        </Title>
        <Rule opacity={fadeIn(f, 8)} lang={p.lang}>
          {w.divisionsRule}
        </Rule>
        <div style={{ height: 30 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 380px)", gap: "46px 40px" }}>
          {cells.map(([value, label], i) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: fadeIn(f, 14 + i * 8), transform: `translateY(${rise(f, 14 + i * 8)}px)` }}>
              <div style={{ fontFamily: uiFont(p.lang), fontWeight: 500, fontSize: fa ? 130 : 150, lineHeight: 1, color: C.brass, fontVariantNumeric: "lining-nums tabular-nums" }}>{numIn(p.lang, count(f, 16 + i * 8, value, 40))}</div>
              <div style={{ fontFamily: uiFont(p.lang), fontSize: 42, color: C.ink }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- the sources ---------- */

const End: React.FC<{ p: CountsProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const t = L[p.lang];
  const w = C_WORDS[p.lang];
  const m = p.source.surahMetadata;
  const q = p.source.quran;
  const ui = uiFont(p.lang);
  const label = { fontFamily: ui, fontSize: 28, fontWeight: 600, letterSpacing: fa ? 0 : "0.16em", textTransform: fa ? "none" : "uppercase", color: C.gold } as const;
  const big = { fontFamily: FONT.en, fontSize: 38, color: C.ink, lineHeight: 1.3, textAlign: "center", maxWidth: 840, direction: "ltr" } as const;
  const small = { fontFamily: FONT.en, fontSize: 25, color: C.quiet, lineHeight: 1.35, textAlign: "center", maxWidth: 840, direction: "ltr" } as const;
  const said = s.lines[0];
  const block = (at: number, children: React.ReactNode) => (
    <div style={{ opacity: fadeIn(f, at), transform: `translateY(${rise(f, at, 16)}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>{children}</div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 40, paddingBottom: 1920 - SAFE.bottom - 40 }}>
      <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, width: 880 }}>
        <div style={{ opacity: fadeIn(f, 0, 18) }}>
          <SirajMark size={96} />
        </div>
        <div style={{ opacity: fadeIn(f, 4), fontFamily: ui, fontSize: fa ? 42 : 44, color: C.gold, letterSpacing: fa ? 0 : "0.1em" }}>{t.sources}</div>
        {block(
          10,
          <>
            <div style={label}>{t.countedFrom}</div>
            <div style={big}>{m.title}</div>
            <div style={small}>{[host(m.url, true), m.licenseName, m.copyrightNotice].filter(Boolean).join(" · ")}</div>
          </>,
        )}
        {block(
          18,
          <>
            <div style={label}>{t.quranText}</div>
            <div style={big}>{`${q.publisher}, ${host(q.canonicalUrl)}`}</div>
            <div style={small}>{`${q.sourceTitle} · ${q.licenseName}`}</div>
          </>,
        )}
        {block(
          26,
          <>
            <div style={label}>{t.rules}</div>
            <div style={{ fontFamily: ui, fontSize: fa ? 28 : 30, color: C.translation, lineHeight: fa ? 1.8 : 1.35, textAlign: "center", maxWidth: 840 }}>{w.rule[p.metric]}</div>
          </>,
        )}
        {said ? (
          <div style={{ opacity: fadeIn(f, said.from - s.from), fontFamily: ui, fontStyle: fa ? "normal" : "italic", fontSize: fa ? 30 : 33, color: C.ink, lineHeight: fa ? 1.8 : 1.35, textAlign: "center", maxWidth: 840 }}>{said.show}</div>
        ) : null}
        <div style={{ opacity: fadeIn(f, 36), display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 4 }}>
          <div style={{ fontFamily: FONT.en, fontSize: 44, color: C.gold, letterSpacing: "0.04em", direction: "ltr" }}>{SITE}</div>
          {p.voice.lines.length ? <div style={{ fontFamily: ui, fontSize: fa ? 26 : 27, color: C.quiet }}>{t.voiceFacts}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** The narration sentence on screen, while it is spoken. */
export const Subtitle: React.FC<{ text: string; len: number; lang: Lang }> = ({ text, len, lang }) => {
  const f = useCurrentFrame();
  const o = Math.min(fadeIn(f, 0, 8), fadeOut(f, len + ST.GAP - 2, 8));
  const fa = lang === "fa";
  return (
    <div style={{ position: "absolute", top: SAFE.bottom - 200, left: 0, width: W, display: "flex", justifyContent: "center", opacity: o }}>
      <Fit
        width={840}
        maxHeight={180}
        max={fa ? 38 : 40}
        min={24}
        measureKey={text}
        lang={lang}
        dir={fa ? "rtl" : "ltr"}
        style={{ fontFamily: uiFont(lang), fontWeight: 500, lineHeight: fa ? 1.8 : 1.35, textAlign: "center", textWrap: "balance", color: C.ink }}
      >
        {text}
      </Fit>
    </div>
  );
};

/** The narrated lines of a scene timeline: the voice, and the subtitle of every scene but the last. */
export const Narrated: React.FC<{ scenes: Scene[]; lang: Lang; subtitlesUntil: number }> = ({ scenes, lang, subtitlesUntil }) => (
  <>
    {scenes
      .slice(0, subtitlesUntil)
      .flatMap((s) => s.lines)
      .map((l) => (
        <Sequence key={`sub-${l.id}`} from={l.from} durationInFrames={l.len + ST.GAP} name={`subtitle ${l.id}`}>
          <Subtitle text={l.show} len={l.len} lang={lang} />
        </Sequence>
      ))}
    {scenes
      .flatMap((s) => s.lines)
      .map((l) =>
        l.file ? (
          <Sequence key={`v-${l.id}`} from={l.from} durationInFrames={l.len + 2} name={`voice ${l.id}`}>
            <Audio src={staticFile(l.file)} />
          </Sequence>
        ) : null,
      )}
  </>
);

const VIEWS = { total: Total, places: Places, chart: Chart, order: Order, sajdas: Sajdas, divisions: Divisions, end: End } as const;

export const CountsReel: React.FC<CountsProps> = (p) => {
  const t = countsTimeline(p);
  const f = useCurrentFrame();
  const endFrom = t.scenes[t.scenes.length - 1]!.from;
  const header = Math.min(fadeIn(f, 10, 18), fadeOut(f, endFrom, 12));
  const fa = p.lang === "fa";
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={t.total} seed={7 + p.metric.length} muted />
      <MushafFrame />
      <div
        dir={fa ? "rtl" : "ltr"}
        style={{ position: "absolute", top: SAFE.top - 30, width: W, textAlign: "center", fontFamily: uiFont(p.lang), fontSize: fa ? 36 : 34, fontWeight: 500, letterSpacing: fa ? 0 : "0.12em", textTransform: fa ? "none" : "uppercase", color: C.gold, opacity: header }}
      >
        {C_WORDS[p.lang].header}
      </div>
      {t.scenes.map((s) => {
        const View = VIEWS[s.id as keyof typeof VIEWS];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
            <View p={p} s={s} />
          </Sequence>
        );
      })}
      <Narrated scenes={t.scenes} lang={p.lang} subtitlesUntil={t.scenes.length - 1} />
    </AbsoluteFill>
  );
};
