// The books beside the Quran that Siraj serves publicly (S3e, 2026-10-28): Nahj al-balagha with
// the Persian of the Makarem office, Mafatih Novin with its Persian, and Tafsir Nemooneh. Shared
// by the renderer (scripts/waiting.mjs) and the service, which keeps a copy of this file
// (src/content/books.ts: same rules, same results; keep them in step).
//
// Where the texts come from. The tafsir has a JSON route (/api/quran/<surah> lists a passage's
// exegesis records, /api/quran/exegesis/<id> serves one record with its SHA-256). Nahj al-balagha
// and the duas have none yet (their capability's `endpoint` is null in Siraj's registry); they are
// served by Siraj's public reader pages, which show a text only after Siraj's own loader has
// checked it against its stored hash (a line that fails is never shown). So these pages are read
// here: the verbatim elements only (`class="… verbatim"`), whose inner HTML must be plain text
// (no tag; only the character references React writes), decoded and kept exactly. The planner
// stores the SHA-256 of every string it planned with; the renderer reads the page again and
// fails with "the API's data changed since planning" when one differs.
//
// The fixed rules that choose a passage (never an AI's taste):
//   - Nahj al-balagha: the sayings in their numbers, one a week; a saying too long for its frame
//     or for a minute is skipped;
//   - Dua Kumayl: whole lines in order from where the last passage ended, as many as fit about
//     half a minute of the narrator; after the last line it starts again;
//   - the dhikr Story: the weekday's dua (Siraj's own «امروز» row, src/lib/duaToday.ts of the
//     siraj repo), one line a week in order from its second line, the next line short enough;
//   - Tafsir Nemooneh: the records in the mushaf's order; on the slides, the commentary from its
//     start in whole sentences, in order, nothing left out in between (a sentence is never cut,
//     reworded or summed up); an ellipsis after the last one when the commentary goes on.
// Nothing here holds or logs a text: tests use made-up words.

/** Nahj al-balagha with the Persian of the Makarem office: its work on Siraj, its volume, the part of the sayings. */
export const NAHJ = { work: "nahj-al-balagha-makarem", volume: 1, part: 3, first: 1, last: 480 };

/** Mafatih Novin on Siraj, Dua Kumayl in it, and the dua of each weekday (index = Date#getDay(): 0 = Sunday). */
export const MAFATIH = {
  work: "mafatih-novin-selected",
  kumayl: "21042",
  // Siraj's own registry of the days (siraj: apps/web/src/lib/duaToday.ts, from the publisher's table of contents)
  weekdays: ["21045", "21046", "21048", "21049", "21050", "21051", "21044"],
};

/** The weekday keys of the props (Saturday first, as the Persian week). */
export const WEEKDAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
/** A weekday key → Date#getDay(). */
export const dayIndex = (day) => ({ sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 })[day];

export const nahjPath = (n) => `/hadith/${NAHJ.work}/${NAHJ.volume}/${NAHJ.part}-${n}`;
export const duaPath = (key) => `/duas/${MAFATIH.work}/${key}`;
/** The exact address of a dua's line on Siraj (its anchor), for «the rest on siraj.ahura.cloud». */
export const duaLineUrl = (site, key, line) => `${site.replace(/\/+$/, "")}${duaPath(key)}#l-${line}`;
/** The surah page on Siraj that holds a passage's tafsir. */
export const quranPath = (surah) => `/quran/${surah}`;

/** How long a text may be and still stand calmly in its frame, and how long the narrator may read. */
export const FIT = {
  nahj: { arabic: 400, persian: 600, seconds: 40 },
  kumayl: { arabic: 420, persian: 330, lines: 5 },
  // line 1 of a weekday dua is its opening formula (the same in nearly all seven): the Story starts at line 2
  story: { arabic: 120, persian: 90, first: 2 },
  tafsir: { ayahs: 4, arabic: 320, translation: 460, slide: 460, slides: 3 },
};

/** About how many characters of Persian the narrator reads in a second (Aran, eleven_v4, speed 0.92). */
export const FA_CHARS_PER_SECOND = 11;
export const readSeconds = (persian) => persian.replace(/\s+/g, " ").trim().length / FA_CHARS_PER_SECOND;

/* ---------- the narrator's fixed lines (the service's; plain spoken Persian, S3d) ---------- */

/** The books and their author as the narrator says them, with the vowels that make them read right. */
export const FA_BOOK = { nahj: "نَهجُ‌البَلاغه", mafatih: "مَفاتیحِ نوین", tafsir: "تفسیرِ نمونه", kumayl: "دعای کُمِیل", makarem: "آیت‌اللّه ناصِرِ مَکارِمِ شیرازی" };

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const faDigits = (n) => String(n).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);

/**
 * The fixed line after a saying: the book and the saying's number said by name. Whose Persian it is
 * (the Makarem office's site) stands on the card only: the owner, 2026-10-29, the translator and the
 * qari are credited on screen, never spoken. `words` turns a number
 * into Persian words (spoken.mjs faWords; the service passes its own copy).
 */
export function nahjSourceLine(n, words) {
  return { id: "src", show: `نهج‌البلاغه، حکمت ${faDigits(n)} · ترجمهٔ فارسی از دفتر آیت‌الله مکارم شیرازی`, say: `از ${FA_BOOK.nahj}، حکمتِ ${words(n)}.` };
}

/** The fixed line after a Kumayl passage: where the rest is (the next line on Siraj, or the whole dua after its last line). */
export function kumaylRestLine(next) {
  return next
    ? { id: "rest", show: `ادامهٔ دعای کمیل از بند ${faDigits(next)} در سایت سراج`, say: `ادامهٔ ${FA_BOOK.kumayl} را در سایتِ سراج بخوانید. از ${FA_BOOK.mafatih}.` }
    : { id: "rest", show: "متن کامل دعای کمیل در سایت سراج", say: `متنِ کاملِ ${FA_BOOK.kumayl} را در سایتِ سراج بخوانید. از ${FA_BOOK.mafatih}.` };
}

/* ---------- reading the reader pages ---------- */

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** The character references React writes into text, decoded; anything else is refused (the page changed). */
export function decodeText(html) {
  if (/[<>]/.test(html)) throw new Error("a verbatim element holds markup");
  return html.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    if (!(e in NAMED)) throw new Error(`an unknown character reference ${m}`);
    return NAMED[e];
  });
}

/** Every `<p class="<cls> verbatim" lang="…">…</p>` of a page, in order, decoded. */
function verbatim(html, cls) {
  const out = [];
  const re = new RegExp(`<p class="${cls} verbatim"[^>]*>([\\s\\S]*?)</p>`, "g");
  for (const m of html.matchAll(re)) out.push(decodeText(m[1]));
  return out;
}

/** The release keys a page names (the `hash` fields of its attribution and the record links). */
function releaseKeys(html) {
  return [...new Set([...html.matchAll(/<bdi class="hash">([a-z0-9][a-z0-9.-]{6,120})<\/bdi>/g)].map((m) => m[1]))];
}

/**
 * A saying's page of the hadith reader: its records (the Arabic and the Persian under it, each
 * verbatim), the record's own address at the publisher, and the release it is read from.
 */
export function readHadithPage(html) {
  const arabic = verbatim(html, "hadith__text");
  const persian = verbatim(html, "hadith__translation");
  if (!arabic.length) throw new Error("the page shows no record");
  if (arabic.length !== persian.length) throw new Error("a record of the page has no Persian");
  // the record's own page on Siraj: /hadith/<release>%3A<record key>
  const rec = [...html.matchAll(/href="\/hadith\/([a-z0-9-]+)%3A([a-z0-9-]+)%3A(\d+)"/g)];
  if (rec.length !== arabic.length) throw new Error("the page does not name each record's release");
  const releaseKey = rec[0][1];
  if (rec.some((m) => m[1] !== releaseKey)) throw new Error("the records come from two releases");
  const sources = [...html.matchAll(/<div class="hadith__links"><a class="text-link" href="(https:\/\/[^"]+)"/g)].map((m) => decodeText(m[1]));
  return { releaseKey, records: arabic.map((a, i) => ({ arabic: a, persian: persian[i], sourceUrl: sources[i] ?? null, record: `${rec[i][2]}:${rec[i][3]}` })) };
}

/** A dua's page of the duas reader: its numbered lines (Arabic and Persian, verbatim) and its release. */
export function readDuaPage(html) {
  const numbers = [...html.matchAll(/<li id="l-(\d+)" class="dua-line">/g)].map((m) => Number(m[1]));
  const arabic = verbatim(html, "dua-line__text");
  const persian = verbatim(html, "dua-line__translation");
  if (!numbers.length || numbers.length !== arabic.length) throw new Error("the page's lines and their texts differ");
  if (persian.length !== arabic.length) throw new Error("a line of the page has no Persian");
  numbers.forEach((n, i) => {
    if (n !== i + 1) throw new Error("the page's lines are not numbered in order");
  });
  // the collection's own release: the key beside «کد مجموعه» (one of the `hash` fields)
  const keys = releaseKeys(html).filter((k) => /mafatih/.test(k));
  if (keys.length !== 1) throw new Error("the page does not name one release");
  const source = html.match(/<a class="text-link" href="(https:\/\/mafatih\.makarem\.ir[^"]*)"/);
  return { releaseKey: keys[0], sourceUrl: source ? decodeText(source[1]) : null, lines: arabic.map((a, i) => ({ number: numbers[i], arabic: a, persian: persian[i] })) };
}

/* ---------- the narrator's lines of a served translation ---------- */

/**
 * The narrator's lines of a served Persian text: its own lines (split at its line feeds), each
 * trimmed, at most `most` (the rest joined to the last with a space). Their words, joined, are
 * the served text's words in order: nothing is added, left out or changed.
 */
export function trParts(persian, most = 4) {
  const parts = persian
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (parts.length <= most) return parts;
  return [...parts.slice(0, most - 1), parts.slice(most - 1).join(" ")];
}

/** The words of a text (for the check that the lines are the served text). */
export const wordsOf = (s) => s.split(/\s+/).filter(Boolean);

/* ---------- the fixed rules that choose a passage ---------- */

/** Whether a saying fits its frame and a minute. */
export function nahjFits(r) {
  const f = FIT.nahj;
  return r.arabic.trim().length > 0 && r.arabic.length <= f.arabic && r.persian.trim().length > 0 && r.persian.length <= f.persian && readSeconds(r.persian) <= f.seconds;
}

/**
 * Dua Kumayl's passage of the week: whole lines in order from line `from`, as many as fit the
 * narrator's half-minute and the frame (at least one line); null when line `from` does not exist
 * or is too long alone (the planner then starts at the next line).
 */
export function duaPassage(lines, from, fit = FIT.kumayl) {
  const start = lines.findIndex((l) => l.number === from);
  if (start < 0) return null;
  let persian = 0;
  let arabic = 0;
  let to = null;
  for (let i = start; i < lines.length && i - start < fit.lines; i++) {
    const l = lines[i];
    const p = persian + l.persian.trim().length;
    const a = arabic + l.arabic.trim().length;
    if (p > fit.persian || a > fit.arabic) break;
    persian = p;
    arabic = a;
    to = l.number;
  }
  return to === null ? null : { from, to };
}

/**
 * The dhikr Story's line: the first line from `from` on (in order, then again from line
 * `fit.first`) short enough for a Story; the dua's opening line is never taken. Null when none is.
 */
export function storyLine(lines, from, fit = FIT.story) {
  const ok = (l) => l.number >= fit.first && l.arabic.trim().length > 0 && l.arabic.trim().length <= fit.arabic && l.persian.trim().length > 0 && l.persian.trim().length <= fit.persian;
  const pool = lines.filter((l) => l.number >= fit.first);
  if (!pool.length) return null;
  const at = pool.findIndex((l) => l.number >= from);
  const start = at < 0 ? 0 : at;
  for (let k = 0; k < pool.length; k++) {
    const l = pool[(start + k) % pool.length];
    if (ok(l)) return l.number;
  }
  return null;
}

/* ---------- Tafsir Nemooneh: whole sentences on the slides ---------- */

const HEADING = /^[^\s:]{2,12}:$/;

/**
 * Where the commentary of a record begins (its paragraph index): after the record's own two
 * headings when it has them (the ayahs, then their translation, then the commentary), at the top
 * when it has none; null when the structure is unclear (one heading only).
 */
export function commentaryStart(paragraphs) {
  const heads = paragraphs.slice(0, 30).flatMap((p, i) => (HEADING.test(p) ? [i] : []));
  if (heads.length >= 2) return heads[1] + 1;
  return heads.length === 0 ? 0 : null;
}

/**
 * A paragraph's whole sentences, split only after a full stop (with what closes it: a closing
 * quote, a bracket, a footnote mark), outside quotes and brackets. «!» and «؟» do not end a
 * sentence here: in this book they often stand inside reported speech that goes on.
 */
export function sentencesOf(paragraph) {
  const out = [];
  let depth = 0;
  let cur = "";
  const chars = [...paragraph];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    cur += c;
    if (c === "«" || c === "(" || c === "[") depth++;
    else if ((c === "»" || c === ")" || c === "]") && depth > 0) depth--;
    if (depth === 0 && c === ".") {
      // what closes the sentence stays with it: more marks, a closing quote, a footnote mark «(2)»
      for (;;) {
        const rest = chars.slice(i + 1).join("");
        const m = rest.match(/^([.!؟?»"]+|\(\s*[0-9۰-۹]+\s*\))/);
        if (!m) break;
        cur += m[0];
        i += [...m[0]].length;
      }
      if (i + 1 >= chars.length || /\s/.test(chars[i + 1])) {
        out.push(cur.trim());
        cur = "";
      }
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** A paragraph that ends a sentence (or opens a list with a colon), whatever closes it after the mark. */
const isWhole = (p) => /[.!؟?:]["»)\]]*\s*(\(\s*[0-9۰-۹]+\s*\))?$/.test(p);
/** The «* * *» between the commentary of one ayah and the next: a break, not text. */
const isBreak = (p) => /^[*\s]+$/.test(p);
/** A title: short and without a sentence end. */
const isTitle = (p) => !isBreak(p) && p.length <= 60 && !isWhole(p);

/**
 * The slides of a record (Tafsir Nemooneh, owner's rule: whole sentences exactly as served,
 * never summed up, cut inside a sentence, reworded or explained). From the start of the
 * commentary (a title before the first prose paragraph is passed over), in order: a paragraph
 * that fits a slide is one piece; a longer one is cut into runs of its whole sentences that fit.
 * Each slide takes the next pieces while they fit. It stops at the first piece that cannot stand
 * on a slide alone (a sentence too long), at a title or a break, or when the slides are full;
 * the last slide then ends with an ellipsis (the commentary goes on). Nothing in between is ever
 * left out. `slides`: per slide its pieces { text, paragraph }. Null when the record's structure
 * is unclear or it does not fill `fit.slides` slides.
 */
export function tafsirSlides(text, fit = FIT.tafsir) {
  const paragraphs = text
    .split(/\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const start = commentaryStart(paragraphs);
  if (start === null) return null;
  let i = start;
  while (i < paragraphs.length && (isTitle(paragraphs[i]) || isBreak(paragraphs[i]))) i++;
  const pieces = [];
  let stopped = false;
  for (; i < paragraphs.length && !stopped; i++) {
    // the break between two ayahs' commentary is passed over (it holds no text); a new title ends the passage
    if (isBreak(paragraphs[i])) continue;
    if (isTitle(paragraphs[i])) break;
    // a sentence the source breaks over paragraphs (a list after «:», a quoted line) stays one piece
    let j = i;
    while (j < paragraphs.length - 1 && !isWhole(paragraphs[j]) && !isTitle(paragraphs[j + 1]) && !isBreak(paragraphs[j + 1])) j++;
    if (!isWhole(paragraphs[j])) break;
    const p = paragraphs.slice(i, j + 1).join("\n");
    if (j > i) {
      if (p.length > fit.slide) break;
      pieces.push({ text: p, paragraph: i });
      i = j;
      continue;
    }
    if (p.length <= fit.slide) {
      pieces.push({ text: p, paragraph: i });
      continue;
    }
    let run = "";
    for (const s of sentencesOf(p)) {
      if (s.length > fit.slide) {
        // the whole sentences before it still stand; nothing after it is shown
        if (run) pieces.push({ text: run, paragraph: i });
        run = "";
        stopped = true;
        break;
      }
      if (run && run.length + 1 + s.length > fit.slide) {
        pieces.push({ text: run, paragraph: i });
        run = "";
      }
      run = run ? `${run} ${s}` : s;
    }
    // a paragraph's last run is whole only when the paragraph ended with a full sentence
    if (run && !stopped) pieces.push({ text: run, paragraph: i });
  }
  const slides = [];
  let cur = [];
  let len = 0;
  let used = 0;
  for (const x of pieces) {
    const add = x.text.length + (cur.length ? 1 : 0);
    if (cur.length && len + add > fit.slide) {
      slides.push(cur);
      cur = [];
      len = 0;
      if (slides.length >= fit.slides) break;
    }
    cur.push(x);
    len += cur.length > 1 ? add : x.text.length;
    used++;
  }
  if (cur.length && slides.length < fit.slides) slides.push(cur);
  if (slides.length < fit.slides) return null;
  const more = used < pieces.length || stopped || i < paragraphs.length;
  return { slides, more, pieces: used, commentary: start };
}

/** The text of one slide as it stands: its pieces in order, a new paragraph on a new line; an ellipsis after the last when the commentary goes on. */
export function slideText(pieces, ellipsis = false) {
  let out = "";
  let prev = null;
  for (const x of pieces) {
    if (out) out += x.paragraph !== prev ? "\n" : " ";
    out += x.text;
    prev = x.paragraph;
  }
  return ellipsis ? `${out} …` : out;
}
