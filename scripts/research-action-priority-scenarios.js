const STATUS_FAMILIES = Object.freeze({
  defenseDown: "damageTaken",
  healBlock: "healControl",
  paralysis: "actionControl",
  poison: "dot",
  regen: "regen",
  contactPoison: "buff",
  reflectShell: "buff",
});

const STATUS_APPLY_ORDER = Object.freeze([
  "damageTaken",
  "healControl",
  "actionControl",
  "dot",
  "regen",
  "marker",
]);

const CLEAR_ORDER = Object.freeze([
  "all",
  "weak",
  "dot",
  "healControl",
  "damageTaken",
  "actionControl",
  "buff",
  "defense",
  "stat",
]);

const DEFENSE_DOWN_DAMAGE = 10;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createState(scenario) {
  return {
    name: scenario.name,
    log: [],
    koLog: [],
    damageEvents: [],
    healEvents: [],
    statusApplyOrder: [],
    selectedActors: scenario.actors.slice(),
    units: Object.fromEntries(scenario.units.map((unit) => [unit.id, {
      id: unit.id,
      side: unit.side || "neutral",
      hp: unit.hp,
      maxHp: unit.maxHp || unit.hp,
      at: unit.at || 0,
      ag: unit.ag || 0,
      ultimateGauge: unit.ultimateGauge || 0,
      ultimateMax: unit.ultimateMax || 0,
      usedUltimate: false,
      statuses: clone(unit.statuses || []),
      statMods: clone(unit.statMods || []),
      armor: clone(unit.armor || []),
      action: clone(unit.action || []),
      isGeneral: Boolean(unit.isGeneral),
    }])),
  };
}

function unit(state, id) {
  const found = state.units[id];
  if (!found) throw new Error(`Unknown unit: ${id}`);
  return found;
}

function isAlive(target) {
  return target.hp > 0;
}

function hasStatus(target, key) {
  return target.statuses.some((status) => status.key === key);
}

function addStatus(target, key, sourceId) {
  target.statuses.push({ key, sourceId });
}

function removeStatusesByKeys(target, keys) {
  const keySet = new Set(keys);
  const before = target.statuses.length;
  target.statuses = target.statuses.filter((status) => !keySet.has(status.key));
  return before - target.statuses.length;
}

function activeArmor(target) {
  return target.armor.reduce((sum, effect) => sum + effect.amount, 0);
}

function effectiveStat(target, stat) {
  const base = target[stat] || 0;
  const mods = target.statMods.filter((mod) => mod.stat === stat);
  const multiplier = mods
    .filter((mod) => mod.op === "mul")
    .reduce((value, mod) => value * mod.value, 1);
  const additive = mods
    .filter((mod) => mod.op === "add")
    .reduce((value, mod) => value + mod.value, 0);
  return Math.max(0, Math.floor(base * multiplier + additive));
}

function resolveTargetIds(state, actor, effect) {
  if (Array.isArray(effect.targets)) return effect.targets;
  if (effect.target === "self") return [actor.id];
  if (effect.target === "opponent") {
    return Object.values(state.units)
      .filter((candidate) => candidate.side !== actor.side && isAlive(candidate))
      .map((candidate) => candidate.id)
      .slice(0, 1);
  }
  if (effect.target === "damagedAlly") {
    return Object.values(state.units)
      .filter((candidate) => candidate.side === actor.side && candidate.hp > 0 && candidate.hp < candidate.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))
      .map((candidate) => candidate.id)
      .slice(0, 1);
  }
  if (effect.target === "allEnemies") {
    return Object.values(state.units)
      .filter((candidate) => candidate.side !== actor.side && isAlive(candidate))
      .map((candidate) => candidate.id);
  }
  throw new Error(`Unknown target selector: ${effect.target}`);
}

function segmentEffects(state, segmentIndex, type) {
  const effects = [];
  state.selectedActors.forEach((actorId) => {
    const actor = unit(state, actorId);
    const segment = actor.action[segmentIndex] || [];
    segment
      .filter((effect) => effect.type === type)
      .forEach((effect) => effects.push({ actor, effect }));
  });
  return effects;
}

function runDefensePrep(state, segmentIndex) {
  segmentEffects(state, segmentIndex, "armor").forEach(({ actor, effect }) => {
    resolveTargetIds(state, actor, effect).forEach((targetId) => {
      const target = unit(state, targetId);
      target.armor.push({ amount: effect.amount });
      state.log.push(`S${segmentIndex + 1}: ${actor.id} grants armor ${effect.amount} to ${target.id}`);
    });
  });

  segmentEffects(state, segmentIndex, "prepStatus").forEach(({ actor, effect }) => {
    resolveTargetIds(state, actor, effect).forEach((targetId) => {
      const target = unit(state, targetId);
      addStatus(target, effect.key, actor.id);
      state.log.push(`S${segmentIndex + 1}: ${actor.id} prepares ${effect.key} on ${target.id}`);
    });
  });
}

function calculateDamage(state, target, effect) {
  let damage = typeof effect.amount === "number" ? effect.amount : effectiveStat(unit(state, effect.actorId), "at");
  if (hasStatus(target, "defenseDown")) damage += DEFENSE_DOWN_DAMAGE;
  if (!effect.ignoreArmor) damage -= activeArmor(target);
  return Math.max(0, Math.floor(damage));
}

function runAttackDamage(state, segmentIndex) {
  const attacks = [];
  segmentEffects(state, segmentIndex, "attack").forEach(({ actor, effect }) => {
    resolveTargetIds(state, actor, effect).forEach((targetId) => {
      const target = unit(state, targetId);
      if (!isAlive(target)) return;
      const damage = calculateDamage(state, target, { ...effect, actorId: actor.id });
      attacks.push({ actor, target, damage, effect });
    });
  });

  attacks.forEach((event) => {
    event.target.hp = Math.max(0, event.target.hp - event.damage);
    state.damageEvents.push({
      segment: segmentIndex + 1,
      sourceId: event.actor.id,
      targetId: event.target.id,
      damage: event.damage,
    });
    state.log.push(`S${segmentIndex + 1}: ${event.actor.id} deals ${event.damage} to ${event.target.id}`);
  });

  attacks.forEach((event) => {
    if (event.target.hp === 0) {
      state.koLog.push({ segment: segmentIndex + 1, targetId: event.target.id });
      state.log.push(`S${segmentIndex + 1}: ${event.target.id} is KO`);
    }
  });

  attacks.forEach((event) => runDefenseResponses(state, segmentIndex, event));
}

function runDefenseResponses(state, segmentIndex, event) {
  if (event.damage <= 0) return;
  if (hasStatus(event.target, "contactPoison") && isAlive(event.actor)) {
    addStatus(event.actor, "poison", event.target.id);
    state.statusApplyOrder.push({ segment: segmentIndex + 1, family: "dot", key: "poison", targetId: event.actor.id, source: "response" });
    state.log.push(`S${segmentIndex + 1}: ${event.target.id} applies contact poison to ${event.actor.id}`);
  }
  if (hasStatus(event.target, "reflectShell") && isAlive(event.actor)) {
    const reflected = Math.min(12, Math.floor(event.damage / 2));
    event.actor.hp = Math.max(0, event.actor.hp - reflected);
    state.damageEvents.push({
      segment: segmentIndex + 1,
      sourceId: event.target.id,
      targetId: event.actor.id,
      damage: reflected,
      response: "reflectShell",
    });
    state.log.push(`S${segmentIndex + 1}: ${event.target.id} reflects ${reflected} to ${event.actor.id}`);
    if (event.actor.hp === 0) {
      state.koLog.push({ segment: segmentIndex + 1, targetId: event.actor.id });
      state.log.push(`S${segmentIndex + 1}: ${event.actor.id} is KO`);
    }
  }
}

function runSingleHeal(state, segmentIndex) {
  segmentEffects(state, segmentIndex, "heal").forEach(({ actor, effect }) => {
    resolveTargetIds(state, actor, effect).forEach((targetId) => {
      const target = unit(state, targetId);
      if (!isAlive(target)) {
        state.log.push(`S${segmentIndex + 1}: ${actor.id} cannot heal KO target ${target.id}`);
        return;
      }
      if (hasStatus(target, "healBlock")) {
        state.healEvents.push({ segment: segmentIndex + 1, sourceId: actor.id, targetId: target.id, amount: 0, blocked: true });
        state.log.push(`S${segmentIndex + 1}: ${actor.id} heal on ${target.id} is blocked`);
        return;
      }
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + effect.amount);
      const amount = target.hp - before;
      state.healEvents.push({ segment: segmentIndex + 1, sourceId: actor.id, targetId: target.id, amount });
      state.log.push(`S${segmentIndex + 1}: ${actor.id} heals ${target.id} for ${amount}`);
    });
  });
}

function collectStageEndEvents(state, segmentIndex) {
  const events = [];
  ["cleanse", "status", "stat", "gauge"].forEach((type) => {
    segmentEffects(state, segmentIndex, type).forEach(({ actor, effect }) => {
      resolveTargetIds(state, actor, effect).forEach((targetId) => {
        events.push({ type, actor, target: unit(state, targetId), effect });
      });
    });
  });
  return events;
}

function runStageEnd(state, segmentIndex) {
  const events = collectStageEndEvents(state, segmentIndex);
  applyCleanses(state, segmentIndex, events.filter((event) => event.type === "cleanse"));
  applyStatuses(state, segmentIndex, events.filter((event) => event.type === "status"));
  applyStats(state, segmentIndex, events.filter((event) => event.type === "stat"));
  applyGauges(state, segmentIndex, events.filter((event) => event.type === "gauge"));
}

function applyCleanses(state, segmentIndex, events) {
  const byTarget = new Map();
  events.forEach((event) => {
    if (!byTarget.has(event.target.id)) byTarget.set(event.target.id, new Set());
    byTarget.get(event.target.id).add(event.effect.mask);
  });
  [...byTarget.entries()].forEach(([targetId, masks]) => {
    const target = unit(state, targetId);
    CLEAR_ORDER.forEach((mask) => {
      if (!masks.has(mask)) return;
      const removed = clearMask(target, mask);
      state.log.push(`S${segmentIndex + 1}: cleanse ${mask} removes ${removed} from ${target.id}`);
    });
  });
}

function clearMask(target, mask) {
  if (mask === "all") {
    const removed = target.statuses.length + target.armor.length + target.statMods.length;
    target.statuses = [];
    target.armor = [];
    target.statMods = [];
    return removed;
  }
  if (mask === "defense") {
    const removed = target.armor.length;
    target.armor = [];
    return removed;
  }
  if (mask === "stat") {
    const removed = target.statMods.length;
    target.statMods = [];
    return removed;
  }
  const keys = Object.entries(STATUS_FAMILIES)
    .filter(([, family]) => {
      if (mask === "weak") return ["damageTaken", "healControl", "actionControl", "dot"].includes(family);
      return family === mask;
    })
    .map(([key]) => key);
  return removeStatusesByKeys(target, keys);
}

function applyStatuses(state, segmentIndex, events) {
  const ordered = events.slice().sort((a, b) => {
    const familyA = STATUS_FAMILIES[a.effect.key] || "marker";
    const familyB = STATUS_FAMILIES[b.effect.key] || "marker";
    return STATUS_APPLY_ORDER.indexOf(familyA) - STATUS_APPLY_ORDER.indexOf(familyB);
  });
  ordered.forEach((event) => {
    addStatus(event.target, event.effect.key, event.actor.id);
    const family = STATUS_FAMILIES[event.effect.key] || "marker";
    state.statusApplyOrder.push({ segment: segmentIndex + 1, family, key: event.effect.key, targetId: event.target.id });
    state.log.push(`S${segmentIndex + 1}: applies ${event.effect.key} to ${event.target.id}`);
  });
}

function applyStats(state, segmentIndex, events) {
  const ordered = events.slice().sort((a, b) => {
    const statOrder = { at: 0, ag: 1 };
    return (statOrder[a.effect.stat] ?? 2) - (statOrder[b.effect.stat] ?? 2);
  });
  ordered.forEach((event) => {
    event.target.statMods.push({ stat: event.effect.stat, op: event.effect.op, value: event.effect.value });
    state.log.push(`S${segmentIndex + 1}: ${event.target.id} gets ${event.effect.stat} ${event.effect.op} ${event.effect.value}`);
  });
}

function applyGauges(state, segmentIndex, events) {
  const totals = new Map();
  events.forEach((event) => {
    totals.set(event.target.id, (totals.get(event.target.id) || 0) + event.effect.amount);
  });
  [...totals.entries()].forEach(([targetId, amount]) => {
    const target = unit(state, targetId);
    target.ultimateGauge = Math.max(0, Math.min(target.ultimateMax, target.ultimateGauge + amount));
    state.log.push(`S${segmentIndex + 1}: ${target.id} ultimate gauge changes by ${amount} to ${target.ultimateGauge}`);
  });
}

function runScenario(scenario) {
  const state = createState(scenario);
  for (let segmentIndex = 0; segmentIndex < 2; segmentIndex += 1) {
    runDefensePrep(state, segmentIndex);
    runAttackDamage(state, segmentIndex);
    runSingleHeal(state, segmentIndex);
    runStageEnd(state, segmentIndex);
  }
  const result = scenario.expect(state);
  return {
    id: scenario.id,
    name: scenario.name,
    pass: result.pass,
    checks: result.checks,
    final: snapshot(state),
    log: state.log,
  };
}

function snapshot(state) {
  return Object.fromEntries(Object.values(state.units).map((target) => [target.id, {
    hp: target.hp,
    armor: activeArmor(target),
    at: effectiveStat(target, "at"),
    ag: effectiveStat(target, "ag"),
    ultimateGauge: target.ultimateGauge,
    statuses: target.statuses.map((status) => status.key),
  }]));
}

function check(label, actual, expected) {
  const pass = actual === expected;
  return { label, pass, actual, expected };
}

function allPass(checks) {
  return checks.every((item) => item.pass);
}

const scenarios = [
  {
    id: "S1",
    name: "defense-prep-prevents-lethal",
    actors: ["pGuard", "eStrike"],
    units: [
      { id: "pGuard", side: "player", hp: 30, maxHp: 30, action: [[{ type: "armor", target: "self", amount: 15 }]] },
      { id: "eStrike", side: "enemy", hp: 50, maxHp: 50, action: [[{ type: "attack", target: "opponent", amount: 40 }]] },
    ],
    expect(state) {
      const checks = [
        check("guard survives at HP5", unit(state, "pGuard").hp, 5),
        check("armor was applied before attack", state.damageEvents[0].damage, 25),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S2",
    name: "single-heal-does-not-revive-ko-target",
    actors: ["pHealer", "eStrike"],
    units: [
      { id: "pHealer", side: "player", hp: 30, maxHp: 30, action: [[{ type: "heal", target: "self", amount: 20 }]] },
      { id: "eStrike", side: "enemy", hp: 50, maxHp: 50, action: [[{ type: "attack", target: "opponent", amount: 40 }]] },
    ],
    expect(state) {
      const checks = [
        check("healer remains KO", unit(state, "pHealer").hp, 0),
        check("KO was logged", state.koLog.length, 1),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S3",
    name: "single-heal-recovers-survivor-after-attack",
    actors: ["pHealer", "eStrike"],
    units: [
      { id: "pHealer", side: "player", hp: 30, maxHp: 30, action: [[{ type: "heal", target: "self", amount: 20 }]] },
      { id: "eStrike", side: "enemy", hp: 50, maxHp: 50, action: [[{ type: "attack", target: "opponent", amount: 20 }]] },
    ],
    expect(state) {
      const checks = [
        check("healer returns to max HP", unit(state, "pHealer").hp, 30),
        check("heal amount after damage", state.healEvents[0].amount, 20),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S4",
    name: "heal-block-starts-next-segment",
    actors: ["pBlock", "eHealer"],
    units: [
      { id: "pBlock", side: "player", hp: 50, maxHp: 50, action: [[{ type: "status", target: "opponent", key: "healBlock" }]] },
      {
        id: "eHealer",
        side: "enemy",
        hp: 20,
        maxHp: 50,
        action: [
          [{ type: "heal", target: "self", amount: 10 }],
          [{ type: "heal", target: "self", amount: 10 }],
        ],
      },
    ],
    expect(state) {
      const checks = [
        check("same-segment heal is allowed", state.healEvents[0].amount, 10),
        check("next-segment heal is blocked", state.healEvents[1].blocked, true),
        check("final HP reflects one heal only", unit(state, "eHealer").hp, 30),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S5",
    name: "defense-down-starts-next-segment",
    actors: ["pAcid", "eGuard"],
    units: [
      {
        id: "pAcid",
        side: "player",
        hp: 50,
        maxHp: 50,
        action: [
          [
            { type: "status", target: "opponent", key: "defenseDown" },
            { type: "attack", target: "opponent", amount: 20 },
          ],
          [{ type: "attack", target: "opponent", amount: 20 }],
        ],
      },
      {
        id: "eGuard",
        side: "enemy",
        hp: 60,
        maxHp: 60,
        action: [
          [],
          [{ type: "armor", target: "self", amount: 5 }],
        ],
      },
    ],
    expect(state) {
      const firstIncoming = state.damageEvents.find((event) => event.segment === 1 && event.sourceId === "pAcid" && event.targetId === "eGuard");
      const secondIncoming = state.damageEvents.find((event) => event.segment === 2 && event.sourceId === "pAcid" && event.targetId === "eGuard");
      const checks = [
        check("same-segment attack ignores newly queued defenseDown", firstIncoming.damage, 20),
        check("segment2 attack uses defenseDown and same-segment armor", secondIncoming.damage, 25),
        check("defender final HP", unit(state, "eGuard").hp, 15),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S6",
    name: "ko-action-guarantee-can-heal-other-survivor",
    actors: ["pHealer", "eStrike"],
    units: [
      {
        id: "pHealer",
        side: "player",
        hp: 30,
        maxHp: 30,
        action: [[{ type: "heal", target: "damagedAlly", amount: 15 }]],
      },
      { id: "pAlly", side: "player", hp: 20, maxHp: 40, action: [] },
      { id: "eStrike", side: "enemy", hp: 50, maxHp: 50, action: [[{ type: "attack", targets: ["pHealer"], amount: 40 }]] },
    ],
    expect(state) {
      const checks = [
        check("healer is KO", unit(state, "pHealer").hp, 0),
        check("ally is healed by guaranteed action", unit(state, "pAlly").hp, 35),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S7",
    name: "cleanse-removes-existing-but-not-same-segment-new-status",
    actors: ["pCleanse", "ePoison"],
    units: [
      {
        id: "pCleanse",
        side: "player",
        hp: 50,
        maxHp: 50,
        statuses: [{ key: "poison" }, { key: "healBlock" }],
        action: [[{ type: "cleanse", target: "self", mask: "weak" }]],
      },
      { id: "ePoison", side: "enemy", hp: 50, maxHp: 50, action: [[{ type: "status", targets: ["pCleanse"], key: "poison" }]] },
    ],
    expect(state) {
      const statusText = unit(state, "pCleanse").statuses.map((status) => status.key).join(",");
      const checks = [
        check("new poison remains after same-segment cleanse", statusText, "poison"),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S8",
    name: "status-family-application-order-is-canonical",
    actors: ["pStatus"],
    units: [
      {
        id: "pStatus",
        side: "player",
        hp: 50,
        maxHp: 50,
        action: [[
          { type: "status", target: "self", key: "poison" },
          { type: "status", target: "self", key: "healBlock" },
          { type: "status", target: "self", key: "defenseDown" },
          { type: "status", target: "self", key: "regen" },
        ]],
      },
    ],
    expect(state) {
      const order = state.statusApplyOrder.map((item) => item.family).join(">");
      const checks = [
        check("status family order", order, "damageTaken>healControl>dot>regen"),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S9",
    name: "stat-formula-and-gauge-aggregation",
    actors: ["pSupport"],
    units: [
      {
        id: "pSupport",
        side: "player",
        hp: 50,
        maxHp: 50,
        at: 50,
        ag: 20,
        ultimateGauge: 1,
        ultimateMax: 4,
        action: [[
          { type: "stat", target: "self", stat: "at", op: "mul", value: 0.8 },
          { type: "stat", target: "self", stat: "at", op: "add", value: 10 },
          { type: "stat", target: "self", stat: "ag", op: "mul", value: 0.5 },
          { type: "stat", target: "self", stat: "ag", op: "add", value: -15 },
          { type: "gauge", target: "self", amount: 2 },
          { type: "gauge", target: "self", amount: -1 },
        ]],
      },
    ],
    expect(state) {
      const checks = [
        check("AT uses mul then add", effectiveStat(unit(state, "pSupport"), "at"), 50),
        check("AG clamps at zero", effectiveStat(unit(state, "pSupport"), "ag"), 0),
        check("gauge changes are aggregated", unit(state, "pSupport").ultimateGauge, 2),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S10",
    name: "defense-response-prep-is-live-for-same-segment-hit",
    actors: ["pShell", "eStrike"],
    units: [
      {
        id: "pShell",
        side: "player",
        hp: 50,
        maxHp: 50,
        action: [[
          { type: "prepStatus", target: "self", key: "contactPoison" },
          { type: "prepStatus", target: "self", key: "reflectShell" },
        ]],
      },
      { id: "eStrike", side: "enemy", hp: 50, maxHp: 50, action: [[{ type: "attack", target: "opponent", amount: 20 }]] },
    ],
    expect(state) {
      const checks = [
        check("attacker gets poison from contact response", hasStatus(unit(state, "eStrike"), "poison"), true),
        check("attacker takes reflect damage", unit(state, "eStrike").hp, 40),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S11",
    name: "ag-change-does-not-reselect-current-batch",
    actors: ["pSlow", "eStrike"],
    units: [
      {
        id: "pSlow",
        side: "player",
        hp: 50,
        maxHp: 50,
        ag: 10,
        action: [
          [{ type: "stat", target: "self", stat: "ag", op: "add", value: 100 }],
          [],
        ],
      },
      {
        id: "eStrike",
        side: "enemy",
        hp: 50,
        maxHp: 50,
        ag: 10,
        action: [
          [],
          [{ type: "attack", target: "opponent", amount: 10 }],
        ],
      },
    ],
    expect(state) {
      const attack = state.damageEvents.find((event) => event.segment === 2 && event.sourceId === "eStrike");
      const checks = [
        check("selected batch is not reselected", state.selectedActors.join(">"), "pSlow>eStrike"),
        check("AG buff is active after segment end", effectiveStat(unit(state, "pSlow"), "ag"), 110),
        check("other selected actor still resolves segment2", attack.damage, 10),
      ];
      return { pass: allPass(checks), checks };
    },
  },
  {
    id: "S12",
    name: "gauge-fill-does-not-replace-current-action",
    actors: ["pMage"],
    units: [
      {
        id: "pMage",
        side: "player",
        hp: 50,
        maxHp: 50,
        ultimateGauge: 2,
        ultimateMax: 3,
        action: [
          [{ type: "gauge", target: "self", amount: 1 }],
          [{ type: "attack", targets: ["eTarget"], amount: 10 }],
        ],
      },
      { id: "eTarget", side: "enemy", hp: 50, maxHp: 50, action: [] },
    ],
    expect(state) {
      const attack = state.damageEvents.find((event) => event.segment === 2 && event.sourceId === "pMage");
      const checks = [
        check("gauge reaches ready value", unit(state, "pMage").ultimateGauge, 3),
        check("current selected action remains normal attack", attack.damage, 10),
        check("ultimate is not used mid-batch", unit(state, "pMage").usedUltimate, false),
      ];
      return { pass: allPass(checks), checks };
    },
  },
];

function runAll() {
  return scenarios.map(runScenario);
}

function main() {
  const results = runAll();
  const failed = results.filter((result) => !result.pass);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(`D4 action-priority scenario results: ${results.length - failed.length}/${results.length} passed`);
    results.forEach((result) => {
      console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id} ${result.name}`);
      result.checks.forEach((item) => {
        const status = item.pass ? "  ok" : "  ng";
        console.log(`${status} ${item.label}: actual=${JSON.stringify(item.actual)} expected=${JSON.stringify(item.expected)}`);
      });
    });
  }
  if (failed.length > 0) process.exitCode = 1;
}

if (require.main === module) {
  main();
}

module.exports = { runAll, runScenario, scenarios };
