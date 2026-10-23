// The basmala on its own line, as Siraj's reader sets it (apps/web/src/lib/quranBasmala.ts,
// ported unchanged in behaviour). In the Tanzil text the basmala is stored at the start of
// ayah 1 of every surah except 1 (where it IS ayah 1) and 9 (which has none). This finds where
// that line ends inside the stored ayah by comparing with the stored text of ayah 1:1 of the
// same release, so the same characters can be shown in two lines. Nothing is written,
// changed or left out: `basmala + rest` is exactly the stored text. This file holds no text
// of the Quran.

const WITHOUT_LEADING_BASMALA: ReadonlySet<number> = new Set([1, 9]);
const withoutMarks = (word: string) => word.replace(/\p{M}+/gu, "");

export type BasmalaSplit = { basmala: string; rest: string };

export function splitLeadingBasmala(surahNumber: number, ayahNumber: number, text: string, opening: string | null | undefined): BasmalaSplit | null {
  if (!opening || ayahNumber !== 1 || WITHOUT_LEADING_BASMALA.has(surahNumber)) return null;
  const openingWords = opening.match(/\S+/gu) ?? [];
  if (openingWords.length === 0) return null;
  const words = [...text.matchAll(/\S+/gu)];
  if (words.length <= openingWords.length) return null;
  for (const [position, word] of openingWords.entries()) {
    if (withoutMarks(words[position]![0]) !== withoutMarks(word)) return null;
  }
  const cut = words[openingWords.length]!.index!;
  return { basmala: text.slice(0, cut), rest: text.slice(cut) };
}

/**
 * The stored text with its last word apart, so the seal at the end of the ayah can stay on
 * that word's line. `head + tail` is exactly the text given.
 */
export function lastWordApart(text: string): { head: string; tail: string } {
  const words = [...text.matchAll(/\S+/gu)];
  const last = words[words.length - 1];
  if (!last || last.index === undefined || last.index === 0) return { head: "", tail: text };
  return { head: text.slice(0, last.index), tail: text.slice(last.index) };
}
