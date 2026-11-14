# siraj-render

The social videos of [Siraj](https://siraj.ahura.cloud) (Ahura), as a Remotion project
(1080×1920, 30 fps), rendered free on GitHub's machines for the Siraj Social service: the
service plans each video, this repository takes one job at a time, renders it and hands the
files back (the contract: the service's `docs/renderer-handoff.md`). Nothing is published from
here and no artifact of a job is kept here.

**No text lives in this repository.** The Arabic text of the Quran (Tanzil Project), the
translations (Pickthall 1930 for English, Makarem for Persian) and the surah index come from
Siraj's public API during each run, the surah metadata (sections, parts, pages, prostrations)
from the Tanzil metadata file whose SHA-256 the API names; all are rendered exactly as served,
with their source lines, and checked against what the service planned. The log shows ids,
counts, keys and seconds only.

**The sound** (owner, 2026-10-24): every ayah is heard only from a real qari, each Arabic word
lit in brass as he recites it, the basmala line from his recitation of 1:1; then the narrator
reads the translation, after the qari and never over him. The narrator is the service's
ElevenLabs voice when the job carries its lines, else a free voice made here:
[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0) for English,
[Mana-Persian-Piper](https://huggingface.co/MahtaFetrat/Mana-Persian-Piper) (MIT) for Persian.
The Arabic is never synthesised. No music, no bed, no sound effects. The recitation is
downloaded and cut during the run only and is never committed or uploaded here: from the
licensed Quran Foundation route once the owner is registered, until then from the public
api.quran.com chapter files, and such a video is **preview only** (the service shows it to the
owner and never publishes it). Pictures are generated geometry only, no figures.

## Formats (`CAN` in `worker.yml`)

| composition | what |
|---|---|
| `en-verse`, `fa-verse` (`…:range`) | «Verse & meaning»: a whole surah or its opening section, the qari with the word light, the translation and its narrator, the sources |
| `en-counts`, `fa-counts` (`:overview`, `:revelation-order`, `:prostrations`, `:divisions`) | numbers counted from the Tanzil metadata, each with its counting rule |
| `en-surah-card`, `fa-surah-card` | «Surah n of 114»: verses, Meccan or Medinan, revelation order, sections, parts, pages, prostration; with `props.recite` the opening ayah with the qari and a ring of the verses drawn by their word counts |
| `fa-nahj-hikma`, `fa-kumayl`, `fa-dua-story`, `fa-tafsir` (S3e) | the books beside the Quran, read from Siraj in the run and hash-checked (`scripts/books.mjs`): a Nahj al-balagha saying, a Kumayl passage (whole lines, «the rest on Siraj» with the exact address), the dhikr Story (about nine seconds), the five-slide tafsir carousel (whole sentences of Tafsir Nemooneh exactly as served); the narrator reads the Persian only, never the Arabic; the translator and the qari are credited on screen, never spoken |
| `fa-occasion`, `en-occasion`, `en-mirror`, `fa-mirror` | the occasion (only after an announced month start; muted) and the Mirror (approve-first) |
| `<lang>-<format>:<episode>` (S3b) | the insight videos, 12–40 s, counted at render time from the whole Tanzil Simple text and the metadata with the rule printed on screen (`scripts/insights.mjs`, `scripts/episodes.mjs`): `only` (The Only… №), `myth-fact` (The Counts Test №), `meccan-medinan`, `counted`, `mushaf-map`, `middle`, `revelation-order`, `one-line`, `opening-letters`, `every-letter`, `quiz` (with its carousel twin); `names` and `closing-names` are approve-first (their search forms wait for the lead) |

Each has `<id>-cover` (1080×1920) and `<id>-grid` (1080×1350); the quiz also `<id>-slide` (its
carousel twin, 1080×1350). Every format honours the studio (`props.studio`: look lapis / night /
pewter / paper, motion, motes, frame, series number, word glow, pace, ending loop / next / source,
the Story cut). Search forms are locators (a verse and a word span), never typed words.

| path | what |
|---|---|
| `scripts/worker.mjs` | claims ONE job from the service, runs the steps below, uploads the video and covers, then the manifest (`failed=1` with one line on any error) |
| `scripts/books.mjs` (S3e) | Siraj's reader pages and tafsir route read (verbatim elements only), and the fixed rules that choose a passage; the service keeps a copy (`src/content/books.ts`) |
| `scripts/fetch.mjs` | `props/<job>.json` from Siraj's API and the Tanzil metadata, checked against the job's `expect` |
| `scripts/voice.mjs`, `scripts/tts.py`, `scripts/spoken.mjs` | the narrator's lines, levelled, into `public/voice/<job>/` |
| `scripts/spoken.mjs` (S3d) | the reading layer: a Persian `say` is plain spoken Persian (numbers in words, «سورهٔ پنجاه و پنج، آیهٔ یک», no digit, Latin letter, colon or semicolon, the source named as «پروژهٔ تَنزیل»); `show` keeps its digits; guarded by `scripts/reading.test.mjs` |
| `scripts/qari.mjs`, `scripts/align.mjs` | the qari's clips and word timings into `public/qari/<job>/` |
| `scripts/render.mjs`, `scripts/manifest.mjs` | the MP4, the covers, the sound checks (never two voices at once, every voice heard) and the manifest |
| `scripts/tanzil.mjs` | the metadata: parsed, hash-checked, cross-checked and counted as the service counts it |
| `src/Verse.tsx`, `src/Counts.tsx`, `src/Card.tsx`, `src/Cover.tsx` | the compositions |
| `src/timelines.ts` | when everything happens, shared by the compositions and the checks |
| `src/ornament.tsx`, `src/light.tsx` | the night, the mushaf frame, the cartouche, the seals, the moving light |
| `public/fonts/` | Amiri Quran, Vazirmatn, EB Garamond, each with its SIL Open Font License |

## The lamp style (2026-11-14)

The owner approved the new video style on 13 November and asked for it in each project's own
look. The verse and the insight Reels are drawn in Siraj's **lamp look**: warm cream, a deep
emerald for the light of the words and the lines, dark ink, a small golden glow behind a simple
modern oil lamp, the quoted Persian in a naskh face (Noto Naskh Arabic, OFL). No manuscript
border, no arabesque, no figure. Calm: things drift, breathe and push in slowly; nothing cuts,
shakes or flashes.

- **The first frame** shows the ayah (or the insight's hook head, 7 words or fewer) with its
  reference; no title card, no logo first. The qari begins 0.6 s in.
- **The source stays with the quote**: the surah and verse above every ayah, the translator under
  every translation; the sources at the close.
- **The camera** breathes in from frame 0 and is home again on the last frame; each ayah pushes in
  a little; the last frames fade back into the first picture, so the Reel loops.
- **The safe zones** of the apps (measured on the owner's screenshots, `src/lamp/zones.ts`): every
  text inside x 56–888, y 232–1583, 29 px (1.5 % of the frame) or larger; the insight pictures are
  set in that column at 92 %.
- **The channel badge**: «سراج» / «Siraj», a tiny heart and a tiny follow mark, a small pill at the
  bottom left of the safe area for 2.2 s at the close, gone before the loop. One master file.
- **Sound**: no music (the project's rule). The qari and the narrator only, levelled in two
  passes to −14 LUFS with the true peak at −1 dBTP or lower, measured on the encoded file and done
  once more when it is over (`scripts/finish.mjs`).
- **The gate** (`scripts/gate.mjs`): the page measures itself on its probe frames
  (`src/lamp/Probe.tsx`: boxes, sizes, opacities, word counts, hashes; never a text) and the file
  is measured with ffmpeg. Checks: `hook`, `hook-motion`, `still` (a change at least every
  3.5 s), `loop`, `safe`, `text-size`, `overlap`, `source`, `quote` (letter for letter as
  served), `persian` (no «·» or «|» beside Persian), `badge`, `loudness`. A Reel that fails is
  not handed in: the worker reports it failed for good with the reason in plain Persian.
- **Which Reels**: every verse Reel, and the insight formats whose samples passed the gate: The Counts Test, Meccan · Medinan, One Line (The Only… waits: its recitation scene stood still 3.9 s on one long recited word) (`LAMP_INSIGHTS` in `scripts/render.mjs`); the other insight formats and the counts, surah cards and books keep the classic look without the gate until a sample of theirs passes (`SIRAJ_LAMP_INSIGHTS`, a list or `all`, widens it).
- **Switches** (repository variables, unset = on): `SIRAJ_STYLE=classic` (the old look),
  `SIRAJ_BADGE=off`, `SIRAJ_GATE=warn` (report only) or `off`. Trials (`try.yml`) run the gate on
  `warn` and keep its report, a 360 px copy of the picture and a sheet of two frames a second.

## Runs

- `.github/workflows/worker.yml` — every 30 minutes and by hand: looks first (a run with nothing
  to do ends in seconds), then takes one job. Repository secret `SIRAJ_RENDER_SECRET`, variable
  `SIRAJ_SOCIAL_URL`. No artifact.
- `.github/workflows/try.yml` — by hand: renders jobs written as the service writes them, without
  the service; keeps stills, frames, covers, the JSON records, the picture of the video with no
  sound track and the narrator's own lines for one day (never the recitation). On the owner's PC
  `node scripts/sample-mux.mjs <trial dir> <out dir> [--eleven <dir>]` cuts the qari again from
  the public chapter files and makes the whole sample there (never committed or uploaded).
- `.github/workflows/check.yml` — typecheck and the unit tests (placeholders only) on every push.

Fonts: Amiri Quran © The Amiri Quran Project Authors; Vazirmatn © The Vazirmatn Project
Authors; EB Garamond © The EB Garamond Project Authors — all under the SIL Open Font License
1.1 (`public/fonts/OFL-*.txt`).
