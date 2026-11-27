// The ONE composition of Siraj's style «چراغ» (owner, 2026-11-20). It draws exactly what the
// storyboard says (scripts/chiragh/director.mjs): the title, the anchor's emerald line art with
// its camera, the verse whose words light up as the qari recites them (WordGlow), the narrator's
// line, the lamp with its breathing halo, the sources and the badge at the close. Every string
// of the Quran and of a translation is the API's own, exactly as served, cut only at its spaces.
// No music: only the qari and the narrator are placed.
import React, { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fontsReady } from "../fonts";
import { quoteHash } from "../lamp/zones";
import { ART } from "./art";
import { EmeraldLineArt } from "./LineArt";
import { cameraAt, drawProgress, ease, glowAmount, litAmount, shotAt, type Caption, type InlineArt, type Storyboard, type Verse } from "./storyboard";
import { FONT, GRID, INK } from "./tokens";

export type ChiraghProps = { storyboard: Storyboard | null; still?: number | null };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, k: number) => {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${A.map((x, i) => Math.round(x + (B[i]! - x) * clamp01(k))).join(",")})`;
};
const STAGE_H = GRID.stage.bottom - GRID.stage.top;
/** The source pill's row: low in the text zone, inside the safe area (the lower third carries the source). */
const PILL_TOP = GRID.safe.bottom - 96;
/** The text stack starts a little into the stage's soft lower edge (its mask fades there). */
const TEXT_TOP = GRID.text.top - 50;

export const artOf = (sb: Storyboard): InlineArt => sb.anchor.inline ?? (ART[sb.anchor.art] as InlineArt);

/** Where the camera looks: the region's centre at the stage's centre, zoomed to fit (× the shot's scale). */
function cameraTransform(art: InlineArt, region: string, scale: number) {
  const r = art.regions.find((x) => x.id === region) ?? art.regions[0]!;
  const fit = Math.min(1080 / r.w, STAGE_H / r.h);
  const z = Math.max(0.96, Math.min(art.labels ? 1.2 : 1.45, Math.min(fit, 1.3) * scale));
  // the camera leans towards a region but keeps the anchor near the column (one centred grid)
  const all = art.regions[0]!;
  // a data drawing (a strip, the surahs' map) stays whole on screen: the camera only leans towards a region
  const lean = art.labels ? 0.3 : 0.75;
  const fx = lean * (r.x + r.w / 2) + (1 - lean) * (all.x + all.w / 2);
  const fy = lean * (r.y + r.h / 2) + (1 - lean) * (all.y + all.h / 2);
  return { z, tx: GRID.colX - fx * z, ty: STAGE_H / 2 - fy * z };
}

/* ---------------- the stage per verse ---------------- */

/** The stage's treatments, by verse (in turn): whole · close on the crown · wide with an echo. */
const TREATMENTS = [
  { zoom: 1, dx: 0, dy: 0, echo: 0 },
  { zoom: 1.3, dx: 0, dy: 95, echo: 0.07 },
  { zoom: 0.84, dx: 0, dy: -8, echo: 0.13 },
] as const;
type Treatment = { zoom: number; dx: number; dy: number; echo: number };
const lerpT = (a: Treatment, b: Treatment, k: number): Treatment => ({ zoom: a.zoom + (b.zoom - a.zoom) * k, dx: a.dx + (b.dx - a.dx) * k, dy: a.dy + (b.dy - a.dy) * k, echo: a.echo + (b.echo - a.echo) * k });

/** The verse (its order) whose text is on screen at t, and when it came: the treatment follows the verse, not the shot. */
export function stageTreatment(sb: Pick<Storyboard, "shots" | "verses">, t: number): Treatment {
  let cur = -1;
  let since = 0;
  let prev = -1;
  for (const s of sb.shots) {
    if (s.start > t + 1e-6) break;
    if (s.text.layer !== "verse") continue;
    const vi = sb.verses.findIndex((v) => v.id === s.text.ref);
    if (vi < 0 || vi === cur) continue;
    prev = cur;
    cur = vi;
    since = s.start;
  }
  const at = (i: number): Treatment => (i < 0 ? TREATMENTS[0] : TREATMENTS[i % TREATMENTS.length]!);
  return lerpT(at(prev), at(cur), ease((t - since) / 1.4));
}

/* ---------------- the verse with its word light ---------------- */

const fitSize = (words: number) => (words <= 4 ? 92 : words <= 7 ? 80 : words <= 10 ? 70 : words <= 14 ? 62 : 56);

const Seal: React.FC<{ label: string; size: number }> = ({ label, size }) => (
  <span style={{ display: "inline-flex", position: "relative", width: size * 0.9, height: size * 0.9, verticalAlign: "middle", margin: "0 10px" }}>
    <svg viewBox="-50 -50 100 100" width={size * 0.9} height={size * 0.9} style={{ position: "absolute", inset: 0 }}>
      <path d="M0 -46L13 -31L33 -33L31 -13L46 0L31 13L33 33L13 31L0 46L-13 31L-33 33L-31 13L-46 0L-31 -13L-33 -33L-13 -31Z" fill="none" stroke={INK.emerald} strokeWidth={4} />
    </svg>
    <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.quran, fontSize: size * 0.38, color: INK.emeraldDeep, lineHeight: 1 }}>{label}</span>
  </span>
);

export const WordGlow: React.FC<{ v: Verse; t: number; lang: string }> = ({ v, t, lang }) => {
  let ci = 0;
  v.chunks.forEach((c, i) => {
    if (c.from <= t + 1e-6) ci = i;
  });
  const chunk = v.chunks[ci]!;
  const last = ci === v.chunks.length - 1;
  const size = v.ayah === null ? 64 : fitSize(chunk.words.length);
  const parts = chunk.text.split(/(\s+)/u).filter((p) => p.length > 0);
  let w = 0;
  const lit = (k: number) => (v.mode === "word" ? litAmount(chunk.words[k] ?? { text: "", start: 1e9, end: 1e9 }, t) : clamp01((t - chunk.from) / 0.2));
  const glow = (k: number) => (v.mode === "word" ? glowAmount(chunk.words[k] ?? { text: "", start: 1e9, end: 1e9 }, t) : 0);
  // the chunk comes in softly when it follows another of the same ayah
  const enter = ci === 0 ? 1 : ease((t - chunk.from + 0.15) / 0.3);
  return (
    <div data-q={`${v.id}:${ci}`} data-role="verse" dir="rtl" lang="ar" style={{ fontFamily: FONT.quran, fontSize: size, lineHeight: 1.8, textAlign: "center", color: INK.waiting, opacity: enter, transform: `translateY(${(1 - enter) * 14}px)` }}>
      {parts.map((p, i) => {
        if (/^\s+$/u.test(p)) return <span key={i}>{p}</span>;
        const k = w++;
        const g = glow(k);
        return (
          <span
            key={i}
            data-w={`${v.id}:${ci}:${k}`}
            style={{ display: "inline-block", padding: "0 1px", borderRadius: 18, backgroundImage: g > 0.01 ? `radial-gradient(closest-side, rgba(236,186,92,${(0.42 * g).toFixed(2)}), rgba(236,186,92,0))` : undefined, color: mix(INK.waiting, INK.emeraldDeep, lit(k)), transform: g > 0.01 ? `translateY(${(-6 * g).toFixed(1)}px) scale(${(1 + 0.07 * g).toFixed(3)})` : undefined, textShadow: g > 0.01 ? `0 0 ${Math.round(26 * g)}px rgba(217,164,65,${(0.75 * g).toFixed(2)})` : "none" }}
          >
            {p}
          </span>
        );
      })}
      {last && v.seal ? <Seal label={v.seal} size={size} /> : null}
    </div>
  );
};

const Translation: React.FC<{ v: Verse; t: number; lang: "en" | "fa" }> = ({ v, t, lang }) => {
  if (!v.transChunks.length) return null;
  let ci = 0;
  v.transChunks.forEach((c, i) => {
    if (c.from <= t + 1e-6) ci = i;
  });
  const c = v.transChunks[ci]!;
  const fa = lang === "fa";
  const n = c.text.split(/\s+/).length;
  // larger and readable (27 Nov: the lower third stood empty): the translation is the second voice of the verse
  const size = fa ? (n <= 14 ? 64 : n <= 24 ? 56 : 50) : n <= 14 ? 60 : n <= 24 ? 54 : 48;
  const parts = c.text.split(/(\s+)/u).filter((p) => p.length > 0);
  let k = 0;
  return (
    <div data-q={`${v.id}:t${ci}`} data-role="translation" dir={fa ? "rtl" : "ltr"} style={{ fontFamily: fa ? FONT.naskh : FONT.en, fontSize: size, lineHeight: 1.45, textAlign: "center", color: INK.translation, fontWeight: fa ? 500 : 500 }}>
      {parts.map((p, i) => {
        if (/^\s+$/u.test(p)) return <span key={i}>{p}</span>;
        const w = c.words?.[k++];
        const on = w ? clamp01((t - w.start + 0.05) / 0.12) : 1;
        return (
          <span key={i} style={{ color: mix("#6b5d48", INK.translation, w ? on : 1) }}>
            {p}
          </span>
        );
      })}
    </div>
  );
};

const RefChip: React.FC<{ text: string; lang: "en" | "fa" }> = ({ text, lang }) => (
  // never wider than the text zone (27 Nov: a long source ran off the pill); wrapped, balanced, isolated
  <div data-role="ref" dir={lang === "fa" ? "rtl" : "ltr"} style={{ display: "inline-block", maxWidth: 900, textWrap: "balance", unicodeBidi: "isolate", padding: "6px 26px", borderRadius: 999, background: INK.emeraldDeep, color: INK.cream, fontFamily: lang === "fa" ? FONT.fa : FONT.en, fontSize: 40, lineHeight: 1.35, fontWeight: lang === "fa" ? 600 : 500 }}>
    {text}
  </div>
);

/** A stack that never leaves the text zone: measured, and scaled down (from its top) when it is taller. */
const FitZone: React.FC<{ children: React.ReactNode; k: string }> = ({ children, k }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // measured again once the faces are in (a first layout in a fallback face is shorter)
  const [fonts, setFonts] = useState(0);
  useLayoutEffect(() => {
    let live = true;
    void fontsReady().then(() => live && setFonts(1));
    return () => {
      live = false;
    };
  }, []);
  const room = PILL_TOP - TEXT_TOP - 16;
  useLayoutEffect(() => {
    if (!ref.current) return;
    const h = ref.current.scrollHeight;
    const next = h > room ? Math.max(0.6, room / h) : 1;
    if (Math.abs(next - scale) > 0.005) setScale(next);
  }, [k, room, scale, fonts]);
  return (
    // the zone runs from under the drawing down to the pill row; the stack sits in its middle (no empty lower third)
    <div style={{ position: "absolute", top: TEXT_TOP, left: GRID.colX - GRID.colW / 2, width: GRID.colW, height: room, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div ref={ref} style={{ width: GRID.colW, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, transform: scale < 1 ? `scale(${scale.toFixed(3)})` : undefined, transformOrigin: "50% 50%" }}>
        {children}
      </div>
    </div>
  );
};

const VerseBlock: React.FC<{ v: Verse; t: number; lang: "en" | "fa" }> = ({ v, t, lang }) => {
  let ci = 0;
  v.chunks.forEach((c, i) => (c.from <= t + 1e-6 ? (ci = i) : null));
  let ti = 0;
  v.transChunks.forEach((c, i) => (c.from <= t + 1e-6 ? (ti = i) : null));
  return (
    <>
    <FitZone k={`${v.id}:${ci}:${ti}`}>
      <WordGlow v={v} t={t} lang={lang} />
      <Translation v={v} t={t} lang={lang} />
    </FitZone>
    {v.refLine ? (
      <div style={{ position: "absolute", top: PILL_TOP, left: GRID.colX - GRID.colW / 2, width: GRID.colW, display: "flex", justifyContent: "center" }}>
        <RefChip text={v.refLine} lang={lang} />
      </div>
    ) : null}
    </>
  );
};

const CaptionBlock: React.FC<{ c: Caption; t: number; lang: "en" | "fa" }> = ({ c, t, lang }) => {
  const fa = lang === "fa";
  const parts = c.text.split(/(\s+)/u).filter((p) => p.length > 0);
  const count = parts.filter((p) => !/^\s+$/u.test(p)).length;
  const n = count;
  const size = n <= 10 ? 58 : n <= 18 ? 52 : n <= 28 ? 46 : 42;
  let k = 0;
  return (
    <FitZone k={c.id}>
      <div data-q={c.id} data-role="caption" dir={fa ? "rtl" : "ltr"} style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: size, lineHeight: 1.6, fontWeight: fa ? 600 : 500, textAlign: "center", color: INK.ink }}>
        {parts.map((p, i) => {
          if (/^\s+$/u.test(p)) return <span key={i}>{p}</span>;
          const idx = k++;
          const w = c.words?.[idx];
          const start = w ? w.start : c.from + ((c.to - c.from) * idx) / Math.max(1, n);
          const on = clamp01((t - start + 0.05) / 0.15);
          const key = c.keyword && p.replace(/[«»"'.,،؛:!?؟]/g, "") === c.keyword;
          return (
            <span key={i} style={{ opacity: 0.22 + 0.78 * on, color: key ? INK.emerald : INK.ink, fontWeight: key ? 800 : undefined }}>
              {p}
            </span>
          );
        })}
      </div>
    </FitZone>
  );
};

/* ---------------- the lamp ---------------- */

const Lamp: React.FC<{ warm: number; flicker: number; rise: number }> = ({ warm, flicker, rise }) => {
  const { x, y, size } = GRID.lamp;
  return (
    <>
      <div style={{ position: "absolute", left: x - 460, top: y - 520 - rise * 260, width: 920, height: 920, borderRadius: "50%", opacity: clamp01(0.55 + 0.3 * warm + 0.35 * rise), background: "radial-gradient(circle, rgba(236,186,92,0.55) 0%, rgba(236,186,92,0.22) 26%, rgba(236,186,92,0.06) 48%, rgba(236,186,92,0) 64%)" }} />
      <svg width={size} height={size * 0.82} viewBox="0 0 120 98" style={{ position: "absolute", left: x - size / 2, top: y - size * 0.41, overflow: "visible" }}>
        <g transform={`translate(104 50) scale(1 ${(1 + 0.06 * flicker).toFixed(3)}) translate(-104 -50)`}>
          <path d="M104 50C97.5 43.5 98.5 33 105.5 21C111.5 32.5 112.5 43.5 106.5 50Z" fill={INK.flame} />
          <path d="M105 48C102.4 45 102.8 39.6 105.6 34.4C108.2 39.6 108.6 45 106.2 48Z" fill="#fffaf0" opacity={0.85} />
        </g>
        <g fill="none" stroke={INK.emerald} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 60C24 47 43 41.5 62 42.5C77 43.3 91 47.5 103 51.5C95 56 82 62.5 66 65.5C47 69 26 70 24 60Z" fill={INK.cream} />
          <path d="M44.5 43.6C47 40.6 55.5 40 59.5 42.6" />
          <path d="M25 55.5C13 51.5 7.5 63 15 67C18.5 69 22.5 66.5 25.5 64" />
          <path d="M48 67.5L44 79H74L70 66.2" />
          <path d="M38 83H80" />
        </g>
      </svg>
    </>
  );
};

/* ---------------- the measurements for the gate (numbers and hashes, never a text) ---------------- */

function luminance([r, g, b]: number[]) {
  const c = [r!, g!, b!].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const rgbOf = (s: string) => (s.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

const Probe: React.FC<{ root: React.RefObject<HTMLDivElement | null>; f: number; probe: boolean }> = ({ root, f, probe }) => {
  useLayoutEffect(() => {
    if (!probe || !root.current) return;
    // measured on the next animation frame: after the text zone has fitted itself (FitZone's second render)
    const hold = delayRender("probe");
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        continueRender(hold);
      }
    };
    const raf = requestAnimationFrame(() => {
      try {
        measure();
      } finally {
        finish();
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      finish();
    };
    function measure() {
    if (!root.current) return;
    const texts = [...root.current.querySelectorAll<HTMLElement>("[data-q],[data-role=ref],[data-role=title],[data-role=sub],[data-role=credits],[data-role=label]")].map((el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const op = Number(cs.opacity);
      return { q: el.dataset.q ?? null, role: el.dataset.role ?? null, h: quoteHash(el.textContent ?? ""), size: parseFloat(cs.fontSize), box: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)], contrast: Math.round(ratio(rgbOf(cs.color), el.dataset.role === "ref" ? hex(INK.emeraldDeep) : hex(INK.cream)) * 10) / 10, op };
    });
    const words = [...root.current.querySelectorAll<HTMLElement>("[data-w]")].map((el) => {
      const b = el.getBoundingClientRect();
      return { w: el.dataset.w, box: [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] };
    });
    console.log(`CHIRAGH_PROBE ${JSON.stringify({ f, texts, words })}`);
    }
  }, [f, probe, root]);
  return null;
};

/* ---------------- the composition ---------------- */

export const Chiragh: React.FC<ChiraghProps> = ({ storyboard: sb, still = null }) => {
  const now = useCurrentFrame();
  const { fps } = useVideoConfig();
  const root = useRef<HTMLDivElement>(null);
  if (!sb) return <AbsoluteFill style={{ background: INK.cream }} />;
  const f = still ?? now;
  const t = f / fps;
  const art = artOf(sb);
  const shot = shotAt(sb, t);
  const cam = cameraAt(sb, t);
  const a = cameraTransform(art, cam.prev.region, cam.prev.scale);
  const b = cameraTransform(art, cam.region, cam.scale);
  const k = cam.k;
  // the move to the shot's region, then a slow push around the stage's centre (never still)
  const z0 = a.z + (b.z - a.z) * k;
  const z = z0 * (1 + 0.025 * cam.breathe);
  const tx = GRID.colX - (GRID.colX - (a.tx + (b.tx - a.tx) * k)) * (z / z0);
  const ty = STAGE_H / 2 - (STAGE_H / 2 - (a.ty + (b.ty - a.ty) * k)) * (z / z0);
  // the stage changes per verse (27 Nov: «not the same arch every time»): the whole anchor, a close
  // view of its crown, a wide view with a large faint echo behind for depth; each verse eases into
  // its own over 1.4 s, and a slow drift runs under all of it
  const tr = stageTreatment(sb, t);
  const drift = { x: 10 * Math.sin(t / 4.7), y: 6 * Math.sin(t / 6.3 + 1) };
  const raw = drawProgress(sb, t);
  const progress = raw;
  // the loop: in the last second the drawing fades out as one (nothing flies apart) and the first text comes back, so the last frame is the first
  const artOp = t > sb.total - 1.0 ? ease((sb.total - t) / 1.0) : 1;
  const loopIn = ease((t - (sb.total - 0.6)) / 0.6);
  const speaking = sb.sounds.find((s) => t >= s.at && t < s.at + s.seconds);
  const warm = speaking?.who === "qari" ? 1 : speaking ? 0.5 : 0.2;
  const flicker = 0.6 * Math.sin(t * 7.1) + 0.4 * Math.sin(t * 12.7);
  // the lamp's light rises between two ayahs (the transition «lamp-rise»)
  let rise = 0;
  const idx = sb.shots.indexOf(shot);
  const prevShot = idx > 0 ? sb.shots[idx - 1] : null;
  if (shot.transition_out === "lamp-rise") rise = Math.max(rise, ease((t - (shot.start + shot.dur - 0.5)) / 0.5));
  if (prevShot?.transition_out === "lamp-rise") rise = Math.max(rise, 1 - ease((t - shot.start) / 0.45));
  // the text layer: the shot's, the previous one fading out over 0.25 s
  const layerOf = (s: typeof shot) => `${s.text.layer}:${s.text.ref ?? ""}`;
  // a new text comes in BEFORE its shot (0.45 s ahead), so a verse stands on screen before its first word is recited
  const LEAD = 0.45;
  const ahead = shotAt(sb, t + LEAD);
  const changing = ahead !== shot && layerOf(ahead) !== layerOf(shot);
  const lead = changing ? ease((t - (ahead.start - LEAD)) / 0.3) : 0;
  const fadeIn = 1;
  const textLayer = (s: typeof shot, op: number, tt: number = t) => {
    if (op <= 0.01) return null;
    if (s.text.layer === "verse") {
      const v = sb.verses.find((x) => x.id === s.text.ref);
      return v ? (
        <div key={`v-${v.id}`} style={{ opacity: op }}>
          <VerseBlock v={v} t={tt} lang={sb.lang} />
        </div>
      ) : null;
    }
    if (s.text.layer === "caption") {
      const c = sb.captions.find((x) => x.id === s.text.ref);
      return c ? (
        <div key={`c-${c.id}`} style={{ opacity: op }}>
          <CaptionBlock c={{ ...c, keyword: s.text.keyword ?? c.keyword }} t={tt} lang={sb.lang} />
        </div>
      ) : null;
    }
    // «title»: the hook is the title on top (from the first frame); the text zone leaves the drawing alone
    return null;
  };
  const fa = sb.lang === "fa";
  const end = sb.badge ? t >= sb.badge.from - 0.4 : false;
  const badgeOp = sb.badge ? Math.min(clamp01((t - sb.badge.from) / 0.3), clamp01((sb.badge.to - t) / 0.3)) : 0;
  const probe = still === null && (f % 15 === 0 || f === sb.total - 1 || sb.verses.some((v) => v.chunks.some((c) => Math.round(c.from * fps) + 2 === f) || v.transChunks.some((c) => Math.round(c.from * fps) + 9 === f)));
  const titleSize = sb.title.main.length > 34 ? 46 : sb.title.main.length > 24 ? 54 : sb.title.main.length > 18 ? 70 : 84;
  return (
    <AbsoluteFill ref={root} style={{ background: `linear-gradient(180deg, ${INK.cream} 0%, ${INK.cream} 55%, ${INK.cream2} 100%)` }}>
      {sb.sounds.map((s) => (
        <Sequence key={`${s.who}-${s.id}`} from={Math.round(s.at * fps)} durationInFrames={Math.max(1, Math.ceil(s.seconds * fps) + 2)}>
          <Audio src={staticFile(s.file)} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(120% 80% at 46% 40%, rgba(120,90,40,0) 60%, rgba(120,90,40,0.10) 100%)" }} />
      <Lamp warm={warm} flicker={flicker} rise={rise} />
      {/* the anchor on its stage, with the camera */}
      <div style={{ position: "absolute", left: 0, top: GRID.stage.top, width: 1080, height: STAGE_H, overflow: "hidden", opacity: artOp, WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 7%, #000 93%, transparent 100%)", maskImage: "linear-gradient(180deg, transparent 0%, #000 7%, #000 93%, transparent 100%)" }}>
        {tr.echo > 0.005 ? (
          <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: STAGE_H, opacity: tr.echo, transformOrigin: `${GRID.colX}px ${STAGE_H / 2}px`, transform: `translate(${(-drift.x * 1.6).toFixed(2)}px, ${(-drift.y * 1.6).toFixed(2)}px) scale(${(2.05 + 0.03 * Math.sin(t / 5)).toFixed(4)})` }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: STAGE_H, transformOrigin: "0 0", transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${z.toFixed(4)})` }}>
              <EmeraldLineArt art={art} progress={progress} height={STAGE_H} uid={`${sb.video_id.replace(/[^a-z0-9]/gi, "")}e`} flicker={0} />
            </div>
          </div>
        ) : null}
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: STAGE_H, transformOrigin: `${GRID.colX}px ${STAGE_H / 2}px`, transform: `translate(${(tr.dx + drift.x).toFixed(2)}px, ${(tr.dy + drift.y).toFixed(2)}px) scale(${tr.zoom.toFixed(4)})` }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: STAGE_H, transformOrigin: "0 0", transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${z.toFixed(4)})` }}>
            <EmeraldLineArt art={art} progress={progress} height={STAGE_H} uid={sb.video_id.replace(/[^a-z0-9]/gi, "")} flicker={flicker} />
          </div>
        </div>
      </div>
      {/* the title, from the first frame to the last */}
      <div style={{ position: "absolute", top: GRID.title.top, left: GRID.colX - GRID.colW / 2, width: GRID.colW, textAlign: "center" }} dir={fa ? "rtl" : "ltr"}>
        <div data-role="title" style={{ fontFamily: fa ? FONT.fa : FONT.en, fontWeight: fa ? 800 : 600, fontSize: titleSize, lineHeight: 1.22, color: INK.emeraldDeep, textWrap: "balance" }}>
          {sb.title.main}
        </div>
        <div data-role="sub" style={{ fontFamily: fa ? FONT.fa : FONT.en, fontWeight: fa ? 600 : 500, fontSize: 44, lineHeight: 1.35, color: INK.emeraldSoft }}>
          {sb.title.sub}
        </div>
      </div>
      {/* the text under the anchor */}
      {changing && !end ? textLayer(ahead, lead) : null}
      {textLayer(shot, end ? 1 - clamp01((t - (sb.badge!.from - 0.4)) / 0.3) : changing ? 1 - lead : fadeIn)}
      {loopIn > 0 ? textLayer(sb.shots[0]!, loopIn, 0) : null}
      {/* the close: the sources (one line), the badge */}
      {end ? (
        <div style={{ position: "absolute", top: GRID.text.top + 120, left: GRID.colX - GRID.colW / 2, width: GRID.colW, textAlign: "center", opacity: clamp01((t - (sb.badge!.from - 0.3)) / 0.3) * clamp01((sb.total - 0.6 - t) / 0.3) }}>
          <div data-role="credits" dir={fa ? "rtl" : "ltr"} style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: 40, lineHeight: 1.5, color: INK.quiet }}>
            {sb.credits}
          </div>
        </div>
      ) : null}
      {badgeOp > 0 ? (
        <div data-role="badge" dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", left: GRID.safe.left + 26, top: GRID.safe.bottom - 96, height: 72, display: "flex", alignItems: "center", gap: 14, padding: "0 22px", borderRadius: 999, border: `2px solid ${INK.emerald}`, background: "rgba(255,252,244,0.96)", opacity: badgeOp }}>
          <span style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: 40, fontWeight: 700, color: INK.emerald }}>{fa ? "سراج" : "Siraj"}</span>
          <svg width={30} height={30} viewBox="0 0 24 24">
            <path d="M12 20.5C6.6 16.4 3.5 13.4 3.5 9.6C3.5 7 5.5 5 8 5C9.7 5 11.1 5.9 12 7.3C12.9 5.9 14.3 5 16 5C18.5 5 20.5 7 20.5 9.6C20.5 13.4 17.4 16.4 12 20.5Z" fill="none" stroke={INK.emerald} strokeWidth={1.8} />
          </svg>
          <svg width={30} height={30} viewBox="0 0 24 24">
            <circle cx={12} cy={12} r={9} fill="none" stroke={INK.emerald} strokeWidth={1.8} />
            <path d="M12 7.8V16.2M7.8 12H16.2" stroke={INK.emerald} strokeWidth={1.8} strokeLinecap="round" />
          </svg>
        </div>
      ) : null}
      <Probe root={root} f={f} probe={probe} />
    </AbsoluteFill>
  );
};

/** A cover: the storyboard's cover frame, held. */
export const ChiraghCover: React.FC<ChiraghProps> = ({ storyboard }) => <Chiragh storyboard={storyboard} still={storyboard ? Math.round(storyboard.cover_at * storyboard.fps) : 0} />;
