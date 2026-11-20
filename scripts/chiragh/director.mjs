// The director: from the material and the chosen concept to storyboard.json (storyboard-fa.md §2,
// style bible v2 §5): every sound in its place, the verse cut in pieces that fit (joined they give
// the stored text back), and a shot every 1–2.5 s, each starting on a word of the qari or the
// narrator (the key word of the concept always starts one), each with its picture (what is drawn),
// motion (where the camera goes), text, sound, transition, length and meaning. Pure: no network,
// no files; the tests drive it with made-up words.
import { ART } from "../../src/chiragh/art.ts";
import { wordParts } from "../../src/words.ts";
import { likeness } from "../../src/chiragh/storyboard.ts";

export const TIMING = { lead: 1.2, afterQari: 0.3, afterNarr: 0.4, pauseVerse: 0.5, close: 2.4, badge: 2.0 };
export const SHOT = { min: 1.0, max: 2.5, ideal: 1.7 };
const r3 = (x) => Math.round(x * 1000) / 1000;

/** The stored text cut at its spaces into pieces of at most `max` words (balanced), each with its words' times. */
export function chunkVerse(text, times, max) {
  const { parts, count } = wordParts(text);
  const n = Math.max(1, Math.ceil(count / max));
  const per = Math.ceil(count / n);
  const chunks = [];
  let cur = { text: "", words: [], first: null };
  let wordsIn = 0;
  let lastWord = -1;
  for (const p of parts) {
    if (p.word !== null && p.word !== lastWord && wordsIn === per && chunks.length < n - 1) {
      chunks.push(cur);
      cur = { text: "", words: [], first: null };
      wordsIn = 0;
    }
    if (p.word !== null && p.word !== lastWord) {
      wordsIn++;
      lastWord = p.word;
      const t = times?.[p.word];
      cur.words.push({ text: p.text, start: t ? t.start : 0, end: t ? t.end : 0 });
      if (cur.first === null) cur.first = p.word;
    } else if (p.word !== null && cur.words.length) {
      // a pause mark standing alone belongs to the word before it
      cur.words[cur.words.length - 1].text += p.text;
    }
    cur.text += p.text;
  }
  chunks.push(cur);
  // a space that ended a piece stays with it; joined, the pieces are the stored text exactly
  return chunks;
}

/** The translation cut at its sentences into pieces of at most `max` words. */
export function chunkTranslation(text, max = 30) {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= max) return [text];
  const sentences = text.match(/[^.!?؟؛;]+[.!?؟؛;]*\s*/g) ?? [text];
  const out = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).split(/\s+/).filter(Boolean).length > max) {
      out.push(cur);
      cur = "";
    }
    cur += s;
  }
  if (cur) out.push(cur);
  // a single sentence longer than max is cut at its spaces (the words stay as they are)
  return out.flatMap((c) => {
    const w = c.split(/(\s+)/);
    if (c.split(/\s+/).filter(Boolean).length <= max * 1.4) return [c];
    const pieces = [];
    let p = "";
    let k = 0;
    for (const x of w) {
      if (/\S/.test(x)) k++;
      p += x;
      if (k >= max && /\s/.test(x)) {
        pieces.push(p);
        p = "";
        k = 0;
      }
    }
    if (p) pieces.push(p);
    return pieces;
  });
}

/** Places every sound on the clock and builds the verses (with their pieces) and the captions. */
export function layout(m) {
  let t = TIMING.lead;
  const sounds = [];
  const at = {};
  for (const [i, u] of m.order.entries()) {
    const next = m.order[i + 1];
    if (u.kind === "qari") {
      const v = m.verses.find((x) => x.id === u.verse);
      sounds.push({ who: "qari", id: v.id, file: v.clip.file, at: r3(t), seconds: v.clip.seconds });
      at[`q:${v.id}`] = { from: t, to: t + v.clip.seconds };
      t += v.clip.seconds + (next?.kind === "narr" ? TIMING.afterQari : TIMING.pauseVerse);
    } else {
      const l = m.lines.find((x) => x.id === u.line);
      if (l.file && !u.silent) sounds.push({ who: "narrator", id: l.id, file: l.file, at: r3(t), seconds: l.seconds });
      at[`n:${l.id}`] = { from: t, to: t + l.seconds };
      t += l.seconds + TIMING.afterNarr;
    }
  }
  const closeAt = t;
  const total = r3(closeAt + TIMING.close);

  // the verses: on screen from their qari (or the lead, for the first) until the next verse comes
  const shownVerses = m.verses.filter((v) => at[`q:${v.id}`] || (v.readBy && at[`n:${v.readBy}`]));
  const verses = shownVerses.map((v, i) => {
    const q = at[`q:${v.id}`];
    const n = v.readBy ? at[`n:${v.readBy}`] : m.lines.find((l) => l.verse === v.id) ? at[`n:${m.lines.find((l) => l.verse === v.id).id}`] : null;
    const startAt = q ? q.from : n.from;
    const from = i === 0 ? 0 : startAt - 0.35;
    const nextV = shownVerses[i + 1];
    const nextStart = nextV ? (at[`q:${nextV.id}`]?.from ?? at[`n:${nextV.readBy}`]?.from) - 0.35 : closeAt;
    const mode = q && v.clip.mode === "word" ? "word" : "verse";
    const times = q && mode === "word" ? v.clip.words.map((w) => ({ start: r3(q.from + w.start), end: r3(q.from + w.end) })) : null;
    const max = v.ayah === null ? 99 : 9;
    const raw = chunkVerse(v.text, times, max);
    const chunks = raw.map((c, k) => ({
      text: c.text,
      words: mode === "word" ? c.words : c.words.map((w) => ({ ...w, start: startAt, end: (q ?? n).to })),
      from: r3(k === 0 ? from : Math.max(from, c.words[0].start - 0.2)),
      to: 0,
    }));
    chunks.forEach((c, k) => (c.to = r3(k + 1 < chunks.length ? chunks[k + 1].from : nextStart)));
    // the translation: whole sentences, in time across the narrator's reading (or the verse's time)
    const tc = chunkTranslation(v.translation, 30);
    // the translation's sentences in time with its reading, or with the recitation (a verse with no narrator line)
    const tSpan = n ? [n.from, n.to] : q ? [q.from, q.to] : [from, nextStart];
    const narr = m.lines.find((l) => l.verse === v.id);
    const transChunks = tc.map((text, k) => {
      const a = tSpan[0] + ((tSpan[1] - tSpan[0]) * k) / tc.length;
      const wordsOk = narr?.words && tc.length === 1 && narr.words.length === text.split(/\s+/).filter(Boolean).length;
      return { text, from: r3(k === 0 ? from : a), to: 0, words: wordsOk ? narr.words.map(([s, e]) => ({ text: "", start: r3(n.from + s / 1000), end: r3(n.from + e / 1000) })) : null };
    });
    transChunks.forEach((c, k) => (c.to = r3(k + 1 < transChunks.length ? transChunks[k + 1].from : nextStart)));
    return { id: v.id, ayah: v.ayah, surah: v.surah, key: v.key, mode, chunks, seal: v.seal, translation: v.translation, transChunks, refLine: v.refLine, from: r3(from), to: r3(nextStart) };
  });

  // the narrator's lines that are not a verse's translation: captions
  const captions = m.lines
    .filter((l) => !l.verse && at[`n:${l.id}`])
    .map((l) => {
      const a = at[`n:${l.id}`];
      const words = l.words && l.words.length === l.text.split(/\s+/).filter(Boolean).length ? l.words.map(([s, e]) => ({ text: "", start: r3(a.from + s / 1000), end: r3(a.from + e / 1000) })) : null;
      return { id: l.id, text: l.text, from: r3(a.from - 0.15), to: r3(a.to + 0.3), words, keyword: null };
    });
  // a translation read without word times: its words spread over the reading (estimated lock points)
  const narrEst = m.lines
    .filter((l) => l.verse && at[`n:${l.id}`] && !(l.words && l.words.length))
    .map((l) => {
      const a = at[`n:${l.id}`];
      const ws = String(l.text ?? "").split(/\s+/).filter(Boolean);
      return { unit: `${l.verse}:t`, words: ws.map((w, k) => ({ text: w, time: r3(a.from + ((a.to - a.from) * k) / Math.max(1, ws.length)) })) };
    });
  return { sounds, verses, captions, total, closeAt: r3(closeAt), at, narrEst };
}

/** The lock points: every word's start (qari and narrator) and every sound's start. */
function events(L, keyTime) {
  const ev = [];
  for (const v of L.verses) {
    let k = 0;
    if (v.mode === "word") for (const c of v.chunks) for (const w of c.words) ev.push({ track: "qari", unit: v.id, index: k++, time: w.start, text: w.text, weight: k === 1 ? 2 : 1 });
  }
  for (const c of L.captions) {
    if (c.words) c.words.forEach((w, k) => ev.push({ track: "narrator", unit: c.id, index: k, time: w.start, text: c.text.split(/\s+/)[k] ?? "", weight: k === 0 ? 2 : 1 }));
    else {
      const ws = c.text.split(/\s+/).filter(Boolean);
      ws.forEach((w, k) => ev.push({ track: "narrator", unit: c.id, index: k, time: r3(c.from + 0.15 + ((c.to - c.from - 0.45) * k) / Math.max(1, ws.length)), text: w, weight: k === 0 ? 2 : 1, estimated: true }));
    }
  }
  for (const v of L.verses)
    for (const tc of v.transChunks) {
      const ws = tc.text.split(/\s+/).filter(Boolean);
      if (tc.words) tc.words.forEach((w, k) => ev.push({ track: "narrator", unit: `${v.id}:t`, index: k, time: w.start, text: ws[k] ?? "", weight: k === 0 ? 2 : 1 }));
    }
  for (const e of L.narrEst ?? []) e.words.forEach((w, k) => ev.push({ track: "narrator", unit: e.unit, index: k, time: w.time, text: w.text, weight: k === 0 ? 2 : 1, estimated: true }));
  for (const s of L.sounds) ev.push({ track: s.who, unit: s.id, index: 0, time: s.at, text: "", weight: 3 });
  if (keyTime !== null) ev.push({ ...keyTime, weight: 5 });
  const seen = new Set();
  return ev
    .filter((e) => e.time > 0.05)
    .sort((a, b) => a.time - b.time || b.weight - a.weight)
    .filter((e) => {
      const k = Math.round(e.time * 100);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** The cut points: from 0, every next cut on a word 1–2.5 s later (near 1.7 s, a sound's or the key word's start first). */
export function cuts(L, keyTime) {
  const ev = events(L, keyTime);
  const out = [{ time: 0, ev: null }];
  let cur = 0;
  const end = L.total;
  while (end - cur > SHOT.max) {
    const win = ev.filter((e) => e.time >= cur + SHOT.min && e.time <= cur + SHOT.max && end - e.time >= SHOT.min);
    let pick = null;
    if (win.length) {
      const strong = win.filter((e) => e.weight >= 3);
      const pool = strong.length ? strong : win;
      pick = pool.reduce((b, e) => (Math.abs(e.time - (cur + SHOT.ideal)) - e.weight * 0.08 < Math.abs(b.time - (cur + SHOT.ideal)) - b.weight * 0.08 ? e : b));
      // the key word always starts a shot: take it now, or stop short so that the next cut can
      const key = ev.find((e) => e.key && e.time > cur + 0.01);
      if (key && key.time >= cur + SHOT.min && key.time <= cur + SHOT.max && end - key.time >= SHOT.min) pick = key;
      else if (key && pick.time > key.time - SHOT.min && key.time - cur >= 2 * SHOT.min) {
        const before = win.filter((e) => e.time <= key.time - SHOT.min);
        if (before.length) pick = before[before.length - 1];
      }
    }
    // no word in the window (a long held word, a silence): cut at the ideal length, locked to the last word heard
    const time = pick ? pick.time : Math.min(cur + SHOT.ideal + 0.3, end - SHOT.min);
    const lastHeard = pick ?? [...ev].reverse().find((e) => e.time <= time) ?? null;
    out.push({ time: r3(time), ev: pick ? pick : lastHeard ? { ...lastHeard, after: true } : null });
    cur = time;
  }
  return out;
}

const regionIds = (art) => art.regions.map((r) => r.id);

/**
 * The storyboard. `m`: the material; `c`: the chosen concept (validated); `opts.videoId`.
 */
export function direct(m, c, { videoId, fps = 30 } = {}) {
  const art = m.data ?? ART[c.anchor.art];
  if (!art) throw new Error(`director: no anchor ${c.anchor.art}`);
  const L = layout(m);
  // the key word's time (a cut always starts on it)
  let keyTime = null;
  if (c.key_word) {
    const v = L.verses.find((x) => x.id === c.key_word.verse);
    if (v?.mode === "word") {
      let k = 0;
      for (const ch of v.chunks)
        for (const w of ch.words) {
          if (k === c.key_word.index) keyTime = { track: "qari", unit: v.id, index: k, time: w.start, text: w.text, key: true };
          k++;
        }
    }
  }
  const cs = cuts(L, keyTime);
  const regions = (c.anchor.regions ?? []).filter((r) => regionIds(art).includes(r));
  const visit = regions.length ? regions : regionIds(art);
  const groups = art.groups.map((g) => g.id);
  const nShots = cs.length;
  const drawShots = Math.max(1, Math.min(nShots - 2, Math.floor(nShots * 0.8)));
  const perShot = Math.max(1, Math.ceil(groups.length / drawShots));
  const queue = [...groups];
  const shots = [];
  let visitIdx = 0;
  for (let i = 0; i < cs.length; i++) {
    const start = cs[i].time;
    const endT = i + 1 < cs.length ? cs[i + 1].time : L.total;
    const dur = r3(endT - start);
    const mid = start + 0.05;
    const verse = L.verses.find((v) => mid >= v.from && mid < v.to);
    const cap = L.captions.find((x) => mid >= x.from && mid < x.to);
    const speaking = L.sounds.find((s) => mid >= s.at && mid < s.at + s.seconds);
    let text;
    if (start >= L.closeAt - 0.01) text = { layer: shots.length ? shots[shots.length - 1].text.layer : "title", ref: shots.length ? shots[shots.length - 1].text.ref : null, keyword: null };
    else if (cap && (!verse || speaking?.who === "narrator")) text = { layer: "caption", ref: cap.id, keyword: null };
    else if (verse) text = { layer: "verse", ref: verse.id, keyword: null };
    else if (i === 0 && L.verses[0] && m.template !== "word-choice" && m.template !== "distances" && m.template !== "only-counts") text = { layer: "verse", ref: L.verses[0].id, keyword: null };
    else text = { layer: "title", ref: null, keyword: null };
    const draw = [];
    for (let k = 0; k < (i < 3 ? Math.max(2, perShot) : perShot) && queue.length && i < drawShots + 1; k++) {
      const g = queue.shift();
      draw.push(g);
      // the flame comes with its lamp
      if (queue[0] && art.groups.find((x) => x.id === queue[0])?.gold) draw.push(queue.shift());
    }
    const ev = cs[i].ev;
    const isKey = Boolean(ev?.key);
    const last = i === cs.length - 1;
    let to;
    if (i === 0) to = { region: visit[0], scale: 1.0 };
    else if (last) to = { region: visit[0], scale: 1.0 };
    else if (isKey) to = { region: c.anchor.key_region && regionIds(art).includes(c.anchor.key_region) ? c.anchor.key_region : visit[Math.min(1, visit.length - 1)], scale: 1.35 };
    else if (draw.length) {
      // while it draws, the camera follows the group being drawn (or pushes in on the whole)
      const g = draw[0];
      const near = art.regions.find((r) => r.id === g || g.startsWith(r.id) || r.id.startsWith(g));
      to = near ? { region: near.id, scale: 1.15 } : { region: visit[0], scale: 1.0 + 0.06 * (i % 3) };
    } else {
      visitIdx = (visitIdx + 1) % visit.length;
      to = { region: visit[visitIdx], scale: visitIdx === 0 ? 1.05 : 1.25 };
    }
    const prev = shots[shots.length - 1]?.motion.to ?? { region: to.region, scale: to.scale * 0.94 };
    const camera = prev.region !== to.region ? "pan" : to.scale > prev.scale + 0.005 ? "push" : to.scale < prev.scale - 0.005 ? "pull" : "breathe";
    const lockText = ev?.text ? ev.text : "";
    const meaning = i === 0 ? `the hook: «${c.hook.text}» stands from the first frame while the ${art.id} begins to draw` : isKey ? `the key word is recited: the camera goes to ${to.region} and the word glows` : draw.length ? `${draw.join(", ")} of the ${art.id} draws on as the ${ev?.track ?? "lamp"} goes on` : last ? "the close: back to the first picture so the Reel loops" : `the camera ${camera === "pan" ? "travels to" : "settles on"} ${to.region} while the words keep lighting`;
    shots.push({
      n: i + 1,
      start: r3(start),
      dur,
      beat: 0,
      at_word: ev ? { track: ev.track, unit: ev.unit, index: ev.index, time: r3(ev.time), text: lockText, ...(ev.after ? { after: true } : {}), ...(ev.estimated ? { estimated: true } : {}) } : { track: "none", unit: "lead", index: 0, time: 0, text: "" },
      picture: { layer: "anchor", art: art.id, region: to.region, draw },
      motion: { camera, to, object: draw.map((g) => `draw:${g}`) },
      text: { ...text, keyword: isKey ? ev.text : null },
      sound: { who: speaking?.who ?? "silence", music: null, sfx: null },
      transition_out: "soft-fade",
      meaning,
    });
  }
  // transitions: the lamp's light rises into the next ayah; a new line carries the eye; a new region pushes through
  for (let i = 0; i + 1 < shots.length; i++) {
    const a = shots[i];
    const b = shots[i + 1];
    a.transition_out = b.text.layer === "verse" && a.text.layer === "verse" && a.text.ref !== b.text.ref ? "lamp-rise" : b.picture.draw.length ? "line-carry" : b.motion.to.region !== a.motion.to.region ? "push-through" : "soft-fade";
  }
  // beats: a new beat at every new text unit
  let beat = 0;
  shots.forEach((s, i) => {
    if (i > 0 && (s.text.ref !== shots[i - 1].text.ref || s.text.layer !== shots[i - 1].text.layer)) beat++;
    s.beat = beat;
  });
  const allDrawn = shots.findLast((s) => s.picture.draw.length);
  const keyShot = shots.find((s) => s.text.keyword);
  const cover = Math.min(L.total - 0.5, Math.max(allDrawn ? allDrawn.start + 1.5 : 0, keyShot ? keyShot.start + 0.6 : L.total * 0.6));
  const sb = {
    video_id: videoId ?? m.id,
    project: "siraj",
    style: "chiragh",
    template: m.template,
    lang: m.lang,
    idea_family: c.idea_family,
    concept: { one_line: c.one_line, hook: { type: c.hook.type, text: c.hook.text }, key_word: c.key_word ?? null, twist_at_beat: c.twist_at_beat ?? 0, ending: { type: c.ending?.type ?? "loop", links_to: "hook" }, new_because: c.new_because ?? [], by: c.by ?? "code" },
    fingerprint: fingerprintOf(m, c, shots),
    anchor: { art: art.id, inline: m.data ?? null, regions: visit },
    title: m.title,
    fps,
    total: L.total,
    sounds: L.sounds,
    verses: L.verses,
    captions: L.captions,
    shots,
    cover_at: r3(cover),
    badge: { from: r3(L.total - TIMING.badge - 0.2), to: r3(L.total - 0.2) },
    credits: m.credits,
    checks: { max_static_s: 2.5, min_shot_s: SHOT.min, max_shot_s: SHOT.max, sync_tolerance_s: 0.1 },
  };
  return sb;
}

/** The fingerprint a video leaves (storyboard-fa.md §4). */
export function fingerprintOf(m, c, shots) {
  const kw = c.key_word ? (m.verses.find((v) => v.id === c.key_word.verse)?.key ?? "") + `#${c.key_word.index}` : "";
  return {
    template: m.template,
    idea_family: c.idea_family,
    hook_type: c.hook.type,
    ending_type: c.ending?.type ?? "loop",
    anchor_asset: m.data?.id ?? c.anchor.art,
    objects: [...new Set((shots ?? []).flatMap((s) => s.picture.draw))].map((g) => `${m.data?.id ?? c.anchor.art}/${g}`),
    opening_shot: `${shots?.[0]?.text.layer ?? "verse"}+${c.anchor.regions?.[0] ?? "whole"}`,
    key: kw,
  };
}

/** The rules a storyboard must keep (the director's own check; the gate checks the video again). */
export function checkStoryboard(sb) {
  const problems = [];
  const art = sb.anchor.inline ?? ART[sb.anchor.art];
  sb.shots.forEach((s, i) => {
    if (s.dur > SHOT.max + 1e-6) problems.push(`shot ${s.n} is ${s.dur} s (over ${SHOT.max})`);
    if (s.dur < SHOT.min - 1e-6) problems.push(`shot ${s.n} is ${s.dur} s (under ${SHOT.min})`);
    if (i > 0 && Math.abs(s.start - (sb.shots[i - 1].start + sb.shots[i - 1].dur)) > 0.002) problems.push(`shot ${s.n} does not follow shot ${s.n - 1}`);
    if (!s.meaning) problems.push(`shot ${s.n} has no meaning`);
    if (!["soft-fade", "lamp-rise", "line-carry", "push-through"].includes(s.transition_out)) problems.push(`shot ${s.n}: transition ${s.transition_out}`);
    if (s.sound.music !== null || s.sound.sfx !== null) problems.push(`shot ${s.n}: music or an effect (Siraj has neither)`);
    if (!art.regions.some((r) => r.id === s.motion.to.region)) problems.push(`shot ${s.n}: no region ${s.motion.to.region}`);
  });
  const lastEnd = sb.shots.at(-1).start + sb.shots.at(-1).dur;
  if (Math.abs(lastEnd - sb.total) > 0.002) problems.push("the shots do not fill the video");
  if (art.figures !== false) problems.push("the anchor may draw a figure");
  // every verse's pieces give its stored text back
  return problems;
}

export { likeness };
