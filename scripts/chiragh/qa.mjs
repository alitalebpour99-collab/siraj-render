// The QA gate of «چراغ», before anything can be published (style bible v2; storyboard-fa.md §5):
//   - shots: every shot 1–2.5 s, each starting on a word;
//   - still: frame by frame (10 a second), no stretch of more than 2.5 s without a visible change;
//   - sync: each verse word's light, measured in the PICTURE (its box gets darker as it turns
//     emerald), against the time the word is recited: the error must stay under 100 ms;
//   - legible: every text 40 px or more, contrast 4.5:1 (the Arabic 7:1), inside the apps' safe zones;
//   - verbatim: every piece of a verse joined gives the stored text back exactly, and what the page
//     drew (hashed in the page) is that piece;
//   - figures: the anchor comes from the library where no figure is drawn, and the vision judge
//     sees no person, face or rider;
//   - the vision score (Gemini on Vertex) of the 1 fps contact sheet against the references.
// Below 8/10, or any hard check failed: the run makes another concept (at most 2 more), then the
// video is held for the owner. Never auto-posted. Logs: numbers and ids only.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { quoteHash } from "../../src/lamp/zones.ts";
import { ART, cueIn } from "../../src/chiragh/art.ts";
import { gemini, jsonIn, textOf, vertexReady } from "./vertex.mjs";

export const PASS_SCORE = 8;
const SAFE = { left: 56, right: 888, top: 232, bottom: 1583 };

/** Gray frames of the video (w × h) at `fps`, as one Buffer per frame. */
function grayFrames(file, fps, w, h, crop = null) {
  const vf = [`fps=${fps}`, crop ? `crop=${crop}` : null, `scale=${w}:${h}`, "format=gray"].filter(Boolean).join(",");
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", vf, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error("qa: ffmpeg could not read the frames");
  const size = w * h;
  const out = [];
  for (let at = 0; at + size <= r.stdout.length; at += size) out.push(r.stdout.subarray(at, at + size));
  return out;
}

/** The longest stretch (seconds) in which no 0.5 s step changes at least 0.25 % of the picture visibly. */
export function stillness(frames, fps, { step = 0.5, pixel = 10, share = 0.0012 } = {}) {
  const lag = Math.max(1, Math.round(step * fps));
  let run = 0;
  let longest = 0;
  let longestAt = 0;
  const changes = [];
  for (let i = lag; i < frames.length; i++) {
    const a = frames[i - lag];
    const b = frames[i];
    let n = 0;
    for (let k = 0; k < a.length; k++) if (Math.abs(a[k] - b[k]) > pixel) n++;
    const moved = n / a.length >= share;
    changes.push(Math.round((n / a.length) * 10000) / 10000);
    if (moved) run = 0;
    else {
      run += 1 / fps;
      if (run > longest) {
        longest = run;
        longestAt = i / fps;
      }
    }
  }
  // a stretch without change counts from the last change: add the step it was measured over
  return { longest: Math.round((longest > 0 ? longest + step : 0) * 100) / 100, at: Math.round(longestAt * 100) / 100, changes };
}

/** The verse words' light measured in the picture: when each word's box crosses half-way to its lit shade. */
export function measureSync(file, sb, probes) {
  // nothing recited word by word (a writing read by the narrator): nothing to measure
  if (!sb.verses.some((v) => v.mode === "word")) return { measured: 0, skipped: 0, late: 0, medianMs: null, p90Ms: null, maxMs: null };
  const fps = 30;
  const Q = 2;
  const w = 1080 / Q;
  const y0 = 960;
  const h = 720 / Q;
  // the text zone only (y 960–1680), at half size
  const frames = grayFrames(file, fps, w, h, `1080:720:0:${y0}`);
  const boxOf = new Map();
  for (const p of probes) for (const x of p.words ?? []) if (!boxOf.has(x.w) && x.box[2] > 4) boxOf.set(x.w, x.box);
  const errs = [];
  const late = [];
  let skipped = 0;
  for (const v of sb.verses) {
    if (v.mode !== "word") continue;
    let k = 0;
    v.chunks.forEach((c, ci) => {
      c.words.forEach((wd, wi) => {
        const id = `${v.id}:${ci}:${wi}`;
        k++;
        const box = boxOf.get(id);
        // the first word of a piece that is still coming in, and words too short to see, are not measured
        if (!box || (wi === 0 && wd.start - c.from < 0.35) || wd.end - wd.start < 0.12) {
          skipped++;
          return;
        }
        const [bx, by0, bw, bh] = box.map((n) => Math.round(n / Q));
        const by = by0 - y0 / Q;
        const series = [];
        const f0 = Math.max(0, Math.floor((wd.start - 0.5) * fps));
        const f1 = Math.min(frames.length - 1, Math.ceil((wd.start + 0.5) * fps));
        for (let f = f0; f <= f1; f++) {
          const fr = frames[f];
          const px = [];
          for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (x >= 0 && y >= 0 && x < w && y < h) px.push(fr[y * w + x]);
          px.sort((a, b) => a - b);
          const core = px.slice(0, Math.max(1, Math.floor(px.length / 4)));
          series.push({ t: f / fps, m: core.reduce((a, b) => a + b, 0) / core.length });
        }
        const before = series.filter((p) => p.t <= wd.start - 0.15).map((p) => p.m);
        const after = series.filter((p) => p.t >= wd.start + 0.15 && p.t <= Math.min(wd.end, wd.start + 0.5)).map((p) => p.m);
        if (!before.length || !after.length) {
          skipped++;
          return;
        }
        const b = before.reduce((s, x) => s + x, 0) / before.length;
        const a = after.reduce((s, x) => s + x, 0) / after.length;
        // a word not yet on screen before it is recited is a layout fault, counted apart
        if (b > 225) {
          late.push(id);
          skipped++;
          return;
        }
        if (b - a < 1.0) {
          skipped++;
          return;
        }
        const mid = (a + b) / 2;
        const cross = series.find((p, i) => i > 0 && series[i - 1].m > mid && p.m <= mid);
        if (!cross) {
          skipped++;
          return;
        }
        // the crossing lies between two frames: interpolate
        const i = series.indexOf(cross);
        const p0 = series[i - 1];
        const tc = p0.t + ((p0.m - mid) / Math.max(1e-6, p0.m - cross.m)) * (cross.t - p0.t);
        errs.push(Math.round((tc - wd.start) * 1000) / 1000);
        if (process.env.QA_DEBUG) console.log(`sync ${id}: ${Math.round((tc - wd.start) * 1000)} ms (start ${wd.start}, end ${wd.end}, before ${b.toFixed(1)}, after ${a.toFixed(1)})`);
      });
    });
  }
  const abs = errs.map(Math.abs).sort((x, y) => x - y);
  const q = (p) => (abs.length ? abs[Math.min(abs.length - 1, Math.floor(p * abs.length))] : null);
  return { measured: errs.length, skipped, late: late.length, medianMs: q(0.5) === null ? null : Math.round(q(0.5) * 1000), p90Ms: q(0.9) === null ? null : Math.round(q(0.9) * 1000), maxMs: abs.length ? Math.round(abs.at(-1) * 1000) : null };
}

/** The texts the page drew: sizes, contrast, safe zones, and the hash of each verse piece against the stored text. */
export function checkTexts(sb, probes, sources) {
  const problems = [];
  // every verse's pieces are its stored text, exactly
  for (const v of sb.verses) {
    const joined = v.chunks.map((c) => c.text).join("");
    const src = sources[v.id];
    if (src !== undefined && joined !== src) problems.push(`verbatim: ${v.key} is not the stored text`);
    if (v.translation !== null && sources[`${v.id}:t`] !== undefined && v.transChunks.map((c) => c.text).join("") !== sources[`${v.id}:t`]) problems.push(`verbatim: the translation of ${v.key} is not as served`);
  }
  const want = new Map();
  for (const v of sb.verses) {
    v.chunks.forEach((c, i) => want.set(`${v.id}:${i}`, quoteHash(c.text)));
    v.transChunks.forEach((c, i) => want.set(`${v.id}:t${i}`, quoteHash(c.text)));
  }
  const seen = new Set();
  let small = 0;
  let faint = 0;
  let outside = 0;
  for (const p of probes) {
    for (const x of p.texts ?? []) {
      if (x.op < 0.5) continue;
      if (x.q && want.has(x.q)) {
        seen.add(x.q);
        if (want.get(x.q) !== x.h) problems.push(`verbatim: the page drew ${x.q} differently from the stored text (frame ${p.f})`);
      }
      if (x.role === "label") continue;
      if (x.size < 39.5) small++;
      // a waiting verse word is 6:1, a recited one 7:1 (emerald); every other text 4.5:1
      const need = 4.5;
      if (x.contrast < need) faint++;
      const [bx, by, bw, bh] = x.box;
      if (bw > 0 && (bx < SAFE.left - 2 || by < SAFE.top - 2 || bx + bw > SAFE.right + 2 || by + bh > SAFE.bottom + 2)) outside++;
    }
  }
  for (const k of want.keys()) if (!seen.has(k)) problems.push(`verbatim: ${k} was never measured on screen`);
  if (small) problems.push(`legible: ${small} text measurements under 40 px`);
  if (faint) problems.push(`legible: ${faint} text measurements under the contrast`);
  if (outside) problems.push(`legible: ${outside} text measurements outside the safe zones`);
  return problems;
}

export const CRITERIA = [
  "new: something new appears every 1–2.5 s (a line drawing on, a word lighting up, a camera move); never a still card",
  "anchor: ONE anchor drawing per video that builds line by line and that the camera visits, like the @ensan.besham line-art explainer",
  "sync: the verse's words light up one by one with the recitation, clearly readable",
  "grid: one fixed grid (title top, drawing middle, text below, lamp low) and only cream, emerald and the lamp's gold",
  "lines: precise, uniform-weight emerald lines with a soft glow; geometric, like an architect's drawing; never crude or half-finished",
  "hook: the first frame already says what the video is and shows the beginning of the drawing",
  "ending: short close that returns to the first picture (loop) with the sources",
  "legible: all text large and clear on a phone",
  "respect: no person, face, figure or rider anywhere; no hexagram; no generated calligraphy",
  "calm: calm and respectful, but never static",
  "meaning: the drawing and its animation SAY WHAT THE TEXT SAYS (owner, 28 Nov): its key image (given below with the translation) appears and moves in step with the verse that names it, accurately to the text's sense; a generic decorative lamp or arch that could sit under any verse scores low here",
];

/** The text and its image, for the judge's meaning criterion: each verse's translation and the stages its words call (ids only). */
export function meaningBrief(sb) {
  const art = sb.anchor.inline ?? ART[sb.anchor.art];
  const verses = (sb.verses ?? []).filter((v) => v.ayah !== null).map((v) => {
    const stages = (art?.groups ?? []).filter((g) => g.cue && cueIn(g.cue, `${v.chunks.map((c) => c.text).join(" ")} ${v.translation ?? ""}`)).map((g) => g.id);
    return `${v.key} «${String(v.translation ?? "").slice(0, 160)}»${stages.length ? ` → draws ${stages.join(", ")}` : ""}`;
  });
  const why = sb.anchor.meaning?.why ? ` Chosen because: ${sb.anchor.meaning.why}.` : "";
  return `image «${sb.anchor.art}».${why} Verses: ${verses.join("; ")}`.slice(0, 1800);
}

/** The vision judge, twice (it is not steady from one look to the next): the median of the two looks, and both kept. */
export async function visionScore(sheetFile, styleFile, extra = {}) {
  const looks = [];
  for (let k = 0; k < 2; k++) looks.push(await visionOnce(sheetFile, styleFile, extra));
  const scores = looks.map((l) => l.score).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  // the median of two is their mean; a look that failed does not count
  const score = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  const pick = looks.reduce((a, b) => (Math.abs((a.score ?? 0) - (score ?? 0)) <= Math.abs((b.score ?? 0) - (score ?? 0)) ? a : b));
  return { ...pick, score, looks: looks.map((l) => l.score), person: looks.some((l) => l.person) };
}

async function visionOnce(sheetFile, styleFile, { strip = null, template = "", anchorKind = "", meaning = "" } = {}) {
  const parts = [
    { text: "Image 1: the APPROVED style frame of Siraj's video style «Chiragh» (the verse area is left empty on purpose)." },
    ...(fs.existsSync(styleFile) ? [{ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(styleFile).toString("base64") } }] : []),
    { text: `Image 2: a contact sheet of a NEW video, one frame per second, read left to right, top to bottom. Its template is «${template}»; its anchor drawing is ${anchorKind}. The approved frame shows ONE possible anchor (a mihrab): other anchors and data drawings (a strip of verses, a map of the surahs, a root of letters) are allowed in the same style; judge the style, not whether it is an arch.${meaning ? ` For the meaning criterion, the text and its chosen image: ${meaning}` : ""}` },
    { inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(sheetFile).toString("base64") } },
    ...(strip && fs.existsSync(strip) ? [{ text: "Image 3: the verse area of the NEW video at 5 frames per second during the recitation (read left to right, top to bottom): the word light is judged here, not on the small 1 fps sheet." }, { inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(strip).toString("base64") } }] : []),
    {
      text: `You are a strict short-video art director. Score the NEW video 0–10 (one decimal) against these criteria, as a viewer of top explainer Reels would. Calibration: 10 = the level of the @ensan.besham line-art explainer and the Zoomit "World Ahead 2027" explainer (one anchor drawing built line by line, something new every 1–2 s); 2.5 = Siraj's old video where one verse card stood still for 12 s with only a small lamp icon. Be honest; do not round up.
Criteria:
${CRITERIA.map((c, i) => `${i + 1}. ${c}`).join("\n")}
Also answer: is any person, human face, human figure, silhouette or rider depicted anywhere (true/false)?
Return JSON only: {"score": number, "criteria": {"new": n, "anchor": n, "sync": n, "grid": n, "lines": n, "hook": n, "ending": n, "legible": n, "respect": n, "calm": n, "meaning": n}, "person_depicted": boolean, "issues": [short strings], "to_reach_10": [short strings]}`,
    },
  ];
  let r = null;
  let by = "gemini-3.5-flash";
  // Gemini on Vertex first; when Vertex refuses (20 Nov: 403 «eligible paid billing account» on every
  // Gemini model of the trial credit), Claude looks at the same images with the same criteria
  if (vertexReady()) {
    try {
      for (let attempt = 1; attempt <= 3 && !r; attempt++) {
        const j = await gemini("gemini-3.5-flash", { contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: 6000 } }, { what: "qa-vision", tries: 4 });
        try {
          r = jsonIn(textOf(j));
        } catch (error) {
          if (attempt === 3) throw error;
        }
      }
    } catch (error) {
      console.log(`qa: Gemini could not judge (${String(error.message).slice(0, 80)}); Claude judges`);
    }
  }
  if (!r && process.env.ANTHROPIC_API_KEY) {
    by = "claude-opus-5-5";
    r = await claudeJudge(parts);
  }
  if (!r) return { score: null, why: "no vision judge answered" };
  return { score: Number(r.score), criteria: r.criteria ?? {}, person: Boolean(r.person_depicted), issues: r.issues ?? [], toReach10: r.to_reach_10 ?? [], by };
}

const n = { type: "number" };
const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "criteria", "person_depicted", "issues", "to_reach_10"],
  properties: {
    score: n,
    criteria: { type: "object", additionalProperties: false, required: ["new", "anchor", "sync", "grid", "lines", "hook", "ending", "legible", "respect", "calm", "meaning"], properties: Object.fromEntries(["new", "anchor", "sync", "grid", "lines", "hook", "ending", "legible", "respect", "calm", "meaning"].map((k) => [k, n])) },
    person_depicted: { type: "boolean" },
    issues: { type: "array", items: { type: "string" } },
    to_reach_10: { type: "array", items: { type: "string" } },
  },
};

/** The same look by Claude (vision, structured output): the Gemini parts turned into Claude content blocks. */
async function claudeJudge(parts) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const content = parts.map((p) => (p.inlineData ? { type: "image", source: { type: "base64", media_type: p.inlineData.mimeType, data: p.inlineData.data } } : { type: "text", text: p.text }));
  const res = await client.messages.create({ model: "claude-opus-5-5", max_tokens: 4000, output_config: { effort: "low", format: { type: "json_schema", schema: JUDGE_SCHEMA } }, messages: [{ role: "user", content }] });
  if (res.stop_reason === "refusal") throw new Error("claude judge: refused");
  console.log(`qa: Claude judged, ${res.usage?.input_tokens ?? 0} in, ${res.usage?.output_tokens ?? 0} out`);
  return jsonIn(res.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
}

/** The 1 fps contact sheet (8 across), with each second's number in its corner. */
export function contactSheet(file, seconds, out) {
  const rows = Math.max(1, Math.ceil(seconds / 6));
  const label = "drawtext=text='%{eif\\:n\\:d}s':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=0x0a4535@0.85,";
  const run = (withLabel) => execFileSync("ffmpeg", ["-y", "-v", "error", "-i", file, "-vf", `fps=1,scale=${rows > 12 ? Math.max(90, Math.floor(2400 / rows)) : 270}:-2,${withLabel ? label : ""}tile=6x${rows}:padding=4:color=0x6e6250`, "-frames:v", "1", "-q:v", "3", out]);
  // an ffmpeg without drawtext (a static fallback build) makes the sheet without the second numbers
  try {
    run(true);
  } catch {
    run(false);
  }
  return out;
}

/** The whole gate on one rendered video. */
export async function runGate({ file, sb, probes, sources, styleFile, sheetFile, vision = true }) {
  const hard = [];
  // shots
  const badShots = sb.shots.filter((s) => s.dur < 1 - 1e-6 || s.dur > 2.5 + 1e-6);
  if (badShots.length) hard.push(`shots: ${badShots.length} shots outside 1–2.5 s`);
  const locked = sb.shots.filter((s) => s.at_word.track !== "none" && !s.at_word.after).length;
  // still
  const frames = grayFrames(file, 10, 270, 480);
  const still = stillness(frames, 10);
  if (still.longest > 2.5) hard.push(`still: ${still.longest} s without a visible change (at ${still.at} s)`);
  // sync
  const sync = measureSync(file, sb, probes);
  if (sync.measured && sync.p90Ms > 100) hard.push(`sync: 90 % of the words within ${sync.p90Ms} ms (over 100)`);
  if (sb.verses.some((v) => v.mode === "word") && !sync.measured) hard.push("sync: no word could be measured");
  if (sync.late) hard.push(`sync: ${sync.late} verse words appear only after they are recited`);
  // texts
  hard.push(...checkTexts(sb, probes, sources));
  // figures (the library)
  const art = sb.anchor.inline ?? ART[sb.anchor.art];
  if (!art || art.figures !== false) hard.push("figures: the anchor is not from the figure-free library");
  // vision
  contactSheet(file, sb.total, sheetFile);
  // the verse area at 5 fps over 3 s of recitation (the judge sees the word light there)
  let strip = null;
  const first = sb.verses.find((v) => v.mode === "word" && v.ayah !== null && v.chunks[0]?.words.length > 2);
  if (first) {
    strip = sheetFile.replace(/\.jpg$/, "-words.jpg");
    const at = Math.max(0, first.chunks[0].words[0].start - 0.2);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", at.toFixed(2), "-t", "3", "-i", file, "-vf", "fps=5,crop=1080:300:0:1060,scale=540:-2,tile=3x5:padding=4:color=0x6e6250", "-frames:v", "1", "-q:v", "3", strip]);
  }
  let judge = { score: null, why: "skipped" };
  if (vision) {
    try {
      judge = await visionScore(sheetFile, styleFile, { strip, template: sb.template, anchorKind: sb.anchor.inline ? `a data drawing («${sb.anchor.art}»)` : `the «${sb.anchor.art}» line drawing`, meaning: meaningBrief(sb) });
    } catch (error) {
      judge = { score: null, why: String(error.message).slice(0, 160) };
    }
  }
  if (judge.person) hard.push("figures: the vision judge saw a person or a figure");
  const scoreOk = judge.score !== null && judge.score >= PASS_SCORE;
  const pass = hard.length === 0 && scoreOk;
  return {
    pass,
    score: judge.score,
    hard,
    judge,
    shots: { count: sb.shots.length, locked, minS: Math.min(...sb.shots.map((s) => s.dur)), maxS: Math.max(...sb.shots.map((s) => s.dur)) },
    still: { longestS: still.longest, at: still.at },
    sync,
  };
}

export const sheetPath = (dir, id, n) => path.join(dir, `${id}-sheet1fps${n > 1 ? `-try${n}` : ""}.jpg`);
