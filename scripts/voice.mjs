// The narrator of one job: one levelled WAV per line into public/voice/<job>/ and its
// manifest.json (ids, files, seconds, word timings; no text):
//   node scripts/voice.mjs --job jobs/<id>.json      (props/<id>.json must exist)
//
// What is read aloud: for a verse the TRANSLATION of each ayah, exactly as the API served it;
// for counts and surah cards the job's factual sentences (`say`). Never the Arabic.
//   - ElevenLabs (the job's voice.engine): the service made the lines with its key; each one is
//     downloaded from the job's address (no key here, no TTS run).
//   - Kokoro (en) / Mana-Persian-Piper (fa): read here by scripts/tts.py, its whole output kept
//     in .work/ (an engine may echo what it reads; no text may reach a log).
// Every line is levelled to the same loudness. The log shows ids, counts and seconds only.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { check, download, jobArg, level, loudness, runMain } from "./lib.mjs";
import { spoken } from "./spoken.mjs";

const NARRATOR_LUFS = -17;
/** The free voices (the service's fallback voices, used too when an ElevenLabs file cannot be had). */
export const FREE = {
  en: { engine: "kokoro", voice: "am_michael", speed: 0.9 },
  fa: { engine: "piper", voice: "fa_IR-mana-medium", lengthScale: 1.12 },
};

/** Only the shape of a failure: the names of the files and of the error, never its message. */
function failureShape(log) {
  return log
    .split("\n")
    .filter((l) => /^\s*File "/.test(l) || /^[A-Za-z_][\w.]*(Error|Exception|Exit)\b/.test(l))
    .map((l) => l.replace(/^([A-Za-z_][\w.]*(Error|Exception|Exit))\b.*$/, "$1"))
    .slice(-12)
    .join("\n");
}

/** The lines to voice, with their texts in memory only. */
export function linesOf(props, free) {
  if (props.kind === "verse") return props.ayahs.map((a) => ({ id: `a${a.ayahNumber}`, text: a.translation }));
  return props.narration.map((n) => ({ id: n.id, text: free ? spoken(n.say, props.lang) : n.say }));
}

/** Levels raw files (one gain for all, so the lines keep their relation) into public/voice/<id>/. */
function levelAll(id, raws) {
  const dir = path.join("public", "voice", id);
  const lufs = loudness(raws.map((r) => r.file));
  const gain = NARRATOR_LUFS - lufs;
  const lines = raws.map((r) => {
    const out = path.join(dir, `n-${r.id}.wav`);
    const seconds = level(r.file, gain, out);
    check(seconds > 0.2, `narration ${r.id} has sound`);
    return { id: r.id, file: `voice/${id}/n-${r.id}.wav`, seconds: Math.round(seconds * 1000) / 1000, ...(r.words?.length ? { words: r.words } : {}) };
  });
  console.log(`${id}: narrator ${lines.length} lines, ${lufs.toFixed(1)} LUFS → gain ${gain.toFixed(1)} dB (${lines.map((l) => `${l.id} ${l.seconds.toFixed(2)}s`).join(", ")})`);
  return lines;
}

async function fromElevenLabs(job, wanted) {
  const v = job.props.voice;
  const given = new Map((v.lines ?? []).map((l) => [l.id, l]));
  const raws = [];
  for (const line of wanted) {
    const l = given.get(line.id);
    check(l && typeof l.url === "string" && /^https:\/\//.test(l.url), `ElevenLabs line ${line.id} has an address`);
    const file = path.resolve(".work", "voice", job.id, `${line.id}.mp3`);
    await download(l.url, file, 1000);
    raws.push({ id: line.id, file, words: Array.isArray(l.words) ? l.words : [] });
  }
  return raws;
}

function fromFreeVoice(job, voice, lines) {
  const python = process.env.PYTHON || "python";
  const work = path.resolve(".work", "voice", job.id);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  const conf = voice.engine === "piper" ? { engine: "piper", model: `models/${voice.voice}.onnx`, lengthScale: voice.lengthScale ?? 1.0 } : { engine: "kokoro", voice: voice.voice, speed: voice.speed ?? 1.0 };
  if (conf.engine === "piper") check(fs.existsSync(conf.model), `the Piper model ${path.basename(conf.model)}`);
  const jobFile = path.join(work, "tts-job.json");
  fs.writeFileSync(jobFile, JSON.stringify({ voice: conf, lines }));
  const t0 = Date.now();
  const run = spawnSync(python, ["scripts/tts.py", jobFile, work], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(path.join(".work", `tts-${job.id}.log`), `${run.stdout ?? ""}\n${run.stderr ?? ""}`);
  fs.rmSync(jobFile, { force: true });
  if (run.status !== 0 || !fs.existsSync(path.join(work, "tts.json"))) {
    console.log(`${job.id}: the ${conf.engine} voice failed (exit ${run.status ?? run.signal ?? run.error?.code}); its output stays in .work/, shape:`);
    console.log(failureShape(`${run.stdout ?? ""}\n${run.stderr ?? ""}`) || "(no traceback)");
    return null;
  }
  const made = JSON.parse(fs.readFileSync(path.join(work, "tts.json"), "utf8"));
  console.log(`${job.id}: ${conf.engine} read ${made.length} lines in ${Math.round((Date.now() - t0) / 1000)} s`);
  return made.map((m) => ({ id: m.id, file: path.join(work, m.file) }));
}

/** The studio's narration pace (slow · normal · brisk), for the free voices (ElevenLabs lines come made). */
export function paced(voice, pace) {
  if (!pace || pace === "normal") return voice;
  if (voice.engine === "kokoro") return { ...voice, speed: Math.round((voice.speed ?? 1) * (pace === "slow" ? 0.88 : 1.1) * 100) / 100 };
  if (voice.engine === "piper") return { ...voice, lengthScale: Math.round((voice.lengthScale ?? 1) * (pace === "slow" ? 1.12 : 0.9) * 100) / 100 };
  return voice;
}

/**
 * A trial only (try.yml): lines that were voiced on the owner's PC with ElevenLabs (the key never
 * reaches GitHub). The run gets their lengths and word times and puts silence of that length in
 * their place; the real lines are mixed in on the PC (scripts/sample-mux.mjs).
 */
function placeholders(job, asked, wanted) {
  const dir = path.join("public", "voice", job.id);
  const given = new Map((asked.lines ?? []).map((l) => [l.id, l]));
  return wanted.map((w) => {
    const l = given.get(w.id);
    check(l && Number(l.seconds) > 0.2, `placeholder line ${w.id} has a length`);
    const out = path.join(dir, `n-${w.id}.wav`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", Number(l.seconds).toFixed(3), "-c:a", "pcm_s16le", out]);
    return { id: w.id, file: `voice/${job.id}/n-${w.id}.wav`, seconds: Number(l.seconds), ...(Array.isArray(l.words) && l.words.length ? { words: l.words } : {}) };
  });
}

const label = (v) =>
  v.engine === "kokoro" ? `kokoro-82m:${v.voice}:${v.speed ?? 1}` : v.engine === "piper" ? `mana-persian-piper:${v.voice}:length_scale=${v.lengthScale ?? 1}` : v.engine === "elevenlabs" ? `${v.model}:${v.voiceId}` : null;

/** public/voice/<id>/manifest.json for one job; returns it. */
export async function voiceJob(job) {
  const props = JSON.parse(fs.readFileSync(path.join("props", `${job.id}.json`), "utf8"));
  const lang = props.lang;
  const outDir = path.join("public", "voice", job.id);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const asked = job.props.voice ?? FREE[lang];
  const pace = job.props.studio?.pace ?? "normal";
  let manifest = null;
  // nothing to read (a silent carousel, a silent Story): no narrator at all
  if (props.silent || asked.engine === "none" || !linesOf(props, false).length) {
    manifest = { engine: "none", voice: null, reason: "nothing to read", lines: [] };
    fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 1)}
`);
    console.log(`${job.id}: no narrator (nothing to read)`);
    return manifest;
  }
  if (asked.engine === "placeholder") {
    manifest = { engine: "elevenlabs", voice: label({ ...asked, engine: "elevenlabs" }), placeholder: true, lines: placeholders(job, asked, linesOf(props, false)) };
  }
  if (!manifest && asked.engine === "elevenlabs") {
    try {
      const raws = await fromElevenLabs(job, linesOf(props, false));
      manifest = { engine: "elevenlabs", voice: label(asked), lines: levelAll(job.id, raws) };
    } catch (error) {
      // the free voice reads instead; the manifest says what really read
      console.log(`${job.id}: the ElevenLabs lines could not be used (${String(error.message).split("\n")[0].slice(0, 160)}); the free voice reads`);
    }
  }
  if (!manifest) {
    const voice = paced(asked.engine === "kokoro" || asked.engine === "piper" ? asked : FREE[lang], pace);
    const raws = fromFreeVoice(job, voice, linesOf(props, true));
    if (raws) manifest = { engine: voice.engine, voice: label(voice), ...(asked.reason ? { reason: asked.reason } : {}), lines: levelAll(job.id, raws) };
    // Only the Persian voice may be missing (S1's rule): the video is then timed by reading length.
    else if (voice.engine === "piper") manifest = { engine: "none", voice: null, reason: "the piper voice failed on this machine", lines: [] };
    else throw new Error(`the ${voice.engine} voice failed`);
  }
  const ids = new Set(manifest.lines.map((l) => l.id));
  for (const l of linesOf(props, false)) if (manifest.engine !== "none") check(ids.has(l.id), `narration line ${l.id} was made`);
  fs.writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`${job.id}: voice ${manifest.engine} (${manifest.voice ?? "none"}), ${manifest.lines.length} lines`);
  return manifest;
}

runMain(import.meta, async (args) => {
  await voiceJob(jobArg(args));
});
