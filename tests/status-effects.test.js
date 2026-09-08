const assert = require("node:assert/strict");
const test = require("node:test");
const { loadPrototype } = require("./helpers/prototype");

function scenario(source) {
  const app = loadPrototype();
  app.evaluate(`
    const state = createBattleState({
      playerUnits: [['captain', 1, 0]], enemyUnits: [['captain', 1, 0]],
      playerGeneral: 'captain', enemyGeneral: 'captain',
      playerTerrain: sanitizeTerrain(null), enemyTerrain: sanitizeTerrain(null)
    });
    state.turn = 1;
    const [source, target] = state.units;
    for (const unit of state.units) {
      unit.card = { ...unit.card, abilityKey: '', generalKey: '', ultimate: null };
    }
    const log = createSilentLog();
  `);
  return JSON.parse(JSON.stringify(app.evaluate(source)));
}

test("AD-G01: repeated fixed statuses keep one slot and the longer expiry/source", () => {
  const results = scenario(`(() => ['poison', 'healBlock', 'defenseDown'].map(key => {
    state.turn = 1;
    target.statusEffects = [];
    grantStatusEffect(state, target, key, 4, source);
    state.turn = 2;
    grantStatusEffect(state, target, key, 1, target);
    const shorter = { ...activeStatusEffect(state, target, key) };
    grantStatusEffect(state, target, key, 3, target);
    const equal = { ...activeStatusEffect(state, target, key) };
    grantStatusEffect(state, target, key, 4, target);
    const longer = { ...activeStatusEffect(state, target, key) };
    return { key, count: target.statusEffects.length, shorter, equal, longer, sourceId: source.id, targetId: target.id };
  }))()`);
  for (const row of results) {
    assert.equal(row.count, 1, row.key);
    assert.equal(row.shorter.expiresOnTurn, 4, row.key);
    assert.equal(row.shorter.sourceId, row.sourceId, row.key);
    assert.deepEqual(row.equal, row.shorter, row.key);
    assert.equal(row.longer.expiresOnTurn, 5, row.key);
    assert.equal(row.longer.sourceId, row.targetId, row.key);
  }
});

test("AD-G01: poison applied during turn 1 for 3T ticks on turns 2 and 3 only", () => {
  const result = scenario(`(() => {
    grantStatusEffect(state, target, 'poison', 3, source);
    const initialHp = target.hp;
    const damage = [];
    for (const turn of [2, 3, 4]) {
      state.turn = turn;
      expireStatusEffects(state);
      applyStatusTurnStart(state, log);
      damage.push(initialHp - target.hp);
    }
    const expired = activeStatusEffect(state, target, 'poison');
    grantStatusEffect(state, target, 'poison', 3, target);
    return { damage, expired, count: target.statusEffects.length, newExpiry: activeStatusEffect(state, target, 'poison').expiresOnTurn };
  })()`);
  assert.deepEqual(result, { damage: [6, 12, 12], expired: null, count: 1, newExpiry: 6 });
});

test("AD-G01: heal block and defense down expire after their inclusive final turn", () => {
  const result = scenario(`(() => {
    target.hp = 60;
    grantStatusEffect(state, target, 'healBlock', 1, source);
    grantStatusEffect(state, target, 'defenseDown', 1, source);
    const blocked = heal(state, target, 10);
    const active = Boolean(activeStatusEffect(state, target, 'defenseDown'));
    state.turn = 2;
    expireStatusEffects(state);
    return { blocked, active, restored: heal(state, target, 10), statuses: target.statusEffects };
  })()`);
  assert.deepEqual(result, { blocked: 0, active: true, restored: 10, statuses: [] });
});

test("AD-G01: explicit clear masks form a union and ordinary healing does not cleanse", () => {
  const result = scenario(`(() => {
    target.hp = 60;
    for (const key of ['poison', 'healBlock', 'defenseDown', 'contactPoison', 'reflectShell']) {
      grantStatusEffect(state, target, key, 3, source);
    }
    const cleared = clearStatusEffects(state, target, ['dot', 'healControl', 'dot']).map(e => e.key).sort();
    const retained = target.statusEffects.map(e => e.key).sort();
    grantStatusEffect(state, target, 'poison', 3, source);
    heal(state, target, 10);
    const poisonAfterHeal = Boolean(activeStatusEffect(state, target, 'poison'));
    const weak = clearStatusEffects(state, target, ['weak']).map(e => e.key).sort();
    const buffs = target.statusEffects.map(e => e.key).sort();
    const noOp = clearStatusEffects(state, target, ['unknown']).length;
    const all = clearStatusEffects(state, target, ['all']).length;
    return { cleared, retained, poisonAfterHeal, weak, buffs, noOp, all, remaining: target.statusEffects.length };
  })()`);
  assert.deepEqual(result, {
    cleared: ["healBlock", "poison"], retained: ["contactPoison", "defenseDown", "reflectShell"],
    poisonAfterHeal: true, weak: ["defenseDown", "poison"], buffs: ["contactPoison", "reflectShell"],
    noOp: 0, all: 2, remaining: 0,
  });
});

test("AD-G01: same-AG poison remains one slot and does not shorten an existing effect", () => {
  const result = scenario(`(() => {
    for (const unit of state.units) unit.card = { ...unit.card, ag: 50, front: 'toxicNeedle' };
    grantStatusEffect(state, target, 'poison', 5, target);
    const batch = nextActingBatch(state, new Set());
    executeActionBatch(state, batch, log);
    const afterBatch = state.units.map(u => ({ count: u.statusEffects.length, expiry: activeStatusEffect(state, u, 'poison').expiresOnTurn }));
    const targetSource = activeStatusEffect(state, target, 'poison').sourceId;
    state.turn = 2;
    const before = state.units.map(u => u.hp);
    applyStatusTurnStart(state, log);
    return { simultaneous: batch.simultaneous, afterBatch, targetSource, expectedSource: target.id, damage: state.units.map((u, i) => before[i] - u.hp) };
  })()`);
  assert.equal(result.simultaneous, true);
  assert.deepEqual(result.afterBatch, [{ count: 1, expiry: 3 }, { count: 1, expiry: 5 }]);
  assert.equal(result.targetSource, result.expectedSource);
  assert.deepEqual(result.damage, [6, 6]);
});

test("AD-G01: unpublished regeneration has a definition but cannot be applied", () => {
  const result = scenario(`(() => {
    const recorded = createBattleLog(state);
    applyStatusToTargets(state, source, [target], 'regen', 3, recorded, 'test');
    return {
      implemented: STATUS_EFFECTS.regen.implemented,
      phase: STATUS_EFFECTS.regen.unlockPhase,
      stacking: STATUS_EFFECTS.regen.stacking,
      granted: grantStatusEffect(state, target, 'regen', 3, source),
      unknown: grantStatusEffect(state, target, 'undefinedStatus', 3, source),
      statuses: target.statusEffects,
      entries: recorded.entries.length
    };
  })()`);
  assert.deepEqual(result, { implemented: false, phase: "depth", stacking: "strongest", granted: null, unknown: null, statuses: [], entries: 0 });
});
