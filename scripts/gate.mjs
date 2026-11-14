// The gate of the lamp style: the checks a Reel must pass before it is handed to the service,
// and so before the owner sees it (the hub's social audit of 2026-11-13, the style guide, the
// owner's rules). Every check fails, none only warns:
//
//   hook        the ayah (or the hook's line) is on screen from the first frame, and the other words
//               there in the first 1.5 s are 7 or fewer (no logo or title card first)
//   hook-motion the picture moves in the first 1.5 s (measured on the file)
//   still       no 3.5 s without a visible change (measured)
//   loop        the last frame looks like the first (measured)
//   safe        every text inside the frame and outside the apps' header, rail and caption rows
//   text-size   no text smaller than 1.5 % of the frame's height (29 px), measured as drawn
//   overlap     no two texts over each other
//   source      while a quote is on screen, its source (surah and verse, the translator) is too
//   quote       the Arabic and the translation on screen are letter for letter the source's text
//   persian     no «·» and no «|» beside Persian
//   badge       the channel badge: small, in the bottom safe area, not in the middle, 1.5–2.5 s, at the close
//   loudness    −14 LUFS within 1 LU, true peak −1 dBTP or lower (measured)
//
// The text checks read what the page measured of itself (src/lamp/Probe.tsx): boxes, sizes,
// opacities, word counts and hashes only, never a text. The plan's part is pure and tested
// (scripts/gate.test.mjs); the measured part needs ffmpeg.
//   SIRAJ_GATE=warn   report and go on      SIRAJ_GATE=off   no gate at all
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FPS, MIDDLE, MIN_TEXT, ZONES, inZones } from "../src/lamp/zones.ts";
import { TARGET, loudness } from "./finish.mjs";

/** A Reel the gate refused: its message is the owner's reason, in plain Persian. */
export class GateRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = "GateRefusal";
    this.final = true;
  }
}

const HOOK = Math.round(1.5 * FPS);
const fa = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const sec = (f) => (f / FPS).toFixed(1);
/**
 * Two texts over each other: they share more than 6 px across and more than a quarter of the lower
 * one's height (the line boxes of Arabic and of large numerals reach well above and below their
 * letters; two lines that only touch there are not on each other).
 */
const meet = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 6 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > Math.max(6, 0.25 * Math.min(a.h, b.h));

/**
 * The checks on what the page measured. `probes`: [{ f, rows }] (Probe.tsx); `plan`: { total,
 * quotes: { key: hash }, badge: { from, to } | null, badgeOn }.
 */
export function probeChecks(probes, plan) {
  const out = [];
  const add = (id, ok, detail, faText) => out.push({ id, ok, detail, fa: faText });
  const frames = [...probes].sort((a, b) => a.f - b.f);
  const seen = (r, o = 0.5) => r.o >= o;

  // hook: the quote or the hook line at frame 0; the framing words of the first 1.5 s
  const zero = frames.find((p) => p.f === 0);
  const lead = Boolean(zero?.rows.some((r) => (r.r === "quote" || r.r === "hook") && seen(r, 0.6)));
  const early = frames.filter((p) => p.f <= HOOK);
  const framing = Math.max(0, ...early.map((p) => p.rows.filter((r) => r.r !== "quote" && seen(r)).reduce((n, r) => n + r.n, 0)));
  add("hook", Boolean(zero) && lead && framing <= 7, `${zero ? "" : "frame 0 not measured; "}quote or hook at frame 0: ${lead}; other words in the first 1.5 s: ${framing}`, !lead ? "آیه یا جملهٔ اصلی از همان فریمِ اول روی تصویر نیست" : `در ۱٫۵ ثانیهٔ اول ${fa(framing)} واژه متنِ کناری هست (حداکثر ۷)`);

  const outside = [];
  const small = [];
  const over = [];
  const dots = [];
  const unsourced = [];
  const wrong = [];
  for (const p of frames) {
    const vis = p.rows.filter((r) => seen(r, 0.15));
    for (const r of vis) if (!inZones(r)) outside.push(`${sec(p.f)} s ${r.r} ${r.x},${r.y} ${r.w}×${r.h}`);
    for (const r of p.rows) if (seen(r) && r.s < MIN_TEXT - 0.5) small.push(`${sec(p.f)} s ${r.r} ${r.s} px`);
    const strong = p.rows.filter((r) => seen(r, 0.6));
    // two parts of one quote (a basmala line and the rest of its ayah) are one text
    for (let i = 0; i < strong.length; i++) for (let j = i + 1; j < strong.length; j++) if (strong[i].b !== strong[j].b && !(strong[i].q && strong[i].q === strong[j].q) && meet(strong[i], strong[j])) over.push({ f: p.f, k: `${strong[i].r}/${strong[j].r} at y ${Math.min(strong[i].y, strong[j].y)}` });
    for (const r of p.rows) if (r.d && seen(r, 0.15)) dots.push(`${sec(p.f)} s`);
    if (strong.some((r) => r.r === "quote") && !p.rows.some((r) => r.r === "source" && seen(r))) unsourced.push(sec(p.f));
    for (const r of p.rows) if (r.r === "quote" && r.q && r.hq && plan.quotes?.[r.q] && r.hq !== plan.quotes[r.q]) wrong.push(`${sec(p.f)} s ${r.q}`);
  }
  const first = (list) => [...new Set(list)].slice(0, 4).join("; ");
  /** «text/text at y 380: 0.2–3.4 s» for each pair, so a report names each fault once */
  const spans = (list) => {
    const by = new Map();
    for (const x of list) by.set(x.k, [...(by.get(x.k) ?? []), x.f]);
    return [...by].slice(0, 5).map(([k, fs]) => `${k}: ${sec(Math.min(...fs))}–${sec(Math.max(...fs))} s (${fs.length} frames)`).join("; ");
  };
  add("safe", !outside.length, outside.length ? `outside x ${ZONES.left}–${ZONES.right}, y ${ZONES.top}–${ZONES.bottom}: ${first(outside)}` : `every text inside x ${ZONES.left}–${ZONES.right}, y ${ZONES.top}–${ZONES.bottom}`, "متنی بیرون از قابِ امن است (زیرِ نوار یا دکمه‌های برنامه)");
  add("text-size", !small.length, small.length ? `smaller than ${MIN_TEXT} px: ${first(small)}` : `every text ${MIN_TEXT} px or more`, "متنی ریزتر از حدِ خواندن است");
  add("overlap", !over.length, over.length ? `texts over each other: ${spans(over)}` : "no two texts over each other", "دو متن روی هم افتاده‌اند");
  add("source", !unsourced.length, unsourced.length ? `a quote without its source at ${first(unsourced)} s` : "every quote with its source", "منبعِ آیه کنارِ آن روی تصویر نیست");
  const quoted = frames.some((p) => p.rows.some((r) => r.r === "quote" && r.hq));
  add("quote", !wrong.length && (quoted || !Object.keys(plan.quotes ?? {}).length), wrong.length ? `differs from the source: ${first(wrong)}` : quoted ? "every quote letter for letter as the source" : "no quote in this Reel", "متنِ آیه یا ترجمه روی تصویر با منبع یکی نیست");
  add("persian", !dots.length, dots.length ? `«·» or «|» beside Persian at ${first(dots)}` : "no «·» or «|» beside Persian", "کنارِ متنِ فارسی «·» یا «|» آمده است");

  if (plan.badgeOn) {
    const rows = frames.flatMap((p) => p.rows.filter((r) => r.r === "badge" && seen(r)).map((r) => ({ ...r, f: p.f })));
    const b = plan.badge;
    const len = b ? b.to - b.from : 0;
    const middle = rows.some((r) => r.y < MIDDLE.bottom && r.y + r.h > MIDDLE.top);
    const placed = rows.length > 0 && rows.every((r) => inZones(r)) && !middle;
    const timed = Boolean(b) && len >= 1.5 * FPS && len <= 2.5 * FPS && b.to <= plan.total - 15 && rows.every((r) => r.f >= b.from && r.f <= b.to) && b.from >= (plan.closeFrom ?? 0);
    add("badge", placed && timed, rows.length ? `${sec(len)} s from ${sec(b?.from ?? 0)} s, y ${Math.min(...rows.map((r) => r.y))}–${Math.max(...rows.map((r) => r.y + r.h))}` : "no badge seen", "نشانِ کانال سرِ جایش نیست");
  } else add("badge", true, "switched off (SIRAJ_BADGE=off)", "");
  return out;
}

function ff(args) {
  return spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stderr ?? "";
}
/** Frozen stretches of the picture (freezedetect on a small copy): [[start, duration]]. */
export function freezes(file, { noise = 0.002, min = 3.5, until } = {}) {
  const log = ff([...(until ? ["-t", String(until)] : []), "-i", file, "-an", "-vf", `scale=270:-2,freezedetect=n=${noise}:d=${min}`, "-f", "null", "-"]);
  const starts = [...log.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const durs = [...log.matchAll(/freeze_duration: ([\d.]+)/g)].map((m) => Number(m[1]));
  return starts.map((s, i) => [s, durs[i] ?? Infinity]);
}
/** How alike two frames of a file are (SSIM, 1 = the same), compared small and a little soft. */
export function likeness(file, a, b) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "siraj-gate-"));
  const one = path.join(dir, "a.png");
  const two = path.join(dir, "b.png");
  const grab = (t, out) => (t === "last" ? ff(["-sseof", "-0.2", "-i", file, "-vf", "scale=540:-2", "-update", "1", "-y", out]) : ff(["-ss", String(t), "-i", file, "-vf", "scale=540:-2", "-frames:v", "1", "-y", out]));
  grab(a, one);
  grab(b, two);
  const log = ff(["-i", one, "-i", two, "-lavfi", "[0]scale=180:-2,gblur=sigma=1[a];[1]scale=180:-2,gblur=sigma=1[b];[a][b]ssim", "-f", "null", "-"]);
  fs.rmSync(dir, { recursive: true, force: true });
  return Number(/All:([\d.]+)/.exec(log)?.[1] ?? NaN);
}

/** The checks measured on the finished file. */
export function fileChecks(file) {
  const out = [];
  const add = (id, ok, detail, faText) => out.push({ id, ok, detail, fa: faText });
  const early = freezes(file, { min: 0.8, until: 1.6 });
  const moved = likeness(file, 0, 1.4);
  add("hook-motion", !early.length && moved < 0.998, `first 1.5 s: ${early.length} frozen stretch(es); frame 0 against 1.4 s SSIM ${moved.toFixed(4)}`, "تصویر در ثانیهٔ اول ثابت است");
  const frozen = freezes(file);
  add("still", !frozen.length, frozen.length ? `frozen: ${frozen.map(([s, d]) => `${s.toFixed(1)} s for ${Number.isFinite(d) ? d.toFixed(1) : "to the end"}`).join(", ")}` : "a visible change at least every 3.5 s", "بیش از ۳٫۵ ثانیه تصویر هیچ تغییری ندارد");
  const loop = likeness(file, 0, "last");
  add("loop", loop >= 0.9, `first and last frame SSIM ${loop.toFixed(3)} (0.90 or more)`, "فریمِ آخر به فریمِ اول نمی‌خورد");
  const loud = loudness(file);
  add("loudness", Math.abs(loud.lufs - TARGET.lufs) <= TARGET.tolerance && loud.tp <= TARGET.tp, `${loud.lufs.toFixed(1)} LUFS, true peak ${loud.tp.toFixed(1)} dBTP`, "بلندیِ صدا اندازه نیست");
  return out;
}

/** The whole gate. Returns { ok, checks }; writes nothing. */
export function gate({ probes, plan, file }) {
  const checks = [...probeChecks(probes, plan), ...(file ? fileChecks(file) : [])];
  return { ok: checks.every((c) => c.ok), checks };
}

/** The gate's verdict as the owner reads it (the service shows it with the failed item). */
export function verdict(result) {
  const failed = result.checks.filter((c) => !c.ok);
  return failed.length ? `این ویدیو از بازبینیِ پیش از ارسال رد شد: ${[...new Set(failed.map((c) => c.fa))].join("؛ ")}.` : "";
}

/** Runs the gate as the switch says; throws a GateRefusal when it fails and the switch is on. */
export function enforce({ probes, plan, file, mode = process.env.SIRAJ_GATE ?? "on", log = console.log }) {
  if (mode === "off") return null;
  const result = gate({ probes, plan, file });
  for (const c of result.checks) log(`gate ${c.ok ? "pass" : "FAIL"} ${c.id}: ${c.detail}`);
  if (!result.ok && mode !== "warn") throw new GateRefusal(verdict(result));
  return result;
}
