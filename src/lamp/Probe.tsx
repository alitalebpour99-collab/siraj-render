// The page measures itself for the gate (scripts/gate.mjs): on the frames of `probeFrame`, once
// every Fit has its size, every visible text is found in the DOM and its box, its letters' real
// height on screen (font size times every scale above it), its opacity, its word count, whether
// a «·» or «|» stands beside Persian, and, for a quote, a hash of its letters are written to the
// browser's console as one line «SIRAJ_PROBE {…}». render.mjs collects these lines (onBrowserLog)
// and never prints them; no text leaves the page, only numbers and hashes.
import React, { useEffect, useState } from "react";
import { continueRender, delayRender, getRemotionEnvironment, useCurrentFrame } from "remotion";
import { fontsReady } from "../fonts";
import { dotBeside, probeFrame, quoteHash, wordsOf } from "./zones";

type Row = { b: number; r: string; q: string | null; x: number; y: number; w: number; h: number; s: number; o: number; n: number; d: boolean; hq: string | null };

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
  const blocks = new Map<Element, { rect: DOMRect | null; text: string; s: number; o: number; r: string; q: string | null }>();
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
    const cur = blocks.get(block) ?? { rect: null, text: "", s: Infinity, o: 0, r: "text", q: null };
    // the role and the quote key of the text itself (a marked span inside a plain block counts)
    const role = el.closest("[data-role]")?.getAttribute("data-role") ?? "text";
    const key = el.closest("[data-q]")?.getAttribute("data-q") ?? null;
    const u = cur.rect ? new DOMRect(Math.min(cur.rect.x, r.x), Math.min(cur.rect.y, r.y), Math.max(cur.rect.right, r.right) - Math.min(cur.rect.x, r.x), Math.max(cur.rect.bottom, r.bottom) - Math.min(cur.rect.y, r.y)) : r;
    blocks.set(block, { rect: u, text: `${cur.text} ${text}`, s: Math.min(cur.s, size), o: Math.max(cur.o, o), r: cur.r !== "text" ? cur.r : role, q: cur.q ?? key });
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
      o: Math.round(v.o * 100) / 100,
      n: wordsOf(v.text).length,
      d: dotBeside(v.text),
      hq: null,
    });
  }
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
