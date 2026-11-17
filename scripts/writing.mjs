// An owner writing on Siraj (siraj ADR-039), read for its draft video (fa-writing): the answer of
// /api/writings/<slug> checked, the served strings in the order of the service's expect.textHashes,
// the narrator's lines, the place of each passage and the sources card. The service's copy is
// src/content/writing.ts (same rules, same results; keep them in step). Nothing here holds or logs
// a text; the tests use made-up words.
import { check, sha256 } from "./lib.mjs";
import { spoken } from "./spoken.mjs";

export const WRITING_SLUG = /^w-\d{8}-[0-9a-f]{6}$/;
export const OWNER_ONLY_LABEL = "فقط مالک سایت بازبینی کرده است";
export const WRITING_LIMITS = { sections: 5, ayahs: 5 };

const isStr = (v, max = 20_000) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const faNum = (n) => String(n).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);

/** A served credit or name with «·» and «|» turned into «،» (the owner's rule; the words stay). */
export const noBars = (s) => String(s).replace(/\s*[·|]\s*/g, "، ").trim();

/** The approved prose as the narrator says it: numbers in words, a pause for a colon, semicolon or bracket. */
export function sayProse(text) {
  return spoken(text, "fa")
    .replace(/\s*[:：]\s*/g, "، ")
    .replace(/\s*[;؛]\s*/g, ". ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function passageOf(p, i) {
  const what = `writing: the passage of section ${i + 1}`;
  check(p && typeof p === "object", what);
  if (p.kind === "quran") {
    check(isInt(p.surahNumber, 1, 114) && isInt(p.fromAyah, 1, 286) && isInt(p.toAyah, p.fromAyah, 286), `${what}: surah and ayahs`);
    const n = p.toAyah - p.fromAyah + 1;
    check(n <= WRITING_LIMITS.ayahs && Array.isArray(p.ayahs) && p.ayahs.length === n, `${what}: one to ${WRITING_LIMITS.ayahs} ayahs in a row`);
    p.ayahs.forEach((a, k) => check(a && a.ayahNumber === p.fromAyah + k && isStr(a.text) && isStr(a.translation), `${what}: ayah ${k + 1}`));
    check(isStr(p.translatorName, 200) && isStr(p.textCredit, 2000), `${what}: its credits`);
    const name = isStr(p.surahName, 80) ? `سورهٔ ${p.surahName}` : `سورهٔ ${faNum(p.surahNumber)}`;
    const verses = p.fromAyah === p.toAyah ? `آیهٔ ${faNum(p.fromAyah)}` : `آیه‌های ${faNum(p.fromAyah)} تا ${faNum(p.toAyah)}`;
    return {
      kind: "quran",
      ref: `${name}، ${verses}`,
      lines: p.ayahs.map((a) => ({ number: a.ayahNumber, arabic: a.text, persian: a.translation })),
      translator: noBars(p.translatorName),
      credit: noBars(p.textCredit),
      attributedTo: null,
      assessments: [],
    };
  }
  check(p.kind === "hadith", `${what}: a verse or a narration`);
  check(isStr(p.matn) && isStr(p.translation) && isStr(p.locator, 400) && isStr(p.sourceTitle, 300) && isStr(p.textCredit, 2000), `${what}: the narration`);
  return {
    kind: "hadith",
    ref: noBars(`${p.sourceTitle}، ${p.locator}`),
    lines: [{ number: 1, arabic: p.matn, persian: p.translation }],
    translator: null,
    credit: noBars(p.textCredit),
    attributedTo: isStr(p.attributedTo, 300) ? noBars(p.attributedTo) : null,
    assessments: (Array.isArray(p.assessments) ? p.assessments : []).filter((a) => a && isStr(a.assessorName, 200) && isStr(a.gradeLabel, 200)).map((a) => noBars(`ارزیابی ثبت‌شده از ${a.assessorName}: ${a.gradeLabel}`)),
  };
}

/** The writing of one answer, checked (its trust block, its slug, its shape); throws CheckError otherwise. */
export function readWriting(body, slug) {
  check(body?.service === "siraj-public-writing", "writing: service");
  const t = body.trust ?? {};
  check(t.reviewed_by === "site_owner_only" && t.texts_verbatim_from_gated_corpus === true && t.ai_can_publish === false, "writing: the API's guarantees");
  const w = body.writing;
  check(w && w.slug === slug && isStr(w.title, 120), "writing: its slug and title");
  check(Array.isArray(w.sections) && w.sections.length >= 2 && w.sections.length <= WRITING_LIMITS.sections, `writing: two to ${WRITING_LIMITS.sections} sections`);
  const sections = w.sections.map((s, i) => {
    check(s && isStr(s.lead, 400), `writing: the lead of section ${i + 1}`);
    return { lead: s.lead, passage: passageOf(s.passage, i) };
  });
  return { slug, title: w.title, sections };
}

/** The served strings in the order of expect.textHashes: the title, then each section's lead, Arabic and Persian. */
export function servedTexts(w) {
  const out = [{ locator: `writing:${w.slug}:title`, textHashSha256: sha256(w.title) }];
  w.sections.forEach((s, i) => {
    out.push({ locator: `writing:${w.slug}:${i + 1}:lead`, textHashSha256: sha256(s.lead) });
    s.passage.lines.forEach((l, j) => {
      out.push({ locator: `writing:${w.slug}:${i + 1}:${j + 1}:ar`, textHashSha256: sha256(l.arabic) });
      out.push({ locator: `writing:${w.slug}:${i + 1}:${j + 1}:fa`, textHashSha256: sha256(l.persian) });
    });
  });
  return out;
}

/** The narrator's lines: the title and the leads in spoken Persian, the served Persian as it is. */
export function writingNarration(w) {
  const out = [{ id: "title", show: w.title, say: sayProse(w.title) }];
  w.sections.forEach((s, i) => {
    out.push({ id: `l${i + 1}`, show: s.lead, say: sayProse(s.lead) });
    s.passage.lines.forEach((l, j) => out.push({ id: `t${i + 1}_${j + 1}`, show: l.persian, say: l.persian }));
  });
  return out;
}

/** The sources card: every passage's exact place and its credits. */
export function sourceLines(w) {
  const out = [];
  w.sections.forEach((s, i) => {
    const p = s.passage;
    const n = faNum(i + 1);
    if (p.kind === "quran") out.push(`${n}. ${p.ref}. ترجمه از ${p.translator}.`);
    else {
      out.push(`${n}. ${p.ref}${p.attributedTo ? `، منسوب به ${p.attributedTo}` : ""}.`);
      out.push(...p.assessments);
    }
  });
  return [...out, ...new Set(w.sections.map((s) => s.passage.credit))];
}
