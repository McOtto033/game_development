const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { parseArgs } = require("node:util");
const { loadPrototype } = require("../tests/helpers/prototype");

const DEFINITIONS = Object.freeze({
  version: "non-game-v1",
  rateUnit: "fraction_0_to_1",
  settlement: "Winner declared by simulateBattle; draws are not settlements. Use returned turns, including opening effects resolved at T1.",
  earlySettlement: "Cumulative wins decided by T1/T2. Report all-battle and decisive-battle denominators separately.",
  actions: "Normal actions plus ultimates, including wait and targetless actions. Exclude triggered alpha/trait/poison effects. Same-AG guaranteed actions count before batch effects.",
  loserActions: "One losing side per decisive battle; exclude draws. Sum actions over every initial unit on that side.",
  firstActionDeath: "First KO with actionsBeforeFirstKo === 0. Divide by all initially deployed units, including survivors; also report losing-side units excluding draws.",
  emptyDenominator: "rate/mean is null, never zero.",
  effectiveSettlement: "not_evaluated; no counterfactual definition adopted",
  completeLock: "not_evaluated; absence of published action control does not imply a measured zero",
});

function fraction(numerator, denominator) {
  return { numerator, denominator, rate: denominator ? numerator / denominator : null };
}

function histogram(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Object.fromEntries([...counts].sort(([a], [b]) => a - b));
}

function distribution(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return { count: values.length, total, mean: values.length ? total / values.length : null, histogram: histogram(values) };
}

function validateBattle(battle) {
  const integer = (value) => Number.isInteger(value) && value >= 0;
  if (!["player", "enemy", "draw"].includes(battle.result) || !integer(battle.turns) || battle.turns < 1) {
    throw new Error("Invalid battle result/turns");
  }
  for (const side of ["player", "enemy"]) {
    const metrics = battle.metrics?.sides?.[side];
    if (!metrics?.units || !Object.keys(metrics.units).length) throw new Error("Missing deployed-unit metrics");
    const units = Object.values(metrics.units);
    for (const unit of units) {
      if (!integer(unit.actions) || !integer(unit.ultimates)
        || (unit.koTurn === null ? unit.actionsBeforeFirstKo !== null
          : !integer(unit.koTurn) || unit.koTurn > battle.turns || !integer(unit.actionsBeforeFirstKo)
            || unit.actionsBeforeFirstKo > unit.actions + unit.ultimates)) {
        throw new Error("Missing or invalid non-game-v1 unit metrics");
      }
    }
    for (const key of ["actions", "ultimates"]) {
      if (metrics[key] !== units.reduce((sum, unit) => sum + unit[key], 0)) throw new Error("Inconsistent side action totals");
    }
  }
}

function summarizeBattles(battles) {
  battles.forEach(validateBattle);
  const decisive = battles.filter((battle) => battle.result !== "draw");
  const draws = battles.filter((battle) => battle.result === "draw");
  const losers = decisive.map((battle) => battle.metrics.sides[battle.result === "player" ? "enemy" : "player"]);
  const units = battles.flatMap((battle) => ["player", "enemy"].flatMap((side) => Object.values(battle.metrics.sides[side].units)));
  const losingUnits = losers.flatMap((side) => Object.values(side.units));
  const firstDeaths = (records) => fraction(records.filter((unit) => unit.koTurn !== null && unit.actionsBeforeFirstKo === 0).length, records.length);
  const early = (turn) => {
    const count = decisive.filter((battle) => battle.turns <= turn).length;
    return { allBattles: fraction(count, battles.length), decisiveBattles: fraction(count, decisive.length) };
  };
  return {
    battleCount: battles.length,
    results: Object.fromEntries(["player", "enemy", "draw"].map((result) => [result, battles.filter((battle) => battle.result === result).length])),
    terminalTurns: distribution(battles.map((battle) => battle.turns)),
    settlementTurns: distribution(decisive.map((battle) => battle.turns)),
    drawTurns: distribution(draws.map((battle) => battle.turns)),
    earlySettlement: { byT1: early(1), byT2: early(2) },
    loserActions: { ...distribution(losers.map((side) => side.actions + side.ultimates)), excludedDraws: draws.length },
    firstActionDeaths: { allUnits: firstDeaths(units), losingUnits: firstDeaths(losingUnits), loserExcludedDraws: draws.length },
    effectiveSettlement: { status: "not_evaluated", rate: null },
    completeLock: { status: "not_evaluated", rate: null },
  };
}

function collectStandardBattles() {
  const app = loadPrototype();
  // Execute the unmodified production engine with fresh, empty browser storage.
  return JSON.parse(JSON.stringify(app.evaluate(`(() => {
    const decks = roundRobinPresets();
    return {
      phase: ACTIVE_RULESET_PHASE,
      decks: decks.map(p => ({ ...p, cost: presetCost(p) })),
      battles: decks.flatMap(p => decks.map(e => {
        const b = simulateBattle({ playerPresetId: p.id, enemyPresetId: e.id,
          playerTerrain: p.terrain, enemyTerrain: e.terrain, record: false });
        return { player: p.id, enemy: e.id, result: b.result, turns: b.turns, metrics: b.metrics };
      }))
    };
  })()`, 60000)));
}

function buildReport() {
  const data = collectStandardBattles();
  const root = path.resolve(__dirname, "..");
  const sources = ["prototype/app.js", "prototype/index.html", "tests/helpers/prototype.js", "scripts/report-standard-battles.js"];
  return {
    schemaVersion: "standard-battles-v1",
    definitions: DEFINITIONS,
    sourceSha256: Object.fromEntries(sources.map((file) => [file, createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")])),
    scope: { phase: data.phase, deckCount: data.decks.length, orderedPairs: true, battlesPerPair: 1, browserSavedEdits: false, statisticalTrials: false },
    decks: data.decks,
    summary: summarizeBattles(data.battles),
    nonMirrorSummary: summarizeBattles(data.battles.filter((battle) => battle.player !== battle.enemy)),
    battles: data.battles,
  };
}

if (require.main === module) {
  try {
    const { values } = parseArgs({ options: { output: { type: "string", short: "o" } } });
    const json = `${JSON.stringify(buildReport(), null, 2)}\n`;
    if (values.output) {
      const output = path.resolve(values.output);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, json, { flag: "wx" });
      process.stderr.write(`Report written: ${output}\n`);
    } else {
      process.stdout.write(json);
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { DEFINITIONS, summarizeBattles, buildReport };
