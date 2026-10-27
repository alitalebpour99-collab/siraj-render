// Takes ONE job from the Siraj Social service, renders it and hands the files back
// (the service's docs/renderer-handoff.md §1, §8):
//   SIRAJ_SOCIAL_URL=… SIRAJ_RENDER_SECRET=… CAN=… node scripts/worker.mjs
//
// 1. GET /api/render/work?can=$CAN → one job (or none: the run ends);
// 2. jobs/<id>.json; the texts from Siraj's API (fetch.mjs), checked against the job's `expect`;
// 3. the narrator (voice.mjs: the service's ElevenLabs lines, or the free voice);
// 4. the qari (qari.mjs, verses only);
// 5. the video and its covers, with the sound checks (render.mjs);
// 6. the files up (video, cover, grid), then done=1 with the manifest;
// 7. any error: failed=1 with the first line of the message only (cut to 240 characters).
// Nothing is uploaded anywhere else (no artifact: the repository is public and the recitation
// must not be downloadable there). Never prints the secret or a text: ids, counts and seconds.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// The scripts import TypeScript files (src/timelines.ts …): Node ≥ 22.18 strips their types by
// itself; an older Node is started again with the flag.
if (!process.features?.typescript && !process.execArgv.includes("--experimental-strip-types")) {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const { fetchJob } = await import("./fetch.mjs");
const { voiceJob } = await import("./voice.mjs");
const { qariJob } = await import("./qari.mjs");
const { renderJob } = await import("./render.mjs");

const BASE = (process.env.SIRAJ_SOCIAL_URL ?? "").replace(/\/+$/, "");
const SECRET = process.env.SIRAJ_RENDER_SECRET ?? "";
const CAN = process.env.CAN ?? "en-verse,fa-verse,en-counts:overview";
if (!/^https:\/\//.test(BASE) || SECRET.length < 24) {
  console.error("worker: SIRAJ_SOCIAL_URL (https) and SIRAJ_RENDER_SECRET must be set");
  process.exit(2);
}
const auth = { authorization: `Bearer ${SECRET}` };

// The tools must be there before a job is taken: a machine without them would only spend one of
// the job's three attempts (27 October: an apt install that hung left no ffprobe).
for (const tool of ["ffmpeg", "ffprobe"]) {
  const r = spawnSync(tool, ["-version"], { stdio: "ignore" });
  if (r.status !== 0) {
    console.error(`worker: ${tool} is missing on this machine; no job is taken`);
    process.exit(1);
  }
}

/** A call to the service; its errors name the path and the status only. */
async function call(pathAndQuery, init = {}) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(`${BASE}${pathAndQuery}`, { ...init, headers: { ...auth, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(180_000) });
    } catch (error) {
      if (attempt >= 3) throw new Error(`${pathAndQuery.replace(/\?.*/, "")}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
      continue;
    }
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok !== false) return body;
    // 409: another attempt took the job over; 4xx: the service refused (no retry)
    if (res.status >= 500 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 5000 * attempt));
      continue;
    }
    const err = new Error(`${pathAndQuery.replace(/\?.*/, "")}: HTTP ${res.status} ${String(body.error ?? "").slice(0, 120)}`);
    err.status = res.status;
    throw err;
  }
}

const firstLine = (error) => String(error?.message ?? error).split("\n")[0].slice(0, 240);

const t0 = Date.now();
const { job } = await call(`/api/render/work?can=${encodeURIComponent(CAN)}`);
if (!job) {
  console.log("no job to render");
  process.exit(0);
}
console.log(`job ${job.id}: attempt ${job.attempt}, ${job.composition} (${job.capability}), files ${job.files.join(",")}`);
fs.mkdirSync("jobs", { recursive: true });
fs.writeFileSync(path.join("jobs", `${job.id}.json`), JSON.stringify(job));
const up = (kind) => job.upload.file.replace("<kind>", encodeURIComponent(kind));

try {
  if (job.kind !== "video" && job.kind !== "carousel") throw new Error(`a ${job.kind} job is not drawn by this renderer`);
  await fetchJob(job);
  await voiceJob(job);
  const { qari, reason } = await qariJob(job);
  if (!qari && reason !== "nothing recited") console.log(`job ${job.id}: rendered without a recitation`);
  const manifest = await renderJob(job);
  const files = { video: `out/${job.id}.mp4`, cover: `out/${job.id}-cover.jpg`, grid: `out/${job.id}-grid.jpg` };
  for (let k = 1; k <= 10; k++) files[`slide${k}`] = `out/${job.id}-slide${k}.jpg`;
  // a carousel job names its slides as slide1 … slideN (the service writes «…slide10»): the ones made
  const wanted = job.kind === "carousel" ? Object.keys(files).filter((k) => k.startsWith("slide") && fs.existsSync(files[k])) : job.files;
  for (const kind of wanted) {
    const file = files[kind];
    if (!file) throw new Error(`no ${kind} file`);
    const bytes = fs.readFileSync(file);
    await call(up(kind), { method: "POST", headers: { "content-type": kind === "video" ? "video/mp4" : "image/jpeg" }, body: bytes });
    console.log(`job ${job.id}: ${kind} up (${bytes.length} bytes)`);
  }
  // what else the service takes for this post when it was made (§4.9): the Story cut, the carousel twin
  const optional = job.optional ?? [];
  const extra = [];
  if (optional.includes("story")) extra.push(["story", `out/${job.id}-story.mp4`, "video/mp4"]);
  if (optional.some((k) => /slide/.test(k))) for (let k = 1; k <= 10; k++) extra.push([`slide${k}`, `out/${job.id}-slide${k}.jpg`, "image/jpeg"]);
  for (const [kind, file, type] of extra) {
    if (!fs.existsSync(file)) continue;
    const bytes = fs.readFileSync(file);
    await call(up(kind), { method: "POST", headers: { "content-type": type }, body: bytes });
    console.log(`job ${job.id}: ${kind} up (${bytes.length} bytes)`);
  }
  const done = await call(job.upload.done, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(manifest) });
  console.log(`job ${job.id}: done in ${Math.round((Date.now() - t0) / 1000)} s, ${manifest.seconds} s of video${done.held ? `; the service holds it: ${done.held}` : ""}`);
} catch (error) {
  const reason = firstLine(error);
  console.error(`job ${job.id}: failed: ${reason}`);
  if (error?.status === 409) process.exit(1);
  try {
    const r = await call(job.upload.failed, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ error: reason }) });
    console.log(`job ${job.id}: reported as failed${r.final ? " (last attempt: the owner is told)" : " (it goes back to the queue)"}`);
  } catch (e) {
    console.error(`job ${job.id}: could not report the failure: ${firstLine(e)}`);
  }
  process.exit(1);
}
