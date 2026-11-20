// The word times of a recitation, checked against the sound itself. The Quran Foundation's word
// segments are aligned on the reciter's audio; here each word's start is compared with the clip
// we actually cut (its loudness, every 10 ms): where the sound has a clear dip within 120 ms of
// the segment's boundary (the breath or the stop between two words), the start moves onto it.
// The result: start times that sit on the sound of THIS clip, and how far they moved (reported;
// a large drift means the segments do not fit the file and the light falls back to whole verses).
import fs from "node:fs";

/** Mono loudness every `stepMs` of a 16-bit PCM WAV (any rate, any channel count). */
export function envelope(file, stepMs = 10) {
  const buf = fs.readFileSync(file);
  let at = 12;
  let fmt = null;
  let data = null;
  while (at + 8 <= buf.length) {
    const id = buf.toString("latin1", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === "fmt ") fmt = { channels: buf.readUInt16LE(at + 10), rate: buf.readUInt32LE(at + 12), bits: buf.readUInt16LE(at + 22) };
    if (id === "data") data = buf.subarray(at + 8, Math.min(buf.length, at + 8 + size));
    at += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error("align: not a 16-bit PCM WAV");
  const frame = fmt.channels * 2;
  const per = Math.max(1, Math.round((fmt.rate * stepMs) / 1000));
  const n = Math.floor(data.length / frame);
  const env = [];
  for (let s = 0; s < n; s += per) {
    let sum = 0;
    let k = 0;
    for (let j = s; j < Math.min(n, s + per); j++) {
      let v = 0;
      for (let c = 0; c < fmt.channels; c++) v += data.readInt16LE(j * frame + c * 2);
      v /= fmt.channels;
      sum += v * v;
      k++;
    }
    env.push(Math.sqrt(sum / Math.max(1, k)));
  }
  return { env, stepMs };
}

/**
 * Word times moved onto the dips of the sound. `words`: [{start, end}] in seconds of the clip.
 * Returns the refined words and the drift (seconds) of each start.
 */
export function refine(words, { env, stepMs }, { reach = 0.12, depth = 0.55 } = {}) {
  const sec = (i) => (i * stepMs) / 1000;
  const idx = (t) => Math.max(0, Math.min(env.length - 1, Math.round((t * 1000) / stepMs)));
  const out = words.map((w) => ({ ...w }));
  const drift = [];
  for (let k = 1; k < out.length; k++) {
    const t = out[k].start;
    const a = idx(t - reach);
    const b = idx(t + reach);
    let low = a;
    for (let i = a; i <= b; i++) if (env[i] < env[low]) low = i;
    // a dip counts when it is clearly lower than the sound around it (the words on both sides)
    const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
    const around = (mean(env.slice(idx(t - 0.25), idx(t - 0.12) + 1)) + mean(env.slice(idx(t + 0.12), idx(t + 0.25) + 1))) / 2;
    let start = t;
    if (around > 0 && env[low] < around * depth) {
      // the word starts where the sound rises again after the dip
      let rise = low;
      while (rise < b && env[rise + 1] <= env[low] * 1.6) rise++;
      start = sec(rise);
    }
    start = Math.max(out[k - 1].start + 0.06, Math.min(start, out[k].end - 0.04 > out[k - 1].start ? out[k].end - 0.04 : start));
    drift.push(Math.round((start - t) * 1000) / 1000);
    out[k - 1].end = Math.min(out[k - 1].end, Math.max(out[k - 1].start + 0.05, start));
    out[k].start = Math.round(start * 1000) / 1000;
  }
  return { words: out, drift };
}

/** Refines every word-mode clip of a qari manifest in place; returns the drift summary. */
export function refineQari(qari, publicDir = "public") {
  if (!qari) return null;
  const all = [];
  for (const c of [qari.basmala, ...qari.verses].filter(Boolean)) {
    if (c.mode !== "word" || c.words.length < 2) continue;
    try {
      const e = envelope(`${publicDir}/${c.file}`);
      const r = refine(c.words, e);
      c.words = r.words;
      c.refined = true;
      all.push(...r.drift);
    } catch (error) {
      console.log(`align: ${c.verseKey}: kept the segments (${error.message})`);
    }
  }
  const abs = all.map(Math.abs).sort((a, b) => a - b);
  const median = abs.length ? abs[Math.floor(abs.length / 2)] : 0;
  const moved = all.filter((d) => Math.abs(d) > 0.005).length;
  console.log(`align: ${all.length} word starts checked against the sound, ${moved} moved, median drift ${(median * 1000).toFixed(0)} ms, largest ${((abs.at(-1) ?? 0) * 1000).toFixed(0)} ms`);
  return { words: all.length, moved, medianMs: Math.round(median * 1000), maxMs: Math.round((abs.at(-1) ?? 0) * 1000) };
}
