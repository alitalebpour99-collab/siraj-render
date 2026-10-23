// The covers: one still in the Reel's frame (1080×1920) and one for the profile grid
// (1080×1350). A cover says what its video says: the surah, its name and its number of
// verses, or the two counts.
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { L } from "./labels";
import { Cartouche, Divider, MushafFrame, Night, Seal, SirajMark } from "./ornament";
import type { CountsProps, VerseProps } from "./props";
import { C, FONT, enNum } from "./theme";

const Brand: React.FC<{ bottom: number }> = ({ bottom }) => (
  <div style={{ position: "absolute", bottom, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
    <SirajMark size={64} />
    <div style={{ fontFamily: FONT.en, fontSize: 38, color: C.gold, letterSpacing: "0.04em" }}>{L.en.site}</div>
  </div>
);

export const VerseCover: React.FC<VerseProps> = (p) => {
  const { height } = useVideoConfig();
  const tall = height > 1500;
  const fa = p.lang === "fa";
  const t = fa ? L.fa : L.en;
  const ui = fa ? FONT.fa : FONT.en;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Night still glowY={0.46} />
      <MushafFrame drawn inset={tall ? 30 : 26} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: tall ? 60 : 50 }}>
        <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: tall ? 44 : 34 }}>
          <div style={{ fontFamily: ui, fontSize: fa ? 70 : 64, fontWeight: 500, letterSpacing: fa ? 0 : "0.16em", textTransform: fa ? "none" : "uppercase", color: C.gold }}>{t.surah(p.surah.number)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Seal size={tall ? 104 : 92} />
            <Cartouche height={tall ? 236 : 208}>
              <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: tall ? 112 : 100, lineHeight: 1.5, color: C.star, paddingBottom: tall ? 42 : 36 }}>
                {p.surah.nameArabic}
              </div>
            </Cartouche>
            <Seal size={tall ? 104 : 92} />
          </div>
          <div style={{ fontFamily: ui, fontStyle: fa ? "normal" : "italic", fontSize: fa ? 66 : 76, color: C.ink }}>{t.verses(p.surah.ayahCount)}</div>
          <Divider width={340} />
          <div style={{ fontFamily: ui, fontSize: fa ? 36 : 40, color: C.translation, textAlign: "center", maxWidth: 860 }}>{t.withTranslation(p.source.translation.translatorName)}</div>
        </div>
      </AbsoluteFill>
      <Brand bottom={tall ? 330 : 96} />
    </AbsoluteFill>
  );
};

export const CountsCover: React.FC<CountsProps> = (p) => {
  const { height } = useVideoConfig();
  const tall = height > 1500;
  const num = { fontFamily: FONT.en, fontWeight: 500, color: C.brass, lineHeight: 1, fontVariantNumeric: "lining-nums" } as const;
  const unit = { fontFamily: FONT.en, fontSize: tall ? 66 : 58, color: C.ink, letterSpacing: "0.04em" } as const;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Night still glowY={0.45} />
      <MushafFrame drawn inset={tall ? 30 : 26} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: tall ? 80 : 60 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: tall ? 16 : 10 }}>
          <div style={{ fontFamily: FONT.en, fontSize: 40, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, marginBottom: tall ? 26 : 14 }}>The Quran · counts</div>
          <div style={{ ...num, fontSize: tall ? 300 : 240 }}>{enNum(p.totals.surahs)}</div>
          <div style={unit}>surahs</div>
          <Divider width={360} style={{ marginBlock: tall ? 30 : 18 }} />
          <div style={{ ...num, fontSize: tall ? 240 : 196 }}>{enNum(p.totals.ayahs)}</div>
          <div style={unit}>verses</div>
          <div style={{ fontFamily: FONT.en, fontStyle: "italic", fontSize: tall ? 34 : 30, color: C.quiet, marginTop: tall ? 30 : 18 }}>Kufan count, from the Tanzil metadata</div>
        </div>
      </AbsoluteFill>
      <Brand bottom={tall ? 330 : 80} />
    </AbsoluteFill>
  );
};
