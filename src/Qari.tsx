// The private qari previews (en-qari, fa-qari): a whole surah, ayah by ayah. The qari's own
// recitation (Quran Foundation audio, cut at build time) with each Arabic word lit in brass as
// he recites it; then the translation fades in under it and the narrator (a synthetic voice)
// reads it. Intro and outro cards are factual. Every ayah and translation string is the API's,
// rendered exactly as stored; nothing here holds sacred or translated text. No music, no bed.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { splitLeadingBasmala } from "./basmala";
import { Fit } from "./Fit";
import { L, Q } from "./labels";
import { Lamp, Motes, Rosette } from "./light";
import { AyahSeal, Cartouche, Divider, MushafFrame, Night, Seal, SirajMark } from "./ornament";
import type { QariClip, QariProps, WordTime } from "./props";
import { QT, qariTimeline, type QariCard } from "./qariTimeline";
import { C, FONT, SAFE, W, arNum, easeInOut, easeOut, fadeIn, fadeOut, faNum, rise } from "./theme";
import { wordParts } from "./words";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const H_BOTTOM = 1920 - SAFE.bottom + 20;

// ---------- the light of a word ----------

type RGBA = [number, number, number, number];
const DIM: RGBA = [243, 234, 214, 0.5];
const SETTLED: RGBA = [231, 186, 98, 1];
const HOT: RGBA = [255, 219, 140, 1];
const mix = (a: RGBA, b: RGBA, t: number): RGBA => [0, 1, 2, 3].map((i) => a[i]! + (b[i]! - a[i]!) * t) as RGBA;
const rgba = (c: RGBA) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;

/** A word blooms when the qari reaches it, stays bright while he recites it, then settles. */
function wordLook(t: number, w: WordTime): React.CSSProperties {
  if (t < w.start) return { color: rgba(DIM) };
  const lit = clamp01((t - w.start) / 0.14);
  const hot = t <= w.end ? 1 : easeOut(clamp01(1 - (t - w.end) / 0.75));
  const glow = lit * (0.28 + 0.72 * hot);
  const color = mix(mix(DIM, SETTLED, lit), HOT, hot * lit * 0.85);
  return {
    color: rgba(color),
    textShadow: `0 0 ${(5 + 19 * glow).toFixed(1)}px rgba(224,172,79,${(0.16 + 0.56 * glow).toFixed(3)}), 0 0 ${(2 + 7 * glow).toFixed(1)}px rgba(255,232,176,${(0.08 + 0.5 * glow).toFixed(3)})`,
  };
}

/** The timing of each word of `text` in a clip; the whole clip for every word in a fallback. */
function timesFor(clip: QariClip | null | undefined, count: number): WordTime[] {
  if (!clip) return Array.from({ length: count }, () => ({ start: Infinity, end: Infinity }));
  if (clip.mode === "word" && clip.words.length === count) return clip.words;
  return Array.from({ length: count }, () => ({ start: 0, end: clip.seconds }));
}

/** Stored text set word by word, each word lit by its own timing; `after` sits with the last word. */
const LitText: React.FC<{ text: string; clip: QariClip | null | undefined; t: number; after?: React.ReactNode }> = ({ text, clip, t, after }) => {
  const { parts, count } = wordParts(text);
  const times = timesFor(clip, count);
  let last = -1;
  parts.forEach((part, i) => {
    if (part.word !== null) last = i;
  });
  const span = (i: number) => {
    const part = parts[i]!;
    if (part.word === null) return <React.Fragment key={i}>{part.text}</React.Fragment>;
    return (
      <span key={i} style={wordLook(t, times[part.word]!)}>
        {part.text}
      </span>
    );
  };
  // With `after` (the ayah's seal), the last word and the seal stay on one line, as in S1.
  const head = after && last >= 0 ? parts.slice(0, last) : parts;
  return (
    <>
      {head.map((_, i) => span(i))}
      {after && last >= 0 ? (
        <span style={{ whiteSpace: "nowrap" }}>
          {span(last)}
          {parts.slice(last + 1).map((p) => p.text)}
          {" "}
          {after}
        </span>
      ) : null}
    </>
  );
};

// ---------- the cards ----------

const Reference: React.FC<{ p: QariProps; k: number; opacity: number }> = ({ p, k, opacity }) => {
  const fa = p.lang === "fa";
  return (
    <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: SAFE.top - 24, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity }}>
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
        {fa ? Q.fa.ref(p.meta.nameFa, p.surah.number, k) : Q.en.ref(p.meta.nameLatin, p.surah.number, k)}
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {p.ayahs.map((a) => (
          <div key={a.ayahNumber} style={{ width: 10, height: 10, borderRadius: 5, border: `1.5px solid ${C.gold}`, background: a.ayahNumber <= k ? C.gold : "transparent" }} />
        ))}
      </div>
    </div>
  );
};

const Card: React.FC<{ p: QariProps; card: QariCard }> = ({ p, card }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = p.ayahs[card.index]!;
  const fa = p.lang === "fa";
  const split = splitLeadingBasmala(p.surah.number, a.ayahNumber, a.text, p.opening);
  const body = split ? split.rest : a.text;
  const clip = p.qari.verses.find((v) => v.ayah === a.ayahNumber);
  const basmalaClip = card.index === 0 ? p.qari.basmala : null;
  const opacity = Math.min(fadeIn(f, 0, QT.XF), fadeOut(f, card.dur, QT.XF));
  const push = interpolate(f, [0, card.dur], [0.985, 1.02], clamp);
  const qariFrom = card.basmalaAt ?? card.verseAt;
  const warm = Math.min(interpolate(f, [qariFrom - 6, qariFrom + 12], [0, 1], { ...clamp, easing: easeInOut }), interpolate(f, [card.qariEnd, card.qariEnd + 36], [1, 0.25], { ...clamp, easing: easeInOut }));
  const tVerse = (f - card.verseAt) / fps;
  const tBasmala = card.basmalaAt === null ? -1 : (f - card.basmalaAt) / fps;
  const seal = fa ? faNum(a.ayahNumber) : arNum(a.ayahNumber);
  return (
    <AbsoluteFill style={{ opacity }}>
      <Lamp warm={warm} cy={0.4} />
      <Reference p={p} k={a.ayahNumber} opacity={1} />
      <div style={{ position: "absolute", top: SAFE.top + 96, bottom: H_BOTTOM, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: `scale(${push.toFixed(4)})` }}>
        <div style={{ opacity: fadeIn(f, 0, 14), transform: `translateY(${rise(f, 0, 18)}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {split ? (
            <Fit width={820} maxHeight={136} max={72} min={34} measureKey={split.basmala} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.8, textAlign: "center", textWrap: "balance", marginBottom: 14 }}>
              <LitText text={split.basmala} clip={basmalaClip} t={tBasmala} />
            </Fit>
          ) : null}
          <Fit width={820} maxHeight={split ? 540 : 640} max={124} min={40} measureKey={a.text} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.9, textAlign: "center", textWrap: "balance" }}>
            <LitText text={body} clip={clip} t={tVerse} after={<AyahSeal label={seal} font={fa ? FONT.fa : FONT.quran} />} />
          </Fit>
        </div>
        <Divider width={320} style={{ marginBlock: 30, opacity: fadeIn(f, card.trAt - 4, QT.TR_IN) }} />
        <div style={{ opacity: fadeIn(f, card.trAt, QT.TR_IN + 4), transform: `translateY(${rise(f, card.trAt, 22, 24)}px)` }}>
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
            {a.translation}
          </Fit>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Intro: React.FC<{ p: QariProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const ui = fa ? FONT.fa : FONT.en;
  const out = fadeOut(f, dur, QT.XF);
  const open = interpolate(f, [8, 30], [0, 1], { ...clamp, easing: easeInOut });
  const turn = interpolate(f, [8, dur], [-40, 6], { ...clamp, easing: easeInOut });
  const warm = interpolate(f, [4, 34], [0, 1], { ...clamp, easing: easeInOut });
  const push = interpolate(f, [0, dur], [0.97, 1.02], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Lamp warm={warm} cy={0.45} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 140, transform: `scale(${push.toFixed(4)})` }}>
        <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
          <div style={{ opacity: fadeIn(f, 4), transform: `translateY(${rise(f, 4)}px)`, fontFamily: ui, fontSize: fa ? 52 : 56, fontWeight: 500, letterSpacing: fa ? 0 : "0.2em", fontVariantCaps: fa ? "normal" : "all-small-caps", fontVariantNumeric: "lining-nums", color: C.gold }}>
            {fa ? Q.fa.of(p.surah.number, p.meta.surahTotal) : Q.en.of(p.surah.number, p.meta.surahTotal)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Seal size={112} turn={turn} style={{ opacity: fadeIn(f, 12, 18) }} />
            <Cartouche height={216} open={open}>
              <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 100, lineHeight: 1.5, color: C.star, paddingBottom: 38, textShadow: `0 0 ${(24 * warm).toFixed(1)}px rgba(224,172,79,${(0.45 * warm).toFixed(3)})` }}>
                {p.surah.nameArabic}
              </div>
            </Cartouche>
            <Seal size={112} turn={-turn} style={{ opacity: fadeIn(f, 12, 18) }} />
          </div>
          {fa ? null : (
            <div style={{ opacity: fadeIn(f, 18), transform: `translateY(${rise(f, 18)}px)`, fontFamily: FONT.en, fontStyle: "italic", fontSize: 84, color: C.ink }}>{p.meta.nameLatin}</div>
          )}
          <div style={{ opacity: fadeIn(f, 26), transform: `translateY(${rise(f, 26)}px)`, fontFamily: ui, fontSize: fa ? 56 : 54, color: fa ? C.ink : C.translation }}>
            {fa ? Q.fa.verses(p.surah.ayahCount) : Q.en.verses(p.surah.ayahCount)}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ p: QariProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const ui = fa ? FONT.fa : FONT.en;
  const q = p.source.quran;
  const t = fa ? Q.fa : Q.en;
  const qari = fa ? p.qari.reciter.nameFa : p.qari.reciter.name;
  const opacity = Math.min(fadeIn(f, 0, QT.XF), fadeOut(f, dur, 14));
  const line = (at: number) => ({ opacity: fadeIn(f, at, 16), transform: `translateY(${rise(f, at, 16)}px)` });
  return (
    <AbsoluteFill style={{ opacity }}>
      <Lamp warm={0.4} cy={0.42} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 20, paddingBottom: 1920 - SAFE.bottom - 20 }}>
        <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, width: 880, textAlign: "center" }}>
          <div style={line(2)}>
            <SirajMark size={112} />
          </div>
          <div style={{ ...line(8), fontFamily: ui, fontSize: fa ? 38 : 42, lineHeight: fa ? 1.8 : 1.3, color: C.ink, maxWidth: 860 }}>{t.sourceLine}</div>
          <Divider width={300} style={line(12)} />
          <div style={{ ...line(16), fontFamily: ui, fontSize: fa ? 36 : 40, lineHeight: fa ? 1.8 : 1.3, color: C.gold, maxWidth: 860 }}>{t.recitation(qari)}</div>
          <div style={{ ...line(24), fontFamily: ui, fontSize: fa ? 32 : 34, color: C.translation }}>{t.narration}</div>
          <div style={{ ...line(32), fontFamily: FONT.en, fontSize: 25, lineHeight: 1.35, color: C.quiet, direction: "ltr", maxWidth: 820 }}>{`${q.sourceTitle} · ${q.licenseName}`}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The night that moves: lattice, rosette and motes under a slow camera push. */
const World: React.FC<{ total: number; still?: boolean; seed: number }> = ({ total, still, seed }) => {
  const f = useCurrentFrame();
  const k = still ? 0 : f / Math.max(1, total);
  const scale = 1 + 0.05 * easeInOut(k);
  return (
    // drawn once and scaled by the compositor (a re-drawn lattice per frame made the first render four times slower)
    <AbsoluteFill style={{ transform: `scale(${scale.toFixed(4)})`, transformOrigin: "50% 44%", willChange: "transform" }}>
      <Night still={still} glowY={0.42} />
      <Rosette turn={still ? 0 : f * 0.02} opacity={0.085} cy={860} />
      <Motes seed={seed} still={still} />
    </AbsoluteFill>
  );
};

export const QariReel: React.FC<QariProps> = (p) => {
  const t = qariTimeline(p);
  const lines = new Map(p.qari.narration.lines.map((l) => [l.id, l]));
  const audio = (key: string, from: number, file: string | undefined, seconds: number | undefined) =>
    file && seconds ? (
      <Sequence key={key} from={from} durationInFrames={Math.ceil(seconds * 30) + 2} name={key}>
        <Audio src={staticFile(file)} />
      </Sequence>
    ) : null;
  const intro = lines.get("intro");
  const outro = lines.get("outro");
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={t.total} seed={p.surah.number} />
      <MushafFrame />
      <Sequence from={t.intro.from} durationInFrames={t.intro.dur} name="intro">
        <Intro p={p} dur={t.intro.dur} />
      </Sequence>
      {t.cards.map((card) => (
        <Sequence key={card.ayah} from={card.from} durationInFrames={card.dur} name={`ayah ${card.ayah}`}>
          <Card p={p} card={card} />
        </Sequence>
      ))}
      <Sequence from={t.outro.from} durationInFrames={t.outro.dur} name="outro">
        <Outro p={p} dur={t.outro.dur} />
      </Sequence>
      {audio("narration intro", t.intro.from + t.intro.narrAt, intro?.file, intro?.seconds)}
      {t.cards.map((card) => {
        const clip = p.qari.verses.find((v) => v.ayah === card.ayah);
        const narr = lines.get(`a${card.ayah}`);
        const basmala = card.index === 0 ? p.qari.basmala : null;
        return (
          <React.Fragment key={`audio ${card.ayah}`}>
            {basmala && card.basmalaAt !== null ? audio(`qari basmala`, card.from + card.basmalaAt, basmala.file, basmala.seconds) : null}
            {audio(`qari ${card.ayah}`, card.from + card.verseAt, clip?.file, clip?.seconds)}
            {audio(`narration ${card.ayah}`, card.from + card.narrAt, narr?.file, narr?.seconds)}
          </React.Fragment>
        );
      })}
      {audio("narration outro", t.outro.from + t.outro.narrAt, outro?.file, outro?.seconds)}
    </AbsoluteFill>
  );
};

export const QariCover: React.FC<QariProps> = (p) => {
  const fa = p.lang === "fa";
  const ui = fa ? FONT.fa : FONT.en;
  const qari = fa ? p.qari.reciter.nameFa : p.qari.reciter.name;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={1} still seed={p.surah.number} />
      <MushafFrame drawn />
      <Lamp warm={0.7} cy={0.45} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 80 }}>
        <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
          <div style={{ fontFamily: ui, fontSize: fa ? 60 : 60, fontWeight: 500, letterSpacing: fa ? 0 : "0.2em", fontVariantCaps: fa ? "normal" : "all-small-caps", fontVariantNumeric: "lining-nums", color: C.gold }}>
            {fa ? Q.fa.of(p.surah.number, p.meta.surahTotal) : Q.en.of(p.surah.number, p.meta.surahTotal)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Seal size={104} />
            <Cartouche height={236}>
              <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 112, lineHeight: 1.5, color: C.star, paddingBottom: 42, textShadow: "0 0 22px rgba(224,172,79,0.4)" }}>
                {p.surah.nameArabic}
              </div>
            </Cartouche>
            <Seal size={104} />
          </div>
          {fa ? null : <div style={{ fontFamily: FONT.en, fontStyle: "italic", fontSize: 88, color: C.ink }}>{p.meta.nameLatin}</div>}
          <div style={{ fontFamily: ui, fontSize: fa ? 62 : 58, color: C.translation }}>{fa ? Q.fa.verses(p.surah.ayahCount) : Q.en.verses(p.surah.ayahCount)}</div>
          <Divider width={340} />
          <div style={{ fontFamily: ui, fontSize: fa ? 40 : 42, color: C.gold, textAlign: "center", maxWidth: 860 }}>{fa ? Q.fa.recitedBy(qari) : Q.en.recitedBy(qari)}</div>
          <div style={{ fontFamily: ui, fontSize: fa ? 32 : 36, color: C.translation, textAlign: "center", maxWidth: 860 }}>
            {fa ? L.fa.withTranslation(p.source.translation.translatorName) : L.en.withTranslation(p.source.translation.translatorName)}
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: 330, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <SirajMark size={64} />
        <div style={{ fontFamily: FONT.en, fontSize: 38, color: C.gold, letterSpacing: "0.04em" }}>{L.en.site}</div>
      </div>
    </AbsoluteFill>
  );
};
