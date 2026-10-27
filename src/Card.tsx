// «Surah n of 114» / «سورهٔ n از ۱۱۴»: one surah's facts, every number counted at render time
// from Siraj's surah index and the hash-checked Tanzil metadata (verses, Meccan or Medinan, the
// revelation order, sections, parts, pages, places of prostration). The narration is the job's
// factual sentences; the names come from the API (Arabic) and the metadata (transliteration).
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { splitLeadingBasmala } from "./basmala";
import { Fit } from "./Fit";
import { applyStudio } from "./studio";
import { LitText } from "./Verse";
import { Narrated, numIn } from "./Counts";
import { K_WORDS, L, SITE, host } from "./labels";
import { Lamp, World } from "./light";
import { AyahSeal, Cartouche, Divider, MushafFrame, Seal, SirajMark } from "./ornament";
import type { CardProps, Lang } from "./props";
import { C, FONT, SAFE, W, arNum, easeInOut, fadeIn, fadeOut, faNum, rise } from "./theme";
import { ST, cardTimeline, type InsightScene, type Scene } from "./timelines";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const uiFont = (lang: Lang) => (lang === "fa" ? FONT.fa : FONT.en);
const lineAt = (s: Scene, id: string) => {
  const l = s.lines.find((x) => x.id === id);
  return l ? l.from - s.from : null;
};

/** «36» in brass with «of 114» under it: the series mark of the card and its cover. */
export const SeriesMark: React.FC<{ p: CardProps; size: number; f?: number }> = ({ p, size, f = 999 }) => {
  const fa = p.lang === "fa";
  const k = K_WORDS[p.lang];
  return (
    <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.04 }}>
      <div style={{ fontFamily: uiFont(p.lang), fontSize: size * 0.2, fontWeight: 500, letterSpacing: fa ? 0 : "0.2em", fontVariantCaps: fa ? "normal" : "all-small-caps", color: C.gold, opacity: fadeIn(f, 2) }}>{k.series}</div>
      <div style={{ fontFamily: uiFont(p.lang), fontWeight: 500, fontSize: size, lineHeight: 1, color: C.brass, fontVariantNumeric: "lining-nums", textShadow: "0 0 34px rgba(224,172,79,0.35)", opacity: fadeIn(f, 4), transform: `translateY(${rise(f, 4)}px)` }}>
        {fa ? faNum(p.series.n) : String(p.series.n)}
      </div>
      <div style={{ fontFamily: uiFont(p.lang), fontSize: size * 0.26, color: C.ink, opacity: fadeIn(f, 10) }}>{k.of(p.series.of)}</div>
    </div>
  );
};

const Title: React.FC<{ p: CardProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const open = interpolate(f, [16, 36], [0, 1], { ...clamp, easing: easeInOut });
  const turn = interpolate(f, [16, s.dur], [-40, 6], { ...clamp, easing: easeInOut });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 300, opacity: fadeOut(f, s.dur, ST.OUT) }}>
      <Lamp warm={interpolate(f, [0, 30], [0, 0.9], clamp)} cy={0.4} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <VerseRing words={p.verseWords ?? []} f={f} size={620} />
          <div style={{ position: "relative" }}>
            <SeriesMark p={p} size={260} f={f} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: fadeIn(f, 14, 16) }}>
          <Seal size={96} turn={turn} />
          <Cartouche height={200} open={open}>
            <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 92, lineHeight: 1.5, color: C.star, paddingBottom: 34 }}>
              {p.surah.nameArabic}
            </div>
          </Cartouche>
          <Seal size={96} turn={-turn} />
        </div>
        {fa ? null : <div style={{ opacity: fadeIn(f, 22), transform: `translateY(${rise(f, 22)}px)`, fontFamily: FONT.en, fontStyle: "italic", fontSize: 76, color: C.ink }}>{p.surah.tname}</div>}
      </div>
    </AbsoluteFill>
  );
};

const Row: React.FC<{ lang: Lang; label: string; value: React.ReactNode; at: number; f: number }> = ({ lang, label, value, at, f }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 30, width: 820, paddingBlock: 18, borderBottom: "1px solid rgba(217,176,100,0.28)", opacity: fadeIn(f, at, 12), transform: `translateY(${rise(f, at, 14)}px)` }}>
    <span style={{ fontFamily: uiFont(lang), fontSize: lang === "fa" ? 38 : 40, color: C.quiet }}>{label}</span>
    <span style={{ fontFamily: uiFont(lang), fontSize: lang === "fa" ? 46 : 50, color: C.ink, fontVariantNumeric: "lining-nums" }}>{value}</span>
  </div>
);

const Facts: React.FC<{ p: CardProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const k = K_WORDS[p.lang];
  const t = L[p.lang];
  const n = (x: number) => numIn(p.lang, x);
  const factsAt = lineAt(s, "facts") ?? 20;
  const partsAt = lineAt(s, "parts") ?? factsAt + 90;
  const sajdaAt = lineAt(s, "sajda") ?? partsAt + 90;
  const refs = p.sajdas.map((x) => (fa ? `${faNum(p.surah.number)}:${faNum(x.aya)}` : `${p.surah.number}:${x.aya}`)).join(fa ? "، " : ", ");
  const place = p.surah.revelationPlace === "meccan" ? t.meccan : t.medinan;
  return (
    <AbsoluteFill style={{ opacity: fadeOut(f, s.dur, ST.OUT) }}>
      <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: SAFE.top + 10, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: fadeIn(f, 0) }}>
        <div style={{ fontFamily: uiFont(p.lang), fontSize: fa ? 44 : 46, color: C.gold, fontVariantNumeric: "lining-nums" }}>{t.of(p.series.n, p.series.of)}</div>
        <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 70, lineHeight: 1.6, color: C.star }}>
          {p.surah.nameArabic}
        </div>
      </div>
      <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: 560, width: W, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Row lang={p.lang} label={k.verses} value={n(p.surah.ayahCount)} at={factsAt} f={f} />
        <Row lang={p.lang} label={k.place} value={place} at={factsAt + 8} f={f} />
        <Row lang={p.lang} label={k.order} value={k.orderValue(p.surah.revelationOrder)} at={factsAt + 16} f={f} />
        <Row lang={p.lang} label={k.sections} value={n(p.surah.rukus)} at={partsAt} f={f} />
        <Row lang={p.lang} label={k.juz} value={k.span(p.juz[0], p.juz[1])} at={partsAt + 8} f={f} />
        <Row lang={p.lang} label={k.pages} value={k.span(p.pages[0], p.pages[1])} at={partsAt + 16} f={f} />
        {p.sajdas.length ? (
          <Row
            lang={p.lang}
            label={k.sajda}
            value={
              <span dir="ltr" style={{ fontSize: "0.86em" }}>
                {refs}
              </span>
            }
            at={sajdaAt}
            f={f}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const End: React.FC<{ p: CardProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const t = L[p.lang];
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
          </>,
        )}
        {block(26, <div style={{ fontFamily: ui, fontSize: fa ? 28 : 30, color: C.translation, lineHeight: fa ? 1.8 : 1.35, textAlign: "center", maxWidth: 840 }}>{K_WORDS[p.lang].rule}</div>)}
        {said ? <div style={{ opacity: fadeIn(f, said.from - s.from), fontFamily: ui, fontStyle: fa ? "normal" : "italic", fontSize: fa ? 30 : 33, color: C.ink, lineHeight: fa ? 1.8 : 1.35, textAlign: "center", maxWidth: 840 }}>{said.show}</div> : null}
        <Divider width={300} style={{ opacity: fadeIn(f, 32) }} />
        <div style={{ opacity: fadeIn(f, 36), display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: FONT.en, fontSize: 44, color: C.gold, letterSpacing: "0.04em", direction: "ltr" }}>{SITE}</div>
          {p.voice.lines.length ? <div style={{ fontFamily: ui, fontSize: fa ? 26 : 27, color: C.quiet }}>{t.voiceFacts}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * The surah drawn from its own verses: a ring with one spoke per verse, its length by the
 * verse's word count (counted in the Tanzil text, Basmala apart), drawn in as the card opens.
 */
const VerseRing: React.FC<{ words: number[]; f: number; size: number }> = ({ words, f, size }) => {
  if (!words.length) return null;
  const max = Math.max(...words);
  const R0 = size * 0.3;
  const R1 = size * 0.5;
  const c = size / 2;
  const n = words.length;
  const drawn = interpolate(f, [4, 46], [0, n], clamp);
  return (
    <svg width={size} height={size} style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", opacity: 0.85 }}>
      {words.map((w, i) => {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const r = R0 + (R1 - R0) * (0.15 + 0.85 * (w / max));
        const k = Math.max(0, Math.min(1, drawn - i));
        const rr = R0 + (r - R0) * k;
        return <line key={i} x1={c + Math.cos(a) * R0} y1={c + Math.sin(a) * R0} x2={c + Math.cos(a) * rr} y2={c + Math.sin(a) * rr} stroke={C.gold} strokeWidth={Math.max(1, Math.min(5, (size * 2.4) / n))} strokeLinecap="round" opacity={0.25 + 0.6 * k} />;
      })}
      <circle cx={c} cy={c} r={R0 - 6} fill="none" stroke={C.gold} strokeWidth={1.2} opacity={0.5} />
    </svg>
  );
};

/** The opening ayah with the qari (the basmala line first, from his recitation of 1:1), each word lit as he reaches it. */
const Recite: React.FC<{ p: CardProps; s: Scene }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const r = p.recite;
  if (!r) return null;
  const fa = p.lang === "fa";
  const a = r.ayahs[0]!;
  const split = splitLeadingBasmala(r.surah.number, a.ayahNumber, a.text, r.opening);
  const clips = (s as InsightScene).clips ?? [];
  const at = (ayah: number | null) => {
    const c = clips.find((x) => x.ayah === ayah);
    return c ? c.from - s.from : 14;
  };
  const verse = p.qari?.verses.find((v) => v.ayah === a.ayahNumber) ?? null;
  const basmala = p.qari?.basmala ?? null;
  const o = Math.min(fadeIn(f, 0, 14), fadeOut(f, s.dur, ST.OUT));
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <Lamp warm={interpolate(f, [4, 24], [0.3, 1], clamp)} cy={0.42} />
      <div style={{ position: "absolute", top: SAFE.top + 20, width: W, textAlign: "center", fontFamily: uiFont(p.lang), fontSize: 40, color: C.gold }}>
        <span dir="ltr">{fa ? `${faNum(r.surah.number)}:${faNum(a.ayahNumber)}` : `${r.surah.number}:${a.ayahNumber}`}</span>
      </div>
      <div style={{ position: "absolute", top: SAFE.top + 110, bottom: 1920 - SAFE.bottom + 40, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        {split ? (
          <Fit width={820} maxHeight={140} max={70} min={34} measureKey={split.basmala} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.8, textAlign: "center", color: C.star }}>
            <LitText text={split.basmala} clip={basmala} t={(f - at(null)) / 30} plain={C.star} />
          </Fit>
        ) : null}
        <Fit width={840} maxHeight={520} max={104} min={36} measureKey={a.text} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.85, textAlign: "center", textWrap: "balance" }}>
          <LitText text={split ? split.rest : a.text} clip={verse} t={(f - at(a.ayahNumber)) / 30} after={<AyahSeal label={fa ? faNum(a.ayahNumber) : arNum(a.ayahNumber)} font={fa ? FONT.fa : FONT.quran} />} />
        </Fit>
        {a.translation ? (
          <div style={{ marginTop: 20, opacity: fadeIn(f, at(a.ayahNumber) + 20, 14) }}>
            <Fit width={820} maxHeight={260} max={fa ? 42 : 46} min={24} measureKey={a.translation} lang={p.lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: uiFont(p.lang), lineHeight: fa ? 1.8 : 1.35, textAlign: "center", color: C.translation, textWrap: "balance" }}>
              {a.translation}
            </Fit>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

const VIEWS = { title: Title, recite: Recite, facts: Facts, end: End } as const;

export const CardReel: React.FC<CardProps> = (p) => {
  applyStudio(p.studio);
  const t = cardTimeline(p);
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={t.total} seed={p.surah.number} muted />
      <MushafFrame />
      {t.scenes.map((s) => {
        const View = VIEWS[s.id as keyof typeof VIEWS];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.dur} name={s.id}>
            <View p={p} s={s} />
          </Sequence>
        );
      })}
      <Narrated scenes={t.scenes} lang={p.lang} subtitlesUntil={t.scenes.length - 1} />
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
