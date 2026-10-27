// One composition per format and language (the ids the service names a job by: en-verse,
// fa-verse, en-counts, fa-counts, en-surah-card, fa-surah-card), each with its two covers
// (<id>-cover 1080×1920, <id>-grid 1080×1350). The default props are empty on purpose: a render
// always gets its content from props/<job>.json (scripts/fetch.mjs, Siraj's API) and its sound
// from public/voice/<job>/ and public/qari/<job>/; no text lives in this code.
import React from "react";
import { Composition } from "remotion";
import { CardReel } from "./Card";
import { CountsReel } from "./Counts";
import { CardCover, CountsCover, VerseCover } from "./Cover";
import "./fonts";
import type { CardProps, CountsProps, Lang, MetadataSource, Release, VerseProps } from "./props";
import { FPS, H, W } from "./theme";
import { cardTimeline, countsTimeline, verseTimeline } from "./timelines";
import { VerseReel } from "./Verse";

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
const metadata: MetadataSource = { title: "", url: "https://siraj.ahura.cloud", licenseName: "", licenseUrl: "", sha256: "" };
const voice = { engine: "none" as const, voice: null, lines: [] };
const surah = { number: 1, ayahCount: 0, nameArabic: "", revelationPlace: "meccan" as const, revelationOrder: 0, tname: "", ename: "", rukus: 0 };

const emptyVerse = (lang: Lang): VerseProps => ({
  kind: "verse",
  id: "",
  lang,
  surah,
  surahTotal: 114,
  whole: true,
  from: 1,
  to: 1,
  opening: null,
  ayahs: [],
  source: { quran: release, translation: { title: "", translatorName: "", language: lang, termsText: null, release }, translationNote: null, surahMetadata: metadata },
  voice,
  qari: null,
});

const emptyCounts = (lang: Lang): CountsProps => ({
  kind: "counts",
  id: "",
  lang,
  metric: "overview",
  surahs: [],
  numbers: {},
  sajdas: [],
  divisions: { surahs: 0, juz: 0, rukus: 0, pages: 0 },
  narration: [],
  source: { quran: release, surahMetadata: metadata },
  voice,
});

const emptyCard = (lang: Lang): CardProps => ({
  kind: "surah-card",
  id: "",
  lang,
  surah,
  series: { n: 1, of: 114 },
  juz: [1, 1],
  pages: [1, 1],
  sajdas: [],
  narration: [],
  source: { quran: release, surahMetadata: metadata },
  voice,
});

const reel = { width: W, height: H, fps: FPS };
const grid = { width: 1080, height: 1350, fps: FPS };
const LANGS = ["en", "fa"] as const;

export const Root: React.FC = () => (
  <>
    {LANGS.map((lang) => (
      <React.Fragment key={lang}>
        <Composition id={`${lang}-verse`} component={VerseReel} {...reel} durationInFrames={300} defaultProps={emptyVerse(lang)} calculateMetadata={({ props }) => ({ durationInFrames: verseTimeline(props).total })} />
        <Composition id={`${lang}-verse-cover`} component={VerseCover} {...reel} durationInFrames={1} defaultProps={emptyVerse(lang)} />
        <Composition id={`${lang}-verse-grid`} component={VerseCover} {...grid} durationInFrames={1} defaultProps={emptyVerse(lang)} />
        <Composition id={`${lang}-counts`} component={CountsReel} {...reel} durationInFrames={300} defaultProps={emptyCounts(lang)} calculateMetadata={({ props }) => ({ durationInFrames: countsTimeline(props).total })} />
        <Composition id={`${lang}-counts-cover`} component={CountsCover} {...reel} durationInFrames={1} defaultProps={emptyCounts(lang)} />
        <Composition id={`${lang}-counts-grid`} component={CountsCover} {...grid} durationInFrames={1} defaultProps={emptyCounts(lang)} />
        <Composition id={`${lang}-surah-card`} component={CardReel} {...reel} durationInFrames={300} defaultProps={emptyCard(lang)} calculateMetadata={({ props }) => ({ durationInFrames: cardTimeline(props).total })} />
        <Composition id={`${lang}-surah-card-cover`} component={CardCover} {...reel} durationInFrames={1} defaultProps={emptyCard(lang)} />
        <Composition id={`${lang}-surah-card-grid`} component={CardCover} {...grid} durationInFrames={1} defaultProps={emptyCard(lang)} />
      </React.Fragment>
    ))}
  </>
);
