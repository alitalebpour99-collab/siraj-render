// «Verse & meaning» (en) / «آیه و معنی» (fa): a whole surah, ayah by ayah. The Arabic text in
// Amiri Quran with its seal, under it the line of the named translation, the translation read
// by a synthetic voice with silence between the ayahs; a hook card first, the sources last.
// Every ayah and translation string is the API's, rendered exactly as stored.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { lastWordApart, splitLeadingBasmala } from "./basmala";
import { Fit } from "./Fit";
import { L, firstUrl, host } from "./labels";
import { AyahSeal, Cartouche, Divider, MushafFrame, Night, Seal, SirajMark } from "./ornament";
import type { VerseProps } from "./props";
import { C, FONT, SAFE, W, arNum, easeInOut, fadeIn, fadeOut, faNum, frames, rise } from "./theme";

const HOOK = 84;
const IN = 15;
const LEAD = 18;
const TAIL = 30;
const OUT = 12;
const END = 165;
/** The cards stand between the header and the lowest line Instagram leaves free. */
const H_BOTTOM = 1920 - SAFE.bottom + 20;

/** Where every card begins and how long it lasts, from the length of each voiced line. */
export function verseTimeline(p: VerseProps) {
  const byId = new Map((p.voice?.lines ?? []).map((l) => [l.id, l]));
  let at = HOOK;
  const cards = p.ayahs.map((a) => {
    const line = byId.get(`a${a.ayahNumber}`);
    // without a voice, the time a calm reader needs for the translation and a look at the Arabic
    const speak = line ? frames(line.seconds) : Math.max(75, 24 + Math.ceil(a.translation.length * 2.4) + Math.ceil(a.text.length * 0.5));
    const card = { ayah: a, from: at, dur: IN + LEAD + speak + TAIL + OUT, voiceAt: at + IN + LEAD, file: line?.file ?? null };
    at += card.dur;
    return card;
  });
  return { hook: { from: 0, dur: HOOK }, cards, end: { from: at, dur: END }, total: at + END };
}

const Hook: React.FC<{ p: VerseProps; dur: number }> = ({ p, dur }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const t = fa ? L.fa : L.en;
  const out = fadeOut(f, dur, 12);
  const open = interpolate(f, [18, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  const turn = interpolate(f, [20, 54], [-34, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut });
  const uiFont = fa ? FONT.fa : FONT.en;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: out, paddingBottom: 120 }}>
      <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34 }}>
        <div style={{ opacity: fadeIn(f, 10), transform: `translateY(${rise(f, 10)}px)`, fontFamily: uiFont, fontSize: fa ? 58 : 54, fontWeight: 500, letterSpacing: fa ? 0 : "0.16em", textTransform: fa ? "none" : "uppercase", color: C.gold }}>
          {t.surah(p.surah.number)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Seal size={118} turn={turn} style={{ opacity: fadeIn(f, 20, 20) }} />
          <Cartouche height={200} open={open}>
            <div lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, fontSize: 104, lineHeight: 1.5, color: C.star, paddingBottom: 14 }}>
              {p.surah.nameArabic}
            </div>
          </Cartouche>
          <Seal size={118} turn={-turn} style={{ opacity: fadeIn(f, 20, 20) }} />
        </div>
        <div style={{ opacity: fadeIn(f, 34), transform: `translateY(${rise(f, 34)}px)`, fontFamily: uiFont, fontStyle: fa ? "normal" : "italic", fontSize: fa ? 56 : 66, color: C.ink }}>
          {t.verses(p.surah.ayahCount)}
        </div>
        <div style={{ opacity: fadeIn(f, 46), fontFamily: uiFont, fontSize: fa ? 32 : 36, color: C.quiet, marginTop: 6 }}>{t.withTranslation(p.source.translation.translatorName)}</div>
      </div>
    </AbsoluteFill>
  );
};

const Header: React.FC<{ p: VerseProps; k: number; opacity: number }> = ({ p, k, opacity }) => {
  const fa = p.lang === "fa";
  const t = fa ? L.fa : L.en;
  return (
    <div dir={fa ? "rtl" : "ltr"} style={{ position: "absolute", top: SAFE.top - 30, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, opacity }}>
      <div style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: fa ? 34 : 34, fontWeight: 500, letterSpacing: fa ? 0 : "0.12em", textTransform: fa ? "none" : "uppercase", color: C.gold }}>
        {t.header(p.surah.number, k, p.ayahs.length)}
      </div>
      <div style={{ display: "flex", gap: 14, flexDirection: "row" }}>
        {p.ayahs.map((a) => (
          <div key={a.ayahNumber} style={{ width: 11, height: 11, borderRadius: 6, border: `1.5px solid ${C.gold}`, background: a.ayahNumber <= k ? C.gold : "transparent" }} />
        ))}
      </div>
    </div>
  );
};

const Card: React.FC<{ p: VerseProps; ayahIndex: number; dur: number }> = ({ p, ayahIndex, dur }) => {
  const f = useCurrentFrame();
  const a = p.ayahs[ayahIndex]!;
  const fa = p.lang === "fa";
  const split = splitLeadingBasmala(p.surah.number, a.ayahNumber, a.text, p.opening);
  const body = split ? split.rest : a.text;
  const { head, tail } = lastWordApart(body);
  const out = fadeOut(f, dur, OUT);
  const seal = fa ? faNum(a.ayahNumber) : arNum(a.ayahNumber);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <div style={{ position: "absolute", top: SAFE.top + 90, bottom: H_BOTTOM, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: fadeIn(f, 0, IN), transform: `translateY(${rise(f, 0)}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {split ? (
            <Fit width={860} maxHeight={124} max={64} min={34} measureKey={split.basmala} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.8, textAlign: "center", color: C.star, marginBottom: 14 }}>
              {split.basmala}
            </Fit>
          ) : null}
          <Fit width={860} maxHeight={split ? 540 : 640} max={98} min={40} measureKey={a.text} lang="ar" dir="rtl" style={{ fontFamily: FONT.quran, lineHeight: 1.9, textAlign: "center", color: C.ink }}>
            {head}
            <span style={{ whiteSpace: "nowrap" }}>
              {tail}
              {" "}
              <AyahSeal label={seal} font={fa ? FONT.fa : FONT.quran} />
            </span>
          </Fit>
        </div>
        <Divider width={320} style={{ marginBlock: 30, opacity: fadeIn(f, 4, IN) }} />
        <div style={{ opacity: fadeIn(f, 8, IN + 4), transform: `translateY(${rise(f, 8)}px)` }}>
          <Fit
            width={860}
            maxHeight={fa ? 420 : 400}
            max={fa ? 50 : 56}
            min={28}
            measureKey={a.translation}
            lang={p.lang}
            dir={fa ? "rtl" : "ltr"}
            style={{ fontFamily: fa ? FONT.fa : FONT.en, fontWeight: fa ? 400 : 500, lineHeight: fa ? 1.95 : 1.42, textAlign: "center", color: C.translation }}
          >
            {a.translation}
          </Fit>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Block: React.FC<{ label: string; children: React.ReactNode; f: number; at: number; fa: boolean }> = ({ label, children, f, at, fa }) => (
  <div style={{ opacity: fadeIn(f, at), transform: `translateY(${rise(f, at, 16)}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
    <div style={{ fontFamily: fa ? FONT.fa : FONT.en, fontSize: fa ? 28 : 28, fontWeight: 600, letterSpacing: fa ? 0 : "0.16em", textTransform: fa ? "none" : "uppercase", color: C.gold }}>{label}</div>
    {children}
  </div>
);

const End: React.FC<{ p: VerseProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const fa = p.lang === "fa";
  const q = p.source.quran;
  const tr = p.source.translation;
  const ui = fa ? FONT.fa : FONT.en;
  const big = { fontFamily: ui, fontSize: fa ? 36 : 40, color: C.ink, lineHeight: fa ? 1.8 : 1.3, maxWidth: 840 } as const;
  const small = { fontFamily: FONT.en, fontSize: 26, color: C.quiet, lineHeight: 1.35, maxWidth: 840, direction: "ltr" } as const;
  const makarem = firstUrl(tr.release.attributionText);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingTop: 40, paddingBottom: 1920 - SAFE.bottom - 40 }}>
      <div dir={fa ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 34, width: 880 }}>
        <div style={{ opacity: fadeIn(f, 0, 18) }}>
          <SirajMark size={104} />
        </div>
        <div style={{ opacity: fadeIn(f, 4), fontFamily: ui, fontSize: fa ? 44 : 46, color: C.gold, letterSpacing: fa ? 0 : "0.1em" }}>{fa ? L.fa.sources : L.en.sources}</div>
        <Block label={fa ? L.fa.quranText : L.en.quranText} f={f} at={10} fa={fa}>
          <div style={big}>{fa ? `${L.fa.tanzil}، ${host(q.canonicalUrl)}` : `${q.publisher}, ${host(q.canonicalUrl)}`}</div>
          <div style={small}>{`${q.sourceTitle} · ${q.licenseName}`}</div>
        </Block>
        <Block label={fa ? L.fa.translation : L.en.translation} f={f} at={20} fa={fa}>
          {fa ? (
            <>
              <div style={big}>{tr.translatorName}</div>
              <div style={{ ...big, fontSize: 30, color: C.translation }}>
                {makarem ? `${L.fa.translationSource}: ${L.fa.translatorSite}، ${host(makarem)}` : null}
                {makarem ? <br /> : null}
                {`${L.fa.translationFile}: ${L.fa.tanzil}، ${host(tr.release.canonicalUrl, true)}`}
              </div>
              {tr.termsText ? <div style={{ fontFamily: FONT.fa, fontSize: 25, lineHeight: 1.8, color: C.quiet, maxWidth: 840 }}>{tr.termsText}</div> : null}
            </>
          ) : (
            <>
              <div style={big}>{tr.release.attributionText}</div>
              {p.source.translationNote ? <div style={{ ...small, fontStyle: "italic", fontSize: 27 }}>{p.source.translationNote}</div> : null}
            </>
          )}
        </Block>
        <div style={{ opacity: fadeIn(f, 32), display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 6 }}>
          <div style={{ fontFamily: FONT.en, fontSize: 46, color: C.gold, letterSpacing: "0.04em", direction: "ltr" }}>{L.en.site}</div>
          {p.voice?.lines?.length ? <div style={{ fontFamily: ui, fontSize: fa ? 26 : 27, color: C.quiet }}>{fa ? L.fa.voice : L.en.voice}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const VerseReel: React.FC<VerseProps> = (p) => {
  const f = useCurrentFrame();
  const t = verseTimeline(p);
  const current = t.cards.findIndex((c) => f >= c.from && f < c.from + c.dur);
  const headerOpacity = t.cards.length ? Math.min(fadeIn(f, t.cards[0]!.from, 18), fadeOut(f, t.end.from, 12)) : 0;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <Night />
      <MushafFrame />
      <Sequence from={t.hook.from} durationInFrames={t.hook.dur} name="hook">
        <Hook p={p} dur={t.hook.dur} />
      </Sequence>
      {current >= 0 || (f >= (t.cards[0]?.from ?? Infinity) && f < t.end.from) ? <Header p={p} k={(current >= 0 ? current : 0) + 1} opacity={headerOpacity} /> : null}
      {t.cards.map((c, i) => (
        <Sequence key={c.ayah.ayahNumber} from={c.from} durationInFrames={c.dur} name={`ayah ${c.ayah.ayahNumber}`}>
          <Card p={p} ayahIndex={i} dur={c.dur} />
        </Sequence>
      ))}
      {t.cards.map((c) =>
        c.file ? (
          <Sequence key={`v${c.ayah.ayahNumber}`} from={c.voiceAt} name={`voice ${c.ayah.ayahNumber}`}>
            <Audio src={staticFile(c.file)} />
          </Sequence>
        ) : null,
      )}
      <Sequence from={t.end.from} durationInFrames={t.end.dur} name="sources">
        <End p={p} />
      </Sequence>
    </AbsoluteFill>
  );
};
