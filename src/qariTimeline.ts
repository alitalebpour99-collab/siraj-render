// When everything happens in a qari preview, in frames at 30 fps. The qari and the narrator
// never overlap: in each card the qari recites (the basmala first, before ayah 1), then the
// translation fades in and the narrator reads it, then a short breath and a cross-fade.
// Only type imports, so that scripts/render.mjs can use the same timeline
// (node --experimental-strip-types) to print when each word is lit.
import type { QariProps } from "./props";

export const QFPS = 30;
const fr = (seconds: number) => Math.ceil(seconds * QFPS);

export const QT = {
  /** cross-fade between cards */
  XF: 18,
  /** the narrator begins this far into the intro card */
  INTRO_VOICE: 10,
  INTRO_TAIL: 14,
  INTRO_MIN: 75,
  /** the qari begins this far into a card, once the Arabic has faded in */
  QARI_AT: 18,
  /** between the basmala and ayah 1 */
  BASMALA_GAP: 6,
  /** between the end of the recitation and the translation */
  TR_GAP: 8,
  TR_IN: 14,
  /** the narrator begins this long after the translation begins to fade in */
  NARR_AFTER_TR: 8,
  /** after the narrator, before the card begins to fade out */
  BREATH: 4,
  OUTRO_VOICE: 14,
  OUTRO_TAIL: 26,
  OUTRO_MIN: 90,
};

export type QariCard = {
  index: number;
  ayah: number;
  /** absolute frame where the card begins (its fade-in overlaps the card before) */
  from: number;
  dur: number;
  /** the rest are frames from the card's start */
  basmalaAt: number | null;
  verseAt: number;
  qariEnd: number;
  trAt: number;
  narrAt: number;
  narrEnd: number;
};

export type QariTimeline = {
  intro: { from: number; dur: number; narrAt: number };
  cards: QariCard[];
  outro: { from: number; dur: number; narrAt: number };
  total: number;
};

export function qariTimeline(p: Pick<QariProps, "ayahs" | "qari">): QariTimeline {
  const lines = new Map((p.qari?.narration?.lines ?? []).map((l) => [l.id, l]));
  const say = (id: string, fallback: number) => {
    const line = lines.get(id);
    return line ? fr(line.seconds) : fallback;
  };
  const introDur = Math.max(QT.INTRO_MIN, QT.INTRO_VOICE + say("intro", 60) + QT.INTRO_TAIL);
  let at = introDur - QT.XF;
  const cards = p.ayahs.map((a, index): QariCard => {
    const clip = p.qari?.verses?.find((v) => v.ayah === a.ayahNumber);
    const basmala = index === 0 ? (p.qari?.basmala ?? null) : null;
    const basmalaAt = basmala ? QT.QARI_AT : null;
    const verseAt = basmala ? QT.QARI_AT + fr(basmala.seconds) + QT.BASMALA_GAP : QT.QARI_AT;
    const qariEnd = verseAt + (clip ? fr(clip.seconds) : 60);
    const trAt = qariEnd + QT.TR_GAP;
    const narrAt = trAt + QT.NARR_AFTER_TR;
    const narrEnd = narrAt + say(`a${a.ayahNumber}`, 75);
    // the last XF frames of a card are its cross-fade into the next one
    const dur = narrEnd + QT.BREATH + QT.XF;
    const card = { index, ayah: a.ayahNumber, from: at, dur, basmalaAt, verseAt, qariEnd, trAt, narrAt, narrEnd };
    at += dur - QT.XF;
    return card;
  });
  const outroDur = Math.max(QT.OUTRO_MIN, QT.OUTRO_VOICE + say("outro", 90) + QT.OUTRO_TAIL);
  return {
    intro: { from: 0, dur: introDur, narrAt: QT.INTRO_VOICE },
    cards,
    outro: { from: at, dur: outroDur, narrAt: QT.OUTRO_VOICE },
    total: at + outroDur,
  };
}

/** Absolute seconds of every word of every clip, for the log and the source record (no text). */
export function wordTable(p: Pick<QariProps, "ayahs" | "qari">) {
  const t = qariTimeline(p);
  const rows: { clip: string; mode: string; word: number; start: number; end: number }[] = [];
  for (const card of t.cards) {
    const pieces: { clip: QariProps["qari"]["basmala"]; at: number | null }[] = [
      { clip: card.index === 0 ? p.qari.basmala : null, at: card.basmalaAt },
      { clip: p.qari.verses.find((v) => v.ayah === card.ayah) ?? null, at: card.verseAt },
    ];
    for (const { clip, at } of pieces) {
      if (!clip || at === null) continue;
      const zero = (card.from + at) / QFPS;
      clip.words.forEach((w, i) =>
        rows.push({ clip: clip.verseKey, mode: clip.mode, word: i + 1, start: Math.round((zero + w.start) * 1000) / 1000, end: Math.round((zero + w.end) * 1000) / 1000 }),
      );
    }
  }
  return rows;
}
