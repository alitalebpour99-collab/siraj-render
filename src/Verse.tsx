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
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [0, 1, 2, 3].map((i) => a[i]! + (b[i]! - a[i]!) * t) as RGBA;
const rgba = (c: RGBA) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;

/** A word blooms when the qari reaches it, stays bright while he recites it, then settles. */
function wordLook(t: number, w: WordTime): React.CSSProperties {
  const [DIM, SETTLED, HOT] = flags.paper ? [DIM_PAPER, SETTLED_PAPER, HOT_PAPER] : [DIM_DARK, SETTLED_DARK, HOT_DARK];
  if (t < w.start) return { color: rgba(DIM) };
  const lit = clamp01((t - w.start) / 0.14);
  const hot = t <= w.end ? 1 : easeOut(clamp01(1 - (t - w.end) / 0.75));
  const glow = lit * (0.28 + 0.72 * hot);
  const color = mix(mix(DIM, SETTLED, lit), HOT, hot * lit * 0.85);
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
const SpokenText: React.FC<{ text: string; words: Array<[number, number]> | undefined; t: number }> = ({ text, words, t }) => {
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
          <span key={i} style={{ opacity: 0.58 + 0.42 * k }}>
            {p.text}
          </span>
        );
      })}
    </>
  );
};

// ---------- the cards ----------

const Reference: React.FC<{ p: VerseProps; k: number }> = ({ p, k }) => {
  const fa = p.lang === "fa";
  return (
    <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: SAFE.top - 24, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div
        style={{
          fontFamily: fa ? FONT.fa : FONT.en,
          fontSize: fa ? 36 : 46,
          fontWeight: 500,
          letterSpacing: fa ? 0 : "0.2em",
          fontVariantCaps: fa ? "normal" : "all-small-caps",
          fontVariantNumeric: "lining-nums",
          color: C.gold,
        }}
      >
        {fa ? L.fa.ref("", p.surah.number, k) : L.en.ref(p.surah.tname, p.surah.number, k)}
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {p.ayahs.map((a) => (
          <div key={a.ayahNumber} style={{ width: 10, height: 10, borderRadius: 5, border: `1.5px solid ${C.gold}`, background: a.ayahNumber <= k ? C.gold : "transparent" }} />
        ))}
      </div>
    </div>
  );
};

const Card: React.FC<{ p: VerseProps; card: VerseCard }> = ({ p, card }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = p.ayahs[card.index]!;
  const fa = p.lang === "fa";
  const split = splitLeadingBasmala(p.surah.number, a.ayahNumber, a.text, p.opening);
  const body = split ? split.rest : a.text;
  const clip = p.qari?.verses.find((v) => v.ayah === a.ayahNumber) ?? null;
  const basmalaClip = card.index === 0 ? (p.qari?.basmala ?? null) : null;
  const narration = p.voice.lines.find((l) => l.id === `a${a.ayahNumber}`);
  const opacity = Math.min(fadeIn(f, 0, VT.XF), fadeOut(f, card.dur, VT.XF));
  const push = interpolate(f, [0, card.dur], [0.985, 1.02], clamp);
  const qariFrom = card.basmalaAt ?? card.verseAt;
  const warm = card.recited
    ? Math.min(interpolate(f, [qariFrom - 6, qariFrom + 12], [0, 1], { ...clamp, easing: easeInOut }), interpolate(f, [card.qariEnd, card.qariEnd + 36], [1, 0.25], { ...clamp, easing: easeInOut }))
    : 0.35;
  const tVerse = (f - card.verseAt) / fps;
  const tBasmala = card.basmalaAt === null ? -1 : (f - card.basmalaAt) / fps;
  const tNarr = (f - card.narrAt) / fps;
  const seal = fa ? faNum(a.ayahNumber) : arNum(a.ayahNumber);
  return (
    <AbsoluteFill style={{ opacity }}>
      <Lamp warm={warm} cy={0.4} />
      <Reference p={p} k={a.ayahNumber} />
      <div style={{ position: "absolute", top: SAFE.top + 96, bottom: H_BOTTOM, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: `scale(${push.toFixed(4)})` }}>
        <div style={{ opacity: fadeIn(f, 0, 14), transform: `translateY(${rise(f, 0, 18)}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {split ? (
            <Fit width={820} maxHeight={136} max={72} min={34} measureKey={split.basmala} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.8, textAlign: "center", textWrap: "balance", marginBottom: 14, color: C.star }}>
              <LitText text={split.basmala} clip={basmalaClip} t={tBasmala} plain={C.star} />
            </Fit>
          ) : null}
          <Fit width={820} maxHeight={split ? 540 : 640} max={124} min={40} measureKey={a.text} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.9, textAlign: "center", textWrap: "balance" }}>
            <LitText text={body} clip={clip} t={tVerse} after={<AyahSeal label={seal} font={fa ? FONT.fa : FONT.quran} />} />
          </Fit>
        </div>
        <Divider width={320} style={{ marginBlock: 30, opacity: fadeIn(f, card.trAt - 4, VT.TR_IN) }} />
        <div style={{ opacity: fadeIn(f, card.trAt, VT.TR_IN + 4), transform: `translateY(${rise(f, card.trAt, 22, 24)}px)` }}>
          <Fit
            width={820}
            maxHeight={fa ? 420 : 400}
            max={fa ? 54 : 62}
            min={28}
            measureKey={a.translation}
            lang={p.lang}
            dir={fa ? "rtl" : "ltr"}
            style={{ fontFamily: fa ? FONT.fa : FONT.en, fontWeight: fa ? 400 : 500, lineHeight: fa ? 1.95 : 1.4, textAlign: "center", textWrap: "balance", color: "#eef0f6" }}
          >
            <SpokenText text={a.translation} words={narration?.words} t={tNarr} />
          </Fit>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Intro: React.FC<{ p: VerseProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const t = fa ? L.fa : L.en;
  const ui = fa ? FONT.fa : FONT.en;
  const out = fadeOut(f, dur, VT.XF);
  // the studio's first second: «Surah n of 114», a short fact, or a question that the name answers
  const hook = p.studio?.hook ?? "name-number";
  const place = p.surah.revelationPlace === "meccan" ? t.meccan : t.medinan;
  const verses = t.verses(p.surah.ayahCount);
  const top = hook === "fact" ? `${place} · ${verses}` : hook === "question" ? (fa ? `${place} · ${verses}؛ کدام سوره؟` : `${place} · ${verses}: which surah?`) : t.of(p.surah.number, p.surahTotal);
  const late = hook === "question" ? 30 : 0;
  const open = interpolate(f, [6 + late, 26 + late], [0, 1], { ...clamp, easing: easeInOut });
  const turn = interpolate(f, [6, dur], [-40, 6], { ...clamp, easing: easeInOut });
  const warm = interpolate(f, [4, 30], [0, 1], { ...clamp, easing: easeInOut });
  const push = interpolate(f, [0, dur], [0.97, 1.02], clamp);
  const unit = p.whole ? t.verses(p.surah.ayahCount) : t.range(p.from, p.to);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Lamp warm={warm} cy={0.45} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 140, transform: `scale(${push.toFixed(4)})` }}>
        <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }}>
          <div style={{ opacity: fadeIn(f, 2), transform: `translateY(${rise(f, 2)}px)`, fontFamily: ui, fontSize: fa ? 52 : 56, fontWeight: 500, letterSpacing: fa ? 0 : "0.2em", fontVariantCaps: fa ? "normal" : "all-small-caps", fontVariantNumeric: "lining-nums", color: C.gold }}>
            {top}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Seal size={112} turn={turn} style={{ opacity: fadeIn(f, 8, 16) }} />
            <Cartouche height={216} open={open}>
              <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 100, lineHeight: 1.5, color: C.star, paddingBottom: 38, textShadow: `0 0 ${(24 * warm).toFixed(1)}px rgba(224,172,79,${(0.45 * warm).toFixed(3)})` }}>
                {p.surah.nameArabic}
              </div>
            </Cartouche>
            <Seal size={112} turn={-turn} style={{ opacity: fadeIn(f, 8, 16) }} />
          </div>
          {fa ? null : <div style={{ opacity: fadeIn(f, 12), transform: `translateY(${rise(f, 12)}px)`, fontFamily: FONT.en, fontStyle: "italic", fontSize: 84, color: C.ink }}>{p.surah.tname}</div>}
          <div style={{ opacity: fadeIn(f, 18), transform: `translateY(${rise(f, 18)}px)`, fontFamily: ui, fontSize: fa ? 56 : 54, color: fa ? C.ink : C.translation }}>{unit}</div>
          {p.whole ? null : <div style={{ opacity: fadeIn(f, 24), fontFamily: ui, fontSize: fa ? 36 : 38, color: C.quiet }}>{t.opening}</div>}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Block: React.FC<{ label: string; children: React.ReactNode; f: number; at: number; fa: boolean }> = ({ label, children, f, at, fa }) => (
  <div style={{ opacity: fadeIn(f, at), transform: `translateY(${rise(f, at, 16)}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
    <div style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: 28, fontWeight: 600, letterSpacing: fa ? 0 : "0.16em", textTransform: fa ? "none" : "uppercase", color: C.gold }}>{label}</div>
    {children}
  </div>
);

const Outro: React.FC<{ p: VerseProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const q = p.source.quran;
  const tr = p.source.translation;
  const ui = fa ? FONT.fa : FONT.en;
  const opacity = Math.min(fadeIn(f, 0, VT.XF), fadeOut(f, dur, 14));
  const big = { fontFamily: ui, fontSize: fa ? 34 : 38, color: C.ink, lineHeight: fa ? 1.8 : 1.3, maxWidth: 840 } as const;
  const small = { fontFamily: FONT.en, fontSize: 25, color: C.quiet, lineHeight: 1.35, maxWidth: 840, direction: "ltr" } as const;
  const makarem = firstUrl(tr.release.attributionText);
  const qari = p.qari ? p.qari.reciter.name : null;
  return (
    <AbsoluteFill style={{ opacity }}>
      <Lamp warm={0.4} cy={0.42} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 40, paddingBottom: 1920 - SAFE.bottom - 40 }}>
        <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, width: 880 }}>
          <div style={{ opacity: fadeIn(f, 0, 18) }}>
            <SirajMark size={96} />
          </div>
          <div style={{ opacity: fadeIn(f, 4), fontFamily: ui, fontSize: fa ? 42 : 44, color: C.gold, letterSpacing: fa ? 0 : "0.1em" }}>{fa ? L.fa.sources : L.en.sources}</div>
          <Block label={fa ? L.fa.quranText : L.en.quranText} f={f} at={8} fa={fa}>
            <div style={big}>{fa ? `${L.fa.tanzil}، ${host(q.canonicalUrl)}` : `${q.publisher}, ${host(q.canonicalUrl)}`}</div>
            <div style={small}>{`${q.sourceTitle} · ${q.licenseName}`}</div>
          </Block>
          <Block label={fa ? L.fa.translation : L.en.translation} f={f} at={16} fa={fa}>
            {fa ? (
              <>
                <div style={big}>{tr.translatorName}</div>
                <div style={{ ...big, fontSize: 28, color: C.translation }}>
                  {makarem ? `${L.fa.translationSource}: ${L.fa.translatorSite}، ${host(makarem)}` : null}
                  {makarem ? <br /> : null}
                  {`${L.fa.translationFile}: ${L.fa.tanzil}، ${host(tr.release.canonicalUrl, true)}`}
                </div>
                {tr.termsText ? <div style={{ fontFamily: FONT.fa, fontSize: 24, lineHeight: 1.8, color: C.quiet, maxWidth: 840 }}>{tr.termsText}</div> : null}
              </>
            ) : (
              <>
                <div style={big}>{tr.release.attributionText}</div>
                {p.source.translationNote ? <div style={{ ...small, fontStyle: "italic", fontSize: 26 }}>{p.source.translationNote}</div> : null}
              </>
            )}
          </Block>
          {qari ? (
            <Block label={fa ? L.fa.recitation : L.en.recitation} f={f} at={24} fa={fa}>
              <div style={{ ...big, color: C.gold }} dir="ltr">
                {(fa ? L.fa : L.en).recitationLine(qari)}
              </div>
            </Block>
          ) : null}
          <div style={{ opacity: fadeIn(f, 32), display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 4 }}>
            <div style={{ fontFamily: FONT.en, fontSize: 44, color: C.gold, letterSpacing: "0.04em", direction: "ltr" }}>{SITE}</div>
            {p.voice.lines.length ? <div style={{ fontFamily: ui, fontSize: fa ? 26 : 27, color: C.quiet }}>{fa ? L.fa.voice : L.en.voice}</div> : null}
            {p.studio?.ending === "next" ? <div style={{ marginTop: 12, padding: "10px 32px", borderRadius: 999, border: `2px solid ${C.brass}`, fontFamily: ui, fontSize: 36, color: C.star }}>{fa ? "بخش بعد فردا" : "The next part tomorrow"}</div> : null}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const VerseReel: React.FC<VerseProps> = (raw) => {
  // the studio (look, motion, motes, frame, word glow, ending); without one, the S1 look
  const studio = applyStudio(raw.studio);
  const p: VerseProps = { ...raw, studio, qari: raw.qari && !studio.wordGlow ? { ...raw.qari, verses: raw.qari.verses.map((v) => ({ ...v, mode: "verse" as const })), basmala: raw.qari.basmala ? { ...raw.qari.basmala, mode: "verse" as const } : null } : raw.qari };
  const t = verseTimeline(p);
  const lines = new Map(p.voice.lines.map((l) => [l.id, l]));
  const audio = (key: string, from: number, file: string | undefined, seconds: number | undefined) =>
    file && seconds ? (
      <Sequence key={key} from={from} durationInFrames={Math.ceil(seconds * 30) + 2} name={key}>
        <Audio src={staticFile(file)} />
      </Sequence>
    ) : null;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={t.total} seed={p.surah.number} />
      {studio.frame ? <MushafFrame /> : null}
      <Sequence from={t.intro.from} durationInFrames={t.intro.dur} name="intro">
        <Intro p={p} dur={t.intro.dur} />
      </Sequence>
      {t.cards.map((card) => (
        <Sequence key={card.ayah} from={card.from} durationInFrames={card.dur} name={`ayah ${card.ayah}`}>
          <Card p={p} card={card} />
        </Sequence>
      ))}
      <Sequence from={t.outro.from} durationInFrames={t.outro.dur} name="sources">
        <Outro p={p} dur={t.outro.dur} />
      </Sequence>
      {t.cards.map((card) => {
        const clip = p.qari?.verses.find((v) => v.ayah === card.ayah);
        const narr = lines.get(`a${card.ayah}`);
        const basmala = card.index === 0 ? (p.qari?.basmala ?? null) : null;
        return (
          <React.Fragment key={`audio ${card.ayah}`}>
            {basmala && card.basmalaAt !== null ? audio("qari basmala", card.from + card.basmalaAt, basmala.file, basmala.seconds) : null}
            {audio(`qari ${card.ayah}`, card.from + card.verseAt, clip?.file, clip?.seconds)}
            {audio(`narration ${card.ayah}`, card.from + card.narrAt, narr?.file, narr?.seconds)}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
