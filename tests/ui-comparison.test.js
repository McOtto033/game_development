const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPrototype } = require("./helpers/prototype");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
function observedPrototype() {
  const app = loadPrototype();
  app.evaluate("globalThis.window = { addEventListener() {}, postMessage() {} }; window.parent = window;");
  app.evaluate(read("prototype-comparison/bridge.js"));
  return app;
}

test("C1 frozen engine differs only in its two storage keys", () => {
  const copy = read("prototype-comparison/baseline/app.js")
    .replace('"comparison-c1-custom-decks-v1"', '"taisho-custom-decks-v1"')
    .replace('"comparison-c1-card-tuning-v1"', '"taisho-card-tuning-v1"');
  assert.equal(copy, read("prototype/app.js"));
  assert.equal(read("prototype-comparison/baseline/styles.css"), read("prototype/styles.css"));
  assert.equal(read("prototype-comparison/baseline/index.html").replace('    <script src="../bridge.js"></script>\n', ""), read("prototype/index.html"));
});

test("C1 observer preserves results, metrics and event states across representative matchups", () => {
  const app = observedPrototype();
  const results = app.evaluate(`(() => {
    const pairs = [
      ["sample-rapid", "sample-shell"], ["sample-shell", "sample-rapid"],
      ["sample-corrosion", "sample-shell"], ["sample-shell", "sample-shell"],
      ["sample-rapid", "sample-rapid"],
    ];
    return pairs.map(([player, enemy]) => {
      applyPresetToSide("player", player); applyPresetToSide("enemy", enemy);
      const expected = simulateBattle({ record: true });
      const original = executeActionBatch;
      const replay = window.comparisonObserver.runObserved();
      const actual = lastBattleLog;
      const again = simulateBattle({ record: true });
      return {
        pair: player + "/" + enemy,
        result: replay.result === expected.result,
        state: JSON.stringify(actual.finalState) === JSON.stringify(expected.state),
        frames: JSON.stringify(actual.frames) === JSON.stringify(expected.log.frames),
        metrics: JSON.stringify(replay.metrics) === JSON.stringify(expected.metrics) && JSON.stringify(again.metrics) === JSON.stringify(expected.metrics),
        restored: original === executeActionBatch,
        batch: replay.tape.some(s => s.simultaneous && s.actors.length === 2),
        poison: replay.tape.some(s => s.after.units.some(u => u.statuses.some(e => e.key === "poison"))),
        chronological: replay.tape.every((s, i, all) => i === 0 || s.before.turn >= all[i - 1].after.turn),
      };
    });
  })()`, 60000);
  for (const entry of results) for (const key of ["result", "state", "frames", "metrics", "restored", "chronological"]) assert.equal(entry[key], true, `${entry.pair}: ${key}`);
  assert.ok(results.some((entry) => entry.batch));
  assert.ok(results.some((entry) => entry.poison));
});

test("C1 status display computes remaining duration from expiry, not original duration", () => {
  const app = observedPrototype();
  const values = app.evaluate(`(() => {
    const state = createBattleState(); const unit = state.units[0];
    state.turn = 1; grantStatusEffect(state, unit, "poison", 3, state.units[1]);
    state.turn = 2;
    const active = window.comparisonObserver.viewState(state).units[0].statuses[0];
    state.turn = 4;
    return { remaining: active.remaining, expiry: active.expiresOnTurn, source: active.sourceName,
      expiredCount: window.comparisonObserver.viewState(state).units[0].statuses.length };
  })()`);
  assert.equal(values.remaining, 2);
  assert.equal(values.expiry, 3);
  assert.ok(values.source);
  assert.equal(values.expiredCount, 0);
});

test("C1 failed simulation restores the engine observer wrapper", () => {
  const app = observedPrototype();
  assert.equal(app.evaluate(`(() => {
    const originalExecute = executeActionBatch; const originalSimulate = simulateBattle;
    simulateBattle = () => { throw new Error("test failure"); };
    try { window.comparisonObserver.runObserved(); } catch {} finally { simulateBattle = originalSimulate; }
    return originalExecute === executeActionBatch;
  })()`), true);
});

test("C1 legacy view never presents a simultaneous batch as one attack", () => {
  const app = observedPrototype();
  const result = app.evaluate(`(() => {
    applyPresetToSide("player", "sample-shell"); applyPresetToSide("enemy", "sample-shell");
    const replay = window.comparisonObserver.runObserved();
    const index = replay.tape.findIndex(step => step.simultaneous && step.events.filter(e => e.type === "attack").length > 1);
    window.comparisonObserver.seek(index, "after");
    return { index, highlights: activeFrame, title: els.phaseSummary.textContent,
      hp: lastState.units.map(u => u.hp), expected: replay.tape[index].after.units.map(u => u.hp) };
  })()`);
  assert.ok(result.index >= 0);
  assert.equal(result.highlights, null);
  assert.match(result.title, /同時成立/);
  assert.deepEqual(result.hp, result.expected);
});
