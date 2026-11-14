// Where text may stand in a Reel of the lamp style, and the small pure helpers the gate shares
// with the page (no imports: scripts/gate.mjs reads this file too).
//
// The zones were measured on the owner's phone screenshots of 2026-11-13 (the same numbers as
// Bidar's and Divan's set style): a 1080×1920 Reel shown on a 1320×2868 screen, cropped at the
// sides. The app draws its header over the top 11 %, its buttons over the right 14 % and the
// account name and caption under y 2158 of the screen.

export const W = 1080;
export const H = 1920;
export const FPS = 30;
const SCREEN = { w: 1320, h: 2868 };
const K = 2617 / H;
const CUT = (W * K - SCREEN.w) / 2;

/** Every text inside: x left–right, y top–bottom (pixels of the 1080×1920 frame). */
export const ZONES = {
  top: Math.ceil((0.11 * SCREEN.h) / K),
  right: Math.floor((0.86 * SCREEN.w + CUT) / K),
  left: Math.ceil(CUT / K),
  bottom: Math.floor(2158 / K),
};
/** The middle third of the height, where the channel badge never goes. */
export const MIDDLE = { top: Math.round(H / 3), bottom: Math.round((2 * H) / 3) };
/** The column the lamp style writes in: the zones with a margin; its middle is not the frame's. */
export const COL = { left: ZONES.left + 24, right: ZONES.right - 24 };
export const COL_W = COL.right - COL.left;
export const COL_X = (COL.left + COL.right) / 2;
/** The smallest letters any text may have on screen: 1.5 % of the frame's height (STYLE_GUIDE R5). */
export const MIN_TEXT = Math.ceil(0.015 * H);

export type Box = { x: number; y: number; w: number; h: number };
export const inZones = (b: Box, slack = 0.5) => b.x >= ZONES.left - slack && b.y >= ZONES.top - slack && b.x + b.w <= ZONES.right + slack && b.y + b.h <= ZONES.bottom + slack;

/** A «·» or «|» with Persian beside it (spaces between allowed): the owner's rule forbids it. */
export const dotBeside = (s: string) => /[؀-ۿ]\s*[·|]|[·|]\s*[؀-ۿ]/.test(s);

/** Words as a reader counts them (punctuation and quote marks are not words). */
export const wordsOf = (s: string) =>
  String(s)
    .replace(/[؟?!.،,؛;:«»"()\[\]…—–]/g, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w));

/**
 * A quoted text reduced to what must be identical on screen and in the source: every letter and
 * mark in order, without spaces and without digits (the seal at an ayah's end carries its number).
 */
export const plainQuote = (s: string) => String(s).normalize("NFC").replace(/[\s0-9۰-۹٠-٩]/gu, "");

/** FNV-1a over the code points: the page and the gate compare quotes without logging any text. */
export function quoteHash(s: string) {
  let h = 0x811c9dc5;
  for (const ch of plainQuote(s)) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** The frames the page measures: every third in the first 1.5 s, then every fifth, and the last. */
export const probeFrame = (f: number, total: number) => (f <= 45 ? f % 3 === 0 : f % 5 === 0) || f === total - 1;

/** The hook's words that stand from the first frame: its head, else its first clause of 7 words or fewer. */
export function hookHead(show: string, head?: string): string | null {
  if (head && wordsOf(head).length <= 7) return head;
  if (wordsOf(show).length <= 7) return show;
  let best: string | null = null;
  const re = /[،,؛;:.?؟!—]/g;
  for (let m = re.exec(show); m; m = re.exec(show)) {
    // a mark inside a number (6,666 · 2.5) is not the end of a clause
    if (/[\d۰-۹]/.test(show[m.index - 1] ?? "") && /[\d۰-۹]/.test(show[m.index + 1] ?? "")) continue;
    const part = show.slice(0, m.index + (/[?؟!]/.test(m[0]) ? 1 : 0)).trim();
    if (wordsOf(part).length >= 2 && wordsOf(part).length <= 7) best = part;
    if (wordsOf(part).length > 7) break;
  }
  return best;
}
