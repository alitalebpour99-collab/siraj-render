// The qari's part of a verse job, made ON THE GITHUB RUN and never committed:
//   node scripts/qari.mjs --job jobs/<id>.json        (props/<id>.json must exist)
//
// The job's `recitation` says where the recitation comes from (the service decides):
//   - "quran-foundation": the licensed route (the owner's Quran Foundation credentials): one
//     file per ayah with its word segments, addresses given in the job;
//   - "quran-com-public": the public chapter recitation of api.quran.com with its word
//     segments, cut here into one clip per ayah. PREVIEW ONLY: such a video is shown to the
//     owner and never published (the service holds it). A job with no recitation at all (a
//     service from before 2026-10-24) is treated the same way, with recitation 7.
// Before ayah 1 (surahs other than 1 and 9) the reciter's basmala, from his recitation of 1:1,
// because Siraj's text (Tanzil) carries the basmala at the start of ayah 1. Siraj's text is cut
// at its spaces (src/words.ts) and its word count compared with the segments' count: when they
// agree each word gets its own timing; when not, the text is left exactly as it is and the
// whole verse is lit for the whole clip. Every clip is levelled and must be heard; nothing else
// is mixed in. Everything goes to public/qari/<job>/ (git-ignored). When the recitation cannot
// be had, the video is made without it (and the manifest says so). The log shows ids, counts
// and times only, never a word of the text.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { splitLeadingBasmala } from "../src/basmala.ts";
import { wordCount } from "../src/words.ts";
import { alignClip, cutPoints } from "./align.mjs";
import { check, download, durationMs, getJson, jobArg, loudness, runMain } from "./lib.mjs";

const QURAN_COM = (process.env.QURAN_COM_API ?? "https://api.quran.com/api/v4").replace(/\/+$/, "");
const QDC = (process.env.QDC_API ?? "https://api.qurancdn.com/api/qdc").replace(/\/+$/, "");
const QARI_LUFS = -16;
/** The recitation the owner approved on 2026-10-24 (Mishary Rashid Alafasy, Murattal, Hafs). */
export const DEFAULT_RECITATION = 7;

/**
 * A WAV (48 kHz stereo) of [fromMs, toMs] of `src`, with `gainDb`, a peak limit and short fades.
 * The trim is the first filter and the clock is reset after it, so the fades run on the clip's
 * own time. Every clip must then be heard: a quiet clip stops the run.
 */
function cut(src, fromMs, toMs, gainDb, out, fileMs) {
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
  // a clip that runs to the end of the file may come out a little shorter than the file's header says
  const atEnd = toMs >= fileMs - 150;
  check(got <= dur + 0.05 && (got >= dur - 0.05 || atEnd), `${path.basename(out)} is ${dur.toFixed(3)} s long (got ${got.toFixed(3)})`);
  check(lufs > -30, `${path.basename(out)} is heard (${lufs.toFixed(1)} LUFS)`);
  const realTo = Math.min(toMs, fromMs + Math.round(got * 1000));
  console.log(`  cut ${path.basename(out)}: ${fromMs}–${realTo} ms, ${got.toFixed(3)} s, ${lufs.toFixed(1)} LUFS`);
  return { seconds: Math.round(((realTo - fromMs) / 1000) * 1000) / 1000, toMs: realTo };
}

/** The reciter's public chapter file and its timings, cached per chapter for the run. */
const chapters = new Map();
async function chapter(recitationId, n) {
  const k = `${recitationId}/${n}`;
  if (chapters.has(k)) return chapters.get(k);
  const { audio_file: af } = await getJson(`${QURAN_COM}/chapter_recitations/${recitationId}/${n}?segments=true`);
  check(af && typeof af.audio_url === "string" && Array.isArray(af.timestamps), `chapter ${n}: audio file and timestamps`);
  af.timestamps.forEach((t, i) => check(t.verse_key === `${n}:${i + 1}`, `chapter ${n}: timestamp ${i + 1} in order`));
  const file = path.resolve(".work", "qari", `${recitationId}-${n}.mp3`);
  await download(af.audio_url, file);
  const ms = durationMs(file);
  const c = { audioUrl: af.audio_url, file, ms, timestamps: af.timestamps, cuts: cutPoints(af.timestamps, ms) };
  console.log(`chapter ${n}: ${af.timestamps.length} verses, ${(ms / 1000).toFixed(2)} s`);
  chapters.set(k, c);
  return c;
}

/** The reciter's name, style and qirat from the public reciter record. */
async function reciterOf(recitationId) {
  try {
    const r = (await getJson(`${QDC}/audio/reciters/${recitationId}`, {}, 2)).reciter;
    if (r?.name) return { name: r.name, style: r.style?.name ?? null, qirat: r.qirat?.name ?? null };
  } catch (error) {
    console.log(`reciter ${recitationId}: no details from the reciter record (${error.message})`);
  }
  try {
    const list = (await getJson(`${QURAN_COM}/resources/recitations?language=en`, {}, 2)).recitations ?? [];
    const r = list.find((x) => x.id === recitationId);
    if (r) return { name: r.translated_name?.name ?? r.reciter_name, style: r.style ?? null, qirat: null };
  } catch (error) {
    console.log(`reciter ${recitationId}: no name from the recitation list (${error.message})`);
  }
  return { name: `Recitation ${recitationId}`, style: null, qirat: null };
}

/** The clips of the public chapter route. */
async function publicClips(props, id, out, split) {
  const ch = await chapter(id, props.surah.number);
  check(ch.timestamps.length === props.surah.ayahCount, "the recitation has every ayah of the surah");
  const first = ch.cuts[props.from - 1];
  const last = ch.cuts[props.to - 1];
  const lufs = loudness(ch.file, [first.fromMs / 1000, last.toMs / 1000]);
  const gain = QARI_LUFS - lufs;
  console.log(`  verses ${props.from}–${props.to}: ${lufs.toFixed(1)} LUFS → gain ${gain.toFixed(1)} dB`);
  const verses = props.ayahs.map((a) => {
    const t = ch.timestamps[a.ayahNumber - 1];
    const c = ch.cuts[a.ayahNumber - 1];
    const text = a.ayahNumber === 1 && split ? split.rest : a.text;
    const sirajWords = wordCount(text);
    const file = path.join(out, `q-${a.ayahNumber}.wav`);
    const { seconds, toMs } = cut(ch.file, c.fromMs, c.toMs, gain, file, ch.ms);
    const al = alignClip({ sirajWords, segments: t.segments, fromMs: c.fromMs, toMs });
    return { id: `q${a.ayahNumber}`, ayah: a.ayahNumber, file: `qari/${props.id}/q-${a.ayahNumber}.wav`, seconds, mode: al.mode, words: al.words, sirajWords, qfWords: al.qfWords, verseKey: t.verse_key };
  });
  let basmala = null;
  if (split) {
    const one = await chapter(id, 1);
    const t = one.timestamps[0];
    const c = one.cuts[0];
    const g = QARI_LUFS - loudness(one.file, [c.fromMs / 1000, c.toMs / 1000]);
    const file = path.join(out, "q-basmala.wav");
    const { seconds, toMs } = cut(one.file, c.fromMs, c.toMs, g, file, one.ms);
    const al = alignClip({ sirajWords: wordCount(split.basmala), segments: t.segments, fromMs: c.fromMs, toMs });
    basmala = { id: "qb", ayah: null, file: `qari/${props.id}/q-basmala.wav`, seconds, mode: al.mode, words: al.words, sirajWords: wordCount(split.basmala), qfWords: al.qfWords, verseKey: "1:1 (basmala)" };
  }
  return { verses, basmala };
}

/** The clips of the licensed route: one file per ayah, its segments on the file's own clock. */
async function licensedClips(props, rec, out, split) {
  const byKey = new Map((rec.ayahs ?? []).map((a) => [a.verseKey, a]));
  const raw = [];
  for (const a of props.ayahs) {
    const key = `${props.surah.number}:${a.ayahNumber}`;
    const r = byKey.get(key);
    check(r && typeof r.url === "string", `the recitation of ${key}`);
    const file = path.resolve(".work", "qari", `${props.id}-${a.ayahNumber}.mp3`);
    await download(r.url, file, 2000);
    raw.push({ a, r, file, ms: durationMs(file) });
  }
  const gain = QARI_LUFS - loudness(raw.map((x) => x.file));
  const verses = raw.map(({ a, r, file: src, ms }) => {
    const text = a.ayahNumber === 1 && split ? split.rest : a.text;
    const sirajWords = wordCount(text);
    const file = path.join(out, `q-${a.ayahNumber}.wav`);
    const { seconds, toMs } = cut(src, 0, ms, gain, file, ms);
    const al = alignClip({ sirajWords, segments: r.segments, fromMs: 0, toMs });
    return { id: `q${a.ayahNumber}`, ayah: a.ayahNumber, file: `qari/${props.id}/q-${a.ayahNumber}.wav`, seconds, mode: al.mode, words: al.words, sirajWords, qfWords: al.qfWords, verseKey: r.verseKey };
  });
  let basmala = null;
  if (split && rec.basmala?.url) {
    const src = path.resolve(".work", "qari", `${props.id}-basmala.mp3`);
    await download(rec.basmala.url, src, 2000);
    const ms = durationMs(src);
    const file = path.join(out, "q-basmala.wav");
    const { seconds, toMs } = cut(src, 0, ms, QARI_LUFS - loudness([src]), file, ms);
    const al = alignClip({ sirajWords: wordCount(split.basmala), segments: rec.basmala.segments, fromMs: 0, toMs });
    basmala = { id: "qb", ayah: null, file: `qari/${props.id}/q-basmala.wav`, seconds, mode: al.mode, words: al.words, sirajWords: wordCount(split.basmala), qfWords: al.qfWords, verseKey: "1:1 (basmala)" };
  }
  return { verses, basmala };
}

/** public/qari/<id>/manifest.json for a verse job, or null (no recitation; `reason` says why). */
export async function qariJob(job) {
  const props = JSON.parse(fs.readFileSync(path.join("props", `${job.id}.json`), "utf8"));
  if (props.kind !== "verse") return { qari: null, reason: "not a verse" };
  const out = path.join("public", "qari", job.id);
  fs.rmSync(out, { recursive: true, force: true });
  const rec = job.props.recitation ?? null;
  const licensed = rec?.source === "quran-foundation";
  const id = Number.isInteger(rec?.recitationId) && rec.recitationId > 0 ? rec.recitationId : DEFAULT_RECITATION;
  const split = props.from === 1 ? splitLeadingBasmala(props.surah.number, 1, props.ayahs[0].text, props.opening) : null;
  try {
    fs.mkdirSync(out, { recursive: true });
    const { verses, basmala } = licensed ? await licensedClips(props, rec, out, split) : await publicClips(props, id, out, split);
    const reciter = licensed ? { name: rec.reciterName ?? `Recitation ${id}`, style: rec.style ?? null, qirat: null } : await reciterOf(id);
    const fallbacks = [basmala, ...verses].filter((v) => v && v.mode !== "word").map((v) => ({ verseKey: v.verseKey, sirajWords: v.sirajWords, qfWords: v.qfWords }));
    const manifest = { source: licensed ? "quran-foundation" : "quran-com-public", previewOnly: !licensed, recitationId: id, reciter, basmala, verses, fallbacks };
    fs.writeFileSync(path.join(out, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
    console.log(`${job.id}: recitation ${manifest.source} ${id} (${reciter.name}${manifest.previewOnly ? ", preview only" : ""}), ${verses.length} clips${basmala ? " + basmala" : ""}`);
    console.log(`${job.id}: ${fallbacks.length ? `verse-level light for ${fallbacks.map((f) => `${f.verseKey} (Siraj ${f.sirajWords}, QF ${f.qfWords})`).join(", ")}` : "every clip is lit word by word"}`);
    return { qari: manifest, reason: null };
  } catch (error) {
    fs.rmSync(out, { recursive: true, force: true });
    const reason = String(error?.message ?? error).split("\n")[0].slice(0, 200);
    console.log(`${job.id}: no recitation (${reason}); the video is made without it`);
    return { qari: null, reason };
  }
}

runMain(import.meta, async (args) => {
  await qariJob(jobArg(args));
});
