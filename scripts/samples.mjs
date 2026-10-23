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
