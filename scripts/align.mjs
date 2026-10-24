// Pure helpers of scripts/qari.mjs: where to cut a reciter's chapter file into one clip per
// ayah, and when each word of Siraj's text is recited, from the Quran Foundation's word
// segments. Nothing here sees or holds a text; it gets word COUNTS only.

/** The well-formed segments [word, startMs, endMs] (QF also serves bare [word] entries) by word. */
export function segmentsByWord(segments) {
  const byWord = new Map();
  for (const s of segments ?? []) {
    if (!Array.isArray(s) || s.length < 3) continue;
    const [word, start, end] = s.map(Number);
    if (!Number.isInteger(word) || word < 1 || !Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const seen = byWord.get(word);
    byWord.set(word, seen ? { start: Math.min(seen.start, start), end: Math.max(seen.end, end) } : { start, end });
  }
  return byWord;
}

/** How many words the segments count, and whether they are exactly words 1..n. */
export function segmentWordCount(segments) {
  const byWord = segmentsByWord(segments);
  const n = byWord.size;
  let contiguous = true;
  for (let k = 1; k <= n; k++) if (!byWord.has(k)) contiguous = false;
  return { count: n, contiguous };
}

/**
 * One [fromMs, toMs] per verse, cut so that the clips follow each other without a gap or an
 * overlap: a clip ends where the next verse's first word begins (or at the verse's own end,
 * if that comes first); the last clip runs to the end of its last word or of its verse.
 */
export function cutPoints(timestamps, fileMs = Infinity) {
  const first = (t) => {
    const byWord = segmentsByWord(t.segments);
    return byWord.size ? Math.min(...[...byWord.values()].map((w) => w.start)) : t.timestamp_from;
  };
  const last = (t) => {
    const byWord = segmentsByWord(t.segments);
    return byWord.size ? Math.max(...[...byWord.values()].map((w) => w.end)) : t.timestamp_to;
  };
  return timestamps.map((t, i) => {
    const fromMs = i === 0 ? Math.max(0, Math.min(t.timestamp_from, first(t))) : Math.min(timestamps[i - 1].timestamp_to, first(t));
    const next = timestamps[i + 1];
    const toMs = next ? Math.min(t.timestamp_to, first(next)) : Math.min(fileMs, Math.max(t.timestamp_to, last(t)));
    return { verseKey: t.verse_key, fromMs, toMs };
  });
}

/**
 * The timing of each word in a clip (seconds from the clip's start). When Siraj's word count
 * and the segments' count differ, the text is left as it is and the whole verse is lit for the
 * whole clip instead ("verse" mode).
 */
export function alignClip({ sirajWords, segments, fromMs, toMs }) {
  const seconds = (toMs - fromMs) / 1000;
  const { count: qfWords, contiguous } = segmentWordCount(segments);
  if (sirajWords !== qfWords || !contiguous || qfWords === 0) {
    return { mode: "verse", qfWords, words: [{ start: 0, end: seconds }] };
  }
  const byWord = segmentsByWord(segments);
  const words = [];
  let floor = 0;
  for (let k = 1; k <= qfWords; k++) {
    const w = byWord.get(k);
    const start = Math.max(floor, Math.min(seconds, (w.start - fromMs) / 1000));
    const end = Math.max(start, Math.min(seconds, (w.end - fromMs) / 1000));
    words.push({ start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000 });
    floor = start;
  }
  return { mode: "word", qfWords, words };
}
