const assert = require("node:assert/strict");
const test = require("node:test");
const { loadPrototype } = require("./helpers/prototype");
const { summarizeBattles, buildReport } = require("../scripts/report-standard-battles");

function scenario(body) {
  return JSON.parse(JSON.stringify(loadPrototype().evaluate(`(() => {
    const state = createBattleState({
      playerUnits: [['captain', 1, 0]], enemyUnits: [['captain', 1, 0], ['archer', 1, 1]],
      playerGeneral: 'captain', enemyGeneral: 'captain',
      playerTerrain: sanitizeTerrain(null), enemyTerrain: sanitizeTerrain(null)
    });
    state.turn = 1;
    const [p, e, survivor] = state.units;
    for (const unit of state.units) {
      unit.hp = 1;
      unit.card = { ...unit.card, front: 'slash', at: 100, ag: 50,
        abilityKey: '', generalKey: '', ultimate: null };
    }
    const log = createSilentLog();
    ${body}
    const result = checkGeneralVictory(state, log) || 'draw';
    return { result, turns: state.turn, metrics: finalizeBattleMetrics(state, result, state.turn) };
  })()`)));
}

test("faster lethal action records zero-action loss without counting an unacted survivor as dead", () => {
  const battle = scenario(`p.card.ag = 100; executeActionBatch(state, nextActingBatch(state, new Set()), log);`);
  const summary = summarizeBattles([battle]);
  assert.equal(battle.result, "player");
  assert.deepEqual(summary.earlySettlement.byT1.allBattles, { numerator: 1, denominator: 1, rate: 1 });
  assert.deepEqual(summary.firstActionDeaths.allUnits, { numerator: 1, denominator: 3, rate: 1 / 3 });
  assert.deepEqual(summary.firstActionDeaths.losingUnits, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.equal(summary.loserActions.mean, 0);
  const [, survivor] = Object.values(battle.metrics.sides.enemy.units);
  assert.equal(survivor.koTurn, null);
  assert.equal(survivor.actionsBeforeFirstKo, null);
});

test("same-AG mutual lethal actions are guaranteed, not first-action deaths; draws have no loser", () => {
  const battle = scenario(`executeActionBatch(state, nextActingBatch(state, new Set()), log);`);
  const summary = summarizeBattles([battle]);
  assert.equal(battle.result, "draw");
  assert.equal(Object.values(battle.metrics.sides.player.units)[0].actionsBeforeFirstKo, 1);
  assert.equal(Object.values(battle.metrics.sides.enemy.units)[0].actionsBeforeFirstKo, 1);
  assert.equal(summary.firstActionDeaths.allUnits.numerator, 0);
  assert.equal(summary.firstActionDeaths.losingUnits.rate, null);
  assert.equal(summary.loserActions.mean, null);
  assert.equal(summary.loserActions.excludedDraws, 1);
  assert.equal(summary.earlySettlement.byT1.allBattles.rate, 0);
  assert.equal(summary.earlySettlement.byT1.decisiveBattles.rate, null);
});

test("ultimate-only loser has an action; duplicate KO recording cannot overwrite its first-KO observation", () => {
  const battle = scenario(`
    e.card.ultimate = { key: 'teamHeal', name: 'test' };
    executeUltimate(state, e, log);
    e.hp = 0;
    recordKoMetric(state, e, 'player');
    recordActionMetric(state, e, 'wait');
    recordKoMetric(state, e, 'player');
  `);
  const record = Object.values(battle.metrics.sides.enemy.units)[0];
  assert.equal(record.actionsBeforeFirstKo, 1);
  assert.equal(record.ultimates, 1);
  assert.equal(battle.metrics.sides.player.kos, 1);
  const summary = summarizeBattles([battle]);
  assert.equal(summary.loserActions.mean, 2);
  assert.equal(summary.firstActionDeaths.losingUnits.numerator, 0);
});

test("poison before the first action records a KO even at turn zero and in a draw", () => {
  const battle = scenario(`
    state.turn = 0;
    grantStatusEffect(state, e, 'poison', 3, p);
    applyStatusTurnStart(state, log);
    p.hp = 0;
    recordKoMetric(state, p, 'enemy');
    state.turn = 1;
  `);
  assert.equal(Object.values(battle.metrics.sides.enemy.units)[0].koTurn, 0);
  assert.equal(battle.result, "draw");
  const summary = summarizeBattles([battle]);
  assert.equal(summary.firstActionDeaths.allUnits.numerator, 2);
  assert.equal(summary.firstActionDeaths.losingUnits.denominator, 0);
});

test("cumulative T1/T2 rates, turn distributions, and draw exclusions have explicit denominators", () => {
  const first = scenario(`p.card.ag = 100; executeActionBatch(state, nextActingBatch(state, new Set()), log);`);
  const atTurn = (turns, result) => ({ ...structuredClone(first), turns, result });
  const summary = summarizeBattles([first, atTurn(2, "enemy"), atTurn(3, "player"), atTurn(2, "draw")]);
  assert.deepEqual(summary.terminalTurns.histogram, { 1: 1, 2: 2, 3: 1 });
  assert.deepEqual(summary.settlementTurns.histogram, { 1: 1, 2: 1, 3: 1 });
  assert.deepEqual(summary.drawTurns.histogram, { 2: 1 });
  assert.equal(summary.earlySettlement.byT1.allBattles.rate, 1 / 4);
  assert.equal(summary.earlySettlement.byT2.allBattles.rate, 2 / 4);
  assert.equal(summary.earlySettlement.byT2.decisiveBattles.rate, 2 / 3);
  assert.equal(summary.loserActions.total, 1);
  assert.equal(summary.loserActions.count, 3);
  assert.equal(summary.loserActions.excludedDraws, 1);
  assert.equal(summary.completeLock.rate, null);
  assert.equal(summary.effectiveSettlement.status, "not_evaluated");
});

test("empty reports use null ratios and reject old or corrupt observation fields", () => {
  const empty = summarizeBattles([]);
  assert.equal(empty.settlementTurns.mean, null);
  assert.equal(empty.earlySettlement.byT2.allBattles.rate, null);
  assert.equal(empty.firstActionDeaths.allUnits.rate, null);
  const battle = scenario(`p.card.ag = 100; executeActionBatch(state, nextActingBatch(state, new Set()), log);`);
  delete Object.values(battle.metrics.sides.enemy.units)[0].actionsBeforeFirstKo;
  assert.throws(() => summarizeBattles([battle]), /non-game-v1/);
  assert.throws(() => summarizeBattles([{ ...battle, result: "unknown" }]), /Invalid battle/);
});

test("production standard report covers both orientations and mirrors with reproducible source hashes", () => {
  const report = buildReport();
  assert.equal(report.schemaVersion, "standard-battles-v1");
  assert.equal(report.definitions.version, "non-game-v1");
  const n = report.decks.length;
  assert.equal(report.battles.length, n * n);
  assert.equal(report.nonMirrorSummary.battleCount, n * (n - 1));
  assert.equal(new Set(report.battles.map((b) => `${b.player}/${b.enemy}`)).size, n * n);
  for (const p of report.decks) for (const e of report.decks) {
    assert.ok(report.battles.some((b) => b.player === p.id && b.enemy === e.id));
  }
  assert.equal(report.summary.loserActions.count + report.summary.loserActions.excludedDraws, n * n);
  assert.equal(report.summary.firstActionDeaths.allUnits.denominator, 2 * n * report.decks.reduce((sum, p) => sum + p.units.length, 0));
  assert.ok(Object.values(report.sourceSha256).every((hash) => /^[a-f0-9]{64}$/.test(hash)));
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
});
