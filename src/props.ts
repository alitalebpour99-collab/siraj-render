// The shapes of one render: scripts/fetch.mjs writes props/<job>.json from Siraj's public API
// (texts) and the Tanzil metadata (numbers), scripts/voice.mjs adds the narrator's lines
// (public/voice/<job>/), scripts/qari.mjs the qari's clips (public/qari/<job>/). Every string of
// an ayah or a translation is the API's own, exactly as served; no text lives in this code.

export type Lang = "en" | "fa";

export type Release = {
  releaseKey: string;
  kind: string;
  language: string;
  sourceTitle: string;
  publisher: string;
  canonicalUrl: string;
  licenseName: string;
  licenseUrl: string;
  rightsStatus: string;
  attributionText: string;
  upstreamVersion: string;
  exposedAt: string;
  recordCount: number;
  orthography: string | null;
};

export type MetadataSource = {
  title: string;
  url: string;
  licenseName: string;
  licenseUrl: string;
  sha256: string;
  copyrightNotice?: string;
};

/* ---------- Sound ---------- */

/** One narrated line: a levelled WAV under public/ and, from ElevenLabs, its word timings. */
export type VoiceLine = {
  id: string;
  /** public/ path of the levelled WAV made in the run (never committed) */
  file: string;
  seconds: number;
  /** [startMs, endMs] of each whitespace-separated word of the line, or absent */
  words?: Array<[number, number]>;
};

export type Voice = {
  /** what really read: ElevenLabs (made by the service), Kokoro / Piper (made here), or none */
  engine: "elevenlabs" | "kokoro" | "piper" | "none";
  /** e.g. "eleven_v3:<voiceId>", "kokoro-82m:am_michael:0.9" */
  voice: string | null;
  reason?: string;
  lines: VoiceLine[];
};

/** When a word (or the whole verse, in a fallback) is recited, in seconds from the clip's start. */
export type WordTime = { start: number; end: number };

/** One recited clip (an ayah, or the basmala before ayah 1), cut by scripts/qari.mjs in the run. */
export type QariClip = {
  id: string;
  /** null for the basmala */
  ayah: number | null;
  /** public/ path of the cut, levelled WAV (never committed) */
  file: string;
  seconds: number;
  /** "word": one timing per word of Siraj's text; "verse": the counts differ, the whole verse is lit */
  mode: "word" | "verse";
  words: WordTime[];
  sirajWords: number;
  qfWords: number;
  verseKey: string;
};

export type Qari = {
  /** quran-com-public: the public chapter files (preview only, never published) · quran-foundation: the licensed per-ayah files */
  source: "quran-com-public" | "quran-foundation";
  previewOnly: boolean;
  recitationId: number;
  reciter: { name: string; style: string | null; qirat: string | null };
  basmala: QariClip | null;
  verses: QariClip[];
  fallbacks: { verseKey: string; sirajWords: number; qfWords: number }[];
};

/* ---------- Verse & meaning ---------- */

export type SurahInfo = {
  number: number;
  ayahCount: number;
  nameArabic: string;
  revelationPlace: "meccan" | "medinan";
  revelationOrder: number;
  /** Tanzil's transliteration and English name (hash-checked metadata) */
  tname: string;
  ename: string;
  rukus: number;
};

export type Ayah = {
  ayahNumber: number;
  /** Verbatim protected text; rendered as stored. */
  text: string;
  /** Verbatim line of the named translation. */
  translation: string;
  locator: string;
  textHashSha256: string;
};

export type TranslationSource = { title: string; translatorName: string; language: string; termsText: string | null; release: Release };

export type VerseProps = {
  kind: "verse";
  id: string;
  lang: Lang;
  surah: SurahInfo;
  surahTotal: number;
  /** the whole surah, or verses from–to of it (its opening section) */
  whole: boolean;
  from: number;
  to: number;
  /** Stored text of ayah 1:1 of the same release, only to find where a basmala line ends. */
  opening: string | null;
  ayahs: Ayah[];
  source: { quran: Release; translation: TranslationSource; translationNote: string | null; surahMetadata: MetadataSource };
  voice: Voice;
  qari: Qari | null;
};

/* ---------- Counts and the surah card ---------- */

export type Narration = { id: string; show: string; say: string };
export type Metric = "overview" | "revelation-order" | "prostrations" | "divisions";

export type CountsSurah = { number: number; ayahCount: number; nameArabic: string; place: "meccan" | "medinan"; order: number };
export type Sajda = { sura: number; aya: number; type: string };

export type CountsProps = {
  kind: "counts";
  id: string;
  lang: Lang;
  metric: Metric;
  surahs: CountsSurah[];
  /** the numbers of this metric, as the manifest repeats them */
  numbers: Record<string, number | number[] | string>;
  sajdas: Sajda[];
  divisions: { surahs: number; juz: number; rukus: number; pages: number };
  narration: Narration[];
  source: { quran: Release; surahMetadata: MetadataSource };
  voice: Voice;
};

export type CardProps = {
  kind: "surah-card";
  id: string;
  lang: Lang;
  surah: SurahInfo;
  series: { n: number; of: number };
  juz: [number, number];
  pages: [number, number];
  sajdas: Array<{ aya: number; type: string }>;
  narration: Narration[];
  source: { quran: Release; surahMetadata: MetadataSource };
  voice: Voice;
};

export type AnyProps = VerseProps | CountsProps | CardProps;
