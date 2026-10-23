// «Counts»: 114 surahs, 6,236 verses, Meccan and Medinan, the longest and the shortest, every
// number computed at build time from the Tanzil metadata the API exposes, each with its rule.
// The narration is fixed factual English written in scripts/fetch.mjs; the screen shows the
// same sentence (digits) as a subtitle.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Fit } from "./Fit";
import { L, host } from "./labels";
import { Divider, MushafFrame, Night, SirajMark } from "./ornament";
import type { CountsProps } from "./props";
import { C, FONT, SAFE, W, easeInOut, easeOut, enNum, fadeIn, fadeOut, frames, rise } from "./theme";

const IN = 12;
const LEAD = 10;
const GAP = 16;
const TAIL = 28;
const OUT = 12;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const SCENES: { id: string; lines: string[]; min: number }[] = [
  { id: "total", lines: ["total"], min: 150 },
  { id: "places", lines: ["places", "placeVerses"], min: 210 },
  { id: "chart", lines: ["longest", "shortest"], min: 240 },
  { id: "end", lines: ["end"], min: 180 },
];

/** Scenes and the moment each narration line starts, from the length of each voiced line. */
export function countsTimeline(p: CountsProps) {
  const byId = new Map((p.voice?.lines ?? []).map((l) => [l.id, l]));
  const say = new Map(p.narration.map((n) => [n.id, n]));
  let at = 0;
  const scenes = SCENES.map((s) => {
    let cursor = at + IN + LEAD;
    const lines = s.lines.map((id) => {
      const line = byId.get(id);
      const words = (say.get(id)?.say ?? "").split(/\s+/).filter(Boolean).length;
      const len = line ? frames(line.seconds) : Math.max(45, Math.ceil(words * 0.42 * 30));
      const item = { id, from: cursor, len, file: line?.file ?? null, show: say.get(id)?.show ?? "" };
      cursor += len + GAP;
      return item;
    });
    const dur = Math.max(s.min, cursor - GAP + TAIL + OUT - at);
    const scene = { id: s.id, from: at, dur, lines };
    at += dur;
    return scene;
  });
  return { scenes, total: at };
}

type Scene = ReturnType<typeof countsTimeline>["scenes"][number];

const count = (f: number, from: number, to: number, len = 42) => Math.round(interpolate(f, [from, from + len], [0, to], { ...clamp, easing: easeOut }));

const Rule: React.FC<{ children: React.ReactNode; opacity: number }> = ({ children, opacity }) => (
  <div style={{ fontFamily: FONT.en, fontStyle: "italic", fontSize: 31, color: C.quiet, textAlign: "center", maxWidth: 820, lineHeight: 1.35, opacity }}>{children}</div>
);

const Total: React.FC<{ p: CountsProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const out = fadeOut(f, s.dur, OUT);
  const num = { fontFamily: FONT.en, fontWeight: 500, color: C.brass, lineHeight: 1, fontVariantNumeric: "lining-nums tabular-nums" } as const;
  const unit = { fontFamily: FONT.en, fontSize: 62, color: C.ink, letterSpacing: "0.04em", marginTop: 6 } as const;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 110, paddingBottom: 420, opacity: out, willChange: "opacity" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{ opacity: fadeIn(f, 4), transform: `translateY(${rise(f, 4)}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ ...num, fontSize: 290 }}>{enNum(count(f, 6, p.totals.surahs, 40))}</div>
          <div style={unit}>surahs</div>
        </div>
        <Divider width={360} style={{ marginBlock: 22, opacity: fadeIn(f, 16) }} />
        <div style={{ opacity: fadeIn(f, 18), transform: `translateY(${rise(f, 18)}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ ...num, fontSize: 230 }}>{enNum(count(f, 20, p.totals.ayahs, 54))}</div>
          <div style={unit}>verses</div>
        </div>
        <div style={{ marginTop: 30 }}>
          <Rule opacity={fadeIn(f, 50)}>Kufan verse count, as in the Tanzil text</Rule>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Bar: React.FC<{ label: string; value: number; of: number; color: string; f: number; at: number; unit: string }> = ({ label, value, of, color, f, at, unit }) => {
  const g = interpolate(f, [at, at + 36], [0, 1], { ...clamp, easing: easeInOut });
  const full = 780;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: fadeIn(f, at - 4, 10) }}>
      <div style={{ display: "flex", justifyContent: "space-between", width: full, fontFamily: FONT.en, fontSize: 40, color: C.ink }}>
        <span>{label}</span>
        <span style={{ color, fontVariantNumeric: "lining-nums tabular-nums" }}>
          {enNum(Math.round(value * g))} <span style={{ fontSize: 30, color: C.quiet }}>{unit}</span>
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
  const out = fadeOut(f, s.dur, OUT);
  const second = (s.lines[1]?.from ?? s.from + 90) - s.from;
  const { meccan, medinan } = p.totals;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 110, paddingBottom: 420, opacity: out, willChange: "opacity" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <div style={{ opacity: fadeIn(f, 2), transform: `translateY(${rise(f, 2)}px)`, fontFamily: FONT.en, fontSize: 70, color: C.ink }}>Meccan and Medinan</div>
        <Rule opacity={fadeIn(f, 8)}>as labelled in the Tanzil metadata</Rule>
        <div style={{ height: 30 }} />
        <div style={{ fontFamily: FONT.en, fontSize: 30, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, width: 780, opacity: fadeIn(f, 12) }}>Surahs</div>
        <Bar label="Meccan" value={meccan.surahs} of={p.totals.surahs} color={C.brass} f={f} at={16} unit="surahs" />
        <Bar label="Medinan" value={medinan.surahs} of={p.totals.surahs} color={C.turquoise} f={f} at={26} unit="surahs" />
        <div style={{ height: 26 }} />
        <div style={{ fontFamily: FONT.en, fontSize: 30, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, width: 780, opacity: fadeIn(f, second - 6) }}>Verses</div>
        <Bar label="Meccan" value={meccan.ayahs} of={p.totals.ayahs} color={C.brass} f={f} at={second} unit="verses" />
        <Bar label="Medinan" value={medinan.ayahs} of={p.totals.ayahs} color={C.turquoise} f={f} at={second + 10} unit="verses" />
        <div style={{ height: 14 }} />
        <Rule opacity={fadeIn(f, second + 30)}>Scholars differ on the label of some surahs; these are the labels of the Tanzil metadata.</Rule>
      </div>
    </AbsoluteFill>
  );
};

const CHART = { left: 104, width: 798, base: 1200, height: 470 };
/** The callouts stand between the legend and the top of the tallest bar. */
const CALLOUT_TOP = 478;

const Chart: React.FC<{ p: CountsProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const out = fadeOut(f, s.dur, OUT);
  const n = p.surahs.length;
  const step = CHART.width / n;
  const max = p.totals.longest.ayahs;
  const second = (s.lines[1]?.from ?? s.from + s.dur / 2) - s.from;
  const showShort = interpolate(f, [second - 8, second + 8], [0, 1], { ...clamp, easing: easeInOut });
  const showLong = interpolate(f, [40, 56], [0, 1], clamp) * (1 - showShort);
  const longest = new Set(p.totals.longest.surahs);
  const shortest = new Set(p.totals.shortest.surahs);
  const lit = (num: number) => (longest.has(num) ? showLong : 0) + (shortest.has(num) ? showShort : 0);
  const anyLit = Math.max(showLong, showShort);
  const x = (num: number) => CHART.left + (num - 1) * step;
  const named = (nums: number[]) => nums.map((num) => p.surahs[num - 1]!);
  const longList = named(p.totals.longest.surahs);
  const shortList = named(p.totals.shortest.surahs);
  const surahWord = (k: number) => (k > 1 ? "Surahs" : "Surah");
  const andList = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
  const callout = (list: typeof longList, ayahs: number, opacity: number, align: "left" | "right") => {
    return (
      <div style={{ position: "absolute", top: CALLOUT_TOP, ...(align === "left" ? { left: CHART.left } : { right: W - CHART.left - CHART.width }), opacity, display: "flex", flexDirection: "column", alignItems: align === "left" ? "flex-start" : "flex-end", gap: 4 }}>
        <div style={{ fontFamily: FONT.en, fontSize: 46, color: C.ink }}>{`${surahWord(list.length)} ${andList(list.map((s2) => String(s2.number)))}`}</div>
        {/* each surah as number and name, in the order of the English line above */}
        <div dir="ltr" style={{ display: "flex", gap: 26, alignItems: "baseline" }}>
          {list.map((s2) => (
            <div key={s2.number} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontFamily: FONT.en, fontSize: 30, color: C.quiet, fontVariantNumeric: "lining-nums" }}>{s2.number}</span>
              <span lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 50, lineHeight: 1.5, color: C.star }}>
                {s2.nameArabic}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: FONT.en, fontSize: 46, color: C.brass, fontVariantNumeric: "lining-nums" }}>
          {`${enNum(ayahs)} verses${list.length > 1 ? " each" : ""}`}
        </div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ opacity: out, willChange: "opacity" }}>
      <div style={{ position: "absolute", top: SAFE.top + 70, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: fadeIn(f, 0) }}>
        <div style={{ fontFamily: FONT.en, fontSize: 64, color: C.ink }}>Verses in each surah</div>
        <div style={{ display: "flex", gap: 34, fontFamily: FONT.en, fontSize: 32, color: C.quiet }}>
          <span>
            <span style={{ display: "inline-block", width: 22, height: 22, borderRadius: 3, background: C.brass, marginRight: 10, verticalAlign: "-3px" }} />
            Meccan
          </span>
          <span>
            <span style={{ display: "inline-block", width: 22, height: 22, borderRadius: 3, background: C.turquoise, marginRight: 10, verticalAlign: "-3px" }} />
            Medinan
          </span>
        </div>
      </div>
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        {p.surahs.map((s2) => {
          const g = interpolate(f, [4 + s2.number * 0.22, 4 + s2.number * 0.22 + 24], [0, 1], { ...clamp, easing: easeOut });
          const h = Math.max(3, (s2.ayahCount / max) * CHART.height * g);
          const color = s2.place === "meccan" ? C.brass : C.turquoise;
          const l = lit(s2.number);
          return <rect key={s2.number} x={x(s2.number) + step * 0.14} y={CHART.base - h} width={step * 0.72} height={h} rx={1} fill={color} opacity={0.82 - anyLit * 0.5 + l * 0.68} />;
        })}
        {[...p.totals.longest.surahs.map((num) => ({ num, o: showLong })), ...p.totals.shortest.surahs.map((num) => ({ num, o: showShort }))].map(({ num, o }) => {
          const s2 = p.surahs[num - 1]!;
          const top = CHART.base - Math.max(3, (s2.ayahCount / max) * CHART.height) - 16;
          const cx = x(num) + step / 2;
          return <path key={`m${num}`} d={`M${cx} ${top}l-9 -16h18z`} fill={C.star} opacity={o} />;
        })}
        <line x1={CHART.left} x2={CHART.left + CHART.width} y1={CHART.base + 1} y2={CHART.base + 1} stroke={C.gold} strokeWidth={1.5} opacity={0.7} />
      </svg>
      <div style={{ position: "absolute", top: CHART.base + 16, left: CHART.left, width: CHART.width, display: "flex", justifyContent: "space-between", fontFamily: FONT.en, fontSize: 28, color: C.quiet, opacity: fadeIn(f, 6) }}>
        <span>1</span>
        <span>surahs in the order of the mushaf</span>
        <span>{n}</span>
      </div>
      {callout(longList, p.totals.longest.ayahs, showLong, "left")}
      {callout(shortList, p.totals.shortest.ayahs, showShort, "right")}
    </AbsoluteFill>
  );
};

const End: React.FC<{ p: CountsProps; s: Scene }> = ({ p }) => {
  const f = useCurrentFrame();
  const m = p.source.surahMetadata;
  const q = p.source.quran;
  const label = { fontFamily: FONT.en, fontSize: 28, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold } as const;
  const big = { fontFamily: FONT.en, fontSize: 40, color: C.ink, lineHeight: 1.3, textAlign: "center", maxWidth: 840 } as const;
  const small = { fontFamily: FONT.en, fontSize: 26, color: C.quiet, lineHeight: 1.35, textAlign: "center", maxWidth: 840 } as const;
  const block = (at: number, children: React.ReactNode) => (
    <div style={{ opacity: fadeIn(f, at), transform: `translateY(${rise(f, at, 16)}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>{children}</div>
  );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 40, paddingBottom: 1920 - SAFE.bottom - 40 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34, width: 880 }}>
        <div style={{ opacity: fadeIn(f, 0, 18) }}>
          <SirajMark size={104} />
        </div>
        <div style={{ opacity: fadeIn(f, 4), fontFamily: FONT.en, fontSize: 46, color: C.gold, letterSpacing: "0.1em" }}>{L.en.sources}</div>
        {block(
          10,
          <>
            <div style={label}>Counted from</div>
            <div style={big}>{m.title}</div>
            <div style={small}>{[host(m.url, true), m.licenseName, m.copyrightNotice].filter(Boolean).join(" · ")}</div>
          </>,
        )}
        {block(
          20,
          <>
            <div style={label}>{L.en.quranText}</div>
            <div style={big}>{`${q.publisher}, ${host(q.canonicalUrl)}`}</div>
            <div style={small}>{`${q.sourceTitle} · ${q.licenseName}`}</div>
          </>,
        )}
        {block(
          30,
          <>
            <div style={label}>Counting rules</div>
            <div style={{ ...small, fontSize: 30, color: C.translation }}>Kufan verse count, as in the Tanzil text. Meccan and Medinan as labelled in the Tanzil metadata.</div>
          </>,
        )}
        <div style={{ opacity: fadeIn(f, 40), display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 6 }}>
          <div style={{ fontFamily: FONT.en, fontSize: 46, color: C.gold, letterSpacing: "0.04em" }}>{L.en.site}</div>
          {p.voice?.lines?.length ? <div style={{ fontFamily: FONT.en, fontSize: 27, color: C.quiet }}>synthetic voice · it reads the narration</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** The narration sentence on screen, while it is spoken. */
const Subtitle: React.FC<{ text: string; len: number }> = ({ text, len }) => {
  const f = useCurrentFrame();
  const o = Math.min(fadeIn(f, 0, 8), fadeOut(f, len + GAP - 2, 8));
  return (
    <div style={{ position: "absolute", top: SAFE.bottom - 190, left: 0, width: W, display: "flex", justifyContent: "center", opacity: o }}>
      <Fit width={840} maxHeight={170} max={40} min={26} measureKey={text} lang="en" dir="ltr" style={{ fontFamily: FONT.en, fontWeight: 500, lineHeight: 1.35, textAlign: "center", textWrap: "balance", color: C.ink }}>
        {text}
      </Fit>
    </div>
  );
};

export const CountsReel: React.FC<CountsProps> = (p) => {
  const t = countsTimeline(p);
  const f = useCurrentFrame();
  const endFrom = t.scenes[t.scenes.length - 1]!.from;
  const header = Math.min(fadeIn(f, 10, 18), fadeOut(f, endFrom, 12));
  const view = { total: Total, places: Places, chart: Chart, end: End } as const;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Night glowY={0.4} />
      <MushafFrame />
      <div style={{ position: "absolute", top: SAFE.top - 30, width: W, textAlign: "center", fontFamily: FONT.en, fontSize: 34, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, opacity: header }}>
        The Quran · counts
      </div>
      {t.scenes.map((s) => {
        const View = view[s.id as keyof typeof view];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
            <View p={p} s={s} />
          </Sequence>
        );
      })}
      {t.scenes
        .filter((s) => s.id !== "end")
        .flatMap((s) => s.lines)
        .map((l) => (
          <Sequence key={`sub-${l.id}`} from={l.from} durationInFrames={l.len + GAP} name={`subtitle ${l.id}`}>
            <Subtitle text={l.show} len={l.len} />
          </Sequence>
        ))}
      {t.scenes
        .flatMap((s) => s.lines)
        .map((l) =>
          l.file ? (
            <Sequence key={`v-${l.id}`} from={l.from} name={`voice ${l.id}`}>
              <Audio src={staticFile(l.file)} />
            </Sequence>
          ) : null,
        )}
    </AbsoluteFill>
  );
};
