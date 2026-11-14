// «Verse & meaning» / «آیه و معنی» in the lamp style (owner, 2026-11-13: the new video style, in
// Siraj's own look). What changes against the classic look (src/Verse.tsx), the rules of the
// hub's social audit of 2026-11-13 and the style guide:
//  - no opening card: the ayah stands on screen from the first frame under a big title that says
//    which surah this is and what the Reel does («سورهٔ العصر / آیه به آیه، با معنا»), and the qari
//    begins 0.6 s in; the reference (verse k of n) and the translator stay with every ayah;
//  - (review of 2026-11-14) the translation stands with its ayah from the card's first frame, at
//    42 px or more, while the qari recites; the narrator still reads it after him, never over him;
//    the Arabic is 7:1 or more on the cream; the lamp sits low, under the translation, so the
//    picture is filled to the bottom of the safe zone; the sources are one line (details in the caption);
//  - cream ground, a small golden glow behind a modern oil lamp that warms while the qari recites,
//    the words lit in deep emerald, the translation in a naskh face (Persian) or Garamond;
//  - a slow camera: the ground breathes in from the first frame and is home again on the last; each
//    ayah pushes in a little; nothing cuts, shakes or flashes; cards give way one after the other,
//    never two texts over each other;
//  - every text inside the measured safe zones of the apps (src/lamp/zones.ts), nothing under 40 px;
//  - the sources at the close with the small channel badge, then the first picture again (loop).
// Every ayah and translation string is the API's own, exactly as stored. No music, no bed.
import React from "react";
import { AbsoluteFill, Audio, Freeze, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { splitLeadingBasmala } from "../basmala";
import { Fit } from "../Fit";
import { L, QARI_FA, SITE } from "../labels";
import { AyahSeal } from "../ornament";
import type { VerseProps } from "../props";
import { applyStudio } from "../studio";
import { C, FONT, arNum, easeInOut, faNum } from "../theme";
import { VT, VT_LAMP, verseTimeline, type VerseCard } from "../timelines";
import { LitText, SpokenText } from "../Verse";
import { Badge, Ground } from "./kit";
import { Probe } from "./Probe";
import { COL, COL_W, COL_X, MIN_TEXT, MIN_TRANSLATION, ZONES } from "./zones";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** The lamp sits low, under the translation: the lower half of the frame is never empty. */
const LAMP_AT = { x: COL_X, y: 1446, size: 150 };
/** the title: which surah and what this Reel is, from the first frame to the last */
const TITLE_TOP = ZONES.top + 14;
/** the Arabic of an ayah (with the basmala line over ayah 1) */
const ARABIC = { top: 476, bottom: 930 };
/** the translation and its reference, under the Arabic and above the lamp */
const MEANING = { top: 948, bottom: LAMP_AT.y - 80 };
const TEXT_W = COL_W - 40;

/** A card shows alone: it fades out in the first half of the cross-fade and the next fades in in the second. */
const cardOpacity = (f: number, dur: number, first: boolean) =>
  Math.min(first ? 1 : interpolate(f, [VT.XF * 0.5, VT.XF], [0, 1], { ...clamp, easing: easeInOut }), interpolate(f, [dur - VT.XF, dur - VT.XF * 0.5], [1, 0], { ...clamp, easing: easeInOut }));

/** The title's second line: what the Reel does (7 framing words at most with the surah's name). */
const whatLine = (p: VerseProps) => {
  if (p.lang === "fa") return p.whole ? "آیه به آیه، با معنا" : L.fa.range(p.from, p.to);
  return p.whole ? "Verse by verse, with meaning" : `Verses ${p.from}–${p.to}, with meaning`;
};
const titleOf = (p: VerseProps) => (p.lang === "fa" ? `سورهٔ ${p.surah.nameArabic}` : `Surah ${p.surah.tname}`);
/** Under each translation: the verse (k of n, or surah:verse) and the translator, one line. */
const refLine = (p: VerseProps, k: number) =>
  p.lang === "fa" ? `آیهٔ ${faNum(k)} از ${faNum(p.ayahs.length)}؛ ترجمهٔ ${p.source.translation.translatorName}` : `${p.surah.number}:${k} · ${p.source.translation.translatorName}`;

/** The title from the first frame: the surah in big letters, then what this is; the ayah dots under it. */
const Title: React.FC<{ p: VerseProps; k: number }> = ({ p, k }) => {
  const fa = p.lang === "fa";
  return (
    <div style={{ position: "absolute", top: TITLE_TOP, left: COL.left, width: COL_W, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div data-role="title" data-b="title" dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <Fit width={COL_W} maxHeight={124} max={86} min={56} measureKey={titleOf(p)} lang={p.lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: fa ? FONT.fa : FONT.en, fontWeight: fa ? 800 : 600, lineHeight: 1.3, textAlign: "center", color: C.star, whiteSpace: "nowrap" }}>
          {titleOf(p)}
        </Fit>
        <div style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: fa ? 46 : 48, fontWeight: fa ? 600 : 500, lineHeight: 1.35, color: C.gold, textAlign: "center", fontVariantNumeric: "lining-nums" }}>{whatLine(p)}</div>
      </div>
      <div style={{ display: "flex", gap: 12, direction: fa ? "rtl" : "ltr", marginTop: 8 }}>
        {p.ayahs.length > 1 && p.ayahs.length <= 40
          ? p.ayahs.map((a) => <div key={a.ayahNumber} style={{ width: 12, height: 12, borderRadius: 6, border: `2px solid ${C.gold}`, background: a.ayahNumber <= k ? C.gold : "transparent" }} />)
          : null}
      </div>
    </div>
  );
};

/** One ayah: the Arabic lit word by word and, from the same first frame, its translation and reference. */
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
  // the ayah pushes in a little while it is read; the first one also arrives (rises and settles)
  // in its first 1.7 s, so the opening moves from the first frame
  const push = interpolate(f, [0, card.dur], [1, 1.025], clamp);
  const arrive = card.index === 0 ? interpolate(f, [0, 50], [0, 1], { ...clamp, easing: easeInOut }) : 1;
  const camera = `translateY(${((1 - arrive) * 26).toFixed(1)}px) scale(${(push * (0.96 + 0.04 * arrive)).toFixed(4)})`;
  const tVerse = (f - card.verseAt) / fps;
  const tBasmala = card.basmalaAt === null ? -1 : (f - card.basmalaAt) / fps;
  const tNarr = (f - card.narrAt) / fps;
  const seal = fa ? faNum(a.ayahNumber) : arNum(a.ayahNumber);
  const trSize = fa ? { max: 62, min: 46 } : { max: 64, min: 46 };
  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          top: ARABIC.top,
          left: COL.left,
          width: COL_W,
          height: ARABIC.bottom - ARABIC.top,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: camera,
          transformOrigin: `${COL_W / 2}px ${(ARABIC.bottom - ARABIC.top) / 2}px`,
        }}
      >
        {split ? (
          <Fit width={TEXT_W} maxHeight={120} max={64} min={46} measureKey={split.basmala} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.8, textAlign: "center", textWrap: "balance", marginBottom: 4, color: C.star }}>
            <span data-role="quote" data-q={`a${a.ayahNumber}`} data-b={`basmala-${a.ayahNumber}`}>
              <LitText text={split.basmala} clip={basmalaClip} t={tBasmala} plain={C.star} />
            </span>
          </Fit>
        ) : null}
        <Fit width={TEXT_W} maxHeight={ARABIC.bottom - ARABIC.top - 36 - (split ? 130 : 0)} max={108} min={52} measureKey={a.text} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.85, textAlign: "center", textWrap: "balance" }}>
          <span data-role="quote" data-q={`a${a.ayahNumber}`} data-b={`ayah-${a.ayahNumber}`}>
            <LitText text={body} clip={clip} t={tVerse} after={<AyahSeal label={seal} font={fa ? FONT.fa : FONT.quran} />} />
          </span>
        </Fit>
      </div>
      <div style={{ position: "absolute", top: MEANING.top, left: COL.left, width: COL_W, height: MEANING.bottom - MEANING.top, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 90, height: 2, background: `linear-gradient(90deg, transparent, ${C.gold})` }} />
          <div style={{ width: 9, height: 9, borderRadius: 5, background: C.gold }} />
          <div style={{ width: 90, height: 2, background: `linear-gradient(90deg, ${C.gold}, transparent)` }} />
        </div>
        <Fit
          width={TEXT_W}
          maxHeight={MEANING.bottom - MEANING.top - 150}
          max={trSize.max}
          min={Math.max(trSize.min, MIN_TRANSLATION)}
          measureKey={a.translation}
          lang={p.lang}
          dir={fa ? "rtl" : "ltr"}
          style={{ fontFamily: fa ? FONT.naskh : FONT.en, fontWeight: fa ? 600 : 500, lineHeight: fa ? 1.75 : 1.32, textAlign: "center", textWrap: "balance", color: C.translation }}
        >
          <span data-role="quote" data-q={`t${a.ayahNumber}`} data-b={`tr-${a.ayahNumber}`}>
            <SpokenText text={a.translation} words={narration?.words} t={tNarr} />
          </span>
        </Fit>
        <div data-role="source" data-b={`ref-${a.ayahNumber}`} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: MIN_TEXT + 2, fontWeight: 500, color: C.brassDeep, lineHeight: 1.35, textAlign: "center", maxWidth: TEXT_W, fontVariantNumeric: "lining-nums" }}>
          {refLine(p, a.ayahNumber)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** The sources: one line, large enough to read; the details are in the caption. The badge comes in at its end. */
const Sources: React.FC<{ p: VerseProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const tr = p.source.translation;
  const qari = p.qari ? (fa ? (QARI_FA[p.qari.recitationId] ?? null) : p.qari.reciter.name) : null;
  const o = Math.min(interpolate(f, [0, VT.XF], [0, 1], { ...clamp, easing: easeInOut }), interpolate(f, [dur - 14, dur], [1, 0], { ...clamp, easing: easeInOut }));
  const line = fa
    ? [`متن قرآن از ${L.fa.tanzil}`, `ترجمهٔ ${tr.translatorName}`, qari ? `تلاوت ${qari}` : null].filter(Boolean).join("، ")
    : [`Text: ${p.source.quran.publisher}`, `Translation: ${tr.translatorName}`, qari ? `Recitation: ${qari}` : null].filter(Boolean).join(". ");
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div data-role="source" style={{ position: "absolute", top: ARABIC.top + 200, left: COL.left, width: COL_W, height: MEANING.bottom - ARABIC.top - 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
        <Fit width={TEXT_W} maxHeight={260} max={52} min={MIN_TEXT + 2} measureKey={line} lang={p.lang} dir={fa ? "rtl" : "ltr"} style={{ fontFamily: fa ? FONT.fa : FONT.en, fontWeight: 500, lineHeight: 1.55, textAlign: "center", textWrap: "balance", color: C.ink }}>
          {line}
        </Fit>
        <div dir="ltr" style={{ fontFamily: FONT.en, fontSize: 50, color: C.gold, letterSpacing: "0.03em" }}>
          {SITE}
        </div>
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
  // the ayah whose card stands now (its dot under the title is filled); all of them in the sources and the loop
  const current = f >= t.outro.from ? p.ayahs.length + (p.ayahs[0]?.ayahNumber ?? 1) : ([...t.cards].reverse().find((c) => f >= c.from + VT.XF * 0.5) ?? first)?.ayah ?? 0;
  const audio = (key: string, from: number, file: string | undefined, seconds: number | undefined) =>
    file && seconds ? (
      <Sequence key={key} from={from} durationInFrames={Math.ceil(seconds * 30) + 2} name={key}>
        <Audio src={staticFile(file)} />
      </Sequence>
    ) : null;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Ground total={t.total} lamp={LAMP_AT} warm={warm} seed={p.surah.number} />
      <Title p={p} k={current} />
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
