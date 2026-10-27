// A trial of the whole chain on one job WITHOUT the service: no claim, no upload, nothing
// posted. For .github/workflows/try.yml (by hand), with a job written as the service writes
// them (docs/renderer-handoff.md §2):
//   node scripts/try.mjs jobs/<id>.json [--stills]
// It keeps only stills and frames (JPEG), the manifest and the check record (JSON) for looking
// at: never the video or any sound (the recitation must not be downloadable from this public
// repository).
import { spawnSync } from "node:child_process";
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
// nothing that holds sound may leave the run
for (const f of fs.readdirSync("out")) if (/\.(mp4|wav|mp3|m4a|aac)$/i.test(f)) fs.rmSync(`out/${f}`);
