// The three samples of phase S1: what each one asks Siraj's API for and which voice reads it.
// Only the TRANSLATION (or, for the counts, the fixed English narration) is ever voiced; the
// Arabic text of the Quran is never synthesised.
export const SAMPLES = {
  "en-verse": {
    kind: "verse",
    surah: 112,
    lang: "en",
    // Kokoro-82M (Apache-2.0): one calm voice for every English video.
    voice: { engine: "kokoro", voice: "am_michael", speed: 0.9 },
  },
  "en-counts": {
    kind: "counts",
    lang: "en",
    voice: { engine: "kokoro", voice: "am_michael", speed: 1.0 },
  },
  "fa-verse": {
    kind: "verse",
    surah: 103,
    lang: "fa",
    // Mana-Persian-Piper (MIT) from Hugging Face; a length_scale above 1 reads more slowly.
    voice: { engine: "piper", model: "models/fa_IR-mana-medium.onnx", lengthScale: 1.12 },
  },
};

// The two PRIVATE previews of 24 October 2026 (branch preview/qari-voice, shown only to the
// owner): the qari's own recitation of every ayah with each word lit as he recites it, then the
// translation read by an ElevenLabs narrator. Only names, numbers and voice choices live here.
// `all` in the scripts still means the three S1 samples above; a preview is named on its own.
const ALAFASY = {
  // Quran Foundation (quran.com) chapter recitation 7: Mishari Rashid al-`Afasy, Murattal, Hafs.
  qfRecitationId: 7,
  name: "Mishary Rashid Alafasy",
  nameFa: "مشاری راشد العفاسی",
};
export const PREVIEWS = {
  "en-qari": {
    kind: "qari",
    surah: 112,
    lang: "en",
    nameLatin: "Al-Ikhlas",
    nameFa: "اخلاص",
    reciter: ALAFASY,
    narrator: {
      engine: "elevenlabs",
      model: "eleven_multilingual_v2",
      // George, a premade ElevenLabs voice: warm, mature, British storyteller.
      voiceId: "JBFqnCBsd6RMkjVDRZzb",
      voiceName: "George",
      settings: { stability: 0.6, similarity_boost: 0.8, style: 0.08, use_speaker_boost: true, speed: 0.92 },
    },
  },
  "fa-qari": {
    kind: "qari",
    surah: 103,
    lang: "fa",
    nameLatin: "Al-Asr",
    nameFa: "عصر",
    reciter: ALAFASY,
    narrator: {
      engine: "elevenlabs",
      model: "eleven_v3",
      // Shahram, the Persian narrator Bidar's living book uses (with Bidar's settings).
      voiceId: "rNb3hdSf0n4ROIbYC8Bl",
      voiceName: "Shahram",
      settings: { stability: 0.5, similarity_boost: 0.8, style: 0.12, use_speaker_boost: true },
    },
  },
};

/** Every sample and preview by name. */
export const ALL = { ...SAMPLES, ...PREVIEWS };
