const assert = require("node:assert/strict");
const test = require("node:test");
const { buildReport } = require("../scripts/report-standard-battles");
const { TARGETS, EXPERIMENTS, candidateSummary, runExperiment, buildAnalysis } = require("../scripts/analyze-m1-candidates");

test("candidate summaries exclude self, retain both orientations and use target-relative outcomes", () => {
  const baseline = buildReport();
  for (const id of TARGETS) {
    const summary = candidateSummary(baseline.battles, id);
    assert.equal(summary.count, 2 * (baseline.decks.length - 1));
    assert.equal(Object.values(summary.results).reduce((a, b) => a + b, 0), summary.count);
    assert.equal(summary.winRate, summary.results.win / summary.count);
    assert.equal(summary.perspectives.filter((p) => p.side === "player").length, baseline.decks.length - 1);
    assert.equal(summary.perspectives.filter((p) => p.side === "enemy").length, baseline.decks.length - 1);
    assert.ok(summary.perspectives.every((p) => p.opponent !== id));
  }
});

test("no-op experiment is identical to production metrics and card edits remain side-local", () => {
  const baseline = buildReport();
  const target = TARGETS[1];
  const noOp = runExperiment({ target });
  for (const b of noOp.battles) {
    const original = baseline.battles.find((o) => o.player === b.player && o.enemy === b.enemy);
    const { entries, ...measured } = b;
    assert.deepEqual(measured, original);
    assert.ok(entries.length > 0);
  }
  // Three front units are required to trigger the unmodified opponent's opening barrage.
  const units = baseline.decks.find((p) => p.id === target).units.map((u) => u[0] === "cannoneer" ? [u[0], 2, 0] : u);
  const experiment = runExperiment({ ...EXPERIMENTS.find((e) => e.id === "board-no-opening"), units });
  for (const b of experiment.battles.filter((b) => b.player === "sample-corrosion" || b.enemy === "sample-corrosion")) {
    const side = b.player === target ? "enemy" : "player";
    const suffix = side === "player" ? "自" : "敵";
    assert.ok(b.entries.some((entry) => entry.includes(`(α/${suffix}) のα特性: 開幕掃射`)), "opponent alpha was not patched");
    const own = side === "player" ? "敵" : "自";
    assert.ok(!b.entries.some((entry) => entry.includes(`(α/${own}) のα特性: 開幕掃射`)));
  }
  assert.deepEqual(buildReport(), baseline, "VM experiments must not leak into a fresh production run");
});

test("all candidate experiments are legal, complete, finite and traceable to baseline logs", () => {
  const analysis = buildAnalysis();
  assert.equal(analysis.experiments.length, EXPERIMENTS.length);
  assert.ok(analysis.baselineLogs.length >= TARGETS.length * 2);
  for (const experiment of analysis.experiments) {
    assert.ok(experiment.cost.total <= 30);
    assert.equal(experiment.summary.count, 24);
    assert.equal(experiment.logs.length, 24);
    assert.deepEqual(experiment.summary.orientationDifferences, []);
    const units = experiment.deck.units;
    assert.equal(new Set(units.map((u) => `${u[1]}:${u[2]}`)).size, units.length);
    assert.ok(units.every((u) => u[1] >= 0 && u[1] < 3 && u[2] >= 0 && u[2] < 3));
    assert.ok(experiment.summary.perspectives.every((p) => p.turns >= 1 && p.turns <= 80));
  }
  assert.ok(Object.values(analysis.sourceSha256).every((hash) => /^[a-f0-9]{64}$/.test(hash)));
  assert.deepEqual(JSON.parse(JSON.stringify(analysis)), analysis);
});
