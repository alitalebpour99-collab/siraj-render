// One composition per sample, plus its two covers. The default props are empty on purpose:
// a render always gets its content from props/<sample>.json (scripts/fetch.mjs, Siraj's API)
// and its voice from public/voice/<sample>/manifest.json; no text lives in this code.
import React from "react";
import { Composition } from "remotion";
import { CountsReel, countsTimeline } from "./Counts";
import { CountsCover, VerseCover } from "./Cover";
import "./fonts";
import type { CountsProps, MetadataSource, QariProps, Release, VerseProps } from "./props";
import { QariCover, QariReel } from "./Qari";
import { qariTimeline } from "./qariTimeline";
import { FPS, H, W } from "./theme";
import { VerseReel, verseTimeline } from "./Verse";

const release: Release = {
  releaseKey: "",
  kind: "",
  language: "",
  sourceTitle: "",
  publisher: "",
  canonicalUrl: "https://siraj.ahura.cloud",
  licenseName: "",
  licenseUrl: "",
  rightsStatus: "",
  attributionText: "",
  upstreamVersion: "",
  exposedAt: "",
  recordCount: 0,
  orthography: null,
};
const metadata: MetadataSource = { title: "", url: "https://siraj.ahura.cloud", licenseName: "", licenseUrl: "" };
const emptyVoice = { engine: "none" as const, voice: null, lines: [] };

const emptyVerse = (lang: "en" | "fa"): VerseProps => ({
  kind: "verse",
  sample: "",
  lang,
  surah: { number: 0, ayahCount: 0, nameArabic: "", revelationPlace: "meccan", revelationOrder: null },
  opening: null,
  ayahs: [],
  source: {
    api: {},
    fetchedAt: "",
    quran: release,
    translation: { title: "", translatorName: "", language: lang, termsText: null, release },
    translationNote: null,
    surahMetadata: metadata,
  },
  voice: emptyVoice,
});

const emptyCounts: CountsProps = {
  kind: "counts",
  sample: "",
  lang: "en",
  surahs: [],
  totals: { surahs: 0, ayahs: 0, meccan: { surahs: 0, ayahs: 0 }, medinan: { surahs: 0, ayahs: 0 }, longest: { ayahs: 1, surahs: [] }, shortest: { ayahs: 0, surahs: [] } },
  narration: [],
  source: { api: {}, fetchedAt: "", quran: release, surahMetadata: metadata },
  voice: emptyVoice,
};

const emptyQari = (lang: "en" | "fa"): QariProps => {
  const { voice: _voice, kind: _kind, ...rest } = emptyVerse(lang);
  return {
    ...rest,
    kind: "qari",
    meta: { nameLatin: "", nameFa: "", surahTotal: 0 },
    qari: {
      reciter: { name: "", nameFa: "", qfRecitationId: 0, qfName: "", style: null, qirat: null },
      source: { timingsApi: [], audio: [], credit: "" },
      basmala: null,
      verses: [],
      narration: { engine: "", model: "", voiceId: "", voiceName: "", lines: [] },
      fallbacks: [],
    },
  };
};

const reel = { width: W, height: H, fps: FPS };
const grid = { width: 1080, height: 1350, fps: FPS };

export const Root: React.FC = () => (
  <>
    {(["en-verse", "fa-verse"] as const).map((id) => {
      const lang = id.startsWith("fa") ? "fa" : "en";
      return (
        <React.Fragment key={id}>
          <Composition id={id} component={VerseReel} {...reel} durationInFrames={300} defaultProps={emptyVerse(lang)} calculateMetadata={({ props }) => ({ durationInFrames: verseTimeline(props).total })} />
          <Composition id={`${id}-cover`} component={VerseCover} {...reel} durationInFrames={1} defaultProps={emptyVerse(lang)} />
          <Composition id={`${id}-grid`} component={VerseCover} {...grid} durationInFrames={1} defaultProps={emptyVerse(lang)} />
        </React.Fragment>
      );
    })}
    {(["en-qari", "fa-qari"] as const).map((id) => {
      const lang = id.startsWith("fa") ? "fa" : "en";
      return (
        <React.Fragment key={id}>
          <Composition id={id} component={QariReel} {...reel} durationInFrames={300} defaultProps={emptyQari(lang)} calculateMetadata={({ props }) => ({ durationInFrames: qariTimeline(props).total })} />
          <Composition id={`${id}-cover`} component={QariCover} {...reel} durationInFrames={1} defaultProps={emptyQari(lang)} />
        </React.Fragment>
      );
    })}
    <Composition id="en-counts" component={CountsReel} {...reel} durationInFrames={300} defaultProps={emptyCounts} calculateMetadata={({ props }) => ({ durationInFrames: countsTimeline(props).total })} />
    <Composition id="en-counts-cover" component={CountsCover} {...reel} durationInFrames={1} defaultProps={emptyCounts} />
    <Composition id="en-counts-grid" component={CountsCover} {...grid} durationInFrames={1} defaultProps={emptyCounts} />
  </>
);
