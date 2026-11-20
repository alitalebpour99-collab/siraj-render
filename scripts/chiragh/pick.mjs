// The code that picks (storyboard-fa.md §4): of the three concepts, the one LEAST like the last
// 30 videos (Jaccard likeness of their fingerprints) that breaks none of the repeat rules. The
// fingerprints of earlier videos come from the service with the job (props.chiragh.recent, newest
// first); the chosen one's goes back in the manifest.
import { direct, fingerprintOf } from "./director.mjs";
import { likeness } from "../../src/chiragh/storyboard.ts";

/** Which repeat rules a fingerprint breaks against the recent ones (newest first). */
export function ruleBreaks(fp, recent) {
  const out = [];
  if (recent.slice(0, 2).some((r) => r.idea_family === fp.idea_family && r.template === fp.template)) out.push("idea family used in the last 2");
  if (recent.slice(0, 7).filter((r) => r.hook_type === fp.hook_type).length >= 2) out.push("hook type twice in the last 7");
  if (recent.slice(0, 7).filter((r) => r.ending_type === fp.ending_type).length >= 3) out.push("ending three times in the last 7");
  if (recent.slice(0, 14).some((r) => r.anchor_asset === fp.anchor_asset && !["strip", "grid", "root", "linemap"].includes(fp.anchor_asset))) out.push("anchor used in the last 14");
  if (recent.slice(0, 5).some((r) => r.opening_shot === fp.opening_shot && r.anchor_asset === fp.anchor_asset)) out.push("opening shot used in the last 5");
  if (fp.key && recent.slice(0, 30).some((r) => r.key === fp.key)) out.push("key word used in the last 30");
  return out;
}

/** The concepts ranked: rule-keeping first, then by their highest likeness to any of the last 30. */
export function rank(m, concepts, recent = []) {
  const last = recent.slice(0, 30);
  return concepts
    .map((c, i) => {
      const sb = direct(m, c, { videoId: m.id });
      const fp = fingerprintOf(m, c, sb.shots);
      const like = last.length ? Math.max(...last.map((r) => likeness(fp, r))) : 0;
      return { i, c, fp, like: Math.round(like * 1000) / 1000, breaks: ruleBreaks(fp, last) };
    })
    .sort((a, b) => a.breaks.length - b.breaks.length || a.like - b.like || a.i - b.i);
}
