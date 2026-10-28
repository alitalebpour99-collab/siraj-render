// A trial's sample, made whole on the owner's PC (never on GitHub, never committed):
//   node scripts/sample-mux.mjs <trial dir> <out dir> [--eleven <dir>] [--cache <dir>]
// The trial (try.yml) leaves the PICTURE without any sound, the narrator's own lines and where
// every voice goes (<id>.sound.json). Here the qari's clips are cut again from the public
// chapter files of api.quran.com (downloaded to the cache on this PC only), the narrator's lines
// are placed (or, for lines voiced with ElevenLabs on this PC, the MP3s of --eleven/<job>/), the
// sound is levelled as render.mjs levels it, every window is checked to be heard, and a 9-frame
// sheet is made. Prints ids, counts and seconds only.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { download, getJson, level, loudness } from "./lib.mjs";

const args = process.argv.slice(2);
const [trial, outDir] = args;
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const eleven = opt("--eleven");
const cache = path.resolve(opt("--cache") ?? path.join(outDir, ".cache"));
const QURAN_COM = "https://api.quran.com/api/v4";
const NARRATOR_LUFS = -17;
fs.mkdirSync(path.join(outDir, "frames"), { recursive: true });
fs.mkdirSync(cache, { recursive: true });

const probeSeconds = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

function windowLufs(file, from, to) {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-ss", from.toFixed(3), "-t", Math.max(0.05, to - from).toFixed(3), "-i", file, "-vn", "-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8" });
  const m = [...(run.stderr ?? "").matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  return m ? Number(m[1]) : null;
}

function levelFilter(file) {
  const target = "I=-16:TP=-1.5:LRA=11";
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
  const json = (run.stderr ?? "").slice((run.stderr ?? "").lastIndexOf("{"));
  const m = JSON.parse(json.slice(0, json.indexOf("}") + 1));
  return `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
}

const chapters = new Map();
async function chapterFile(recitationId, n) {
  const k = `${recitationId}-${n}`;
  if (chapters.has(k)) return chapters.get(k);
  const { audio_file: af } = await getJson(`${QURAN_COM}/chapter_recitations/${recitationId}/${n}?segments=true`);
  const file = path.join(cache, `${k}.mp3`);
  await download(af.audio_url, file);
  chapters.set(k, file);
  return file;
}

function cut(src, fromMs, toMs, gainDb, out) {
  const dur = (toMs - fromMs) / 1000;
  const chain = [`atrim=start=${(fromMs / 1000).toFixed(3)}:end=${(toMs / 1000).toFixed(3)}`, "asetpts=PTS-STARTPTS", `volume=${gainDb.toFixed(2)}dB`, "alimiter=limit=0.891:attack=5:release=60:level=0", "afade=t=in:st=0:d=0.012", `afade=t=out:st=${Math.max(0, dur - 0.06).toFixed(3)}:d=0.06`].join(",");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-af", chain, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out]);
}

for (const f of fs.readdirSync(trial).filter((x) => x.endsWith(".sound.json"))) {
  const plan = JSON.parse(fs.readFileSync(path.join(trial, f), "utf8"));
  const id = plan.job;
  const picture = path.join(trial, `${id}.picture.mp4`);
  if (!fs.existsSync(picture)) {
    console.log(`${id}: no picture, skipped`);
    continue;
  }
  const work = path.join(cache, id);
  fs.mkdirSync(work, { recursive: true });
  // the narrator: the run's own levelled lines, or this PC's ElevenLabs lines levelled here
  const elevenLines = plan.placeholder ? plan.place.filter((x) => x.kind === "narrator") : [];
  let gain = 0;
  if (elevenLines.length) {
    const files = elevenLines.map((x) => path.join(eleven, id, `${x.line}.mp3`));
    gain = NARRATOR_LUFS - loudness(files);
  }
  const inputs = [];
  for (const [i, x] of plan.place.entries()) {
    const out = path.join(work, `p${i}.wav`);
    if (x.kind === "narrator") {
      if (plan.placeholder) level(path.join(eleven, id, `${x.line}.mp3`), gain, out);
      else if (x.file) fs.copyFileSync(path.join(trial, x.file), out);
      else continue;
    } else {
      if (!x.src) continue;
      cut(await chapterFile(x.src.recitationId, x.src.chapter), x.src.fromMs, x.src.toMs, x.src.gainDb, out);
    }
    inputs.push({ file: out, at: x.at, seconds: x.seconds, kind: x.kind, who: x.kind === "qari" ? `qari ${x.clip}` : `narrator ${x.line}` });
  }
  const seconds = probeSeconds(picture);
  const mix = path.join(work, "mix.wav");
  const graph = `${inputs.map((x, i) => `[${i}:a]adelay=${Math.round(x.at * 1000)}:all=1[a${i}]`).join(";")};${inputs.map((_, i) => `[a${i}]`).join("")}amix=inputs=${inputs.length}:normalize=0:dropout_transition=0,apad,atrim=0:${seconds.toFixed(3)}[m]`;
  execFileSync("ffmpeg", ["-y", "-v", "error", ...inputs.flatMap((x) => ["-i", x.file]), "-filter_complex", graph, "-map", "[m]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", mix]);
  const final = path.join(outDir, `${id}.mp4`);
  // --small: a lighter copy for looking at (a full disk on the PC); otherwise the picture as rendered
  const video = args.includes("--small") ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-maxrate", "3000k", "-bufsize", "6000k", "-threads", "2", "-pix_fmt", "yuv420p"] : ["-c:v", "copy"];
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", picture, "-i", mix, "-map", "0:v", "-map", "1:a", ...video, "-af", levelFilter(mix), "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", "-movflags", "+faststart", final]);
  // every voice is heard where it is placed, and never two at once
  const sorted = [...inputs].sort((a, b) => a.at - b.at);
  let overlap = null;
  for (let i = 1; i < sorted.length; i++) if (sorted[i].at < sorted[i - 1].at + sorted[i - 1].seconds - 0.001) overlap = `${sorted[i].who} over ${sorted[i - 1].who}`;
  const quiet = sorted.map((x) => ({ who: x.who, lufs: windowLufs(final, x.at, x.at + x.seconds) })).filter((x) => x.lufs === null || x.lufs < -32);
  // nine frames, evenly spread
  const fps = 30;
  const total = Math.floor(seconds * fps);
  const picks = Array.from({ length: 9 }, (_, k) => Math.min(total - 1, Math.round(((k + 0.5) / 9) * total)));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", picture, "-vf", `select='${picks.map((n) => `eq(n\\,${n})`).join("+")}',scale=300:-2,tile=3x3:padding=6:color=0x060a14`, "-fps_mode", "vfr", "-frames:v", "1", "-q:v", "3", path.join(outDir, "frames", `${id}-sheet.jpg`)]);
  for (const k of fs.readdirSync(trial).filter((x) => x.startsWith(`${id}-`) && x.endsWith(".jpg") && !/-m\d+\.jpg$/.test(x))) fs.copyFileSync(path.join(trial, k), path.join(outDir, k));
  fs.rmSync(work, { recursive: true, force: true });
  console.log(`${id}: ${seconds.toFixed(1)} s, ${inputs.length} voices (${inputs.filter((x) => x.kind === "qari").length} qari), ${(fs.statSync(final).size / 1048576).toFixed(1)} MB, overlap ${overlap ?? "none"}, quiet ${quiet.length ? quiet.map((q) => q.who).join(",") : "none"}`);
}
