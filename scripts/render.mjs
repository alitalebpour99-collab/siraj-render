// Renders a sample: its video, its two covers, check frames and its source record, into out/.
//   node scripts/render.mjs en-verse         (props/en-verse.json and public/voice/en-verse/ must exist)
//   node scripts/render.mjs all
// out/<sample>.mp4            1080×1920, 30 fps, H.264 + AAC 48 kHz, moov at the front
// out/<sample>-cover.jpg      1080×1920 Reel cover
// out/<sample>-grid.jpg       1080×1350 grid crop
// out/<sample>.sources.json   the API's source lines, release keys, locators and hashes (no text)
// out/frames/<sample>-*.jpg   frames every 1.5 s and a contact sheet, for looking at
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { SAMPLES } from "./samples.mjs";

const want = process.argv[2];
if (!want) {
  console.error("usage: node scripts/render.mjs <sample|all>");
  process.exit(2);
}
const names = want === "all" ? Object.keys(SAMPLES) : [want];
const out = path.resolve("out");
fs.mkdirSync(path.join(out, "frames"), { recursive: true });

const t0 = Date.now();
const serveUrl = await bundle({
  entryPoint: path.resolve("src/index.ts"),
  publicDir: path.resolve("public"),
  outDir: path.resolve("bundle"),
  enableCaching: false,
});
console.log(`bundled in ${Math.round((Date.now() - t0) / 1000)} s`);
const common = {
  serveUrl,
  timeoutInMilliseconds: 180000,
  chromiumOptions: { gl: process.env.RENDER_GL || "swangle" },
  logLevel: "warn",
};

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
  return `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
}

const probe = (file) =>
  JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,sample_rate,width,height,r_frame_rate:format=duration", "-of", "json", file]).toString());

for (const name of names) {
  const props = JSON.parse(fs.readFileSync(path.join("props", `${name}.json`), "utf8"));
  const voiceFile = path.join("public", "voice", name, "manifest.json");
  const voice = fs.existsSync(voiceFile) ? JSON.parse(fs.readFileSync(voiceFile, "utf8")) : { engine: "none", voice: null, lines: [] };
  const inputProps = { ...props, voice };
  const s0 = Date.now();

  const composition = await selectComposition({ ...common, id: name, inputProps });
  const raw = path.join(out, `${name}.raw.mp4`);
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
      if (step > last) console.log(`${name}: ${step * 25}%`);
      last = Math.max(last, step);
    },
  });

  // AAC at 48 kHz, speech levelled to -16 LUFS (no levelling of a silent track), moov at the front.
  const final = path.join(out, `${name}.mp4`);
  const audioFilter = voice.lines.length ? ["-af", levelFilter(raw)] : [];
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-c:v", "copy", ...audioFilter, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", final]);
  fs.rmSync(raw);

  const info = probe(final);
  const v = info.streams.find((s) => s.codec_type === "video");
  const a = info.streams.find((s) => s.codec_type === "audio");
  const ok = v?.codec_name === "h264" && v.width === 1080 && v.height === 1920 && a?.codec_name === "aac" && a.sample_rate === "48000" && moovFirst(final);
  console.log(
    `${name}: ${Number(info.format.duration).toFixed(2)} s, video ${v?.codec_name} ${v?.width}x${v?.height} ${v?.r_frame_rate}, audio ${a?.codec_name} ${a?.sample_rate} Hz, moov first ${moovFirst(final)}, voice ${voice.voice ?? "none"}, in ${Math.round((Date.now() - s0) / 1000)} s`,
  );
  if (!ok) throw new Error(`${name}: the video is not H.264 1080x1920 with AAC 48 kHz and moov at the front`);

  // the covers
  for (const [kind, id] of [["cover", `${name}-cover`], ["grid", `${name}-grid`]]) {
    const still = await selectComposition({ ...common, id, inputProps });
    await renderStill({ ...common, composition: still, inputProps, imageFormat: "jpeg", jpegQuality: 92, output: path.join(out, `${name}-${kind}.jpg`) });
  }
  console.log(`${name}: covers written`);

  // frames to look at: one every 1.5 s, and all of them on one sheet
  const frames = path.join(out, "frames");
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", final, "-vf", "fps=2/3,scale=540:-2", "-q:v", "3", path.join(frames, `${name}-%02d.jpg`)]);
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", final, "-vf", "fps=2/3,scale=216:-2,tile=8x4:padding=4:color=0x060a14", "-frames:v", "1", "-q:v", "3", path.join(frames, `${name}-sheet.jpg`)]);

  // the record of where every line came from (no sacred or translated text in it)
  const record = {
    sample: name,
    composition: { id: composition.id, width: composition.width, height: composition.height, fps: composition.fps, durationInFrames: composition.durationInFrames },
    voice: { engine: voice.engine, voice: voice.voice, reason: voice.reason ?? null, readsOnly: props.kind === "counts" ? "the fixed English narration" : "the translation", lines: voice.lines.map((l) => ({ id: l.id, seconds: l.seconds })) },
    source: props.source,
    ...(props.kind === "verse"
      ? { surah: props.surah, ayahs: props.ayahs.map((x) => ({ ayahNumber: x.ayahNumber, locator: x.locator, textHashSha256: x.textHashSha256, textLength: x.text.length, translationLength: x.translation.length })) }
      : { totals: props.totals, narration: props.narration }),
  };
  fs.writeFileSync(path.join(out, `${name}.sources.json`), JSON.stringify(record, null, 1) + "\n");
}
console.log(`done in ${Math.round((Date.now() - t0) / 1000)} s`);
