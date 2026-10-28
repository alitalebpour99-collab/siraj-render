// Renders one job: its video, its two covers, the sound checks and the manifest, into out/.
//   node scripts/render.mjs --job jobs/<id>.json            (after fetch, voice and qari)
//   node scripts/render.mjs --job jobs/<id>.json --stills   (stills only, for looking at a layout)
// out/<id>.mp4             1080×1920, 30 fps, H.264 + AAC 48 kHz, moov at the front
// out/<id>-cover.jpg       1080×1920 Reel cover (<composition>-cover)
// out/<id>-grid.jpg        1080×1350 grid crop (<composition>-grid)
// out/<id>.manifest.json   what the video is made of, for the service (§5 of the hand-off; no text)
// out/<id>.check.json      who speaks when and how loud, the lit words (seconds; no text)
// out/frames/<id>-*.jpg    with FRAMES=1: the moments that show the light, and a sheet
//
// The sound rule is checked in the finished video: the qari and the narrator never overlap,
// and every window where one of them speaks is heard. A video that breaks it is not handed in.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { safeFrame } from "../src/layout.ts";
import { textBoxes } from "../src/waitingPlan.ts";
import { cardTimeline, countsTimeline, insightTimeline, speakerWindows, verseTimeline, wordTable } from "../src/timelines.ts";
import { check, jobArg, runMain } from "./lib.mjs";
import { manifestOf } from "./manifest.mjs";

/** True when the file's top-level `moov` box comes before its `mdat` box (fast start). */
function moovFirst(file) {
  const fd = fs.openSync(file, "r");
  const size = fs.fstatSync(fd).size;
  const head = Buffer.alloc(16);
  let at = 0;
  try {
    while (at + 8 <= size) {
      fs.readSync(fd, head, 0, 16, at);
      let length = head.readUInt32BE(0);
      const type = head.toString("latin1", 4, 8);
      if (length === 1) length = Number(head.readBigUInt64BE(8));
      if (type === "moov") return true;
      if (type === "mdat") return false;
      if (length < 8) return false;
      at += length;
    }
    return false;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Speech levelled to -16 LUFS in two passes (measure, then one linear gain), so that a video
 * that is mostly silence between its lines comes out as loud as one that is not.
 */
function levelFilter(file) {
  const target = "I=-16:TP=-1.5:LRA=11";
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" });
  const json = (run.stderr ?? "").slice((run.stderr ?? "").lastIndexOf("{"));
  const m = JSON.parse(json.slice(0, json.indexOf("}") + 1));
  // a track with nothing heard (a trial whose narrator lines are placeholders) is left as it is
  if (!Number.isFinite(Number(m.input_i)) || Number(m.input_i) < -70) return "anull";
  return `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
}

const probe = (file) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,sample_rate,width,height,r_frame_rate:format=duration", "-of", "json", file]).toString());

/** LUFS of the window [from, to] (seconds) of the finished video, or null when nothing is heard. */
function windowLufs(file, from, to) {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-ss", from.toFixed(3), "-t", Math.max(0.05, to - from).toFixed(3), "-i", file, "-vn", "-af", "ebur128=framelog=quiet", "-f", "null", "-"], { encoding: "utf8" });
  const m = [...(run.stderr ?? "").matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  return m ? Number(m[1]) : null;
}

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);

/** The inputs of one job: props, the narrator and the qari, and its timeline. */
export function inputsOf(job) {
  const props = readJson(path.join("props", `${job.id}.json`));
  check(props, `props/${job.id}.json`);
  // a waiting template the service wants silent (the tafsir carousel, a silent dhikr Story) has no narrator, whatever was voiced
  const voice = props.silent ? { engine: "none", voice: null, lines: [] } : (readJson(path.join("public", "voice", job.id, "manifest.json")) ?? { engine: "none", voice: null, lines: [] });
  const recited = props.kind === "verse" || Boolean(props.recite);
  const qari = recited ? readJson(path.join("public", "qari", job.id, "manifest.json")) : null;
  // the waiting templates (src/Waiting.tsx) are timed as the insight videos are, over their own scenes
  const scened = props.kind === "insight" || props.kind === "waiting";
  const inputProps = { ...props, voice, ...(recited || scened ? { qari } : {}) };
  const loop = (props.studio?.ending ?? "loop") === "loop";
  const timeline =
    props.kind === "verse" ? verseTimeline(inputProps) : props.kind === "counts" ? countsTimeline(inputProps) : scened ? insightTimeline({ ...inputProps, loop }) : cardTimeline(inputProps);
  return { props, voice, qari, inputProps, timeline };
}

/** The moments worth looking at (frames): the light of each clip, the middle of each line, the ends. */
function moments(props, inputProps, timeline) {
  const out = [];
  if (props.kind === "verse") {
    out.push(Math.round(timeline.intro.dur / 2));
    for (const c of timeline.cards) {
      const clip = inputProps.qari?.verses.find((v) => v.ayah === c.ayah);
      if (c.index === 0 && c.basmalaAt !== null && inputProps.qari?.basmala?.words.length) {
        const w = inputProps.qari.basmala.words[Math.floor((inputProps.qari.basmala.words.length - 1) / 2)];
        out.push(Math.round(c.from + c.basmalaAt + ((w.start + w.end) / 2) * 30));
      }
      if (clip?.words.length) {
        const w = clip.words[Math.floor((clip.words.length - 1) / 2)];
        out.push(Math.round(c.from + c.verseAt + ((w.start + w.end) / 2) * 30));
      } else out.push(c.from + c.verseAt + 20);
      out.push(Math.round(c.from + (c.narrAt + c.narrEnd) / 2));
    }
    out.push(timeline.outro.from + timeline.outro.dur - 30);
  } else {
    out.push(0);
    for (const s of timeline.scenes) {
      if (!s.lines.length && !(s.clips ?? []).length) out.push(s.from + Math.round(s.dur / 2));
      for (const l of s.lines) out.push(Math.round(l.from + l.len * 0.6));
      for (const c of s.clips ?? []) out.push(Math.round(c.from + c.len * 0.5));
    }
    out.push(timeline.total - 30);
  }
  return [...new Set(out.map((n) => Math.max(0, Math.min(timeline.total - 1, n))))].sort((a, b) => a - b);
}

export async function renderJob(job, { stills = false, frames = process.env.FRAMES === "1" } = {}) {
  const { props, voice, qari, inputProps, timeline } = inputsOf(job);
  // an insight or a waiting template is named by its format (fa-nahj-hikma, en-mirror …)
  const want = props.kind === "insight" || props.kind === "waiting" ? `${props.lang}-${props.format}` : `${props.lang}-${props.kind}`;
  check(job.composition === want, `the job's composition ${job.composition} is ${want}`);
  const out = path.resolve("out");
  const frameDir = path.join(out, "frames");
  fs.mkdirSync(frameDir, { recursive: true });

  const t0 = Date.now();
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public"), outDir: path.resolve("bundle"), enableCaching: false });
  console.log(`${job.id}: bundled in ${Math.round((Date.now() - t0) / 1000)} s`);
  const common = { serveUrl, timeoutInMilliseconds: 180000, chromiumOptions: { gl: process.env.RENDER_GL || "swangle" }, logLevel: "warn" };
  const composition = await selectComposition({ ...common, id: job.composition, inputProps });
  const fps = composition.fps;
  const marks = moments(props, inputProps, timeline);

  // the covers
  const covers = job.covers ?? { cover: `${job.composition}-cover`, grid: `${job.composition}-grid` };
  for (const [kind, id] of Object.entries(covers)) {
    const still = await selectComposition({ ...common, id, inputProps });
    await renderStill({ ...common, composition: still, inputProps, imageFormat: "jpeg", jpegQuality: 92, output: path.join(out, `${job.id}-${kind}.jpg`) });
  }
  console.log(`${job.id}: covers written`);
  // the quiz's carousel twin (1080×1350): when the studio asks for it, and always in a trial
  if (props.kind === "insight" && props.format === "quiz" && (props.studio?.carousel || job.claim === "try")) {
    const id = `${job.composition}-slide`;
    for (let k = 1; k <= 3; k++) {
      const still = await selectComposition({ ...common, id, inputProps: { ...inputProps, slide: k } });
      await renderStill({ ...common, composition: still, inputProps: { ...inputProps, slide: k }, imageFormat: "jpeg", jpegQuality: 92, output: path.join(out, `${job.id}-slide${k}.jpg`) });
    }
    console.log(`${job.id}: 3 carousel slides written`);
  }
  // the short tafsir IS a carousel (waiting template): every slide, always — 1 the ayahs, 2–4 the record's whole sentences, 5 the source
  const tafsir = props.kind === "waiting" && props.format === "tafsir";
  if (tafsir) {
    const id = `${job.composition}-slide`;
    const n = props.facts.slides;
    for (let k = 1; k <= n; k++) {
      const still = await selectComposition({ ...common, id, inputProps: { ...inputProps, slide: k } });
      await renderStill({ ...common, composition: still, inputProps: { ...inputProps, slide: k }, imageFormat: "jpeg", jpegQuality: 92, output: path.join(out, `${job.id}-slide${k}.jpg`) });
    }
    console.log(`${job.id}: ${n} carousel slides written`);
  }

  if (stills) {
    for (const [i, frame] of marks.entries()) {
      await renderStill({ ...common, composition, inputProps, frame, imageFormat: "jpeg", jpegQuality: 85, scale: 0.5, output: path.join(frameDir, `${job.id}-m${String(i + 1).padStart(2, "0")}.jpg`) });
    }
    console.log(`${job.id}: ${marks.length} stills at ${marks.map((n) => (n / fps).toFixed(2)).join(", ")} s; ${composition.durationInFrames} frames in all`);
    return null;
  }
  // ... and no video: its manifest names the verse of slide 1 (shown, never recited)
  if (tafsir) {
    const manifest = { ...manifestOf({ ...props, recite: props.tafsir.verse }, voice, null, 0), checks: { audio: true, safeFrame: safeFrame(textBoxes("tafsir")) } };
    fs.writeFileSync(path.join(out, `${job.id}.manifest.json`), `${JSON.stringify(manifest, null, 1)}\n`);
    console.log(`${job.id}: a carousel, no video; done in ${Math.round((Date.now() - t0) / 1000)} s`);
    return manifest;
  }

  const s0 = Date.now();
  const raw = path.join(out, `${job.id}.raw.mp4`);
  let last = -1;
  await renderMedia({
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
    outputLocation: raw,
    onProgress: ({ progress }) => {
      const step = Math.floor(progress * 4);
      if (step > last) console.log(`${job.id}: ${step * 25}%`);
      last = Math.max(last, step);
    },
  });

  // AAC at 48 kHz, speech levelled to -16 LUFS (no levelling of a silent track), moov at the front.
  const final = path.join(out, `${job.id}.mp4`);
  const audible = timeline.speakers.length > 0;
  // The picture once more with a ceiling on its rate, so that the file stays under 45 MB: the
  // owner's bot and the Telegram channel take a video of at most 50 MB (the first live job, a
  // 114-second surah at CRF 18, was 76 MB and reached the owner as its cover only).
  const rawSeconds = Number(probe(raw).format.duration) || timeline.total / 30;
  const kbps = Math.max(1500, Math.min(6000, Math.floor((45 * 8192) / rawSeconds) - 220));
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-i", raw,
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-maxrate", `${kbps}k`, "-bufsize", `${kbps * 2}k`, "-pix_fmt", "yuv420p", "-profile:v", "high",
    ...(audible ? ["-af", levelFilter(raw)] : []),
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", final,
  ]);
  fs.rmSync(raw);
  const info = probe(final);
  const v = info.streams.find((s) => s.codec_type === "video");
  const a = info.streams.find((s) => s.codec_type === "audio");
  const seconds = Number(info.format.duration);
  const ok = v?.codec_name === "h264" && v.width === 1080 && v.height === 1920 && a?.codec_name === "aac" && a.sample_rate === "48000" && moovFirst(final);
  console.log(`${job.id}: ${seconds.toFixed(2)} s, video ${v?.codec_name} ${v?.width}x${v?.height} ${v?.r_frame_rate}, audio ${a?.codec_name} ${a?.sample_rate} Hz, moov first ${moovFirst(final)}, voice ${voice.voice ?? "none"}, in ${Math.round((Date.now() - s0) / 1000)} s`);
  check(ok, "the video is H.264 1080x1920 with AAC 48 kHz and moov at the front");
  const mb = fs.statSync(final).size / 1048576;
  console.log(`${job.id}: ${mb.toFixed(1)} MB at most ${kbps} kbit/s${mb > 49 ? " — over the 50 MB the bot and Telegram take" : ""}`);

  // who speaks when: never two at once, and everyone is heard where the timeline puts them
  const { segs, overlap } = speakerWindows(timeline.speakers);
  check(!overlap, overlap ?? "");
  for (const x of segs) {
    // a trial's placeholder lines are silence here; they are heard after the mix on the PC
    if (voice.placeholder && x.kind === "narrator") {
      x.lufs = null;
      continue;
    }
    x.lufs = windowLufs(final, x.from, x.to);
    check(x.lufs !== null && x.lufs >= -32, `${x.who} is heard in the video (${x.lufs} LUFS)`);
  }
  console.log(`${job.id}: who speaks when (s, LUFS): ${segs.map((x) => `${x.who} ${x.from.toFixed(2)}-${x.to.toFixed(2)} ${x.lufs === null ? "placeholder" : x.lufs.toFixed(1)}`).join(", ") || "nobody (no sound)"}`);

  // the Story cut (studio.story): the first seconds, faded out, at most 15 s
  if (props.studio?.story) {
    const len = Math.min(10, seconds);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", final, "-t", len.toFixed(2), "-vf", `fade=t=out:st=${(len - 0.5).toFixed(2)}:d=0.5`, "-af", `afade=t=out:st=${(len - 0.5).toFixed(2)}:d=0.5`, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", path.join(out, `${job.id}-story.mp4`)]);
    console.log(`${job.id}: story cut, ${len.toFixed(1)} s`);
  }

  // A trial for the owner's PC (try.yml): the picture without any sound, the narrator's own lines
  // and where every voice goes. The recitation never leaves the run; it is cut again on the PC
  // from the public chapter file (scripts/sample-mux.mjs).
  if (process.env.SAMPLE_PARTS === "1") {
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", final, "-an", "-c:v", "copy", "-movflags", "+faststart", path.join(out, `${job.id}.picture.mp4`)]);
    const vdir = path.join(out, "voice", job.id);
    fs.mkdirSync(vdir, { recursive: true });
    const clips = qari ? [qari.basmala, ...qari.verses].filter(Boolean) : [];
    const place = timeline.speakers.map((sp) => {
      if (sp.kind === "narrator") {
        const id = sp.who.replace(/^narrator /, "");
        const line = voice.lines.find((l) => l.id === id || l.id === `a${id}`);
        if (line && !voice.placeholder) fs.copyFileSync(path.join("public", line.file), path.join(vdir, path.basename(line.file)));
        return { kind: "narrator", line: line?.id ?? id, at: sp.frame / 30, seconds: sp.seconds, file: line && !voice.placeholder ? `voice/${job.id}/${path.basename(line.file)}` : null };
      }
      const key = sp.who.replace(/^qari /, "");
      const clip = clips.find((c) => (key === "basmala" ? c.ayah === null : String(c.ayah) === key));
      return { kind: "qari", clip: clip?.verseKey ?? key, at: sp.frame / 30, seconds: sp.seconds, src: clip?.src ?? null };
    });
    fs.writeFileSync(path.join(out, `${job.id}.sound.json`), `${JSON.stringify({ job: job.id, seconds, placeholder: Boolean(voice.placeholder), place }, null, 1)}
`);
    console.log(`${job.id}: sample parts written (picture only, ${place.length} voice places)`);
  }
  const table = props.kind === "verse" ? wordTable(inputProps) : [];
  if (table.length) {
    console.log(`${job.id}: when each word is lit (seconds of the video; no text)`);
    for (const r of table) console.log(`  ${r.clip.padEnd(15)} ${r.mode.padEnd(6)} ${String(r.word).padStart(4)}  ${r.start.toFixed(3).padStart(7)}  ${r.end.toFixed(3).padStart(7)}`);
  }

  if (frames) {
    const pick = (list) => list.map((n) => `eq(n\\,${n})`).join("+");
    const cols = 4;
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", final, "-vf", `select='${pick(marks)}',scale=264:-2,tile=${cols}x${Math.ceil(marks.length / cols)}:padding=6:color=0x060a14`, "-fps_mode", "vfr", "-frames:v", "1", "-q:v", "3", path.join(frameDir, `${job.id}-sheet.jpg`)]);
    marks.forEach((n, i) => execFileSync("ffmpeg", ["-y", "-v", "error", "-i", final, "-vf", `select='eq(n\\,${n})',scale=540:-2`, "-fps_mode", "vfr", "-frames:v", "1", "-q:v", "3", path.join(frameDir, `${job.id}-m${String(i + 1).padStart(2, "0")}.jpg`)]));
    console.log(`${job.id}: frames at ${marks.map((n) => (n / fps).toFixed(2)).join(", ")} s`);
  }

  const manifest = { ...manifestOf(props, voice, qari, seconds), checks: { audio: !overlap, safeFrame: props.kind === "insight" ? safeFrame() : props.kind === "waiting" ? safeFrame(textBoxes(props.format)) : true } };
  fs.writeFileSync(path.join(out, `${job.id}.manifest.json`), `${JSON.stringify(manifest, null, 1)}\n`);
  const record = {
    job: job.id,
    composition: { id: composition.id, width: composition.width, height: composition.height, fps, durationInFrames: composition.durationInFrames },
    seconds,
    voice: { engine: voice.engine, voice: voice.voice, reason: voice.reason ?? null, lines: voice.lines.map((l) => ({ id: l.id, seconds: l.seconds, words: l.words?.length ?? 0 })) },
    recitation: qari ? { source: qari.source, previewOnly: qari.previewOnly, recitationId: qari.recitationId, reciter: qari.reciter, fallbacks: qari.fallbacks, clips: [qari.basmala, ...qari.verses].filter(Boolean).map(({ words, ...c }) => ({ ...c, words: words.length })) } : null,
    speakers: segs,
    wordTimesInVideo: table,
    momentsSeconds: marks.map((n) => Math.round((n / fps) * 1000) / 1000),
  };
  fs.writeFileSync(path.join(out, `${job.id}.check.json`), `${JSON.stringify(record, null, 1)}\n`);
  console.log(`${job.id}: done in ${Math.round((Date.now() - t0) / 1000)} s`);
  return manifest;
}

runMain(import.meta, async (args) => {
  await renderJob(jobArg(args), { stills: args.includes("--stills") });
});
