// node --test scripts/books.test.mjs
// The rules that choose a passage of a book and the reader of Siraj's pages (S3e). Placeholders
// only: made-up words in the shape of the texts, never a text of a book.
import assert from "node:assert/strict";
import test from "node:test";
import { readingProblems, faWords } from "./spoken.mjs";
import { FIT, MAFATIH, kumaylRestLine, nahjSourceLine, commentaryStart, dayIndex, decodeText, duaLineUrl, duaPassage, duaPath, nahjFits, nahjPath, readDuaPage, readHadithPage, sentencesOf, slideText, storyLine, tafsirSlides, trParts } from "./books.mjs";

const words = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`).join(" ");

test("the places on Siraj", () => {
  assert.equal(nahjPath(12), "/hadith/nahj-al-balagha-makarem/1/3-12");
  assert.equal(duaPath(MAFATIH.kumayl), "/duas/mafatih-novin-selected/21042");
  assert.equal(duaLineUrl("https://siraj.ahura.cloud/", MAFATIH.kumayl, 4), "https://siraj.ahura.cloud/duas/mafatih-novin-selected/21042#l-4");
  // Siraj's own row of the days: Sunday … Saturday
  assert.equal(MAFATIH.weekdays.length, 7);
  assert.equal(new Set(MAFATIH.weekdays).size, 7);
  assert.equal(MAFATIH.weekdays[dayIndex("sat")], "21044");
});

test("the character references React writes are decoded; markup and unknown references are refused", () => {
  assert.equal(decodeText("a &amp; b &lt;c&gt; &quot;d&quot; &#x27;e&#39; &#1601;"), `a & b <c> "d" 'e' ${String.fromCodePoint(1601)}`);
  assert.throws(() => decodeText("a <b>c</b>"));
  assert.throws(() => decodeText("a &zwnj; b"));
});

test("a hadith page: its records, their release and their addresses", () => {
  const html = `<p class="hadith__text verbatim" lang="ar"> a1\na2</p><p class="hadith__translation verbatim" lang="fa">f1:\nf2</p><div class="hadith__links"><a class="text-link" href="https://example.org/w/9" rel="x">s</a><a class="text-link" href="/hadith/rel-key-1%3Arec%3A9">r</a></div>`;
  const pg = readHadithPage(html);
  assert.equal(pg.releaseKey, "rel-key-1");
  assert.deepEqual(pg.records, [{ arabic: " a1\na2", persian: "f1:\nf2", sourceUrl: "https://example.org/w/9", record: "rec:9" }]);
  assert.throws(() => readHadithPage("<p>nothing</p>"));
  assert.throws(() => readHadithPage(html.replace(/<p class="hadith__translation[^]*?<\/p>/, "")));
});

test("a dua page: its numbered lines in order and its release", () => {
  const line = (n) => `<li id="l-${n}" class="dua-line"><p class="dua-line__text verbatim" lang="ar">a${n}</p><p class="dua-line__translation verbatim" lang="fa">f${n}</p></li>`;
  const tail = `<bdi class="hash">retrieved-2026-01-01</bdi><bdi class="hash">x-mafatih-key-1</bdi>`;
  const pg = readDuaPage(`${line(1)}${line(2)}${line(3)}${tail}`);
  assert.equal(pg.releaseKey, "x-mafatih-key-1");
  assert.deepEqual(pg.lines.map((l) => [l.number, l.arabic, l.persian]), [[1, "a1", "f1"], [2, "a2", "f2"], [3, "a3", "f3"]]);
  assert.throws(() => readDuaPage(`${line(1)}${line(3)}${tail}`), /in order/);
  assert.throws(() => readDuaPage(`${line(1)}`), /release/);
});

test("the narrator's lines of a translation: its own lines, the words unchanged, at most four", () => {
  assert.deepEqual(trParts("f1 f2:\nf3  f4\n\nf5"), ["f1 f2:", "f3 f4", "f5"]);
  const six = Array.from({ length: 6 }, (_, i) => `f${i}`).join("\n");
  const parts = trParts(six);
  assert.equal(parts.length, 4);
  assert.equal(parts.join(" "), "f0 f1 f2 f3 f4 f5");
});

test("a saying fits its frame and a minute", () => {
  assert.ok(nahjFits({ arabic: words("a", 20), persian: words("f", 30) }));
  assert.ok(!nahjFits({ arabic: "a".repeat(FIT.nahj.arabic + 1), persian: "f" }));
  assert.ok(!nahjFits({ arabic: "a", persian: "f ".repeat(300) }));
});

test("Kumayl's passage: whole lines in order from where the last ended, as many as fit", () => {
  const lines = Array.from({ length: 10 }, (_, i) => ({ number: i + 1, arabic: "a".repeat(60), persian: "f".repeat(i === 6 ? 400 : 100) }));
  assert.deepEqual(duaPassage(lines, 1), { from: 1, to: 3 }); // 3 × 100 ≤ 330 < 4 × 100
  assert.deepEqual(duaPassage(lines, 5), { from: 5, to: 6 }); // line 7 is too long to join
  assert.equal(duaPassage(lines, 7), null); // too long alone: the planner starts at the next line
  assert.equal(duaPassage(lines, 11), null);
  const short = lines.map((l) => ({ ...l, persian: "f" }));
  assert.deepEqual(duaPassage(short, 1), { from: 1, to: FIT.kumayl.lines });
});

test("the dhikr Story's line: never the opening line, the next one short enough, from line 2 again after the last", () => {
  const lines = [20, 80, 300, 60, 400].map((n, i) => ({ number: i + 1, arabic: "a".repeat(40), persian: "f".repeat(n) }));
  assert.equal(storyLine(lines, 1), 2);
  assert.equal(storyLine(lines, 3), 4);
  assert.equal(storyLine(lines, 5), 2);
  assert.equal(storyLine(lines, 9), 2);
  assert.equal(storyLine(lines.map((l) => ({ ...l, persian: "f".repeat(500) })), 1), null);
});

test("whole sentences: split after a full stop outside quotes and brackets, never inside reported speech", () => {
  assert.deepEqual(sentencesOf("s1 s2. s3 «q1. q2» s4.(2) s5! s6? s7."), ["s1 s2.", "s3 «q1. q2» s4.(2)", "s5! s6? s7."]);
  assert.deepEqual(sentencesOf("s1 (b1. b2) s2. s3"), ["s1 (b1. b2) s2.", "s3"]);
});

test("the tafsir slides: from the commentary, whole pieces in order, nothing left out in between", () => {
  const prose = (k, n) => `${words(`p${k}_`, n)}.`;
  const text = ["a1 a2", "h1:", "t1.", "h2:", "title", prose(1, 40), prose(2, 40), "* * *", prose(3, 40), prose(4, 40), prose(5, 40), prose(6, 40), prose(7, 40)].join("\n\n");
  assert.equal(commentaryStart(text.split(/\n+/)), 4);
  const r = tafsirSlides(text);
  assert.equal(r.slides.length, FIT.tafsir.slides);
  const shown = r.slides.flat().map((x) => x.text);
  // in order, from the first prose paragraph of the commentary, the break passed over
  assert.equal(shown[0], prose(1, 40));
  shown.forEach((t, i) => assert.equal(t, prose(i + 1, 40)));
  assert.ok(r.slides.every((s) => slideText(s).length <= FIT.tafsir.slide));
  assert.ok(slideText(r.slides[2], r.more).endsWith(" …") === r.more);
  // a sentence longer than a slide ends the passage there; too little for three slides gives none
  assert.equal(tafsirSlides(["h1:", "x.", "h2:", prose(1, 40), "z".repeat(FIT.tafsir.slide + 1) + "."].join("\n")), null);
  // one heading only: the structure is unclear
  assert.equal(tafsirSlides(["h1:", prose(1, 40), prose(2, 40)].join("\n")), null);
});

test("the fixed lines are plain spoken Persian and name the book (S3d guard)", () => {
  for (const n of [1, 9, 98, 110, 480]) {
    const l = nahjSourceLine(n, faWords);
    assert.equal(l.id, "src");
    assert.deepEqual(readingProblems(l.say), [], l.say);
    assert.ok(l.say.includes(faWords(n)));
    assert.ok(/نَهجُ‌البَلاغه/.test(l.say));
    // the translator is credited on the card only, never spoken (the owner, 2026-10-29)
    assert.ok(!/مَکارِم|مکارم/.test(l.say) && /مکارم/.test(l.show));
  }
  for (const next of [4, 113, null]) {
    const l = kumaylRestLine(next);
    assert.equal(l.id, "rest");
    assert.deepEqual(readingProblems(l.say), [], l.say);
    assert.ok(/مَفاتیحِ نوین/.test(l.say) && !/مَکارِم|مکارم/.test(l.say));
  }
});
