const assert = require("node:assert/strict");
const test = require("node:test");
const { loadPrototype } = require("./helpers/prototype");
const { runAll } = require("../scripts/research-action-priority-scenarios");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("production startup renders both boards and connects battle/reset controls", () => {
  const app = loadPrototype();
  for (const side of ["player", "enemy"]) {
    assert.equal(app.elements.get(`${side}Board`).children.length, 9);
  }
  assert.ok(app.elements.get("cardPicker").children.length > 1);
  assert.ok(app.elements.get("generationSummary").innerHTML.length > 0);
  for (const id of ["runBattle", "runRoundRobin", "resetBattle", "playReplay"]) {
    assert.equal(app.elements.get(id).listeners.get("click")?.length, 1, id);
  }
  app.evaluate("els.runBattle.click()");
  assert.ok(app.evaluate("lastBattleLog.frames.length > 0"));
  assert.ok(app.evaluate("['player', 'enemy', 'draw'].includes(lastBattleLog.result)"));
  app.evaluate("els.resetBattle.click()");
  assert.equal(app.evaluate("lastBattleLog"), null);
});

test("standard decks fit the adopted cost and formation rules", () => {
  const app = loadPrototype();
  const data = plain(app.evaluate(`({
    costLimit: COST_LIMIT, slots: MAX_DECK_CARDS,
    generated: presets.filter(p => p.kind === 'generated').length,
    decks: roundRobinPresets().map(p => ({
      id: p.id, units: p.units, general: p.general, cost: presetCost(p),
      legalCount: legalFormationUnits(p.units).length,
      knownCards: p.units.every(([id]) => Boolean(cards[id]))
    }))
  })`));
  assert.equal(data.costLimit, 30);
  assert.equal(data.slots, 9);
  assert.ok(data.generated > 0, "the generator must produce usable candidates");
  assert.equal(new Set(data.decks.map((deck) => deck.id)).size, data.decks.length);
  for (const deck of data.decks) {
    assert.ok(deck.knownCards, deck.id);
    assert.ok(deck.units.length > 0 && deck.units.length <= data.slots, deck.id);
    assert.equal(deck.legalCount, deck.units.length, deck.id);
    assert.equal(new Set(deck.units.map(([, row, col]) => `${row}:${col}`)).size, deck.units.length, deck.id);
    assert.ok(deck.units.every(([, row, col]) => Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 3 && col >= 0 && col < 3), deck.id);
    assert.equal(deck.units.filter(([id]) => id === deck.general).length, 1, deck.id);
    assert.ok(Number.isFinite(deck.cost.total) && deck.cost.total <= data.costLimit, deck.id);
  }
});

test("same AG uses cell before rarity, ignores cost, and preserves both lethal actions", () => {
  const app = loadPrototype();
  const result = plain(app.evaluate(`(() => {
    const state = createBattleState({
      playerUnits: [['captain', 1, 0]], enemyUnits: [['captain', 1, 0]],
      playerGeneral: 'captain', enemyGeneral: 'captain',
      playerTerrain: sanitizeTerrain(null), enemyTerrain: sanitizeTerrain(null)
    });
    state.turn = 1;
    const [p, e] = state.units;
    for (const unit of state.units) {
      unit.hp = 1;
      unit.card = { ...unit.card, at: 100, ag: 50, abilityKey: '', generalKey: '', ultimate: null };
    }
    p.card = { ...p.card, soldierCost: 1, generalCost: 1 };
    e.card = { ...e.card, soldierCost: 9, generalCost: 9 };
    const batch = nextActingBatch(state, new Set());
    const costIgnored = batch.simultaneous && batch.units.length === 2;
    e.row = 0;
    e.card = { ...e.card, rarity: 'legendary' };
    const cellFirst = nextActingBatch(state, new Set()).units[0].side;
    e.row = 1;
    const rarityNext = nextActingBatch(state, new Set()).units[0].side;
    e.card = { ...e.card, rarity: 'common' };
    executeActionBatch(state, nextActingBatch(state, new Set()), createSilentLog());
    return { costIgnored, cellFirst, rarityNext, hp: state.units.map(u => u.hp), result: checkGeneralVictory(state, createSilentLog()) };
  })()`));
  assert.deepEqual(result, { costIgnored: true, cellFirst: "player", rarityNext: "enemy", hp: [0, 0], result: "draw" });
});

test("all existing actions have explicit production same-AG handling", () => {
  const app = loadPrototype();
  const missing = plain(app.evaluate(`[
    ...Object.keys(actions), ...Object.keys(ultimateActions).map(key => 'ultimate:' + key)
  ].filter(key => sameAgActionSegments(key).flat().some(op => op.kind.includes('fallback')))`));
  assert.deepEqual(missing, []);
});

test("every ordered standard pairing terminates and repeats identically", (t) => {
  const app = loadPrototype();
  const results = plain(app.evaluate(`(() => {
    const decks = roundRobinPresets();
    const results = [];
    for (const p of decks) for (const e of decks) {
      const options = { playerPresetId: p.id, enemyPresetId: e.id, playerTerrain: p.terrain, enemyTerrain: e.terrain, record: false };
      const first = simulateBattle(options);
      const second = simulateBattle(options);
      results.push({
        pair: p.id + ' / ' + e.id, result: first.result, turns: first.turns,
        finite: first.state.units.every(u => Number.isFinite(u.hp) && Number.isFinite(u.maxHp) && u.hp >= 0 && u.hp <= u.maxHp),
        repeat: JSON.stringify(first) === JSON.stringify(second),
        metricResult: first.metrics.result, limit: SAFETY_TURN_LIMIT
      });
    }
    return results;
  })()`, 60000));
  assert.ok(results.length > 0);
  for (const result of results) {
    assert.ok(["player", "enemy", "draw"].includes(result.result), result.pair);
    assert.ok(result.turns > 0 && result.turns <= result.limit, result.pair);
    assert.ok(result.finite, result.pair);
    assert.ok(result.repeat, result.pair);
    assert.equal(result.metricResult, result.result, result.pair);
  }
  t.diagnostic(`${results.length} ordered pairings, two production battles each`);
});

test("recording replay does not change battle outcomes or metrics", () => {
  const app = loadPrototype();
  const result = plain(app.evaluate(`(() => {
    const [p, e] = roundRobinPresets();
    const options = { playerPresetId: p.id, enemyPresetId: e.id, playerTerrain: p.terrain, enemyTerrain: e.terrain };
    const silent = simulateBattle({ ...options, record: false });
    const recorded = simulateBattle({ ...options, record: true });
    const pick = b => ({ result: b.result, turns: b.turns, state: b.state, metrics: b.metrics });
    return { silent: pick(silent), recorded: pick(recorded), frames: recorded.log.frames.length };
  })()`));
  assert.deepEqual(result.silent, result.recorded);
  assert.ok(result.frames > 0);
});

test("D4 research model passes all twelve reference scenarios (not production coverage)", () => {
  const results = runAll();
  assert.equal(results.length, 12);
  assert.deepEqual(results.filter((result) => !result.pass), []);
});

