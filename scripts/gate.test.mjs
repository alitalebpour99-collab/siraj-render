// The lamp style's gate on made-up measurements (placeholders only: no text of the Quran here).
// node --experimental-strip-types --test scripts/gate.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { dotBeside, hookHead, inZones, quoteHash, wordsOf, ZONES, MIN_TEXT } from "../src/lamp/zones.ts";
import { probeChecks, verdict } from "./gate.mjs";

const row = (o) => ({ b: 1, r: "text", q: null, x: 200, y: 600, w: 400, h: 80, s: 40, o: 1, n: 3, d: false, hq: null, ...o });
const QUOTE_HASH = quoteHash("placeholder quote");

/** A Reel that passes: the quote and its reference from frame 0, a badge at the close. */
function good() {
  const probes = [];
  for (let f = 0; f <= 600; f += 5) {
    const rows = [row({ b: 1, r: "source", y: 250, h: 60, n: 4 }), row({ b: 2, r: "quote", q: "a1", hq: QUOTE_HASH, y: 600, h: 300, n: 9 })];
    if (f >= 520 && f <= 580) rows.push(row({ b: 3, r: "badge", x: 82, y: 1491, w: 260, h: 66, n: 1, s: 34 }));
    probes.push({ f, rows });
  }
  return { probes, plan: { total: 610, quotes: { a1: QUOTE_HASH }, badgeOn: true, badge: { from: 516, to: 582 }, closeFrom: 450 } };
}
const failing = (checks) => checks.filter((c) => !c.ok).map((c) => c.id);

test("the zones are the measured ones", () => {
  assert.deepEqual(ZONES, { top: 232, right: 888, left: 56, bottom: 1583 });
  assert.equal(MIN_TEXT, 29);
  assert.ok(inZones({ x: 56, y: 232, w: 832, h: 1351 }));
  assert.ok(!inZones({ x: 600, y: 300, w: 300, h: 40 }));
});

test("a good Reel passes every check", () => {
  const { probes, plan } = good();
  assert.deepEqual(failing(probeChecks(probes, plan)), []);
});

test("each fault fails only its own check", () => {
  const cases = [
    ["hook", (p) => (p.probes[0].rows = p.probes[0].rows.filter((r) => r.r !== "quote"))],
    ["hook", (p) => p.probes[1].rows.push(row({ b: 9, y: 1200, n: 5 }))],
    ["safe", (p) => p.probes[10].rows.push(row({ b: 9, x: 700, w: 300, y: 1200 }))],
    ["text-size", (p) => p.probes[10].rows.push(row({ b: 9, y: 1200, s: 22 }))],
    ["overlap", (p) => p.probes[10].rows.push(row({ b: 9, y: 650, h: 80 }))],
    ["source", (p) => (p.probes[20].rows = p.probes[20].rows.filter((r) => r.r !== "source"))],
    ["quote", (p) => (p.probes[20].rows[1].hq = quoteHash("another placeholder"))],
    ["persian", (p) => p.probes[20].rows.push(row({ b: 9, y: 1200, d: true }))],
    ["badge", (p) => p.probes.forEach((x) => x.rows.forEach((r) => r.r === "badge" && (r.y = 900)))],
    ["badge", (p) => (p.plan.badge = { from: 500, to: 600 })],
  ];
  for (const [id, change] of cases) {
    const p = good();
    change(p);
    assert.deepEqual(failing(probeChecks(p.probes, p.plan)), [id], id);
  }
});

test("a faint text does not count, a fading one is not over another", () => {
  const p = good();
  p.probes[10].rows.push(row({ b: 9, y: 650, h: 80, o: 0.4 }));
  assert.deepEqual(failing(probeChecks(p.probes, p.plan)), []);
});

test("the verdict is plain Persian, each reason once", () => {
  const p = good();
  p.probes[10].rows.push(row({ b: 9, x: 700, w: 300, y: 1200 }));
  p.probes[11].rows.push(row({ b: 9, x: 700, w: 300, y: 1200 }));
  const v = verdict({ checks: probeChecks(p.probes, p.plan) });
  assert.match(v, /^این ویدیو از بازبینیِ پیش از ارسال رد شد: /);
  assert.equal(v.split("قابِ امن").length, 2);
  assert.ok(!dotBeside(v));
});

test("a «·» or «|» beside Persian is found; between Latin words it is not", () => {
  assert.ok(dotBeside("سورهٔ ۱۰۳ · آیهٔ ۱"));
  assert.ok(dotBeside("منابع|"));
  assert.ok(!dotBeside("Al-Asr · 103:1"));
  assert.ok(!dotBeside("سورهٔ العصر، آیهٔ ۱"));
});

test("the hook's head: given, the whole line, or its first clause of 7 words or fewer", () => {
  assert.equal(hookHead("One two three four.", undefined), "One two three four.");
  assert.equal(hookHead("Surah X has 78 verses, and not one of them says the name.", undefined), "Surah X has 78 verses");
  assert.equal(hookHead("Does it have 6,666 verses? Let us count them all now please.", undefined), "Does it have 6,666 verses?");
  assert.equal(hookHead("Only one surah has the name in every verse of it.", undefined), null);
  assert.equal(hookHead("Only one surah has the name in every verse of it.", "One surah, the name in every verse"), "One surah, the name in every verse");
  assert.equal(wordsOf("«الله» را، دارد.").length, 3);
});

test("a quote's hash ignores spaces and the seal's digits, not a letter", () => {
  assert.equal(quoteHash("ab cd ۳"), quoteHash("abcd"));
  assert.notEqual(quoteHash("abcd"), quoteHash("abce"));
});
