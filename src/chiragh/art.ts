// The emerald line-art library of «چراغ» (style bible v2 §1, §6): every anchor is drawn by
// code, line by line, as an architect's drawing: one stroke weight, exact geometry, no figure
// (no person, no face, no rider, no animal), no hexagram (only 8-fold stars), no calligraphy.
// Each anchor is a set of named groups (drawn one after the other, each locked to a word by the
// storyboard) and named regions (where the camera can go). Coordinates are the stage's own:
// 1080 × 600, the stage sits at y 404–1004 of the frame; the text column's centre is x 472.
// This file imports nothing so that the scripts (node) can list the library for the concept writer.

/** `cue`: the words (Arabic, English, Persian; a regex source, case-free) of the verse on which this stage draws: the drawing says what that verse says */
export type ArtGroup = { id: string; paths: string[]; weight?: number; gold?: boolean; fill?: boolean; cue?: string };
export type Region = { id: string; x: number; y: number; w: number; h: number };
export type ArtDef = {
  id: string;
  /** what the anchor can mean (for the concept writer; never shown) */
  tags: string[];
  /** no person, face, rider or animal is drawn: checked by the tests and by the QA gate */
  figures: false;
  groups: ArtGroup[];
  regions: Region[];
};

export const STAGE = { w: 1080, h: 600 } as const;

/** Arabic and Persian text without its marks (harakat, tatweel), one alef and one yeh: for matching a cue to a verse. */
export const bare = (s: string) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/[ىی]/g, "ي")
    .replace(/ک/g, "ك");
/** Does the cue (a regex source over bare text, case-free) name something in this text? */
export const cueIn = (cue: string, text: string) => new RegExp(bare(cue), "iu").test(bare(text));
const CX = 472;
const r1 = (n: number) => Math.round(n * 10) / 10;
type Pt = [number, number];

const poly = (pts: Pt[], close = false) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L")}${close ? "Z" : ""}`;
const line = (a: Pt, b: Pt) => poly([a, b]);
const circle = (x: number, y: number, r: number) => `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`;
const arc = (x: number, y: number, r: number, a0: number, a1: number, n = 48): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]);
  }
  return pts;
};

/** An n-pointed star (8 by default: the khatam; never 6). */
export function star(x: number, y: number, r: number, inner = 0.42, n = 8, rot = -Math.PI / 2): string {
  if (n === 6) throw new Error("no hexagram in Siraj's art");
  const pts: Pt[] = [];
  for (let i = 0; i < 2 * n; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = rot + (Math.PI * i) / n;
    pts.push([x + rr * Math.cos(a), y + rr * Math.sin(a)]);
  }
  return poly(pts, true);
}
const octagon = (x: number, y: number, r: number) => poly(Array.from({ length: 8 }, (_, i): Pt => [x + r * Math.cos(Math.PI / 8 + (i * Math.PI) / 4), y + r * Math.sin(Math.PI / 8 + (i * Math.PI) / 4)]), true);

/**
 * A two-centred pointed arch (the Persian arch) from its spring line `ys`, its span `w` and its
 * rise `h` (h > w/2): the points of the left and the right curve, apex shared.
 */
export function archPts(cx: number, ys: number, w: number, h: number, n = 40): Pt[] {
  const d = Math.max(0, (h * h - (w * w) / 4) / w);
  const r = w / 2 + d;
  const top = Math.acos(-d / r);
  const left = arc(cx + d, ys, r, Math.PI, Math.PI + (Math.PI - top), n);
  // the right curve starts AT the apex (its centre is cx - d: the apex is at angle -(π - top)); -top drew a stray chord across the crown (v3 frames, 28 Nov)
  const right = arc(cx - d, ys, r, -(Math.PI - top), 0, n);
  return [...left, ...right.slice(1)];
}
const arch = (cx: number, ys: number, w: number, h: number) => poly(archPts(cx, ys, w, h));
/** Points evenly along a polyline (for ornaments set along an arch). */
function along(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  let carry = step / 2;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    let t = carry;
    while (t <= len) {
      out.push([ax + ((bx - ax) * t) / len, ay + ((by - ay) * t) / len]);
      t += step;
    }
    carry = t - len;
  }
  return out;
}
/** An olive or palm leaf: two curves from the stem point along `angle`. */
function leaf(x: number, y: number, len: number, angle: number, width = 0.28): string {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const tx = x + len * c;
  const ty = y + len * s;
  const mx = x + (len / 2) * c;
  const my = y + (len / 2) * s;
  const nx = -s * len * width;
  const ny = c * len * width;
  return `M${r1(x)} ${r1(y)}Q${r1(mx + nx)} ${r1(my + ny)} ${r1(tx)} ${r1(ty)}Q${r1(mx - nx)} ${r1(my - ny)} ${r1(x)} ${r1(y)}`;
}
const hangingLamp = (x: number, top: number, bottom: number): ArtGroup[] => [
  { id: "chain", paths: [line([x, top], [x, bottom - 46]), circle(x, bottom - 52, 5), line([x, bottom - 46], [x - 26, bottom - 12]), line([x, bottom - 46], [x + 26, bottom - 12])] },
  {
    id: "lamp",
    paths: [
      `M${x - 42} ${bottom - 12}Q${x} ${bottom + 34} ${x + 42} ${bottom - 12}Z`,
      line([x - 50, bottom - 12], [x + 50, bottom - 12]),
      `M${x - 16} ${bottom + 14}L${x - 22} ${bottom + 28}L${x + 22} ${bottom + 28}L${x + 16} ${bottom + 14}`,
    ],
  },
  { id: "flame", gold: true, fill: true, weight: 0, paths: [`M${x} ${bottom - 14}C${x - 9} ${bottom - 24} ${x - 6} ${bottom - 40} ${x} ${bottom - 52}C${x + 6} ${bottom - 40} ${x + 9} ${bottom - 24} ${x} ${bottom - 14}Z`] },
];

/* ---------------- the anchors ---------------- */

/** Points at distance `d` inward (towards the arch's centre line) of an arch's points. */
function offsetArch(cx: number, ys: number, w: number, h: number, inset: number): Pt[] {
  return archPts(cx, ys, w - 2 * inset, h - inset);
}

/** A hanging mosque lamp: three chains to a cap, a round glass body, a foot; its flame apart. */
function mosqueLamp(x: number, top: number, y: number, s = 1): ArtGroup[] {
  const k = (n: number) => n * s;
  const links = Array.from({ length: 5 }, (_, i) => circle(x, top + 18 + i * ((y - k(70) - top - 18) / 5), 4));
  return [
    { id: "chain", paths: [line([x, top], [x, y - k(70)]), ...links, line([x, y - k(70)], [x - k(40), y - k(28)]), line([x, y - k(70)], [x + k(40), y - k(28)])] },
    {
      id: "lamp",
      gold: true,
      paths: [
        `M${x - k(46)} ${y - k(28)}L${x + k(46)} ${y - k(28)}`,
        `M${x - k(40)} ${y - k(28)}C${x - k(64)} ${y + k(6)} ${x - k(40)} ${y + k(44)} ${x - k(14)} ${y + k(52)}L${x + k(14)} ${y + k(52)}C${x + k(40)} ${y + k(44)} ${x + k(64)} ${y + k(6)} ${x + k(40)} ${y - k(28)}`,
        `M${x - k(50)} ${y + k(4)}Q${x} ${y + k(18)} ${x + k(50)} ${y + k(4)}`,
        `M${x - k(14)} ${y + k(52)}L${x - k(20)} ${y + k(70)}L${x + k(20)} ${y + k(70)}L${x + k(14)} ${y + k(52)}`,
        line([x, y + k(70)], [x, y + k(86)]),
        star(x, y + k(96), k(9)),
      ],
    },
    { id: "flame", gold: true, fill: true, weight: 0, paths: [`M${x} ${y + k(20)}C${x - k(10)} ${y + k(8)} ${x - k(7)} ${y - k(10)} ${x} ${y - k(24)}C${x + k(7)} ${y - k(10)} ${x + k(10)} ${y + k(8)} ${x} ${y + k(20)}Z`] },
  ];
}

function mihrab(): ArtDef {
  const base = 574;
  const ys = 318;
  const W1 = 420;
  const H1 = 258;
  const band = 36;
  // the band: an interlaced lattice between its two edges (every point of the outer edge tied to the next of the inner, and back), an 8-pointed star at every fourth knot
  const N = 26;
  const o = archPts(CX, ys, W1, H1, N);
  const n = archPts(CX, ys, W1 - 2 * band, H1 - band, N);
  const m = archPts(CX, ys, W1 - band, H1 - band / 2, N);
  const lattice: string[] = [];
  for (let i = 0; i + 1 < o.length; i++) {
    lattice.push(line(o[i]!, n[i + 1]!));
    lattice.push(line(n[i]!, o[i + 1]!));
  }
  const stars = m.filter((_, i) => i % 4 === 2).map(([x, y]) => star(x, y, band / 2 - 6, 0.45));
  const top = ys - H1 - 18;
  const frame = [poly([[CX - W1 / 2 - 34, base], [CX - W1 / 2 - 34, top], [CX + W1 / 2 + 34, top], [CX + W1 / 2 + 34, base]]), poly([[CX - W1 / 2 - 22, base], [CX - W1 / 2 - 22, top + 12], [CX + W1 / 2 + 22, top + 12], [CX + W1 / 2 + 22, base]])];
  // the frieze above the frame: a row of small 8-pointed stars between two lines
  const frieze = [line([CX - W1 / 2 - 34, top - 28], [CX + W1 / 2 + 34, top - 28]), ...Array.from({ length: 15 }, (_, k) => star(CX - W1 / 2 - 20 + k * ((W1 + 40) / 14), top - 14, 9, 0.45))];
  // the spandrels: in each upper corner an 8-pointed star in its octagon, ringed by four small stars
  const spandrel = (x: number, y: number) => [octagon(x, y, 30), star(x, y, 26, 0.45), star(x, y, 13, 0.45, 8, -Math.PI / 2 + Math.PI / 8), ...[0, 1, 2, 3].map((k) => star(x + 44 * Math.cos((k * Math.PI) / 2 + Math.PI / 4), y + 44 * Math.sin((k * Math.PI) / 2 + Math.PI / 4), 7, 0.45))];
  const spandrels = [...spandrel(CX - W1 / 2 + 6, top + 52), ...spandrel(CX + W1 / 2 - 6, top + 52)];
  const outer = o;
  const innerBand = n;
  const inner = archPts(CX, ys, W1 - 2 * band - 24, H1 - band - 20);
  const niche = archPts(CX, ys + 40, 236, 176);
  const flutes = [-96, -64, -32, 0, 32, 64, 96].map((dx) => line([CX + dx, base], [CX + dx, ys + 40 + 10 - Math.abs(dx) * 0.05]));
  return {
    id: "mihrab",
    tags: ["prayer", "night", "lamp", "light", "turning to God", "stillness", "worship", "remembrance"],
    figures: false,
    groups: [
      { id: "ground", paths: [line([96, base], [848, base]), line([130, base + 10], [814, base + 10])] },
      { id: "frame", paths: frame },
      { id: "frieze", paths: frieze },
      { id: "piers", paths: [line([CX - W1 / 2, base], [CX - W1 / 2, ys]), line([CX + W1 / 2, base], [CX + W1 / 2, ys]), line([CX - W1 / 2 + band, base], [CX - W1 / 2 + band, ys]), line([CX + W1 / 2 - band, base], [CX + W1 / 2 - band, ys])] },
      { id: "outer-arch", paths: [poly(outer), poly(innerBand)] },
      ...mosqueLamp(CX, ys - 150, 330, 1),
      { id: "band", paths: lattice },
      { id: "band-stars", paths: stars },
      { id: "spandrels", paths: spandrels },
      { id: "inner-arch", paths: [poly(inner), line([CX - (W1 - 2 * band - 24) / 2, base], [CX - (W1 - 2 * band - 24) / 2, ys]), line([CX + (W1 - 2 * band - 24) / 2, base], [CX + (W1 - 2 * band - 24) / 2, ys])] },
      { id: "niche", paths: [poly(niche), line([CX - 118, base], [CX - 118, ys + 40]), line([CX + 118, base], [CX + 118, ys + 40])] },
      { id: "flutes", paths: flutes },
    ],
    regions: [
      { id: "whole", x: 160, y: 0, w: 624, h: 600 },
      { id: "apex", x: 302, y: 0, w: 340, h: 250 },
      { id: "lamp", x: 342, y: 180, w: 260, h: 260 },
      { id: "band", x: 180, y: 30, w: 320, h: 320 },
      { id: "base", x: 232, y: 360, w: 480, h: 240 },
    ],
  };
}
function mishkat(): ArtDef {
  const ys = 300;
  const niche = archPts(CX, ys, 300, 200);
  const shelf = 470;
  const olive: string[] = [];
  const stem: Pt[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    stem.push([120 + 700 * t, 560 - 46 * Math.sin(Math.PI * t)]);
  }
  olive.push(poly(stem));
  const leaves: string[] = [];
  stem.forEach(([x, y], i) => {
    if (i % 2 === 1 && i < 30) leaves.push(leaf(x, y, 46, (i % 4 === 1 ? -1 : 1) * 0.9 - Math.PI / 2 + 0.25, 0.25));
  });
  const fruit = stem.filter((_, i) => i % 6 === 3).map(([x, y]) => circle(x + 6, y + 14, 8));
  return {
    id: "mishkat",
    tags: ["light", "niche", "lamp", "glass", "star", "olive", "blessing", "guidance", "an-nur"],
    figures: false,
    groups: [
      { id: "frame", paths: [line([CX - 190, shelf + 30], [CX - 190, ys]), line([CX + 190, shelf + 30], [CX + 190, ys]), poly(archPts(CX, ys, 380, 250))] },
      { id: "niche", paths: [poly(niche), line([CX - 150, shelf], [CX - 150, ys]), line([CX + 150, shelf], [CX + 150, ys])] },
      // the wall around the niche: a lattice of 8-pointed stars (girih), only outside the niche
      {
        id: "tiles",
        paths: Array.from({ length: 9 * 12 }, (_, k): Pt => [CX - 176 + (k % 9) * 44, 70 + Math.floor(k / 9) * 44])
          .filter(([x, y]) => Math.abs(x - CX) > 160 || y < ys - 210)
          .filter(([x, y]) => Math.abs(x - CX) < 182 && y < shelf + 20)
          .map(([x, y]) => star(x, y, 11, 0.45)),
      },
      { id: "shelf", paths: [line([CX - 170, shelf], [CX + 170, shelf]), line([CX - 160, shelf + 12], [CX + 160, shelf + 12])] },
      { id: "glass", paths: [circle(CX, shelf - 92, 62), `M${CX - 30} ${shelf - 36}L${CX - 40} ${shelf}L${CX + 40} ${shelf}L${CX + 30} ${shelf - 36}`, `M${CX - 36} ${shelf - 140}Q${CX - 52} ${shelf - 110} ${CX - 44} ${shelf - 80}`] },
      { id: "flame", gold: true, fill: true, weight: 0, paths: [`M${CX} ${shelf - 64}C${CX - 12} ${shelf - 80} ${CX - 8} ${shelf - 104} ${CX} ${shelf - 124}C${CX + 8} ${shelf - 104} ${CX + 12} ${shelf - 80} ${CX} ${shelf - 64}Z`] },
      { id: "star", paths: [star(CX, 64, 30, 0.5), star(CX, 64, 18, 0.5, 8, -Math.PI / 2 + Math.PI / 8)] },
      { id: "branch", paths: olive },
      { id: "leaves", paths: [...leaves, ...fruit] },
    ],
    regions: [
      { id: "whole", x: 100, y: 0, w: 744, h: 600 },
      { id: "glass", x: 352, y: 230, w: 240, h: 260 },
      { id: "star", x: 382, y: 10, w: 180, h: 140 },
      { id: "olive", x: 110, y: 420, w: 420, h: 180 },
    ],
  };
}

function rosette(): ArtDef {
  const cy = 300;
  const rings: string[][] = [[star(CX, cy, 70, 0.42)], [octagon(CX, cy, 108), star(CX, cy, 108, 0.66, 8, -Math.PI / 2 + Math.PI / 8)], [], [circle(CX, cy, 196), circle(CX, cy, 206)], []];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const p = (r: number, da = 0): Pt => [CX + r * Math.cos(a + da), cy + r * Math.sin(a + da)];
    rings[2]!.push(poly([p(108, -0.2), p(150, -0.12), p(186), p(150, 0.12), p(108, 0.2)]));
    rings[4]!.push(star(...p(250), 22, 0.42));
  }
  return {
    id: "rosette",
    tags: ["oneness", "order", "unity", "creation", "measure", "count"],
    figures: false,
    groups: rings.map((paths, i) => ({ id: `ring${i + 1}`, paths })),
    regions: [
      { id: "whole", x: 152, y: 20, w: 640, h: 560 },
      { id: "heart", x: 352, y: 180, w: 240, h: 240 },
      { id: "edge", x: 560, y: 120, w: 280, h: 280 },
    ],
  };
}

function mushaf(): ArtDef {
  const top = 150;
  const page = (dir: -1 | 1): string => `M${CX} ${top + 30}Q${CX + dir * 150} ${top - 10} ${CX + dir * 300} ${top + 20}L${CX + dir * 300} ${top + 300}Q${CX + dir * 150} ${top + 270} ${CX} ${top + 320}Z`;
  const rows = (dir: -1 | 1) =>
    Array.from({ length: 9 }, (_, k) => {
      const y = top + 60 + k * 26;
      return `M${CX + dir * 40} ${y + 6}Q${CX + dir * 150} ${y - 8} ${CX + dir * (k === 8 ? 180 : 262)} ${y + 4}`;
    });
  return {
    id: "mushaf",
    tags: ["book", "reading", "recitation", "text", "count", "pages", "word"],
    figures: false,
    groups: [
      { id: "stand", paths: [line([CX - 260, 580], [CX + 200, top + 330]), line([CX + 260, 580], [CX - 200, top + 330]), line([CX - 290, 580], [CX - 220, 580]), line([CX + 220, 580], [CX + 290, 580])] },
      { id: "pages", paths: [page(-1), page(1), line([CX, top + 30], [CX, top + 320])] },
      { id: "right-lines", paths: rows(1) },
      { id: "left-lines", paths: rows(-1) },
      { id: "ornament", paths: [star(CX + 150, top + 36, 14), star(CX - 150, top + 36, 14), circle(CX, top + 14, 9)] },
    ],
    regions: [
      { id: "whole", x: 120, y: 60, w: 704, h: 540 },
      { id: "right", x: 472, y: 120, w: 330, h: 330 },
      { id: "left", x: 142, y: 120, w: 330, h: 330 },
    ],
  };
}

function gate(): ArtDef {
  const base = 572;
  const domeTop = 70;
  const dome = `M${CX - 150} 260C${CX - 160} 160 ${CX - 60} ${domeTop + 30} ${CX} ${domeTop}C${CX + 60} ${domeTop + 30} ${CX + 160} 160 ${CX + 150} 260`;
  const minaret = (x: number): string[] => [line([x - 18, base], [x - 18, 150]), line([x + 18, base], [x + 18, 150]), poly([[x - 28, 210], [x + 28, 210]]), poly([[x - 28, 222], [x + 28, 222]]), `M${x - 18} 150Q${x} 96 ${x + 18} 150`, line([x, 108], [x, 84])];
  return {
    id: "gate",
    tags: ["community", "city", "medina", "mosque", "gathering", "home"],
    figures: false,
    groups: [
      { id: "ground", paths: [line([90, base], [854, base])] },
      { id: "walls", paths: [poly([[CX - 220, base], [CX - 220, 290], [CX + 220, 290], [CX + 220, base]]), line([CX - 220, 312], [CX + 220, 312])] },
      { id: "arcade", paths: [-1, 0, 1].map((k) => arch(CX + k * 140, 430, 96, 70)).concat([-1, 0, 1].flatMap((k) => [line([CX + k * 140 - 48, base], [CX + k * 140 - 48, 430]), line([CX + k * 140 + 48, base], [CX + k * 140 + 48, 430])])) },
      { id: "drum", paths: [poly([[CX - 160, 290], [CX - 160, 260], [CX + 160, 260], [CX + 160, 290]])] },
      { id: "dome", paths: [dome, line([CX, domeTop], [CX, domeTop - 34]), star(CX, domeTop - 44, 10)] },
      { id: "minarets", paths: [...minaret(CX - 300), ...minaret(CX + 300)] },
    ],
    regions: [
      { id: "whole", x: 100, y: 0, w: 744, h: 600 },
      { id: "dome", x: 292, y: 0, w: 360, h: 320 },
      { id: "arcade", x: 232, y: 300, w: 480, h: 300 },
      { id: "minaret", x: 692, y: 40, w: 200, h: 540 },
    ],
  };
}

function nightSky(): ArtDef {
  const ground = 520;
  // the land: two long hills and the line of the ground
  const hills = [`M40 ${ground}Q220 ${ground - 70} 400 ${ground - 18}T760 ${ground - 30}T1040 ${ground}`, line([40, ground + 26], [1040, ground + 26])];
  // a small mosque on the horizon, in lines only: drum, dome, finial, two minarets, three doors
  const mx = CX + 10;
  const mosque = [
    poly([[mx - 120, ground + 26], [mx - 120, ground - 70], [mx + 120, ground - 70], [mx + 120, ground + 26]]),
    `M${mx - 80} ${ground - 70}C${mx - 86} ${ground - 140} ${mx - 30} ${ground - 176} ${mx} ${ground - 186}C${mx + 30} ${ground - 176} ${mx + 86} ${ground - 140} ${mx + 80} ${ground - 70}`,
    line([mx, ground - 186], [mx, ground - 210]),
    star(mx, ground - 220, 8),
    ...[-1, 1].flatMap((k) => [line([mx + k * 160, ground + 26], [mx + k * 160, ground - 170]), line([mx + k * 180, ground + 26], [mx + k * 180, ground - 170]), `M${mx + k * 160} ${ground - 170}Q${mx + k * 170} ${ground - 214} ${mx + k * 180} ${ground - 170}`, line([mx + k * 152, ground - 120], [mx + k * 188, ground - 120])]),
    ...[-60, 0, 60].map((dx) => poly(archPts(mx + dx, ground - 10, 34, 30, 10))),
  ];
  // the crescent with an inner rim
  const moon = [`M${CX + 230} 40A96 96 0 1 0 ${CX + 230} 232A76 76 0 1 1 ${CX + 230} 40Z`, `M${CX + 222} 60A80 80 0 1 0 ${CX + 222} 212`];
  // the stars: 8-pointed, of three sizes, and one constellation line between a few of them
  const big: Pt[] = [[150, 110], [330, 60], [560, 150], [800, 260]];
  const mid: Pt[] = [[240, 220], [430, 130], [680, 70], [900, 140], [120, 300], [980, 330]];
  const small: Pt[] = [[200, 160], [370, 250], [500, 60], [620, 230], [760, 160], [880, 60], [60, 200], [1000, 230], [300, 330], [700, 340]];
  return {
    id: "night",
    tags: ["night", "rest", "sleep", "moon", "stars", "time", "signs", "calm", "remembrance"],
    figures: false,
    groups: [
      { id: "land", paths: hills },
      { id: "mosque", paths: mosque },
      { id: "moon", paths: moon },
      { id: "stars-a", paths: big.map(([x, y]) => star(x, y, 18, 0.42)) },
      { id: "stars-b", paths: mid.map(([x, y]) => star(x, y, 11, 0.42)) },
      { id: "stars-c", paths: small.map(([x, y]) => star(x, y, 6, 0.5)) },
      { id: "constellation", paths: [poly([big[0]!, mid[0]!, big[1]!, mid[1]!, big[2]!])] },
    ],
    regions: [
      { id: "whole", x: 40, y: 20, w: 1000, h: 570 },
      { id: "moon", x: 520, y: 20, w: 300, h: 260 },
      { id: "sky", x: 100, y: 30, w: 520, h: 320 },
      { id: "mosque", x: 262, y: 280, w: 440, h: 300 },
    ],
  };
}
function oliveTree(): ArtDef {
  const trunk = `M${CX - 20} 580C${CX - 30} 500 ${CX - 50} 440 ${CX - 10} 380C${CX + 20} 340 ${CX - 10} 300 ${CX} 260`;
  const trunk2 = `M${CX + 20} 580C${CX + 30} 500 ${CX + 50} 450 ${CX + 18} 390`;
  const branches = [`M${CX} 300C${CX - 80} 260 ${CX - 160} 250 ${CX - 240} 200`, `M${CX} 280C${CX + 70} 230 ${CX + 170} 220 ${CX + 250} 170`, `M${CX - 6} 270C${CX - 20} 200 ${CX + 10} 140 ${CX - 10} 80`, `M${CX - 30} 360C${CX - 120} 360 ${CX - 200} 330 ${CX - 280} 330`];
  const leaves: string[] = [];
  const at: Array<[number, number, number]> = [];
  for (let i = 0; i < 9; i++) at.push([CX - 240 + i * 26, 200 + i * 10 - (i > 4 ? (i - 4) * 14 : 0), -0.6]);
  for (let i = 0; i < 9; i++) at.push([CX + 30 + i * 26, 250 - i * 9, -2.4]);
  for (let i = 0; i < 6; i++) at.push([CX - 10 + (i % 2 ? 6 : -6), 90 + i * 30, i % 2 ? -0.4 : -2.7]);
  for (let i = 0; i < 7; i++) at.push([CX - 270 + i * 34, 330 + (i % 2) * 4, i % 2 ? 0.7 : -0.7]);
  at.forEach(([x, y, a], k) => leaves.push(leaf(x, y, 38, a + (k % 3) * 0.25, 0.24)));
  return {
    id: "olive",
    tags: ["olive", "blessing", "tree", "growth", "light", "goodness", "word"],
    figures: false,
    groups: [
      { id: "ground", paths: [line([160, 584], [784, 584])] },
      { id: "trunk", paths: [trunk, trunk2] },
      { id: "branches", paths: branches },
      { id: "leaves-a", paths: leaves.slice(0, 18) },
      { id: "leaves-b", paths: leaves.slice(18) },
      { id: "fruit", paths: [[CX - 180, 236], [CX + 160, 222], [CX - 210, 352], [CX + 90, 248], [CX - 30, 150]].map(([x, y]) => circle(x!, y!, 7)) },
    ],
    regions: [
      { id: "whole", x: 140, y: 40, w: 664, h: 560 },
      { id: "crown", x: 222, y: 60, w: 500, h: 300 },
      { id: "root", x: 322, y: 360, w: 300, h: 240 },
    ],
  };
}

function oasis(): ArtDef {
  const dunes = `M40 540Q260 470 480 520T1040 500`;
  const palm = (x: number, h: number): string[] => {
    const top: Pt = [x + 10, 560 - h];
    const fronds = [-2.6, -2.1, -1.6, -1.1, -0.6].map((a) => leaf(top[0], top[1], 90, a, 0.14));
    return [`M${x} 560Q${x - 8} ${560 - h / 2} ${top[0]} ${top[1]}`, ...fronds];
  };
  return {
    id: "oasis",
    tags: ["journey", "desert", "road", "water", "migration", "path", "patience"],
    figures: false,
    groups: [
      { id: "dunes", paths: [dunes, `M40 580Q300 540 560 568T1040 572`] },
      { id: "palms", paths: [...palm(220, 300), ...palm(300, 240)] },
      { id: "well", paths: [poly([[620, 560], [620, 500], [740, 500], [740, 560]]), line([612, 500], [748, 500]), `M630 500Q680 380 730 500`, line([680, 430], [680, 470])] },
      { id: "sun", gold: true, paths: [circle(860, 150, 44)] },
    ],
    regions: [
      { id: "whole", x: 40, y: 20, w: 1000, h: 580 },
      { id: "palms", x: 100, y: 180, w: 360, h: 400 },
      { id: "well", x: 560, y: 340, w: 260, h: 260 },
    ],
  };
}


/* ---------------- meaning motifs (owner, 28 Nov: «Siraj's videos and animations should have meaning») ----------------
 * Each motif shows the key image of a text, built in the order the text says it: its groups are
 * STAGES (the first stands at the hook, the rest arrive verse by verse: Chiragh.buildPlan). Nature,
 * sky, architecture and abstract marks only: no person, face, prophet, imam, animal or figure for God.
 * scripts/chiragh/meaning.mjs picks one per text and says why. */

/** light / nur: a point of light, then rings and rays spreading over the dark land */
function lightSpread(): ArtDef {
  const o: Pt = [CX, 300];
  const rays = (r0: number, r1x: number, n: number, off = 0) => Array.from({ length: n }, (_, i) => {
    const a = off + (i * 2 * Math.PI) / n;
    return line([o[0] + r0 * Math.cos(a), o[1] + r0 * Math.sin(a)], [o[0] + r1x * Math.cos(a), o[1] + r1x * Math.sin(a)]);
  });
  return {
    id: "light",
    tags: ["light", "nur", "guidance", "dawn", "truth", "knowledge", "lamp", "shine"],
    figures: false,
    groups: [
      { id: "land", paths: [poly(arc(CX, 1180, 900, -Math.PI * 0.62, -Math.PI * 0.38, 60)), line([60, 560], [884, 560])] },
      { id: "source", gold: true, fill: true, weight: 0, paths: [circle(o[0], o[1], 16)] },
      { id: "ring-1", gold: true, paths: [circle(o[0], o[1], 48)], cue: "نور|النور|\\blight\\b" },
      { id: "rays-1", paths: rays(64, 130, 8) },
      { id: "ring-2", paths: [circle(o[0], o[1], 150)] },
      { id: "rays-2", paths: rays(160, 250, 16, Math.PI / 16), cue: "اهدنا|هدى|يهدي|\\bguid|هدایت" },
      { id: "ring-3", paths: [circle(o[0], o[1], 270)] },
      { id: "glints", paths: [[180, 520], [300, 500], [640, 500], [770, 520], [470, 540]].map(([x, y]) => star(x!, y!, 9, 0.45)) },
    ],
    regions: [
      { id: "whole", x: 60, y: 10, w: 824, h: 580 },
      { id: "source", x: 342, y: 170, w: 260, h: 260 },
      { id: "land", x: 100, y: 420, w: 744, h: 170 },
    ],
  };
}

/** water / rain: dry cracked ground, a cloud, rain, and the ground revived with shoots */
function rainRevive(): ArtDef {
  const cracks = [poly([[200, 520], [240, 540], [230, 570]]), poly([[360, 515], [330, 545], [350, 575]]), poly([[560, 520], [600, 548], [580, 578]]), poly([[720, 515], [690, 545], [715, 572]])];
  const cloud = "M300 150Q300 100 350 100Q370 60 430 66Q470 30 530 56Q590 50 610 100Q660 104 656 150Z";
  const drops = (y0: number, k: number) => Array.from({ length: 11 }, (_, i) => { const x = 320 + i * 30 + (k % 2) * 14; const y = y0 + ((i * 37) % 60); return line([x, y], [x - 8, y + 34]); });
  const shoot = (x: number, h: number) => [line([x, 512], [x, 512 - h]), leaf(x, 512 - h * 0.55, 30, -2.3, 0.3), leaf(x, 512 - h * 0.75, 30, -0.8, 0.3)];
  return {
    id: "rain",
    tags: ["rain", "water", "revive", "dead earth", "mercy", "life", "resurrection", "sky", "sustenance"],
    figures: false,
    groups: [
      { id: "ground", paths: [line([120, 512], [824, 512]), ...cracks] },
      { id: "cloud", paths: [cloud] },
      { id: "rain-a", paths: drops(180, 0), cue: "ماء|الماء|غيث|\\brain\\b|\\bwater\\b|باران|آب" },
      { id: "rain-b", paths: drops(250, 1) },
      { id: "soak", paths: [line([160, 526], [784, 526]), line([200, 540], [744, 540])] },
      { id: "shoots-a", paths: [...shoot(250, 70), ...shoot(470, 96)], cue: "احيا|فاحيا|\\brevive|\\bgave life|زنده" },
      { id: "shoots-b", paths: [...shoot(360, 60), ...shoot(600, 84), ...shoot(700, 58)] },
      { id: "bloom", gold: true, paths: [[470, 408], [600, 420]].map(([x, y]) => circle(x!, y!, 9)) },
    ],
    regions: [
      { id: "whole", x: 100, y: 20, w: 744, h: 570 },
      { id: "sky", x: 260, y: 30, w: 440, h: 300 },
      { id: "ground", x: 160, y: 380, w: 624, h: 210 },
    ],
  };
}

/** patience / growth: a seed in the soil, roots, a stem, leaves, and at last the fruit */
function seedGrow(): ArtDef {
  const soil = 430;
  return {
    id: "seed",
    tags: ["patience", "seed", "growth", "reward", "good deed", "charity", "multiply", "time", "faith"],
    figures: false,
    groups: [
      { id: "soil", paths: [line([140, soil], [804, soil]), line([180, soil + 14], [764, soil + 14])] },
      { id: "seed", paths: [`M${CX - 16} ${soil + 70}Q${CX} ${soil + 46} ${CX + 16} ${soil + 70}Q${CX} ${soil + 94} ${CX - 16} ${soil + 70}Z`] },
      { id: "roots", paths: [`M${CX} ${soil + 88}Q${CX - 30} ${soil + 120} ${CX - 80} ${soil + 140}`, `M${CX} ${soil + 88}Q${CX + 26} ${soil + 124} ${CX + 70} ${soil + 146}`, `M${CX} ${soil + 90}L${CX} ${soil + 160}`] },
      { id: "stem", paths: [`M${CX} ${soil + 54}C${CX - 10} ${soil - 60} ${CX + 12} ${soil - 160} ${CX} ${soil - 260}`] },
      { id: "leaves-a", paths: [leaf(CX, soil - 40, 60, -2.6, 0.3), leaf(CX, soil - 80, 60, -0.5, 0.3)] },
      { id: "leaves-b", paths: [leaf(CX + 2, soil - 150, 64, -2.5, 0.3), leaf(CX + 2, soil - 190, 64, -0.6, 0.3), leaf(CX, soil - 240, 40, -1.6, 0.3)] },
      { id: "ears", paths: [-0.9, -2.2].map((a) => leaf(CX, soil - 250, 80, a, 0.16)), cue: "سنابل|سنبلة|\\bears\\b|خوشه" },
      { id: "fruit", gold: true, paths: [[CX - 42, soil - 300], [CX + 46, soil - 296], [CX, soil - 330]].map(([x, y]) => circle(x!, y!, 8)), cue: "الصابرين|اجر|\\breward|\\bmultipl|پاداش|چند برابر" },
    ],
    regions: [
      { id: "whole", x: 140, y: 40, w: 664, h: 560 },
      { id: "soil", x: 292, y: 400, w: 360, h: 200 },
      { id: "crown", x: 292, y: 60, w: 360, h: 300 },
    ],
  };
}

/** night and day: the sky turning, the sun's arc down, the moon up, the stars */
function skyTurn(): ArtDef {
  const h = 470;
  return {
    id: "sky",
    tags: ["night", "day", "time", "sun", "moon", "signs", "dawn", "dusk", "turn", "creation"],
    figures: false,
    groups: [
      { id: "horizon", paths: [line([60, h], [884, h]), "M60 520Q300 490 470 510T884 500"] },
      { id: "sun", gold: true, paths: [circle(250, 200, 40)], cue: "الشمس|الضحى|النهار|\\bsun\\b|\\bday\\b|\\bmorning|خورشید|روز|چاشت" },
      { id: "sun-arc", paths: [poly(arc(CX, h, 330, Math.PI, Math.PI * 1.5, 40))] },
      { id: "dusk", cue: "الليل|\\bnight\\b|شب", paths: [poly(arc(CX, h, 400, Math.PI * 1.02, Math.PI * 1.98, 60)), poly(arc(CX, h, 440, Math.PI * 1.04, Math.PI * 1.96, 60))] },
      { id: "moon", paths: [`M700 120A56 56 0 1 0 744 210A44 44 0 1 1 700 120Z`], cue: "القمر|\\bmoon\\b|ماه" },
      { id: "moon-arc", paths: [poly(arc(CX, h, 330, Math.PI * 1.5, Math.PI * 2, 40))] },
      { id: "stars", cue: "الفجر|\\bdawn\\b|سپیده|فجر", paths: [[160, 90], [380, 60], [560, 110], [860, 80], [300, 160], [620, 200], [820, 260]].map(([x, y], i) => star(x!, y!, i % 2 ? 8 : 12, 0.42)) },
    ],
    regions: [
      { id: "whole", x: 40, y: 20, w: 864, h: 560 },
      { id: "sun", x: 140, y: 100, w: 300, h: 260 },
      { id: "moon", x: 560, y: 40, w: 300, h: 260 },
    ],
  };
}

/** the scale / justice: the stand, the beam, the pans, then the beam level */
function balance(): ArtDef {
  const top = 150;
  const pan = (x: number, y: number) => [line([x, y], [x - 70, y + 120]), line([x, y], [x + 70, y + 120]), `M${x - 90} ${y + 120}Q${x} ${y + 170} ${x + 90} ${y + 120}Z`];
  return {
    id: "balance",
    tags: ["justice", "scale", "balance", "measure", "judgment", "deeds", "weigh", "fairness", "reckoning"],
    figures: false,
    groups: [
      { id: "base", paths: [line([CX - 120, 560], [CX + 120, 560]), `M${CX - 70} 560Q${CX} 520 ${CX + 70} 560`] },
      { id: "pillar", paths: [line([CX, 540], [CX, top]), circle(CX, top - 16, 14)] },
      { id: "beam", paths: [line([CX - 260, top + 10], [CX + 260, top + 10])] },
      { id: "pan-left", paths: pan(CX - 260, top + 10), cue: "موازين|الميزان|مثقال|\\bscales?\\b|\\bweigh|ترازو|سنگینی|وزن" },
      { id: "pan-right", paths: pan(CX + 260, top + 10) },
      { id: "level", gold: true, paths: [star(CX, top - 16, 9, 0.45)], cue: "بالقسط|القسط|\\bjustice|\\bjust\\b|عدل|عدالت|داد" },
    ],
    regions: [
      { id: "whole", x: 120, y: 60, w: 704, h: 530 },
      { id: "beam", x: 172, y: 80, w: 600, h: 260 },
      { id: "base", x: 292, y: 380, w: 360, h: 210 },
    ],
  };
}

/** refuge: a sheltered flame in a niche, its light, and the dark whispers curling away from it */
function refuge(): ArtDef {
  const ys = 330;
  const wisp = (x: number, y: number, dir: number) => `M${x} ${y}c${dir * 30} -24 ${dir * 60} 10 ${dir * 44} 34s${dir * -40} 10 ${dir * -24} -10`;
  return {
    id: "refuge",
    tags: ["refuge", "protection", "shelter", "evil", "whisper", "trust", "safety", "seek refuge", "guard"],
    figures: false,
    groups: [
      { id: "shelter", paths: [arch(CX, ys, 300, 230), line([CX - 150, ys], [CX - 150, 560]), line([CX + 150, ys], [CX + 150, 560]), line([CX - 190, 560], [CX + 190, 560])] },
      { id: "glass", paths: [circle(CX, 460, 54), line([CX - 34, 508], [CX - 44, 556]), line([CX + 34, 508], [CX + 44, 556])] },
      { id: "flame", gold: true, fill: true, weight: 0, paths: [`M${CX} 490C${CX - 12} 476 ${CX - 8} 452 ${CX} 432C${CX + 8} 452 ${CX + 12} 476 ${CX} 490Z`] },
      // the shelter made whole: eight-fold stars along its arch (refuge in the Lord: shelter, never an image for Him)
      { id: "tiles", paths: along(archPts(CX, 330, 300, 230), 46).map(([x, y]) => star(x, y - 18, 8, 0.45)) },
      { id: "light-1", gold: true, paths: [circle(CX, 460, 110)], cue: "الفلق|\\bdaybreak|\\bdawn|سپیده" },
      { id: "wisps-near", cue: "الوسواس|غاسق|\\bwhisper|\\bdarkness|وسوسه|تاریکی", paths: [wisp(250, 300, 1), wisp(700, 320, -1), wisp(230, 480, 1), wisp(720, 470, -1)] },
      { id: "light-2", paths: [poly(arc(CX, 460, 200, Math.PI * 1.06, Math.PI * 1.94, 48))], cue: "الجنة|حاسد|\\bjinn|\\benvi|جنّ|جن |حسود" },
      { id: "wisps-away", cue: "الخناس|النفاثات|\\bwithdraw|\\bslink|\\bsneak|\\bretreat|پنهانکار|دمندگان", paths: [wisp(110, 140, -1), wisp(840, 150, 1), wisp(90, 400, -1), wisp(860, 420, 1)] },
    ],
    regions: [
      { id: "whole", x: 60, y: 40, w: 824, h: 550 },
      { id: "flame", x: 342, y: 330, w: 260, h: 260 },
      { id: "edges", x: 60, y: 100, w: 824, h: 400 },
    ],
  };
}

/** the stones from the sky: the House on its plain, flight trails filling the sky, stones falling, a field of straw eaten down (105) */
function stones(): ArtDef {
  const g = 540;
  const stalks = (bent: boolean) => Array.from({ length: 12 }, (_, i) => {
    const x = 160 + i * 56;
    return bent ? `M${x} ${g}Q${x + 4} ${g - 30} ${x + 30} ${g - 24}` : line([x, g], [x - 4 + (i % 3) * 4, g - 70 - (i % 4) * 8]);
  });
  const trails = [[180, 150, 1], [330, 110, 1], [620, 120, -1], [780, 160, -1], [470, 70, 1]].map(([x, y, d]) => `M${x} ${y}q${d! * 40} -26 ${d! * 80} 0`);
  const falling = [[260, 220], [360, 260], [480, 200], [590, 270], [690, 230], [420, 330], [540, 360]].flatMap(([x, y]) => [circle(x!, y!, 6), line([x! - 14, y! - 40], [x! - 3, y! - 8])]);
  return {
    id: "stones",
    tags: ["elephant", "army", "stones", "birds", "plot", "defeat", "protection of the House", "kaaba", "punishment"],
    figures: false,
    groups: [
      { id: "plain", paths: [line([60, g], [884, g])] },
      { id: "house", paths: [poly([[CX - 50, g], [CX - 50, g - 100], [CX + 50, g - 100], [CX + 50, g]]), line([CX - 50, g - 76], [CX + 50, g - 76])] },
      // the road the army took towards the House (verse 1: «the owners of the elephant»), no figure on it
      { id: "road", paths: ["M60 560Q220 548 360 546T402 542", "M60 578Q240 566 380 562T412 556"] },
      { id: "dust", cue: "كيدهم|\\bstratagem|\\bplot|نقشه|نیرنگ|مکر", paths: ["M60 520Q120 490 180 515T300 510", "M70 500Q130 470 190 495"] },
      { id: "trails", paths: trails, cue: "طيرا|ابابيل|\\bbirds?\\b|\\bflying|\\bflocks?\\b|پرندگان|دسته دسته" },
      { id: "falling", paths: falling, cue: "بحجارة|سجيل|\\bstones?\\b|\\bclay\\b|سنگ" },
      { id: "stalks", paths: stalks(false), cue: "كعصف|\\bstraw|\\bcrops|\\bleaves|کاه|برگ" },
      { id: "straw", paths: stalks(true), cue: "ماكول|\\bdevoured|\\beaten|خورده" },
    ],
    regions: [
      { id: "whole", x: 60, y: 30, w: 824, h: 560 },
      { id: "sky", x: 160, y: 40, w: 620, h: 340 },
      { id: "plain", x: 100, y: 380, w: 744, h: 210 },
    ],
  };
}

export const ART: Record<string, ArtDef> = Object.fromEntries([mihrab(), mishkat(), rosette(), mushaf(), gate(), nightSky(), oliveTree(), oasis(), lightSpread(), rainRevive(), seedGrow(), skyTurn(), balance(), refuge(), stones()].map((a) => [a.id, a]));

/** The meaning motifs (their groups are stages, drawn in step with the text). */
export const MOTIFS = ["light", "rain", "seed", "sky", "balance", "refuge", "stones"] as const;

/** The library as the concept writer sees it: ids, meanings, groups, regions (no geometry). */
export const artIndex = () => Object.values(ART).map((a) => ({ id: a.id, tags: a.tags, groups: a.groups.map((g) => g.id), regions: a.regions.map((r) => r.id) }));
