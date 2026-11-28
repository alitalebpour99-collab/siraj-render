// Siraj round 5 (owner, 28 Nov: «what even is this lamp?! I didn't understand»): the picture is a
// rich, readable SCENE that a viewer at once connects with the verse (a sheltered room at night for
// refuge, stones falling from the sky over a desert valley for al-Fil), with slow Ken Burns motion,
// changing on the verse that names it. The lamp is only a small corner mark.
//
// Content rules (as the line art): no person's face, no prophet, imam or holy figure, nothing for
// God; no animal (al-Fil: the stones and the empty valley, never the elephant or the birds as
// animals). Every prompt names the verse's own image as the translation and the usual tafsir say it.
//
// The stills are made by Nano Banana Pro on Vertex (vertex.mjs), once per scene and job, before
// the bundle (Remotion serves them from public/scenes/<job>/). ~$0.13–0.15 a still; a job makes 3–4.
import fs from "node:fs";
import path from "node:path";
import { gemini, vertexReady } from "./vertex.mjs";

const LOOK =
  "Vertical 9:16 frame. Cinematic painterly realism, rich natural light, calm and reverent mood, deep colour, fine detail, soft film grain. " +
  "The most important subject sits in the UPPER two thirds; the bottom third is quiet (plain ground, soft shadow or sky) because text is set there. " +
  "Absolutely no people, no faces, no human figures or silhouettes, no animals, no birds, no text, no letters, no calligraphy, no symbols, no logos.";

/**
 * Checked scenes per passage: surah → scenes in order, each for the verses (ayah numbers) that name
 * its image. `why` says the verse's image (internal).
 */
export const PASSAGE_SCENES = {
  114: [
    { id: "shelter", ayahs: [1], why: "«I seek refuge in the Lord of mankind»: a safe shelter at night", prompt: "A small sheltered stone room at night, safe and warm: a single warm light glows in a wall niche, its golden light filling the room; outside an arched window a cold dark-blue storm blows and rain streaks the glass." },
    { id: "mankind", ayahs: [2, 3], why: "«the King of mankind, the God of mankind»: all people under one sovereign sky", prompt: "A vast old city of the Middle East at night seen from a hill, thousands of small warm lit windows like scattered embers, domes and roofs, under an immense clear starry sky that fills the upper half of the frame." },
    { id: "whisperer", ayahs: [4, 5], why: "«the whisperer who withdraws»: dark whispers curling back from the light", prompt: "A doorway in a dark stone wall at night: warm golden light pours out from inside, and thin wisps of dark grey smoke that were creeping towards the threshold curl back and retreat into the darkness, shrinking away from the light." },
    { id: "unseen", ayahs: [6], why: "«from among the jinn and mankind»: the unseen and the seen", prompt: "A wide desert valley at deep dusk, half in cold shadow and half in the last warm light: on the dark side a faint unseen mist drifts over the sand, on the lit side the tiny warm lights of a distant village; the first stars above." },
  ],
  105: [
    { id: "army", ayahs: [1, 2], why: "the army of the elephant marching on the House, and its plot", prompt: "A wide rocky desert valley among the bare dark mountains around Mecca at dawn, seen from high above: a long, heavy plume of dust rises on the far horizon where a great army is approaching (no figures visible, only the dust), the valley floor empty and still." },
    { id: "sky", ayahs: [3], why: "«He sent against them flocks from the sky»: the sky over the valley fills from above", prompt: "The sky over a desert valley among dark mountains suddenly filled from above: countless small dark streaks pour down in waves out of a golden, cloud-torn sky, sweeping over the valley; dramatic light, a sense of a sign from heaven, the ground below still empty." },
    { id: "stones", ayahs: [4], why: "«pelting them with stones of baked clay»", prompt: "Small hard stones of baked red clay falling like hail from the sky into a desert valley, each with a faint glowing streak behind it, striking the sand and raising little bursts of dust; the dark mountains around, dramatic low light." },
    { id: "straw", ayahs: [5], why: "«and made them like eaten straw»: the empty valley afterwards", prompt: "The same desert valley afterwards, silent and empty under a pale sky: the ground covered with broken, trampled dry straw and chewed husks blowing in a light wind, scattered baked-clay pebbles in the sand, the bare mountains of Mecca behind." },
  ],
  113: [
    { id: "daybreak", ayahs: [1], why: "«the Lord of the daybreak» (al-falaq)", prompt: "Dawn breaking over a vast desert: the first thin line of golden light splits the dark night sky above the dunes, the sky shading from deep indigo to warm gold." },
    { id: "darkness", ayahs: [2, 3], why: "«the evil of what He created, and of the darkness when it settles»", prompt: "Deep night settling over a desert valley: heavy dark clouds slide across the moon, the dunes sink into darkness, only a faint cold glow on the horizon." },
    { id: "knots", ayahs: [4, 5], why: "«those who blow on knots, the envier when he envies»: hidden harms, still guarded", prompt: "A quiet lamp-lit room at night seen through an open door, its warm light steady while the dark night presses at the windows outside; still, safe, guarded." },
  ],
  94: [
    { id: "burden", ayahs: [1, 2, 3, 4], why: "«did We not expand your breast, remove your burden»", prompt: "A wide open plain at early morning, the sky opening up endlessly above, a heavy dark storm front breaking apart and lifting away to reveal clear sky." },
    { id: "storm", ayahs: [5], why: "«with hardship comes ease»: the storm and the calm together", prompt: "A storm over the sea breaking: on one side dark rain and wind, on the other side clear calm sky and a soft golden light on still water, both in one frame." },
    { id: "calm", ayahs: [6, 7, 8], why: "«indeed with hardship comes ease … to your Lord turn»", prompt: "The sea completely calm after the storm at sunrise, mirror-still water reflecting a gentle golden sky, a few soft clouds." },
  ],
};

/** Scenes for a motif when no passage is checked (one per stage of the text). */
export const MOTIF_SCENES = {
  light: ["Night over a wide desert valley, a single point of warm light appears on the horizon.", "Dawn light spreading across the desert valley, warming the dunes and rocks.", "Full morning light flooding the whole valley, clear and bright."],
  rain: ["Dry cracked earth under a heavy grey sky, the first dark rain clouds gathering.", "Rain pouring onto the cracked dry earth, puddles forming in the cracks.", "The same ground days later, fresh green shoots everywhere under a clearing sky."],
  seed: ["A single seed in dark moist soil, close up, morning light.", "A young green shoot breaking through the soil, dew on its leaves.", "A field of tall golden wheat ears, full and heavy, under a warm sky."],
  sky: ["A desert at blazing midday under the high sun.", "The same desert at dusk, the sky turning orange and violet.", "The same desert at night, a sky full of stars and a thin crescent moon."],
  balance: ["An old brass balance scale on a stone table, its two pans uneven, warm window light.", "The brass balance scale coming level, its two pans even, calm light."],
  refuge: ["A small sheltered stone room at night with one warm light, a storm outside the window.", "A doorway pouring warm light into the dark night, shadows retreating from it."],
  stones: ["Stones falling from the sky over a desert valley.", "The empty desert valley afterwards, broken straw blowing in the wind."],
};

/** The scene plan of a material: [{ id, verses: [verse ids], prompt, why }] or null (no scenes). */
export function scenePlan(m, motif) {
  const verses = (m.verses ?? []).filter((v) => v.ayah !== null);
  if (!verses.length || m.data) return null;
  const surah = verses[0].surah;
  const have = new Set(verses.map((v) => v.ayah));
  const checked = PASSAGE_SCENES[surah];
  if (checked) {
    const out = checked.map((s) => ({ ...s, verses: s.ayahs.filter((a) => have.has(a)).map((a) => `a${a}`) })).filter((s) => s.verses.length);
    if (out.length) return out.map(({ id, verses: vs, prompt, why }) => ({ id, verses: vs, prompt: `${prompt} ${LOOK}`, why }));
  }
  const list = MOTIF_SCENES[motif];
  if (!list) return null;
  // share the motif's scenes out over the verses, in order
  return list.map((prompt, i) => {
    const from = Math.floor((i * verses.length) / list.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) * verses.length) / list.length));
    return { id: `${motif}-${i + 1}`, verses: verses.slice(from, to).map((v) => v.id), prompt: `${prompt} ${LOOK}`, why: `${motif} ${i + 1}/${list.length}` };
  }).filter((s) => s.verses.length);
}

/** USD per still, for the cost log and the cap. */
export const STILL_USD = 0.15;

/**
 * Makes the stills (Nano Banana Pro, else Nano Banana 2, else 2.5 Flash Image), once: a still already
 * on disk is kept. Returns the scenes that have their file; logs what it spent.
 */
export async function makeScenes(plan, jobId, { capUsd = Number(process.env.SIRAJ_SCENES_CAP_USD ?? 1.5), keepDir = "out" } = {}) {
  if (!plan?.length || !vertexReady()) return [];
  const dir = path.join("public", "scenes", jobId);
  fs.mkdirSync(dir, { recursive: true });
  let spent = 0;
  const done = [];
  for (const s of plan) {
    const file = path.join(dir, `${s.id}.jpg`);
    if (!fs.existsSync(file)) {
      if (spent + STILL_USD > capUsd + 1e-9) {
        console.log(`scenes: ${jobId}/${s.id} not made (cap $${capUsd})`);
        continue;
      }
      let bytes = null;
      for (const model of ["gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-2.5-flash-image"]) {
        try {
          const j = await gemini(model, { contents: [{ role: "user", parts: [{ text: s.prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } } }, { what: `scene ${jobId}/${s.id}`, tries: 6 });
          const part = (j?.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
          if (part) {
            bytes = Buffer.from(part.inlineData.data, "base64");
            spent += STILL_USD;
            console.log(`scenes: ${jobId}/${s.id} by ${model} (${Math.round(bytes.length / 1024)} KB)`);
            break;
          }
          console.log(`scenes: ${model} gave no image for ${s.id}`);
        } catch (error) {
          console.log(`scenes: ${model} failed for ${s.id}: ${String(error.message).slice(0, 120)}`);
        }
      }
      if (!bytes) continue;
      fs.writeFileSync(file, bytes);
    }
    // a copy stays with the trial (out/*.jpg is kept)
    try {
      fs.copyFileSync(file, path.join(keepDir, `${jobId}-scene-${s.id}.jpg`));
    } catch {
      /* a copy for looking only */
    }
    done.push({ ...s, file: `scenes/${jobId}/${s.id}.jpg` });
  }
  console.log(`scenes: ${jobId}: ${done.length}/${plan.length} stills, ~$${spent.toFixed(2)} spent now`);
  return done;
}

/**
 * The scenes on the storyboard's time: each from the moment its first verse comes on screen (0.45 s
 * before the verse's first shot, as the text) to the next scene; the first from frame 0.
 */
export function placeScenes(sb, made) {
  if (!made?.length) return null;
  const first = new Map();
  for (const s of sb.shots) if (s.text.layer === "verse" && s.text.ref && !first.has(s.text.ref)) first.set(s.text.ref, s.start);
  const timed = made
    .map((s) => ({ id: s.id, file: s.file, why: s.why, verses: s.verses, from: Math.min(...s.verses.map((v) => first.get(v) ?? Infinity)) }))
    .filter((s) => Number.isFinite(s.from))
    .sort((a, b) => a.from - b.from);
  if (!timed.length) return null;
  timed[0].from = 0;
  for (let i = 1; i < timed.length; i++) timed[i].from = Math.max(0, timed[i].from - 0.45);
  return timed.map((s, i) => ({ ...s, from: Math.round(s.from * 1000) / 1000, to: i + 1 < timed.length ? timed[i + 1].from : sb.total }));
}

/** A scene video opens on the hook verse, not on a basmala line (owner, 28 Nov): the basmala unit is left out. */
export function withoutBasmala(m) {
  return { ...m, verses: m.verses.filter((v) => v.ayah !== null), order: m.order.filter((o) => !(o.kind === "qari" && o.verse === "b")) };
}
