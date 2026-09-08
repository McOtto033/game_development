const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "prototype", "app.js");
const appSource = fs.readFileSync(appPath, "utf8").replace(/\ninit\(\);\s*$/, "");

const experimentSource = `
function twoPhaseActionEffects(actionKey) {
  if (isUltimateActionKey(actionKey)) {
    const key = String(actionKey).slice("ultimate:".length);
    return uniqueValues((ultimateActions[key]?.components || []).flatMap((component) => component.effectElements || []));
  }
  return actionEffectElementIds(actionKey);
}

function twoPhaseActionKind(actionKey) {
  if (actionKey === "guard" || actionKey === "heal") return "mixed";
  const effects = twoPhaseActionEffects(actionKey);
  const intervention = ["armor", "barrier", "damageCut", "heal", "atBuff", "agBuff", "ultimateCharge", "contactPoison", "reflect"];
  const resolution = ["singleAttack", "areaAttack", "searchAttack", "executeBonus", "agDebuff", "defenseDown", "healBlock", "barrierPierce", "poison"];
  const hasIntervention = effects.some((effect) => intervention.includes(effect));
  const hasResolution = effects.some((effect) => resolution.includes(effect));
  if (hasIntervention && !hasResolution) return "intervention";
  return "resolution";
}

function executeQueuedAction(state, unit, actionKey, log) {
  if (isUltimateActionKey(actionKey)) {
    executeUltimate(state, unit, log);
    return;
  }
  actions[actionKey]?.execute(state, unit, log);
}

function nextActingBatchTwoPhase(state, actedIds) {
  const candidates = allLiving(state)
    .filter((unit) => !actedIds.has(unit.id))
    .map((unit) => ({ unit, ag: unitStats(state, unit).ag }));
  if (candidates.length === 0) return null;
  const topAg = Math.max(...candidates.map((candidate) => candidate.ag));
  const topCandidates = candidates.filter((candidate) => candidate.ag === topAg);
  const maxRarity = Math.max(...topCandidates.map((candidate) => rarityTiePriority(candidate.unit)));
  const batchCandidates = topCandidates
    .filter((candidate) => rarityTiePriority(candidate.unit) === maxRarity)
    .sort((a, b) => boardPriority(a.unit) - boardPriority(b.unit));
  const units = batchCandidates.map((candidate) => candidate.unit);

  if (state.twoPhaseDiagnostics && topCandidates.length >= 2) {
    state.twoPhaseDiagnostics.sameAgDecisions += 1;
    if (batchCandidates.length < topCandidates.length) state.twoPhaseDiagnostics.rarityGated += 1;
    if (units.length >= 2) {
      state.twoPhaseDiagnostics.multiUnitBatches += 1;
      if (new Set(units.map((unit) => unit.side)).size >= 2) state.twoPhaseDiagnostics.crossSideBatches += 1;
      const kinds = units.map((unit) => twoPhaseActionKind(battleActionFor(unit)));
      if (kinds.includes("intervention") && kinds.some((kind) => kind === "resolution" || kind === "mixed")) {
        state.twoPhaseDiagnostics.interventionResolutionBatches += 1;
      }
    }
  }

  if (state.metrics && topCandidates.length >= 2) {
    const tie = state.metrics.tieBreaks;
    tie.total += 1;
    if (batchCandidates.length < topCandidates.length) {
      tie.rarity += 1;
    } else if (units.length >= 2 && new Set(units.map((unit) => unit.side)).size >= 2) {
      tie.simultaneous += 1;
    } else {
      tie.position += 1;
    }
  }

  return { units };
}

function executeActionBatchTwoPhase(state, batch, log) {
  const entries = batch.units.map((unit) => ({ unit, actionKey: battleActionFor(unit), kind: twoPhaseActionKind(battleActionFor(unit)) }));

  entries.forEach(({ unit, actionKey }) => {
    if (!isUltimateActionKey(actionKey)) recordActionMetric(state, unit, actionKey);
  });

  entries.forEach(({ unit, actionKey, kind }) => {
    if (actionKey === "guard") {
      executeGuardProtection(state, unit, log);
    } else if (actionKey === "heal") {
      executeHealPrayer(state, unit, log);
    } else if (kind === "intervention") {
      executeQueuedAction(state, unit, actionKey, log);
    }
  });

  entries.forEach(({ unit, actionKey, kind }) => {
    if (unit.hp <= 0) {
      if (state.twoPhaseDiagnostics) state.twoPhaseDiagnostics.zeroHpQueuedActions += 1;
      if (!globalThis.TWO_PHASE_ALLOW_ZERO_HP) return;
    }
    if (actionKey === "guard") {
      executeGuardStrike(state, unit, log);
    } else if (actionKey === "heal") {
      executePrayerStrike(state, unit, log);
    } else if (kind === "resolution") {
      executeQueuedAction(state, unit, actionKey, log);
    }
  });
}

function simulateBattleTwoPhase(options = {}) {
  const state = createBattleState(options);
  state.twoPhaseDiagnostics = {
    allowZeroHpQueuedActions: Boolean(globalThis.TWO_PHASE_ALLOW_ZERO_HP),
    sameAgDecisions: 0,
    rarityGated: 0,
    multiUnitBatches: 0,
    crossSideBatches: 0,
    interventionResolutionBatches: 0,
    zeroHpQueuedActions: 0,
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
      const batch = nextActingBatchTwoPhase(state, actedIds);
      if (!batch) break;
      batch.units.forEach((unit) => actedIds.add(unit.id));
      executeActionBatchTwoPhase(state, batch, log);
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
    twoPhaseDiagnostics: state.twoPhaseDiagnostics,
  };
}

globalThis.__exports = { simulateBattle, simulateBattleTwoPhase, roundRobinPresets };
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
vm.runInContext(appSource + experimentSource, context, { filename: "same-ag-two-phase.vm.js" });

const { simulateBattle, simulateBattleTwoPhase, roundRobinPresets } = context.__exports;
const targetPresets = roundRobinPresets();

function presetMatches(preset, query) {
  return preset.id === query || preset.name === query;
}

const args = process.argv.slice(2);
if (args[0] === "--pair") {
  const playerPreset = targetPresets.find((preset) => presetMatches(preset, args[1]));
  const enemyPreset = targetPresets.find((preset) => presetMatches(preset, args[2]));
  if (!playerPreset || !enemyPreset) {
    console.error("Usage: node scripts/research-same-ag-two-phase.js --pair <player id/name> <enemy id/name>");
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
  context.TWO_PHASE_ALLOW_ZERO_HP = false;
  const twoPhaseNoZeroBattle = simulateBattleTwoPhase(options);
  context.TWO_PHASE_ALLOW_ZERO_HP = true;
  const twoPhaseQueuedBattle = simulateBattleTwoPhase(options);
  console.log(JSON.stringify({
    player: playerPreset.name,
    enemy: enemyPreset.name,
    current: {
      result: currentBattle.result,
      turns: currentBattle.turns,
      entries: currentBattle.log.entries,
    },
    twoPhaseNoZero: {
      result: twoPhaseNoZeroBattle.result,
      turns: twoPhaseNoZeroBattle.turns,
      diagnostics: twoPhaseNoZeroBattle.twoPhaseDiagnostics,
      entries: twoPhaseNoZeroBattle.log.entries,
    },
    twoPhaseQueued: {
      result: twoPhaseQueuedBattle.result,
      turns: twoPhaseQueuedBattle.turns,
      diagnostics: twoPhaseQueuedBattle.twoPhaseDiagnostics,
      entries: twoPhaseQueuedBattle.log.entries,
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
      rarityGated: 0,
      multiUnitBatches: 0,
      crossSideBatches: 0,
      interventionResolutionBatches: 0,
      zeroHpQueuedActions: 0,
    },
  };
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

  const diagnostics = battle.twoPhaseDiagnostics || {};
  Object.keys(aggregate.diagnostics).forEach((key) => {
    aggregate.diagnostics[key] += diagnostics[key] || 0;
  });
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
const twoPhaseNoZero = emptyAggregate();
const twoPhaseQueued = emptyAggregate();
const changedPairsNoZero = [];
const changedPairsQueued = [];

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
    context.TWO_PHASE_ALLOW_ZERO_HP = false;
    const twoPhaseNoZeroBattle = simulateBattleTwoPhase(options);
    context.TWO_PHASE_ALLOW_ZERO_HP = true;
    const twoPhaseQueuedBattle = simulateBattleTwoPhase(options);
    addBattle(current, playerPreset, enemyPreset, currentBattle);
    addBattle(twoPhaseNoZero, playerPreset, enemyPreset, twoPhaseNoZeroBattle);
    addBattle(twoPhaseQueued, playerPreset, enemyPreset, twoPhaseQueuedBattle);
    if (currentBattle.result !== twoPhaseNoZeroBattle.result || currentBattle.turns !== twoPhaseNoZeroBattle.turns) {
      changedPairsNoZero.push({
        player: playerPreset.name,
        enemy: enemyPreset.name,
        current: { result: currentBattle.result, turns: currentBattle.turns },
        twoPhase: { result: twoPhaseNoZeroBattle.result, turns: twoPhaseNoZeroBattle.turns },
      });
    }
    if (currentBattle.result !== twoPhaseQueuedBattle.result || currentBattle.turns !== twoPhaseQueuedBattle.turns) {
      changedPairsQueued.push({
        player: playerPreset.name,
        enemy: enemyPreset.name,
        current: { result: currentBattle.result, turns: currentBattle.turns },
        twoPhase: { result: twoPhaseQueuedBattle.result, turns: twoPhaseQueuedBattle.turns },
      });
    }
  }
}

const report = {
  decks: targetPresets.length,
  note: "One deterministic battle per pairing. Equivalent to the current 100-battle series shape because no RNG is used.",
  current: finishAggregate(current),
  twoPhaseNoZero: finishAggregate(twoPhaseNoZero),
  twoPhaseQueued: finishAggregate(twoPhaseQueued),
  changedPairsNoZero,
  changedPairsQueued,
};

console.log(JSON.stringify(report, null, 2));
