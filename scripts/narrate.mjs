// Makes the narrator's lines of a qari preview with ElevenLabs, ON THE OWNER'S PC (the key never
// goes to GitHub): public/narration/<preview>/<line>.mp3 and manifest.json. The MP3s are
// committed to the preview branch so that the GitHub run can use them; the key is not.
//   node scripts/narrate.mjs en-qari fa-qari [--dry]
//
// The narrator reads the factual intro (scripts/say.mjs), the TRANSLATION of each ayah exactly
// as Siraj's public API serves it (fetched here, kept in memory only, never written or printed),
// and the factual credit at the end. Never the Arabic. The manifest holds a SHA-256 of each
// translation line, so that the render can refuse audio that no longer matches the API's text.
// The log shows ids, character counts and seconds only; the key is read from ~/.elevenlabs_key
// and never printed. A line whose MP3 already matches (same text hash, voice and model) is not
// made again, so a second run costs nothing.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PREVIEWS } from "./samples.mjs";
import { introLine, outroLine } from "./say.mjs";

const API = process.env.SIRAJ_API ?? "https://siraj.ahura.cloud";
const XI = "https://api.elevenlabs.io/v1";
const FORMAT = "mp3_44100_128";
/** The whole job must stay under this many characters (the account is shared; brief: < 1,500). */
const BUDGET = 1400;

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const names = args.filter((a) => !a.startsWith("--"));
if (!names.length) {
  console.error("usage: node scripts/narrate.mjs <preview> [more] [--dry]");
  process.exit(2);
}
for (const n of names) if (!PREVIEWS[n]) throw new Error(`unknown preview ${n}`);

const key = fs.readFileSync(path.join(os.homedir(), ".elevenlabs_key"), "utf8").trim();
const xiHeaders = { "xi-api-key": key };
const sha256 = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const check = (ok, what) => {
  if (!ok) throw new Error(`check failed: ${what}`);
};

async function getJson(url, headers = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json", ...headers } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      if (attempt >= 3) throw new Error(`${url.replace(/\?.*/, "")}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function credits() {
  const s = await getJson(`${XI}/user/subscription`, xiHeaders);
  return { used: s.character_count, limit: s.character_limit, remaining: s.character_limit - s.character_count };
}

/** The lines of one preview, with their texts in memory only. */
async function linesOf(name) {
  const sample = PREVIEWS[name];
  const passage = await getJson(`${API}/api/quran/${sample.surah}?lang=${sample.lang}`);
  check(passage.service === "siraj-public-quran" && passage.trust?.verbatim_text_only === true && passage.trust?.text_hash_verified_at_read_time === true, `${name}: the API's trust flags`);
  check(passage.surahNumber === sample.surah && passage.ayahs.length === passage.ayahCount, `${name}: the whole surah`);
  check(!passage.translationGap && passage.translation?.language === sample.lang, `${name}: the translation covers the surah`);
  passage.ayahs.forEach((a, i) => check(a.ayahNumber === i + 1 && typeof a.translation === "string" && a.translation.length > 0, `${name}: ayah ${i + 1}`));
  return {
    sample,
    translationRelease: passage.translation.release?.releaseKey ?? null,
    lines: [
      { id: "intro", reads: "intro", ayah: null, text: introLine(sample, passage.ayahCount), own: true },
      ...passage.ayahs.map((a) => ({ id: `a${a.ayahNumber}`, reads: "translation", ayah: a.ayahNumber, text: a.translation, own: false })),
      { id: "outro", reads: "outro", ayah: null, text: outroLine(sample, passage.translation.translatorName), own: true },
    ],
  };
}

const seconds = (file) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

async function speak(narrator, text) {
  const body = { text, model_id: narrator.model, voice_settings: narrator.settings };
  const res = await fetch(`${XI}/text-to-speech/${narrator.voiceId}/with-timestamps?output_format=${FORMAT}`, {
    method: "POST",
    headers: { ...xiHeaders, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let status = "";
    try {
      status = (await res.json())?.detail?.status ?? "";
    } catch {}
    throw new Error(`ElevenLabs HTTP ${res.status} ${status}`);
  }
  const j = await res.json();
  const a = j.alignment ?? j.normalized_alignment;
  let speechStart = null;
  let speechEnd = null;
  if (a?.characters?.length) {
    const spoken = a.characters.map((c, i) => (/\S/u.test(c) ? i : -1)).filter((i) => i >= 0);
    if (spoken.length) {
      speechStart = a.character_start_times_seconds[spoken[0]];
      speechEnd = a.character_end_times_seconds[spoken[spoken.length - 1]];
    }
  }
  return { audio: Buffer.from(j.audio_base64, "base64"), speechStart, speechEnd };
}

const before = await credits();
console.log(`ElevenLabs before: ${before.used} of ${before.limit} characters used, ${before.remaining} left`);

const jobs = [];
for (const name of names) {
  const { sample, translationRelease, lines } = await linesOf(name);
  const dir = path.join("public", "narration", name);
  const manifestFile = path.join(dir, "manifest.json");
  const old = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : null;
  const same = (line) => {
    const o = old?.voiceId === sample.narrator.voiceId && old?.model === sample.narrator.model ? old.lines.find((l) => l.id === line.id) : null;
    return o && o.textSha256 === sha256(line.text) && fs.existsSync(path.join("public", o.file)) ? o : null;
  };
  for (const line of lines) jobs.push({ name, sample, translationRelease, dir, line, keep: same(line) });
}
const toMake = jobs.filter((j) => !j.keep);
const chars = toMake.reduce((n, j) => n + j.line.text.length, 0);
console.log(`plan: ${jobs.length} lines, ${toMake.length} to make, ${chars} characters (${toMake.map((j) => `${j.name}/${j.line.id} ${j.line.text.length}`).join(", ")})`);
if (chars > BUDGET) throw new Error(`${chars} characters is over the budget of ${BUDGET}; nothing was sent`);
if (chars > before.remaining) throw new Error(`${chars} characters is more than the ${before.remaining} left; nothing was sent`);
if (dry) process.exit(0);

let sent = 0;
const made = new Map();
/** Written after every line, so that a run cut short keeps what it paid for. */
function writeManifest(name) {
  const { job, lines } = made.get(name);
  const n = job.sample.narrator;
  const manifest = {
    engine: n.engine,
    model: n.model,
    voiceId: n.voiceId,
    voiceName: n.voiceName,
    settings: n.settings,
    outputFormat: FORMAT,
    madeAt: new Date().toISOString(),
    translationRelease: job.translationRelease,
    reads: "the intro line, the translation of each ayah as Siraj's API serves it, the closing credit; never the Arabic",
    lines,
  };
  fs.writeFileSync(path.join(job.dir, "manifest.json"), `${JSON.stringify(manifest, null, 1)}\n`);
}
for (const job of jobs) {
  const { name, sample, dir, line } = job;
  fs.mkdirSync(dir, { recursive: true });
  let entry = job.keep;
  if (!entry) {
    const { audio, speechStart, speechEnd } = await speak(sample.narrator, line.text);
    sent += line.text.length;
    const file = path.join(dir, `${line.id}.mp3`);
    fs.writeFileSync(file, audio);
    entry = {
      id: line.id,
      reads: line.reads,
      ayah: line.ayah,
      file: `narration/${name}/${line.id}.mp3`,
      seconds: Math.round(seconds(file) * 1000) / 1000,
      speechStart,
      speechEnd,
      chars: line.text.length,
      textSha256: sha256(line.text),
      // only the narrator's own factual lines are written out; a translation line never is
      ...(line.own ? { say: line.text } : {}),
    };
    console.log(`${name}/${line.id}: ${entry.chars} characters, ${entry.seconds.toFixed(2)} s (speech ${speechStart?.toFixed(2)}–${speechEnd?.toFixed(2)} s)`);
  } else console.log(`${name}/${line.id}: kept (${entry.seconds.toFixed(2)} s)`);
  if (!made.has(name)) made.set(name, { job, lines: [] });
  made.get(name).lines.push(entry);
  writeManifest(name);
}
for (const [name, { lines }] of made) console.log(`${name}: manifest with ${lines.length} lines, ${lines.reduce((sum, l) => sum + l.seconds, 0).toFixed(1)} s in all`);

const after = await credits();
console.log(`sent ${sent} characters; ElevenLabs after: ${after.used} of ${after.limit} used (${after.used - before.used} this run), ${after.remaining} left`);
