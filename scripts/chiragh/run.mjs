// One «چراغ» video, end to end, after fetch, voice and qari (worker.mjs / try.mjs):
//   1. the qari's word times checked against the clip's own sound (align-refine.mjs);
//   2. the material (material.mjs) and three concepts by Claude (concept.mjs);
//   3. code picks the one least like the last 30 videos (pick.mjs);
//   4. the director writes storyboard.json (director.mjs) and the composition draws it;
//   5. the QA gate (qa.mjs); below 8/10 or a hard check failed: the next concept, at most two more;
//   6. the best try is handed in; one that never passed is HELD for the owner (manifest.qa.hold),
//      never posted by itself.
// out/<id>.storyboard.json, out/<id>.qa.json and out/<id>-sheet1fps.jpg stay with the trial.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { speakerWindows } from "../../src/timelines.ts";
import { TARGET, levelFilter, loudness, meets } from "../finish.mjs";
import { check } from "../lib.mjs";
import { manifestOf } from "../manifest.mjs";
import { refineQari } from "./align-refine.mjs";
import { writeConcepts } from "./concept.mjs";
import { checkStoryboard, direct } from "./director.mjs";
import { materialOf, templateOf } from "./material.mjs";
import { rank } from "./pick.mjs";
import { PASS_SCORE, runGate, sheetPath } from "./qa.mjs";

export const MAX_TRIES = 3;
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);

/** True when this job is drawn in «چراغ» (all seven templates; SIRAJ_CHIRAGH=off keeps the old code for a trial only). */
export const isChiragh = (props, env = process.env) => env.SIRAJ_CHIRAGH !== "off" && templateOf(props) !== null;

let served = null;
async function serveUrl() {
  if (!served) served = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public"), outDir: path.resolve("bundle"), enableCaching: false });
  return served;
}

/** Renders one storyboard: the raw video, then the levelled file; returns what the page measured of itself. */
async function renderBoard(job, sb, outFile) {
  const url = await serveUrl();
  const common = { serveUrl: url, timeoutInMilliseconds: 180000, chromiumOptions: { gl: process.env.RENDER_GL || "swangle" }, logLevel: "warn" };
  const inputProps = { storyboard: sb };
  const composition = await selectComposition({ ...common, id: "chiragh", inputProps });
  const raw = outFile.replace(/\.mp4$/, ".raw.mp4");
  const probes = [];
  let last = -1;
  await renderMedia({
    onBrowserLog: (log) => {
      if (log.text.startsWith("CHIRAGH_PROBE ")) probes.push(JSON.parse(log.text.slice(14)));
    },
    ...common,
    composition,
    inputProps,
    codec: "h264",
    crf: 18,
    pixelFormat: "yuv420p",
    imageFormat: "jpeg",
    jpegQuality: 92,
    audioCodec: "aac",
    enforceAudioTrack: true,
    concurrency: Number(process.env.RENDER_CONCURRENCY ?? 4),
    x264Preset: "veryfast",
    outputLocation: raw,
    onProgress: ({ progress }) => {
      const step = Math.floor(progress * 4);
      if (step > last) console.log(`${job.id}: ${step * 25}%`);
      last = Math.max(last, step);
    },
  });
  const seconds = sb.total;
  const kbps = Math.max(1500, Math.min(6000, Math.floor((45 * 8192) / seconds) - 220));
  const audible = sb.sounds.length > 0;
  const encode = (tp) =>
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-maxrate", `${kbps}k`, "-bufsize", `${kbps * 2}k`, "-pix_fmt", "yuv420p", "-profile:v", "high", ...(audible ? ["-af", levelFilter(raw, tp)] : []), "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", outFile]);
  encode(-1.5);
  let loud = audible ? loudness(outFile) : null;
  if (loud && !meets(loud)) {
    encode(-2.5);
    loud = loudness(outFile);
  }
  fs.rmSync(raw, { force: true });
  if (loud) console.log(`${job.id}: sound ${loud.lufs} LUFS, true peak ${loud.tp} dBTP (target ${TARGET.lufs})`);
  return { probes, loud, common, composition };
}

/** Who speaks when, measured in the file: never two at once, everyone heard. */
function soundChecks(file, sb, voice) {
  const speakers = sb.sounds.map((s) => ({ who: `${s.who} ${s.id}`, kind: s.who, frame: Math.round(s.at * sb.fps), seconds: s.seconds }));
  const { segs, overlap } = speakerWindows(speakers);
  check(!overlap, overlap ?? "");
  for (const x of segs) {
    if (voice.placeholder && x.kind === "narrator") continue;
    const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-ss", x.from.toFixed(3), "-t", Math.max(0.05, x.to - x.from).toFixed(3), "-i", file, "-vn", "-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8" });
    const m = [...(run.stderr ?? "").matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
    x.lufs = m ? Number(m[1]) : null;
    check(x.lufs !== null && x.lufs >= -32, `${x.who} is heard in the video (${x.lufs} LUFS)`);
  }
  return segs;
}

/** The texts the gate compares the page with: every verse as stored, every translation as served. */
function sourcesOf(m) {
  const out = {};
  for (const v of m.verses) {
    out[v.id] = v.text;
    if (v.translation) out[`${v.id}:t`] = v.translation;
  }
  return out;
}

export async function chiraghJob(job, { stills = false } = {}) {
  const props = readJson(path.join("props", `${job.id}.json`));
  check(props, `props/${job.id}.json`);
  const voice = props.silent ? { engine: "none", voice: null, lines: [] } : (readJson(path.join("public", "voice", job.id, "manifest.json")) ?? { engine: "none", voice: null, lines: [] });
  const qari = readJson(path.join("public", "qari", job.id, "manifest.json"));
  const align = refineQari(qari);
  const m = materialOf(props, voice, qari);
  const recent = Array.isArray(job.props?.chiragh?.recent) ? job.props.chiragh.recent : [];
  const concepts = (await writeConcepts(m, recent)).map((c) => (m.forcedKey ? { ...c, key_word: m.forcedKey } : c));
  const ranked = rank(m, concepts, recent);
  console.log(`${job.id}: ${m.template}, concepts ranked ${ranked.map((r) => `${r.c.anchor.art}(like ${r.like}${r.breaks.length ? `, ${r.breaks.length} rule${r.breaks.length > 1 ? "s" : ""}` : ""})`).join(" > ")}`);
  const out = path.resolve("out");
  fs.mkdirSync(path.join(out, "frames"), { recursive: true });

  // a long video (a whole owner writing) is drawn once: three renders of three minutes each would outlast the run
  const tries = [];
  const longVideo = direct(m, ranked[0].c, { videoId: job.id }).total > 100;
  for (let n = 1; n <= Math.min(longVideo ? 1 : MAX_TRIES, ranked.length); n++) {
    const pick = ranked[n - 1];
    const sb = direct(m, pick.c, { videoId: job.id });
    const problems = checkStoryboard(sb);
    const suffix = n > 1 ? `-try${n}` : "";
    fs.writeFileSync(path.join(out, `${job.id}.storyboard${suffix}.json`), `${JSON.stringify(sb, null, 1)}\n`);
    if (problems.length) {
      console.log(`${job.id}: try ${n}: the storyboard breaks ${problems.length} rules (${problems.slice(0, 3).join("; ")})`);
      tries.push({ n, sb, gate: { pass: false, score: null, hard: problems }, file: null });
      continue;
    }
    console.log(`${job.id}: try ${n}: ${sb.shots.length} shots over ${sb.total} s (${pick.c.by}: ${sb.anchor.art}, ${sb.idea_family}, hook ${sb.concept.hook.type}, key ${sb.concept.key_word ? `${sb.concept.key_word.verse}#${sb.concept.key_word.index}` : "none"})`);
    if (stills) {
      const url = await serveUrl();
      const common = { serveUrl: url, timeoutInMilliseconds: 180000, chromiumOptions: { gl: process.env.RENDER_GL || "swangle" }, logLevel: "warn" };
      const composition = await selectComposition({ ...common, id: "chiragh", inputProps: { storyboard: sb } });
      const marks = [0, ...sb.shots.map((s) => Math.round((s.start + s.dur * 0.6) * sb.fps))].filter((f, i, a) => a.indexOf(f) === i && f < composition.durationInFrames);
      for (const [i, frame] of marks.entries()) await renderStill({ ...common, composition, inputProps: { storyboard: sb }, frame, imageFormat: "jpeg", jpegQuality: 85, scale: 0.5, output: path.join(out, "frames", `${job.id}-s${String(i + 1).padStart(2, "0")}.jpg`) });
      console.log(`${job.id}: ${marks.length} stills`);
      return null;
    }
    const file = path.join(out, `${job.id}${suffix}.chiragh.mp4`);
    const { probes } = await renderBoard(job, sb, file);
    const segs = soundChecks(file, sb, voice);
    const gate = await runGate({ file, sb, probes, sources: sourcesOf(m), styleFile: path.resolve("refs", "chiragh-style.jpg"), sheetFile: sheetPath(out, job.id, n) });
    console.log(`${job.id}: try ${n}: ${gate.pass ? "PASSED" : "not passed"}, score ${gate.score ?? "none"}, longest still ${gate.still.longestS} s, sync p90 ${gate.sync.p90Ms ?? "-"} ms over ${gate.sync.measured} words${gate.hard.length ? `; ${gate.hard.join("; ")}` : ""}`);
    fs.writeFileSync(path.join(out, `${job.id}.qa${suffix}.json`), `${JSON.stringify({ ...gate, align, concept: sb.concept, fingerprint: sb.fingerprint }, null, 1)}\n`);
    if (process.env.SAMPLE_PARTS === "1") fs.writeFileSync(path.join(out, `${job.id}.probes${suffix}.json`), JSON.stringify(probes));
    tries.push({ n, sb, gate, file, segs, probes });
    if (gate.pass) break;
  }
  const made = tries.filter((t) => t.file);
  check(made.length, `no storyboard of ${job.id} could be drawn: ${tries.map((t) => t.gate.hard.join("; ")).join(" | ")}`);
  // the passed try, else the best score (the owner sees it held)
  const best = made.find((t) => t.gate.pass) ?? [...made].sort((a, b) => (b.gate.score ?? -1) - (a.gate.score ?? -1) || a.gate.hard.length - b.gate.hard.length)[0];
  const final = path.join(out, `${job.id}.mp4`);
  fs.copyFileSync(best.file, final);
  for (const t of made) fs.rmSync(t.file, { force: true });
  fs.copyFileSync(path.join(out, `${job.id}.storyboard${best.n > 1 ? `-try${best.n}` : ""}.json`), path.join(out, `${job.id}.storyboard.final.json`));
  const sb = best.sb;

  // the covers: the storyboard's cover frame (1080×1920) and its 4:5 crop for the grid
  const url = await serveUrl();
  const common = { serveUrl: url, timeoutInMilliseconds: 180000, chromiumOptions: { gl: process.env.RENDER_GL || "swangle" }, logLevel: "warn" };
  const still = await selectComposition({ ...common, id: "chiragh-cover", inputProps: { storyboard: sb } });
  await renderStill({ ...common, composition: still, inputProps: { storyboard: sb }, imageFormat: "jpeg", jpegQuality: 92, output: path.join(out, `${job.id}-cover.jpg`) });
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", path.join(out, `${job.id}-cover.jpg`), "-vf", "crop=1080:1350:0:236", "-q:v", "2", path.join(out, `${job.id}-grid.jpg`)]);

  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", final]).toString().trim());
  // a trial: the picture alone and where every voice goes (sample-mux.mjs makes the sample on the PC)
  if (process.env.SAMPLE_PARTS === "1") {
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", final, "-an", "-c:v", "copy", "-movflags", "+faststart", path.join(out, `${job.id}.picture.mp4`)]);
    const vdir = path.join(out, "voice", job.id);
    fs.mkdirSync(vdir, { recursive: true });
    const clips = qari ? [qari.basmala, ...qari.verses].filter(Boolean) : [];
    const place = sb.sounds.map((s) => {
      if (s.who === "narrator") {
        if (!voice.placeholder) fs.copyFileSync(path.join("public", s.file), path.join(vdir, path.basename(s.file)));
        return { kind: "narrator", line: s.id, at: s.at, seconds: s.seconds, file: voice.placeholder ? null : `voice/${job.id}/${path.basename(s.file)}` };
      }
      const clip = clips.find((c) => (s.id === "b" ? c.ayah === null : `a${c.ayah}` === s.id));
      return { kind: "qari", clip: clip?.verseKey ?? s.id, at: s.at, seconds: s.seconds, src: clip?.src ?? null };
    });
    fs.writeFileSync(path.join(out, `${job.id}.sound.json`), `${JSON.stringify({ job: job.id, seconds, placeholder: Boolean(voice.placeholder), place }, null, 1)}\n`);
  }
  const hold = !best.gate.pass;
  const reasons = best.gate.pass ? [] : [...best.gate.hard, ...(best.gate.score !== null && best.gate.score < PASS_SCORE ? [`vision score ${best.gate.score} under ${PASS_SCORE}`] : []), ...(best.gate.score === null ? ["no vision score"] : [])];
  const manifest = {
    ...manifestOf(props, voice, qari, seconds),
    checks: { audio: true, safeFrame: !best.gate.hard.some((h) => h.startsWith("legible")) },
    qa: { style: "chiragh", pass: best.gate.pass, hold, score: best.gate.score, tries: tries.length, reasons: reasons.slice(0, 6), fingerprint: sb.fingerprint, template: sb.template, shots: sb.shots.length, longestStillS: best.gate.still?.longestS ?? null, syncP90Ms: best.gate.sync?.p90Ms ?? null },
  };
  fs.writeFileSync(path.join(out, `${job.id}.manifest.json`), `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(`${job.id}: chiragh ${hold ? "HELD for the owner" : "passed"} after ${tries.length} tr${tries.length > 1 ? "ies" : "y"}, ${seconds.toFixed(2)} s`);
  return manifest;
}
