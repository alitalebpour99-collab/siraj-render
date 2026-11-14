// The loudness of a finished Reel (the style guide's R8 and the owner's 2026-11-13 rules):
// −14 LUFS within 1 LU, the true peak at −1 dBTP or lower, measured on the encoded file.
// The level is set in two passes (measure, then one linear gain: loudnorm with linear=true), so
// a Reel with long quiet stretches between the qari and the narrator is as loud as one without.
import { spawnSync } from "node:child_process";

export const TARGET = { lufs: -14, tolerance: 1, tp: -1 };

/** Integrated loudness and true peak of a file's sound: { lufs, tp } (NaN when nothing is heard). */
export function loudness(file) {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const log = run.stderr ?? "";
  const summary = log.slice(log.lastIndexOf("Summary:"));
  const lufs = Number(/I:\s+(-?[\d.]+|-inf) LUFS/.exec(summary)?.[1] ?? NaN);
  const tp = Number(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(summary)?.[1] ?? NaN);
  return { lufs, tp };
}

/**
 * The second pass's filter for `file` (measured here), aiming at −14 LUFS and a true peak of
 * `tp` (a little under −1, so the AAC encode stays under it). "anull" for a track with nothing heard.
 */
export function levelFilter(file, tp = -1.5) {
  const target = `I=${TARGET.lufs}:TP=${tp}:LRA=11`;
  const run = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const err = run.stderr ?? "";
  const json = err.slice(err.lastIndexOf("{"));
  const m = JSON.parse(json.slice(0, json.indexOf("}") + 1));
  if (!Number.isFinite(Number(m.input_i)) || Number(m.input_i) < -70) return "anull";
  return `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
}

/** True when a measured { lufs, tp } meets the target. */
export const meets = (l) => Number.isFinite(l.lufs) && Math.abs(l.lufs - TARGET.lufs) <= TARGET.tolerance && Number.isFinite(l.tp) && l.tp <= TARGET.tp;
