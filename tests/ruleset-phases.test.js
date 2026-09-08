const assert = require("node:assert/strict");
const test = require("node:test");
const { loadPrototype } = require("./helpers/prototype");

function value(app, source) {
  return JSON.parse(JSON.stringify(app.evaluate(source)));
}

test("AD-G03: stages are cumulative but implementation and valid phase IDs are required", () => {
  const app = loadPrototype();
  const data = value(app, `(() => {
    const depth = { unlockPhase: 'depth', implemented: true };
    return {
      active: ACTIVE_RULESET_PHASE,
      depth: ['core', 'depth', 'metaChanging'].map(phase => isRulesetEntryAvailable(depth, phase)),
      unimplemented: isRulesetEntryAvailable({ ...depth, implemented: false }, 'metaChanging'),
      unknown: isRulesetEntryAvailable({ ...depth, unlockPhase: 'future' }, 'metaChanging'),
      invalidPhase: isRulesetEntryAvailable(depth, 'unknown'),
      missing: isRulesetEntryAvailable({}),
      invalidCatalog: rulesetCatalog('unknown')
    };
  })()`);
  assert.equal(data.active, "core");
  assert.deepEqual(data.depth, [false, true, true]);
  for (const key of ["unimplemented", "unknown", "invalidPhase", "missing"]) assert.equal(data[key], false, key);
  assert.ok(Object.entries(data.invalidCatalog).filter(([key]) => key !== "phase").every(([, ids]) => ids.length === 0));
});

test("AD-G03: all current cards, terrains and generation templates remain available in Core", () => {
  const app = loadPrototype();
  const data = value(app, `({
    catalog: rulesetCatalog(), cards: Object.keys(cards), terrains: Object.keys(terrainTypes), templates: Object.keys(WIN_PLAN_TEMPLATES),
    unavailableActions: [...Object.entries(actions), ...Object.entries(ultimateActions)].filter(([, action]) => !isActionAvailable(action)).map(([id]) => id),
    unavailableCards: Object.entries(cards).filter(([, card]) => !isCardAvailable(card)).map(([id]) => id),
    invalidMetadata: [TRAITS, STATUS_EFFECTS, EFFECT_ELEMENTS, WIN_PLAN_TEMPLATES, cards, terrainTypes, actions, ultimateActions]
      .flatMap(collection => Object.entries(collection).filter(([, entry]) => !Object.hasOwn(RULESET_PHASES, entry.unlockPhase) || typeof entry.implemented !== 'boolean').map(([id]) => id))
  })`);
  assert.equal(data.cards.length, 29, "M1-02 does not add or remove cards");
  assert.deepEqual(data.catalog.cards, data.cards);
  assert.deepEqual(data.catalog.terrains, data.terrains);
  assert.deepEqual(data.catalog.templates, data.templates);
  assert.deepEqual(data.unavailableActions, []);
  assert.deepEqual(data.unavailableCards, []);
  assert.deepEqual(data.invalidMetadata, []);
});

test("AD-G03: later-stage catalogs never publish unimplemented states and effects", () => {
  const app = loadPrototype();
  for (const phase of ["core", "depth", "metaChanging"]) {
    const catalog = value(app, `rulesetCatalog(${JSON.stringify(phase)})`);
    for (const id of ["regen", "paralysis", "barrier"]) assert.ok(!catalog.statuses.includes(id), `${phase}: ${id}`);
    for (const id of ["regen", "cleanse", "actionControl", "revive"]) assert.ok(!catalog.effects.includes(id), `${phase}: ${id}`);
    assert.ok(catalog.effects.includes("barrier"), "existing armor-based barrier metadata stays usable");
  }
});

test("AD-G03: unavailable action dependencies exclude the whole card from search", () => {
  const app = loadPrototype();
  const result = value(app, `(() => {
    actions.slash.unlockPhase = 'depth';
    const locked = { card: isCardAvailable(cards.captain), records: buildCardActionSearchIndex({ captain: cards.captain }).length };
    const depthAllowed = isCardAvailable(cards.captain, 'depth');
    actions.slash.components = [{ effectElements: ['regen'], targetPattern: 'self' }];
    const unimplemented = isCardAvailable(cards.captain, 'metaChanging');
    actions.slash.components = [{ effectElements: ['singleAttack'], targetPattern: 'missingTarget' }];
    const brokenTarget = isCardAvailable(cards.captain, 'depth');
    actions.slash.components[0].targetPattern = 'constructor';
    const inheritedTarget = isCardAvailable(cards.captain, 'depth');
    actions.slash.components[0].targetPattern = 'frontEnemy';
    const inheritedClassification = isCardAvailable({ ...cards.captain, classification: 'constructor' }, 'depth');
    return { locked, depthAllowed, unimplemented, brokenTarget, inheritedTarget, inheritedClassification };
  })()`);
  assert.deepEqual(result, { locked: { card: false, records: 0 }, depthAllowed: true, unimplemented: false, brokenTarget: false, inheritedTarget: false, inheritedClassification: false });
});

test("AD-G03: locked cards are excluded from generation and rejected by battle construction", () => {
  const app = loadPrototype();
  const result = value(app, `(() => {
    cards.captain.unlockPhase = 'depth';
    refreshDerivedCardData();
    return {
      searched: CARD_ACTION_SEARCH_INDEX.some(record => record.cardId === 'captain'),
      generated: STANDARD_DECK_GENERATION_RESULT.presets.some(preset => preset.units.some(([id]) => id === 'captain')),
      remaining: STANDARD_DECK_GENERATION_RESULT.presets.length,
      lockedTemplateSeeds: generateWinPlanCandidateSeeds({ ...WIN_PLAN_TEMPLATES.focusBreakthrough, unlockPhase: 'depth' }).length,
      unfinishedTemplateSeeds: generateWinPlanCandidateSeeds({ ...WIN_PLAN_TEMPLATES.focusBreakthrough, implemented: false }).length
    };
  })()`);
  assert.equal(result.searched, false);
  assert.equal(result.generated, false);
  assert.ok(result.remaining > 0);
  assert.equal(result.lockedTemplateSeeds, 0);
  assert.equal(result.unfinishedTemplateSeeds, 0);
  assert.throws(() => app.evaluate("createUnits('player', { units: [['captain', 1, 0]], general: 'captain' }, sanitizeTerrain(null))"), /Unavailable card/);
});

test("AD-G03: unavailable terrain is rejected without affecting other terrain", () => {
  const app = loadPrototype();
  app.evaluate("terrainTypes.shrine.unlockPhase = 'depth'");
  assert.ok(!value(app, "rulesetCatalog().terrains").includes("shrine"));
  assert.throws(() => app.evaluate("createUnits('player', { units: [['captain', 1, 0]], general: 'captain' }, [['plain','plain','plain'],['shrine','plain','plain'],['plain','plain','plain']])"), /Unavailable terrain/);
  assert.equal(app.evaluate("createUnits('player', { units: [['captain', 1, 0]], general: 'captain' }, sanitizeTerrain(null)).length"), 1);
});

test("AD-G03: storage normalization preserves locks while older cards default to Core", () => {
  const app = loadPrototype();
  const result = value(app, `(() => {
    const legacy = { ...cards.captain };
    delete legacy.unlockPhase;
    delete legacy.implemented;
    const old = normalizeCardForStorage(legacy);
    const locked = normalizeCardForStorage({ ...legacy, unlockPhase: 'depth', implemented: false });
    const roundTrip = normalizeCardForStorage(JSON.parse(JSON.stringify(locked)));
    const invalid = ['future', null, 42].map(unlockPhase => isCardAvailable(normalizeCardForStorage({ ...legacy, unlockPhase })));
    return { old: isCardAvailable(old), phase: roundTrip.unlockPhase, implemented: roundTrip.implemented, available: isCardAvailable(roundTrip, 'metaChanging'), invalid };
  })()`);
  assert.deepEqual(result, { old: true, phase: "depth", implemented: false, available: false, invalid: [false, false, false] });
});
