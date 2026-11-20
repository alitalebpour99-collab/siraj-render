// The concept writer (storyboard-fa.md §3, style bible v2 §7): Claude writes THREE concepts for
// this video inside the fixed style; code checks each one and picks (pick.mjs). The concept may
// only CHOOSE: the anchor and its regions from the library, the key word among the verse's own
// words, the hook among the template's approved lines, the idea family, the hook and ending
// types. It never writes a text that appears on screen (Siraj: AI-written texts are approved
// first; the verse is only the stored text). When Claude cannot be had, Gemini on Vertex writes
// them; when neither can, the code makes three by rule, so a video is never blocked on a model.
import { artIndex, ART } from "../../src/chiragh/art.ts";
import { FAMILIES, HOOK_TYPES, keyWordChoices } from "./material.mjs";
import { gemini, jsonIn, textOf, vertexReady } from "./vertex.mjs";

export const STYLE_SUMMARY = "warm cream, emerald text and fine line art, golden lamp glow, word-by-word highlight with the recitation, no music";
export const PROJECT_RULES =
  "verse and hadith text verbatim from the corpus with its reference; never generate or draw sacred text; no music; AI-written texts approved first; no images of the Prophet or Ahl al-Bayt; no hexagram; qari/translator credit on the card only";
export const ENDINGS = ["loop", "callback", "question"];
export const CLAUDE_MODEL = process.env.SIRAJ_CONCEPT_MODEL || "claude-opus-5-5";

/** What the concept writer is shown: the material without its sound files, the library, the recent fingerprints. */
export function brief(m, recent) {
  return {
    template: m.template,
    language: m.lang,
    title: m.title,
    allowed_hooks: m.hooks.map((text, choice) => ({ choice, text })),
    families: m.families,
    hook_types: HOOK_TYPES,
    endings: ENDINGS,
    verses: m.verses.filter((v) => v.ayah !== null).map((v) => ({ id: v.id, key: v.key, translation: v.translation })),
    key_word_choices: keyWordChoices(m).map((k) => ({ verse: k.verse, index: k.index, word: k.text })),
    narration: m.lines.filter((l) => !l.verse).map((l) => ({ id: l.id, text: l.text })),
    library: m.data ? [{ id: m.data.id, tags: m.data.tags, groups: m.data.groups.map((g) => g.id), regions: m.data.regions.map((r) => r.id), fixed: true }] : artIndex(),
    recent_fingerprints: recent.slice(0, 30),
  };
}

export function prompt(m, recent) {
  return `You are the creative director of Siraj (a Quran and Shia knowledge channel). Its ONE visual style is fixed: ${STYLE_SUMMARY}.
Never change palette, fonts, grid, logo position, motion language or sound (there is no music and no sound effect). Your freedom is the IDEA: which anchor drawing, which regions the camera visits and in what order, which single word of the verse is the key word that gets the camera's push, the idea family, the hook type and the ending.

Project rules: ${PROJECT_RULES}.
You never write any text that appears on screen: the hook is one of allowed_hooks (by its choice number), the verse and translation are shown exactly as stored. Your one_line, beats and new_because are internal notes for the team (never shown).

Input (JSON):
${JSON.stringify(brief(m, recent))}

Write THREE clearly different concepts. For each:
1. one_line: ≤ 14 words, ${m.lang === "fa" ? "Persian" : "English"}, the idea of this video
2. idea_family: one of families
3. hook: { type: one of hook_types, choice: index into allowed_hooks }
4. anchor: { art: an id of library (it must fit the verse's meaning: read the tags), regions: 2–4 region ids of that art in the order the camera visits them (the first is where it opens and closes), key_region: the region the camera pushes into on the key word }
5. key_word: { verse, index } from key_word_choices (the word that carries the verse; null for a template without a verse)
6. beats: 4–8 short internal notes, each = one moment + the drawn object that shows it
7. twist_at_beat: the beat where expectation turns
8. ending: { type: one of endings }
9. new_because: 2–4 reasons this differs from recent_fingerprints (name which)
Rules: no idea family used in the last 2 fingerprints; no hook type used in 2 of the last 3; no anchor used in the last 14 fingerprints when another anchor fits; the three concepts must differ in anchor or key word or regions.
Return JSON only: {"concepts":[...]}.`;
}

/** A concept is kept only when every choice exists. */
export function validConcept(c, m) {
  const why = [];
  if (!c || typeof c !== "object") return { ok: false, why: ["not an object"] };
  const art = m.data ?? ART[c.anchor?.art];
  if (!art) why.push(`anchor ${c.anchor?.art}`);
  if (m.data && c.anchor?.art !== m.data.id) c.anchor = { ...(c.anchor ?? {}), art: m.data.id };
  if (art) {
    const ids = art.regions.map((r) => r.id);
    c.anchor.regions = (Array.isArray(c.anchor.regions) ? c.anchor.regions : []).filter((r) => ids.includes(r));
    if (!c.anchor.regions.length) c.anchor.regions = [ids[0]];
    if (c.anchor.key_region && !ids.includes(c.anchor.key_region)) c.anchor.key_region = null;
  }
  if (!m.families.includes(c.idea_family)) why.push(`family ${c.idea_family}`);
  if (!HOOK_TYPES.includes(c.hook?.type)) why.push(`hook type ${c.hook?.type}`);
  const choice = Number(c.hook?.choice ?? 0);
  if (!m.hooks[choice]) why.push(`hook choice ${c.hook?.choice}`);
  else c.hook = { type: c.hook.type, choice, text: m.hooks[choice] };
  if (c.key_word) {
    const ok = keyWordChoices(m).some((k) => k.verse === c.key_word.verse && k.index === Number(c.key_word.index));
    if (!ok) c.key_word = null;
    else c.key_word = { verse: c.key_word.verse, index: Number(c.key_word.index) };
  }
  if (!ENDINGS.includes(c.ending?.type)) c.ending = { type: "loop" };
  return { ok: why.length === 0, why };
}

/** Three concepts made by rule (no model): different anchors by the verse's tags, the families in turn. */
export function ruleConcepts(m, recent) {
  const used = recent.slice(0, 14).map((r) => r.anchor_asset);
  const choices = keyWordChoices(m);
  const arts = m.data ? [m.data] : Object.values(ART).sort((a, b) => used.filter((u) => u === a.id).length - used.filter((u) => u === b.id).length);
  const pref = { "night-verse": ["night", "mishkat", "mihrab"], "verse-by-verse": ["mihrab", "rosette", "mushaf", "mishkat"], writing: ["olive", "mushaf", "mihrab"], path: ["oasis"] }[m.template] ?? [];
  arts.sort((a, b) => (pref.indexOf(b.id) >= 0 ? 10 - pref.indexOf(b.id) : 0) - (pref.indexOf(a.id) >= 0 ? 10 - pref.indexOf(a.id) : 0));
  return [0, 1, 2].map((i) => {
    const art = arts[i % arts.length];
    const regions = art.regions.map((r) => r.id);
    const k = choices.length ? choices[Math.min(choices.length - 1, Math.floor(((i + 1) * choices.length) / 4))] : null;
    return {
      one_line: `${art.id}: ${m.title.main}`,
      idea_family: m.families[i % m.families.length],
      hook: { type: HOOK_TYPES[(i * 2 + 3) % HOOK_TYPES.length], choice: 0 },
      anchor: { art: art.id, regions: [regions[0], ...regions.slice(1 + (i % Math.max(1, regions.length - 1))), ...regions.slice(1, 1 + (i % Math.max(1, regions.length - 1)))].slice(0, 4), key_region: regions[Math.min(regions.length - 1, 1 + i)] },
      key_word: k ? { verse: k.verse, index: k.index } : null,
      beats: [],
      twist_at_beat: 2,
      ending: { type: ENDINGS[i % ENDINGS.length] },
      new_because: ["made by rule"],
      by: "rule",
    };
  });
}

async function fromClaude(text) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const res = await client.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    messages: [{ role: "user", content: text }],
  });
  if (res.stop_reason === "refusal") throw new Error("claude: refused");
  const out = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  console.log(`concepts: Claude ${CLAUDE_MODEL}, ${res.usage?.input_tokens ?? 0} in, ${res.usage?.output_tokens ?? 0} out`);
  return jsonIn(out).concepts;
}

async function fromGemini(text) {
  const j = await gemini("gemini-3.5-flash", { contents: [{ role: "user", parts: [{ text }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8000 } }, { what: "concepts" });
  return jsonIn(textOf(j)).concepts;
}

/** Three checked concepts: Claude, else Gemini, else by rule (each source fills what the one before left out). */
export async function writeConcepts(m, recent = []) {
  const text = prompt(m, recent);
  const kept = [];
  const tried = [];
  const sources = [
    ["claude", process.env.ANTHROPIC_API_KEY ? () => fromClaude(text) : null],
    ["gemini", vertexReady() ? () => fromGemini(text) : null],
  ];
  for (const [by, run] of sources) {
    if (!run || kept.length >= 3) continue;
    try {
      const list = await run();
      for (const c of Array.isArray(list) ? list : []) {
        const v = validConcept(c, m);
        if (v.ok && kept.length < 3) kept.push({ ...c, by });
        else if (!v.ok) tried.push(`${by}: ${v.why.join(", ")}`);
      }
    } catch (error) {
      tried.push(`${by}: ${String(error.message).slice(0, 120)}`);
    }
  }
  for (const c of ruleConcepts(m, recent)) {
    if (kept.length >= 3) break;
    if (validConcept(c, m).ok) kept.push(c);
  }
  if (tried.length) console.log(`concepts: ${tried.join("; ")}`);
  console.log(`concepts: ${kept.map((c) => `${c.by}:${c.anchor.art}/${c.idea_family}/${c.hook.type}`).join(", ")}`);
  return kept;
}
