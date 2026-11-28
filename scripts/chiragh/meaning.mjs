// «چراغ»: the drawing says what the text says (owner, 28 Nov: «Siraj's videos and animations should
// have meaning»). One motif per text, chosen from the text itself, never a decoration by default:
//   1. a table of surahs and passages whose key image was checked against the translation and the
//      usual tafsir sense (the image the text itself names; nothing the text does not say);
//   2. else the key images named in the translation (en, fa) or the Arabic, counted per motif;
//   3. else the fallback: the mishkat (Siraj's lamp), said to be a fallback.
// The motifs are nature, sky, architecture and abstract marks only (src/chiragh/art.ts): no prophet,
// imam, person, face or animal, and never an image for God.
import { ART, bare } from "../../src/chiragh/art.ts";

export const FALLBACK = "mishkat";

/**
 * Checked passages: surah → { art, why } or [{ from, to, art, why }] for a part of a long surah.
 * `why` is the text's own image (internal, never shown).
 */
export const PASSAGES = {
  1: { art: "light", why: "«guide us on the straight path»: guidance as light over the land" },
  24: [{ from: 35, to: 35, art: "mishkat", why: "the Light verse names the niche, the glass, the lamp and the olive tree" }],
  55: [{ from: 7, to: 9, art: "balance", why: "«He set up the balance … do not transgress in the balance»" }],
  2: [
    { from: 261, to: 261, art: "seed", why: "a grain that grows seven ears, a hundred grains in each" },
    { from: 164, to: 164, art: "rain", why: "the water sent down from the sky that revives the dead earth" },
    { from: 153, to: 157, art: "seed", why: "patience: seek help through patience and prayer, the reward that grows" },
  ],
  91: { art: "sky", why: "the oaths by the sun, the moon, the day and the night" },
  92: { art: "sky", why: "by the night when it covers, by the day when it shines" },
  93: { art: "sky", why: "by the morning light and the night when still" },
  97: { art: "sky", why: "the Night of Decree, peace until the rise of dawn" },
  99: { art: "balance", why: "an atom's weight of good or of evil will be seen: the weighing of deeds" },
  101: { art: "balance", why: "whose scales are heavy, whose scales are light" },
  103: { art: "sky", why: "by time (al-asr): the day turning, and the counsel of truth and patience" },
  105: { art: "stones", why: "the army of the elephant, the flocks sent, the stones of baked clay, left like eaten straw" },
  106: { art: "oasis", why: "the journeys of winter and summer, fed against hunger, safe from fear" },
  112: { art: "rosette", why: "oneness: one centre and nothing like it (abstract only, never an image for God)" },
  113: { art: "refuge", why: "refuge in the Lord of daybreak from the dark and its evils" },
  114: { art: "refuge", why: "refuge from the whisperer who withdraws (al-khannas): the whispers curl away from the light" },
};

/** Key images as the texts name them (English, Persian, Arabic roots in the text). */
export const LEXICON = {
  light: [/\blight\b|\bguid(e|ance)\b|\bshin(e|ing)\b|\billumin/i, /نور|روشن|هدایت|تابان/, /نُ?ورِ?|يَهْدِ|هُدًى/],
  rain: [/\brain\b|\bwater\b|\bdead (earth|land)\b|\brevive|\bspring(s)?\b|\bclouds?\b/i, /باران|آب|زمین مرده|زنده کرد|ابر|چشمه/, /مَاءً?|الْمَاءَ|غَيْث|السَّحَاب/],
  seed: [/\bpatien(ce|t)\b|\bseed\b|\bgrain\b|\bears?\b of|\bgrow(s|th)?\b|\bplant/i, /صبر|شکیبا|دانه|خوشه|رویید|بذر/, /الصَّبْر|صَابِر|حَبَّة|سَنَابِل/],
  sky: [/\bnight\b|\bday\b|\bsun\b|\bmoon\b|\bdawn\b|\bmorning\b|\btime\b/i, /شب|روز|خورشید|ماه|سپیده|صبح|زمان/, /اللَّيْل|النَّهَار|الشَّمْس|الْقَمَر|الْفَجْر|الضُّحَى|الْعَصْر/],
  balance: [/\bscales?\b|\bbalance\b|\bjust(ice)?\b|\bweigh|\bmeasure\b|\breckoning\b/i, /ترازو|میزان|عدل|عدالت|سنجش|حساب/, /الْمِيزَان|مَوَازِين|الْقِسْط|مِثْقَال/],
  refuge: [/\brefuge\b|\bprotect|\bshelter\b|\bwhisper|\bevil\b/i, /پناه|وسوسه|شرّ|شر |نگهدار/, /أَعُوذُ|الْوَسْوَاس|شَرِّ/],
  stones: [/\belephant\b|\bstones?\b|\bbaked clay\b|\bstraw\b/i, /فیل|سنگ|سجّیل|کاه/, /الْفِيل|حِجَارَة|سِجِّيل|كَعَصْف/],
  olive: [/\bolive\b|\btree\b|\bgood word\b/i, /زیتون|درخت|سخن پاک/, /الزَّيْتُون|شَجَرَة/],
  oasis: [/\bjourney\b|\bpath\b|\broad\b|\bmigrat|\bdesert\b/i, /سفر|راه|کوچ|بیابان|هجرت/, /رِحْلَة|سَبِيل|هَاجَرُوا/],
  night: [/\bstars?\b|\bconstellation/i, /ستاره|ستارگان/, /النُّجُوم|الْبُرُوج/],
};

const strip = (s) => bare(String(s ?? ""));

/** The motif for a material `m` (its verses: surah, ayah, text, translation). */
export function chooseMotif(m) {
  if (m.data) return { art: m.data.id, why: "a data drawing of the text itself", sure: true, by: "data" };
  const verses = (m.verses ?? []).filter((v) => v.ayah !== null);
  const surah = verses[0]?.surah ?? 0;
  const from = Math.min(...verses.map((v) => v.ayah ?? 0));
  const to = Math.max(...verses.map((v) => v.ayah ?? 0));
  const p = PASSAGES[surah];
  // a passage counts when the video's verses overlap it
  const hit = Array.isArray(p) ? p.find((x) => from <= x.to && to >= x.from) : p;
  if (hit && ART[hit.art]) return { art: hit.art, why: hit.why, sure: true, by: "passage" };
  // the key images the text names: counted over the translation and the Arabic, per motif
  const text = verses.map((v) => `${strip(v.translation)} ${strip(v.text)}`).join(" ") + " " + (m.lines ?? []).map((l) => strip(l.text)).join(" ");
  const counts = Object.entries(LEXICON)
    .map(([art, res]) => [art, res.reduce((n, re) => n + (text.match(new RegExp(bare(re.source), "giu")) ?? []).length, 0)])
    .filter(([art, n]) => n > 0 && ART[art])
    .sort((a, b) => b[1] - a[1]);
  if (counts.length && counts[0][1] >= 2) return { art: counts[0][0], why: `the text names it ${counts[0][1]}× (${counts.map(([a, n]) => `${a} ${n}`).join(", ")})`, sure: counts[0][1] >= 3 && (counts[1]?.[1] ?? 0) < counts[0][1], by: "words" };
  if (counts.length) return { art: counts[0][0], why: `the text names it once (${counts[0][0]})`, sure: false, by: "words" };
  return { art: FALLBACK, why: "no key image the library can show: Siraj's lamp, as a fallback", sure: false, by: "fallback" };
}
