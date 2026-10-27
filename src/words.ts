// The stored text of an ayah cut at its spaces, so that each word can be lit while the qari
// recites it. Nothing is changed, dropped or added: joining the `text` of every part gives the
// stored text back exactly. This file holds no text of the Quran, and it imports nothing, so
// that the build scripts can use it too (node --experimental-strip-types).

export type Part = {
  /** A piece of the stored text, exactly as stored. */
  text: string;
  /** The word (0-based) this piece belongs to; null for the spaces between words. */
  word: number | null;
};

/**
 * The counting rule: a word is a space-separated piece with at least one letter. A piece
 * without a letter (a pause mark standing alone) is not counted and is lit with the word
 * before it.
 */
export function wordParts(text: string): { parts: Part[]; count: number } {
  const pieces = text.split(/(\s+)/u).filter((piece) => piece.length > 0);
  let count = 0;
  const parts = pieces.map((piece): Part => {
    if (/^\s+$/u.test(piece)) return { text: piece, word: null };
    if (/\p{L}/u.test(piece) || count === 0) count += 1;
    return { text: piece, word: count - 1 };
  });
  return { parts, count };
}

/** The number of words by the rule above. */
export const wordCount = (text: string) => wordParts(text).count;

/**
 * A translation line cut at its spaces, for lighting each word as the narrator says it. Here
 * every space-separated piece is a word (as the service counts the ElevenLabs word timings);
 * joining the `text` of every part gives the line back exactly.
 */
export function pieces(text: string): Part[] {
  let count = 0;
  return text
    .split(/(\s+)/u)
    .filter((piece) => piece.length > 0)
    .map((piece): Part => (/^\s+$/u.test(piece) ? { text: piece, word: null } : { text: piece, word: count++ }));
}
