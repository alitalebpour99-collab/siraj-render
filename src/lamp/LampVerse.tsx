// «Verse & meaning» / «آیه و معنی» in the lamp style (owner, 2026-11-13: the new video style, in
// Siraj's own look). What changes against the classic look (src/Verse.tsx), the rules of the
// hub's social audit of 2026-11-13 and the style guide:
//  - no opening card: the ayah stands on screen from the first frame, its reference above it, and
//    the qari begins 0.6 s in; the reference (surah and verse) stays with every ayah, the
//    translator's name with every translation;
//  - cream ground, a small golden glow behind a modern oil lamp that warms while the qari recites,
//    the words lit in deep emerald, the translation in a naskh face (Persian) or Garamond;
//  - a slow camera: the ground breathes in from the first frame and is home again on the last; each
//    ayah pushes in a little; nothing cuts, shakes or flashes; cards give way one after the other,
//    never two texts over each other;
//  - every text inside the measured safe zones of the apps (src/lamp/zones.ts), nothing under 29 px;
//  - the sources at the close with the small channel badge, then the first picture again (loop).
// Every ayah and translation string is the API's own, exactly as stored. No music, no bed.
import React from "react";
import { AbsoluteFill, Audio, Freeze, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { splitLeadingBasmala } from "../basmala";
import { Fit } from "../Fit";
import { L, SITE, firstUrl, host } from "../labels";
import { AyahSeal } from "../ornament";
import type { VerseProps } from "../props";
import { applyStudio } from "../studio";
import { C, FONT, arNum, easeInOut, easeOut, faNum } from "../theme";
import { VT, VT_LAMP, verseTimeline, type VerseCard } from "../timelines";
import { LitText, SpokenText } from "../Verse";
import { Badge, Ground } from "./kit";
import { Probe } from "./Probe";
import { COL, COL_W, COL_X, ZONES } from "./zones";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const LAMP_AT = { x: COL_X, y: 420, size: 128 };
/** the body of an ayah card: below the lamp, above the bottom of the safe zone */
const BODY = { top: 520, bottom: ZONES.bottom - 90 };
const TEXT_W = COL_W - 40;

/** A card shows alone: it fades out in the first half of the cross-fade and the next fades in in the second. */
const cardOpacity = (f: number, dur: number, first: boolean) =>
  Math.min(first ? 1 : interpolate(f, [VT.XF * 0.5, VT.XF], [0, 1], { ...clamp, easing: easeInOut }), interpolate(f, [dur - VT.XF, dur - VT.XF * 0.5], [1, 0], { ...clamp, easing: easeInOut }));

const refText = (p: VerseProps, k: number) => (p.lang === "fa" ? `سورهٔ ${p.surah.nameArabic}، آیهٔ ${faNum(k)}` : `${p.surah.tname} · ${p.surah.number}:${k}`);
const translatorLine = (p: VerseProps) => (p.lang === "fa" ? `ترجمهٔ ${p.source.translation.translatorName}` : `Translation: ${p.source.translation.translatorName}`);

/** The reference above the ayah (its source, always on screen with it) and the row of ayahs. */
const Reference: React.FC<{ p: VerseProps; k: number }> = ({ p, k }) => {
  const fa = p.lang === "fa";
  return (
    <div style={{ position: "absolute", top: ZONES.top + 18, left: COL.left, width: COL_W, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div
        data-role="source"
        data-b="ref"
        dir={fa ? "rtl" : "ltr"}
        style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: fa ? 40 : 44, fontWeight: fa ? 600 : 500, letterSpacing: fa ? 0 : "0.06em", color: C.gold, fontVariantNumeric: "lining-nums", lineHeight: 1.3 }}
      >
        {refText(p, k)}
      </div>
      <div style={{ display: "flex", gap: 12, direction: fa ? "rtl" : "ltr" }}>
        {p.ayahs.length > 1 && p.ayahs.length <= 40
          ? p.ayahs.map((a) => <div key={a.ayahNumber} style={{ width: 10, height: 10, borderRadius: 5, border: `1.5px solid ${C.gold}`, background: a.ayahNumber <= k ? C.gold : "transparent" }} />)
          : null}
      </div>
    </div>
  );
};

/** One ayah: the Arabic lit word by word, then its translation with the translator's name. */
const Card: React.FC<{ p: VerseProps; card: VerseCard; frozen?: boolean }> = ({ p, card, frozen }) => {
  const now = useCurrentFrame();
  const f = frozen ? 0 : now;
  const { fps } = useVideoConfig();
  const a = p.ayahs[card.index]!;
  const fa = p.lang === "fa";
  const split = splitLeadingBasmala(p.surah.number, a.ayahNumber, a.text, p.opening);
  const body = split ? split.rest : a.text;
  const clip = p.qari?.verses.find((v) => v.ayah === a.ayahNumber) ?? null;
  const basmalaClip = card.index === 0 ? (p.qari?.basmala ?? null) : null;
  const narration = p.voice.lines.find((l) => l.id === `a${a.ayahNumber}`);
  const opacity = frozen ? 1 : cardOpacity(f, card.dur, card.index === 0);
  // the ayah pushes in a little while it is read, from under the lamp; the first one also arrives
  // (rises and settles) in its first 1.3 s, so the opening moves from the first frame
  const push = interpolate(f, [0, card.dur], [1, 1.04], clamp);
  const arrive = card.index === 0 ? interpolate(f, [0, 40], [0, 1], { ...clamp, easing: easeOut }) : 1;
  const camera = `translateY(${((1 - arrive) * 18).toFixed(1)}px) scale(${(push * (0.975 + 0.025 * arrive)).toFixed(4)})`;
  const tVerse = (f - card.verseAt) / fps;
  const tBasmala = card.basmalaAt === null ? -1 : (f - card.basmalaAt) / fps;
  const tNarr = (f - card.narrAt) / fps;
  const trIn = interpolate(f, [card.trAt, card.trAt + VT.TR_IN + 4], [0, 1], { ...clamp, easing: easeInOut });
  const trRise = interpolate(f, [card.trAt, card.trAt + 24], [18, 0], { ...clamp, easing: easeOut });
  const seal = fa ? faNum(a.ayahNumber) : arNum(a.ayahNumber);
  const trSize = fa ? { max: 52, min: 34 } : { max: 56, min: 36 };
  return (
    <AbsoluteFill style={{ opacity }}>
      <Reference p={p} k={a.ayahNumber} />
      <div
        style={{
          position: "absolute",
          top: BODY.top,
          left: COL.left,
          width: COL_W,
          height: BODY.bottom - BODY.top,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          transform: camera,
          transformOrigin: `${COL_W / 2}px ${LAMP_AT.y - BODY.top}px`,
        }}
      >
        {split ? (
          <Fit width={TEXT_W} maxHeight={130} max={66} min={40} measureKey={split.basmala} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.8, textAlign: "center", textWrap: "balance", marginBottom: 6, color: C.star }}>
            <span data-role="quote" data-q={`a${a.ayahNumber}`} data-b={`basmala-${a.ayahNumber}`}>
              <LitText text={split.basmala} clip={basmalaClip} t={tBasmala} plain={C.star} />
            </span>
          </Fit>
        ) : null}
        <Fit width={TEXT_W} maxHeight={split ? 480 : 560} max={112} min={44} measureKey={a.text} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.9, textAlign: "center", textWrap: "balance" }}>
          <span data-role="quote" data-q={`a${a.ayahNumber}`} data-b={`ayah-${a.ayahNumber}`}>
            <LitText text={body} clip={clip} t={tVerse} after={<AyahSeal label={seal} font={fa ? FONT.fa : FONT.quran} />} />
          </span>
        </Fit>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBlock: 22, opacity: trIn }}>
          <div style={{ width: 90, height: 2, background: `linear-gradient(90deg, transparent, ${C.gold})` }} />
          <div style={{ width: 9, height: 9, borderRadius: 5, background: C.gold }} />
          <div style={{ width: 90, height: 2, background: `linear-gradient(90deg, ${C.gold}, transparent)` }} />
        </div>
        <div style={{ opacity: trIn, transform: `translateY(${trRise.toFixed(1)}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <Fit
            width={TEXT_W}
            maxHeight={fa ? 330 : 320}
            max={trSize.max}
            min={trSize.min}
            measureKey={a.translation}
            lang={p.lang}
            dir={fa ? "rtl" : "ltr"}
            style={{ fontFamily: fa ? FONT.naskh : FONT.en, fontWeight: fa ? 500 : 500, lineHeight: fa ? 1.85 : 1.38, textAlign: "center", textWrap: "balance", color: C.translation }}
          >
            <span data-role="quote" data-q={`t${a.ayahNumber}`} data-b={`tr-${a.ayahNumber}`}>
              <SpokenText text={a.translation} words={narration?.words} t={tNarr} />
            </span>
          </Fit>
          <div data-role="source" data-b={`tr-src-${a.ayahNumber}`} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: 30, color: C.quiet, lineHeight: 1.3, textAlign: "center", maxWidth: TEXT_W }}>
            {translatorLine(p)}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Line: React.FC<{ children: React.ReactNode; size?: number; color?: string; font?: string; dir?: "rtl" | "ltr"; at: number; f: number }> = ({ children, size = 34, color = C.ink, font, dir, at, f }) => (
  <div dir={dir} style={{ opacity: interpolate(f, [at, at + 14], [0, 1], { ...clamp, easing: easeInOut }), fontFamily: font, fontSize: size, color, lineHeight: 1.4, textAlign: "center", maxWidth: TEXT_W }}>
    {children}
  </div>
);

/** The sources, short and large enough to read; the channel badge comes in at its end. */
const Sources: React.FC<{ p: VerseProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const ui = fa ? FONT.fa : FONT.en;
  const q = p.source.quran;
  const tr = p.source.translation;
  const makarem = firstUrl(tr.release.attributionText);
  const qari = p.qari ? p.qari.reciter.name : null;
  const o = Math.min(interpolate(f, [0, VT.XF], [0, 1], { ...clamp, easing: easeInOut }), interpolate(f, [dur - 14, dur], [1, 0], { ...clamp, easing: easeInOut }));
  const label = (text: string, at: number) => (
    <Line f={f} at={at} size={30} color={C.quiet} font={ui} dir={fa ? "rtl" : "ltr"}>
      {text}
    </Line>
  );
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div data-role="source" style={{ position: "absolute", top: BODY.top + 10, left: COL.left, width: COL_W, height: ZONES.bottom - 120 - (BODY.top + 10), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Line f={f} at={0} size={42} color={C.gold} font={ui} dir={fa ? "rtl" : "ltr"}>
          {fa ? L.fa.sources : L.en.sources}
        </Line>
        {label(fa ? L.fa.quranText : L.en.quranText, 4)}
        <Line f={f} at={6} font={ui} dir={fa ? "rtl" : "ltr"}>
          {fa ? `${L.fa.tanzil}، ${host(q.canonicalUrl)}` : `${q.publisher}, ${host(q.canonicalUrl)}`}
        </Line>
        {label(fa ? L.fa.translation : L.en.translation, 10)}
        <Line f={f} at={12} font={fa ? FONT.naskh : FONT.en} dir={fa ? "rtl" : "ltr"}>
          {fa ? tr.translatorName : tr.release.attributionText}
        </Line>
        {fa ? (
          <Line f={f} at={14} size={30} color={C.translation} font={ui} dir="rtl">
            {makarem ? `${L.fa.translatorSite}، ${host(makarem)}؛ ${L.fa.translationFile}، ${host(tr.release.canonicalUrl, true)}` : `${L.fa.translationFile}، ${host(tr.release.canonicalUrl, true)}`}
          </Line>
        ) : null}
        {fa && tr.termsText ? (
          <Line f={f} at={16} size={30} color={C.quiet} font={ui} dir="rtl">
            {tr.termsText}
          </Line>
        ) : null}
        {qari ? (
          <>
            {label(fa ? L.fa.recitation : L.en.recitation, 18)}
            <Line f={f} at={20} font={FONT.en} dir="ltr" color={C.gold}>
              {L.en.recitationLine(qari)}
            </Line>
          </>
        ) : null}
        <Line f={f} at={24} size={42} color={C.gold} font={FONT.en} dir="ltr">
          {SITE}
        </Line>
        {p.voice.lines.length ? (
          <Line f={f} at={26} size={30} color={C.quiet} font={ui} dir={fa ? "rtl" : "ltr"}>
            {fa ? "صدای مصنوعی؛ فقط ترجمه را می‌خواند" : "Synthetic voice: it reads the translation only"}
          </Line>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** The last frames: the first picture comes back over the cream, so the end leads into the start. */
const LoopIn: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, frames - 1], [0, 1], { ...clamp, easing: easeInOut }) }}>{children}</AbsoluteFill>;
};

export const LampVerse: React.FC<VerseProps> = (raw) => {
  const studio = applyStudio(raw.studio, true);
  const p: VerseProps = { ...raw, studio, qari: raw.qari && !studio.wordGlow ? { ...raw.qari, verses: raw.qari.verses.map((v) => ({ ...v, mode: "verse" as const })), basmala: raw.qari.basmala ? { ...raw.qari.basmala, mode: "verse" as const } : null } : raw.qari };
  const t = verseTimeline(p);
  const f = useCurrentFrame();
  const lines = new Map(p.voice.lines.map((l) => [l.id, l]));
  // the lamp warms while the qari recites
  const reciting = Math.max(0, ...t.speakers.filter((s) => s.kind === "qari").map((s) => Math.min(interpolate(f, [s.frame - 12, s.frame + 6], [0, 1], clamp), interpolate(f, [s.frame + s.seconds * 30, s.frame + s.seconds * 30 + 30], [1, 0], clamp))));
  const warm = 0.45 + 0.55 * easeInOut(reciting);
  const first = t.cards[0];
  const audio = (key: string, from: number, file: string | undefined, seconds: number | undefined) =>
    file && seconds ? (
      <Sequence key={key} from={from} durationInFrames={Math.ceil(seconds * 30) + 2} name={key}>
        <Audio src={staticFile(file)} />
      </Sequence>
    ) : null;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Ground total={t.total} lamp={LAMP_AT} warm={warm} seed={p.surah.number} />
      {t.cards.map((card) => (
        <Sequence key={card.ayah} from={card.from} durationInFrames={card.dur} name={`ayah ${card.ayah}`}>
          <Card p={p} card={card} />
        </Sequence>
      ))}
      <Sequence from={t.outro.from} durationInFrames={t.outro.dur} name="sources">
        <Sources p={p} dur={t.outro.dur} />
      </Sequence>
      {p.style?.badge ? (
        <Sequence from={t.outro.from + t.outro.dur - VT_LAMP.BADGE - 6} durationInFrames={VT_LAMP.BADGE} name="badge">
          <Badge lang={p.lang} len={VT_LAMP.BADGE} />
        </Sequence>
      ) : null}
      {first && t.loop ? (
        <Sequence from={t.total - t.loop} durationInFrames={t.loop} name="loop">
          <LoopIn frames={t.loop}>
            <Freeze frame={0}>
              <Card p={p} card={first} frozen />
            </Freeze>
          </LoopIn>
        </Sequence>
      ) : null}
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
      <Probe total={t.total} />
    </AbsoluteFill>
  );
};
