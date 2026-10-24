# siraj-render

The social videos of [Siraj](https://siraj.ahura.cloud) (Ahura), as a Remotion project
(1080×1920, 30 fps), rendered free on GitHub's machines.

**No text lives in this repository.** The Arabic text of the Quran (Tanzil Project), the
translations (Pickthall 1930 for English, Makarem for Persian) and the surah metadata are
fetched from Siraj's public API during each run (`scripts/fetch.mjs`) and rendered exactly as
served, with their source lines. The log shows counts and keys only.

**No music, no recitation, no figures.** Only the *translation* is read aloud, by a free
synthetic voice: [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0) for
English, [Mana-Persian-Piper](https://huggingface.co/MahtaFetrat/Mana-Persian-Piper) (MIT) for
Persian. The Arabic text is never synthesised. Pictures are generated geometry only.

| path | what |
|---|---|
| `scripts/samples.mjs` | the samples: which surah, which language, which voice |
| `scripts/fetch.mjs` | `props/<sample>.json` from the API (checked: verbatim flag, hash check, whole surah, same release) |
| `scripts/voice.mjs`, `scripts/tts.py` | one WAV per translated line into `public/voice/<sample>/` |
| `scripts/render.mjs` | MP4 (H.264, AAC 48 kHz, fast start), covers 1080×1920 and 1080×1350, check frames, `<sample>.sources.json` |
| `src/Verse.tsx` | «Verse & meaning»: hook, each ayah with its translation, sources |
| `src/Counts.tsx` | «Counts»: totals, Meccan / Medinan, longest and shortest, from the Tanzil metadata |
| `src/Cover.tsx` | the covers |
| `src/ornament.tsx` | the night with its star lattice, the mushaf frame, cartouche, seals, Siraj's lamp mark |
| `src/basmala.ts` | the basmala on its own line, as Siraj's reader sets it (same characters, two lines) |
| `public/fonts/` | Amiri Quran, Vazirmatn, EB Garamond, each with its SIL Open Font License |

## Run

`.github/workflows/samples.yml` runs on every push to `main` and by hand; the videos and
covers are the run's artifact `samples`. Nothing is published anywhere.

By hand on a machine with Node 22, Python 3.11, ffmpeg and espeak-ng (and enough memory for
Chrome):

```bash
npm ci && pip install -r scripts/requirements.txt
node scripts/fetch.mjs all && node scripts/voice.mjs all && node scripts/render.mjs all
```

Fonts: Amiri Quran © The Amiri Quran Project Authors; Vazirmatn © The Vazirmatn Project
Authors; EB Garamond © The EB Garamond Project Authors — all under the SIL Open Font License
1.1 (`public/fonts/OFL-*.txt`).

## Private qari preview (branch `preview/qari-voice` only)

Two preview videos for the owner, never published: `en-qari` (Surah 112) and `fa-qari`
(Surah 103). Each ayah is heard in the recitation of Mishary Rashid Alafasy (Quran Foundation,
chapter recitation 7) while each Arabic word lights up in time with his voice (the Quran
Foundation's word segments; where Siraj's word count differs from theirs the whole verse is lit
instead and the text is left as it is). Then the translation is read by an ElevenLabs narrator.
No music and no background sound.

| path | what |
|---|---|
| `scripts/narrate.mjs` | run on the owner's PC: the narrator's MP3s into `public/narration/<preview>/` (committed; the key never leaves the PC) |
| `scripts/qari.mjs` | run on GitHub: downloads the recitation and its timings, cuts one clip per ayah, levels the audio (`public/qari/`, never committed) |
| `src/Qari.tsx`, `src/light.tsx`, `src/qariTimeline.ts`, `src/words.ts` | the composition, the light, the timeline, the word cutting |
| `.github/workflows/qari-preview.yml` | renders both previews; artifact `qari-preview` (kept two days) |
