// The page measures itself for the gate (scripts/gate.mjs): on the frames of `probeFrame`, once
// every Fit has its size, every visible text is found in the DOM and its box, its letters' real
// height on screen (font size times every scale above it), its opacity, its word count, whether
// a «·» or «|» stands beside Persian, and, for a quote, a hash of its letters are written to the
// browser's console as one line «SIRAJ_PROBE {…}». render.mjs collects these lines (onBrowserLog)
// and never prints them; no text leaves the page, only numbers and hashes.
import React, { useEffect, useState } from "react";
import { continueRender, delayRender, getRemotionEnvironment, useCurrentFrame } from "remotion";
import { fontsReady } from "../fonts";
import { GROUND, contrast, dotBeside, over, probeFrame, quoteHash, wordsOf } from "./zones";

type Row = { b: number; r: string; q: string | null; x: number; y: number; w: number; h: number; s: number; S: number; o: number; n: number; d: boolean; hq: string | null; c: number | null; ar: boolean };

/** «rgb(1, 2, 3)» or «rgba(1, 2, 3, 0.5)» as [r, g, b, a]; null for anything else. */
function rgba(css: string): [number, number, number, number] | null {
  const m = /rgba?\(([^)]+)\)/.exec(css);
  if (!m) return null;
  const v = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  return v.length >= 3 && v.slice(0, 3).every(Number.isFinite) ? [v[0]!, v[1]!, v[2]!, Number.isFinite(v[3]) ? v[3]! : 1] : null;
}

/** The golden glows of the ground (src/lamp/kit.tsx marks them): centre, reach and how strong they are now. */
function glows() {
  const out: { x: number; y: number; R: number; stops: [number, number][]; rgb: number[] }[] = [];
  document.querySelectorAll("[data-glow]").forEach((g) => {
    const o = seen(g).o;
    if (o < 0.01) return;
    const r = g.getBoundingClientRect();
    const stops = (g.getAttribute("data-glow") ?? "").split(",").map((x) => x.split(":").map(Number) as [number, number]).map(([d, a]) => [d, a * o] as [number, number]);
    // radial-gradient(circle, …) on a square reaches its farthest corner
    out.push({ x: r.x + r.width / 2, y: r.y + r.height / 2, R: (r.width / 2) * Math.SQRT2, stops, rgb: [242, 196, 96] });
  });
  return out;
}
function glowAlpha(stops: [number, number][], d: number) {
  if (!stops.length) return 0;
  if (d <= stops[0]![0]) return stops[0]![1];
  for (let i = 1; i < stops.length; i++) {
    const [d0, a0] = stops[i - 1]!;
    const [d1, a1] = stops[i]!;
    if (d <= d1) return a0 + ((a1 - a0) * (d - d0)) / Math.max(1e-6, d1 - d0);
  }
  return stops[stops.length - 1]![1];
}

/** What is behind a point of a text: the ground's darkest cream, the glow there, and every filled box above it. */
function behind(el: Element, cx: number, cy: number, light: ReturnType<typeof glows>) {
  let bg: number[] = [...GROUND];
  for (const g of light) bg = over(g.rgb, glowAlpha(g.stops, Math.hypot(cx - g.x, cy - g.y) / g.R), bg);
  const chain: Element[] = [];
  for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) chain.unshift(e);
  for (const e of chain) {
    const c = rgba(getComputedStyle(e).backgroundColor);
    if (c && c[3] > 0) bg = over(c, c[3] * seen(e).o, bg);
  }
  return bg;
}

const ids = new WeakMap<Element, number>();
let next = 1;
const idOf = (el: Element) => {
  if (!ids.has(el)) ids.set(el, next++);
  return ids.get(el)!;
};

/** The block a text belongs to: a marked block, or the nearest ancestor that is not inline. */
function blockOf(el: Element): Element {
  const marked = el.closest("[data-b]");
  if (marked) return marked;
  let e: Element | null = el;
  while (e && e !== document.body) {
    const d = getComputedStyle(e).display;
    if (!d.startsWith("inline") && d !== "contents") return e;
    e = e.parentElement;
  }
  return el;
}

function seen(el: Element): { o: number; k: number } {
  let o = 1;
  let k = 1;
  for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none") return { o: 0, k };
    o *= Number(cs.opacity);
    if (cs.transform && cs.transform !== "none") {
      const m = new DOMMatrixReadOnly(cs.transform);
      k *= Math.hypot(m.a, m.b);
    }
  }
  return { o, k };
}

function measure(frame: number) {
  const light = glows();
  const blocks = new Map<Element, { rect: DOMRect | null; text: string; s: number; S: number; o: number; r: string; q: string | null; c: number | null; ar: boolean }>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    if (!text.trim()) continue;
    const el = node.parentElement;
    if (!el || el.closest("[data-probe-skip]")) continue;
    const { o, k } = seen(el);
    if (o < 0.05) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const size = parseFloat(getComputedStyle(el).fontSize) * k;
    const block = blockOf(el);
    const cur = blocks.get(block) ?? { rect: null, text: "", s: Infinity, S: 0, o: 0, r: "text", q: null, c: null, ar: false };
    // the letters' contrast as drawn: their colour at their own opacity over what is behind them
    const col = rgba(getComputedStyle(el).color);
    let c: number | null = null;
    if (col) {
      const bg = behind(el, r.x + r.width / 2, r.y + r.height / 2, light);
      c = contrast(over(col, col[3] * o, bg), bg);
    }
    const ar = Boolean(el.closest('[lang="ar"]'));
    // the role and the quote key of the text itself (a marked span inside a plain block counts)
    const role = el.closest("[data-role]")?.getAttribute("data-role") ?? "text";
    const key = el.closest("[data-q]")?.getAttribute("data-q") ?? null;
    const u = cur.rect ? new DOMRect(Math.min(cur.rect.x, r.x), Math.min(cur.rect.y, r.y), Math.max(cur.rect.right, r.right) - Math.min(cur.rect.x, r.x), Math.max(cur.rect.bottom, r.bottom) - Math.min(cur.rect.y, r.y)) : r;
    blocks.set(block, { rect: u, text: `${cur.text} ${text}`, s: Math.min(cur.s, size), S: Math.max(cur.S, size), o: Math.max(cur.o, o), r: cur.r !== "text" ? cur.r : role, q: cur.q ?? key, c: c === null ? cur.c : cur.c === null ? c : Math.min(cur.c, c), ar: cur.ar || ar });
  }
  const rows: Row[] = [];
  for (const [block, v] of blocks) {
    if (!v.rect) continue;
    const r = v.r;
    const q = v.q;
    rows.push({
      b: idOf(block),
      r,
      q,
      x: Math.round(v.rect.x),
      y: Math.round(v.rect.y),
      w: Math.round(v.rect.width),
      h: Math.round(v.rect.height),
      s: Math.round(v.s * 10) / 10,
      S: Math.round(v.S * 10) / 10,
      o: Math.round(v.o * 100) / 100,
      n: wordsOf(v.text).length,
      d: dotBeside(v.text),
      hq: null,
      c: v.c === null ? null : Math.round(v.c * 10) / 10,
      ar: v.ar,
    });
  }
  // what fills the picture without being text (the lamp): its box only, for the gate's fill-y
  document.querySelectorAll("[data-fill]").forEach((el) => {
    const o = seen(el).o;
    if (o < 0.05) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    rows.push({ b: idOf(el), r: "fill", q: null, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), s: 0, S: 0, o: Math.round(o * 100) / 100, n: 0, d: false, hq: null, c: null, ar: false });
  });
  // a quote is hashed whole: all its blocks (a basmala and the rest of the ayah) in page order
  const quotes = new Map<string, string>();
  document.querySelectorAll("[data-q]").forEach((el) => {
    const k = el.getAttribute("data-q")!;
    if (seen(el).o < 0.05) return;
    quotes.set(k, `${quotes.get(k) ?? ""}${el.textContent ?? ""}`);
  });
  for (const row of rows) if (row.q && quotes.has(row.q)) row.hq = quoteHash(quotes.get(row.q)!);
  console.log(`SIRAJ_PROBE ${JSON.stringify({ f: frame, rows })}`);
}

const ProbeAt: React.FC<{ frame: number }> = ({ frame }) => {
  const [handle] = useState(() => delayRender(`probe ${frame}`, { timeoutInMilliseconds: 30000 }));
  useEffect(() => {
    let tries = 0;
    const go = () => {
      // every Fit has found its size (a Fit still measuring is hidden and marked)
      if (document.querySelector("[data-fitting]") && tries++ < 60) {
        setTimeout(go, 16);
        return;
      }
      try {
        measure(frame);
      } finally {
        continueRender(handle);
      }
    };
    void fontsReady().then(() => setTimeout(go, 0));
  }, [frame, handle]);
  return null;
};

/** Put once in a composition of the lamp style; it measures only while rendering. */
export const Probe: React.FC<{ total: number }> = ({ total }) => {
  const f = useCurrentFrame();
  if (!getRemotionEnvironment().isRendering || !probeFrame(f, total)) return null;
  return <ProbeAt key={f} frame={f} />;
};
