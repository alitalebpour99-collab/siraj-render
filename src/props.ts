// The shapes scripts/fetch.mjs writes (props/<sample>.json) and scripts/voice.mjs adds (voice).
// Every string of an ayah or a translation is the API's own, exactly as served.

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
  sha256?: string;
  copyrightNotice?: string;
};

export type VoiceLine = { id: string; file: string; seconds: number };
export type Voice = { engine: "kokoro" | "piper" | "none"; voice: string | null; reason?: string; lines: VoiceLine[] };

export type Ayah = {
  ayahNumber: number;
  /** Verbatim protected text; rendered as stored. */
  text: string;
  /** Verbatim line of the named translation. */
  translation: string;
  locator: string;
  textHashSha256: string;
};

export type VerseProps = {
  kind: "verse";
  sample: string;
  lang: "en" | "fa";
  surah: { number: number; ayahCount: number; nameArabic: string; revelationPlace: "meccan" | "medinan"; revelationOrder: number | null };
  /** Stored text of ayah 1:1 of the same release, only to find where a basmala line ends. */
  opening: string | null;
  ayahs: Ayah[];
  source: {
    api: Record<string, string>;
    fetchedAt: string;
    quran: Release;
    translation: { title: string; translatorName: string; language: string; termsText: string | null; release: Release };
    translationNote: string | null;
    surahMetadata: MetadataSource;
  };
  voice: Voice;
};

export type CountsSurah = { number: number; ayahCount: number; nameArabic: string; place: "meccan" | "medinan" };
export type Narration = { id: string; show: string; say: string };

export type CountsProps = {
  kind: "counts";
  sample: string;
  lang: "en";
  surahs: CountsSurah[];
  totals: {
    surahs: number;
    ayahs: number;
    meccan: { surahs: number; ayahs: number };
    medinan: { surahs: number; ayahs: number };
    longest: { ayahs: number; surahs: number[] };
    shortest: { ayahs: number; surahs: number[] };
  };
  narration: Narration[];
  source: { api: Record<string, string>; fetchedAt: string; quran: Release; surahMetadata: MetadataSource };
  voice: Voice;
};

// ---------- the private qari previews (en-qari, fa-qari) ----------

/** When a word (or the whole verse, in a fallback) is recited, in seconds from the clip's start. */
export type WordTime = { start: number; end: number };

/** One recited clip (an ayah, or the basmala before ayah 1), cut by scripts/qari.mjs at build time. */
export type QariClip = {
  id: string;
  /** null for the basmala */
  ayah: number | null;
  /** public/ path of the cut WAV (never committed) */
  file: string;
  seconds: number;
  /** "word": one timing per word of Siraj's text; "verse": the counts differ, the whole verse is lit */
  mode: "word" | "verse";
  words: WordTime[];
  sirajWords: number;
  qfWords: number;
  /** where in the reciter's chapter file the clip was cut (ms) */
  fromMs: number;
  toMs: number;
  verseKey: string;
};

export type NarrationLine = {
  id: string;
  /** "intro" | "translation" | "outro" */
  reads: string;
  ayah: number | null;
  /** public/ path of the levelled WAV made at build time from the committed MP3 */
  file: string;
  seconds: number;
};

export type QariManifest = {
  reciter: { name: string; nameFa: string; qfRecitationId: number; qfName: string; style: string | null; qirat: string | null };
  source: { timingsApi: string[]; audio: string[]; credit: string };
  basmala: QariClip | null;
  verses: QariClip[];
  narration: { engine: string; model: string; voiceId: string; voiceName: string; lines: NarrationLine[] };
  fallbacks: { verseKey: string; sirajWords: number; qfWords: number }[];
};

export type QariProps = Omit<VerseProps, "kind" | "voice"> & {
  kind: "qari";
  meta: { nameLatin: string; nameFa: string; surahTotal: number };
  qari: QariManifest;
};

export type AnyProps = VerseProps | CountsProps | QariProps;
