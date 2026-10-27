// The covers: one still in the Reel's frame (1080×1920) and one for the profile grid
// (1080×1350). A cover says what its video says. The title and the numeral stay inside the
// middle 1080×1440 band of the tall cover (the 3:4 profile-grid crop); the grid image keeps
// 60 px side margins; a small brass source line at the foot.
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { SeriesMark } from "./Card";
import { numIn } from "./Counts";
import { C_WORDS, L, SITE } from "./labels";
import { Lamp, World } from "./light";
import { Cartouche, Divider, MushafFrame, Seal, SirajMark } from "./ornament";
import type { CardProps, CountsProps, Lang, VerseProps } from "./props";
import { applyStudio } from "./studio";
import { C, FONT } from "./theme";

const uiFont = (lang: Lang) => (lang === "fa" ? FONT.fa : FONT.en);

/** The frame of every cover: the still night, the drawn mushaf frame, the mark and a source line. */
const Frame: React.FC<{ seed: number; source: string; lang: Lang; children: React.ReactNode }> = ({ seed, source, lang, children }) => {
  const { height } = useVideoConfig();
  const tall = height > 1500;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <World total={1} still seed={seed} />
      <MushafFrame drawn inset={tall ? 30 : 26} />
      <Lamp warm={0.7} cy={0.45} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingInline: 60, paddingBottom: tall ? 80 : 70 }}>
        {children}
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: tall ? 300 : 70, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <SirajMark size={tall ? 60 : 52} />
          <div style={{ fontFamily: FONT.en, fontSize: tall ? 36 : 32, color: C.gold, letterSpacing: "0.04em" }}>{SITE}</div>
        </div>
        <div dir={lang === "fa" ? "rtl" : "ltr"} style={{ fontFamily: uiFont(lang), fontSize: 26, color: C.brass, opacity: 0.7, maxWidth: 940, textAlign: "center" }}>
          {source}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const VerseCover: React.FC<VerseProps> = (p) => {
  applyStudio(p.studio);
  const { height } = useVideoConfig();
  const tall = height > 1500;
  const fa = p.lang === "fa";
  const t = fa ? L.fa : L.en;
  const ui = uiFont(p.lang);
  const qari = p.qari?.reciter.name ?? null;
  const unit = p.whole ? t.verses(p.surah.ayahCount) : t.range(p.from, p.to);
  const source = fa ? `${L.fa.tanzil} · ${p.source.translation.translatorName}` : `${p.source.quran.publisher} · ${p.source.translation.translatorName}`;
  return (
    <Frame seed={p.surah.number} source={source} lang={p.lang}>
      <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: tall ? 36 : 24 }}>
        <div style={{ fontFamily: ui, fontSize: tall ? 60 : 50, fontWeight: 500, letterSpacing: fa ? 0 : "0.2em", fontVariantCaps: fa ? "normal" : "all-small-caps", fontVariantNumeric: "lining-nums", color: C.gold }}>{t.of(p.surah.number, p.surahTotal)}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Seal size={tall ? 100 : 84} />
          <Cartouche height={tall ? 230 : 196}>
            <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: tall ? 108 : 92, lineHeight: 1.5, color: C.star, paddingBottom: tall ? 40 : 34, textShadow: "0 0 22px rgba(224,172,79,0.4)" }}>
              {p.surah.nameArabic}
            </div>
          </Cartouche>
          <Seal size={tall ? 100 : 84} />
        </div>
        {fa ? null : <div style={{ fontFamily: FONT.en, fontStyle: "italic", fontSize: tall ? 84 : 70, color: C.ink }}>{p.surah.tname}</div>}
        <div style={{ fontFamily: ui, fontSize: tall ? (fa ? 62 : 58) : fa ? 52 : 50, color: C.translation }}>{unit}</div>
        <Divider width={tall ? 340 : 300} />
        {qari ? <div style={{ fontFamily: ui, fontSize: tall ? 40 : 34, color: C.gold, textAlign: "center", maxWidth: 900 }}>{t.recitedBy(qari)}</div> : null}
        <div style={{ fontFamily: ui, fontSize: tall ? 32 : 28, color: C.translation, textAlign: "center", maxWidth: 900 }}>{t.withTranslation(p.source.translation.translatorName)}</div>
      </div>
    </Frame>
  );
};

export const CountsCover: React.FC<CountsProps> = (p) => {
  applyStudio(null);
  const { height } = useVideoConfig();
  const tall = height > 1500;
  const fa = p.lang === "fa";
  const w = C_WORDS[p.lang];
  const ui = uiFont(p.lang);
  const n = (k: string) => Number(p.numbers[k]);
  const num = (size: number) => ({ fontFamily: ui, fontWeight: 500, color: C.brass, lineHeight: 1, fontVariantNumeric: "lining-nums", fontSize: tall ? size : Math.round(size * 0.8) }) as const;
  const unit = { fontFamily: ui, fontSize: tall ? 60 : 50, color: C.ink, letterSpacing: fa ? 0 : "0.04em" } as const;
  const head = { fontFamily: ui, fontSize: tall ? 40 : 36, fontWeight: 500, letterSpacing: fa ? 0 : "0.16em", textTransform: fa ? "none" : "uppercase", color: C.gold, marginBottom: tall ? 20 : 10 } as const;
  const rule = { fontFamily: ui, fontStyle: fa ? "normal" : "italic", fontSize: tall ? 32 : 28, color: C.quiet, marginTop: tall ? 26 : 14, textAlign: "center", maxWidth: 900 } as const;
  let body: React.ReactNode;
  switch (p.metric) {
    case "overview":
      body = (
        <>
          <div style={num(300)}>{numIn(p.lang, n("surahs"))}</div>
          <div style={unit}>{w.surahs}</div>
          <Divider width={360} style={{ marginBlock: tall ? 26 : 14 }} />
          <div style={num(240)}>{numIn(p.lang, n("ayahs"))}</div>
          <div style={unit}>{w.verses}</div>
          <div style={rule}>{w.kufan}</div>
        </>
      );
      break;
    case "revelation-order":
      body = (
        <>
          <div style={{ ...unit, fontSize: tall ? 64 : 54 }}>{w.orderTitle}</div>
          <Divider width={360} style={{ marginBlock: tall ? 26 : 14 }} />
          <div style={{ display: "flex", gap: 90, alignItems: "flex-end" }}>
            {[
              [n("first"), w.orderFirst],
              [n("last"), w.orderLast],
            ].map(([v, label]) => (
              <div key={String(label)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div style={{ ...unit, fontSize: tall ? 40 : 34, color: C.quiet }}>{w.surahWord(1)}</div>
                <div style={num(240)}>{numIn(p.lang, Number(v))}</div>
                <div style={unit}>{String(label)}</div>
              </div>
            ))}
          </div>
          <div style={rule}>{w.orderRule}</div>
        </>
      );
      break;
    case "prostrations":
      body = (
        <>
          <div style={num(320)}>{numIn(p.lang, n("places"))}</div>
          <div style={{ ...unit, textAlign: "center" }}>{w.sajdaTitle}</div>
          <Divider width={360} style={{ marginBlock: tall ? 26 : 14 }} />
          <div style={{ ...unit, color: C.brass }}>{`${numIn(p.lang, n("obligatory"))} ${w.obligatory}`}</div>
          <div style={rule}>{w.sajdaRule}</div>
        </>
      );
      break;
    default:
      body = (
        <>
          <div style={{ ...unit, fontSize: tall ? 64 : 54, textAlign: "center" }}>{w.divisionsTitle}</div>
          <Divider width={360} style={{ marginBlock: tall ? 26 : 14 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 360px)", gap: tall ? "40px 30px" : "24px 24px" }}>
            {[
              [p.divisions.juz, w.parts],
              [p.divisions.pages, w.pages],
            ].map(([v, label]) => (
              <div key={String(label)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={num(220)}>{numIn(p.lang, Number(v))}</div>
                <div style={{ ...unit, fontSize: tall ? 46 : 40 }}>{String(label)}</div>
              </div>
            ))}
          </div>
          <div style={rule}>{w.divisionsRule}</div>
        </>
      );
  }
  return (
    <Frame seed={7 + p.metric.length} source={p.source.surahMetadata.title} lang={p.lang}>
      <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: tall ? 14 : 8 }}>
        <div style={head}>{w.header}</div>
        {body}
      </div>
    </Frame>
  );
};

export const CardCover: React.FC<CardProps> = (p) => {
  applyStudio(p.studio);
  const { height } = useVideoConfig();
  const tall = height > 1500;
  return (
    <Frame seed={p.surah.number} source={p.source.surahMetadata.title} lang={p.lang}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: tall ? 36 : 22 }}>
        <SeriesMark p={p} size={tall ? 380 : 300} />
        <Cartouche height={tall ? 210 : 180}>
          <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: tall ? 98 : 84, lineHeight: 1.5, color: C.star, paddingBottom: tall ? 36 : 30 }}>
            {p.surah.nameArabic}
          </div>
        </Cartouche>
        {p.lang === "fa" ? null : <div style={{ fontFamily: FONT.en, fontStyle: "italic", fontSize: tall ? 80 : 66, color: C.ink }}>{p.surah.tname}</div>}
      </div>
    </Frame>
  );
};
