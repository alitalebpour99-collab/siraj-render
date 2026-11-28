// Google Vertex AI through Ahura's own Cloud Run proxy (GOOGLE_VERTEX_PROXY_URL / _KEY /
// GOOGLE_VERTEX_PROJECT; repository secrets, never printed). Gemini for the vision score and
// the concept fallback, Nano Banana for line-art references (lineart-gen.mjs). Vertex often
// answers 403 «paid billing account» or 429 for a moment: every call retries with backoff.
// Every call is logged to out/vertex-usage.jsonl with its model and token counts (for the cost log).
import fs from "node:fs";
import path from "node:path";

const env = process.env;
export const vertexReady = () => Boolean(env.GOOGLE_VERTEX_PROXY_URL && env.GOOGLE_VERTEX_PROXY_KEY && env.GOOGLE_VERTEX_PROJECT);

/** USD per million tokens (input, output), for the cost log only. */
const PRICE = { "gemini-3.5-flash": [0.3, 2.5], "gemini-3.1-pro-preview": [2, 12], "gemini-3-pro-image": [2, 120], "gemini-3.1-flash-image": [0.5, 60], "gemini-2.5-flash-image": [0.3, 30] };

function logUsage(model, usage, what) {
  try {
    const [pi, po] = PRICE[model] ?? [1, 10];
    const inp = usage?.promptTokenCount ?? 0;
    const outp = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
    const usd = (inp * pi + outp * po) / 1e6;
    fs.mkdirSync("out", { recursive: true });
    fs.appendFileSync(path.join("out", "vertex-usage.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), project: "siraj-chiragh", model, what, inp, outp, usd: Math.round(usd * 10000) / 10000 })}\n`);
  } catch {
    /* the log never stops a render */
  }
}

/** generateContent on a Gemini model (location global), with retries on 403/429/5xx. */
export async function gemini(model, body, { what = "", tries = 8, location = null } = {}) {
  if (!vertexReady()) throw new Error("vertex: the proxy is not configured");
  const base = env.GOOGLE_VERTEX_PROXY_URL.replace(/\/+$/, "");
  // most models answer on «global»; 2.5 Flash Image only in a region (memory: reference_vertex_proxy)
  const loc = location ?? (model === "gemini-2.5-flash-image" ? "us-central1" : "global");
  const url = `${base}/v1/projects/${env.GOOGLE_VERTEX_PROJECT}/locations/${loc}/publishers/google/models/${model}:generateContent`;
  let wait = 2000;
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-proxy-key": env.GOOGLE_VERTEX_PROXY_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) });
    } catch (error) {
      if (attempt >= tries) throw new Error(`vertex ${model}: ${error.message}`);
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(30_000, wait * 1.8);
      continue;
    }
    if (res.ok) {
      const j = await res.json();
      logUsage(model, j.usageMetadata, what);
      return j;
    }
    const retry = [403, 408, 429, 500, 502, 503, 504].includes(res.status);
    if (!retry || attempt >= tries) throw new Error(`vertex ${model}: HTTP ${res.status}`);
    console.log(`vertex ${model}: HTTP ${res.status}, again in ${Math.round(wait / 1000)} s (${attempt}/${tries})`);
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(30_000, wait * 1.8);
  }
}

/** The text of a Gemini answer. */
export const textOf = (j) => (j?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");

/** The first JSON object in a model's answer. */
export function jsonIn(s) {
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON in the answer");
  return JSON.parse(s.slice(a, b + 1));
}
