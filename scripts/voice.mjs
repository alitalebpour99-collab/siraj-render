// Makes the voice track of a sample: one WAV per line into public/voice/<sample>/, and
// public/voice/<sample>/manifest.json with the length of each (no text in it).
//   node scripts/voice.mjs en-verse          one sample (props/<sample>.json must exist)
//   node scripts/voice.mjs all
//
// What is read aloud: for a verse sample the TRANSLATION of each ayah, exactly as the API
// served it; for the counts sample the narration's `say` lines. The Arabic text is never voiced.
// The speech engine runs in scripts/tts.py with its whole output kept in .work/ (never shown):
// an engine may echo what it reads, and no sacred or translated text may reach a log. Only
// counts, ids and seconds are printed here.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { SAMPLES } from "./samples.mjs";

const want = process.argv[2];
if (!want) {
  console.error("usage: node scripts/voice.mjs <sample|all>");
  process.exit(2);
}
const names = want === "all" ? Object.keys(SAMPLES) : [want];
const python = process.env.PYTHON || "python";
fs.mkdirSync(".work", { recursive: true });

/** Only the shape of a failure: the names of the files and of the error, never its message. */
function failureShape(log) {
  return log
    .split("\n")
    .filter((l) => /^\s*File "/.test(l) || /^[A-Za-z_][\w.]*(Error|Exception|Exit)\b/.test(l))
    .map((l) => l.replace(/^([A-Za-z_][\w.]*(Error|Exception|Exit))\b.*$/, "$1"))
    .slice(-12)
    .join("\n");
}

for (const name of names) {
  const sample = SAMPLES[name];
  if (!sample) throw new Error(`unknown sample ${name}`);
  const props = JSON.parse(fs.readFileSync(path.join("props", `${name}.json`), "utf8"));
  const lines =
    props.kind === "counts"
      ? props.narration.map((n) => ({ id: n.id, text: n.say }))
      : props.ayahs.map((a) => ({ id: `a${a.ayahNumber}`, text: a.translation }));

  const outDir = path.join("public", "voice", name);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const job = path.resolve(".work", `job-${name}.json`);
  const logFile = path.resolve(".work", `tts-${name}.log`);
  fs.writeFileSync(job, JSON.stringify({ voice: sample.voice, lines }));

  const t0 = Date.now();
  const run = spawnSync(python, ["scripts/tts.py", job, outDir], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  fs.writeFileSync(logFile, `${run.stdout ?? ""}\n${run.stderr ?? ""}`);
  fs.rmSync(job, { force: true });

  const manifestFile = path.join(outDir, "manifest.json");
  let manifest;
  if (run.status === 0 && fs.existsSync(path.join(outDir, "tts.json"))) {
    const made = JSON.parse(fs.readFileSync(path.join(outDir, "tts.json"), "utf8"));
    fs.rmSync(path.join(outDir, "tts.json"));
    manifest = {
      engine: sample.voice.engine,
      voice: sample.voice.engine === "kokoro" ? `kokoro-82m:${sample.voice.voice}:${sample.voice.speed}` : `mana-persian-piper:fa_IR-mana-medium:length_scale=${sample.voice.lengthScale}`,
      lines: made.map((m) => ({ id: m.id, file: `voice/${name}/${m.file}`, seconds: m.seconds })),
    };
    console.log(`${name}: ${manifest.voice}, ${manifest.lines.length} lines (${manifest.lines.map((l) => `${l.id} ${l.seconds.toFixed(2)}s`).join(", ")}) in ${Math.round((Date.now() - t0) / 1000)} s`);
  } else {
    console.log(`${name}: the ${sample.voice.engine} voice failed (exit ${run.status ?? run.signal ?? run.error?.code}); its output stays in .work/, shape:`);
    console.log(failureShape(`${run.stdout ?? ""}\n${run.stderr ?? ""}`) || "(no traceback)");
    // Only the Persian sample may go without a voice (brief S1): on-screen timing then.
    if (sample.voice.engine !== "piper") process.exit(1);
    manifest = { engine: "none", voice: null, reason: `${sample.voice.engine} failed on this machine`, lines: [] };
    console.log(`${name}: no voice; the video is timed by reading length`);
  }
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + "\n");
}
