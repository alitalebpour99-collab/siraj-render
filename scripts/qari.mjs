// The qari's part of a private preview, made ON THE GITHUB RUN (never committed):
//   node --experimental-strip-types scripts/qari.mjs en-qari fa-qari
// (props/<preview>.json must exist: scripts/fetch.mjs)
//
// 1. The Quran Foundation's chapter recitation of the preview's reciter with its word segments
//    (api.quran.com, no account needed), and the reciter's chapter file itself.
// 2. One clip per ayah, cut where the next ayah's first word begins; before ayah 1 (surahs
//    other than 1 and 9) the reciter's basmala, cut from his recitation of 1:1, because Siraj's
//    text (Tanzil) carries the basmala at the start of ayah 1 and the chapter file does not.
// 3. Word timings: Siraj's text is cut at its spaces (src/words.ts) and its word count compared
//    with the segments' count. When they agree each word gets its own timing; when they do not,
//    the text is left exactly as it is and the whole verse is lit for the whole clip (listed in
//    `fallbacks`).
// 4. The narrator's committed MP3s are checked against the API's translation (SHA-256) and
//    levelled; the qari's clips are levelled too. No music, no bed, nothing else is mixed in.
// Everything goes to public/qari/<preview>/ (git-ignored). The log shows ids, counts and times
// only, never a word of the text.
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { splitLeadingBasmala } from "../src/basmala.ts";
import { wordCount } from "../src/words.ts";
import { alignClip, cutPoints } from "./align.mjs";
import { PREVIEWS } from "./samples.mjs";

const QF = process.env.QF_API ?? "https://api.quran.com/api/v4";
const QDC = process.env.QDC_API ?? "https://api.qurancdn.com/api/qdc";
const QARI_LUFS = -16;
const NARRATOR_LUFS = -17;
const names = process.argv.slice(2);
if (!names.length) {
  console.error("usage: node --experimental-strip-types scripts/qari.mjs <preview> [more]");
  process.exit(2);
}
for (const n of names) if (!PREVIEWS[n]) throw new Error(`unknown preview ${n}`);

const check = (ok, what) => {
  if (!ok) throw new Error(`check failed: ${what}`);
};
const sha256 = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const UA = { "user-agent": "siraj-render private preview (github.com/alitalebpour99-collab/siraj-render)" };

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json", ...UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt >= 4) throw new Error(`${url}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function download(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 10000) return;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") ?? "";
      check(/audio|octet-stream/.test(type), `${url} is audio (${type})`);
      const buf = Buffer.from(await res.arrayBuffer());
      check(buf.length > 10000, `${url} has a body`);
      fs.writeFileSync(file, buf);
      return;
    } catch (error) {
      if (attempt >= 4) throw new Error(`${url}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

const durationMs = (file) => Math.round(Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim()) * 1000);

/** Integrated loudness (LUFS) of one file, or of several played one after another. */
function loudness(files) {
  const inputs = files.flatMap((f) => ["-i", f]);
  const graph = files.length > 1 ? `${files.map((_, i) => `[${i}:a]`).join("")}concat=n=${files.length}:v=0:a=1,ebur128=framelog=quiet` : "ebur128=framelog=quiet";
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...inputs, "-filter_complex", graph, "-f", "null", "-"], { encoding: "utf8" });
  const m = [...(run.stderr ?? "").matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  check(m, `loudness of ${files.map((f) => path.basename(f)).join(", ")}`);
  return Number(m[1]);
}

/**
 * A WAV (48 kHz stereo) of [fromMs, toMs] of `src`, with `gainDb`, a peak limit and short fades.
 * The trim is the first filter and the clock is reset after it, so the fades run on the clip's
 * own time (an output -ss left the filters on the chapter's time and faded later verses to
 * silence in the first run). Every clip must then be heard: a quiet clip stops the run.
 */
function cut(src, fromMs, toMs, gainDb, out) {
  const from = fromMs / 1000;
  const to = toMs / 1000;
  const dur = to - from;
  const chain = [
    `atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)}`,
    "asetpts=PTS-STARTPTS",
    `volume=${gainDb.toFixed(2)}dB`,
    "alimiter=limit=0.891:attack=5:release=60:level=0",
    "afade=t=in:st=0:d=0.012",
    `afade=t=out:st=${Math.max(0, dur - 0.06).toFixed(3)}:d=0.06`,
  ].join(",");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-af", chain, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out]);
  const got = durationMs(out) / 1000;
  const lufs = loudness([out]);
  check(Math.abs(got - dur) < 0.05, `${path.basename(out)} is ${dur.toFixed(3)} s long (got ${got.toFixed(3)})`);
  check(lufs > -30, `${path.basename(out)} is heard (${lufs.toFixed(1)} LUFS)`);
  console.log(`  cut ${path.basename(out)}: ${fromMs}–${toMs} ms, ${got.toFixed(2)} s, ${lufs.toFixed(1)} LUFS`);
  return Math.round(dur * 1000) / 1000;
}

/** A whole file (the narrator's MP3) as a levelled WAV. */
function level(src, gainDb, out) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-af", `volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.891:attack=5:release=60:level=0`, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out]);
  return durationMs(out) / 1000;
}

/** The reciter's chapter file and timings, cached per chapter for the run. */
const chapters = new Map();
async function chapter(recitationId, n) {
  const k = `${recitationId}/${n}`;
  if (chapters.has(k)) return chapters.get(k);
  const api = `${QF}/chapter_recitations/${recitationId}/${n}?segments=true`;
  const { audio_file: af } = await getJson(api);
  check(af && typeof af.audio_url === "string" && Array.isArray(af.timestamps), `chapter ${n}: audio file and timestamps`);
  af.timestamps.forEach((t, i) => check(t.verse_key === `${n}:${i + 1}`, `chapter ${n}: timestamp ${i + 1} in order`));
  fs.mkdirSync(path.join(".work", "qari"), { recursive: true });
  const file = path.join(".work", "qari", `${recitationId}-${n}.mp3`);
  await download(af.audio_url, file);
  const ms = durationMs(file);
  const lufs = loudness([file]);
  const c = { api, audioUrl: af.audio_url, file, ms, gain: QARI_LUFS - lufs, timestamps: af.timestamps, cuts: cutPoints(af.timestamps, ms) };
  console.log(`chapter ${n}: ${af.timestamps.length} verses, ${(ms / 1000).toFixed(2)} s, ${lufs.toFixed(1)} LUFS → gain ${c.gain.toFixed(1)} dB`);
  chapters.set(k, c);
  return c;
}

for (const name of names) {
  const sample = PREVIEWS[name];
  const props = JSON.parse(fs.readFileSync(path.join("props", `${name}.json`), "utf8"));
  check(props.kind === "qari" && props.surah.number === sample.surah, `${name}: props of the preview`);
  const out = path.join("public", "qari", name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  // the reciter
  const id = sample.reciter.qfRecitationId;
  let qfReciter = { name: null, style: null, qirat: null };
  try {
    const r = (await getJson(`${QDC}/audio/reciters/${id}`)).reciter;
    qfReciter = { name: r?.name ?? null, style: r?.style?.name ?? null, qirat: r?.qirat?.name ?? null };
  } catch (error) {
    console.log(`reciter ${id}: no details (${error.message})`);
  }

  // the ayahs
  const ch = await chapter(id, sample.surah);
  check(ch.timestamps.length === props.ayahs.length, `${name}: the recitation has every ayah`);
  const split = splitLeadingBasmala(props.surah.number, 1, props.ayahs[0].text, props.opening);
  const verses = props.ayahs.map((a, i) => {
    const t = ch.timestamps[i];
    const c = ch.cuts[i];
    const text = i === 0 && split ? split.rest : a.text;
    const sirajWords = wordCount(text);
    const file = path.join(out, `q-${a.ayahNumber}.wav`);
    const seconds = cut(ch.file, c.fromMs, c.toMs, ch.gain, file);
    const al = alignClip({ sirajWords, segments: t.segments, fromMs: c.fromMs, toMs: c.toMs });
    return { id: `q${a.ayahNumber}`, ayah: a.ayahNumber, file: `qari/${name}/q-${a.ayahNumber}.wav`, seconds, mode: al.mode, words: al.words, sirajWords, qfWords: al.qfWords, fromMs: c.fromMs, toMs: c.toMs, verseKey: t.verse_key };
  });

  // the basmala before ayah 1, from the reciter's recitation of 1:1
  let basmala = null;
  if (split) {
    const one = await chapter(id, 1);
    const t = one.timestamps[0];
    const c = one.cuts[0];
    const sirajWords = wordCount(split.basmala);
    const file = path.join(out, "q-basmala.wav");
    const seconds = cut(one.file, c.fromMs, c.toMs, one.gain, file);
    const al = alignClip({ sirajWords, segments: t.segments, fromMs: c.fromMs, toMs: c.toMs });
    basmala = { id: "qb", ayah: null, file: `qari/${name}/q-basmala.wav`, seconds, mode: al.mode, words: al.words, sirajWords, qfWords: al.qfWords, fromMs: c.fromMs, toMs: c.toMs, verseKey: "1:1 (basmala)" };
  }

  // the narrator: the committed MP3s must still match the API's translation
  const nm = JSON.parse(fs.readFileSync(path.join("public", "narration", name, "manifest.json"), "utf8"));
  check(nm.voiceId === sample.narrator.voiceId && nm.model === sample.narrator.model, `${name}: narration voice and model`);
  for (const a of props.ayahs) {
    const line = nm.lines.find((l) => l.id === `a${a.ayahNumber}`);
    check(line && line.textSha256 === sha256(a.translation), `${name}: the narration of ayah ${a.ayahNumber} reads the API's translation as served today`);
  }
  check(nm.lines.some((l) => l.id === "intro") && nm.lines.some((l) => l.id === "outro"), `${name}: intro and outro lines`);
  const mp3s = nm.lines.map((l) => path.join("public", l.file));
  const nLufs = loudness(mp3s);
  const nGain = NARRATOR_LUFS - nLufs;
  const lines = nm.lines.map((l) => {
    const file = path.join(out, `n-${l.id}.wav`);
    const seconds = level(path.join("public", l.file), nGain, file);
    return { id: l.id, reads: l.reads, ayah: l.ayah, file: `qari/${name}/n-${l.id}.wav`, seconds };
  });
  console.log(`${name}: narrator ${nm.voiceName} (${nm.voiceId}, ${nm.model}), ${lines.length} lines, ${nLufs.toFixed(1)} LUFS → gain ${nGain.toFixed(1)} dB`);

  const fallbacks = [basmala, ...verses].filter((v) => v && v.mode !== "word").map((v) => ({ verseKey: v.verseKey, sirajWords: v.sirajWords, qfWords: v.qfWords }));
  const manifest = {
    reciter: { name: sample.reciter.name, nameFa: sample.reciter.nameFa, qfRecitationId: id, qfName: qfReciter.name ?? sample.reciter.name, style: qfReciter.style, qirat: qfReciter.qirat },
    source: {
      timingsApi: [...new Set([ch.api, ...(split ? [chapters.get(`${id}/1`).api] : [])])],
      audio: [...new Set([ch.audioUrl, ...(split ? [chapters.get(`${id}/1`).audioUrl] : [])])],
      credit: "Recitation audio and word timings: Quran Foundation (quran.com / quranicaudio.com)",
    },
    basmala,
    verses,
    narration: { engine: nm.engine, model: nm.model, voiceId: nm.voiceId, voiceName: nm.voiceName, lines },
    fallbacks,
  };
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");

  // the timing table: clip, word, start, end (seconds from the clip's start); no text
  console.log(`${name}: word timings (seconds from the start of each clip)`);
  console.log("  clip            mode   word  start   end");
  for (const c of [basmala, ...verses].filter(Boolean)) {
    console.log(`  ${c.verseKey.padEnd(15)} ${c.mode.padEnd(6)} (Siraj ${c.sirajWords} words, QF ${c.qfWords}; cut ${c.fromMs}–${c.toMs} ms, ${c.seconds.toFixed(2)} s)`);
    c.words.forEach((w, i) => console.log(`  ${"".padEnd(15)} ${"".padEnd(6)} ${String(i + 1).padStart(4)}  ${w.start.toFixed(3)}  ${w.end.toFixed(3)}`));
  }
  console.log(`${name}: ${fallbacks.length ? `fell back to verse-level light: ${fallbacks.map((f) => `${f.verseKey} (Siraj ${f.sirajWords}, QF ${f.qfWords})`).join(", ")}` : "every clip is lit word by word"}`);
}
