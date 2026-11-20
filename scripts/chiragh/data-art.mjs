// The data pictures of the counting templates, drawn as emerald line art in the stage's
// coordinates (1080 × 600; the text column's centre at x 472), each in named groups that the
// storyboard draws one after the other: «فاصله‌ها» (a strip of the surah's verses with a line
// joining every repeat), «فقط در قرآن / شمارش‌ها» (the 114 surahs as a mushaf map), «چرا این
// واژه؟» (the root's three letters, the places of the word, the absent word), «راه» (a line map
// of places, each with its source). Only numbers and letters from the job's data; no text of the
// Quran is written here (the word itself is shown in the verse, cut from the stored text).

const CX = 472;
const r1 = (n) => Math.round(n * 10) / 10;
const circle = (x, y, r) => `M${r1(x - r)} ${r1(y)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`;
const rect = (x, y, w, h) => `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`;
const FA = "۰۱۲۳۴۵۶۷۸۹";
const num = (n, lang) => (lang === "fa" ? String(n).replace(/\d/g, (d) => FA[Number(d)]) : String(n));
function star(x, y, r, inner = 0.42) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = -Math.PI / 2 + (Math.PI * i) / 8;
    pts.push(`${r1(x + rr * Math.cos(a))} ${r1(y + rr * Math.sin(a))}`);
  }
  return `M${pts.join("L")}Z`;
}

/** «فاصله‌ها»: the verses of the surah as ticks, every repeat ringed, an arc from each repeat to the next (by its distance). */
export function strip(data, numbers, lang) {
  const n = Number(data.verses);
  const places = (data.places ?? []).map(Number).filter((p) => p >= 1 && p <= n);
  const left = 90;
  const right = 860;
  const y = 420;
  // Persian reads right to left: verse 1 on the right
  const xOf = (k) => (lang === "fa" ? right - ((k - 1) * (right - left)) / Math.max(1, n - 1) : left + ((k - 1) * (right - left)) / Math.max(1, n - 1));
  const ticks = [];
  for (let k = 1; k <= n; k++) ticks.push(`M${r1(xOf(k))} ${y - (k % 10 === 0 ? 16 : 8)}L${r1(xOf(k))} ${y + (k % 10 === 0 ? 16 : 8)}`);
  const gaps = { one: [], two: [], more: [] };
  for (let i = 1; i < places.length; i++) {
    const a = places[i - 1];
    const b = places[i];
    const g = b - a - 1;
    const x0 = xOf(a);
    const x1 = xOf(b);
    const h = 24 + Math.min(150, Math.abs(x1 - x0) * 1.2);
    const d = `M${r1(x0)} ${y - 12}Q${r1((x0 + x1) / 2)} ${r1(y - 12 - h)} ${r1(x1)} ${y - 12}`;
    (g <= 1 ? gaps.one : g === 2 ? gaps.two : gaps.more).push(d);
  }
  const groups = [
    { id: "axis", paths: [`M${left - 20} ${y}L${right + 20} ${y}`] },
    { id: "ticks", paths: ticks },
    { id: "repeats", paths: places.map((p) => circle(xOf(p), y, 9)) },
    { id: "gap-one", paths: gaps.one },
    { id: "gap-two", paths: gaps.two.length ? gaps.two : [] },
    { id: "gap-more", paths: gaps.more.length ? gaps.more : [] },
  ].filter((g) => g.paths.length);
  const labels = [
    { x: xOf(1), y: y + 52, text: num(1, lang), size: 40, group: "ticks", font: lang },
    { x: xOf(n), y: y + 52, text: num(n, lang), size: 40, group: "ticks", font: lang },
    ...(numbers?.times ? [{ x: CX, y: 110, text: `${num(numbers.times, lang)} ×`, size: 96, group: "repeats", font: lang }] : []),
  ];
  return { id: "strip", tags: ["distance", "count", "repeat"], figures: false, groups, regions: [{ id: "whole", x: 60, y: 40, w: 840, h: 500 }, { id: "first", x: lang === "fa" ? 560 : 60, y: 200, w: 340, h: 300 }, { id: "last", x: lang === "fa" ? 60 : 560, y: 200, w: 340, h: 300 }, { id: "count", x: 272, y: 20, w: 400, h: 200 }], labels };
}

/** «فقط در قرآن / شمارش‌ها»: the 114 surahs as a mushaf map (19 × 6), the lit ones marked, the focus ringed. */
export function grid(data, numbers, lang) {
  const lit = Array.isArray(data.lit) ? data.lit : [];
  const focus = Number(data.focus) || null;
  const cols = 19;
  const cell = 38;
  const gap = 7;
  const w = cols * (cell + gap) - gap;
  const x0 = CX - w / 2;
  const y0 = 230;
  const at = (i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    // Persian: surah 1 at the top right
    const x = lang === "fa" ? x0 + w - cell - c * (cell + gap) : x0 + c * (cell + gap);
    return [x, y0 + r * (cell + gap)];
  };
  const cells = [];
  const marks = [];
  for (let i = 0; i < 114; i++) {
    const [x, y] = at(i);
    cells.push(rect(x, y, cell, cell));
    if (lit[i]) marks.push(`M${r1(x + 7)} ${r1(y + cell / 2)}L${r1(x + cell / 2)} ${r1(y + 7)}L${r1(x + cell - 7)} ${r1(y + cell / 2)}L${r1(x + cell / 2)} ${r1(y + cell - 7)}Z`);
  }
  const groups = [{ id: "frame", paths: [rect(x0 - 18, y0 - 18, w + 36, 6 * (cell + gap) - gap + 36)] }, { id: "cells", paths: cells }, ...(marks.length ? [{ id: "lit", paths: marks }] : [])];
  const labels = [];
  const regions = [{ id: "whole", x: x0 - 30, y: 20, w: w + 60, h: 560 }];
  if (focus) {
    const [fx, fy] = at(focus - 1);
    groups.push({ id: "focus", paths: [circle(fx + cell / 2, fy + cell / 2, 30), star(fx + cell / 2, fy - 46, 14)] });
    labels.push({ x: fx + cell / 2, y: fy + cell + 46, text: num(focus, lang), size: 44, group: "focus", font: lang });
    regions.push({ id: "focus", x: fx - 140, y: fy - 160, w: 320, h: 320 });
  }
  const big = numbers?.without ?? numbers?.occurrences ?? numbers?.with ?? numbers?.count ?? null;
  if (big !== null && big !== undefined) labels.push({ x: CX, y: 110, text: num(big, lang), size: 150, group: "cells", font: lang });
  regions.push({ id: "count", x: CX - 220, y: 20, w: 440, h: 220 });
  return { id: "grid", tags: ["count", "surahs", "mushaf", "only"], figures: false, groups, regions, labels };
}

/** «چرا این واژه؟»: the three letters of the root, the places of the same written form, and the absent word (zero). */
export function rootTree(data, numbers, lang) {
  const root = (data.root ?? []).map((c) => String.fromCodePoint(c));
  const absent = (data.absentLetters ?? []).map((c) => String.fromCodePoint(c));
  const refs = (data.refs ?? []).slice(0, 8);
  const ry = 110;
  const xs = [CX + 120, CX, CX - 120];
  const groups = [
    { id: "root", paths: xs.map((x) => circle(x, ry, 48)) },
    { id: "branches", paths: refs.map((_, i) => `M${CX} ${ry + 48}C${CX} ${ry + 130} ${r1(CX + (i - (refs.length - 1) / 2) * 104)} ${ry + 150} ${r1(CX + (i - (refs.length - 1) / 2) * 104)} ${ry + 220}`) },
    { id: "refs", paths: refs.map((_, i) => rect(CX + (i - (refs.length - 1) / 2) * 104 - 46, ry + 220, 92, 56)) },
    { id: "absent", paths: [...[CX + 90, CX, CX - 90].map((x) => circle(x, 500, 34)), `M${CX - 150} 540L${CX + 150} 460`] },
  ];
  const labels = [
    ...root.map((ch, i) => ({ x: xs[i], y: ry + 4, text: ch, size: 64, group: "root", font: "quran" })),
    ...refs.map((r, i) => ({ x: CX + (i - (refs.length - 1) / 2) * 104, y: ry + 250, text: lang === "fa" ? num(r, "fa").replace(":", "،") : r, size: 40, group: "refs", font: lang })),
    ...absent.map((ch, i) => ({ x: [CX + 90, CX, CX - 90][i], y: 503, text: ch, size: 44, group: "absent", font: "quran" })),
    { x: CX + 230, y: 500, text: num(numbers?.absent ?? 0, lang), size: 72, group: "absent", font: lang },
  ];
  return { id: "root", tags: ["word", "root", "places"], figures: false, groups, regions: [{ id: "whole", x: 60, y: 20, w: 840, h: 560 }, { id: "root", x: 272, y: 20, w: 400, h: 200 }, { id: "refs", x: 100, y: 230, w: 760, h: 200 }, { id: "absent", x: 272, y: 420, w: 440, h: 170 }], labels };
}

/** «راه»: places by their latitude and longitude, the road through them, every name as given with its source. */
export function lineMap(props, lang) {
  const places = props.places ?? [];
  const lats = places.map((p) => p.lat);
  const lons = places.map((p) => p.lon);
  const pad = 0.6;
  const [la0, la1] = [Math.min(...lats) - pad, Math.max(...lats) + pad];
  const [lo0, lo1] = [Math.min(...lons) - pad, Math.max(...lons) + pad];
  const k = Math.min(700 / (lo1 - lo0), 480 / (la1 - la0));
  const P = (p) => [CX + (p.lon - (lo0 + lo1) / 2) * k, 300 - (p.lat - (la0 + la1) / 2) * k];
  const pts = places.map(P);
  const route = pts.length > 1 ? `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L")}` : "";
  return {
    id: "linemap",
    tags: ["path", "map", "journey"],
    figures: false,
    groups: [
      { id: "frame", paths: [rect(80, 30, 784, 540), star(810, 80, 26)] },
      { id: "places", paths: pts.map(([x, y]) => circle(x, y, 10)) },
      ...(route ? [{ id: "route", paths: [route] }] : []),
    ],
    regions: [{ id: "whole", x: 70, y: 20, w: 804, h: 560 }, ...pts.map(([x, y], i) => ({ id: `place${i + 1}`, x: x - 160, y: y - 140, w: 320, h: 280 }))],
    labels: places.map((p, i) => ({ x: pts[i][0], y: pts[i][1] + 40, text: p.name, size: 40, group: "places", font: lang })),
  };
}

export function dataArt(template, props) {
  if (template === "distances") return strip(props.data ?? {}, props.numbers ?? {}, props.lang);
  if (template === "only-counts") return grid(props.data ?? {}, props.numbers ?? {}, props.lang);
  if (template === "word-choice") return rootTree(props.data ?? {}, props.numbers ?? {}, props.lang);
  if (template === "path") return lineMap(props, props.lang);
  return null;
}
