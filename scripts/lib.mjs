// Small helpers shared by the build scripts: reading Siraj's public API with its own guarantees
// checked, the checks themselves, hashes, ffmpeg measurements and running a script's main().
// Nothing here prints a text: errors carry paths, ids and counts only.
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const API = (process.env.SIRAJ_API ?? "https://siraj.ahura.cloud").replace(/\/+$/, "");
export const UA = { "user-agent": "siraj-render (github.com/alitalebpour99-collab/siraj-render)" };

/** A check that failed: the message names what, never a text. */
export class CheckError extends Error {
  constructor(message) {
    super(`check failed: ${message}`);
    this.name = "CheckError";
  }
}

/** The API's data is not what the service planned with: the job must not be rendered. */
export class DataChanged extends Error {
  constructor(what) {
    super(`the API's data changed since planning (${what})`);
    this.name = "DataChanged";
  }
}

export function check(condition, message) {
  if (!condition) throw new CheckError(message);
}

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with retries; the error names the path and the status only. */
export async function getJson(url, headers = {}, tries = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json", ...UA, ...headers }, signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt >= tries) throw new Error(`${url.replace(/\?.*/, "")}: ${error.message}`);
      await sleep(1500 * attempt);
    }
  }
}

/** Siraj's API by path, e.g. "/api/quran". */
export const siraj = (pathAndQuery) => getJson(`${API}${pathAndQuery}`);

/** The API's own guarantees, checked on every read. */
export function checkTrust(body, what) {
  check(body.service === "siraj-public-quran", `${what}: service`);
  check(body.trust?.verbatim_text_only === true, `${what}: verbatim_text_only`);
  check(body.trust?.text_hash_verified_at_read_time === true, `${what}: text hash verified`);
  check(body.trust?.ai_can_publish === false, `${what}: ai_can_publish is false`);
}

/** The release fields a source line is made of (no sacred text in them). */
export const releaseOf = (r) =>
  r && {
    releaseKey: r.releaseKey,
    kind: r.kind,
    language: r.language,
    sourceTitle: r.sourceTitle,
    publisher: r.publisher,
    canonicalUrl: r.canonicalUrl,
    licenseName: r.licenseName,
    licenseUrl: r.licenseUrl,
    rightsStatus: r.rightsStatus,
    attributionText: r.attributionText,
    upstreamVersion: r.upstreamVersion,
    exposedAt: r.exposedAt,
    recordCount: r.recordCount,
    orthography: r.orthography ?? null,
  };

/** Downloads a file (audio) with retries; checks its type and that it has a body. */
export async function download(url, file, minBytes = 10_000) {
  if (fs.existsSync(file) && fs.statSync(file).size >= minBytes) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(300_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") ?? "";
      check(/audio|octet-stream|mpeg/.test(type), `${url.replace(/\?.*/, "")} is audio (${type})`);
      const buf = Buffer.from(await res.arrayBuffer());
      check(buf.length >= minBytes, `${url.replace(/\?.*/, "")} has a body`);
      fs.writeFileSync(file, buf);
      return;
    } catch (error) {
      if (attempt >= 4) throw new Error(`${url.replace(/\?.*/, "")}: ${error.message}`);
      await sleep(2000 * attempt);
    }
  }
}

/* ---------- Sound measurements (ffmpeg) ---------- */

export const durationMs = (file) => Math.round(Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim()) * 1000);

/** Integrated loudness (LUFS) of one file, of several played one after another, or of a window [fromS, toS] of one file. */
export function loudness(files, window = null) {
  const list = Array.isArray(files) ? files : [files];
  const seek = window ? ["-ss", window[0].toFixed(3), "-to", window[1].toFixed(3)] : [];
  const inputs = list.flatMap((f) => [...seek, "-i", f]);
  // every input resampled to one format first, so that files of different rates concatenate
  const norm = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
  const filter =
    list.length > 1
      ? ["-filter_complex", `${list.map((_, i) => `[${i}:a]${norm}[a${i}]`).join(";")};${list.map((_, i) => `[a${i}]`).join("")}concat=n=${list.length}:v=0:a=1,ebur128=framelog=quiet`]
      : ["-af", `${norm},ebur128=framelog=quiet`];
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...inputs, ...filter, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const m = [...(run.stderr ?? "").matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  // ffmpeg's own last line names files and filters only (never a text)
  if (!m) console.log(`loudness: ffmpeg exit ${run.status}: ${(run.stderr ?? "").trim().split("\n").slice(-2).join(" | ").slice(0, 300)}`);
  check(m, `loudness of ${list.map((f) => path.basename(f)).join(", ")}`);
  return Number(m[1]);
}

/** A whole file as a levelled WAV (48 kHz stereo) with `gainDb` and a peak limit; its length in seconds. */
export function level(src, gainDb, out) {
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", src, "-af", `volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.891:attack=5:release=60:level=0`, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out]);
  return durationMs(out) / 1000;
}

/* ---------- Running a script ---------- */

/** Runs `main(argv)` when the file is the one node was started with (not when imported). */
export function runMain(meta, main) {
  if (process.argv[1] && meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main(process.argv.slice(2)).catch((error) => {
      console.error(`${path.basename(process.argv[1])}: ${String(error?.message ?? error).split("\n")[0]}`);
      process.exit(1);
    });
  }
}

/** `--job <file>` or `--job=<file>` from a script's arguments, read as JSON. */
export function jobArg(args) {
  const i = args.findIndex((a) => a === "--job" || a.startsWith("--job="));
  check(i >= 0, "usage: --job jobs/<id>.json");
  const file = args[i].includes("=") ? args[i].split("=")[1] : args[i + 1];
  check(file && fs.existsSync(file), `job file ${file}`);
  const job = JSON.parse(fs.readFileSync(file, "utf8"));
  check(typeof job.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(job.id), "job id");
  return job;
}
