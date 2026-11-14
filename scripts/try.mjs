// A trial of the whole chain on one job WITHOUT the service: no claim, no upload, nothing
// posted. For .github/workflows/try.yml (by hand), with a job written as the service writes
// them (docs/renderer-handoff.md §2):
//   node scripts/try.mjs jobs/<id>.json [--stills]
// It keeps only stills and frames (JPEG), the manifest and the check record (JSON) for looking
// at: never the video or any sound (the recitation must not be downloadable from this public
// repository).
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";

if (!process.features?.typescript && !process.execArgv.includes("--experimental-strip-types")) {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const { fetchJob } = await import("./fetch.mjs");
const { voiceJob } = await import("./voice.mjs");
const { qariJob } = await import("./qari.mjs");
const { renderJob } = await import("./render.mjs");

const file = process.argv[2];
const stills = process.argv.includes("--stills");
const job = JSON.parse(fs.readFileSync(file, "utf8"));
console.log(`try ${job.id}: ${job.composition}${stills ? " (stills only)" : ""}`);
await fetchJob(job);
if (stills) {
  // the layout only: no voice is made, the qari's clips are cut (for the light) when there are any
  await qariJob(job);
} else {
  await voiceJob(job);
  await qariJob(job);
}
const manifest = await renderJob(job, { stills, frames: true });
if (manifest) console.log(`try ${job.id}: manifest ${JSON.stringify({ ...manifest, ayahs: manifest.ayahs.length })}`);
// For looking without the master: a 360 px copy of the picture (no sound) and a sheet of two frames a second.
if (manifest && fs.existsSync(`out/${job.id}.mp4`)) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", `out/${job.id}.mp4`, "-an", "-vf", "scale=360:-2", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `out/${job.id}-360.picture.mp4`]);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", `out/${job.id}.mp4`, "-vf", `fps=2,scale=216:-2,tile=10x${Math.max(1, Math.ceil((Number(manifest.seconds) || 60) * 2 / 10))}:padding=4:color=0x6e6250`, "-frames:v", "1", "-q:v", "4", `out/${job.id}-sheet2fps.jpg`]);
}
// Nothing that holds the recitation may leave the run: every sound file and every video goes,
// but the picture-only copy (checked: no audio stream at all); the narrator's own lines are in
// out/voice/ (render.mjs, SAMPLE_PARTS=1), never a clip of the qari.
for (const f of fs.readdirSync("out")) {
  if (!/\.(mp4|wav|mp3|m4a|aac)$/i.test(f)) continue;
  if (/\.picture\.mp4$/.test(f)) {
    const streams = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", `out/${f}`]).toString();
    if (!/audio/.test(streams)) continue;
  }
  fs.rmSync(`out/${f}`);
}
