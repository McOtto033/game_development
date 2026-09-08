const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "prototype", "app.js");
const appSource = fs.readFileSync(appPath, "utf8").replace(/\ninit\(\);\s*$/, "");

const experimentSource = `
const CELL_LANE_PRIORITY = Object.freeze({ 1: 0, 0: 1, 2: 2 });
const CELL_PRIORITY_LABELS = Object.freeze([
  "前中", "前左", "前右",
  "中中", "中左", "中右",
  "後中", "後左", "後右",
]);

function cellTiePriority(unit) {
  return unit.col * 3 + (CELL_LANE_PRIORITY[unit.row] ?? unit.row);
}

function cellPriorityLabel(unit) {
  return CELL_PRIORITY_LABELS[cellTiePriority(unit)] || unitPositionLabel(unit);
}

function cellPriorityActionEffects(actionKey) {
  if (isUltimateActionKey(actionKey)) {
    const key = String(actionKey).slice("ultimate:".length);
    return uniqueValues((ultimateActions[key]?.components || []).flatMap((component) => component.effectElements || []));
  }
  return actionEffectElementIds(actionKey);
}

function cellPriorityActionRole(actionKey) {
  const key = String(actionKey).startsWith("ultimate:") ? String(actionKey).slice("ultimate:".length) : actionKey;
  if (["guard", "shellBind", "thornGuard", "mirrorShell", "generalWard", "frontBulwark", "teamBarrier", "alphaShell"].includes(key)) {
    return { id: "defense", priority: 0 };
  }
  if (["rally", "command", "selfAg", "quickenUltimate", "selfUltimateCharge", "synapticSurge"].includes(key)) {
    return { id: "setup", priority: 0 };
  }
  if (["heal", "lineHeal", "teamHeal", "deepTeamHeal"].includes(key)) {
    return { id: "recovery", priority: 2 };
  }
  const effects = cellPriorityActionEffects(actionKey);
  if (effects.some((effect) => ["singleAttack", "areaAttack", "searchAttack", "executeBonus", "agDebuff", "defenseDown", "healBlock", "barrierPierce", "poison"].includes(effect))) {
    return { id: "offense", priority: 1 };
  }
  return { id: "other", priority: 1 };
}

function recordCellPriorityDiagnostic(state, key, amount = 1) {
  if (!state.cellPriorityDiagnostics) return;
  state.cellPriorityDiagnostics[key] = (state.cellPriorityDiagnostics[key] || 0) + amount;
}

function cellPriorityTraceUnit(unit) {
  return {
    side: unit.side,
    card: unit.card.name,
    action: battleActionFor(unit),
    hp: unit.hp,
    cell: cellPriorityLabel(unit),
    rarity: unit.card.rarity,
    role: cellPriorityActionRole(battleActionFor(unit)).id,
  };
}

function recordCellPriorityTrace(state, item) {
  if (!state.cellPriorityTrace) return;
  state.cellPriorityTrace.push({ turn: state.turn, ...item });
}

function nextActingBatchCellPriority(state, actedIds) {
  const candidates = allLiving(state)
    .filter((unit) => !actedIds.has(unit.id))
    .map((unit) => ({ unit, ag: unitStats(state, unit).ag }));
  if (candidates.length === 0) return null;
  const topAg = Math.max(...candidates.map((candidate) => candidate.ag));
  const topCandidates = candidates.filter((candidate) => candidate.ag === topAg);
  const diagnostics = state.cellPriorityDiagnostics;

  if (topCandidates.length >= 2) {
    diagnostics.sameAgDecisions += 1;
    diagnostics.sameAgCandidateTotal += topCandidates.length;
  }

  const bestCell = Math.min(...topCandidates.map((candidate) => cellTiePriority(candidate.unit)));
  const cellCandidates = topCandidates.filter((candidate) => cellTiePriority(candidate.unit) === bestCell);
  if (topCandidates.length >= 2 && cellCandidates.length < topCandidates.length) {
    diagnostics.cellResolved += 1;
  }

  const maxRarity = Math.max(...cellCandidates.map((candidate) => rarityTiePriority(candidate.unit)));
  const rarityCandidates = cellCandidates.filter((candidate) => rarityTiePriority(candidate.unit) === maxRarity);
  if (cellCandidates.length >= 2 && rarityCandidates.length < cellCandidates.length) {
    diagnostics.rarityResolved += 1;
  }

  const units = rarityCandidates
    .map((candidate) => candidate.unit)
    .sort((a, b) => cellPriorityActionRole(battleActionFor(a)).priority - cellPriorityActionRole(battleActionFor(b)).priority || boardPriority(a) - boardPriority(b));

  if (units.length >= 2 && new Set(units.map((unit) => unit.side)).size >= 2) {
    diagnostics.sameCellSameRarityBatches += 1;
    if (units[0].cardId === units[1].cardId && battleActionFor(units[0]) === battleActionFor(units[1])) {
      diagnostics.symmetricSameActionBatches += 1;
    } else {
      diagnostics.mixedActionBatches += 1;
      const roles = units.map((unit) => cellPriorityActionRole(battleActionFor(unit)).id).sort().join("+");
      diagnostics.mixedRolePairs[roles] = (diagnostics.mixedRolePairs[roles] || 0) + 1;
    }
    diagnostics.batchCells[cellPriorityLabel(units[0])] = (diagnostics.batchCells[cellPriorityLabel(units[0])] || 0) + 1;
    recordCellPriorityTrace(state, {
      kind: "batch",
      topAg,
      units: units.map(cellPriorityTraceUnit),
    });
    return { simultaneous: true, units };
  }

  if (topCandidates.length >= 2) {
    recordCellPriorityTrace(state, {
      kind: "single",
      topAg,
      unit: cellPriorityTraceUnit(units[0]),
      candidates: topCandidates.map((candidate) => cellPriorityTraceUnit(candidate.unit)),
    });
  }
  return { simultaneous: false, units: [units[0]] };
}

function recordQueuedAfterZero(state, entries) {
  entries.forEach(({ unit }) => {
    if (unit.hp <= 0) recordCellPriorityDiagnostic(state, "queuedAfterZero");
  });
}

function executeActionBatchCellPriority(state, batch, log) {
  if (!batch.simultaneous) {
    const unit = batch.units[0];
    if (!unit || unit.hp <= 0) return;
    const actionKey = battleActionFor(unit);
    if (isUltimateActionKey(actionKey)) {
      executeUltimate(state, unit, log);
      return;
    }
    recordActionMetric(state, unit, actionKey);
    actions[actionKey]?.execute(state, unit, log);
    return;
  }

  const entries = batch.units
    .map((unit) => ({ unit, actionKey: battleActionFor(unit), role: cellPriorityActionRole(battleActionFor(unit)) }))
    .sort((a, b) => a.role.priority - b.role.priority || boardPriority(a.unit) - boardPriority(b.unit));

  const actionKeys = new Set(entries.map((entry) => entry.actionKey));
  if (actionKeys.size === 1 && entries[0].actionKey === "guard") {
    recordQueuedAfterZero(state, entries);
    entries.forEach(({ unit, actionKey }) => recordActionMetric(state, unit, actionKey));
    entries.forEach(({ unit }) => executeGuardProtection(state, unit, log));
    entries.forEach(({ unit }) => executeGuardStrike(state, unit, log));
    return;
  }

  if (actionKeys.size === 1 && entries[0].actionKey === "heal") {
    recordQueuedAfterZero(state, entries);
    entries.forEach(({ unit, actionKey }) => recordActionMetric(state, unit, actionKey));
    entries.forEach(({ unit }) => executeHealPrayer(state, unit, log));
    entries.forEach(({ unit }) => executePrayerStrike(state, unit, log));
    return;
  }

  entries.forEach(({ unit, actionKey }) => {
    if (unit.hp <= 0) recordCellPriorityDiagnostic(state, "queuedAfterZero");
    if (isUltimateActionKey(actionKey)) {
      executeUltimate(state, unit, log);
      return;
    }
    recordActionMetric(state, unit, actionKey);
    actions[actionKey]?.execute(state, unit, log);
  });
}

function simulateBattleCellPriority(options = {}) {
  const state = createBattleState(options);
  if (options.trace) state.cellPriorityTrace = [];
  state.cellPriorityDiagnostics = {
    sameAgDecisions: 0,
    sameAgCandidateTotal: 0,
    cellResolved: 0,
    rarityResolved: 0,
    sameCellSameRarityBatches: 0,
    symmetricSameActionBatches: 0,
    mixedActionBatches: 0,
    queuedAfterZero: 0,
    mixedRolePairs: {},
    batchCells: {},
  };
  const log = options.record ? createBattleLog(state) : createSilentLog();
  applyGeneralSkills(state, log, "battleStart");
  applyGeneralSkills(state, log, "battleStartAction");
  recordFrame(log, state, { type: "setup", text: "開戦準備" });
  let result = null;
  let stagnantTurns = 0;
  const repeatedPositions = new Map();

  for (let turn = 1; turn <= SAFETY_TURN_LIMIT; turn += 1) {
    state.turn = turn;
    recordLivingMetrics(state);
    const beforeTurn = progressSignature(state);
    log.push("TURN " + turn);
    recordFrame(log, state, { type: "turn", text: "ターン " + turn });
    resetTurnFlags(state);
    applyTerrainTurnStart(state, log);
    applyStatusTurnStart(state, log);
    result = checkGeneralVictory(state, log);
    if (result) break;
    applyGeneralSkills(state, log, "turnStart");
    chargeUltimates(state);

    const actedIds = new Set();
    while (true) {
      const batch = nextActingBatchCellPriority(state, actedIds);
      if (!batch) break;
      batch.units.forEach((unit) => actedIds.add(unit.id));
      executeActionBatchCellPriority(state, batch, log);
      result = checkGeneralVictory(state, log);
      if (result) break;
    }

    cleanupFallen(state, log);
    if (!result) result = checkGeneralVictory(state, log);
    if (result) break;
    compactRows(state, log);
    recordAlphaExposureStates(state);

    const afterTurn = progressSignature(state);
    const repeatedCount = (repeatedPositions.get(afterTurn) || 0) + 1;
    repeatedPositions.set(afterTurn, repeatedCount);
    stagnantTurns = beforeTurn === afterTurn ? stagnantTurns + 1 : 0;
    if (stagnantTurns >= STALEMATE_REPEAT_LIMIT || repeatedCount >= STALEMATE_REPEAT_LIMIT) {
      result = "draw";
      log.push("HP/位置の停滞または同一盤面の反復が" + STALEMATE_REPEAT_LIMIT + "回発生したため引き分け");
      recordFrame(log, state, { type: "draw", text: "膠着による引き分け" });
      break;
    }
  }

  if (!result) {
    result = "draw";
    log.push(SAFETY_TURN_LIMIT + "ターン経過してもαが倒れないため引き分け");
    recordFrame(log, state, { type: "draw", text: "長期化による引き分け" });
  }

  log.finalState = snapshotBattleState(state);
  log.result = result;
  const metrics = finalizeBattleMetrics(state, result, state.turn);
  return {
    result,
    state: log.finalState,
    log,
    turns: state.turn,
    metrics,
    cellPriorityDiagnostics: state.cellPriorityDiagnostics,
    cellPriorityTrace: state.cellPriorityTrace || [],
  };
}

globalThis.__exports = { simulateBattle, simulateBattleCellPriority, roundRobinPresets };
`;

const context = {
  console,
  performance,
  document: {
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  },
  window: { addEventListener: () => {} },
  localStorage: null,
};

vm.createContext(context);
vm.runInContext(appSource + experimentSource, context, { filename: "same-ag-cell-priority.vm.js" });

const { simulateBattle, simulateBattleCellPriority, roundRobinPresets } = context.__exports;
const targetPresets = roundRobinPresets();

function presetMatches(preset, query) {
  return preset.id === query || preset.name === query;
}

function compactFinalState(battle) {
  return battle.state.units
    .map((unit) => ({
      side: unit.side,
      card: unit.cardName,
      hp: unit.hp,
      maxHp: unit.maxHp,
      row: unit.row,
      col: unit.col,
      general: unit.general,
    }))
    .sort((a, b) => a.side.localeCompare(b.side) || a.col - b.col || a.row - b.row || a.card.localeCompare(b.card));
}

function summarizeBattle(battle, tailCount = 40) {
  const entries = battle.log.entries || [];
  return {
    result: battle.result,
    turns: battle.turns,
    entryCount: entries.length,
    tailEntries: entries.slice(-tailCount),
    finalState: compactFinalState(battle),
  };
}

const args = process.argv.slice(2);
if (args[0] === "--pair") {
  const playerPreset = targetPresets.find((preset) => presetMatches(preset, args[1]));
  const enemyPreset = targetPresets.find((preset) => presetMatches(preset, args[2]));
  if (!playerPreset || !enemyPreset) {
    console.error("Usage: node scripts/research-same-ag-cell-priority.js --pair <player id/name> <enemy id/name>");
    process.exit(1);
  }
  const options = {
    playerPresetId: playerPreset.id,
    enemyPresetId: enemyPreset.id,
    playerTerrain: playerPreset.terrain,
    enemyTerrain: enemyPreset.terrain,
    record: true,
  };
  const currentBattle = simulateBattle(options);
  const candidateBattle = simulateBattleCellPriority(options);
  console.log(JSON.stringify({
    player: playerPreset.name,
    enemy: enemyPreset.name,
    current: {
      result: currentBattle.result,
      turns: currentBattle.turns,
      entries: currentBattle.log.entries,
    },
    cellPriority: {
      result: candidateBattle.result,
      turns: candidateBattle.turns,
      diagnostics: candidateBattle.cellPriorityDiagnostics,
      entries: candidateBattle.log.entries,
    },
  }, null, 2));
  process.exit(0);
}

if (args[0] === "--pair-summary") {
  const playerPreset = targetPresets.find((preset) => presetMatches(preset, args[1]));
  const enemyPreset = targetPresets.find((preset) => presetMatches(preset, args[2]));
  const tailCount = Number(args[3] || 40);
  if (!playerPreset || !enemyPreset) {
    console.error("Usage: node scripts/research-same-ag-cell-priority.js --pair-summary <player id/name> <enemy id/name> [tail entries]");
    process.exit(1);
  }
  const options = {
    playerPresetId: playerPreset.id,
    enemyPresetId: enemyPreset.id,
    playerTerrain: playerPreset.terrain,
    enemyTerrain: enemyPreset.terrain,
    record: true,
  };
  const currentBattle = simulateBattle(options);
  const candidateBattle = simulateBattleCellPriority({ ...options, trace: true });
  console.log(JSON.stringify({
    player: playerPreset.name,
    enemy: enemyPreset.name,
    current: summarizeBattle(currentBattle, tailCount),
    cellPriority: {
      ...summarizeBattle(candidateBattle, tailCount),
      diagnostics: candidateBattle.cellPriorityDiagnostics,
      traceCount: candidateBattle.cellPriorityTrace.length,
      traceTail: candidateBattle.cellPriorityTrace.slice(-tailCount),
    },
  }, null, 2));
  process.exit(0);
}

function emptyAggregate() {
  return {
    pairings: 0,
    playerWins: 0,
    enemyWins: 0,
    draws: 0,
    totalTurns: 0,
    turnHistogram: {},
    earlyDecisions: 0,
    longDecisions: 0,
    standings: new Map(targetPresets.map((preset) => [preset.id, {
      id: preset.id,
      name: preset.name,
      wins: 0,
      losses: 0,
      draws: 0,
      totalTurns: 0,
    }])),
    diagnostics: {
      sameAgDecisions: 0,
      sameAgCandidateTotal: 0,
      cellResolved: 0,
      rarityResolved: 0,
      sameCellSameRarityBatches: 0,
      symmetricSameActionBatches: 0,
      mixedActionBatches: 0,
      queuedAfterZero: 0,
      mixedRolePairs: {},
      batchCells: {},
    },
  };
}

function addCounterMap(target, source) {
  Object.entries(source || {}).forEach(([key, value]) => {
    target[key] = (target[key] || 0) + value;
  });
}

function addBattle(aggregate, playerPreset, enemyPreset, battle) {
  aggregate.pairings += 1;
  aggregate.totalTurns += battle.turns;
  aggregate.turnHistogram[battle.turns] = (aggregate.turnHistogram[battle.turns] || 0) + 1;
  if (battle.turns <= 3 && battle.result !== "draw") aggregate.earlyDecisions += 1;
  if (battle.turns >= 15) aggregate.longDecisions += 1;
  if (battle.result === "player") aggregate.playerWins += 1;
  if (battle.result === "enemy") aggregate.enemyWins += 1;
  if (battle.result === "draw") aggregate.draws += 1;

  const playerStanding = aggregate.standings.get(playerPreset.id);
  const enemyStanding = aggregate.standings.get(enemyPreset.id);
  playerStanding.totalTurns += battle.turns;
  enemyStanding.totalTurns += battle.turns;
  if (battle.result === "player") {
    playerStanding.wins += 1;
    enemyStanding.losses += 1;
  } else if (battle.result === "enemy") {
    playerStanding.losses += 1;
    enemyStanding.wins += 1;
  } else {
    playerStanding.draws += 1;
    enemyStanding.draws += 1;
  }

  const diagnostics = battle.cellPriorityDiagnostics || {};
  Object.keys(aggregate.diagnostics).forEach((key) => {
    if (key === "mixedRolePairs" || key === "batchCells") return;
    aggregate.diagnostics[key] += diagnostics[key] || 0;
  });
  addCounterMap(aggregate.diagnostics.mixedRolePairs, diagnostics.mixedRolePairs);
  addCounterMap(aggregate.diagnostics.batchCells, diagnostics.batchCells);
}

function finishAggregate(aggregate) {
  const standingPairings = targetPresets.length * 2;
  const standings = [...aggregate.standings.values()]
    .map((item) => ({
      ...item,
      winRate: item.wins / standingPairings,
      drawRate: item.draws / standingPairings,
      avgTurns: item.totalTurns / standingPairings,
    }))
    .sort((a, b) => b.winRate - a.winRate || a.drawRate - b.drawRate || a.name.localeCompare(b.name));
  return {
    pairings: aggregate.pairings,
    results: {
      playerWins: aggregate.playerWins,
      enemyWins: aggregate.enemyWins,
      draws: aggregate.draws,
      drawRate: aggregate.draws / aggregate.pairings,
    },
    avgTurns: aggregate.totalTurns / aggregate.pairings,
    earlyDecisionRate: aggregate.earlyDecisions / aggregate.pairings,
    longDecisionRate: aggregate.longDecisions / aggregate.pairings,
    turnHistogram: aggregate.turnHistogram,
    diagnostics: aggregate.diagnostics,
    standings,
  };
}

const current = emptyAggregate();
const cellPriority = emptyAggregate();
const changedPairs = [];

for (const playerPreset of targetPresets) {
  for (const enemyPreset of targetPresets) {
    const options = {
      playerPresetId: playerPreset.id,
      enemyPresetId: enemyPreset.id,
      playerTerrain: playerPreset.terrain,
      enemyTerrain: enemyPreset.terrain,
      record: false,
    };
    const currentBattle = simulateBattle(options);
    const candidateBattle = simulateBattleCellPriority(options);
    addBattle(current, playerPreset, enemyPreset, currentBattle);
    addBattle(cellPriority, playerPreset, enemyPreset, candidateBattle);
    if (currentBattle.result !== candidateBattle.result || currentBattle.turns !== candidateBattle.turns) {
      changedPairs.push({
        player: playerPreset.name,
        enemy: enemyPreset.name,
        current: { result: currentBattle.result, turns: currentBattle.turns },
        cellPriority: { result: candidateBattle.result, turns: candidateBattle.turns },
      });
    }
  }
}

console.log(JSON.stringify({
  decks: targetPresets.length,
  note: "One deterministic battle per pairing. Candidate uses cell priority > rarity and same-AG/same-cell/same-rarity max-2 batches. Whole-action priority is provisional: defense/setup > offense/disruption > recovery.",
  current: finishAggregate(current),
  cellPriority: finishAggregate(cellPriority),
  changedPairs,
}, null, 2));
