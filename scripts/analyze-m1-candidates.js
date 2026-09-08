const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { parseArgs } = require("node:util");
const { loadPrototype } = require("../tests/helpers/prototype");
const { buildReport, summarizeBattles } = require("./report-standard-battles");

const TARGETS = ["generated-focusBreakthrough-1", "generated-boardControl-2", "generated-dotEndurance-1", "generated-aceExecution-2"];
const EXPERIMENTS = [
  { id: "focus-no-lead", target: TARGETS[0], cards: { scout: { generalKey: "none" } } },
  { id: "focus-guard-12", target: TARGETS[0], guardArmor: 12 },
  { id: "focus-guard-0", target: TARGETS[0], guardArmor: 0 },
  { id: "board-no-opening", target: TARGETS[1], cards: { cannoneer: { generalKey: "none" } } },
  { id: "board-at-40", target: TARGETS[1], cards: { cannoneer: { at: 40 } } },
  { id: "dot-priest", target: TARGETS[2], replace: { parasiteMold: "priest" } },
  { id: "dot-fern-rear", target: TARGETS[2], swap: ["ironFern", "parasiteMold"] },
  { id: "ace-swap", target: TARGETS[3], swap: ["cannoneer", "chronoAmmonite"] },
  { id: "ace-two-lanes", target: TARGETS[3], units: [["oracle", 0, 0], ["seer", 1, 0], ["cannoneer", 0, 1], ["chronoAmmonite", 1, 1], ["priest", 0, 2], ["strategist", 1, 2]] },
  { id: "ace-at-46", target: TARGETS[3], cards: { cannoneer: { at: 46 } } },
];

function candidateSummary(battles, target) {
  const rows = battles.filter((b) => b.player !== b.enemy && (b.player === target || b.enemy === target));
  const perspectives = rows.map((b) => {
    const side = b.player === target ? "player" : "enemy";
    return { side, opponent: side === "player" ? b.enemy : b.player,
      result: b.result === "draw" ? "draw" : b.result === side ? "win" : "loss", turns: b.turns,
      own: b.metrics.sides[side], opponentMetrics: b.metrics.sides[side === "player" ? "enemy" : "player"] };
  });
  const mean = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const results = Object.fromEntries(["win", "loss", "draw"].map((key) => [key, perspectives.filter((p) => p.result === key).length]));
  const sideResults = Object.fromEntries(["player", "enemy"].map((side) => [side,
    Object.fromEntries(["win", "loss", "draw"].map((key) => [key, perspectives.filter((p) => p.side === side && p.result === key).length]))]));
  const orientationDifferences = perspectives.filter((p) => p.side === "player").filter((p) => {
    const other = perspectives.find((e) => e.side === "enemy" && e.opponent === p.opponent);
    return !other || p.result !== other.result || p.turns !== other.turns;
  }).map((p) => p.opponent);
  return {
    target, count: rows.length, results, sideResults, winRate: rows.length ? results.win / rows.length : null,
    means: Object.fromEntries(["actions", "ultimates", "keyActions", "keyUltimates", "damageDealt", "alphaDamageDealt", "healing", "damagePrevented"].map((key) => [key, mean(perspectives.map((p) => p.own[key]))])),
    poisonApplications: mean(perspectives.map((p) => p.own.statuses.poison)),
    earlyWins: perspectives.filter((p) => p.result === "win" && p.turns <= 2).length,
    earlyLosses: perspectives.filter((p) => p.result === "loss" && p.turns <= 2).length,
    observations: summarizeBattles(rows), orientationDifferences, perspectives,
  };
}

function runExperiment(experiment) {
  const app = loadPrototype();
  return JSON.parse(JSON.stringify(app.evaluate(`(${function (experiment) {
    const target = presets.find((p) => p.id === experiment.target);
    if (!target) throw new Error("Missing target");
    const modified = { ...target, units: target.units.map((u) => [...u]) };
    if (experiment.units) modified.units = experiment.units;
    if (experiment.replace) modified.units = modified.units.map(([id, row, col]) => [experiment.replace[id] || id, row, col]);
    if (experiment.swap) {
      const [a, b] = experiment.swap.map((id) => modified.units.find((u) => u[0] === id));
      if (!a || !b) throw new Error("Missing swap card");
      [a[1], a[2], b[1], b[2]] = [b[1], b[2], a[1], a[2]];
    }
    if (legalFormationUnits(modified.units).length !== modified.units.length || presetCost(modified).total > COST_LIMIT
      || new Set(modified.units.map((u) => u[0])).size !== modified.units.length
      || !modified.units.some((u) => u[0] === modified.general)) throw new Error("Illegal experimental deck");

    let testSide = "player";
    // Decorate initial state only; the production battle loop and opponent cards stay intact.
    const createOriginal = createBattleState;
    createBattleState = function (options) {
      const state = createOriginal(options);
      for (const unit of state.units.filter((u) => u.side === testSide)) {
        const patch = experiment.cards?.[unit.cardId];
        if (patch) unit.card = { ...unit.card, ...patch };
      }
      return state;
    };
    const armorOriginal = guardArmorFor;
    if (experiment.guardArmor != null) {
      guardArmorFor = (state, unit) => unit.side === testSide && ["engineer", "tideguard"].includes(unit.cardId)
        ? experiment.guardArmor : armorOriginal(state, unit);
    }
    const battles = [];
    for (const opponent of roundRobinPresets().filter((p) => p.id !== target.id)) {
      for (const side of ["player", "enemy"]) {
        testSide = side;
        const p = side === "player" ? modified : opponent;
        const e = side === "enemy" ? modified : opponent;
        const b = simulateBattle({ playerPresetId: p.id, enemyPresetId: e.id, playerUnits: p.units, enemyUnits: e.units,
          playerGeneral: p.general, enemyGeneral: e.general, playerTerrain: p.terrain, enemyTerrain: e.terrain, record: true });
        battles.push({ player: p.id, enemy: e.id, result: b.result, turns: b.turns, metrics: b.metrics, entries: b.log.entries });
      }
    }
    return { deck: modified, cost: presetCost(modified), battles };
  }.toString()})(${JSON.stringify(experiment)})`, 60000)));
}

function buildAnalysis() {
  const baseline = buildReport();
  const app = loadPrototype();
  const baselineLogs = JSON.parse(JSON.stringify(app.evaluate(`(() => {
    const pairs = ${JSON.stringify([[TARGETS[0], TARGETS[1]], [TARGETS[0], 'sample-rapid'], [TARGETS[1], 'sample-shell'], [TARGETS[2], 'sample-shell'], [TARGETS[2], TARGETS[3]], [TARGETS[3], TARGETS[1]], [TARGETS[3], 'generated-aceExecution-1']])};
    return pairs.flatMap(([a, b]) => [[a, b], [b, a]].map(([player, enemy]) => {
      const p = presets.find(d => d.id === player), e = presets.find(d => d.id === enemy);
      const battle = simulateBattle({ playerPresetId: player, enemyPresetId: enemy,
        playerTerrain: p.terrain, enemyTerrain: e.terrain, record: true });
      return { player, enemy, result: battle.result, turns: battle.turns, entries: battle.log.entries };
    }));
  })()`, 60000)));
  const candidates = TARGETS.map((target) => ({ deck: baseline.decks.find((p) => p.id === target), ...candidateSummary(baseline.battles, target) }));
  const experiments = EXPERIMENTS.map((spec) => {
    const result = runExperiment(spec);
    const summary = candidateSummary(result.battles, spec.target);
    const before = candidates.find((c) => c.target === spec.target);
    const changedMatchups = summary.perspectives.filter((p) => {
      const original = before.perspectives.find((o) => o.side === p.side && o.opponent === p.opponent);
      return p.result !== original.result || p.turns !== original.turns;
    }).map((p) => ({ side: p.side, opponent: p.opponent, result: p.result, turns: p.turns }));
    return { spec, deck: result.deck, cost: result.cost, summary, changedMatchups,
      logs: result.battles.map((b) => ({ player: b.player, enemy: b.enemy, entries: b.entries })) };
  });
  return { schemaVersion: "m1-candidate-analysis-v1", definitions: baseline.definitions, sourceSha256: {
    ...baseline.sourceSha256,
    "scripts/analyze-m1-candidates.js": createHash("sha256").update(fs.readFileSync(__filename)).digest("hex"),
  }, scope: { opponentPool: "fixed_standard_13", excludeSelf: true, battlesPerCandidate: 24, regeneration: false,
    sideLocalExperiments: true, adoptedChanges: false, baselineBattleCount: baseline.battles.length }, candidates, baselineLogs, experiments };
}

if (require.main === module) {
  try {
    const { values } = parseArgs({ options: { output: { type: "string", short: "o" } } });
    const json = `${JSON.stringify(buildAnalysis(), null, 2)}\n`;
    if (values.output) {
      const output = path.resolve(values.output);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, json, { flag: "wx" });
      process.stderr.write(`Analysis written: ${output}\n`);
    } else process.stdout.write(json);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { TARGETS, EXPERIMENTS, candidateSummary, runExperiment, buildAnalysis };
