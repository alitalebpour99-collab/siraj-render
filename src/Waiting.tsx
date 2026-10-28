// The Persian templates that wait for Siraj's API (S3b) and the Mirror, built against the job
// props of scripts/waiting.mjs and switched off (never in the worker's CAN) until their texts are
// served:
//   fa-nahj-hikma  «حکمت n · نهج‌البلاغه»: the Arabic appears word by word, slowly; a brass line
//                  opens; the Persian is set word by word as the narrator reads it (lapis)
//   fa-kumayl      «شب جمعه · دعای کمیل · بند n»: a generated candle, a slow light over the
//                  Arabic, then the Persian read by the narrator (night)
//   fa-dua-story   «ذکر امروز · <weekday>»: a Story of about nine seconds, the day's dhikr and a
//                  ring that fills as it counts; silent or with the narrator (night)
//   fa-tafsir      «تفسیر نمونه · جلد v، ص p»: a carousel (-slide 1…5: the verse, then the
//                  record's paragraphs) and its silent Reel twin, the slides turning (lapis)
//   fa-occasion, en-occasion «بنا بر اعلام …»: the occasion's name and one line, very slow, no
//                  glow and no flashes (pewter)
//   en-mirror, fa-mirror «The Mirror»: a surah's ring of sections as bars that fold at the middle
//                  onto their pairs, the scholar and his work always on screen as «one reading»,
//                  the qari reciting the two paired verses, the narrator never over him (lapis)
// Each has <id>-cover (1080×1920) and <id>-grid (1080×1350, the 4:5 crop of the cover). Every
// string of a text is the job's or the API's, exactly as carried; the words here are interface
// words only. The narrator reads the Persian translation only, never the Arabic. No music, no
// sound effects, no figures: calligraphy, light and geometry.
import React from "react";
import { AbsoluteFill, Audio, Composition, Freeze, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { splitLeadingBasmala } from "./basmala";
import { Fit } from "./Fit";
import { SITE, host } from "./labels";
import { Lamp, World } from "./light";
import { AyahSeal, MushafFrame, Seal, SirajMark, starPath } from "./ornament";
import type { Ayah, Lang, MetadataSource, Narration, Qari, QariClip, Release, ScenePlan, Studio, TranslationSource, Voice } from "./props";
import { applyStudio, flags, mk } from "./studio";
import { C, FONT, FPS, H, W, arNum, easeInOut, easeOut, faNum } from "./theme";
import { ST, insightTimeline, type InsightScene, type InsightTimeline, type SceneLine } from "./timelines";
import { LitText } from "./Verse";
import { pieces, wordParts } from "./words";
import { SLIDE, TAFSIR_SLIDES, WAITING_LANGS, WAITING_LOOK, WBOX, scenesOf, type WaitingFormat } from "./waitingPlan";

/* ---------- props (scripts/waiting.mjs writes them) ---------- */

export type Weekday = "sat" | "sun" | "mon" | "tue" | "wed" | "thu" | "fri";
/** Where a text comes from: the book and its publisher (interface words), its page at the publisher and on Siraj. */
export type WaitSource = { title: string; publisher: string; url: string; siraj: string };
/** One line of a text as Siraj serves it: the Arabic and its Persian, verbatim. */
export type WaitLine = { number: number; arabic: string; persian: string };
/** A Nahj saying, a Kumayl passage (its lines) or the day's dhikr, read from Siraj in the run. */
export type WaitText = { kind: "nahj" | "kumayl" | "dhikr"; number: number | null; day: Weekday | null; lines: WaitLine[]; source: WaitSource; total?: number };
export type WaitSurah = { number: number; ayahCount: number; nameArabic: string; revelationPlace: "meccan" | "medinan"; revelationOrder: number };
/** Quran verses as Siraj's API served them in the run (the Mirror's pair, the tafsir's verse). */
export type WaitVerses = { surah: WaitSurah; from: number; to: number; ayahs: Ayah[]; opening: string | null; basmala: boolean; translation: TranslationSource | null };
/** The tafsir carousel: the ayahs (slide 1), three slides of whole sentences of the record as served, the record's work and where it is. */
export type WaitTafsir = { verse: WaitVerses | null; slides: string[]; work: { title: string; author: string }; source: { url: string | null; publisher: string; siraj: string } };
export type WaitOccasion = { authority: string; name: string; line: string; url: string | null };
export type WaitMirror = { surah: number; scholar: { name: string; work: string }; sections: Array<{ from: number; to: number }>; center: number; pair: [number, number] };

export type WaitingProps = {
  kind: "waiting";
  id: string;
  lang: Lang;
  format: WaitingFormat;
  scenes: ScenePlan[];
  narration: Narration[];
  text: WaitText | null;
  tafsir: WaitTafsir | null;
  occasion: WaitOccasion | null;
  mirror: WaitMirror | null;
  /** the verses the qari recites (the Mirror only) */
  recite: WaitVerses | null;
  /** no narrator, whatever voice was made (the tafsir carousel, a silent dhikr Story) */
  silent: boolean;
  /** the Quran text and metadata sources when the video shows a verse (their keys are null otherwise); the book's release */
  source: { quran: Omit<Partial<Release>, "releaseKey"> & { releaseKey: string | null }; surahMetadata: Omit<Partial<MetadataSource>, "sha256"> & { sha256: string | null }; text: { releaseKey: string } | null };
  /** the served strings' hashes (for the manifest) */
  texts: Array<{ locator: string; textHashSha256: string }>;
  voice: Voice;
  qari: Qari | null;
  studio: Partial<Studio> | null;
  facts: Record<string, unknown>;
};

type Prepared = WaitingProps & { studio: Studio };
type Box = readonly [number, number];
type VP = { p: Prepared; t: InsightTimeline; cover?: boolean };

const NO_VOICE: Voice = { engine: "none", voice: null, lines: [] };

/** The timeline of a waiting video: insightTimeline over the job's scenes (the qari only in «recite»). */
export function waitingTimeline(p: Pick<WaitingProps, "scenes" | "narration" | "voice" | "qari" | "silent" | "studio">): InsightTimeline {
  return insightTimeline({ scenes: p.scenes, narration: p.narration, voice: p.silent ? NO_VOICE : p.voice, qari: p.qari ?? null, loop: (p.studio?.ending ?? "loop") === "loop" });
}

/** The studio first (it sets the palette every component reads), the format's look when it names none. */
function prepared(raw: WaitingProps): Prepared {
  const muted = raw.format === "occasion";
  const studio = applyStudio({ ...(raw.studio ?? {}), look: muted ? "pewter" : (raw.studio?.look ?? WAITING_LOOK[raw.format]), ...(muted ? { motion: "calm" as const, particles: false } : {}) });
  return { ...raw, studio, qari: raw.qari ?? null, voice: raw.silent ? NO_VOICE : (raw.voice ?? NO_VOICE) };
}

/* ---------- small helpers ---------- */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const c01 = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (f: number, at: number, len = 30, ease = easeOut) => interpolate(f, [at, at + Math.max(1, mk(len))], [0, 1], { ...clamp, easing: ease });
const span01 = (f: number, a: number, b: number, ease = easeInOut) => interpolate(f, [a, Math.max(a + 1, b)], [0, 1], { ...clamp, easing: ease });
const ui = (lang: Lang) => (lang === "fa" ? FONT.fa : FONT.en);
const dIn = (lang: Lang, n: number) => (lang === "fa" ? faNum(n) : String(n));
const boxH = (b: Box) => b[1] - b[0];
const sceneOf = (t: InsightTimeline, id: string): InsightScene => t.scenes.find((s) => s.id === id) ?? { id, from: t.total, dur: 1, lines: [], clips: [] };
const seedOf = (p: WaitingProps) => 23 + p.format.length * 5 + (p.text?.number ?? p.text?.lines[0]?.number ?? p.mirror?.surah ?? p.tafsir?.verse?.surah.number ?? 0);

/* ---------- interface words (no sacred text, no translation) ---------- */

const WEEKDAY: Record<Weekday, string> = { sat: "شنبه", sun: "یکشنبه", mon: "دوشنبه", tue: "سه‌شنبه", wed: "چهارشنبه", thu: "پنجشنبه", fri: "جمعه" };
const WW = {
  en: {
    mirror: "The Mirror",
    oneReading: "One reading",
    surah: (n: number) => `Surah ${n}`,
    quranText: "Quran text",
    translation: "Translation",
    recitation: "Recitation",
    reading: "Reading",
    voice: "synthetic voice · it reads the narration only",
    plainVoice: "synthetic voice",
    announced: (who: string) => `As announced by ${who}`,
  },
  fa: {
    mirror: "آینه",
    oneReading: "یکی از خوانش‌ها",
    surah: (n: number) => `سورهٔ ${faNum(n)}`,
    quranText: "متن قرآن",
    translation: "ترجمه",
    recitation: "تلاوت",
    reading: "خوانش",
    voice: "صدای مصنوعی · فقط متن راوی را می‌خواند",
    plainVoice: "صدای مصنوعی",
    announced: (who: string) => `بنا بر اعلام ${who}`,
  },
};
const TR_VOICE = "صدای مصنوعی · فقط فارسی را می‌خواند";

/** The foot's source line: the service's spoken source line when the job has one (shown as said), else the book and its publisher. */
const sourceLine = (p: WaitingProps, s: WaitSource) => p.narration.find((l) => l.id === "src")?.show ?? `${s.title} · ${s.publisher}`;
/** An address as it is shown: without its scheme. */
const bare = (url: string) => url.replace(/^https?:\/\//, "");

/* ---------- type that moves ---------- */

/** A Persian line set word by word, each word at its own frame (rising out of a soft blur, or only fading in). */
const Kinetic: React.FC<{ text: string; f: number; at: number[]; color?: string; soft?: boolean }> = ({ text, f, at, color = C.ink, soft }) => (
  <>
    {pieces(text).map((part, i) => {
      if (part.word === null) return <React.Fragment key={i}>{part.text}</React.Fragment>;
      const o = c01((f - (at[part.word] ?? 0)) / mk(soft ? 16 : 7));
      return (
        <span
          key={i}
          style={{
            display: "inline-block",
            opacity: o,
            transform: soft ? undefined : `translateY(${((1 - o) * 16).toFixed(1)}px)`,
            filter: !soft && o < 1 ? `blur(${((1 - o) * 4).toFixed(1)}px)` : undefined,
            color,
          }}
        >
          {part.text}
        </span>
      );
    })}
  </>
);

/** When each word of a narrated line appears (absolute frames): the voice's own word times when they line up, else spread over the line. */
function wordTimes(line: SceneLine): number[] {
  const count = pieces(line.show).filter((x) => x.word !== null).length;
  if (line.words && line.words.length === count) return line.words.map(([s]) => line.from + (s / 1000) * FPS - 3);
  return Array.from({ length: count }, (_, k) => line.from - 2 + (k / Math.max(1, count)) * line.len * 0.82);
}

/** A block of the frame, its content centred. */
const Block: React.FC<{ box: Box; children: React.ReactNode; style?: React.CSSProperties }> = ({ box, children, style }) => (
  <div style={{ position: "absolute", top: box[0], left: 0, width: W, height: boxH(box), display: "flex", alignItems: "center", justifyContent: "center", ...style }}>{children}</div>
);

/** The served translation in the narrator's lines, each word set as he says it. */
const Read: React.FC<{ lines: SceneLine[]; f: number; box: Box; max?: number; soft?: boolean }> = ({ lines, f, box, max = 46, soft }) => {
  const text = lines.map((l) => l.show).join(" ");
  if (!text) return null;
  const at = lines.flatMap((l) => wordTimes(l));
  return (
    <Block box={box}>
      <Fit width={880} maxHeight={boxH(box)} max={max} min={24} measureKey={text} lang="fa" dir="rtl" style={{ fontFamily: FONT.fa, fontWeight: 500, lineHeight: 1.85, textAlign: "center", textWrap: "balance" }}>
        <Kinetic text={text} f={f} at={at} color={C.translation} soft={soft} />
      </Fit>
    </Block>
  );
};

/** The Arabic of a saying, its words appearing one after another, slowly. */
const SlowArabic: React.FC<{ text: string; f: number; at: (k: number) => number; len: number }> = ({ text, f, at, len }) => (
  <>
    {wordParts(text).parts.map((part, i) => {
      if (part.word === null) return <React.Fragment key={i}>{part.text}</React.Fragment>;
      const o = c01((f - at(part.word)) / len);
      return (
        <span key={i} style={{ opacity: o, textShadow: flags.glow && o > 0 ? `0 0 ${(10 + 24 * (1 - o)).toFixed(0)}px rgba(224,172,79,${(0.3 + 0.35 * (1 - o)).toFixed(2)})` : undefined }}>
          {part.text}
        </span>
      );
    })}
  </>
);

/** A narrated line in the caption zone (the Mirror), gone after it is said. */
const Caption: React.FC<{ line: SceneLine; f: number; lang: Lang }> = ({ line, f, lang }) => {
  const fa = lang === "fa";
  const end = line.from + line.len + ST.GAP;
  const o = Math.min(c01((f - line.from + 6) / 6), c01((end - f) / 8));
  if (o <= 0) return null;
  return (
    <Block box={WBOX.caption} style={{ opacity: o }}>
      <Fit width={860} maxHeight={boxH(WBOX.caption)} max={fa ? 44 : 50} min={26} measureKey={line.show} lang={lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: ui(lang), fontWeight: 500, lineHeight: fa ? 1.75 : 1.3, textAlign: "center", textWrap: "balance" }}>
        <Kinetic text={line.show} f={f} at={wordTimes(line)} />
      </Fit>
    </Block>
  );
};

/* ---------- the chip, the brass line, the foot ---------- */

const Chip: React.FC<{ lang: Lang; text: string; f: number }> = ({ lang, text, f }) => {
  const fa = lang === "fa";
  return (
    <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: WBOX.chip[0], left: 0, width: W, height: boxH(WBOX.chip), display: "flex", alignItems: "center", justifyContent: "center", opacity: c01((f + 10) / 10) }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "6px 26px", borderRadius: 999, border: `1.5px solid ${C.gold}88`, background: `${C.night}aa` }}>
        <Seal size={30} />
        <span style={{ fontFamily: ui(lang), fontSize: fa ? 31 : 29, lineHeight: 1.45, fontWeight: 500, letterSpacing: fa ? 0 : "0.14em", textTransform: fa ? "none" : "uppercase", color: C.gold, whiteSpace: "nowrap" }}>{text}</span>
      </div>
    </div>
  );
};

/** A brass hairline that opens from its star outwards (`k` 0–1). */
const BrassLine: React.FC<{ top: number; k: number; width?: number }> = ({ top, k, width = 560 }) => (
  <div style={{ position: "absolute", top, left: 0, width: W, height: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, opacity: c01(k * 3) }}>
    <div style={{ width: (width / 2) * k, height: 1.6, background: `linear-gradient(90deg, transparent, ${C.brass})` }} />
    <svg width={22} height={22} viewBox="0 0 30 30" style={{ transform: `rotate(${(k * 45).toFixed(1)}deg) scale(${(0.6 + 0.4 * k).toFixed(3)})` }}>
      <path d={starPath(15, 15, 13)} fill={C.brass} fillOpacity={0.3} stroke={C.brass} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
    <div style={{ width: (width / 2) * k, height: 1.6, background: `linear-gradient(90deg, ${C.brass}, transparent)` }} />
  </div>
);

/** The foot: the source line, and at the end the site and what the voice is. */
const Foot: React.FC<{ lang: Lang; f: number; source: string; showAt: number; endAt: number; voice: string | null }> = ({ lang, f, source, showAt, endAt, voice }) => {
  const fa = lang === "fa";
  const [top] = WBOX.foot;
  const e = ramp(f, endAt, 18);
  return (
    <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top, left: (W - 880) / 2, width: 880, height: boxH(WBOX.foot), display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 200, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`, opacity: ramp(f, showAt - 6, 18) }} />
      <div style={{ height: 46, display: "flex", alignItems: "center", opacity: ramp(f, showAt, 20) }}>
        {source ? (
          <Fit width={880} maxHeight={44} max={26} min={17} measureKey={source} lang={lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: ui(lang), lineHeight: 1.6, textAlign: "center", color: C.quiet, whiteSpace: "nowrap" }}>
            {source}
          </Fit>
        ) : null}
      </div>
      <div style={{ fontFamily: FONT.en, fontSize: 30, lineHeight: 1.3, color: C.gold, letterSpacing: "0.04em", direction: "ltr", opacity: e }}>{SITE}</div>
      {voice ? <div style={{ fontFamily: ui(lang), fontSize: 21, lineHeight: 1.7, color: C.quiet, opacity: e }}>{voice}</div> : null}
    </div>
  );
};

/* ---------- the candle (generated: a flame and its light, no figure) ---------- */

const Candle: React.FC<{ f: number; lit: number; height: number }> = ({ f, lit, height }) => {
  // three slow clocks, so the flame never repeats in a way the eye can follow
  const fl = 0.5 * Math.sin(f / 4.1) + 0.3 * Math.sin(f / 2.3 + 1.7) + 0.2 * Math.sin(f / 7.9 + 0.6);
  const sy = 1 + 0.07 * fl;
  const sx = 1 - 0.035 * fl;
  const lean = 2.4 * Math.sin(f / 11 + 0.3) + 0.8 * fl;
  return (
    <svg width={(height * 160) / 230} height={height} viewBox="0 0 160 230">
      <defs>
        <radialGradient id="candle-halo">
          <stop offset="0%" stopColor="#ffe6b0" stopOpacity={0.55} />
          <stop offset="45%" stopColor="#f0c27a" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#f0c27a" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="candle-flame" cx="50%" cy="72%" r="62%">
          <stop offset="0%" stopColor="#fff8e4" />
          <stop offset="38%" stopColor="#ffd98a" />
          <stop offset="78%" stopColor="#f2a54a" />
          <stop offset="100%" stopColor="#e07a2a" stopOpacity={0.6} />
        </radialGradient>
        <linearGradient id="candle-wax" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#d9ccb0" />
          <stop offset="45%" stopColor="#f6eedc" />
          <stop offset="100%" stopColor="#bfae8c" />
        </linearGradient>
      </defs>
      {flags.glow ? <circle cx={80} cy={66} r={74} fill="url(#candle-halo)" opacity={lit * (0.8 + 0.2 * fl)} /> : null}
      <g transform={`translate(80 90) rotate(${lean.toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(-80 -90)`} opacity={lit}>
        <path d="M80 26 C 93 50, 99 68, 93 82 C 89 92, 71 92, 67 82 C 61 68, 67 50, 80 26 Z" fill="url(#candle-flame)" />
        <path d="M80 56 C 85 66, 87 75, 84 82 C 82 86, 78 86, 76 82 C 73 75, 75 66, 80 56 Z" fill="#fffaf0" opacity={0.92} />
      </g>
      <line x1={80} y1={86} x2={80} y2={100} stroke="#3a2a14" strokeWidth={2.4} strokeLinecap="round" />
      <rect x={58} y={98} width={44} height={116} rx={5} fill="url(#candle-wax)" opacity={0.92} />
      <path d="M58 106 Q 65 112 71 105 Q 80 99 89 107 Q 96 112 102 105" fill="none" stroke={C.gold} strokeOpacity={0.45} strokeWidth={1.1} />
      <rect x={58} y={98} width={44} height={116} rx={5} fill="none" stroke={C.gold} strokeOpacity={0.6} strokeWidth={1.2} />
      <rect x={42} y={212} width={76} height={9} rx={4.5} fill={C.gold} opacity={0.65} />
    </svg>
  );
};

/* ---------- the views ---------- */

/** حکمت نهج‌البلاغه: the Arabic word by word, the brass line, the Persian as the narrator reads it. */
const NahjView: React.FC<VP> = ({ p, t }) => {
  const f = useCurrentFrame();
  const x = p.text;
  if (!x) return null;
  const open = sceneOf(t, "open");
  const read = sceneOf(t, "read");
  const end = sceneOf(t, "end");
  const B = WBOX.nahj;
  const arabic = x.lines[0]?.arabic ?? "";
  const count = Math.max(1, wordParts(arabic).count);
  const step = Math.min(mk(16), Math.max(2, (open.dur - 56) / count));
  return (
    <AbsoluteFill>
      <Lamp warm={0.4 + 0.6 * ramp(f, open.from, 60)} cy={0.3} />
      <Chip lang="fa" f={f} text={`حکمت ${faNum(x.number ?? 0)} · نهج‌البلاغه`} />
      <Block box={B.arabic}>
        <Fit width={900} maxHeight={boxH(B.arabic)} max={78} min={30} measureKey={arabic} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.95, textAlign: "center", color: C.star, textWrap: "balance", whiteSpace: "pre-line" }}>
          <SlowArabic text={arabic.trim()} f={f} at={(k) => open.from + 8 + k * step} len={mk(22)} />
        </Fit>
      </Block>
      <BrassLine top={B.line[0]} k={span01(f, open.from + open.dur - 46, open.from + open.dur - 4)} />
      <Read lines={read.lines} f={f} box={B.persian} />
      <Foot lang="fa" f={f} source={sourceLine(p, x.source)} showAt={read.from} endAt={end.from} voice={p.voice.lines.length ? TR_VOICE : null} />
    </AbsoluteFill>
  );
};

/** شب جمعه · دعای کمیل: the candle is lit, a slow light passes over the Arabic, the Persian is read. */
const KumaylView: React.FC<VP> = ({ p, t }) => {
  const f = useCurrentFrame();
  const x = p.text;
  if (!x) return null;
  const candle = sceneOf(t, "candle");
  const end = sceneOf(t, "end");
  const B = WBOX.kumayl;
  const lit = span01(f, candle.from + 6, candle.from + 6 + mk(40));
  const first = x.lines[0]?.number ?? 1;
  const last = x.lines[x.lines.length - 1]?.number ?? first;
  const chip = first === last ? `شب جمعه · دعای کمیل · بند ${faNum(first)}` : `شب جمعه · دعای کمیل · بندهای ${faNum(first)} تا ${faNum(last)}`;
  const rest = end.lines.find((l) => l.id === "rest");
  const endIn = ramp(f, end.from + 4, 20);
  return (
    <AbsoluteFill>
      <Lamp warm={0.25 + 0.75 * lit} cy={0.25} />
      <Chip lang="fa" f={f} text={chip} />
      <div style={{ position: "absolute", top: B.candle[0], left: 0, width: W, height: boxH(B.candle), display: "flex", justifyContent: "center" }}>
        <Candle f={f} lit={lit} height={boxH(B.candle)} />
      </div>
      {x.lines.map((line, k) => {
        const s = sceneOf(t, `b${k + 1}`);
        const o = Math.min(ramp(f, s.from - 4, 16), 1 - ramp(f, s.from + s.dur - 14, 14));
        if (o <= 0) return null;
        const text = line.arabic.trim();
        const { count } = wordParts(text);
        const tr = s.lines[0];
        // the light passes word after word while the Persian is read, but it is only light: nobody recites
        const span = Math.max(30, (tr ? tr.from + tr.len - s.from : s.dur) - 18);
        const step = Math.max(2, span / Math.max(1, count));
        const sweep: QariClip = {
          id: `light-${k}`,
          ayah: null,
          file: "",
          seconds: s.dur / FPS,
          mode: "word",
          words: Array.from({ length: count }, (_, j) => ({ start: (8 + j * step) / FPS, end: (8 + (j + 1.8) * step) / FPS })),
          sirajWords: count,
          qfWords: count,
          verseKey: "",
        };
        return (
          <React.Fragment key={line.number}>
            <Block box={B.arabic} style={{ opacity: o }}>
              <Fit width={900} maxHeight={boxH(B.arabic)} max={68} min={30} measureKey={text} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.95, textAlign: "center", textWrap: "balance" }}>
                <LitText text={text} clip={sweep} t={(f - s.from) / FPS} />
              </Fit>
            </Block>
            <div style={{ opacity: o }}>
              <Read lines={s.lines} f={f} box={B.persian} max={44} />
            </div>
          </React.Fragment>
        );
      })}
      {f >= end.from ? (
        <div dir="rtl" style={{ position: "absolute", top: B.arabic[0], left: 0, width: W, height: B.persian[1] - B.arabic[0], display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, opacity: endIn }}>
          {rest ? (
            <Fit width={860} maxHeight={260} max={46} min={26} measureKey={rest.show} lang="fa" dir="rtl" style={{ fontFamily: FONT.fa, fontWeight: 500, lineHeight: 1.8, textAlign: "center", color: C.ink, textWrap: "balance" }}>
              <Kinetic text={rest.show} f={f} at={wordTimes(rest)} />
            </Fit>
          ) : null}
          <div style={{ width: 260, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }} />
          <Fit width={920} maxHeight={60} max={30} min={18} measureKey={x.source.siraj} lang="en" dir="ltr" style={{ fontFamily: FONT.en, lineHeight: 1.4, textAlign: "center", color: C.gold, whiteSpace: "nowrap", letterSpacing: "0.02em" }}>
            {bare(x.source.siraj)}
          </Fit>
        </div>
      ) : null}
      <Foot lang="fa" f={f} source={sourceLine(p, x.source)} showAt={candle.from + candle.dur - 10} endAt={end.from} voice={p.voice.lines.length ? TR_VOICE : null} />
    </AbsoluteFill>
  );
};

/** ذکر امروز: the day's dhikr and a ring that fills as it counts (a Story). */
const StoryView: React.FC<VP> = ({ p, t }) => {
  const f = useCurrentFrame();
  const x = p.text;
  if (!x) return null;
  const dh = sceneOf(t, "dhikr");
  const end = sceneOf(t, "end");
  const B = WBOX.story;
  const arabic = (x.lines[0]?.arabic ?? "").trim();
  const k = span01(f, dh.from + 12, dh.from + dh.dur - 24);
  const size = boxH(B.ring);
  const c = size / 2;
  const R = c - 40;
  const L = 2 * Math.PI * R;
  const full = interpolate(f, [end.from - 4, end.from + 10, end.from + 34], [0, 1, 0], clamp);
  const beads = 33;
  return (
    <AbsoluteFill>
      <Lamp warm={0.45 + 0.55 * k} cy={0.33} />
      <Chip lang="fa" f={f} text={`ذکر امروز · ${x.day ? WEEKDAY[x.day] : ""}`} />
      <div style={{ position: "absolute", top: B.ring[0], left: (W - size) / 2, width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={c} cy={c} r={R} fill="none" stroke={`${C.ink}22`} strokeWidth={14} />
          {Array.from({ length: beads }, (_, i) => {
            const a = -Math.PI / 2 + (i / beads) * Math.PI * 2;
            const on = k * beads > i;
            return <circle key={i} cx={c + Math.cos(a) * (R - 30)} cy={c + Math.sin(a) * (R - 30)} r={4.2} fill={on ? C.star : `${C.ink}33`} opacity={on ? 0.95 : 0.6} />;
          })}
          <circle
            cx={c}
            cy={c}
            r={R}
            fill="none"
            stroke={C.brass}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${(L * k).toFixed(1)} ${L.toFixed(1)}`}
            transform={`rotate(-90 ${c} ${c})`}
            style={{ filter: flags.glow ? `drop-shadow(0 0 ${(8 + 16 * full).toFixed(0)}px rgba(240,194,122,0.6))` : undefined }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
          <Seal size={120} turn={f * 0.3} />
        </div>
      </div>
      <Block box={B.arabic} style={{ opacity: ramp(f, dh.from, 14) }}>
        <Fit width={900} maxHeight={boxH(B.arabic)} max={84} min={36} measureKey={arabic} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.9, textAlign: "center", color: C.star, textShadow: flags.glow ? "0 0 22px rgba(240,194,122,0.4)" : undefined, textWrap: "balance" }}>
          {arabic}
        </Fit>
      </Block>
      <Read lines={dh.lines} f={f} box={B.persian} max={42} />
      <Foot lang="fa" f={f} source={sourceLine(p, x.source)} showAt={dh.from + 20} endAt={end.from} voice={p.voice.lines.length ? TR_VOICE : null} />
    </AbsoluteFill>
  );
};

/** مناسبت: the authority, the name, one line; very slow fades, no glow, no flashes. */
const OccasionView: React.FC<VP> = ({ p, t }) => {
  const f = useCurrentFrame();
  const o = p.occasion;
  if (!o) return null;
  const main = sceneOf(t, "main");
  const end = sceneOf(t, "end");
  const fa = p.lang === "fa";
  const w = WW[p.lang];
  const B = WBOX.occasion;
  const nameAt = main.lines.find((l) => l.id === "name")?.from ?? main.from + 30;
  const lineAt = main.lines.find((l) => l.id === "line")?.from ?? main.from + 150;
  const slow = (at: number) => span01(f, at, at + mk(50));
  const dir = fa ? "rtl" : "ltr";
  return (
    <AbsoluteFill>
      <Block box={B.authority} style={{ opacity: slow(main.from + 2) }}>
        <Fit width={880} maxHeight={boxH(B.authority)} max={36} min={22} measureKey={o.authority} lang={p.lang} dir={dir} style={{ fontFamily: ui(p.lang), lineHeight: 1.5, textAlign: "center", color: C.quiet }}>
          {w.announced(o.authority)}
        </Fit>
      </Block>
      <Block box={B.name} style={{ opacity: slow(nameAt - 12) }}>
        <Fit width={900} maxHeight={boxH(B.name)} max={96} min={44} measureKey={o.name} lang={p.lang} dir={dir} style={{ fontFamily: ui(p.lang), fontWeight: 700, lineHeight: fa ? 1.6 : 1.2, textAlign: "center", color: C.ink, textWrap: "balance" }}>
          {o.name}
        </Fit>
      </Block>
      <div style={{ position: "absolute", top: B.name[1] + 22, left: (W - 360) / 2, width: 360, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`, transform: `scaleX(${slow(nameAt + 20).toFixed(3)})` }} />
      <Block box={B.line} style={{ opacity: slow(lineAt - 8) }}>
        <Fit width={880} maxHeight={boxH(B.line)} max={46} min={26} measureKey={o.line} lang={p.lang} dir={dir} style={{ fontFamily: ui(p.lang), lineHeight: fa ? 1.85 : 1.35, textAlign: "center", color: C.translation, textWrap: "balance" }}>
          {o.line}
        </Fit>
      </Block>
      <Foot lang={p.lang} f={f} source={o.url ? host(o.url) : ""} showAt={main.from + 30} endAt={end.from} voice={p.voice.lines.length ? w.plainVoice : null} />
    </AbsoluteFill>
  );
};

/* ---------- the Mirror ---------- */

const pairColor = (level: number) => [C.brass, "#7fc7a1", "#78aae6", "#be96e6", C.turquoise, "#e6a3b4", "#c9c27a"][level % 7]!;

/** The sources of the Mirror: the Quran text, its translation, the qari, the reading. */
const MirrorEnd: React.FC<{ p: Prepared; s: InsightScene; f: number }> = ({ p, s, f }) => {
  const fa = p.lang === "fa";
  const w = WW[p.lang];
  const q = p.source.quran;
  const mr = p.mirror!;
  const label = { fontFamily: ui(p.lang), fontSize: 26, fontWeight: 600, letterSpacing: fa ? 0 : "0.16em", textTransform: fa ? "none" : "uppercase", color: C.gold } as const;
  const big = { fontFamily: FONT.en, fontSize: 32, color: C.ink, lineHeight: 1.3, textAlign: "center", maxWidth: 860, direction: "ltr" } as const;
  const own = { ...big, direction: fa ? "rtl" : "ltr", fontFamily: ui(p.lang) } as const;
  const block = (i: number, head: string, body: React.ReactNode) => (
    <div key={head} style={{ opacity: ramp(f, s.from + 4 + i * 5, 14), display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={label}>{head}</div>
      {body}
    </div>
  );
  const qari = p.qari?.reciter.name ?? null;
  const tr = p.recite?.translation ?? null;
  return (
    <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: WBOX.mirror.end[0], left: 0, width: W, height: boxH(WBOX.mirror.end), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
      <div style={{ opacity: ramp(f, s.from, 14) }}>
        <SirajMark size={84} />
      </div>
      {q.publisher ? block(0, w.quranText, <div style={big}>{`${q.publisher}, ${host(q.canonicalUrl ?? "")} · ${q.sourceTitle ?? ""}`}</div>) : null}
      {tr ? block(1, w.translation, <div style={own}>{tr.translatorName}</div>) : null}
      {qari ? block(2, w.recitation, <div style={{ ...big, color: C.gold }}>{`${qari} · Quran Foundation`}</div>) : null}
      {block(3, w.reading, <div style={own}>{`${mr.scholar.name} · ${mr.scholar.work}`}</div>)}
      <div style={{ opacity: ramp(f, s.from + 26, 14), display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ fontFamily: FONT.en, fontSize: 44, color: C.gold, letterSpacing: "0.04em", direction: "ltr" }}>{SITE}</div>
        {p.voice.lines.length ? <div style={{ fontFamily: ui(p.lang), fontSize: 24, color: C.quiet }}>{w.voice}</div> : null}
      </div>
    </div>
  );
};

/** One recited verse of the pair: its reference in its pair's colour, the Arabic lit as the qari recites it. */
const PairVerse: React.FC<{ p: Prepared; a: Ayah; box: Box; clip: QariClip | null; t0: number; f: number; color: string }> = ({ p, a, box, clip, t0, f, color }) => {
  const r = p.recite!;
  const fa = p.lang === "fa";
  const split = splitLeadingBasmala(r.surah.number, a.ayahNumber, a.text, r.opening);
  const text = split ? split.rest : a.text;
  return (
    <div style={{ position: "absolute", top: box[0], left: 0, width: W, height: boxH(box), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
      <div dir="ltr" style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: ui(p.lang), fontSize: 26, lineHeight: 1.3, color }}>
        <span style={{ display: "inline-block", width: 36, height: 10, borderRadius: 5, background: color }} />
        {`${dIn(p.lang, r.surah.number)}:${dIn(p.lang, a.ayahNumber)}`}
      </div>
      <Fit width={880} maxHeight={boxH(box) - 40} max={62} min={26} measureKey={text} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.85, textAlign: "center", textWrap: "balance" }}>
        <LitText text={text} clip={p.studio.wordGlow ? clip : null} t={(f - t0) / FPS} after={<AyahSeal label={fa ? faNum(a.ayahNumber) : arNum(a.ayahNumber)} font={fa ? FONT.fa : FONT.quran} />} />
      </Fit>
    </div>
  );
};

/** The Mirror: the sections as bars, the fold onto the pairs, the qari's two verses, the sources. */
const MirrorView: React.FC<VP> = ({ p, t, cover }) => {
  const f = useCurrentFrame();
  const mr = p.mirror;
  if (!mr) return null;
  const fa = p.lang === "fa";
  const w = WW[p.lang];
  const hook = sceneOf(t, "hook");
  const fold = sceneOf(t, "fold");
  const rec = sceneOf(t, "recite");
  const pair = sceneOf(t, "pair");
  const end = sceneOf(t, "end");
  const B = WBOX.mirror;
  const n = mr.sections.length;
  const m = mr.center;
  const at = (a: number) => mr.sections.findIndex((s) => a >= s.from && a <= s.to);
  const ia = at(mr.pair[0]);
  const ib = at(mr.pair[1]);

  // the fold (k), then the folded stack moves up to make room for the verses (c), then leaves (out)
  const k = span01(f, fold.from + 24, fold.from + 24 + Math.max(30, Math.min(mk(100), fold.dur - 60)));
  const c = ramp(f, rec.from - 6, 26, easeInOut);
  const hi = ramp(f, fold.from + fold.dur - 40, 24);
  const out = 1 - ramp(f, end.from - 4, 16);
  const top = B.bars[0] + 6;
  const step = Math.min(72, (boxH(B.bars) - 12) / n);
  const thick = Math.min(26, step * 0.46);
  const cy = top + m * step + step / 2;
  const shift = (m * step) / 2;
  const stepC = Math.min(step, (B.verses[0] - B.bars[0] - 20) / (m + 1));
  const thickC = Math.min(thick, stepC * 0.5);
  const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
  const geo = (j: number) => {
    const lower = j > m;
    const y0 = top + j * step + step / 2;
    const folded = lower ? cy + (y0 - cy) * Math.cos(Math.PI * k) : y0;
    const yk = folded + shift * k + (lower ? thick * 0.55 * k : 0);
    const row = lower ? 2 * m - j : j;
    const yc = B.bars[0] + 10 + row * stepC + stepC / 2 + (lower ? thickC * 0.55 : 0);
    const d = Math.abs(j - m);
    const width = (d === 0 ? 170 : 300 + ((d - 1) / Math.max(1, m - 1)) * 340) * (1 - 0.18 * c);
    const th = lerp(thick * (lower ? Math.max(0.08, Math.abs(Math.cos(Math.PI * k))) : 1) * (d === 0 ? 1.25 : 1), thickC * (d === 0 ? 1.2 : 1), c);
    return { y: lerp(yk, yc, c), width, th, d };
  };
  const label = lerp(28, Math.min(24, stepC * 0.72), c);
  const startSide = (j: number) => (j <= m) !== fa; // labels of the upper half on the reading's start side
  const axis = Math.sin(Math.PI * k) * 0.55;

  const clipOf = (a: number) => p.qari?.verses.find((v) => v.ayah === a) ?? null;
  const startOf = (a: number) => rec.clips.find((x) => x.ayah === a)?.from ?? rec.from + 16;
  const r = p.recite;
  const vIn = ramp(f, rec.from + 4, 16) * out;
  const lens = r ? r.ayahs.map((a) => a.text.length) : [1, 1];
  const share = Math.max(0.32, Math.min(0.68, (lens[0] ?? 1) / Math.max(1, (lens[0] ?? 1) + (lens[1] ?? 1))));
  const mid = Math.round(B.verses[0] + share * boxH(B.verses));
  const boxes: Box[] = [
    [B.verses[0], mid - 6],
    [mid + 6, B.verses[1]],
  ];
  const trAt = r ? r.ayahs.map((a, i) => (rec.clips.length ? startOf(a.ayahNumber) : rec.from + (i * rec.dur) / 2)) : [];

  return (
    <AbsoluteFill>
      <Lamp warm={0.4 + 0.6 * ramp(f, rec.from, 20) * out} cy={0.5} />
      <Chip lang={p.lang} f={f} text={w.mirror} />
      <Block box={B.surah} style={{ opacity: ramp(f, hook.from, 20) * out, gap: 22 }}>
        <span style={{ fontFamily: ui(p.lang), fontSize: 38, color: C.gold }}>{w.surah(mr.surah)}</span>
        {r ? (
          <span lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 56, lineHeight: 1.5, color: C.star }}>
            {r.surah.nameArabic}
          </span>
        ) : null}
      </Block>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: out, overflow: "visible" }}>
        {axis > 0.01 ? <line x1={150} x2={W - 150} y1={cy + shift * k} y2={cy + shift * k} stroke={C.gold} strokeWidth={1.2} strokeDasharray="6 8" opacity={axis} /> : null}
        {mr.sections.map((_, j) => {
          const g = geo(j);
          const appear = ramp(f, hook.from + 14 + j * 6, 14);
          const inPair = j === ia || j === ib;
          const dim = inPair || j === m ? 1 : 1 - 0.55 * hi;
          const color = g.d === 0 ? C.ink : pairColor(m - g.d);
          const pulse = g.d === 0 ? 0.85 + 0.15 * Math.sin(f / 8) : 1;
          return (
            <g key={j} opacity={appear * dim * (j > m ? lerp(1, 0.72, k) : 1) * pulse}>
              <rect x={(W - g.width) / 2} y={g.y - g.th / 2} width={g.width} height={g.th} rx={g.th / 2} fill={color} />
              {inPair && hi > 0 ? <rect x={(W - g.width) / 2 - 8} y={g.y - g.th / 2 - 6} width={g.width + 16} height={g.th + 12} rx={(g.th + 12) / 2} fill="none" stroke={C.star} strokeWidth={2} opacity={hi} /> : null}
            </g>
          );
        })}
      </svg>
      {mr.sections.map((s, j) => {
        const g = geo(j);
        const appear = ramp(f, hook.from + 18 + j * 6, 14);
        const inPair = j === ia || j === ib;
        const dim = inPair || j === m ? 1 : 1 - 0.55 * hi;
        const start = startSide(j);
        const edge = (W - g.width) / 2 - 18;
        const text = s.from === s.to ? dIn(p.lang, s.from) : `${dIn(p.lang, s.from)}–${dIn(p.lang, s.to)}`;
        return (
          <div
            key={`l${j}`}
            dir="ltr"
            style={{
              position: "absolute",
              top: g.y - label * 0.75,
              height: label * 1.5,
              ...(start ? { right: W - edge, textAlign: "right" as const } : { left: W - edge, textAlign: "left" as const }),
              width: 200,
              fontFamily: ui(p.lang),
              fontSize: label,
              lineHeight: 1.5,
              color: inPair && hi > 0.5 ? C.star : C.quiet,
              opacity: appear * dim * out,
              fontVariantNumeric: "lining-nums tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {text}
          </div>
        );
      })}
      {r
        ? r.ayahs.slice(0, 2).map((a, i) => (
            <div key={a.ayahNumber} style={{ opacity: vIn }}>
              <PairVerse p={p} a={a} box={boxes[i]!} clip={clipOf(a.ayahNumber)} t0={startOf(a.ayahNumber)} f={f} color={pairColor(m - Math.abs((i === 0 ? ia : ib) - m))} />
            </div>
          ))
        : null}
      {!cover && r
        ? r.ayahs.slice(0, 2).map((a, i) => {
            const from = trAt[i] ?? rec.from;
            const to = i === 0 && trAt[1] !== undefined ? trAt[1] : rec.from + rec.dur;
            const o = Math.min(c01((f - from) / 10), c01((to - f) / 10));
            return o > 0 && a.translation ? (
              <Block key={`t${a.ayahNumber}`} box={WBOX.caption} style={{ opacity: o }}>
                <Fit width={860} maxHeight={boxH(WBOX.caption)} max={fa ? 38 : 42} min={22} measureKey={a.translation} lang={p.lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: ui(p.lang), lineHeight: fa ? 1.8 : 1.35, textAlign: "center", color: C.translation, textWrap: "balance" }}>
                  {a.translation}
                </Fit>
              </Block>
            ) : null;
          })
        : null}
      {f >= end.from - 4 ? <MirrorEnd p={p} s={end} f={f} /> : null}
      {cover ? null : t.scenes.flatMap((s) => s.lines.map((l) => <Caption key={l.id} line={l} f={f} lang={p.lang} />))}
      <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: WBOX.foot[0], left: (W - 880) / 2, width: 880, height: boxH(WBOX.foot), display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: c01((f + 10) / 10) }}>
        <div style={{ width: 200, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }} />
        <Fit width={880} maxHeight={boxH(WBOX.foot) - 14} max={30} min={19} measureKey={`${mr.scholar.name}${mr.scholar.work}`} lang={p.lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: ui(p.lang), lineHeight: fa ? 1.7 : 1.35, textAlign: "center", color: C.ink, textWrap: "balance" }}>
          <span style={{ color: C.gold }}>{w.oneReading}</span>
          {` · ${mr.scholar.name}${fa ? "، " : ", "}`}
          <span style={{ fontStyle: fa ? "normal" : "italic" }}>{mr.scholar.work}</span>
        </Fit>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- the tafsir carousel ---------- */

/**
 * One slide of the carousel (1080×1350): 1 the ayahs with Makarem's Persian; 2–4 whole sentences of
 * the record, exactly as served (an ellipsis only after the last, when the commentary goes on);
 * 5 the work, its author as Siraj names them, and where the rest of it is.
 */
const TafsirPage: React.FC<{ p: Prepared; k: number; total: number }> = ({ p, k, total }) => {
  const x = p.tafsir;
  if (!x) return null;
  const v = x.verse;
  const S = SLIDE;
  const chip = v ? `${x.work.title} · ${v.from === v.to ? `آیهٔ ${faNum(v.from)}` : `آیه‌های ${faNum(v.from)} تا ${faNum(v.to)}`}` : x.work.title;
  const row = (b: Box): React.CSSProperties => ({ position: "absolute", top: b[0], left: 0, width: S.width, height: b[1] - b[0], display: "flex", alignItems: "center", justifyContent: "center" });
  const para = k >= 2 && k < total ? (x.slides[k - 2] ?? "") : "";
  const ref = v ? (v.from === v.to ? `آیهٔ ${faNum(v.from)}` : `آیه‌های ${faNum(v.from)}–${faNum(v.to)}`) : "";
  const arabic = v ? v.ayahs.map((a) => a.text).join(" ") : "";
  const persian = v ? v.ayahs.map((a) => a.translation).join(" ") : "";
  // slide 1 names the translation, the others the tafsir and its publisher
  const foot = k === 1 ? (v?.translation ? `ترجمهٔ ${v.translation.translatorName}` : "") : k < total ? `${x.work.title} · ${x.work.author}` : "";
  return (
    <div dir="rtl" style={{ position: "absolute", left: 0, top: 0, width: S.width, height: S.height }}>
      <div style={row(S.chip)}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "4px 24px", borderRadius: 999, border: `1.5px solid ${C.gold}88`, background: `${C.night}aa` }}>
          <Seal size={28} />
          <span style={{ fontFamily: FONT.fa, fontSize: 30, lineHeight: 1.45, color: C.gold, whiteSpace: "nowrap" }}>{chip}</span>
        </div>
      </div>
      {k === 1 && v ? (
        <>
          <div style={{ ...row(S.ref), gap: 18 }}>
            <span lang="ar" style={{ fontFamily: FONT.quran, fontSize: 46, lineHeight: 1.4, color: C.star }}>
              {v.surah.nameArabic}
            </span>
            <span style={{ fontFamily: FONT.fa, fontSize: 32, color: C.gold }}>{`· ${ref}`}</span>
          </div>
          <div style={row(S.arabic)}>
            <Fit width={900} maxHeight={boxH(S.arabic)} max={74} min={26} measureKey={arabic} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.9, textAlign: "center", color: C.star, textWrap: "balance" }}>
              {v.ayahs.map((a) => {
                const split = splitLeadingBasmala(v.surah.number, a.ayahNumber, a.text, v.opening);
                return (
                  <React.Fragment key={a.ayahNumber}>
                    {split ? (
                      <>
                        <span style={{ fontSize: "0.72em", color: C.gold }}>{split.basmala}</span>
                        <br />
                        {split.rest}
                      </>
                    ) : (
                      a.text
                    )}{" "}
                    <AyahSeal label={faNum(a.ayahNumber)} font={FONT.fa} />{" "}
                  </React.Fragment>
                );
              })}
            </Fit>
          </div>
          <div style={row(S.translation)}>
            <Fit width={880} maxHeight={boxH(S.translation)} max={42} min={22} measureKey={persian} lang="fa" dir="rtl" style={{ fontFamily: FONT.fa, lineHeight: 1.85, textAlign: "center", color: C.translation, textWrap: "balance" }}>
              {v.ayahs.map((a) => (
                <React.Fragment key={a.ayahNumber}>
                  {a.translation}
                  {v.ayahs.length > 1 ? <span style={{ color: C.gold }}>{` (${faNum(a.ayahNumber)}) `}</span> : null}
                </React.Fragment>
              ))}
            </Fit>
          </div>
        </>
      ) : null}
      {para ? (
        <div style={row(S.paragraph)}>
          <Fit width={900} maxHeight={boxH(S.paragraph)} max={42} min={24} measureKey={para} lang="fa" dir="rtl" style={{ fontFamily: FONT.fa, lineHeight: 1.95, textAlign: "justify", textAlignLast: "right", color: C.ink, whiteSpace: "pre-line" }}>
            {para}
          </Fit>
        </div>
      ) : null}
      {k === total ? (
        <div style={{ ...row(S.paragraph), flexDirection: "column", gap: 30 }}>
          <SirajMark size={96} />
          <div style={{ fontFamily: FONT.fa, fontSize: 64, fontWeight: 700, lineHeight: 1.4, color: C.star }}>{x.work.title}</div>
          <div style={{ fontFamily: FONT.fa, fontSize: 34, lineHeight: 1.6, color: C.ink, textAlign: "center", maxWidth: 860 }}>{x.work.author}</div>
          {x.source.url ? <div style={{ fontFamily: FONT.en, fontSize: 26, color: C.quiet, direction: "ltr" }}>{host(x.source.url)}</div> : null}
          <div style={{ width: 260, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }} />
          <div style={{ fontFamily: FONT.fa, fontSize: 36, lineHeight: 1.6, color: C.translation }}>ادامهٔ تفسیر این آیه‌ها در سراج</div>
          <div style={{ fontFamily: FONT.en, fontSize: 34, color: C.gold, letterSpacing: "0.02em", direction: "ltr" }}>{bare(x.source.siraj)}</div>
        </div>
      ) : null}
      <div style={{ ...row(S.mark), fontFamily: FONT.fa, fontSize: 30, color: C.gold }}>{`${faNum(k)} از ${faNum(total)}${k < total ? " ←" : ""}`}</div>
      {foot ? (
        <div style={row(S.source)}>
          <Fit width={880} maxHeight={boxH(S.source)} max={24} min={16} measureKey={foot} lang="fa" dir="rtl" style={{ fontFamily: FONT.fa, lineHeight: 1.5, textAlign: "center", color: C.quiet, whiteSpace: "nowrap" }}>
            {foot}
          </Fit>
        </div>
      ) : null}
      <div style={{ ...row(S.site), fontFamily: FONT.en, fontSize: 28, color: C.gold, letterSpacing: "0.04em", direction: "ltr" }}>{SITE}</div>
    </div>
  );
};

/** The carousel's silent Reel twin: each slide stands in the 4:5 crop, then turns to the next. */
const TafsirReel: React.FC<VP> = ({ p, t }) => {
  const f = useCurrentFrame();
  const n = t.scenes.length;
  let pos = 0;
  t.scenes.forEach((s, i) => {
    if (i < n - 1) pos += span01(f, s.from + s.dur - 20, s.from + s.dur);
  });
  return (
    <AbsoluteFill style={{ clipPath: "inset(0 64px)" }}>
      {t.scenes.map((s, j) => {
        const d = j - pos;
        if (Math.abs(d) >= 1) return null;
        return (
          <div key={s.id} style={{ position: "absolute", top: SLIDE.top, left: 0, width: SLIDE.width, height: SLIDE.height, transform: `perspective(1800px) translateX(${(d * W).toFixed(1)}px) rotateY(${(-d * 10).toFixed(2)}deg)`, opacity: 1 - Math.abs(d) * 0.5 }}>
            <TafsirPage p={p} k={j + 1} total={n} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const VIEWS: Record<WaitingFormat, React.FC<VP>> = { "nahj-hikma": NahjView, kumayl: KumaylView, "dua-story": StoryView, tafsir: TafsirReel, occasion: OccasionView, mirror: MirrorView };

/* ---------- the reel, the covers, the slides ---------- */

const LoopIn: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: c01((f + 1) / frames), background: C.night }}>{children}</AbsoluteFill>;
};

export const WaitingReel: React.FC<WaitingProps> = (raw) => {
  const p = prepared(raw);
  const t = waitingTimeline(p);
  const View = VIEWS[p.format];
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={t.total} seed={seedOf(p)} muted={p.format !== "mirror"} />
      {p.studio.frame ? <MushafFrame /> : null}
      <View p={p} t={t} />
      {t.loopFrames ? (
        <Sequence from={t.total - t.loopFrames} durationInFrames={t.loopFrames} name="loop">
          <LoopIn frames={t.loopFrames}>
            <Freeze frame={0}>
              <View p={p} t={t} />
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

/** The frame a cover shows: everything in place (the Mirror folded, with its pair and their verses). */
function settledFrame(p: WaitingProps, t: InsightTimeline) {
  if (p.format === "mirror") return sceneOf(t, "pair").from + 24;
  return Math.min(t.total - 1, sceneOf(t, "end").from + 36);
}

/** The cover (1080×1920) is the settled frame of the Reel; the grid (1080×1350) is its 4:5 crop. */
export const WaitingCover: React.FC<WaitingProps> = (raw) => {
  const p = prepared(raw);
  const t = waitingTimeline(p);
  const { height } = useVideoConfig();
  const tall = height > 1500;
  const View = VIEWS[p.format];
  const slides = TAFSIR_SLIDES;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={1} still seed={seedOf(p)} />
      {p.studio.frame ? <MushafFrame drawn inset={tall ? 30 : 26} /> : null}
      <div style={{ position: "absolute", left: 0, top: tall ? 0 : -SLIDE.top, width: W, height: H }}>
        {p.format === "tafsir" ? (
          <div style={{ position: "absolute", left: 0, top: SLIDE.top, width: SLIDE.width, height: SLIDE.height }}>
            <Lamp warm={0.6} cy={0.42} />
            <TafsirPage p={p} k={1} total={slides} />
          </div>
        ) : (
          <Freeze frame={settledFrame(p, t)}>
            <View p={p} t={t} cover />
          </Freeze>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** A slide of the tafsir carousel (1080×1350), `slide` 1…5. */
export const TafsirSlide: React.FC<WaitingProps & { slide?: number }> = (raw) => {
  const p = prepared(raw);
  const total = TAFSIR_SLIDES;
  const k = Math.max(1, Math.min(total, raw.slide ?? 1));
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={1} still seed={seedOf(p) + k} />
      {p.studio.frame ? <MushafFrame drawn inset={26} /> : null}
      <Lamp warm={0.6} cy={0.42} />
      <TafsirPage p={p} k={k} total={total} />
    </AbsoluteFill>
  );
};

/* ---------- the compositions ---------- */

const emptyWaiting = (lang: Lang, format: WaitingFormat): WaitingProps => ({
  kind: "waiting",
  id: "",
  lang,
  format,
  scenes: scenesOf(format, 1),
  narration: [],
  text: null,
  tafsir: null,
  occasion: null,
  mirror: null,
  recite: null,
  silent: format === "tafsir",
  source: { quran: { releaseKey: null }, surahMetadata: { sha256: null }, text: null },
  texts: [],
  voice: NO_VOICE,
  qari: null,
  studio: null,
  facts: {},
});

const REEL = { width: W, height: H, fps: FPS };
const GRID = { width: SLIDE.width, height: SLIDE.height, fps: FPS };
const FORMATS = Object.keys(WAITING_LANGS) as WaitingFormat[];

/** The compositions of the waiting templates: <lang>-<format>, its -cover and -grid, and the tafsir's -slide. */
export const WaitingCompositions: React.FC = () => (
  <>
    {FORMATS.flatMap((format) =>
      WAITING_LANGS[format].map((lang) => (
        <React.Fragment key={`${lang}-${format}`}>
          <Composition
            id={`${lang}-${format}`}
            component={WaitingReel}
            {...REEL}
            durationInFrames={300}
            defaultProps={emptyWaiting(lang, format)}
            calculateMetadata={({ props }: { props: WaitingProps }) => ({ durationInFrames: Math.max(1, waitingTimeline(props).total) })}
          />
          <Composition id={`${lang}-${format}-cover`} component={WaitingCover} {...REEL} durationInFrames={1} defaultProps={emptyWaiting(lang, format)} />
          <Composition id={`${lang}-${format}-grid`} component={WaitingCover} {...GRID} durationInFrames={1} defaultProps={emptyWaiting(lang, format)} />
          {format === "tafsir" ? <Composition id={`${lang}-${format}-slide`} component={TafsirSlide} {...GRID} durationInFrames={1} defaultProps={{ ...emptyWaiting(lang, format), slide: 1 }} /> : null}
        </React.Fragment>
      )),
    )}
  </>
);
