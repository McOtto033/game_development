const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "prototype", "app.js");
const appSource = fs.readFileSync(appPath, "utf8").replace(/\ninit\(\);\s*$/, "");

const experimentSource = `
const D4_CELL_LANE_PRIORITY = Object.freeze({ 1: 0, 0: 1, 2: 2 });
const D4_CELL_PRIORITY_LABELS = Object.freeze([
  "前中", "前左", "前右",
  "中中", "中左", "中右",
  "後中", "後左", "後右",
]);

const D4_STATUS_FAMILY_ORDER = Object.freeze({
  damageTaken: 0,
  healControl: 1,
  actionControl: 2,
  dot: 3,
  regen: 4,
  marker: 5,
});

const D4_STATUS_FAMILY = Object.freeze({
  defenseDown: "damageTaken",
  healBlock: "healControl",
  paralysis: "actionControl",
  poison: "dot",
  regen: "regen",
  contactPoison: "marker",
  reflectShell: "marker",
});

function d4CellTiePriority(unit) {
  return unit.col * 3 + (D4_CELL_LANE_PRIORITY[unit.row] ?? unit.row);
}

function d4CellPriorityLabel(unit) {
  return D4_CELL_PRIORITY_LABELS[d4CellTiePriority(unit)] || unitPositionLabel(unit);
}

function d4ActionBaseKey(actionKey) {
  return isUltimateActionKey(actionKey) ? String(actionKey).slice("ultimate:".length) : actionKey;
}

function d4ActionEffects(actionKey) {
  if (isUltimateActionKey(actionKey)) {
    const key = d4ActionBaseKey(actionKey);
    return uniqueValues((ultimateActions[key]?.components || []).flatMap((component) => component.effectElements || []));
  }
  return actionEffectElementIds(actionKey);
}

function d4ActionRole(actionKey) {
  const effects = d4ActionEffects(actionKey);
  if (effects.some((effect) => ["armor", "barrier", "damageCut", "contactPoison", "reflect", "counter"].includes(effect))) {
    return "defense";
  }
  if (effects.some((effect) => ["singleAttack", "areaAttack", "searchAttack", "executeBonus", "barrierPierce"].includes(effect))) {
    return "attack";
  }
  if (effects.includes("heal")) return "heal";
  if (effects.some((effect) => ["defenseDown", "healBlock", "poison", "atBuff", "agBuff", "atDebuff", "agDebuff", "ultimateCharge"].includes(effect))) {
    return "stageEnd";
  }
  return "other";
}

function d4TraceUnit(unit) {
  return {
    side: unit.side,
    card: unit.card.name,
    action: battleActionFor(unit),
    hp: unit.hp,
    cell: d4CellPriorityLabel(unit),
    rarity: unit.card.rarity,
    role: d4ActionRole(battleActionFor(unit)),
  };
}

function d4RecordDiagnostic(state, key, amount = 1) {
  if (!state.d4Diagnostics) return;
  state.d4Diagnostics[key] = (state.d4Diagnostics[key] || 0) + amount;
}

function d4AddCounter(target, key, amount = 1) {
  target[key] = (target[key] || 0) + amount;
}

function nextActingBatchD4(state, actedIds) {
  const candidates = allLiving(state)
    .filter((unit) => !actedIds.has(unit.id))
    .map((unit) => ({ unit, ag: unitStats(state, unit).ag }));
  if (candidates.length === 0) return null;
  const topAg = Math.max(...candidates.map((candidate) => candidate.ag));
  const topCandidates = candidates.filter((candidate) => candidate.ag === topAg);
  const diagnostics = state.d4Diagnostics;

  if (topCandidates.length >= 2) {
    diagnostics.sameAgDecisions += 1;
    diagnostics.sameAgCandidateTotal += topCandidates.length;
  }

  const bestCell = Math.min(...topCandidates.map((candidate) => d4CellTiePriority(candidate.unit)));
  const cellCandidates = topCandidates.filter((candidate) => d4CellTiePriority(candidate.unit) === bestCell);
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
    .sort((a, b) => d4CellTiePriority(a) - d4CellTiePriority(b) || boardPriority(a) - boardPriority(b));

  if (units.length >= 2 && new Set(units.map((unit) => unit.side)).size >= 2) {
    diagnostics.sameCellSameRarityBatches += 1;
    diagnostics.batchCells[d4CellPriorityLabel(units[0])] = (diagnostics.batchCells[d4CellPriorityLabel(units[0])] || 0) + 1;
    const roles = units.map((unit) => d4ActionRole(battleActionFor(unit))).sort().join("+");
    diagnostics.rolePairs[roles] = (diagnostics.rolePairs[roles] || 0) + 1;
    if (units[0].cardId === units[1].cardId && battleActionFor(units[0]) === battleActionFor(units[1])) {
      diagnostics.symmetricSameActionBatches += 1;
    } else {
      diagnostics.mixedActionBatches += 1;
    }
    if (state.d4Trace) {
      state.d4Trace.push({
        turn: state.turn,
        kind: "batch",
        topAg,
        units: units.map(d4TraceUnit),
      });
    }
    return { simultaneous: true, units };
  }

  return { simultaneous: false, units: [units[0]] };
}

function d4SegmentsFor(actionKey) {
  const key = d4ActionBaseKey(actionKey);
  const ultimate = isUltimateActionKey(actionKey);
  const segment = (...ops) => ops.filter(Boolean);
  const attack = (kind) => ({ layer: "attack", kind });
  const defense = (kind) => ({ layer: "defense", kind });
  const healOp = (kind) => ({ layer: "heal", kind });
  const stage = (kind) => ({ layer: "stage", kind });

  if (!ultimate) {
    switch (key) {
      case "slash": return [segment(attack("slash")), segment()];
      case "pierce": return [segment(attack("pierce")), segment()];
      case "sweep": return [segment(attack("sweep")), segment()];
      case "guard": return [segment(defense("guardProtection")), segment(attack("guardStrike"))];
      case "rally": return [segment(stage("rally")), segment()];
      case "heal": return [segment(healOp("healPrayer")), segment(attack("prayerStrike"))];
      case "lineHeal": return [segment(healOp("lineHeal")), segment()];
      case "generalWard": return [segment(defense("generalWardArmor"), healOp("generalWardHeal")), segment()];
      case "snipe": return [segment(attack("snipe")), segment()];
      case "raid": return [segment(attack("raid")), segment()];
      case "command": return [segment(stage("command")), segment()];
      case "siege": return [segment(attack("siege")), segment()];
      case "lowHpStrike": return [segment(attack("lowHpStrike")), segment()];
      case "selfAg": return [segment(stage("selfAg")), segment()];
      case "agSnare": return [segment(stage("agSnare")), segment()];
      case "shellBind": return [segment(defense("shellBind")), segment()];
      case "quickenUltimate": return [segment(stage("quickenUltimate")), segment()];
      case "acidBite": return [segment(attack("acidBite")), segment()];
      case "acidSweepDefense": return [segment(attack("acidSweepDefense")), segment()];
      case "acidSweepHealBlock": return [segment(attack("acidSweepHealBlock")), segment()];
      case "drainStrike": return [segment(attack("drainStrike"), healOp("drainStrikeHeal")), segment()];
      case "barrierPierceStrike": return [segment(attack("barrierPierceStrike")), segment()];
      case "healBlockPulse": return [segment(stage("healBlockPulse")), segment()];
      case "midRearPressure": return [segment(attack("midRearPressure")), segment()];
      case "sporeCrush": return [segment(attack("sporeCrush")), segment()];
      case "sporeBarrage": return [segment(attack("sporeBarrage")), segment()];
      case "toxicNeedle": return [segment(stage("toxicNeedle")), segment()];
      case "toxicCloud": return [segment(stage("toxicCloud")), segment()];
      case "thornGuard": return [segment(defense("thornGuard")), segment()];
      case "mirrorShell": return [segment(defense("mirrorShell")), segment()];
      case "selfUltimateCharge": return [segment(stage("selfUltimateCharge")), segment()];
      case "wait": return [segment(stage("wait")), segment()];
      default: return [segment(stage("fallbackWholeAction")), segment()];
    }
  }

  switch (key) {
    case "alphaClaw": return [segment(attack("ultimate:alphaClaw")), segment()];
    case "rearExecution": return [segment(attack("ultimate:rearExecution")), segment()];
    case "lineCrush": return [segment(attack("ultimate:lineCrush")), segment()];
    case "wideScorch": return [segment(attack("ultimate:wideScorch")), segment()];
    case "toxicBloom": return [segment(attack("ultimate:toxicBloom")), segment()];
    case "frontBulwark": return [segment(defense("ultimate:frontBulwark")), segment()];
    case "teamBarrier": return [segment(defense("ultimate:teamBarrier")), segment()];
    case "teamHeal": return [segment(healOp("ultimate:teamHeal")), segment()];
    case "deepTeamHeal": return [segment(healOp("ultimate:deepTeamHeal")), segment()];
    case "alphaShell": return [segment(defense("ultimate:alphaShellArmor"), healOp("ultimate:alphaShellHeal")), segment()];
    case "synapticSurge": return [segment(stage("ultimate:synapticSurge")), segment()];
    default: return [segment(stage("fallbackWholeUltimate")), segment()];
  }
}

function executeActionBatchD4(state, batch, log) {
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

  const entries = batch.units.map((unit) => {
    const actionKey = battleActionFor(unit);
    return {
      unit,
      actionKey,
      segments: d4SegmentsFor(actionKey),
      scratch: {},
    };
  });

  entries.forEach((entry) => {
    if (entry.unit.hp <= 0) d4RecordDiagnostic(state, "queuedAfterZero");
    if (isUltimateActionKey(entry.actionKey)) {
      recordUltimateMetric(state, entry.unit);
      log.push(unitLabel(entry.unit) + " の必殺技: " + entry.unit.card.ultimate.name);
      entry.unit.ultimateCharge = 0;
    } else {
      recordActionMetric(state, entry.unit, entry.actionKey);
    }
  });

  for (let segmentIndex = 0; segmentIndex < 2; segmentIndex += 1) {
    const stageQueue = [];
    d4RunLayer(state, entries, segmentIndex, "defense", log, stageQueue);
    d4RunLayer(state, entries, segmentIndex, "attack", log, stageQueue);
    d4RunLayer(state, entries, segmentIndex, "heal", log, stageQueue);
    d4RunStageQueue(state, entries, segmentIndex, log, stageQueue);
  }
}

function d4RunLayer(state, entries, segmentIndex, layer, log, stageQueue) {
  entries.forEach((entry) => {
    const operations = (entry.segments[segmentIndex] || []).filter((operation) => operation.layer === layer);
    operations.forEach((operation) => d4RunOperation(state, entry, operation, log, stageQueue));
  });
}

function d4RunOperation(state, entry, operation, log, stageQueue) {
  if (entry.unit.hp <= 0) d4RecordDiagnostic(state, "queuedAfterZero");
  if (operation.layer === "defense") return d4RunDefenseOperation(state, entry, operation.kind, log);
  if (operation.layer === "attack") return d4RunAttackOperation(state, entry, operation.kind, log, stageQueue);
  if (operation.layer === "heal") return d4RunHealOperation(state, entry, operation.kind, log);
  if (operation.layer === "stage") {
    stageQueue.push({ entry, kind: operation.kind });
    return null;
  }
  return null;
}

function d4RunDefenseOperation(state, entry, kind, log) {
  const unit = entry.unit;
  switch (kind) {
    case "guardProtection": return executeGuardProtection(state, unit, log);
    case "shellBind": return executeShellBind(state, unit, log);
    case "generalWardArmor": return d4GeneralWardArmor(state, unit, log);
    case "thornGuard": return d4ThornGuard(state, unit, log);
    case "mirrorShell": return d4MirrorShell(state, unit, log);
    case "ultimate:frontBulwark": return ultimateActions.frontBulwark.execute(state, unit, log);
    case "ultimate:teamBarrier": return ultimateActions.teamBarrier.execute(state, unit, log);
    case "ultimate:alphaShellArmor": return d4AlphaShellArmor(state, unit, log);
    default:
      state.d4Diagnostics.fallbacks[kind] = (state.d4Diagnostics.fallbacks[kind] || 0) + 1;
      return null;
  }
}

function d4RunAttackOperation(state, entry, kind, log, stageQueue) {
  const unit = entry.unit;
  switch (kind) {
    case "slash": return actions.slash.execute(state, unit, log);
    case "pierce": return actions.pierce.execute(state, unit, log);
    case "sweep": return actions.sweep.execute(state, unit, log);
    case "guardStrike": return executeGuardStrike(state, unit, log);
    case "prayerStrike": return executePrayerStrike(state, unit, log);
    case "snipe": return actions.snipe.execute(state, unit, log);
    case "raid": return actions.raid.execute(state, unit, log);
    case "siege": return actions.siege.execute(state, unit, log);
    case "lowHpStrike": return actions.lowHpStrike.execute(state, unit, log);
    case "acidBite": return d4AttackWithStatus(state, entry, "acidBite", "healBlock", HEAL_BLOCK_DURATION, log, stageQueue);
    case "acidSweepDefense": return d4AttackWithStatus(state, entry, "acidSweepDefense", "defenseDown", DEFENSE_DOWN_DURATION, log, stageQueue);
    case "acidSweepHealBlock": return d4AttackWithStatus(state, entry, "acidSweepHealBlock", "healBlock", HEAL_BLOCK_DURATION, log, stageQueue);
    case "drainStrike": return d4DrainStrikeAttack(state, entry, log);
    case "barrierPierceStrike": return actions.barrierPierceStrike.execute(state, unit, log);
    case "midRearPressure": return actions.midRearPressure.execute(state, unit, log);
    case "sporeCrush": return actions.sporeCrush.execute(state, unit, log);
    case "sporeBarrage": return d4AttackWithStatus(state, entry, "sporeBarrage", "poison", POISON_DURATION, log, stageQueue);
    case "ultimate:alphaClaw": return ultimateActions.alphaClaw.execute(state, unit, log);
    case "ultimate:rearExecution": return ultimateActions.rearExecution.execute(state, unit, log);
    case "ultimate:lineCrush": return ultimateActions.lineCrush.execute(state, unit, log);
    case "ultimate:wideScorch": return ultimateActions.wideScorch.execute(state, unit, log);
    case "ultimate:toxicBloom": return d4ToxicBloomAttack(state, entry, log, stageQueue);
    default:
      state.d4Diagnostics.fallbacks[kind] = (state.d4Diagnostics.fallbacks[kind] || 0) + 1;
      return null;
  }
}

function d4RunHealOperation(state, entry, kind, log) {
  const unit = entry.unit;
  switch (kind) {
    case "healPrayer": return executeHealPrayer(state, unit, log);
    case "lineHeal": return actions.lineHeal.execute(state, unit, log);
    case "generalWardHeal": return d4GeneralWardHeal(state, unit, log);
    case "drainStrikeHeal": return d4DrainStrikeHeal(state, entry, log);
    case "ultimate:teamHeal": return executeTeamHealUltimate(state, unit, Math.max(8, Math.floor(unitStats(state, unit).at * 0.55)), log);
    case "ultimate:deepTeamHeal": return executeTeamHealUltimate(state, unit, Math.max(12, Math.floor(unitStats(state, unit).at * 0.75)), log);
    case "ultimate:alphaShellHeal": return d4AlphaShellHeal(state, unit, log);
    default:
      state.d4Diagnostics.fallbacks[kind] = (state.d4Diagnostics.fallbacks[kind] || 0) + 1;
      return null;
  }
}

function d4RunStageQueue(state, entries, segmentIndex, log, stageQueue) {
  const queue = [...stageQueue];
  entries.forEach((entry) => {
    (entry.segments[segmentIndex] || [])
      .filter((operation) => operation.layer === "stage")
      .forEach((operation) => queue.push({ entry, kind: operation.kind }));
  });

  queue
    .filter((item) => d4StageKindGroup(item.kind) === "status")
    .sort((a, b) => d4StatusKindOrder(a.kind) - d4StatusKindOrder(b.kind))
    .forEach((item) => d4RunStageOperation(state, item.entry, item.kind, log));

  queue
    .filter((item) => d4StageKindGroup(item.kind) === "stat")
    .sort((a, b) => d4StatKindOrder(a.kind) - d4StatKindOrder(b.kind))
    .forEach((item) => d4RunStageOperation(state, item.entry, item.kind, log));

  const gauges = queue.filter((item) => d4StageKindGroup(item.kind) === "gauge");
  d4RunGaugeStageOperations(state, gauges, log);

  queue
    .filter((item) => d4StageKindGroup(item.kind) === "other")
    .forEach((item) => d4RunStageOperation(state, item.entry, item.kind, log));
}

function d4StageKindGroup(kind) {
  if (["acidBiteStatus", "acidSweepDefenseStatus", "acidSweepHealBlockStatus", "sporeBarrageStatus", "ultimate:toxicBloomStatus", "healBlockPulse", "toxicNeedle", "toxicCloud"].includes(kind)) return "status";
  if (["rally", "command", "selfAg", "agSnare", "ultimate:synapticSurge"].includes(kind)) return "stat";
  if (["quickenUltimate", "selfUltimateCharge"].includes(kind)) return "gauge";
  return "other";
}

function d4StatusKindOrder(kind) {
  return D4_STATUS_FAMILY_ORDER[D4_STATUS_FAMILY[d4StatusKeyForStageKind(kind)] || "marker"];
}

function d4StatusKeyForStageKind(kind) {
  if (kind === "acidSweepDefenseStatus") return "defenseDown";
  if (kind === "acidBiteStatus" || kind === "acidSweepHealBlockStatus" || kind === "healBlockPulse") return "healBlock";
  if (kind === "sporeBarrageStatus" || kind === "ultimate:toxicBloomStatus" || kind === "toxicNeedle" || kind === "toxicCloud") return "poison";
  return kind;
}

function d4StatKindOrder(kind) {
  if (kind === "rally") return 0;
  if (kind === "command") return 0;
  if (kind === "ultimate:synapticSurge") return 0;
  if (kind === "selfAg") return 1;
  if (kind === "agSnare") return 1;
  return 2;
}

function d4RunStageOperation(state, entry, kind, log) {
  const unit = entry.unit;
  switch (kind) {
    case "acidBiteStatus":
    case "acidSweepDefenseStatus":
    case "acidSweepHealBlockStatus":
    case "sporeBarrageStatus":
    case "ultimate:toxicBloomStatus":
      return d4ApplyQueuedDamageStatus(state, entry, kind, log);
    case "healBlockPulse": return actions.healBlockPulse.execute(state, unit, log);
    case "toxicNeedle": return actions.toxicNeedle.execute(state, unit, log);
    case "toxicCloud": return actions.toxicCloud.execute(state, unit, log);
    case "rally": return actions.rally.execute(state, unit, log);
    case "command": return actions.command.execute(state, unit, log);
    case "selfAg": return actions.selfAg.execute(state, unit, log);
    case "agSnare": return actions.agSnare.execute(state, unit, log);
    case "quickenUltimate": return null;
    case "selfUltimateCharge": return null;
    case "ultimate:synapticSurge": return ultimateActions.synapticSurge.execute(state, unit, log);
    case "wait": return actions.wait.execute(state, unit, log);
    case "fallbackWholeAction":
      state.d4Diagnostics.fallbacks[actionFor(unit)] = (state.d4Diagnostics.fallbacks[actionFor(unit)] || 0) + 1;
      return actions[actionFor(unit)]?.execute(state, unit, log);
    case "fallbackWholeUltimate":
      state.d4Diagnostics.fallbacks[unit.card.ultimate?.key || "unknownUltimate"] = (state.d4Diagnostics.fallbacks[unit.card.ultimate?.key || "unknownUltimate"] || 0) + 1;
      return ultimateActions[unit.card.ultimate?.key]?.execute(state, unit, log);
    default:
      state.d4Diagnostics.fallbacks[kind] = (state.d4Diagnostics.fallbacks[kind] || 0) + 1;
      return null;
  }
}

function d4RunGaugeStageOperations(state, gauges, log) {
  const grouped = new Map();
  gauges.forEach((item) => {
    const targets = d4GaugeTargets(state, item.entry, item.kind);
    targets.forEach((target) => {
      const key = target.id;
      if (!grouped.has(key)) grouped.set(key, { target, amount: 0, sources: [] });
      grouped.get(key).amount += ULTIMATE_CHARGE_AMOUNT;
      grouped.get(key).sources.push(item.entry.unit);
    });
  });
  [...grouped.values()].forEach((item) => {
    chargeUltimateGauge(state, item.target, item.amount);
    const sourceNames = item.sources.map((source) => unitLabel(source)).join("/");
    log.push(sourceNames + " の時流: " + unitLabel(item.target) + " の必殺技を" + item.amount + "T短縮");
    recordFrame(log, state, { type: "buff", sourceId: item.sources[0].id, targetId: item.target.id, text: item.target.card.name + " 必殺技短縮" });
  });
}

function d4GaugeTargets(state, entry, kind) {
  const unit = entry.unit;
  if (kind === "selfUltimateCharge") return unit.card.ultimate ? [unit] : [];
  if (kind === "quickenUltimate") {
    return living(state, unit.side)
      .filter((ally) => ally.row === unit.row && ally.id !== unit.id && ally.card.ultimate);
  }
  return [];
}

function d4GeneralWardArmor(state, unit, log) {
  const target = generalOf(state, unit.side);
  if (!target || target.hp <= 0) return logNoTarget(unit, log);
  const armor = generalWardArmorFor(unit);
  grantArmor(state, target, armor, GENERAL_WARD_DURATION);
  log.push(unitLabel(unit) + " の献身: " + unitLabel(target) + " に装甲+" + armor + "/" + GENERAL_WARD_DURATION + "T");
  recordBuffFrame(log, state, unit, target, { armor, duration: GENERAL_WARD_DURATION }, unit.card.name + " の献身");
}

function d4GeneralWardHeal(state, unit, log) {
  const target = generalOf(state, unit.side);
  if (!target || target.hp <= 0) return logNoTarget(unit, log);
  const amount = generalWardHealFor(state, unit);
  const healed = heal(state, target, amount);
  log.push(unitLabel(unit) + " の献身: " + unitLabel(target) + " が" + healed + "回復");
  if (healed > 0) {
    recordFrame(log, state, { type: "heal", sourceId: unit.id, targetId: target.id, amount: healed, healEvents: [{ targetId: target.id, amount: healed }], text: unit.card.name + " の献身" });
  }
}

function d4ThornGuard(state, unit, log) {
  grantArmor(state, unit, THORN_GUARD_ARMOR, STANDARD_ARMOR_DURATION);
  grantStatusEffect(state, unit, "contactPoison", CONTACT_POISON_DURATION, unit);
  recordStatusAppliedMetric(state, unit, "contactPoison", 1);
  log.push(unitLabel(unit) + " の棘構え: 自身に装甲+" + THORN_GUARD_ARMOR + "/" + STANDARD_ARMOR_DURATION + "T、接触毒/" + CONTACT_POISON_DURATION + "T");
  recordFrame(log, state, {
    type: "buff",
    sourceId: unit.id,
    targetId: unit.id,
    buffEvents: [{ targetId: unit.id, armor: THORN_GUARD_ARMOR, duration: STANDARD_ARMOR_DURATION, statusKey: "contactPoison" }],
    text: unit.card.name + " の棘構え",
  });
}

function d4MirrorShell(state, unit, log) {
  grantArmor(state, unit, MIRROR_SHELL_ARMOR, STANDARD_ARMOR_DURATION);
  grantStatusEffect(state, unit, "reflectShell", REFLECT_SHELL_DURATION, unit);
  recordStatusAppliedMetric(state, unit, "reflectShell", 1);
  log.push(unitLabel(unit) + " の鏡殻: 自身に装甲+" + MIRROR_SHELL_ARMOR + "/" + STANDARD_ARMOR_DURATION + "T、反射殻/" + REFLECT_SHELL_DURATION + "T");
  recordFrame(log, state, {
    type: "buff",
    sourceId: unit.id,
    targetId: unit.id,
    buffEvents: [{ targetId: unit.id, armor: MIRROR_SHELL_ARMOR, duration: STANDARD_ARMOR_DURATION, statusKey: "reflectShell" }],
    text: unit.card.name + " の鏡殻",
  });
}

function d4AlphaShellArmor(state, unit, log) {
  const target = generalOf(state, unit.side);
  if (!target || target.hp <= 0) return logNoTarget(unit, log);
  const armor = 26;
  grantArmor(state, target, armor, STANDARD_ARMOR_DURATION);
  log.push(unitLabel(unit) + " の" + unit.card.ultimate.name + ": " + unitLabel(target) + " に装甲+" + armor + "/" + STANDARD_ARMOR_DURATION + "T");
  recordBuffFrame(log, state, unit, target, { armor, duration: STANDARD_ARMOR_DURATION }, unit.card.name + " の" + unit.card.ultimate.name);
}

function d4AlphaShellHeal(state, unit, log) {
  const target = generalOf(state, unit.side);
  if (!target || target.hp <= 0) return logNoTarget(unit, log);
  const amount = Math.max(10, Math.floor(unitStats(state, unit).at * 0.55));
  const healed = heal(state, target, amount);
  log.push(unitLabel(unit) + " の" + unit.card.ultimate.name + ": " + unitLabel(target) + " が" + healed + "回復");
  if (healed > 0) {
    recordFrame(log, state, { type: "heal", sourceId: unit.id, targetId: target.id, amount: healed, healEvents: [{ targetId: target.id, amount: healed }], text: unit.card.name + " の" + unit.card.ultimate.name });
  }
}

function d4AttackWithStatus(state, entry, kind, statusKey, duration, log, stageQueue) {
  const unit = entry.unit;
  let events = [];
  if (kind === "acidBite") {
    const target = findFrontTarget(state, unit);
    if (!target) return logNoTarget(unit, log);
    events = dealDamageGroup(state, unit, [{ target, rawDamage: Math.max(5, unitStats(state, unit).at - ACID_BITE_OFFSET) }], "酸牙", log);
  } else if (kind === "acidSweepDefense" || kind === "acidSweepHealBlock") {
    const targets = enemies(state, unit.side).filter((enemy) => enemy.col === 0);
    if (targets.length === 0) return logNoTarget(unit, log);
    events = dealDamageGroup(
      state,
      unit,
      targets.map((target) => ({ target, rawDamage: Math.max(4, unitStats(state, unit).at - ACID_SWEEP_OFFSET) })),
      kind === "acidSweepDefense" ? "酸霧" : "腐蝕潮",
      log,
    );
  } else if (kind === "sporeBarrage") {
    const targets = enemies(state, unit.side).filter((enemy) => enemy.col === 0);
    if (targets.length === 0) return logNoTarget(unit, log);
    const damage = Math.max(5, unitStats(state, unit).at - SPORE_BARRAGE_OFFSET);
    events = dealDamageGroup(state, unit, targets.map((target) => ({ target, rawDamage: damage })), "胞子砲", log);
  }
  entry.scratch[kind + "Events"] = events || [];
  stageQueue.push({ entry, kind: kind + "Status", statusKey, duration });
  return events;
}

function d4DrainStrikeAttack(state, entry, log) {
  const unit = entry.unit;
  const target = findMostArmoredTarget(state, unit) || findFrontTarget(state, unit);
  if (!target) return logNoTarget(unit, log);
  const events = dealDamageGroup(state, unit, [{ target, rawDamage: Math.max(5, unitStats(state, unit).at - DRAIN_DAMAGE_OFFSET) }], "貫殻吸血", log);
  entry.scratch.drainStrikeDamage = events?.[0]?.damage || 0;
  return events;
}

function d4DrainStrikeHeal(state, entry, log) {
  const unit = entry.unit;
  if (unit.hp <= 0) {
    log.push(unitLabel(unit) + " の吸血: 戦闘不能のため回復なし");
    return null;
  }
  const healed = heal(state, unit, Math.floor((entry.scratch.drainStrikeDamage || 0) * DRAIN_HEAL_RATE));
  if (healed > 0) {
    log.push(unitLabel(unit) + " の吸血: HP" + healed + "回復");
    recordFrame(log, state, { type: "heal", sourceId: unit.id, targetId: unit.id, amount: healed, healEvents: [{ targetId: unit.id, amount: healed }], text: unit.card.name + " の貫殻吸血" });
  }
  return healed;
}

function d4ToxicBloomAttack(state, entry, log, stageQueue) {
  const unit = entry.unit;
  const targets = enemies(state, unit.side);
  if (targets.length === 0) return logNoTarget(unit, log);
  const damage = Math.max(8, unitStats(state, unit).at - TOXIC_BLOOM_OFFSET);
  const events = dealDamageGroup(
    state,
    unit,
    targets.map((target) => ({ target, rawDamage: damage })),
    unit.card.ultimate.name,
    log,
    rowsForCols(opposite(unit.side), [0, 1, 2]),
  );
  entry.scratch.toxicBloomEvents = events || [];
  stageQueue.push({ entry, kind: "ultimate:toxicBloomStatus", statusKey: "poison", duration: POISON_DURATION });
  return events;
}

function d4ApplyQueuedDamageStatus(state, entry, kind, log) {
  let scratchKey = null;
  let statusKey = null;
  let duration = null;
  let label = "追加効果";
  if (kind === "acidBiteStatus") {
    scratchKey = "acidBiteEvents";
    statusKey = "healBlock";
    duration = HEAL_BLOCK_DURATION;
  } else if (kind === "acidSweepDefenseStatus") {
    scratchKey = "acidSweepDefenseEvents";
    statusKey = "defenseDown";
    duration = DEFENSE_DOWN_DURATION;
  } else if (kind === "acidSweepHealBlockStatus") {
    scratchKey = "acidSweepHealBlockEvents";
    statusKey = "healBlock";
    duration = HEAL_BLOCK_DURATION;
  } else if (kind === "sporeBarrageStatus") {
    scratchKey = "sporeBarrageEvents";
    statusKey = "poison";
    duration = POISON_DURATION;
  } else if (kind === "ultimate:toxicBloomStatus") {
    scratchKey = "toxicBloomEvents";
    statusKey = "poison";
    duration = POISON_DURATION;
  }
  const events = entry.scratch[scratchKey] || [];
  if (events.length === 0) return null;
  return applyStatusToDamageEvents(state, entry.unit, events, statusKey, duration, log, label);
}

function simulateBattleD4(options = {}) {
  const state = createBattleState(options);
  if (options.trace) state.d4Trace = [];
  state.d4Diagnostics = {
    sameAgDecisions: 0,
    sameAgCandidateTotal: 0,
    cellResolved: 0,
    rarityResolved: 0,
    sameCellSameRarityBatches: 0,
    symmetricSameActionBatches: 0,
    mixedActionBatches: 0,
    queuedAfterZero: 0,
    rolePairs: {},
    batchCells: {},
    fallbacks: {},
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
      const batch = nextActingBatchD4(state, actedIds);
      if (!batch) break;
      batch.units.forEach((unit) => actedIds.add(unit.id));
      executeActionBatchD4(state, batch, log);
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
    d4Diagnostics: state.d4Diagnostics,
    d4Trace: state.d4Trace || [],
  };
}

globalThis.__exports = { simulateBattle, simulateBattleD4, roundRobinPresets };
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
vm.runInContext(appSource + experimentSource, context, { filename: "action-priority-round-robin.vm.js" });

const { simulateBattle, simulateBattleD4, roundRobinPresets } = context.__exports;
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
    totalDamage: 0,
    totalHealing: 0,
    totalHealingBlocked: 0,
    totalArmorGranted: 0,
    totalDamagePrevented: 0,
    totalStatuses: {},
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
      rolePairs: {},
      batchCells: {},
      fallbacks: {},
    },
  };
}

function addCounterMap(target, source) {
  Object.entries(source || {}).forEach(([key, value]) => {
    target[key] = (target[key] || 0) + value;
  });
}

function addSideMetrics(aggregate, sideMetrics) {
  if (!sideMetrics) return;
  aggregate.totalDamage += sideMetrics.damageDealt || 0;
  aggregate.totalHealing += sideMetrics.healing || 0;
  aggregate.totalHealingBlocked += sideMetrics.healingBlocked || 0;
  aggregate.totalArmorGranted += sideMetrics.armorGranted || 0;
  aggregate.totalDamagePrevented += sideMetrics.damagePrevented || 0;
  addCounterMap(aggregate.totalStatuses, sideMetrics.statuses || {});
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

  addSideMetrics(aggregate, battle.metrics?.sides?.player);
  addSideMetrics(aggregate, battle.metrics?.sides?.enemy);

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

  const diagnostics = battle.d4Diagnostics || {};
  Object.keys(aggregate.diagnostics).forEach((key) => {
    if (["rolePairs", "batchCells", "fallbacks"].includes(key)) return;
    aggregate.diagnostics[key] += diagnostics[key] || 0;
  });
  addCounterMap(aggregate.diagnostics.rolePairs, diagnostics.rolePairs);
  addCounterMap(aggregate.diagnostics.batchCells, diagnostics.batchCells);
  addCounterMap(aggregate.diagnostics.fallbacks, diagnostics.fallbacks);
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
    perPairingAverages: {
      damage: aggregate.totalDamage / aggregate.pairings,
      healing: aggregate.totalHealing / aggregate.pairings,
      healingBlocked: aggregate.totalHealingBlocked / aggregate.pairings,
      armorGranted: aggregate.totalArmorGranted / aggregate.pairings,
      damagePrevented: aggregate.totalDamagePrevented / aggregate.pairings,
      statuses: Object.fromEntries(Object.entries(aggregate.totalStatuses).map(([key, value]) => [key, value / aggregate.pairings])),
    },
    turnHistogram: aggregate.turnHistogram,
    diagnostics: aggregate.diagnostics,
    standings,
  };
}

function topStandingDeltas(current, d4, limit = 10) {
  const d4ById = new Map(d4.standings.map((item) => [item.id, item]));
  return current.standings
    .map((item) => {
      const next = d4ById.get(item.id);
      return {
        id: item.id,
        name: item.name,
        currentWinRate: item.winRate,
        d4WinRate: next?.winRate ?? 0,
        delta: (next?.winRate ?? 0) - item.winRate,
        currentAvgTurns: item.avgTurns,
        d4AvgTurns: next?.avgTurns ?? 0,
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function runComparison() {
  const current = emptyAggregate();
  const d4 = emptyAggregate();
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
      const d4Battle = simulateBattleD4(options);
      addBattle(current, playerPreset, enemyPreset, currentBattle);
      addBattle(d4, playerPreset, enemyPreset, d4Battle);
      if (currentBattle.result !== d4Battle.result || currentBattle.turns !== d4Battle.turns) {
        changedPairs.push({
          player: playerPreset.name,
          enemy: enemyPreset.name,
          current: { result: currentBattle.result, turns: currentBattle.turns },
          d4: { result: d4Battle.result, turns: d4Battle.turns },
        });
      }
    }
  }

  const currentFinished = finishAggregate(current);
  const d4Finished = finishAggregate(d4);
  return {
    decks: targetPresets.length,
    note: "One deterministic battle per pairing. D4 candidate uses cell priority > rarity, same-AG/same-cell/same-rarity max-2 batches, max two effect segments, and per-segment layers defense > attack > heal > stage-end.",
    current: currentFinished,
    d4: d4Finished,
    changedPairs,
    changedSummary: {
      total: changedPairs.length,
      resultChanged: changedPairs.filter((pair) => pair.current.result !== pair.d4.result).length,
      turnOnlyChanged: changedPairs.filter((pair) => pair.current.result === pair.d4.result && pair.current.turns !== pair.d4.turns).length,
    },
    standingDeltas: topStandingDeltas(currentFinished, d4Finished, 12),
  };
}

const args = process.argv.slice(2);
if (args[0] === "--pair" || args[0] === "--pair-summary") {
  const playerPreset = targetPresets.find((preset) => presetMatches(preset, args[1]));
  const enemyPreset = targetPresets.find((preset) => presetMatches(preset, args[2]));
  const tailCount = Number(args[3] || 40);
  if (!playerPreset || !enemyPreset) {
    console.error("Usage: node scripts/research-action-priority-round-robin.js --pair-summary <player id/name> <enemy id/name> [tail entries]");
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
  const d4Battle = simulateBattleD4({ ...options, trace: true });
  console.log(JSON.stringify({
    player: playerPreset.name,
    enemy: enemyPreset.name,
    current: summarizeBattle(currentBattle, tailCount),
    d4: {
      ...summarizeBattle(d4Battle, tailCount),
      diagnostics: d4Battle.d4Diagnostics,
      traceCount: d4Battle.d4Trace.length,
      traceTail: d4Battle.d4Trace.slice(-tailCount),
    },
  }, null, 2));
  process.exit(0);
}

console.log(JSON.stringify(runComparison(), null, 2));
