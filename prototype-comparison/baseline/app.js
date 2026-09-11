const COST_LIMIT = 30;
const MATCH_BATTLE_COUNT = 100;
const MAX_DECK_CARDS = 9;
const RULESET_PHASES = Object.freeze({
  core: Object.freeze({ name: "Core", order: 0 }),
  depth: Object.freeze({ name: "Depth", order: 1 }),
  metaChanging: Object.freeze({ name: "Meta-changing", order: 2 }),
});
const ACTIVE_RULESET_PHASE = "core";

function defineRulesetEntries(entries) {
  return Object.freeze(Object.fromEntries(Object.entries(entries).map(([id, entry]) => [
    id, Object.freeze({ unlockPhase: "core", implemented: true, ...entry }),
  ])));
}

function isRulesetEntryAvailable(entry, phase = ACTIVE_RULESET_PHASE) {
  if (!entry || entry.implemented !== true || !Object.hasOwn(RULESET_PHASES, phase)
    || !Object.hasOwn(RULESET_PHASES, entry.unlockPhase)) return false;
  return RULESET_PHASES[entry.unlockPhase].order <= RULESET_PHASES[phase].order;
}

const CUSTOM_DECK_STORAGE_KEY = "comparison-c1-custom-decks-v1";
const CARD_TUNING_STORAGE_KEY = "comparison-c1-card-tuning-v1";
const STALEMATE_REPEAT_LIMIT = 3;
const SAFETY_TURN_LIMIT = 80;
const STANDARD_ARMOR_DURATION = 2;
const GUARD_ARMOR = 14;
const RAMPART_GUARD_BONUS = 5;
const BLESSING_ARMOR = 4;
const FRONT_ARMOR = 12;
const HARBOR_WALL_ARMOR = 10;
const FALLBACK_WARD_ARMOR = 14;
const RALLY_AT = 3;
const RALLY_DURATION = 2;
const COMMAND_AG = 8;
const COMMAND_DURATION = 1;
const SCOUT_LEAD_AG = 6;
const TURN_THREE_CHARGE_AT = 3;
const TURN_THREE_CHARGE_DURATION = 2;
const FINISH_SIGNAL_AT = 6;
const FINISH_SIGNAL_DURATION = 2;
const SINGLE_HEAL_RATE = 0.65;
const LINE_HEAL_RATE = 0.45;
const WIDE_PRAYER_BONUS = 2;
const GENERAL_WARD_ARMOR = 20;
const DEVOTED_WARD_BONUS = 4;
const GENERAL_WARD_HEAL_RATE = 0.35;
const GENERAL_WARD_DURATION = 1;
const ALL_ORDER_AT = 3;
const ALL_ORDER_AG = 5;
const ALL_ORDER_DURATION = 1;
const SWEEP_DAMAGE_OFFSET = 10;
const OPENING_BARRAGE_OFFSET = 22;
const OPENING_BARRAGE_MIN_FRONT = 3;
const REAR_CANNON_BONUS = 1;
const GUARD_STRIKE_RATE = 0.45;
const PRAYER_STRIKE_RATE = 0.35;
const SNIPE_DAMAGE_OFFSET = 6;
const RAID_DAMAGE_OFFSET = 5;
const MIDDLE_RAID_BONUS = 2;
const LOW_HP_STRIKE_OFFSET = 6;
const AG_DEBUFF = 8;
const AG_DEBUFF_DURATION = 1;
const SELF_AG_BUFF = 10;
const ACID_BITE_OFFSET = 4;
const ACID_SWEEP_OFFSET = 15;
const DEFENSE_DOWN_DAMAGE = 4;
const DEFENSE_DOWN_DURATION = 1;
const HEAL_BLOCK_DURATION = 1;
const POISON_DAMAGE = 6;
const POISON_DURATION = 3;
const CONTACT_POISON_DURATION = 2;
const THORN_GUARD_ARMOR = 8;
const MIRROR_SHELL_ARMOR = 12;
const REFLECT_SHELL_DURATION = 2;
const REFLECT_DAMAGE_RATE = 0.4;
const REFLECT_DAMAGE_CAP = 18;
const DRAIN_DAMAGE_OFFSET = 4;
const DRAIN_HEAL_RATE = 0.5;
const BARRIER_PIERCE_OFFSET = 5;
const BARRIER_PIERCE_ARMOR_BONUS_CAP = 12;
const MID_REAR_PRESSURE_OFFSET = 14;
const ULTIMATE_CHARGE_AMOUNT = 1;
const SPORE_CRUSH_OFFSET = 2;
const SPORE_BARRAGE_OFFSET = 12;
const TOXIC_BLOOM_OFFSET = 8;
const ROUND_ROBIN_RISK_RULES = Object.freeze({
  dominantWinRate: 80,
  weakWinRate: 15,
  fastDecisionTurn: 3,
  longMirrorTurn: 15,
  highDrawRate: 0.5,
  lowLoserActions: 2,
  maxSummaryItems: 6,
});
const TERMS = Object.freeze({
  card: "カード",
  deck: "デッキ",
  cost: "コスト",
  costShort: "C",
  normal: "通常",
  alpha: "α",
  alphaFull: "アルファ",
  alphaTrait: "α特性",
  alphaAssign: "αに指定",
  alphaAssigned: "α指定中",
  alphaDefeat: "α撃破",
  alphaExposed: "α露出",
  alphaGuarded: "α保護",
  playerSide: "自分",
  enemySide: "相手",
  ranks: Object.freeze(["前衛", "中衛", "後衛"]),
  rankShort: Object.freeze(["前", "中", "後"]),
  lanes: Object.freeze(["左列", "中央列", "右列"]),
  laneShort: Object.freeze(["左", "中", "右"]),
  sameLane: "同列",
  armor: "装甲",
});

const RANK_LABELS = TERMS.ranks;
const LANE_LABELS = TERMS.lanes;
// Backward-compatible aliases until board coordinates are renamed from row/col.
const COL_LABELS = RANK_LABELS;
const ROW_LABELS = LANE_LABELS;
const TERM_REPLACEMENTS = Object.freeze([
  ["大将スキル", TERMS.alphaTrait],
  ["大将護衛", TERMS.alphaGuarded],
  ["大将撃破", TERMS.alphaDefeat],
  ["大将露出", TERMS.alphaExposed],
  ["大将中列化", `${TERMS.alpha}${TERMS.ranks[1]}化`],
  ["守られた大将", `守られた${TERMS.alpha}`],
  ["味方大将", `味方${TERMS.alpha}`],
  ["敵大将", `敵${TERMS.alpha}`],
  ["自軍大将", `自分${TERMS.alpha}`],
  ["敵軍大将", `相手${TERMS.alpha}`],
  ["自軍", TERMS.playerSide],
  ["敵軍", TERMS.enemySide],
  ["露出大将", `露出${TERMS.alpha}`],
  ["双方大将", `双方${TERMS.alpha}`],
  ["大将", TERMS.alpha],
  ["前列", TERMS.ranks[0]],
  ["中列", TERMS.ranks[1]],
  ["後列", TERMS.ranks[2]],
  ["上段", TERMS.lanes[0]],
  ["中段", TERMS.lanes[1]],
  ["下段", TERMS.lanes[2]],
  ["同段", TERMS.sameLane],
  ["装甲", TERMS.armor],
]);

function uiText(value) {
  return TERM_REPLACEMENTS.reduce((text, [from, to]) => text.replaceAll(from, to), String(value));
}

function sideLabel(side) {
  return side === "player" ? TERMS.playerSide : TERMS.enemySide;
}

function cardCostPairText(card) {
  return `${TERMS.cost} ${normalCardCost(card)} / ${TERMS.alpha} ${alphaCardCost(card)}`;
}

function cardCostPairShort(card) {
  return `${TERMS.costShort}${normalCardCost(card)} / ${TERMS.alpha}${alphaCardCost(card)}`;
}

function normalCardCost(card) {
  return card.cost ?? card.soldierCost;
}

function alphaCardCost(card) {
  return card.alphaCost ?? card.generalCost;
}

const CLASSIFICATIONS = Object.freeze({
  bird: {
    name: "鳥類",
    description: "高AG、奇襲、後衛到達を持ちやすい分類。",
    commonTraits: ["flying", "dash", "mimicry"],
  },
  fish: {
    name: "魚類",
    description: "海地形、高ステータス、捕食と相性がよい分類。",
    commonTraits: ["aquatic", "predation", "swarm"],
  },
  reptile: {
    name: "爬虫類",
    description: "高HP、古代、巨大、水棲などを持ちやすい分類。",
    commonTraits: ["aquatic", "ancient", "giant", "carapace"],
  },
  crustacean: {
    name: "甲殻類",
    description: "装甲、前衛維持、反撃を持ちやすい分類。",
    commonTraits: ["carapace", "aquatic", "poisonResist"],
  },
  fungi: {
    name: "菌類",
    description: "回復、拡散、寄生、毒性を持ちやすい分類。",
    commonTraits: ["mycelium", "parasitic", "poisonous", "swarm"],
  },
  insect: {
    name: "昆虫類",
    description: "低コスト、群体、毒性、擬態を持ちやすい分類。",
    commonTraits: ["swarm", "flying", "poisonous", "mimicry"],
  },
  mammal: {
    name: "哺乳類",
    description: "標準的なステータス、地形適応、群れの支援を持ちやすい分類。",
    commonTraits: ["dash", "pack", "predation"],
  },
  dragon: {
    name: "竜類",
    description: "高コスト、高AT、範囲攻撃、α向きの分類。",
    commonTraits: ["flying", "ancient", "giant", "carapace"],
  },
  crystalLife: {
    name: "結晶生命",
    description: "バリア、反射、地形連動、低速高耐久を持ちやすい分類。",
    commonTraits: ["crystal", "electric", "poisonResist"],
  },
});

const TRAITS = defineRulesetEntries({
  flying: {
    name: "飛行",
    shortText: "地形効果を受けない。",
    rulesText: "このカードは配置マスの地形効果を受けない。",
    effectElements: ["terrainBypass"],
  },
  aquatic: {
    name: "水棲",
    shortText: "海以外ではHP/AT/AGが0.8倍。",
    rulesText: "海以外の地形にいる間、HP/AT/AGを0.8倍として扱う。",
    effectElements: ["terrainDependency"],
    preferredTerrain: ["sea"],
  },
  dash: {
    name: "疾走",
    shortText: "高AGで先手を取りやすい。",
    rulesText: "高AG、奇襲、前衛突破を持ちやすい生態特性。",
    effectElements: ["agBuff"],
  },
  predation: {
    name: "捕食",
    shortText: "低HPの敵への攻撃性能が上がる。",
    rulesText: "HP割合が低い敵を攻撃する時、ダメージが上がる。",
    effectElements: ["executeBonus"],
  },
  mimicry: {
    name: "擬態",
    shortText: "サーチ攻撃の対象になりにくい。",
    rulesText: "サーチ攻撃や優先対象指定を受ける時、対象順位を下げる。",
    effectElements: ["targetEvasion"],
  },
  poisonous: {
    name: "毒性",
    shortText: "毒や回復阻害を扱う。",
    rulesText: "攻撃や誘発効果で毒、継続ダメージ、回復阻害を与える。",
    effectElements: ["poison"],
  },
  poisonResist: {
    name: "毒耐性",
    shortText: "毒と継続ダメージに強い。",
    rulesText: "毒、継続ダメージ、回復阻害の影響を軽減または無効化する。",
    effectElements: ["poisonResist"],
  },
  swarm: {
    name: "群体",
    shortText: "複数体や同分類支援と相性がよい。",
    rulesText: "同じ分類や特性を持つ味方の数を参照して効果が変わる。",
    effectElements: ["groupReference"],
  },
  pack: {
    name: "群れ",
    shortText: "同列や前衛支援と相性がよい。",
    rulesText: "複数個体での連携、同列支援、前衛展開を持ちやすい。",
    effectElements: ["groupReference"],
  },
  mycelium: {
    name: "菌糸",
    shortText: "回復や広域支援を扱う。",
    rulesText: "同列回復、戦闘不能時効果、継続回復を持ちやすい菌類特性。",
    effectElements: ["heal"],
  },
  parasitic: {
    name: "寄生",
    shortText: "弱体や継続効果を扱う。",
    rulesText: "敵への弱体、毒、回復阻害、撃破時誘発を持ちやすい。",
    effectElements: ["poison"],
  },
  ancient: {
    name: "古代",
    shortText: "初動は遅いが大技が強い。",
    rulesText: "高コスト、長い必殺技ターン、強力なα特性を持ちやすい。",
    effectElements: ["ultimatePayoff"],
  },
  giant: {
    name: "巨大",
    shortText: "高HPだがAGが低くなりやすい。",
    rulesText: "高HP、前衛制圧、α適性を持ちやすい。",
    effectElements: ["frontDurability"],
  },
  carapace: {
    name: "甲殻",
    shortText: "ダメージカットや装甲を持ちやすい。",
    rulesText: "被ダメージ軽減、装甲、反撃などの防御効果を持ちやすい。",
    effectElements: ["damageCut"],
  },
  crystal: {
    name: "結晶",
    shortText: "バリアや反射を扱う。",
    rulesText: "バリア、ダメージカット、地形連動、低速高耐久を持ちやすい。",
    effectElements: ["barrier"],
  },
  electric: {
    name: "発電",
    shortText: "AG操作や麻痺を扱う。",
    rulesText: "AG強化、AG弱体、麻痺、連鎖攻撃を持ちやすい。",
    effectElements: ["agBuff", "agDebuff"],
  },
});

const ROLES = Object.freeze({
  attack: { name: "攻撃", description: "ダメージ行動を主に持つ。" },
  defense: { name: "防御", description: "装甲、バリア、ダメージカットを持つ。" },
  heal: { name: "回復", description: "HP回復を主に持つ。" },
  support: { name: "支援", description: "AT/AG強化、地形補助、必殺技短縮を持つ。" },
  disrupt: { name: "妨害", description: "弱体、行動阻害、回復封じ、バリア貫通を持つ。" },
});

const RARITIES = Object.freeze({
  common: { name: "C", displayName: "コモン", maxCopies: 3, complexity: "low", tiePriority: 1 },
  rare: { name: "R", displayName: "レア", maxCopies: 2, complexity: "middle", tiePriority: 2 },
  legendary: { name: "L", displayName: "レジェンド", maxCopies: 1, complexity: "high", tiePriority: 3 },
});

const STATUS_EFFECTS = defineRulesetEntries({
  poison: {
    name: "毒",
    kind: "debuff",
    timing: "turnStart",
    family: "dot",
    implemented: true,
    stacking: "unique",
    refresh: "longest",
    defaultDuration: POISON_DURATION,
    damage: POISON_DAMAGE,
    clearMasks: ["all", "weak", "dot"],
    shortText: "ターン開始時にダメージ。",
    counters: ["poisonResist"],
  },
  healBlock: {
    name: "回復封じ",
    kind: "debuff",
    timing: "beforeHeal",
    family: "healControl",
    implemented: true,
    stacking: "unique",
    refresh: "longest",
    defaultDuration: HEAL_BLOCK_DURATION,
    clearMasks: ["all", "weak", "healControl"],
    shortText: "回復を受けられない。",
    counters: ["cleanse"],
  },
  defenseDown: {
    name: "防御低下",
    kind: "debuff",
    timing: "beforeDamage",
    family: "damageTaken",
    implemented: true,
    stacking: "unique",
    refresh: "longest",
    defaultDuration: DEFENSE_DOWN_DURATION,
    damage: DEFENSE_DOWN_DAMAGE,
    clearMasks: ["all", "weak", "damageTaken"],
    shortText: "受けるダメージが増える。",
    counters: ["cleanse"],
  },
  barrier: {
    name: "バリア",
    kind: "buff",
    timing: "beforeDamage",
    family: "damageTaken",
    implemented: false,
    clearMasks: ["all", "defense"],
    shortText: "一定量のダメージを防ぐ。",
    counters: ["barrierPierce"],
  },
  paralysis: {
    name: "麻痺",
    kind: "debuff",
    timing: "action",
    family: "actionControl",
    implemented: false,
    unlockPhase: "metaChanging",
    clearMasks: ["all", "weak", "actionControl"],
    shortText: "AGや行動を阻害する。",
    counters: ["cleanse"],
  },
  contactPoison: {
    name: "接触毒",
    kind: "buff",
    timing: "afterDamaged",
    family: "marker",
    implemented: true,
    stacking: "unique",
    refresh: "replace",
    defaultDuration: CONTACT_POISON_DURATION,
    clearMasks: ["all", "buff"],
    shortText: "攻撃してきた相手へ毒を付与する。",
    counters: ["cleanse"],
  },
  reflectShell: {
    name: "反射殻",
    kind: "buff",
    timing: "afterDamaged",
    family: "marker",
    implemented: true,
    stacking: "unique",
    refresh: "replace",
    defaultDuration: REFLECT_SHELL_DURATION,
    clearMasks: ["all", "buff"],
    shortText: "受けたダメージの一部を攻撃者へ返す。",
    counters: ["barrierPierce"],
  },
  regen: {
    name: "継続回復",
    kind: "buff",
    timing: "turnStart",
    family: "regen",
    implemented: false,
    unlockPhase: "depth",
    stacking: "strongest",
    refresh: "longest",
    clearMasks: ["all", "buff"],
    blockedBy: ["healBlock"],
    shortText: "ターン開始時に回復する。未公開。",
    counters: ["healBlock", "dispel"],
  },
});

const EFFECT_ELEMENTS = defineRulesetEntries({
  singleAttack: { name: "単体攻撃", category: "attack", baseScore: 5 },
  areaAttack: { name: "範囲攻撃", category: "attack", baseScore: 12, riskFlags: ["aoeOverkill"] },
  searchAttack: { name: "サーチ攻撃", category: "attack", baseScore: 14, riskFlags: ["searchSnowball"] },
  executeBonus: { name: "追撃補正", category: "attack", baseScore: 8 },
  heal: { name: "回復", category: "heal", baseScore: 4 },
  armor: { name: "装甲", category: "defense", baseScore: 5 },
  barrier: { name: "バリア", category: "defense", baseScore: 8 },
  damageCut: { name: "ダメージカット", category: "defense", baseScore: 7 },
  counter: { name: "反撃", category: "attack", baseScore: 8 },
  reflect: { name: "反射", category: "attack", baseScore: 10, statusKey: "reflectShell" },
  contactPoison: { name: "接触毒", category: "disrupt", baseScore: 9, statusKey: "contactPoison" },
  atBuff: { name: "AT強化", category: "support", baseScore: 6 },
  agBuff: { name: "AG操作", category: "support", baseScore: 10, riskFlags: ["firstStrikeLock"] },
  ultimateCharge: { name: "必殺技短縮", category: "support", baseScore: 12, riskFlags: ["ultimateLoop"] },
  atDebuff: { name: "AT弱体", category: "disrupt", baseScore: 6 },
  agDebuff: { name: "AG弱体", category: "disrupt", baseScore: 9, riskFlags: ["firstStrikeLock"] },
  defenseDown: { name: "防御低下", category: "disrupt", baseScore: 7, statusKey: "defenseDown" },
  healBlock: { name: "回復封じ", category: "disrupt", baseScore: 10, statusKey: "healBlock" },
  barrierPierce: { name: "バリア貫通", category: "disrupt", baseScore: 12 },
  poison: { name: "毒", category: "disrupt", baseScore: 7, statusKey: "poison" },
  poisonResist: { name: "毒耐性", category: "defense", baseScore: 4 },
  targetEvasion: { name: "対象回避", category: "defense", baseScore: 9 },
  groupReference: { name: "群体参照", category: "trait", baseScore: 0 },
  ultimatePayoff: { name: "必殺技強化", category: "support", baseScore: 8 },
  frontDurability: { name: "前衛耐久", category: "defense", baseScore: 7 },
  terrainBypass: { name: "地形無視", category: "trait", baseScore: 10 },
  terrainDependency: { name: "地形依存", category: "trait", baseScore: -8 },
  wait: { name: "待機", category: "none", baseScore: 0 },
  regen: { name: "継続回復", category: "heal", baseScore: 0, statusKey: "regen", unlockPhase: "depth", implemented: false },
  cleanse: { name: "状態解除", category: "support", baseScore: 0, unlockPhase: "depth", implemented: false },
  actionControl: { name: "行動制御", category: "disrupt", baseScore: 0, statusKey: "paralysis", unlockPhase: "metaChanging", implemented: false },
  revive: { name: "復活", category: "support", baseScore: 0, unlockPhase: "metaChanging", implemented: false },
});

const TARGET_PATTERNS = Object.freeze({
  frontEnemy: { name: "最前の敵", side: "enemy", shape: "single", priority: "front", depthAccess: [0] },
  sameLaneFrontEnemy: { name: "同列最前の敵", side: "enemy", shape: "single", priority: "laneFront", depthAccess: [0, 1, 2] },
  sameLaneFrontTwoEnemies: { name: "同列前方2体", side: "enemy", shape: "line", priority: "laneFrontTwo", depthAccess: [0, 1] },
  frontRankEnemies: { name: "敵前衛全体", side: "enemy", shape: "rank", priority: "all", depthAccess: [0] },
  allEnemies: { name: "敵全体", side: "enemy", shape: "all", priority: "all", depthAccess: [0, 1, 2] },
  rearEnemyPriority: { name: "敵後衛優先", side: "enemy", shape: "single", priority: "rear", depthAccess: [2] },
  lowestHpEnemy: { name: "低HPの敵", side: "enemy", shape: "single", priority: "lowestHp", depthAccess: [0, 1, 2] },
  armoredEnemyPriority: { name: "装甲敵優先", side: "enemy", shape: "single", priority: "armored", depthAccess: [0, 1, 2] },
  middleRearLowestHpEnemy: { name: "敵中後衛の低HP", side: "enemy", shape: "single", priority: "middleRearLowestHp", depthAccess: [1, 2] },
  middleRearEnemies: { name: "敵中後衛全体", side: "enemy", shape: "rank", priority: "all", depthAccess: [1, 2] },
  exposedAlphaOrFrontEnemy: { name: `露出${TERMS.alpha}優先`, side: "enemy", shape: "single", priority: "exposedAlpha", depthAccess: [0, 1, 2] },
  frontRankAllies: { name: "味方前衛全体", side: "ally", shape: "rank", priority: "all", depthAccess: [0] },
  allAllies: { name: "味方全体", side: "ally", shape: "all", priority: "all", depthAccess: [0, 1, 2] },
  sameLaneAllies: { name: "同列の味方", side: "ally", shape: "lane", priority: "all", depthAccess: [0, 1, 2] },
  sameLaneDamagedAllies: { name: "同列の負傷味方", side: "ally", shape: "lane", priority: "damaged", depthAccess: [0, 1, 2] },
  lowestHpAlly: { name: "低HPの味方", side: "ally", shape: "single", priority: "lowestHpRate", depthAccess: [0, 1, 2] },
  selfAndForwardAlly: { name: "自身と前方の味方", side: "ally", shape: "line", priority: "selfForward", depthAccess: [0, 1, 2] },
  allyAlpha: { name: `味方${TERMS.alpha}`, side: "ally", shape: "single", priority: "alpha", depthAccess: [0, 1, 2] },
  self: { name: "自身", side: "self", shape: "single", priority: "self", depthAccess: [] },
  none: { name: "対象なし", side: "none", shape: "none", priority: "none", depthAccess: [] },
});

const ULTIMATE_RULES = Object.freeze({
  chargeUnit: "turn",
  defaultTiming: "action",
  replacesNormalAction: true,
  resetAfterUse: true,
  followsAgOrder: true,
  minTurns: 3,
  defaultTurns: 5,
  turnScoreMultipliers: Object.freeze({
    3: 1.8,
    4: 1.4,
    5: 1.0,
    6: 0.8,
    7: 0.65,
  }),
});

const TIE_BREAK_RULES = Object.freeze({
  primary: "AGが高い順",
  priorityOrder: Object.freeze(["盤面位置順", "レアリティが高い順", "同じマス/同レアリティなら同AGバッチ"]),
  simultaneousScope: "同AG、同じマス、同レアリティの最大2体に限る。",
});

const SAME_AG_LANE_PRIORITY = Object.freeze({ 1: 0, 0: 1, 2: 2 });
const SAME_AG_CELL_PRIORITY_LABELS = Object.freeze([
  "前中", "前左", "前右",
  "中中", "中左", "中右",
  "後中", "後左", "後右",
]);

const STAGE_END_STATUS_FAMILY_ORDER = Object.freeze({
  damageTaken: 0,
  healControl: 1,
  actionControl: 2,
  dot: 3,
  regen: 4,
  marker: 5,
});

const STAGE_END_STATUS_FAMILY = Object.freeze(Object.fromEntries(
  Object.entries(STATUS_EFFECTS).map(([key, definition]) => [key, definition.family]),
));

const SCORING_RULES = Object.freeze({
  totalScale: 0.55,
  statWeights: Object.freeze({ hp: 0.45, ag: 0.35 }),
  slotWeights: Object.freeze({ front: 0.20, middle: 0.26, rear: 0.32 }),
  conceptActionWeights: Object.freeze({ primary: 0.72, secondary: 0.25, tertiary: 0.12 }),
  rangeDamageMultiplier: 0.95,
  frontRankDamageTargets: 2.6,
  armorOutputMultiplier: 0.75,
  delayedDamageMultiplier: 0.70,
  attackPoisonCompositeScore: 18,
  healArmorCompositeScore: 8,
  openingActionMultiplier: 0.85,
  openingBarrageFrontReliability: Object.freeze({
    2: 1.0,
    3: 0.5,
  }),
  timingScores: Object.freeze({
    battleStart: 28,
  }),
  shapeScores: Object.freeze({ none: 0, single: 0, line: 6, lane: 10, rank: 12, all: 26 }),
  priorityScores: Object.freeze({
    none: 0,
    front: 0,
    laneFront: 0,
    laneFrontTwo: 2,
    all: 3,
    rear: 8,
    lowestHp: 14,
    armored: 10,
    middleRearLowestHp: 18,
    exposedAlpha: 24,
    alpha: 8,
    damaged: 6,
    lowestHpRate: 8,
    self: 0,
    selfForward: 4,
  }),
  riskScores: Object.freeze({
    aoeOverkill: 8,
    searchSnowball: 14,
    firstStrikeLock: 12,
    ultimateLoop: 18,
  }),
  statusScores: Object.freeze({
    poison: 10,
    healBlock: 14,
    defenseDown: 12,
    barrierPierce: 14,
    contactPoison: 18,
    reflect: 18,
  }),
  costBands: Object.freeze({
    normal: Object.freeze({
      3: Object.freeze([70, 95]),
      4: Object.freeze([90, 120]),
      5: Object.freeze([115, 150]),
      6: Object.freeze([145, 185]),
    }),
    alpha: Object.freeze({
      5: Object.freeze([105, 135]),
      6: Object.freeze([125, 165]),
      7: Object.freeze([155, 200]),
      8: Object.freeze([185, 235]),
    }),
  }),
});

const BUILD_ENGINE_DEFINITIONS = Object.freeze({
  classificationUnity: Object.freeze({ name: "分類統一", effectElements: Object.freeze(["groupReference", "atBuff", "agBuff"]) }),
  traitUnity: Object.freeze({ name: "特性統一", effectElements: Object.freeze(["groupReference", "terrainBypass", "terrainDependency"]) }),
  terrain: Object.freeze({ name: "地形", effectElements: Object.freeze(["terrainBypass", "terrainDependency"]) }),
  ultimateCharge: Object.freeze({ name: "必殺技短縮", effectElements: Object.freeze(["ultimateCharge"]) }),
  alphaSupport: Object.freeze({ name: `${TERMS.alpha}支援`, effectElements: Object.freeze(["armor", "heal", "atBuff", "agBuff"]) }),
  agTempo: Object.freeze({ name: "AGテンポ", effectElements: Object.freeze(["agBuff", "agDebuff"]) }),
  armorHeal: Object.freeze({ name: "装甲/回復", effectElements: Object.freeze(["armor", "barrier", "heal", "damageCut"]) }),
  defenseBreak: Object.freeze({ name: "防御低下/回復封じ", effectElements: Object.freeze(["defenseDown", "healBlock", "barrierPierce"]) }),
  scaling: Object.freeze({ name: "スケーリング", effectElements: Object.freeze(["ultimatePayoff", "groupReference"]) }),
  conditionBurst: Object.freeze({ name: "条件バースト", effectElements: Object.freeze(["poison", "executeBonus", "atBuff", "agBuff"]) }),
});

const WIN_PLAN_TEMPLATES = defineRulesetEntries({
  focusBreakthrough: Object.freeze({
    id: "focusBreakthrough",
    name: "一点突破",
    strategy: "focus",
    description: "対象条件を揃えた攻撃で特定の1体を早期に倒す。",
    primaryEffectElements: Object.freeze(["singleAttack", "searchAttack", "executeBonus"]),
    supportEffectElements: Object.freeze(["agBuff", "agDebuff", "atBuff", "ultimateCharge"]),
    preferredGeneralKeys: Object.freeze(["scoutLead", "midAg", "allOutOrder", "firstSnipe", "frontDuel"]),
    engineHints: Object.freeze(["agTempo", "conditionBurst", "ultimateCharge"]),
    thresholds: Object.freeze({ minMainRecords: 2, focusedDamage: 100 }),
  }),
  boardControl: Object.freeze({
    id: "boardControl",
    name: "盤面制圧",
    strategy: "board",
    description: "範囲/複数体攻撃で前線や支援網をまとめて崩す。",
    primaryEffectElements: Object.freeze(["areaAttack"]),
    supportEffectElements: Object.freeze(["atBuff", "defenseDown", "healBlock", "ultimateCharge", "armor"]),
    preferredGeneralKeys: Object.freeze(["openingBarrage", "turnThreeCharge", "allOutOrder", "frontArmor"]),
    engineHints: Object.freeze(["defenseBreak", "ultimateCharge", "armorHeal"]),
    thresholds: Object.freeze({ minMainRecords: 2, totalDamage: 150, effectiveTargets: 3 }),
  }),
  alphaDirect: Object.freeze({
    id: "alphaDirect",
    name: `${TERMS.alpha}直接突破`,
    strategy: "alpha",
    description: `${TERMS.alpha}露出前の壁処理と露出後の集中火力を両方持つ。`,
    wallEffectElements: Object.freeze(["singleAttack", "areaAttack", "barrierPierce"]),
    reachEffectElements: Object.freeze(["searchAttack", "singleAttack", "barrierPierce"]),
    supportEffectElements: Object.freeze(["agBuff", "agDebuff", "ultimateCharge", "defenseDown"]),
    preferredGeneralKeys: Object.freeze(["finishSignal", "frontDuel", "scoutLead", "midAg", "allOutOrder"]),
    engineHints: Object.freeze(["agTempo", "ultimateCharge", "defenseBreak"]),
    thresholds: Object.freeze({ minWallRecords: 1, minReachRecords: 1, alphaDamage: 80 }),
  }),
  aceExecution: Object.freeze({
    id: "aceExecution",
    name: "エース遂行",
    strategy: "ace",
    description: "高出力カードを守り、複数回行動させて勝つ。",
    primaryEffectElements: Object.freeze(["singleAttack", "areaAttack", "searchAttack", "poison"]),
    supportEffectElements: Object.freeze(["armor", "barrier", "heal", "atBuff", "agBuff", "ultimateCharge"]),
    preferredGeneralKeys: Object.freeze(["frontArmor", "harborWall", "firstFallHeal", "terrainDiscount", "allOutOrder"]),
    engineHints: Object.freeze(["alphaSupport", "armorHeal", "ultimateCharge"]),
    thresholds: Object.freeze({ supportHits: 3, aceOutput: 90 }),
  }),
  dotEndurance: Object.freeze({
    id: "dotEndurance",
    name: "継続ダメージ耐久",
    strategy: "dot",
    description: "毒などの継続ダメージが効くまで耐久補助で時間を稼ぐ。",
    primaryEffectElements: Object.freeze(["poison"]),
    supportEffectElements: Object.freeze(["armor", "barrier", "heal", "damageCut"]),
    preferredGeneralKeys: Object.freeze(["frontArmor", "harborWall", "fallbackWard", "firstFallHeal"]),
    engineHints: Object.freeze(["traitUnity", "armorHeal", "defenseBreak"]),
    thresholds: Object.freeze({ minPoisonCards: 2, poisonDamage: 100, durabilityRecords: 2 }),
  }),
  lockControl: Object.freeze({
    id: "lockControl",
    name: "ロック/妨害制圧",
    strategy: "lock",
    description: "妨害で相手の遂行速度を落とし、主勝ち筋ではなく別の決着手段を補助する。",
    primaryEffectElements: Object.freeze(["agDebuff", "healBlock", "defenseDown", "barrierPierce"]),
    finishEffectElements: Object.freeze(["singleAttack", "areaAttack", "searchAttack", "poison"]),
    supportEffectElements: Object.freeze(["agBuff", "armor", "heal", "ultimateCharge"]),
    preferredGeneralKeys: Object.freeze(["midAg", "scoutLead", "allOutOrder", "frontArmor"]),
    engineHints: Object.freeze(["agTempo", "defenseBreak", "armorHeal"]),
    thresholds: Object.freeze({ disruptionRecords: 3, finishRoutes: 2 }),
  }),
  counterBreak: Object.freeze({
    id: "counterBreak",
    name: "反撃/受け崩し",
    strategy: "counter",
    description: "反撃、反射、接触効果を受け役の維持で勝ち筋へ変換する。",
    primaryEffectElements: Object.freeze(["counter", "reflect", "contactPoison"]),
    finishEffectElements: Object.freeze(["singleAttack", "areaAttack", "searchAttack", "poison"]),
    supportEffectElements: Object.freeze(["armor", "barrier", "heal", "damageCut"]),
    preferredGeneralKeys: Object.freeze(["frontArmor", "harborWall", "fallbackWard"]),
    engineHints: Object.freeze(["armorHeal", "traitUnity"]),
    thresholds: Object.freeze({ receiverRecords: 1, sustainRecords: 2, counterOutput: 24, finishRoutes: 1 }),
  }),
});

const STANDARD_DECK_GENERATION_RULES = Object.freeze({
  costLimit: COST_LIMIT,
  maxCards: MAX_DECK_CARDS,
  minCards: 4,
  maxCandidatesPerPlan: 2,
  maxSeedRecords: 5,
});

const STANDARD_FORMATION_PATTERNS = Object.freeze([
  Object.freeze([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }]),
  Object.freeze([{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }]),
  Object.freeze([{ row: 0, col: 0 }, { row: 1, col: 0 }, { row: 2, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 }, { row: 2, col: 2 }]),
  Object.freeze([{ row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]),
]);

const terrainTypes = {
  plain: {
    name: "平地",
    cost: 0,
    className: "terrain-plain",
    text: "補正なし。低コストの基準マス。",
    apply(unit, context) {
      return context;
    },
  },
  forest: {
    name: "森",
    cost: 1,
    className: "terrain-forest",
    text: "飛行/擬態系のAG+6。",
    apply(unit, context) {
      if (unit.card.tags.includes("ranged") || unit.card.tags.includes("scout")) {
        context.ag += 6;
      }
      return context;
    },
  },
  sea: {
    name: "海",
    cost: 2,
    className: "terrain-sea",
    text: "水棲系のAT+3/装甲+1。大型甲殻はAG-4。",
    apply(unit, context) {
      if (unit.card.tags.includes("sea")) {
        context.at += 3;
        context.armor += 1;
      }
      if (unit.card.tags.includes("heavy")) {
        context.ag -= 4;
      }
      return context;
    },
  },
  highland: {
    name: "高地",
    cost: 2,
    className: "terrain-highland",
    text: "後衛からの攻撃ダメージ+3。",
    apply(unit, context) {
      if (unit.col === 2 && context.kind === "attack") {
        context.damage += 3;
      }
      return context;
    },
  },
  shrine: {
    name: "活性巣",
    cost: 3,
    className: "terrain-shrine",
    text: "ターン開始時HP+3。受けるダメージ+1。",
    apply(unit, context) {
      if (context.kind === "incoming") {
        context.damage += 1;
      }
      return context;
    },
    onTurnStart(state, unit, log) {
      const amount = heal(state, unit, 3);
      log.push(`${unitLabel(unit)} は活性巣でHPを${amount}回復`);
      if (amount > 0) {
        recordFrame(log, state, { type: "heal", targetId: unit.id, amount, healEvents: [{ targetId: unit.id, amount }], text: `${unit.card.name} 活性巣回復` });
      }
    },
  },
  rampart: {
    name: "殻壁",
    cost: 3,
    className: "terrain-rampart",
    text: "前衛時、受けるダメージ-4。",
    apply(unit, context) {
      if (unit.col === 0 && context.kind === "incoming") {
        context.damage -= 4;
      }
      return context;
    },
  },
};

const actions = {
  slash: {
    name: "斬撃",
    text: "最前の敵1体にAT分ダメージ。",
    components: [
      { effectElements: ["singleAttack"], targetPattern: "frontEnemy" },
    ],
    execute(state, unit, log) {
      const target = findFrontTarget(state, unit);
      if (!target) return logNoTarget(unit, log);
      dealDamage(state, unit, target, unitStats(state, unit).at, "斬撃", log);
    },
  },
  pierce: {
    name: "貫通",
    text: "同列の前から2体に小ダメージ。",
    components: [
      { effectElements: ["areaAttack"], targetPattern: "sameLaneFrontTwoEnemies" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side)
        .filter((enemy) => enemy.row === unit.row)
        .sort((a, b) => a.col - b.col)
        .slice(0, 2);
      if (targets.length === 0) return logNoTarget(unit, log);
      const base = unitStats(state, unit).at;
      dealDamageGroup(
        state,
        unit,
        targets.map((target, index) => ({ target, rawDamage: Math.max(4, base - 5 - index * 5) })),
        "貫通",
        log,
      );
    },
  },
  sweep: {
    name: "掃射",
    text: "敵前衛全体に小ダメージ。",
    components: [
      { effectElements: ["areaAttack"], targetPattern: "frontRankEnemies" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side).filter((enemy) => enemy.col === 0);
      if (targets.length === 0) return logNoTarget(unit, log);
      const damage = Math.max(4, unitStats(state, unit).at - SWEEP_DAMAGE_OFFSET);
      dealDamageGroup(state, unit, targets.map((target) => ({ target, rawDamage: damage })), "掃射", log);
    },
  },
  guard: {
    name: "守護",
    text: "自身と前方の味方に装甲を付与し、同列最前の敵へ小ダメージ。",
    components: [
      { effectElements: ["armor"], targetPattern: "selfAndForwardAlly" },
      { effectElements: ["singleAttack"], targetPattern: "sameLaneFrontEnemy" },
    ],
    execute(state, unit, log) {
      executeGuardProtection(state, unit, log);
      executeGuardStrike(state, unit, log);
    },
  },
  rally: {
    name: "鼓舞",
    text: `味方前衛のAT+${RALLY_AT}/${RALLY_DURATION}T。`,
    components: [
      { effectElements: ["atBuff"], targetPattern: "frontRankAllies" },
    ],
    execute(state, unit, log) {
      const targets = living(state, unit.side).filter((ally) => ally.col === 0);
      if (targets.length === 0) return logNoTarget(unit, log);
      const buffEvents = [];
      targets.forEach((target) => {
        grantStatBuff(state, target, "at", RALLY_AT, RALLY_DURATION);
        buffEvents.push({ targetId: target.id, at: RALLY_AT, duration: RALLY_DURATION });
      });
      log.push(`${unitLabel(unit)} の鼓舞: ${buffTargetSummary(targets)} にAT+${RALLY_AT}/${RALLY_DURATION}T`);
      recordBuffGroupFrame(log, state, unit, buffEvents, `${unit.card.name} の鼓舞`);
    },
  },
  heal: {
    name: "祈祷",
    text: "最も傷ついた味方を回復し、同列最前の敵へ小ダメージ。",
    components: [
      { effectElements: ["heal"], targetPattern: "lowestHpAlly" },
      { effectElements: ["singleAttack"], targetPattern: "sameLaneFrontEnemy" },
    ],
    execute(state, unit, log) {
      executeHealPrayer(state, unit, log);
      executePrayerStrike(state, unit, log);
    },
  },
  lineHeal: {
    name: "治癒陣",
    text: "同列の味方全体を小回復。",
    components: [
      { effectElements: ["heal"], targetPattern: "sameLaneDamagedAllies" },
    ],
    execute(state, unit, log) {
      const targets = living(state, unit.side)
        .filter((ally) => ally.row === unit.row && ally.hp < ally.maxHp);
      if (targets.length === 0) return logNoTarget(unit, log);
      const amount = lineHealAmountFor(state, unit);
      const healEvents = targets
        .map((target) => ({ targetId: target.id, amount: heal(state, target, amount), target }))
        .filter((event) => event.amount > 0);
      if (healEvents.length === 0) return logNoTarget(unit, log);
      log.push(`${unitLabel(unit)} の治癒陣: ${buffTargetSummary(healEvents.map((event) => event.target))} が${amount}回復`);
      recordFrame(log, state, {
        type: "heal",
        sourceId: unit.id,
        targetId: healEvents[0].targetId,
        amount: healEvents[0].amount,
        healEvents: healEvents.map((event) => ({ targetId: event.targetId, amount: event.amount })),
        text: `${unit.card.name} の治癒陣`,
      });
    },
  },
  generalWard: {
    name: "献身",
    text: "味方αに装甲と小回復。",
    components: [
      { effectElements: ["armor", "heal"], targetPattern: "allyAlpha" },
    ],
    execute(state, unit, log) {
      const target = generalOf(state, unit.side);
      if (!target || target.hp <= 0) return logNoTarget(unit, log);
      const armor = generalWardArmorFor(unit);
      const healAmount = generalWardHealFor(state, unit);
      grantArmor(state, target, armor, GENERAL_WARD_DURATION);
      const healed = heal(state, target, healAmount);
      const healEvents = healed > 0 ? [{ targetId: target.id, amount: healed }] : [];
      const buffEvents = [{ targetId: target.id, armor, duration: GENERAL_WARD_DURATION }];
      log.push(`${unitLabel(unit)} の献身: ${unitLabel(target)} に装甲+${armor}/${GENERAL_WARD_DURATION}T、HP${healed}回復`);
      recordFrame(log, state, {
        type: "heal",
        sourceId: unit.id,
        targetId: target.id,
        amount: healed,
        healEvents,
        buffEvents,
        text: `${unit.card.name} の献身`,
      });
    },
  },
  snipe: {
    name: "狙撃",
    text: "後衛を狙う。守られたαには軽減。",
    components: [
      { effectElements: ["singleAttack", "searchAttack"], targetPattern: "rearEnemyPriority" },
    ],
    execute(state, unit, log) {
      const enemyGeneral = generalOf(state, opposite(unit.side));
      const farthest = enemies(state, unit.side).sort((a, b) => b.col - a.col || a.hp - b.hp)[0];
      if (!farthest) return logNoTarget(unit, log);
      const target = farthest.general && !isGeneralExposed(state, farthest) ? farthest : farthest;
      let damage = Math.max(5, unitStats(state, unit).at - SNIPE_DAMAGE_OFFSET);
      if (target === enemyGeneral && !isGeneralExposed(state, target)) {
        damage = Math.floor(damage * 0.55);
      }
      dealDamage(state, unit, target, damage, "狙撃", log);
    },
  },
  raid: {
    name: "奇襲",
    text: "中後衛の低HPを狙う。",
    components: [
      { effectElements: ["singleAttack", "searchAttack"], targetPattern: "middleRearLowestHpEnemy" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side).filter((enemy) => enemy.col >= 1);
      const target = (targets.length ? targets : enemies(state, unit.side)).sort((a, b) => a.hp - b.hp)[0];
      if (!target) return logNoTarget(unit, log);
      let damage = Math.max(5, unitStats(state, unit).at - RAID_DAMAGE_OFFSET);
      if (target.general && !isGeneralExposed(state, target)) {
        damage = Math.floor(damage * 0.65);
      }
      dealDamage(state, unit, target, damage, "奇襲", log);
    },
  },
  command: {
    name: "指揮",
    text: `同列の味方にAG+${COMMAND_AG}/AT+2/${COMMAND_DURATION}T。`,
    components: [
      { effectElements: ["agBuff", "atBuff"], targetPattern: "sameLaneAllies" },
    ],
    execute(state, unit, log) {
      const targets = living(state, unit.side).filter((ally) => ally.row === unit.row && ally.id !== unit.id);
      if (targets.length === 0) return logNoTarget(unit, log);
      const atBonus = commandAtBonusFor(unit);
      const buffEvents = [];
      targets.forEach((target) => {
        grantStatBuff(state, target, "ag", COMMAND_AG, COMMAND_DURATION);
        grantStatBuff(state, target, "at", atBonus, COMMAND_DURATION);
        buffEvents.push({ targetId: target.id, ag: COMMAND_AG, at: atBonus, duration: COMMAND_DURATION });
      });
      log.push(`${unitLabel(unit)} の指揮: ${buffTargetSummary(targets)} にAG+${COMMAND_AG}/AT+${atBonus}/${COMMAND_DURATION}T`);
      recordBuffGroupFrame(log, state, unit, buffEvents, `${unit.card.name} の指揮`);
    },
  },
  siege: {
    name: "破陣",
    text: "露出したαを優先して大ダメージ。",
    components: [
      { effectElements: ["singleAttack", "searchAttack"], targetPattern: "exposedAlphaOrFrontEnemy" },
    ],
    execute(state, unit, log) {
      const targetGeneral = generalOf(state, opposite(unit.side));
      const target = targetGeneral && isGeneralExposed(state, targetGeneral)
        ? targetGeneral
        : findFrontTarget(state, unit);
      if (!target) return logNoTarget(unit, log);
      const bonus = target.general ? 6 : 0;
      dealDamage(state, unit, target, unitStats(state, unit).at + bonus, "破陣", log);
    },
  },
  lowHpStrike: {
    name: "追跡",
    text: "HPが低い敵を狙う。威力は控えめ。",
    components: [
      { effectElements: ["singleAttack", "searchAttack", "executeBonus"], targetPattern: "lowestHpEnemy" },
    ],
    execute(state, unit, log) {
      const target = findLowestHpEnemy(state, unit);
      if (!target) return logNoTarget(unit, log);
      dealDamage(state, unit, target, Math.max(5, unitStats(state, unit).at - LOW_HP_STRIKE_OFFSET), "追跡", log);
    },
  },
  selfAg: {
    name: "加速",
    text: `自身にAG+${SELF_AG_BUFF}/${AG_DEBUFF_DURATION}T。`,
    components: [
      { effectElements: ["agBuff"], targetPattern: "self" },
    ],
    execute(state, unit, log) {
      grantStatBuff(state, unit, "ag", SELF_AG_BUFF, AG_DEBUFF_DURATION);
      log.push(`${unitLabel(unit)} の加速: 自身にAG+${SELF_AG_BUFF}/${AG_DEBUFF_DURATION}T`);
      recordBuffFrame(log, state, unit, unit, { ag: SELF_AG_BUFF, duration: AG_DEBUFF_DURATION }, `${unit.card.name} の加速`);
    },
  },
  agSnare: {
    name: "撹乱",
    text: `同列最前の敵にAG-${AG_DEBUFF}/${AG_DEBUFF_DURATION}T。`,
    components: [
      { effectElements: ["agDebuff"], targetPattern: "sameLaneFrontEnemy" },
    ],
    execute(state, unit, log) {
      const target = findLaneFrontTarget(state, unit) || findFrontTarget(state, unit);
      if (!target) return logNoTarget(unit, log);
      const debuff = AG_DEBUFF + (unit.card.abilityKey === "deepSnare" ? 2 : 0);
      grantStatBuff(state, target, "ag", -debuff, AG_DEBUFF_DURATION);
      log.push(`${unitLabel(unit)} の撹乱: ${unitLabel(target)} にAG-${debuff}/${AG_DEBUFF_DURATION}T`);
      recordBuffFrame(log, state, unit, target, { ag: -debuff, duration: AG_DEBUFF_DURATION }, `${unit.card.name} の撹乱`);
    },
  },
  shellBind: {
    name: "殻結び",
    text: "自身と前方の味方に装甲を付与する。",
    components: [
      { effectElements: ["armor"], targetPattern: "selfAndForwardAlly" },
    ],
    execute(state, unit, log) {
      executeShellBind(state, unit, log);
    },
  },
  quickenUltimate: {
    name: "時流",
    text: `同列の味方の必殺技を${ULTIMATE_CHARGE_AMOUNT}T短縮する。`,
    components: [
      { effectElements: ["ultimateCharge"], targetPattern: "sameLaneAllies" },
    ],
    execute(state, unit, log) {
      const targets = living(state, unit.side)
        .filter((ally) => ally.row === unit.row && ally.id !== unit.id && ally.card.ultimate);
      if (targets.length === 0) return logNoTarget(unit, log);
      targets.forEach((target) => chargeUltimateGauge(state, target, ULTIMATE_CHARGE_AMOUNT));
      log.push(`${unitLabel(unit)} の時流: ${buffTargetSummary(targets)} の必殺技を${ULTIMATE_CHARGE_AMOUNT}T短縮`);
      recordFrame(log, state, { type: "buff", sourceId: unit.id, targetId: targets[0].id, text: `${unit.card.name} の時流` });
    },
  },
  acidBite: {
    name: "酸牙",
    text: "最前の敵に小ダメージを与え、回復封じを付与する。",
    components: [
      { effectElements: ["singleAttack", "healBlock"], targetPattern: "frontEnemy" },
    ],
    execute(state, unit, log) {
      const target = findFrontTarget(state, unit);
      if (!target) return logNoTarget(unit, log);
      const events = dealDamageGroup(state, unit, [{ target, rawDamage: Math.max(5, unitStats(state, unit).at - ACID_BITE_OFFSET) }], "酸牙", log);
      applyStatusToDamageEvents(state, unit, events, "healBlock", HEAL_BLOCK_DURATION, log);
    },
  },
  acidSweepDefense: {
    name: "酸霧",
    text: "敵前衛全体に小ダメージを与え、防御低下を付与する。",
    components: [
      { effectElements: ["areaAttack", "defenseDown"], targetPattern: "frontRankEnemies" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side).filter((enemy) => enemy.col === 0);
      if (targets.length === 0) return logNoTarget(unit, log);
      const events = dealDamageGroup(
        state,
        unit,
        targets.map((target) => ({ target, rawDamage: Math.max(4, unitStats(state, unit).at - ACID_SWEEP_OFFSET) })),
        "酸霧",
        log,
      );
      applyStatusToDamageEvents(state, unit, events, "defenseDown", DEFENSE_DOWN_DURATION, log);
    },
  },
  acidSweepHealBlock: {
    name: "腐蝕潮",
    text: "敵前衛全体に小ダメージを与え、回復封じを付与する。",
    components: [
      { effectElements: ["areaAttack", "healBlock"], targetPattern: "frontRankEnemies" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side).filter((enemy) => enemy.col === 0);
      if (targets.length === 0) return logNoTarget(unit, log);
      const events = dealDamageGroup(
        state,
        unit,
        targets.map((target) => ({ target, rawDamage: Math.max(4, unitStats(state, unit).at - ACID_SWEEP_OFFSET) })),
        "腐蝕潮",
        log,
      );
      applyStatusToDamageEvents(state, unit, events, "healBlock", HEAL_BLOCK_DURATION, log);
    },
  },
  drainStrike: {
    name: "貫殻吸血",
    text: "装甲が残る敵を優先し、装甲を無視する小ダメージを与えて自身を回復する。",
    components: [
      { effectElements: ["singleAttack", "barrierPierce", "heal"], targetPattern: "armoredEnemyPriority" },
    ],
    execute(state, unit, log) {
      const target = findMostArmoredTarget(state, unit) || findFrontTarget(state, unit);
      if (!target) return logNoTarget(unit, log);
      const events = dealDamageGroup(state, unit, [{ target, rawDamage: Math.max(5, unitStats(state, unit).at - DRAIN_DAMAGE_OFFSET) }], "貫殻吸血", log);
      const healed = heal(state, unit, Math.floor((events?.[0]?.damage || 0) * DRAIN_HEAL_RATE));
      if (healed > 0) {
        log.push(`${unitLabel(unit)} の吸血: HP${healed}回復`);
        recordFrame(log, state, { type: "heal", sourceId: unit.id, targetId: unit.id, amount: healed, healEvents: [{ targetId: unit.id, amount: healed }], text: `${unit.card.name} の貫殻吸血` });
      }
    },
  },
  barrierPierceStrike: {
    name: "貫殻",
    text: "最前の敵に装甲を無視する小ダメージ。装甲が残る敵には威力が上がる。",
    components: [
      { effectElements: ["singleAttack", "barrierPierce"], targetPattern: "frontEnemy" },
    ],
    execute(state, unit, log) {
      const target = findFrontTarget(state, unit);
      if (!target) return logNoTarget(unit, log);
      dealDamage(state, unit, target, Math.max(5, unitStats(state, unit).at - BARRIER_PIERCE_OFFSET), "貫殻", log);
    },
  },
  healBlockPulse: {
    name: "阻害胞",
    text: "HPが低い敵に回復封じを付与する。",
    components: [
      { effectElements: ["healBlock"], targetPattern: "lowestHpEnemy" },
    ],
    execute(state, unit, log) {
      const target = findLowestHpEnemy(state, unit);
      if (!target) return logNoTarget(unit, log);
      grantStatusEffect(state, target, "healBlock", HEAL_BLOCK_DURATION, unit);
      recordStatusAppliedMetric(state, unit, "healBlock", 1);
      log.push(`${unitLabel(unit)} の阻害胞: ${unitLabel(target)} に回復封じ/${HEAL_BLOCK_DURATION}T`);
      recordStatusFrame(log, state, unit, [target], "healBlock", `${unit.card.name} の阻害胞`);
    },
  },
  midRearPressure: {
    name: "深海圧",
    text: "敵中後衛全体に小ダメージ。",
    components: [
      { effectElements: ["areaAttack"], targetPattern: "middleRearEnemies" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side).filter((enemy) => enemy.col >= 1);
      if (targets.length === 0) return logNoTarget(unit, log);
      const damage = Math.max(4, unitStats(state, unit).at - MID_REAR_PRESSURE_OFFSET);
      dealDamageGroup(state, unit, targets.map((target) => ({ target, rawDamage: damage })), "深海圧", log, rowsForCols(opposite(unit.side), [1, 2]));
    },
  },
  sporeCrush: {
    name: "菌腕",
    text: "最前の敵に大きめの単体ダメージ。",
    components: [
      { effectElements: ["singleAttack"], targetPattern: "frontEnemy" },
    ],
    execute(state, unit, log) {
      const target = findFrontTarget(state, unit);
      if (!target) return logNoTarget(unit, log);
      dealDamage(state, unit, target, Math.max(6, unitStats(state, unit).at - SPORE_CRUSH_OFFSET), "菌腕", log);
    },
  },
  sporeBarrage: {
    name: "胞子砲",
    text: "敵前衛全体に小ダメージを与え、毒を付与する。",
    components: [
      { effectElements: ["areaAttack", "poison"], targetPattern: "frontRankEnemies" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side).filter((enemy) => enemy.col === 0);
      if (targets.length === 0) return logNoTarget(unit, log);
      const damage = Math.max(5, unitStats(state, unit).at - SPORE_BARRAGE_OFFSET);
      const events = dealDamageGroup(state, unit, targets.map((target) => ({ target, rawDamage: damage })), "胞子砲", log);
      applyStatusToDamageEvents(state, unit, events, "poison", POISON_DURATION, log);
    },
  },
  toxicNeedle: {
    name: "毒針",
    text: "最前の敵を毒状態にする。",
    components: [
      { effectElements: ["poison"], targetPattern: "frontEnemy" },
    ],
    execute(state, unit, log) {
      const target = findFrontTarget(state, unit);
      if (!target) return logNoTarget(unit, log);
      applyStatusToTargets(state, unit, [target], "poison", POISON_DURATION, log, "毒針");
    },
  },
  toxicCloud: {
    name: "毒雲",
    text: "敵前衛全体を毒状態にする。",
    components: [
      { effectElements: ["poison"], targetPattern: "frontRankEnemies" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side).filter((enemy) => enemy.col === 0);
      if (targets.length === 0) return logNoTarget(unit, log);
      applyStatusToTargets(state, unit, targets, "poison", POISON_DURATION, log, "毒雲");
    },
  },
  thornGuard: {
    name: "棘構え",
    text: "自身に装甲と接触毒を付与する。",
    components: [
      { effectElements: ["armor", "contactPoison"], targetPattern: "self" },
    ],
    execute(state, unit, log) {
      grantArmor(state, unit, THORN_GUARD_ARMOR, STANDARD_ARMOR_DURATION);
      grantStatusEffect(state, unit, "contactPoison", CONTACT_POISON_DURATION, unit);
      recordStatusAppliedMetric(state, unit, "contactPoison", 1);
      log.push(`${unitLabel(unit)} の棘構え: 自身に装甲+${THORN_GUARD_ARMOR}/${STANDARD_ARMOR_DURATION}T、接触毒/${CONTACT_POISON_DURATION}T`);
      recordFrame(log, state, {
        type: "buff",
        sourceId: unit.id,
        targetId: unit.id,
        buffEvents: [{ targetId: unit.id, armor: THORN_GUARD_ARMOR, duration: STANDARD_ARMOR_DURATION, statusKey: "contactPoison" }],
        text: `${unit.card.name} の棘構え`,
      });
    },
  },
  mirrorShell: {
    name: "鏡殻",
    text: "自身に装甲と反射殻を付与する。",
    components: [
      { effectElements: ["armor", "reflect"], targetPattern: "self" },
    ],
    execute(state, unit, log) {
      grantArmor(state, unit, MIRROR_SHELL_ARMOR, STANDARD_ARMOR_DURATION);
      grantStatusEffect(state, unit, "reflectShell", REFLECT_SHELL_DURATION, unit);
      recordStatusAppliedMetric(state, unit, "reflectShell", 1);
      log.push(`${unitLabel(unit)} の鏡殻: 自身に装甲+${MIRROR_SHELL_ARMOR}/${STANDARD_ARMOR_DURATION}T、反射殻/${REFLECT_SHELL_DURATION}T`);
      recordFrame(log, state, {
        type: "buff",
        sourceId: unit.id,
        targetId: unit.id,
        buffEvents: [{ targetId: unit.id, armor: MIRROR_SHELL_ARMOR, duration: STANDARD_ARMOR_DURATION, statusKey: "reflectShell" }],
        text: `${unit.card.name} の鏡殻`,
      });
    },
  },
  selfUltimateCharge: {
    name: "潜航蓄力",
    text: `自身の必殺技を${ULTIMATE_CHARGE_AMOUNT}T短縮する。`,
    components: [
      { effectElements: ["ultimateCharge"], targetPattern: "self" },
    ],
    execute(state, unit, log) {
      chargeUltimateGauge(state, unit, ULTIMATE_CHARGE_AMOUNT);
      log.push(`${unitLabel(unit)} の潜航蓄力: 自身の必殺技を${ULTIMATE_CHARGE_AMOUNT}T短縮`);
      recordFrame(log, state, { type: "buff", sourceId: unit.id, targetId: unit.id, text: `${unit.card.name} の潜航蓄力` });
    },
  },
  wait: {
    name: "待機",
    text: "何もしない。",
    components: [
      { effectElements: ["wait"], targetPattern: "none" },
    ],
    execute(state, unit, log) {
      log.push(`${unitLabel(unit)} は待機`);
    },
  },
};

const cards = {
  captain: {
    name: "アーマークラブ",
    rarity: "common",
    classification: "crustacean",
    traits: ["carapace", "aquatic"],
    roles: ["defense", "attack"],
    hp: 135,
    at: 32,
    ag: 34,
    soldierCost: 5,
    generalCost: 6,
    tags: ["heavy", "leader"],
    preferredTerrain: ["sea", "rampart"],
    ability: "各ターン最初に受けるダメージ-2。",
    abilityKey: "steady",
    generalSkill: "開戦時、味方前衛に装甲+12/1T。",
    generalKey: "frontArmor",
    ultimate: { name: "甲殻包囲", turns: 5, key: "frontBulwark" },
    front: "slash",
    middle: "guard",
    rear: "rally",
    codexText: "群れの前面で殻壁を作る沿岸性の防衛種。",
  },
  tideguard: {
    name: "リーフバスティオン",
    rarity: "rare",
    classification: "crustacean",
    traits: ["aquatic", "carapace", "giant"],
    roles: ["defense"],
    hp: 145,
    at: 30,
    ag: 25,
    soldierCost: 5,
    generalCost: 8,
    tags: ["heavy", "sea"],
    preferredTerrain: ["sea"],
    ability: "海マス上で最大HP+6。",
    abilityKey: "seaHp",
    generalSkill: "開戦時、海/殻壁上の味方に装甲+10/1T。",
    generalKey: "harborWall",
    ultimate: { name: "礁壁展開", turns: 5, key: "teamBarrier" },
    front: "guard",
    middle: "slash",
    rear: "rally",
    codexText: "珊瑚状の外殻を展開し、海域の群れを守る大型種。",
  },
  archer: {
    name: "スカイレイ",
    rarity: "common",
    classification: "bird",
    traits: ["flying", "predation"],
    roles: ["attack"],
    hp: 100,
    at: 37,
    ag: 42,
    soldierCost: 4,
    generalCost: 6,
    tags: ["ranged"],
    preferredTerrain: ["forest", "highland"],
    ability: "森/高地からの攻撃ダメージ+2。",
    abilityKey: "rangedTerrain",
    generalSkill: "自分側の初回狙撃ダメージ+5。",
    generalKey: "firstSnipe",
    ultimate: { name: "成層圏急降下", turns: 5, key: "rearExecution" },
    front: "slash",
    middle: "sweep",
    rear: "snipe",
    codexText: "高空から熱源を検知し、後方の弱った個体を急襲する飛行種。",
  },
  oracle: {
    name: "ミストミセリウム",
    rarity: "common",
    classification: "fungi",
    traits: ["mycelium", "swarm"],
    roles: ["heal", "defense"],
    hp: 105,
    at: 27,
    ag: 31,
    soldierCost: 4,
    generalCost: 6,
    tags: ["support"],
    preferredTerrain: ["forest", "shrine"],
    ability: `祈祷時、対象に装甲+${BLESSING_ARMOR}/${STANDARD_ARMOR_DURATION}T。`,
    abilityKey: "blessing",
    generalSkill: "味方が初めて倒れた時、全員HP+5。",
    generalKey: "firstFallHeal",
    ultimate: { name: "胞子再生雲", turns: 5, key: "teamHeal" },
    front: "heal",
    middle: "heal",
    rear: "rally",
    codexText: "霧状の胞子で傷口を覆い、群れの損耗を抑える菌糸種。",
  },
  priest: {
    name: "スポアコロニー",
    rarity: "common",
    classification: "fungi",
    traits: ["mycelium", "poisonous"],
    roles: ["heal"],
    hp: 102,
    at: 29,
    ag: 30,
    soldierCost: 4,
    generalCost: 6,
    tags: ["support"],
    preferredTerrain: ["forest", "shrine"],
    ability: `治癒陣の回復量+${WIDE_PRAYER_BONUS}。`,
    abilityKey: "widePrayer",
    generalSkill: "味方が初めて倒れた時、全員HP+5。",
    generalKey: "firstFallHeal",
    ultimate: { name: "菌糸再接続", turns: 5, key: "deepTeamHeal" },
    front: "heal",
    middle: "lineHeal",
    rear: "lineHeal",
    codexText: "細い菌糸を同列に伸ばし、広域の再生を担う群体種。",
  },
  duelist: {
    name: "ヴェロキラプトル",
    rarity: "common",
    classification: "reptile",
    traits: ["dash", "predation"],
    roles: ["attack"],
    hp: 110,
    at: 36,
    ag: 53,
    soldierCost: 5,
    generalCost: 6,
    tags: ["scout"],
    preferredTerrain: ["plain", "forest"],
    ability: "HP満タン時、AG+5。",
    abilityKey: "quickStart",
    generalSkill: "自身が前衛にいる間、与ダメージ+4。",
    generalKey: "frontDuel",
    ultimate: { name: "連鎖裂爪", turns: 5, key: "alphaClaw" },
    front: "slash",
    middle: "raid",
    rear: "raid",
    codexText: "小型ながら反応速度が高く、負傷個体を見逃さない捕食種。",
  },
  lancer: {
    name: "トライホーン",
    rarity: "common",
    classification: "mammal",
    traits: ["giant", "dash"],
    roles: ["attack"],
    hp: 120,
    at: 39,
    ag: 36,
    soldierCost: 5,
    generalCost: 7,
    tags: ["assault"],
    preferredTerrain: ["plain", "highland"],
    ability: "同列に敵が2体以上いる時、貫通ダメージ+2。",
    abilityKey: "laneBreaker",
    generalSkill: "3ターン目開始時、味方前衛にAT+4。",
    generalKey: "turnThreeCharge",
    ultimate: { name: "群角突進", turns: 5, key: "lineCrush" },
    front: "pierce",
    middle: "pierce",
    rear: "rally",
    codexText: "硬質の三角を並べて突進し、同列をまとめて押し崩す大型草食種。",
  },
  scout: {
    name: "グラスマンティス",
    rarity: "common",
    classification: "insect",
    traits: ["mimicry", "predation"],
    roles: ["attack"],
    hp: 95,
    at: 35,
    ag: 47,
    soldierCost: 5,
    generalCost: 6,
    tags: ["scout"],
    preferredTerrain: ["forest"],
    ability: `奇襲時、対象が中衛ならダメージ+${MIDDLE_RAID_BONUS}。`,
    abilityKey: "middleRaid",
    generalSkill: `1ターン目、味方斥候のAG+${SCOUT_LEAD_AG}。`,
    generalKey: "scoutLead",
    ultimate: { name: "透明化捕食", turns: 5, key: "rearExecution" },
    front: "slash",
    middle: "raid",
    rear: "raid",
    codexText: "草原と森の境界に溶け込み、中後衛を刈り取る擬態昆虫。",
  },
  engineer: {
    name: "レジンビートル",
    rarity: "rare",
    classification: "insect",
    traits: ["carapace", "swarm"],
    roles: ["defense", "support"],
    hp: 115,
    at: 24,
    ag: 28,
    soldierCost: 4,
    generalCost: 6,
    tags: ["support"],
    preferredTerrain: ["rampart", "forest"],
    ability: `殻壁上では守護の装甲+${RAMPART_GUARD_BONUS}。`,
    abilityKey: "rampartCraft",
    generalSkill: "自分の地形コスト-2として扱う。",
    generalKey: "terrainDiscount",
    ultimate: { name: "巣壁構築", turns: 5, key: "frontBulwark" },
    front: "guard",
    middle: "guard",
    rear: "command",
    codexText: "樹脂と土壌を固めて即席の巣壁を作る環境改変種。",
  },
  paladin: {
    name: "オブシディアンタートル",
    rarity: "rare",
    classification: "reptile",
    traits: ["carapace", "aquatic", "giant"],
    roles: ["defense", "heal"],
    hp: 125,
    at: 29,
    ag: 32,
    soldierCost: 5,
    generalCost: 7,
    tags: ["heavy", "support"],
    preferredTerrain: ["sea", "rampart"],
    ability: `献身の装甲+${DEVOTED_WARD_BONUS}。`,
    abilityKey: "devotedWard",
    generalSkill: "開戦時、味方前衛に装甲+12/1T。",
    generalKey: "frontArmor",
    ultimate: { name: "黒曜甲羅", turns: 5, key: "alphaShell" },
    front: "slash",
    middle: "generalWard",
    rear: "generalWard",
    codexText: "黒い鉱物質の甲羅を持ち、アルファ個体の前で要塞化する長寿種。",
  },
  strategist: {
    name: "サンダーイール",
    rarity: "common",
    classification: "fish",
    traits: ["aquatic", "electric"],
    roles: ["support"],
    hp: 100,
    at: 26,
    ag: 39,
    soldierCost: 4,
    generalCost: 6,
    tags: ["support", "leader"],
    preferredTerrain: ["sea"],
    ability: "指揮のAT補正+1。",
    abilityKey: "sharpCommand",
    generalSkill: "開戦時、味方中衛にAG+6。",
    generalKey: "midAg",
    ultimate: { name: "電位同期", turns: 5, key: "synapticSurge" },
    front: "slash",
    middle: "command",
    rear: "command",
    codexText: "微弱な電位で同列の筋反応を同期させる水棲支援種。",
  },
  lord: {
    name: "シナプスコア",
    rarity: "legendary",
    classification: "crystalLife",
    traits: ["electric", "swarm"],
    roles: ["support"],
    hp: 92,
    at: 25,
    ag: 37,
    soldierCost: 4,
    generalCost: 8,
    tags: ["support", "leader"],
    preferredTerrain: ["shrine", "highland"],
    ability: "α特性重視。通常時は標準的な支援役。",
    abilityKey: "none",
    generalSkill: `開戦時、味方全員にAT+${ALL_ORDER_AT}/AG+${ALL_ORDER_AG}/${ALL_ORDER_DURATION}T。`,
    generalKey: "allOutOrder",
    ultimate: { name: "群知性起動", turns: 5, key: "synapticSurge" },
    front: "slash",
    middle: "command",
    rear: "rally",
    codexText: "結晶核に群れの感覚を集約し、短時間だけ全個体を同調させる中枢体。",
  },
  breaker: {
    name: "ティラノファング",
    rarity: "rare",
    classification: "reptile",
    traits: ["ancient", "predation", "giant"],
    roles: ["attack"],
    hp: 125,
    at: 41,
    ag: 24,
    soldierCost: 5,
    generalCost: 7,
    tags: ["heavy", "assault"],
    preferredTerrain: ["plain", "highland"],
    ability: "露出αへの破陣ダメージ+4。",
    abilityKey: "generalBreaker",
    generalSkill: "敵αが前衛へ出た時、自身にAT+6。",
    generalKey: "finishSignal",
    ultimate: { name: "頂点捕食", turns: 5, key: "alphaClaw" },
    front: "siege",
    middle: "siege",
    rear: "wait",
    codexText: "古代捕食者の再現個体。露出したアルファ個体へ一直線に圧をかける。",
  },
  cannoneer: {
    name: "ボルカノドレイク",
    rarity: "rare",
    classification: "dragon",
    traits: ["flying", "giant", "ancient"],
    roles: ["attack"],
    hp: 92,
    at: 43,
    ag: 18,
    soldierCost: 6,
    generalCost: 8,
    tags: ["ranged", "heavy"],
    preferredTerrain: ["highland"],
    ability: `後衛からの掃射ダメージ+${REAR_CANNON_BONUS}。`,
    abilityKey: "rearCannon",
    generalSkill: `敵前衛が${OPENING_BARRAGE_MIN_FRONT}体以上なら、1ターン目に掃射。`,
    generalKey: "openingBarrage",
    ultimate: { name: "火山熱線", turns: 5, key: "wideScorch" },
    front: "slash",
    middle: "sweep",
    rear: "sweep",
    codexText: "火山帯で観測される竜類。低AGだが、広範囲へ熱線を浴びせる。",
  },
  seer: {
    name: "ルミナクラゲ",
    rarity: "common",
    classification: "fish",
    traits: ["aquatic", "electric", "mimicry"],
    roles: ["support", "attack"],
    hp: 90,
    at: 32,
    ag: 33,
    soldierCost: 4,
    generalCost: 6,
    tags: ["support", "ranged"],
    preferredTerrain: ["sea", "shrine"],
    ability: "後衛にいる間、受ける遠隔ダメージ-3。",
    abilityKey: "rearWard",
    generalSkill: "自分のαが初めて中衛へ出た時、全員に装甲+14/1T。",
    generalKey: "fallbackWard",
    ultimate: { name: "発光パルス", turns: 5, key: "rearExecution" },
    front: "heal",
    middle: "snipe",
    rear: "command",
    codexText: "発光器官で敵の視線を乱し、味方の行動タイミングを整える浮遊水棲種。",
  },
  raptorSwarm: {
    name: "群爪スウォーム",
    rarity: "common",
    classification: "insect",
    traits: ["swarm", "dash"],
    roles: ["attack"],
    hp: 85,
    at: 30,
    ag: 55,
    soldierCost: 4,
    generalCost: 5,
    tags: ["scout"],
    preferredTerrain: ["plain", "forest"],
    ability: "HPが半分以下の敵への追跡ダメージ+3。",
    abilityKey: "executeHunter",
    generalSkill: `1ターン目、味方斥候のAG+${SCOUT_LEAD_AG}。`,
    generalKey: "scoutLead",
    ultimate: { name: "群爪連携", turns: 5, key: "rearExecution" },
    front: "slash",
    middle: "lowHpStrike",
    rear: "selfAg",
    codexText: "小型個体が群れで獲物を追い、弱った個体を逃さない高速種。",
  },
  blinkFox: {
    name: "ブリンクフォックス",
    rarity: "common",
    classification: "mammal",
    traits: ["dash", "mimicry"],
    roles: ["attack", "disrupt"],
    hp: 96,
    at: 33,
    ag: 49,
    soldierCost: 5,
    generalCost: 6,
    tags: ["scout"],
    preferredTerrain: ["forest"],
    ability: "撹乱時、対象のAG弱体をさらに-2。",
    abilityKey: "deepSnare",
    generalSkill: "開戦時、味方中衛にAG+6。",
    generalKey: "midAg",
    ultimate: { name: "閃光撹乱", turns: 5, key: "rearExecution" },
    front: "slash",
    middle: "agSnare",
    rear: "snipe",
    codexText: "瞬間的な発光と跳躍で敵の反応を遅らせる小型捕食種。",
  },
  stormPelican: {
    name: "ストームペリカン",
    rarity: "common",
    classification: "bird",
    traits: ["flying", "electric"],
    roles: ["attack", "disrupt"],
    hp: 96,
    at: 30,
    ag: 40,
    soldierCost: 4,
    generalCost: 6,
    tags: ["ranged"],
    preferredTerrain: ["forest", "highland"],
    ability: "後衛にいる間、受ける遠隔ダメージ-3。",
    abilityKey: "rearWard",
    generalSkill: "開戦時、味方中衛にAG+6。",
    generalKey: "midAg",
    ultimate: { name: "嵐翼放電", turns: 5, key: "synapticSurge" },
    front: "slash",
    middle: "agSnare",
    rear: "snipe",
    codexText: "帯電した翼膜で風向きを乱し、後方から敵の動きを鈍らせる飛行種。",
  },
  ironFern: {
    name: "アイアンシダ",
    rarity: "common",
    classification: "fungi",
    traits: ["mycelium", "carapace"],
    roles: ["defense", "heal"],
    hp: 118,
    at: 24,
    ag: 24,
    soldierCost: 5,
    generalCost: 7,
    tags: ["support", "heavy"],
    preferredTerrain: ["forest", "rampart"],
    ability: `殻壁上では守護の装甲+${RAMPART_GUARD_BONUS}。`,
    abilityKey: "rampartCraft",
    generalSkill: "味方が初めて倒れた時、全員HP+5。",
    generalKey: "firstFallHeal",
    ultimate: { name: "鉄葉再生", turns: 5, key: "teamBarrier" },
    front: "guard",
    middle: "lineHeal",
    rear: "shellBind",
    codexText: "金属質の葉脈を広げ、菌糸と甲殻の中間のような防壁を作る植物状菌類。",
  },
  sporeTitan: {
    name: "タイタンミセリウム",
    rarity: "legendary",
    classification: "fungi",
    traits: ["mycelium", "poisonous", "giant"],
    roles: ["attack"],
    hp: 118,
    at: 39,
    ag: 18,
    soldierCost: 6,
    generalCost: 8,
    tags: ["heavy", "support"],
    preferredTerrain: ["forest", "shrine"],
    ability: `胞子砲で毒/${POISON_DURATION}Tを付与する。`,
    abilityKey: "none",
    generalSkill: "味方が初めて倒れた時、全員HP+5。",
    generalKey: "firstFallHeal",
    ultimate: { name: "毒花冠", turns: 6, key: "toxicBloom" },
    front: "sporeCrush",
    middle: "sporeBarrage",
    rear: "sporeBarrage",
    codexText: "菌糸網の中枢に育つ巨大子実体。守られて時間を得るほど胞子圧で前線を崩す。",
  },
  chronoAmmonite: {
    name: "クロノアンモナイト",
    rarity: "rare",
    classification: "fish",
    traits: ["aquatic", "ancient", "crystal"],
    roles: ["support", "defense"],
    hp: 110,
    at: 22,
    ag: 20,
    soldierCost: 4,
    generalCost: 7,
    tags: ["sea", "support"],
    preferredTerrain: ["sea", "shrine"],
    ability: "時流で自身は短縮対象にしない。",
    abilityKey: "none",
    generalSkill: "自分の地形コスト-2として扱う。",
    generalKey: "terrainDiscount",
    ultimate: { name: "巻殻時流", turns: 5, key: "teamBarrier" },
    front: "slash",
    middle: "quickenUltimate",
    rear: "generalWard",
    codexText: "殻に残る結晶層が周囲の生体リズムを早める古代水棲種。",
  },
  acidCoral: {
    name: "アシッドコーラル",
    rarity: "common",
    classification: "crystalLife",
    traits: ["aquatic", "poisonous", "crystal"],
    roles: ["attack", "disrupt"],
    hp: 98,
    at: 28,
    ag: 28,
    soldierCost: 5,
    generalCost: 6,
    tags: ["sea", "support"],
    preferredTerrain: ["sea"],
    ability: "酸霧で与えた防御低下は被ダメージ+4。",
    abilityKey: "none",
    generalSkill: "開戦時、海/殻壁上の味方に装甲+10/1T。",
    generalKey: "harborWall",
    ultimate: { name: "酸潮噴霧", turns: 5, key: "wideScorch" },
    front: "acidBite",
    middle: "acidSweepDefense",
    rear: "acidSweepHealBlock",
    codexText: "珊瑚に似た結晶群体。酸性の潮で甲殻と菌糸の再生を阻害する。",
  },
  venomMoth: {
    name: "ヴェノムモス",
    rarity: "common",
    classification: "insect",
    traits: ["flying", "poisonous", "swarm"],
    roles: ["attack", "disrupt"],
    hp: 88,
    at: 27,
    ag: 44,
    soldierCost: 5,
    generalCost: 6,
    tags: ["scout", "ranged"],
    preferredTerrain: ["forest", "plain"],
    ability: "毒針と毒雲で継続ダメージを狙う。",
    abilityKey: "none",
    generalSkill: "味方が初めて倒れた時、全員HP+5。",
    generalKey: "firstFallHeal",
    ultimate: { name: "鱗粉包囲", turns: 7, key: "toxicBloom" },
    front: "toxicNeedle",
    middle: "toxicCloud",
    rear: "agSnare",
    codexText: "薄い羽から毒性の鱗粉を散らし、敵前線の消耗を早める小型昆虫。",
  },
  parasiteMold: {
    name: "パラサイトモールド",
    rarity: "common",
    classification: "fungi",
    traits: ["mycelium", "parasitic", "poisonous"],
    roles: ["heal", "disrupt"],
    hp: 104,
    at: 25,
    ag: 27,
    soldierCost: 5,
    generalCost: 6,
    tags: ["support"],
    preferredTerrain: ["forest", "shrine"],
    ability: "毒と回復阻害を重ね、長期戦の削りを補助する。",
    abilityKey: "none",
    generalSkill: "味方が初めて倒れた時、全員HP+5。",
    generalKey: "firstFallHeal",
    ultimate: { name: "寄生胞子群", turns: 7, key: "toxicBloom" },
    front: "toxicNeedle",
    middle: "healBlockPulse",
    rear: "toxicCloud",
    codexText: "根のような菌糸で傷口に入り込み、毒と阻害胞子をゆっくり広げる寄生菌。",
  },
  thornAnemone: {
    name: "ソーンアネモネ",
    rarity: "rare",
    classification: "crystalLife",
    traits: ["aquatic", "poisonous", "crystal"],
    roles: ["defense", "disrupt"],
    hp: 122,
    at: 26,
    ag: 23,
    soldierCost: 5,
    generalCost: 7,
    tags: ["sea", "support"],
    preferredTerrain: ["sea"],
    ability: "棘構えの接触毒は、構えた個体が攻撃を受けた時に毒を返す。",
    abilityKey: "contactStance",
    generalSkill: "開戦時、海/殻壁上の味方に装甲+10/1T。",
    generalKey: "harborWall",
    ultimate: { name: "棘壁共生", turns: 5, key: "teamBarrier" },
    front: "thornGuard",
    middle: "toxicNeedle",
    rear: "healBlockPulse",
    codexText: "結晶化した触手を広げ、殴りかかった敵へ毒を返す定着型の水棲生命。",
  },
  mirrorTurtle: {
    name: "ミラータートル",
    rarity: "rare",
    classification: "reptile",
    traits: ["carapace", "aquatic", "crystal"],
    roles: ["defense"],
    hp: 132,
    at: 24,
    ag: 18,
    soldierCost: 5,
    generalCost: 7,
    tags: ["heavy", "sea", "support"],
    preferredTerrain: ["sea", "rampart"],
    ability: "鏡殻の反射殻は、構えた個体が受けたダメージの一部を返す。",
    abilityKey: "reflectStance",
    generalSkill: "自分のαが初めて中衛へ出た時、全員に装甲+14/1T。",
    generalKey: "fallbackWard",
    ultimate: { name: "鏡面甲羅", turns: 5, key: "alphaShell" },
    front: "mirrorShell",
    middle: "guard",
    rear: "shellBind",
    codexText: "鏡面状の甲羅で衝撃をいなし、前線で受けた力を相手へ返す大型爬虫類。",
  },
  crystalLeech: {
    name: "クリスタルリーチ",
    rarity: "rare",
    classification: "crystalLife",
    traits: ["crystal", "parasitic", "aquatic"],
    roles: ["attack", "disrupt"],
    hp: 105,
    at: 31,
    ag: 32,
    soldierCost: 5,
    generalCost: 6,
    tags: ["sea", "support"],
    preferredTerrain: ["sea", "shrine"],
    ability: `貫殻系は装甲を無視し、対象の装甲を最大${BARRIER_PIERCE_ARMOR_BONUS_CAP}まで威力に加える。`,
    abilityKey: "armorPredator",
    generalSkill: "味方が初めて倒れた時、全員HP+5。",
    generalKey: "firstFallHeal",
    ultimate: { name: "反射吸血", turns: 5, key: "alphaShell" },
    front: "drainStrike",
    middle: "barrierPierceStrike",
    rear: "healBlockPulse",
    codexText: "結晶化した吸盤で外殻の隙間に貼りつき、体液と生体電位を奪う寄生種。",
  },
  mosasaurus: {
    name: "モササウルス",
    rarity: "rare",
    classification: "reptile",
    traits: ["aquatic", "ancient", "predation"],
    roles: ["attack"],
    hp: 150,
    at: 40,
    ag: 22,
    soldierCost: 6,
    generalCost: 8,
    tags: ["sea", "heavy", "assault"],
    preferredTerrain: ["sea"],
    ability: "HPが半分以下の敵への追跡ダメージ+3。",
    abilityKey: "executeHunter",
    generalSkill: "敵αが前衛へ出た時、自身にAT+6。",
    generalKey: "finishSignal",
    ultimate: { name: "深海捕食", turns: 5, key: "alphaClaw" },
    front: "slash",
    middle: "lowHpStrike",
    rear: "midRearPressure",
    codexText: "深海域から急浮上し、負傷した大型個体を水圧ごと噛み砕く古代爬虫類。",
  },
  megalodon: {
    name: "メガロドン",
    rarity: "rare",
    classification: "fish",
    traits: ["aquatic", "predation", "giant"],
    roles: ["attack"],
    hp: 140,
    at: 42,
    ag: 24,
    soldierCost: 6,
    generalCost: 8,
    tags: ["sea", "heavy", "assault"],
    preferredTerrain: ["sea"],
    ability: "HPが半分以下の敵への追跡ダメージ+3。",
    abilityKey: "executeHunter",
    generalSkill: "自身が前衛にいる間、与ダメージ+4。",
    generalKey: "frontDuel",
    ultimate: { name: "外洋狩猟", turns: 5, key: "alphaClaw" },
    front: "slash",
    middle: "lowHpStrike",
    rear: "selfUltimateCharge",
    codexText: "外洋の頂点捕食者。大技の気配を溜めながら弱った獲物へ圧をかける。",
  },
};

Object.values(cards).forEach((card) => {
  card.unlockPhase ??= "core";
  card.implemented ??= true;
  card.cost ??= card.soldierCost;
  card.alphaCost ??= card.generalCost;
});

const CARD_EDIT_NUMBER_FIELDS = Object.freeze({
  hp: Object.freeze({ min: 1, max: 999 }),
  at: Object.freeze({ min: 0, max: 999 }),
  ag: Object.freeze({ min: 0, max: 999 }),
  cost: Object.freeze({ min: 0, max: 20 }),
  alphaCost: Object.freeze({ min: 0, max: 20 }),
  ultimateTurns: Object.freeze({ min: 1, max: 12 }),
});

const ABILITY_KEY_OPTIONS = Object.freeze([
  Object.freeze({ id: "none", name: "なし" }),
  Object.freeze({ id: "steady", name: "初回被ダメージ-2" }),
  Object.freeze({ id: "seaHp", name: "海上HP+6" }),
  Object.freeze({ id: "rangedTerrain", name: "森/高地攻撃+2" }),
  Object.freeze({ id: "blessing", name: "祈祷に装甲追加" }),
  Object.freeze({ id: "widePrayer", name: "治癒陣+2" }),
  Object.freeze({ id: "quickStart", name: "満タン時AG+5" }),
  Object.freeze({ id: "laneBreaker", name: "同列2体で貫通+2" }),
  Object.freeze({ id: "middleRaid", name: "中衛奇襲+2" }),
  Object.freeze({ id: "rampartCraft", name: "殻壁守護+5" }),
  Object.freeze({ id: "devotedWard", name: "献身装甲+4" }),
  Object.freeze({ id: "sharpCommand", name: "指揮AT+1" }),
  Object.freeze({ id: "generalBreaker", name: "α対象破陣+4" }),
  Object.freeze({ id: "rearCannon", name: "後衛掃射+1" }),
  Object.freeze({ id: "rearWard", name: "後衛遠隔被ダメ-3" }),
  Object.freeze({ id: "executeHunter", name: "低HP追跡+3" }),
  Object.freeze({ id: "deepSnare", name: "撹乱AG低下+2" }),
  Object.freeze({ id: "armorPredator", name: "装甲捕食" }),
  Object.freeze({ id: "contactStance", name: "接触毒構え" }),
  Object.freeze({ id: "reflectStance", name: "反射殻構え" }),
]);

const GENERAL_KEY_OPTIONS = Object.freeze([
  Object.freeze({ id: "none", name: "なし" }),
  Object.freeze({ id: "frontArmor", name: "開戦前衛装甲" }),
  Object.freeze({ id: "harborWall", name: "海/殻壁装甲" }),
  Object.freeze({ id: "firstSnipe", name: "初回狙撃+5" }),
  Object.freeze({ id: "firstFallHeal", name: "初落ち全体回復" }),
  Object.freeze({ id: "frontDuel", name: "前衛中与ダメ+4" }),
  Object.freeze({ id: "turnThreeCharge", name: "3T前衛AT強化" }),
  Object.freeze({ id: "scoutLead", name: "1T斥候AG強化" }),
  Object.freeze({ id: "terrainDiscount", name: "地形コスト-2" }),
  Object.freeze({ id: "midAg", name: "開戦中衛AG強化" }),
  Object.freeze({ id: "allOutOrder", name: "開戦全体AT/AG強化" }),
  Object.freeze({ id: "finishSignal", name: "敵α露出時AT強化" }),
  Object.freeze({ id: "openingBarrage", name: "開幕掃射" }),
  Object.freeze({ id: "fallbackWard", name: "α中衛化時全体装甲" }),
]);

const CARD_TAG_OPTIONS = Object.freeze(["heavy", "leader", "sea", "ranged", "support", "scout", "assault"]);
const BASE_CARDS = cloneCardPool(cards);

const ultimateActions = {
  alphaClaw: {
    text: "露出αを優先し、単体に大ダメージ。",
    components: [
      { effectElements: ["singleAttack", "searchAttack"], targetPattern: "exposedAlphaOrFrontEnemy" },
    ],
    execute(state, unit, log) {
      const targetGeneral = generalOf(state, opposite(unit.side));
      const target = targetGeneral && isGeneralExposed(state, targetGeneral)
        ? targetGeneral
        : findFrontTarget(state, unit);
      if (!target) return logNoTarget(unit, log);
      dealDamage(state, unit, target, unitStats(state, unit).at + 16, unit.card.ultimate.name, log);
    },
  },
  rearExecution: {
    text: "敵中後衛の低HPを狙って大ダメージ。",
    components: [
      { effectElements: ["singleAttack", "searchAttack", "executeBonus"], targetPattern: "middleRearLowestHpEnemy" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side).filter((enemy) => enemy.col >= 1);
      const target = (targets.length ? targets : enemies(state, unit.side)).sort((a, b) => a.hp - b.hp)[0];
      if (!target) return logNoTarget(unit, log);
      dealDamage(state, unit, target, Math.max(12, unitStats(state, unit).at + 8), unit.card.ultimate.name, log);
    },
  },
  lineCrush: {
    text: "同列の敵を前から順に押し潰す。",
    components: [
      { effectElements: ["areaAttack"], targetPattern: "sameLaneFrontTwoEnemies" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side)
        .filter((enemy) => enemy.row === unit.row)
        .sort((a, b) => a.col - b.col)
        .slice(0, 3);
      if (targets.length === 0) return logNoTarget(unit, log);
      const at = unitStats(state, unit).at;
      dealDamageGroup(
        state,
        unit,
        targets.map((target, index) => ({ target, rawDamage: Math.max(8, at + 6 - index * 6) })),
        unit.card.ultimate.name,
        log,
        uniqueCells(targets.map((target) => ({ side: target.side, row: target.row, col: target.col }))),
      );
    },
  },
  wideScorch: {
    text: "敵全体に大きな範囲ダメージ。",
    components: [
      { effectElements: ["areaAttack"], targetPattern: "allEnemies" },
    ],
    execute(state, unit, log) {
      const targets = enemies(state, unit.side);
      if (targets.length === 0) return logNoTarget(unit, log);
      const damage = Math.max(8, unitStats(state, unit).at - 4);
      dealDamageGroup(
        state,
        unit,
        targets.map((target) => ({ target, rawDamage: damage })),
        unit.card.ultimate.name,
        log,
        rowsForCols(opposite(unit.side), [0, 1, 2]),
      );
    },
  },
  toxicBloom: {
    text: "敵全体に範囲ダメージを与え、毒を付与する。",
    components: [
      { effectElements: ["areaAttack", "poison"], targetPattern: "allEnemies" },
    ],
    execute(state, unit, log) {
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
      applyStatusToDamageEvents(state, unit, events, "poison", POISON_DURATION, log);
    },
  },
  frontBulwark: {
    text: "味方前衛全体に強い装甲を付与。",
    components: [
      { effectElements: ["armor"], targetPattern: "frontRankAllies" },
    ],
    execute(state, unit, log) {
      const targets = living(state, unit.side).filter((ally) => ally.col === 0);
      if (targets.length === 0) return logNoTarget(unit, log);
      const armor = 18;
      targets.forEach((target) => grantArmor(state, target, armor, STANDARD_ARMOR_DURATION));
      log.push(`${unitLabel(unit)} の${unit.card.ultimate.name}: ${buffTargetSummary(targets)} に装甲+${armor}/${STANDARD_ARMOR_DURATION}T`);
      recordBuffGroupFrame(log, state, unit, targets.map((target) => ({ targetId: target.id, armor, duration: STANDARD_ARMOR_DURATION })), `${unit.card.name} の${unit.card.ultimate.name}`);
    },
  },
  teamBarrier: {
    text: "味方全体に装甲を付与。",
    components: [
      { effectElements: ["armor"], targetPattern: "allAllies" },
    ],
    execute(state, unit, log) {
      const targets = living(state, unit.side);
      const armor = 12;
      targets.forEach((target) => grantArmor(state, target, armor, STANDARD_ARMOR_DURATION));
      log.push(`${unitLabel(unit)} の${unit.card.ultimate.name}: ${buffTargetSummary(targets)} に装甲+${armor}/${STANDARD_ARMOR_DURATION}T`);
      recordBuffGroupFrame(log, state, unit, targets.map((target) => ({ targetId: target.id, armor, duration: STANDARD_ARMOR_DURATION })), `${unit.card.name} の${unit.card.ultimate.name}`);
    },
  },
  teamHeal: {
    text: "味方全体を回復する。",
    components: [
      { effectElements: ["heal"], targetPattern: "allAllies" },
    ],
    execute(state, unit, log) {
      executeTeamHealUltimate(state, unit, Math.max(8, Math.floor(unitStats(state, unit).at * 0.55)), log);
    },
  },
  deepTeamHeal: {
    text: "味方全体を大きく回復する。",
    components: [
      { effectElements: ["heal"], targetPattern: "allAllies" },
    ],
    execute(state, unit, log) {
      executeTeamHealUltimate(state, unit, Math.max(12, Math.floor(unitStats(state, unit).at * 0.75)), log);
    },
  },
  alphaShell: {
    text: "味方αに強い装甲と回復を与える。",
    components: [
      { effectElements: ["armor", "heal"], targetPattern: "allyAlpha" },
    ],
    execute(state, unit, log) {
      const target = generalOf(state, unit.side);
      if (!target || target.hp <= 0) return logNoTarget(unit, log);
      const armor = 26;
      const amount = Math.max(10, Math.floor(unitStats(state, unit).at * 0.55));
      grantArmor(state, target, armor, STANDARD_ARMOR_DURATION);
      const healed = heal(state, target, amount);
      log.push(`${unitLabel(unit)} の${unit.card.ultimate.name}: ${unitLabel(target)} に装甲+${armor}/${STANDARD_ARMOR_DURATION}T、HP${healed}回復`);
      recordFrame(log, state, {
        type: "heal",
        sourceId: unit.id,
        targetId: target.id,
        amount: healed,
        healEvents: healed > 0 ? [{ targetId: target.id, amount: healed }] : [],
        buffEvents: [{ targetId: target.id, armor, duration: STANDARD_ARMOR_DURATION }],
        text: `${unit.card.name} の${unit.card.ultimate.name}`,
      });
    },
  },
  synapticSurge: {
    text: "味方全体にAT/AG強化。",
    components: [
      { effectElements: ["atBuff", "agBuff"], targetPattern: "allAllies" },
    ],
    execute(state, unit, log) {
      const targets = living(state, unit.side);
      const atBonus = 4;
      const agBonus = 7;
      targets.forEach((target) => {
        grantStatBuff(state, target, "at", atBonus, COMMAND_DURATION);
        grantStatBuff(state, target, "ag", agBonus, COMMAND_DURATION);
      });
      log.push(`${unitLabel(unit)} の${unit.card.ultimate.name}: ${buffTargetSummary(targets)} にAT+${atBonus}/AG+${agBonus}/${COMMAND_DURATION}T`);
      recordBuffGroupFrame(log, state, unit, targets.map((target) => ({ targetId: target.id, at: atBonus, ag: agBonus, duration: COMMAND_DURATION })), `${unit.card.name} の${unit.card.ultimate.name}`);
    },
  },
};

[terrainTypes, actions, ultimateActions].forEach((collection) => {
  Object.values(collection).forEach((entry) => {
    entry.unlockPhase ??= "core";
    entry.implemented ??= true;
  });
});

applyStoredCardEdits();

function isEffectElementAvailable(effectId, phase = ACTIVE_RULESET_PHASE) {
  const effect = EFFECT_ELEMENTS[effectId];
  return isRulesetEntryAvailable(effect, phase)
    && (!effect.statusKey || isRulesetEntryAvailable(STATUS_EFFECTS[effect.statusKey], phase));
}

function isActionAvailable(action, phase = ACTIVE_RULESET_PHASE) {
  return isRulesetEntryAvailable(action, phase) && typeof action.execute === "function"
    && Array.isArray(action.components) && action.components.length > 0
    && action.components.every((component) => Object.hasOwn(TARGET_PATTERNS, component.targetPattern)
      && Array.isArray(component.effectElements)
      && component.effectElements.every((effectId) => isEffectElementAvailable(effectId, phase)));
}

function isCardAvailable(card, phase = ACTIVE_RULESET_PHASE) {
  return isRulesetEntryAvailable(card, phase)
    && Object.hasOwn(CLASSIFICATIONS, card.classification)
    && (card.traits || []).every((traitId) => isRulesetEntryAvailable(TRAITS[traitId], phase)
      && (TRAITS[traitId].effectElements || []).every((effectId) => isEffectElementAvailable(effectId, phase)))
    && (card.preferredTerrain || []).every((terrainId) => isRulesetEntryAvailable(terrainTypes[terrainId], phase))
    && ["front", "middle", "rear"].every((slot) => isActionAvailable(actions[card[slot]], phase))
    && (!card.ultimate || isActionAvailable(ultimateActions[card.ultimate.key], phase));
}

function rulesetCatalog(phase = ACTIVE_RULESET_PHASE) {
  const availableIds = (collection, predicate = (entry) => isRulesetEntryAvailable(entry, phase)) =>
    Object.entries(collection).filter(([, entry]) => predicate(entry)).map(([id]) => id);
  return {
    phase,
    cards: availableIds(cards, (card) => isCardAvailable(card, phase)),
    statuses: availableIds(STATUS_EFFECTS),
    effects: Object.keys(EFFECT_ELEMENTS).filter((id) => isEffectElementAvailable(id, phase)),
    traits: availableIds(TRAITS, (trait) => isRulesetEntryAvailable(trait, phase)
      && (trait.effectElements || []).every((id) => isEffectElementAvailable(id, phase))),
    terrains: availableIds(terrainTypes),
    templates: availableIds(WIN_PLAN_TEMPLATES),
  };
}

const ACTION_SLOTS = Object.freeze([
  { id: "front", cardKey: "front", label: TERMS.ranks[0], shortLabel: TERMS.rankShort[0] },
  { id: "middle", cardKey: "middle", label: TERMS.ranks[1], shortLabel: TERMS.rankShort[1] },
  { id: "rear", cardKey: "rear", label: TERMS.ranks[2], shortLabel: TERMS.rankShort[2] },
]);

const ACTION_METADATA = Object.freeze(Object.fromEntries(Object.entries(actions).map(([id, action]) => [
  id,
  Object.freeze({
    name: action.name,
    text: action.text,
    unlockPhase: action.unlockPhase,
    implemented: action.implemented,
    components: Object.freeze(actionComponents(id).map((component) => Object.freeze({
      effectElements: Object.freeze([...component.effectElements]),
      targetPattern: component.targetPattern,
    }))),
  }),
])));

let CARD_ACTION_SEARCH_INDEX = frozenCardActionSearchIndex();

let CARD_SCORE_INDEX = buildCardScoreIndex();

function frozenCardActionSearchIndex() {
  return Object.freeze(buildCardActionSearchIndex(cards).map((record) => Object.freeze(record)));
}

function refreshDerivedCardData() {
  CARD_ACTION_SEARCH_INDEX = frozenCardActionSearchIndex();
  CARD_SCORE_INDEX = buildCardScoreIndex();
  refreshGeneratedPresets();
}

function refreshGeneratedPresets() {
  STANDARD_DECK_GENERATION_RESULT = generateStandardDeckCandidates();
  for (let index = presets.length - 1; index >= 0; index -= 1) {
    if (presets[index].kind === "generated") presets.splice(index, 1);
  }
  const customIndex = presets.findIndex((preset) => preset.kind === "custom");
  const insertionIndex = customIndex >= 0 ? customIndex : presets.length;
  presets.splice(insertionIndex, 0, ...STANDARD_DECK_GENERATION_RESULT.presets);
  normalizeSelectedPresets();
}

function normalizeSelectedPresets() {
  ["player", "enemy"].forEach((side) => {
    if (presets.some((preset) => preset.id === setup?.[`${side}Preset`])) return;
    applyPresetToSide(side, side === "player" ? "sample-rapid" : "sample-shell");
  });
}

function buildCardScoreIndex() {
  return Object.freeze(Object.fromEntries(Object.keys(cards).map((cardId) => [cardId, Object.freeze(scoreCard(cardId))])));
}

function scoreCard(cardId) {
  const card = cards[cardId];
  const rawStatScore = scoreStats(card);
  const rawActionScore = scoreCardActions(card);
  const rawUltimateScore = scoreUltimateForCard(card);
  const rawAbilityScore = scoreAbility(card);
  const statScore = normalizeScore(rawStatScore);
  const actionScore = normalizeScore(rawActionScore);
  const ultimateScoreValue = normalizeScore(rawUltimateScore);
  const abilityScoreValue = normalizeScore(rawAbilityScore);
  const normalTotal = statScore + actionScore + ultimateScoreValue + abilityScoreValue;
  const alphaTraitScore = normalizeScore(scoreAlphaTrait(card));
  const alphaHpScore = normalizeScore(Math.ceil(card.hp * 0.2) * SCORING_RULES.statWeights.hp);
  const alphaTotal = normalTotal + alphaTraitScore + alphaHpScore;
  return {
    cardId,
    name: card.name,
    normalCost: normalCardCost(card),
    alphaCost: alphaCardCost(card),
    statScore: roundScore(statScore),
    actionScore: roundScore(actionScore),
    ultimateScore: roundScore(ultimateScoreValue),
    abilityScore: roundScore(abilityScoreValue),
    normalTotal: roundScore(normalTotal),
    normalJudgment: scoreJudgment(normalTotal, "normal", normalCardCost(card)),
    alphaTraitScore: roundScore(alphaTraitScore),
    alphaHpScore: roundScore(alphaHpScore),
    alphaTotal: roundScore(alphaTotal),
    alphaJudgment: scoreJudgment(alphaTotal, "alpha", alphaCardCost(card)),
  };
}

function scoreStats(card) {
  return card.hp * SCORING_RULES.statWeights.hp + card.ag * SCORING_RULES.statWeights.ag;
}

function scoreCardActions(card) {
  const slotScores = ACTION_SLOTS.map((slot) => ({
    slot: slot.id,
    score: scoreActionForCard(card, card[slot.cardKey], slot.id),
  }));
  const weightedScore = slotScores.reduce((sum, slotScore) => {
    return sum + slotScore.score * (SCORING_RULES.slotWeights[slotScore.slot] || 0);
  }, 0);
  const sortedScores = slotScores.map((slotScore) => slotScore.score).sort((a, b) => b - a);
  const weights = SCORING_RULES.conceptActionWeights;
  const conceptScore =
    (sortedScores[0] || 0) * weights.primary +
    (sortedScores[1] || 0) * weights.secondary +
    (sortedScores[2] || 0) * weights.tertiary;
  return Math.max(weightedScore, conceptScore);
}

function scoreActionForCard(card, actionKey, slotId = null) {
  const components = actionComponents(actionKey);
  const componentScore = components.reduce((sum, component) => sum + scoreActionComponent(component), 0);
  const outputScore = actionOutputScore(card, actionKey, slotId);
  const compositeBonus = scoreActionCompositeBonus(components, card);
  return Math.max(-15, componentScore + outputScore + compositeBonus);
}

function scoreActionCompositeBonus(components, card) {
  const effectIds = new Set(components.flatMap((component) => component.effectElements || []));
  const hasAttack = ["singleAttack", "areaAttack", "searchAttack"].some((effectId) => effectIds.has(effectId));
  let bonus = components.length >= 2 ? 6 : 0;
  if (hasAttack && effectIds.has("poison")) {
    bonus += SCORING_RULES.attackPoisonCompositeScore;
  }
  if (effectIds.has("heal") && (effectIds.has("armor") || card.abilityKey === "blessing")) {
    bonus += SCORING_RULES.healArmorCompositeScore;
  }
  return bonus;
}

function scoreActionComponent(component) {
  const effectScore = (component.effectElements || []).reduce((sum, effectId) => {
    const effect = EFFECT_ELEMENTS[effectId];
    if (!effect) return sum;
    const riskScore = (effect.riskFlags || []).reduce((riskSum, flag) => riskSum + (SCORING_RULES.riskScores[flag] || 0), 0);
    const statusScore = SCORING_RULES.statusScores[effectId] || 0;
    return sum + effect.baseScore + riskScore + statusScore;
  }, 0);
  return effectScore + targetPatternScore(component.targetPattern);
}

function targetPatternScore(targetPatternId) {
  const pattern = TARGET_PATTERNS[targetPatternId];
  if (!pattern) return 0;
  const depthSum = (pattern.depthAccess || []).reduce((sum, depth) => sum + depth, 0);
  const depthMultiplier = pattern.side === "enemy" ? 2.0 : pattern.side === "ally" ? 1.0 : 0;
  const shapeScore = SCORING_RULES.shapeScores[pattern.shape] || 0;
  const priorityScore = SCORING_RULES.priorityScores[pattern.priority] || 0;
  return depthSum * depthMultiplier + shapeScore + priorityScore;
}

function actionOutputScore(card, actionKey, slotId = null) {
  const at = card.at;
  const guardArmor = guardArmorForScore(card);
  const shellBindArmor = Math.max(8, Math.floor(guardArmor * 0.75));
  const blessingArmorScore = card.abilityKey === "blessing"
    ? armorOutputScore(BLESSING_ARMOR, "lowestHpAlly", STANDARD_ARMOR_DURATION)
    : 0;
  const score = {
    slash: at,
    pierce: Math.max(4, at - 5) + Math.max(4, at - 10) * 0.85,
    sweep: rangeDamageScore(sweepDamageForScore(card, slotId), SCORING_RULES.frontRankDamageTargets),
    guard: armorOutputScore(guardArmor, "selfAndForwardAlly", STANDARD_ARMOR_DURATION) + Math.max(6, Math.floor(at * GUARD_STRIKE_RATE)) * 0.95,
    rally: RALLY_AT * 2.5 * 2.2 * RALLY_DURATION,
    heal: Math.max(7, Math.floor(at * SINGLE_HEAL_RATE)) * 0.70 + Math.max(5, Math.floor(at * PRAYER_STRIKE_RATE)) * 0.65 + blessingArmorScore,
    lineHeal: Math.max(6, Math.floor(at * LINE_HEAL_RATE) + (card.abilityKey === "widePrayer" ? WIDE_PRAYER_BONUS : 0)) * 0.60 * 1.8,
    generalWard: (GENERAL_WARD_ARMOR + (card.abilityKey === "devotedWard" ? DEVOTED_WARD_BONUS : 0)) * 0.75 + Math.max(5, Math.floor(at * GENERAL_WARD_HEAL_RATE)) * 0.70,
    snipe: Math.max(5, at - SNIPE_DAMAGE_OFFSET) * 1.05,
    raid: Math.max(5, at - RAID_DAMAGE_OFFSET) * 1.10,
    command: (COMMAND_AG * 3.5 + commandAtBonusForCard(card) * 2.5) * 1.4,
    siege: (at + 6) * 1.15,
    lowHpStrike: Math.max(5, at - LOW_HP_STRIKE_OFFSET) * 1.10,
    selfAg: SELF_AG_BUFF * 3.5,
    agSnare: (AG_DEBUFF + (card.abilityKey === "deepSnare" ? 2 : 0)) * 3.2,
    shellBind: armorOutputScore(shellBindArmor, "selfAndForwardAlly", STANDARD_ARMOR_DURATION),
    quickenUltimate: 18,
    acidBite: Math.max(5, at - ACID_BITE_OFFSET),
    acidSweepDefense: rangeDamageScore(Math.max(4, at - ACID_SWEEP_OFFSET), SCORING_RULES.frontRankDamageTargets),
    acidSweepHealBlock: rangeDamageScore(Math.max(4, at - ACID_SWEEP_OFFSET), SCORING_RULES.frontRankDamageTargets),
    drainStrike: (Math.max(5, at - DRAIN_DAMAGE_OFFSET) + BARRIER_PIERCE_ARMOR_BONUS_CAP) * (1 + DRAIN_HEAL_RATE * 0.55),
    barrierPierceStrike: (Math.max(5, at - BARRIER_PIERCE_OFFSET) + BARRIER_PIERCE_ARMOR_BONUS_CAP) * 1.05,
    healBlockPulse: 10,
    midRearPressure: rangeDamageScore(Math.max(4, at - MID_REAR_PRESSURE_OFFSET), 3.0),
    sporeCrush: Math.max(6, at - SPORE_CRUSH_OFFSET),
    sporeBarrage: rangeDamageScore(Math.max(5, at - SPORE_BARRAGE_OFFSET), SCORING_RULES.frontRankDamageTargets) + poisonDamageScore("frontRankEnemies"),
    toxicNeedle: poisonDamageScore("frontEnemy"),
    toxicCloud: poisonDamageScore("frontRankEnemies"),
    thornGuard: THORN_GUARD_ARMOR * 0.75 + POISON_DAMAGE * POISON_DURATION * 0.85,
    mirrorShell: MIRROR_SHELL_ARMOR * 0.75 + REFLECT_DAMAGE_CAP * 0.85,
    selfUltimateCharge: 14,
    wait: -15,
  }[actionKey];
  return score ?? 0;
}

function scoreUltimateForCard(card) {
  if (!card.ultimate) return 0;
  const action = ultimateActions[card.ultimate.key];
  if (!action) return 0;
  const componentScore = (action.components || []).reduce((sum, component) => sum + scoreActionComponent(component), 0);
  const outputScore = ultimateOutputScore(card, card.ultimate.key);
  const turnMultiplier = ULTIMATE_RULES.turnScoreMultipliers[card.ultimate.turns] || 0.55;
  return (componentScore + outputScore) * turnMultiplier;
}

function ultimateOutputScore(card, ultimateKey) {
  const at = card.at;
  const score = {
    alphaClaw: (at + 16) * 1.25,
    rearExecution: Math.max(12, at + 8) * 1.15,
    lineCrush: (Math.max(8, at + 6) + Math.max(8, at) * 0.85 + Math.max(8, at - 6) * 0.65),
    wideScorch: rangeDamageScore(Math.max(8, at - 4), 4.2),
    toxicBloom: rangeDamageScore(Math.max(8, at - TOXIC_BLOOM_OFFSET), 4.2) + POISON_DAMAGE * POISON_DURATION * 4.2 * SCORING_RULES.delayedDamageMultiplier,
    frontBulwark: 18 * 0.55 * 2.2,
    teamBarrier: 12 * 0.55 * 4.0,
    teamHeal: Math.max(8, Math.floor(at * 0.55)) * 0.62 * 3.0,
    deepTeamHeal: Math.max(12, Math.floor(at * 0.75)) * 0.62 * 3.2,
    alphaShell: 26 * 0.75 + Math.max(10, Math.floor(at * 0.55)) * 0.70,
    synapticSurge: (4 * 2.5 + 7 * 3.5) * 3.2,
  }[ultimateKey];
  return score ?? 0;
}

function rangeDamageScore(damage, expectedTargets) {
  return damage * expectedTargets * SCORING_RULES.rangeDamageMultiplier;
}

function poisonDamageScore(targetPatternId, reliability = SCORING_RULES.delayedDamageMultiplier) {
  return POISON_DAMAGE * POISON_DURATION * estimatedEffectiveTargets(targetPatternId) * reliability;
}

function armorOutputScore(amount, targetPatternId, durationTurns = STANDARD_ARMOR_DURATION) {
  return amount * estimatedEffectiveTargets(targetPatternId) * durationTurns * SCORING_RULES.armorOutputMultiplier;
}

function armorTurnValueForEstimate(amount, targetPatternId, durationTurns = STANDARD_ARMOR_DURATION) {
  return amount * estimatedEffectiveTargets(targetPatternId) * durationTurns;
}

function sweepDamageForScore(card, slotId = null) {
  const rearBonus = card.abilityKey === "rearCannon" && slotId === "rear" ? REAR_CANNON_BONUS : 0;
  return Math.max(4, card.at - SWEEP_DAMAGE_OFFSET + rearBonus);
}

function slotIdForScorePosition(position) {
  if (typeof position === "string") return position;
  if (position?.slot) return position.slot;
  if (Number.isInteger(position?.col)) return ACTION_SLOTS[position.col]?.id || null;
  return null;
}

function guardArmorForScore(card) {
  return GUARD_ARMOR + (card.abilityKey === "rampartCraft" ? Math.floor(RAMPART_GUARD_BONUS * 0.35) : 0);
}

function commandAtBonusForCard(card) {
  return 2 + (card.abilityKey === "sharpCommand" ? 1 : 0);
}

function scoreAbility(card) {
  const scores = {
    steady: 12,
    seaHp: 3,
    rangedTerrain: 10,
    blessing: 10,
    widePrayer: 8,
    quickStart: 18,
    laneBreaker: 9,
    middleRaid: 8,
    rampartCraft: 10,
    devotedWard: 9,
    sharpCommand: 14,
    generalBreaker: 18,
    rearCannon: 8,
    rearWard: 9,
    executeHunter: 12,
    deepSnare: 9,
    armorPredator: 44,
    contactStance: 70,
    reflectStance: 64,
    none: 0,
  };
  return scores[card.abilityKey] || 0;
}

function scoreAlphaTrait(card) {
  const scores = {
    frontArmor: 56,
    harborWall: 34,
    firstSnipe: 30,
    firstFallHeal: 34,
    frontDuel: 28,
    turnThreeCharge: 48,
    scoutLead: 56,
    terrainDiscount: 24,
    midAg: 64,
    allOutOrder: 105,
    finishSignal: 32,
    fallbackWard: 58,
  };
  if (card.generalKey === "openingBarrage") return scoreOpeningBarrage(card);
  return scores[card.generalKey] || 0;
}

function scoreOpeningBarrage(card) {
  const openingDamage = Math.max(
    4,
    card.at - OPENING_BARRAGE_OFFSET,
  );
  const componentScore = scoreActionComponent({ effectElements: ["areaAttack"], targetPattern: "frontRankEnemies" });
  const outputScore = rangeDamageScore(openingDamage, estimatedEffectiveTargets("frontRankEnemies"));
  return (
    SCORING_RULES.timingScores.battleStart +
    (componentScore + outputScore) * SCORING_RULES.openingActionMultiplier
  ) * openingBarrageReliabilityForScore();
}

function openingBarrageReliabilityForScore() {
  return SCORING_RULES.openingBarrageFrontReliability[OPENING_BARRAGE_MIN_FRONT] ?? 0.5;
}

function scoreJudgment(score, kind, cost) {
  const band = SCORING_RULES.costBands[kind]?.[cost];
  if (!band) return "基準外";
  if (score < band[0] - 10) return "低い";
  if (score < band[0]) return "やや低い";
  if (score > band[1] + 10) return "高い";
  if (score > band[1]) return "やや高い";
  return "妥当";
}

function roundScore(value) {
  return Math.round(value * 10) / 10;
}

function normalizeScore(value) {
  return value * SCORING_RULES.totalScale;
}

function generateStandardDeckCandidates() {
  const plans = Object.values(WIN_PLAN_TEMPLATES).filter((template) => isRulesetEntryAvailable(template)).map((template) => {
    const attempts = generateWinPlanCandidateSeeds(template)
      .map((seed, seedIndex) => buildStandardDeckCandidate(template, seed, seedIndex))
      .filter(Boolean);
    const candidates = attempts
      .filter((candidate) => candidate.evaluation.passes)
      .sort((a, b) => b.evaluation.score - a.evaluation.score)
      .slice(0, STANDARD_DECK_GENERATION_RULES.maxCandidatesPerPlan)
      .map((candidate, index) => finalizeGeneratedCandidate(template, candidate, index));
    return {
      templateId: template.id,
      templateName: template.name,
      attempted: attempts.length,
      candidates,
      blocker: candidates.length > 0 ? "" : generationBlockerText(template, attempts),
    };
  });
  return {
    plans,
    presets: plans.flatMap((plan) => plan.candidates.map((candidate) => candidate.preset)),
  };
}

function generateWinPlanCandidateSeeds(template) {
  if (!isRulesetEntryAvailable(template)) return [];
  if (template.strategy === "focus") return generateFocusCandidateSeeds(template);
  if (template.strategy === "board") return generateBoardCandidateSeeds(template);
  if (template.strategy === "alpha") return generateAlphaCandidateSeeds(template);
  if (template.strategy === "ace") return generateAceCandidateSeeds(template);
  if (template.strategy === "dot") return generateDotCandidateSeeds(template);
  if (template.strategy === "lock") return generateLockCandidateSeeds(template);
  if (template.strategy === "counter") return generateCounterCandidateSeeds(template);
  return [];
}

function generateFocusCandidateSeeds(template) {
  const groups = groupRecordsBy(CARD_ACTION_SEARCH_INDEX
    .filter((record) => recordHasAnyEffect(record, ["singleAttack", "searchAttack"]) && record.estimated.focusedDamage > 0), "targetKey");
  return Object.entries(groups).map(([targetKey, records], index) => {
    const coreRecords = topDistinctRecords(records, 4, "focusedDamage");
    if (coreRecords.length < template.thresholds.minMainRecords) return null;
    return {
      strategy: template.strategy,
      targetKey,
      preferredRow: targetKey.includes("lane") ? index % 3 : null,
      coreRecords,
      supportRecords: selectSupportRecords(template, coreRecords, 5),
      variantIndex: index,
    };
  }).filter(Boolean);
}

function generateBoardCandidateSeeds(template) {
  const areaRecords = CARD_ACTION_SEARCH_INDEX
    .filter((record) => record.effectElements.includes("areaAttack") && record.estimated.totalDamage > 0);
  const groupedSeeds = Object.entries(groupRecordsBy(areaRecords, "targetKey")).map(([targetKey, records], index) => ({
    strategy: template.strategy,
    targetKey,
    coreRecords: topDistinctRecords(records, STANDARD_DECK_GENERATION_RULES.maxSeedRecords, "totalDamage"),
    supportRecords: selectSupportRecords(template, records, 5),
    variantIndex: index,
  }));
  const mixedSeed = {
    strategy: template.strategy,
    targetKey: "enemy:mixed-area",
    coreRecords: topDistinctRecords(areaRecords, STANDARD_DECK_GENERATION_RULES.maxSeedRecords, "totalDamage"),
    supportRecords: selectSupportRecords(template, areaRecords, 5),
    variantIndex: groupedSeeds.length,
  };
  return dedupeSeeds([...groupedSeeds, mixedSeed])
    .filter((seed) => seed.coreRecords.length >= template.thresholds.minMainRecords);
}

function generateAlphaCandidateSeeds(template) {
  const wallRecords = topDistinctRecords(CARD_ACTION_SEARCH_INDEX.filter(actionRecordIsWallProcessor), 4, "totalDamage");
  const reachRecords = topDistinctRecords(CARD_ACTION_SEARCH_INDEX.filter(actionRecordReachesAlpha), 5, "focusedDamage");
  if (wallRecords.length < template.thresholds.minWallRecords || reachRecords.length < template.thresholds.minReachRecords) return [];
  return [
    {
      strategy: template.strategy,
      targetKey: "enemy:alpha-route",
      coreRecords: uniqueRecordsByCard([...wallRecords.slice(0, 1), ...reachRecords.slice(0, 3)]),
      supportRecords: selectSupportRecords(template, [...wallRecords, ...reachRecords], 4),
      variantIndex: 0,
    },
    {
      strategy: template.strategy,
      targetKey: "enemy:alpha-tempo",
      coreRecords: uniqueRecordsByCard([...reachRecords.slice(0, 4), ...wallRecords.slice(1, 2)]),
      supportRecords: selectSupportRecords(template, reachRecords, 4),
      variantIndex: 1,
    },
  ];
}

function generateAceCandidateSeeds(template) {
  return topAceOptions(5).map((ace, index) => {
    const excluded = new Set([ace.cardId]);
    const supportRecords = selectAceSupportRecords(template, ace, 7, excluded);
    const fillerRecords = topDistinctRecords(CARD_ACTION_SEARCH_INDEX
      .filter((record) => !excluded.has(record.cardId) && recordHasAnyEffect(record, template.primaryEffectElements)), 5, "totalOutput");
    return {
      strategy: template.strategy,
      aceCardId: ace.cardId,
      targetKey: `ally:ace:${ace.cardId}`,
      preferredRow: index % 3,
      coreRecords: [ace.record],
      supportRecords,
      fillerRecords,
      variantIndex: index,
    };
  });
}

function generateDotCandidateSeeds(template) {
  const poisonRecords = topDistinctRecords(CARD_ACTION_SEARCH_INDEX
    .filter((record) => record.effectElements.includes("poison") && record.estimated.poisonDamage > 0), 4, "poisonDamage");
  if (poisonRecords.length < template.thresholds.minPoisonCards) return [];
  const durabilityCoreRecords = selectDotDurabilityRecords(template, poisonRecords, 4).slice(0, 2);
  return [{
    strategy: template.strategy,
    targetKey: "enemy:poison-clock",
    coreRecords: uniqueRecordsByCard([...poisonRecords.slice(0, 3), ...durabilityCoreRecords]),
    supportRecords: selectDotDurabilityRecords(template, [...poisonRecords, ...durabilityCoreRecords], 6),
    variantIndex: 0,
  }];
}

function generateLockCandidateSeeds(template) {
  const disruptRecords = topDistinctRecords(CARD_ACTION_SEARCH_INDEX
    .filter((record) => recordHasAnyEffect(record, template.primaryEffectElements)), 5, "disruption");
  const finishRecords = topDistinctRecords(CARD_ACTION_SEARCH_INDEX
    .filter((record) => recordHasAnyEffect(record, template.finishEffectElements) && offensiveRecordOutput(record) > 0), 5, "totalOutput");
  if (disruptRecords.length < template.thresholds.disruptionRecords || finishRecords.length < template.thresholds.finishRoutes) return [];
  return [
    {
      strategy: template.strategy,
      targetKey: "enemy:lock-finish",
      coreRecords: uniqueRecordsByCard([...disruptRecords.slice(0, 2), ...finishRecords.slice(0, 2)]),
      supportRecords: selectSupportRecords(template, disruptRecords, 4),
      variantIndex: 0,
    },
    {
      strategy: template.strategy,
      targetKey: "enemy:lock-tempo",
      coreRecords: uniqueRecordsByCard([...disruptRecords.slice(1, 4), ...finishRecords.slice(0, 2)]),
      supportRecords: selectSupportRecords(template, finishRecords, 4),
      variantIndex: 1,
    },
  ];
}

function generateCounterCandidateSeeds(template) {
  const counterRecords = topDistinctRecords(CARD_ACTION_SEARCH_INDEX
    .filter((record) => recordHasAnyEffect(record, template.primaryEffectElements)), 5, "counterOutput");
  if (counterRecords.length < template.thresholds.receiverRecords) return [];
  const finishRecords = topDistinctRecords(CARD_ACTION_SEARCH_INDEX
    .filter((record) => recordHasAnyEffect(record, template.finishEffectElements) && offensiveRecordOutput(record) > 0), 5, "totalOutput");
  if (finishRecords.length < template.thresholds.finishRoutes) return [];
  const reflectRecords = topDistinctRecords(counterRecords.filter((record) => record.effectElements.includes("reflect") || record.effectElements.includes("counter")), 3, "counterOutput");
  const contactRecords = topDistinctRecords(counterRecords.filter((record) => record.effectElements.includes("contactPoison")), 3, "counterOutput");
  const mixedRecords = uniqueRecordsByCard([...reflectRecords, ...contactRecords, ...counterRecords, ...finishRecords.slice(0, 2)]).slice(0, STANDARD_DECK_GENERATION_RULES.maxSeedRecords);
  return dedupeSeeds([
    {
      strategy: template.strategy,
      targetKey: "ally:counter-front",
      coreRecords: uniqueRecordsByCard([...counterRecords.slice(0, 2), ...finishRecords.slice(0, 2)]),
      supportRecords: selectSupportRecords(template, counterRecords, 6),
      variantIndex: 0,
    },
    {
      strategy: template.strategy,
      targetKey: "ally:counter-mixed",
      coreRecords: mixedRecords,
      supportRecords: selectSupportRecords(template, mixedRecords, 6),
      variantIndex: 1,
    },
  ]).filter((seed) => seed.coreRecords.length >= template.thresholds.receiverRecords);
}

function buildStandardDeckCandidate(template, seed, seedIndex) {
  const entries = deckEntriesForSeed(template, seed);
  const built = buildGeneratedPresetFromEntries(template, seed, entries, seedIndex);
  if (!built) return null;
  const evaluation = evaluatePresetForWinPlan(built.preset, template, seed);
  return {
    templateId: template.id,
    seed,
    preset: built.preset,
    evaluation,
  };
}

function finalizeGeneratedCandidate(template, candidate, index) {
  const serial = index + 1;
  candidate.preset.id = `generated-${template.id}-${serial}`;
  candidate.preset.name = `生成: ${template.name}${serial}`;
  candidate.preset.kind = "generated";
  candidate.preset.description = `${template.description} ${candidate.evaluation.summary}`;
  candidate.preset.generated = {
    templateId: template.id,
    winPlan: template.name,
    score: roundScore(candidate.evaluation.score),
    summary: candidate.evaluation.summary,
    engines: [...template.engineHints],
  };
  return candidate;
}

function buildGeneratedPresetFromEntries(template, seed, entries, seedIndex) {
  const coreCount = entries.filter((entry) => entry.role === "core").length;
  const maxCount = Math.min(STANDARD_DECK_GENERATION_RULES.maxCards, entries.length);
  const legalCandidates = [];
  for (let count = maxCount; count >= Math.max(STANDARD_DECK_GENERATION_RULES.minCards, coreCount); count -= 1) {
    const selectedEntries = selectEntriesForDeck(entries, count);
    const units = assignEntriesToFormation(selectedEntries, seedIndex + (seed.variantIndex || 0));
    const general = chooseGeneralForUnits(units, template, seed);
    if (!general) continue;
    const preset = {
      id: `generated-${template.id}-draft-${seedIndex}`,
      name: `生成: ${template.name}`,
      kind: "generated",
      description: template.description,
      general,
      keyCards: generatedKeyCards(template, seed, units),
      units,
      terrain: plainTerrainGrid(),
    };
    if (presetCost(preset).total <= STANDARD_DECK_GENERATION_RULES.costLimit) {
      const evaluation = evaluatePresetForWinPlan(preset, template, seed);
      legalCandidates.push({ preset, entries: selectedEntries, evaluation });
    }
  }
  return legalCandidates.sort((a, b) => Number(b.evaluation.passes) - Number(a.evaluation.passes) ||
    b.preset.units.length - a.preset.units.length ||
    b.evaluation.score - a.evaluation.score)[0] || null;
}

function deckEntriesForSeed(template, seed) {
  const entries = [
    ...seed.coreRecords.map((record) => recordToDeckEntry(record, "core", 720 + recordMetric(record, "totalOutput"), preferredRowForRecord(record, seed))),
    ...(seed.supportRecords || []).map((record) => recordToDeckEntry(record, "support", 430 + recordMetric(record, "support"), preferredRowForRecord(record, seed))),
    ...(seed.fillerRecords || []).map((record) => recordToDeckEntry(record, "filler", 220 + recordMetric(record, "totalOutput"), preferredRowForRecord(record, seed))),
  ];
  const usedCardIds = new Set(entries.map((entry) => entry.cardId));
  selectFillerEntries(template, usedCardIds, 10).forEach((entry) => entries.push(entry));
  selectAnchorEntries(usedCardIds, 8, template).forEach((entry) => entries.push(entry));
  return uniqueDeckEntries(entries);
}

function recordToDeckEntry(record, role, priority, preferredRow = null) {
  return {
    cardId: record.cardId,
    desiredCol: slotIndex(record.slot),
    preferredRow,
    role,
    priority,
    record,
  };
}

function preferredRowForRecord(record, seed) {
  if (seed.aceCardId && record.cardId === seed.aceCardId) return seed.preferredRow ?? null;
  if (seed.preferredRow === null || seed.preferredRow === undefined) return null;
  if (["ally:lane", "ally:lane-damaged", "ally:self-forward", "enemy:lane-front", "enemy:lane-front-two"].includes(record.targetKey)) {
    return seed.preferredRow;
  }
  return null;
}

function selectEntriesForDeck(entries, count) {
  const core = entries.filter((entry) => entry.role === "core");
  const anchors = entries.filter((entry) => entry.role === "anchor").sort((a, b) => b.priority - a.priority);
  const rest = entries.filter((entry) => entry.role !== "core" && entry.role !== "anchor").sort((a, b) => b.priority - a.priority);
  const availableRestCount = Math.max(0, count - core.length);
  let selectedRest = rest.slice(0, availableRestCount);
  const selectedWithoutAnchors = [...core, ...selectedRest];
  const frontDesiredCount = selectedWithoutAnchors.filter((entry) => entry.desiredCol === 0).length;
  const needsFrontAnchors = selectedWithoutAnchors.some((entry) => entry.desiredCol > 0);
  const missingFrontAnchors = needsFrontAnchors ? Math.max(0, Math.min(2, count) - frontDesiredCount) : 0;
  const anchorCount = Math.min(missingFrontAnchors, anchors.length, availableRestCount);
  if (anchorCount > 0) {
    selectedRest = rest.slice(0, Math.max(0, availableRestCount - anchorCount));
  }
  return uniqueDeckEntries([...core, ...selectedRest, ...anchors.slice(0, anchorCount)]).slice(0, count);
}

function assignEntriesToFormation(entries, variantIndex) {
  const pattern = STANDARD_FORMATION_PATTERNS[variantIndex % STANDARD_FORMATION_PATTERNS.length].slice(0, entries.length);
  const remaining = [...entries];
  const units = pattern.map((slot) => {
    const choice = bestEntryForSlot(remaining, slot);
    remaining.splice(remaining.indexOf(choice), 1);
    return [choice.cardId, slot.row, slot.col];
  });
  return sortUnits(legalFormationUnits(units));
}

function bestEntryForSlot(entries, slot) {
  return [...entries].sort((a, b) => entrySlotFit(b, slot) - entrySlotFit(a, slot))[0];
}

function entrySlotFit(entry, slot) {
  const colFit = entry.desiredCol === slot.col ? 1000 : -Math.abs(entry.desiredCol - slot.col) * 150;
  const rowFit = entry.preferredRow === null || entry.preferredRow === undefined
    ? 0
    : entry.preferredRow === slot.row
      ? 180
      : -Math.abs(entry.preferredRow - slot.row) * 35;
  const roleFit = entry.role === "core" ? 90 : entry.role === "anchor" ? 60 : entry.role === "support" ? 45 : 0;
  return colFit + rowFit + roleFit + entry.priority;
}

function chooseGeneralForUnits(units, template, seed) {
  const unitCardIds = uniqueValues(units.map(([cardId]) => cardId));
  const normalSum = unitCardIds.reduce((sum, cardId) => sum + normalCardCost(cards[cardId]), 0);
  const choices = unitCardIds.map((cardId) => {
    const card = cards[cardId];
    const cost = normalSum - normalCardCost(card) + alphaCardCost(card);
    return {
      cardId,
      cost,
      score: generalPreferenceScore(cardId, template, seed) - Math.max(0, cost - STANDARD_DECK_GENERATION_RULES.costLimit) * 20,
    };
  }).filter((choice) => choice.cost <= STANDARD_DECK_GENERATION_RULES.costLimit);
  return choices.sort((a, b) => b.score - a.score || a.cost - b.cost || a.cardId.localeCompare(b.cardId))[0]?.cardId || null;
}

function generalPreferenceScore(cardId, template, seed) {
  const card = cards[cardId];
  const preferredIndex = template.preferredGeneralKeys.indexOf(card.generalKey);
  const preferredScore = preferredIndex >= 0 ? (template.preferredGeneralKeys.length - preferredIndex) * 18 : 0;
  const aceScore = seed.aceCardId === cardId ? 20 : 0;
  const alphaScore = CARD_SCORE_INDEX[cardId]?.alphaTotal || 0;
  const extraCost = alphaCardCost(card) - normalCardCost(card);
  return preferredScore + aceScore + alphaScore * 0.18 - extraCost * 6;
}

function generatedKeyCards(template, seed, units) {
  const present = new Set(units.map(([cardId]) => cardId));
  if (seed.aceCardId && present.has(seed.aceCardId)) return [seed.aceCardId];
  return uniqueValues(seed.coreRecords.map((record) => record.cardId).filter((cardId) => present.has(cardId))).slice(0, 2);
}

function selectSupportRecords(template, seedRecords, limit, options = {}) {
  const excluded = new Set(options.excludedCardIds || seedRecords.map((record) => record.cardId));
  const records = CARD_ACTION_SEARCH_INDEX
    .filter((record) => !excluded.has(record.cardId))
    .filter((record) => recordHasAnyEffect(record, template.supportEffectElements || []));
  return topDistinctRecords(records, limit, "support");
}

function selectDotDurabilityRecords(template, seedRecords, limit) {
  const excluded = new Set(seedRecords.map((record) => record.cardId));
  const records = CARD_ACTION_SEARCH_INDEX
    .filter((record) => !excluded.has(record.cardId))
    .filter((record) => recordHasAnyEffect(record, template.supportEffectElements || []));
  return topDistinctRecords(records, limit, "durability");
}

function selectAceSupportRecords(template, ace, limit, excludedCardIds) {
  const aceCol = slotIndex(ace.record.slot);
  const records = CARD_ACTION_SEARCH_INDEX
    .filter((record) => !excludedCardIds.has(record.cardId))
    .filter((record) => recordHasAnyEffect(record, template.supportEffectElements || []))
    .filter((record) => aceSupportPotential(record, aceCol));
  const selected = [];
  const seen = new Set();
  [...records].sort((a, b) => aceSupportMetric(b, aceCol) - aceSupportMetric(a, aceCol) || a.cardId.localeCompare(b.cardId))
    .forEach((record) => {
      if (seen.has(record.cardId) || selected.length >= limit) return;
      seen.add(record.cardId);
      selected.push(record);
    });
  return selected;
}

function aceSupportPotential(record, aceCol) {
  if (record.targetKey === "ally:all" || record.targetKey === "ally:low-hp") return true;
  if (record.targetKey === "ally:front-rank") return aceCol === 0;
  if (record.targetKey === "ally:lane" || record.targetKey === "ally:lane-damaged") return slotIndex(record.slot) !== aceCol;
  if (record.targetKey === "ally:self-forward") return slotIndex(record.slot) > aceCol;
  return false;
}

function aceSupportMetric(record, aceCol) {
  const supportCol = slotIndex(record.slot);
  const reachBonus = record.targetKey === "ally:all" ? 32
    : record.targetKey === "ally:low-hp" ? 24
      : record.targetKey === "ally:lane" || record.targetKey === "ally:lane-damaged" ? 18 + Math.max(0, supportCol - aceCol) * 4
        : record.targetKey === "ally:self-forward" ? 16 + Math.max(0, supportCol - aceCol) * 5
          : record.targetKey === "ally:front-rank" ? 12
            : 0;
  return recordMetric(record, "support") + reachBonus;
}

function selectFillerEntries(template, excludedCardIds, limit) {
  return Object.keys(cards)
    .filter((cardId) => !excludedCardIds.has(cardId))
    .map((cardId) => {
      const record = topDistinctRecords(CARD_ACTION_SEARCH_INDEX.filter((item) => item.cardId === cardId), 1, "totalOutput")[0];
      if (!record) return null;
      const score = (CARD_SCORE_INDEX[cardId]?.normalTotal || 0) * 0.55 + templateFitScoreForCard(cardId, template);
      return recordToDeckEntry(record, "filler", 110 + score, null);
    })
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

function selectAnchorEntries(excludedCardIds, limit, template = null) {
  const metric = ["dot", "counter"].includes(template?.strategy) ? "durability" : "anchor";
  const records = CARD_ACTION_SEARCH_INDEX
    .filter((record) => record.slot === "front" && !excludedCardIds.has(record.cardId))
    .filter((record) => metric !== "durability" || recordMetric(record, "durability") > 0);
  return topDistinctRecords(records, limit, metric)
    .map((record) => recordToDeckEntry(record, "anchor", 660 - normalCardCost(cards[record.cardId]) * 14 + cards[record.cardId].hp * 0.08, null));
}

function templateFitScoreForCard(cardId, template) {
  const records = CARD_ACTION_SEARCH_INDEX.filter((record) => record.cardId === cardId);
  const effectIds = uniqueValues(records.flatMap((record) => record.effectElements));
  const primaryScore = (template.primaryEffectElements || []).filter((effectId) => effectIds.includes(effectId)).length * 16;
  const supportScore = (template.supportEffectElements || []).filter((effectId) => effectIds.includes(effectId)).length * 9;
  const engineEffectIds = (template.engineHints || []).flatMap((engineId) => BUILD_ENGINE_DEFINITIONS[engineId]?.effectElements || []);
  const engineScore = uniqueValues(engineEffectIds).filter((effectId) => effectIds.includes(effectId)).length * 5;
  return primaryScore + supportScore + engineScore;
}

function topAceOptions(limit) {
  return Object.keys(cards).map((cardId) => {
    const records = CARD_ACTION_SEARCH_INDEX.filter((record) => record.cardId === cardId && offensiveRecordOutput(record) > 0);
    const record = topDistinctRecords(records, 1, "totalOutput")[0];
    if (!record) return null;
    const normalOutput = offensiveRecordOutput(record);
    const ultimateOutput = estimateOffensiveUltimateOutputForCard(cards[cardId]);
    return {
      cardId,
      record,
      score: Math.max(normalOutput, ultimateOutput) + (CARD_SCORE_INDEX[cardId]?.normalTotal || 0) * 0.15,
    };
  }).filter(Boolean)
    .sort((a, b) => b.score - a.score || a.cardId.localeCompare(b.cardId))
    .slice(0, limit);
}

function evaluatePresetForWinPlan(preset, template, seed = {}) {
  const records = buildPlacedActionRecords(preset.units);
  const cost = presetCost(preset);
  if (template.strategy === "focus") return evaluateFocusPreset(template, preset, records, cost);
  if (template.strategy === "board") return evaluateBoardPreset(template, preset, records, cost);
  if (template.strategy === "alpha") return evaluateAlphaPreset(template, preset, records, cost);
  if (template.strategy === "ace") return evaluateAcePreset(template, preset, records, cost, seed);
  if (template.strategy === "dot") return evaluateDotPreset(template, preset, records, cost);
  if (template.strategy === "lock") return evaluateLockPreset(template, preset, records, cost);
  if (template.strategy === "counter") return evaluateCounterPreset(template, preset, records, cost);
  return evaluationResult(false, 0, { cost: cost.total }, "未対応の勝ち筋。", ["評価未定義"]);
}

function evaluateFocusPreset(template, preset, records, cost) {
  const attackGroups = Object.entries(groupRecordsBy(records.filter((record) => offensiveRecordOutput(record) > 0), "targetKey"))
    .map(([targetKey, groupRecords]) => ({
      targetKey,
      records: groupRecords,
      focusedDamage: roundScore(groupRecords.reduce((sum, record) => sum + record.estimated.focusedDamage, 0)),
      mainRecords: uniqueValues(groupRecords.map((record) => record.cardId)).length,
    }))
    .sort((a, b) => b.focusedDamage - a.focusedDamage);
  const best = attackGroups[0] || { targetKey: "none", focusedDamage: 0, mainRecords: 0 };
  const passes = best.mainRecords >= template.thresholds.minMainRecords && best.focusedDamage >= template.thresholds.focusedDamage && cost.total <= STANDARD_DECK_GENERATION_RULES.costLimit;
  const score = best.focusedDamage + best.mainRecords * 12 - cost.total;
  return evaluationResult(passes, score, {
    cost: cost.total,
    targetKey: best.targetKey,
    focusedDamage: best.focusedDamage,
    mainRecords: best.mainRecords,
  }, `対象${targetKeyLabel(best.targetKey)} / 集中${metricNumber(best.focusedDamage)} / 主軸${best.mainRecords}枚`);
}

function evaluateBoardPreset(template, preset, records, cost) {
  const areaRecords = records.filter((record) => record.effectElements.includes("areaAttack"));
  const mainRecords = uniqueValues(areaRecords.map((record) => record.cardId)).length;
  const totalDamage = roundScore(areaRecords.reduce((sum, record) => sum + record.estimated.totalDamage + record.estimated.poisonDamage, 0));
  const effectiveTargets = estimatedRecordCoverage(areaRecords);
  const passes = mainRecords >= template.thresholds.minMainRecords &&
    totalDamage >= template.thresholds.totalDamage &&
    effectiveTargets >= template.thresholds.effectiveTargets &&
    cost.total <= STANDARD_DECK_GENERATION_RULES.costLimit;
  const score = totalDamage + effectiveTargets * 12 + mainRecords * 8 - cost.total;
  return evaluationResult(passes, score, {
    cost: cost.total,
    totalDamage,
    effectiveTargets,
    mainRecords,
  }, `総${metricNumber(totalDamage)} / 対象${effectiveTargets}体 / 範囲${mainRecords}枚`);
}

function evaluateAlphaPreset(template, preset, records, cost) {
  const wallRecords = records.filter(actionRecordIsWallProcessor);
  const reachRecords = records.filter(actionRecordReachesAlpha);
  const alphaDamage = roundScore(reachRecords.reduce((sum, record) => sum + record.estimated.focusedDamage, 0));
  const passes = wallRecords.length >= template.thresholds.minWallRecords &&
    reachRecords.length >= template.thresholds.minReachRecords &&
    alphaDamage >= template.thresholds.alphaDamage &&
    cost.total <= STANDARD_DECK_GENERATION_RULES.costLimit;
  const score = alphaDamage + wallRecords.length * 10 + reachRecords.length * 12 - cost.total;
  return evaluationResult(passes, score, {
    cost: cost.total,
    wallRecords: uniqueValues(wallRecords.map((record) => record.cardId)).length,
    reachRecords: uniqueValues(reachRecords.map((record) => record.cardId)).length,
    alphaDamage,
  }, `壁${uniqueValues(wallRecords.map((record) => record.cardId)).length}枚 / 到達${uniqueValues(reachRecords.map((record) => record.cardId)).length}枚 / 露出後${metricNumber(alphaDamage)}`);
}

function evaluateAcePreset(template, preset, records, cost, seed) {
  const aceCardId = seed.aceCardId || preset.keyCards?.[0];
  const aceUnit = preset.units.map(([cardId, row, col]) => ({ cardId, row, col, general: cardId === preset.general })).find((unit) => unit.cardId === aceCardId);
  const aceRecords = records.filter((record) => record.cardId === aceCardId);
  const aceNormalOutput = aceRecords.reduce((sum, record) => sum + offensiveRecordOutput(record), 0);
  const aceUltimateOutput = estimateOffensiveUltimateOutputForCard(cards[aceCardId]);
  const aceOutput = roundScore(Math.max(aceNormalOutput, aceUltimateOutput));
  const supportRecords = aceUnit
    ? records.filter((record) => record.cardId !== aceCardId && recordHasAnyEffect(record, template.supportEffectElements) && recordCanReachAlly(record, aceUnit, preset))
    : [];
  const supportHits = uniqueValues(supportRecords.map((record) => `${record.cardId}:${record.actionId}:${record.componentIndex}`)).length;
  const passes = supportHits >= template.thresholds.supportHits &&
    aceOutput >= template.thresholds.aceOutput &&
    cost.total <= STANDARD_DECK_GENERATION_RULES.costLimit;
  const score = aceOutput + supportHits * 18 - cost.total;
  return evaluationResult(passes, score, {
    cost: cost.total,
    aceCardId,
    aceOutput,
    supportHits,
  }, `${cards[aceCardId]?.name || "エース"} / 支援${supportHits}件 / 出力${metricNumber(aceOutput)}`);
}

function evaluateDotPreset(template, preset, records, cost) {
  const poisonRecords = records.filter((record) => record.effectElements.includes("poison"));
  const poisonCards = uniqueValues(poisonRecords.map((record) => record.cardId)).length;
  const poisonDamage = roundScore(poisonRecords.reduce((sum, record) => sum + record.estimated.poisonDamage, 0));
  const durabilityRecords = records.filter((record) => recordHasAnyEffect(record, template.supportEffectElements));
  const passes = poisonCards >= template.thresholds.minPoisonCards &&
    poisonDamage >= template.thresholds.poisonDamage &&
    durabilityRecords.length >= template.thresholds.durabilityRecords &&
    cost.total <= STANDARD_DECK_GENERATION_RULES.costLimit;
  const score = poisonDamage + durabilityRecords.length * 10 - cost.total;
  return evaluationResult(passes, score, {
    cost: cost.total,
    poisonCards,
    poisonDamage,
    durabilityRecords: durabilityRecords.length,
  }, `毒${poisonCards}枚 / 継続${metricNumber(poisonDamage)} / 耐久${durabilityRecords.length}件`);
}

function evaluateLockPreset(template, preset, records, cost) {
  const disruptionRecords = records.filter((record) => recordHasAnyEffect(record, template.primaryEffectElements));
  const finishRecords = records.filter((record) => recordHasAnyEffect(record, template.finishEffectElements) && offensiveRecordOutput(record) > 0);
  const disruptionCount = uniqueValues(disruptionRecords.map((record) => record.cardId)).length;
  const finishRoutes = uniqueValues(finishRecords.map((record) => record.targetKey)).length;
  const passes = disruptionCount >= template.thresholds.disruptionRecords &&
    finishRoutes >= template.thresholds.finishRoutes &&
    cost.total <= STANDARD_DECK_GENERATION_RULES.costLimit;
  const score = disruptionRecords.reduce((sum, record) => sum + record.estimated.disruption, 0) + finishRoutes * 24 - cost.total;
  return evaluationResult(passes, score, {
    cost: cost.total,
    disruptionCount,
    finishRoutes,
  }, `妨害${disruptionCount}枚 / 決着${finishRoutes}系統`);
}

function evaluateCounterPreset(template, preset, records, cost) {
  const counterRecords = records.filter((record) => recordHasAnyEffect(record, template.primaryEffectElements));
  const sustainRecords = records.filter((record) => recordHasAnyEffect(record, template.supportEffectElements));
  const finishRecords = records.filter((record) => recordHasAnyEffect(record, template.finishEffectElements) && offensiveRecordOutput(record) > 0);
  const receiverCount = uniqueValues(counterRecords.map((record) => record.cardId)).length;
  const sustainCount = uniqueValues(sustainRecords.map((record) => `${record.cardId}:${record.actionId}:${record.componentIndex}`)).length;
  const finishRoutes = uniqueValues(finishRecords.map((record) => record.targetKey)).length;
  const counterOutput = roundScore(counterRecords.reduce((sum, record) => sum + recordMetric(record, "counterOutput"), 0));
  const sustainOutput = roundScore(sustainRecords.reduce((sum, record) => sum + recordMetric(record, "support"), 0));
  const passes = receiverCount >= template.thresholds.receiverRecords &&
    sustainCount >= template.thresholds.sustainRecords &&
    finishRoutes >= template.thresholds.finishRoutes &&
    counterOutput >= template.thresholds.counterOutput &&
    cost.total <= STANDARD_DECK_GENERATION_RULES.costLimit;
  const score = counterOutput + sustainOutput * 0.45 + finishRoutes * 18 + receiverCount * 14 - cost.total;
  return evaluationResult(passes, score, {
    cost: cost.total,
    receiverCount,
    sustainCount,
    finishRoutes,
    counterOutput,
    sustainOutput,
  }, `受け${receiverCount}枚 / 返し${metricNumber(counterOutput)} / 維持${sustainCount}件 / 決着${finishRoutes}系統`);
}

function evaluationResult(passes, score, metrics, summary, issues = []) {
  return {
    passes,
    score: roundScore(score),
    metrics,
    summary,
    issues,
  };
}

function buildPlacedActionRecords(units) {
  return sortUnits(legalFormationUnits(units)).flatMap(([cardId, row, col]) => {
    const card = cards[cardId];
    const slot = ACTION_SLOTS[col];
    if (!card || !slot) return [];
    const actionId = card[slot.cardKey];
    const action = actions[actionId];
    if (!action) return [];
    return actionComponents(actionId).map((component, componentIndex) => {
      const position = { row, col, slot: slot.id, lane: ROW_LABELS[row], rank: COL_LABELS[col] };
      const estimated = estimateActionComponentOutput(card, actionId, component, position);
      return {
        cardId,
        cardName: card.name,
        row,
        col,
        slot: slot.id,
        slotLabel: slot.label,
        position,
        positionKey: `${slot.id}:lane-${row}`,
        actionId,
        actionName: action.name,
        componentIndex,
        effectElements: [...(component.effectElements || [])],
        effectKinds: effectKindIds(component.effectElements || []),
        targetPattern: component.targetPattern,
        targetKey: targetKeyForPattern(component.targetPattern),
        positionedTargetKey: positionedTargetKeyForPattern(component.targetPattern, position),
        estimatedOutput: estimated.total,
        estimated,
      };
    });
  });
}

function topDistinctRecords(records, limit, metric) {
  const selected = [];
  const seen = new Set();
  [...records].sort((a, b) => recordMetric(b, metric) - recordMetric(a, metric) || slotIndex(a.slot) - slotIndex(b.slot) || a.cardId.localeCompare(b.cardId))
    .forEach((record) => {
      if (seen.has(record.cardId) || selected.length >= limit) return;
      seen.add(record.cardId);
      selected.push(record);
    });
  return selected;
}

function uniqueRecordsByCard(records) {
  return topDistinctRecords(records, records.length, "totalOutput");
}

function uniqueDeckEntries(entries) {
  const byCard = new Map();
  entries.forEach((entry) => {
    const current = byCard.get(entry.cardId);
    if (!current || entry.priority > current.priority) byCard.set(entry.cardId, entry);
  });
  return [...byCard.values()].sort((a, b) => b.priority - a.priority || a.cardId.localeCompare(b.cardId));
}

function dedupeSeeds(seeds) {
  const seen = new Set();
  return seeds.filter((seed) => {
    const key = uniqueValues(seed.coreRecords.map((record) => record.cardId)).sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupRecordsBy(records, key) {
  return records.reduce((groups, record) => {
    const value = typeof key === "function" ? key(record) : record[key];
    groups[value] ||= [];
    groups[value].push(record);
    return groups;
  }, {});
}

function recordMetric(record, metric) {
  if (!record?.estimated) return 0;
  if (metric === "focusedDamage") return record.estimated.focusedDamage + (record.effectElements.includes("searchAttack") ? 8 : 0);
  if (metric === "totalDamage") return record.estimated.totalDamage + record.estimated.poisonDamage;
  if (metric === "support") return record.estimated.armor + record.estimated.heal + record.estimated.buff + record.estimated.disruption + record.estimated.counter * 0.35;
  if (metric === "durability") return record.estimated.armor + record.estimated.heal + record.estimated.buff * 0.2 + record.estimated.counter * 0.15;
  if (metric === "disruption") return record.estimated.disruption + (record.effectElements.includes("agDebuff") ? 6 : 0);
  if (metric === "poisonDamage") return record.estimated.poisonDamage;
  if (metric === "counterOutput") return record.estimated.counter + record.estimated.armor * 0.35 + record.estimated.poisonDamage * 0.45;
  return offensiveRecordOutput(record) + record.estimated.armor * 0.5 + record.estimated.heal * 0.5 + record.estimated.buff * 0.4 + record.estimated.disruption + record.estimated.counter * 0.8;
}

function offensiveRecordOutput(record) {
  if (!record?.estimated) return 0;
  const hasOffense = recordHasAnyEffect(record, ["singleAttack", "areaAttack", "searchAttack", "poison"]);
  if (!hasOffense) return 0;
  return record.estimated.totalDamage + record.estimated.poisonDamage;
}

function recordHasAnyEffect(record, effectElements) {
  return (effectElements || []).some((effectId) => record.effectElements.includes(effectId));
}

function actionRecordIsWallProcessor(record) {
  return offensiveRecordOutput(record) > 0 && ["enemy:front", "enemy:lane-front", "enemy:lane-front-two", "enemy:front-rank", "enemy:low-hp-search"].includes(record.targetKey);
}

function actionRecordReachesAlpha(record) {
  return offensiveRecordOutput(record) > 0 && (
    record.targetKey === "enemy:alpha-or-front" ||
    targetPatternHitsBackline(record.targetPattern) ||
    record.effectElements.includes("barrierPierce")
  );
}

function estimatedRecordCoverage(records) {
  const keys = new Set(records.map((record) => record.targetKey));
  if (keys.has("enemy:all")) return 6;
  let coverage = 0;
  if (keys.has("enemy:front-rank")) coverage += 3;
  if (keys.has("enemy:middle-rear")) coverage += 3;
  if (keys.has("enemy:lane-front-two")) coverage += 2;
  if (keys.has("enemy:lane-front")) coverage += 1;
  if (keys.has("enemy:backline-search") || keys.has("enemy:low-hp-search") || keys.has("enemy:alpha-or-front")) coverage += 1;
  return Math.min(6, Math.max(coverage, ...records.map((record) => record.estimated.effectiveTargets || 0), 0));
}

function recordCanReachAlly(record, targetUnit, preset) {
  const pattern = record.targetPattern;
  if (pattern === "allAllies" || pattern === "lowestHpAlly") return true;
  if (pattern === "frontRankAllies") return targetUnit.col === 0;
  if (pattern === "sameLaneAllies" || pattern === "sameLaneDamagedAllies") return record.row === targetUnit.row && record.cardId !== targetUnit.cardId;
  if (pattern === "selfAndForwardAlly") return record.row === targetUnit.row && targetUnit.col <= record.col;
  if (pattern === "allyAlpha") return targetUnit.cardId === preset.general;
  if (pattern === "self") return record.cardId === targetUnit.cardId;
  return false;
}

function estimateOffensiveUltimateOutputForCard(card) {
  if (!card?.ultimate) return 0;
  const ultimate = ultimateActions[card.ultimate.key];
  if (!ultimate || !(ultimate.components || []).some((component) => (component.effectElements || []).some((effectId) => ["singleAttack", "areaAttack", "searchAttack", "poison"].includes(effectId)))) {
    return 0;
  }
  const at = card.at;
  const values = {
    alphaClaw: at + 16,
    rearExecution: Math.max(12, at + 8),
    lineCrush: Math.max(8, at + 6) + Math.max(8, at) + Math.max(8, at - 6),
    wideScorch: Math.max(8, at - 4) * 6,
    toxicBloom: Math.max(8, at - TOXIC_BLOOM_OFFSET) * 6 + POISON_DAMAGE * POISON_DURATION * 6,
  };
  return values[card.ultimate.key] || 0;
}

function slotIndex(slotId) {
  return ACTION_SLOTS.findIndex((slot) => slot.id === slotId);
}

function plainTerrainGrid() {
  return [
    ["plain", "plain", "plain"],
    ["plain", "plain", "plain"],
    ["plain", "plain", "plain"],
  ];
}

function targetKeyLabel(targetKey) {
  const labels = {
    "enemy:front": "最前",
    "enemy:lane-front": "同列最前",
    "enemy:lane-front-two": "同列前方",
    "enemy:front-rank": "前衛全体",
    "enemy:all": "敵全体",
    "enemy:backline-search": "中後衛",
    "enemy:low-hp-search": "低HP",
    "enemy:armored": "装甲敵",
    "enemy:middle-rear": "中後衛全体",
    "enemy:alpha-or-front": `${TERMS.alpha}優先`,
    "enemy:mixed-area": "範囲混合",
  };
  return labels[targetKey] || targetKey;
}

function generationBlockerText(template, attempts) {
  if (template.strategy === "dot") return "毒付与カードが2枚未満。";
  if (template.strategy === "counter") return "反撃/反射/接触効果または維持手段が不足。";
  if (attempts.length === 0) return "候補シードなし。";
  return "足切り条件未達。";
}

const presets = [
  {
    id: "sample-rapid",
    name: "疾走捕食",
    kind: "model",
    description: "高AGとサーチ攻撃で支援個体を先に落とし、相手の行動量を削る。",
    general: "duelist",
    keyCards: ["duelist", "scout"],
    units: [
      ["raptorSwarm", 0, 0],
      ["duelist", 0, 1],
      ["blinkFox", 0, 2],
      ["lancer", 1, 0],
      ["scout", 1, 1],
      ["archer", 1, 2],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "sample-shell",
    name: "甲殻菌糸",
    kind: "model",
    description: "装甲と回復で菌糸エースを守り、胞子砲と毒で前線を崩す。",
    general: "mirrorTurtle",
    keyCards: ["sporeTitan", "mirrorTurtle"],
    units: [
      ["engineer", 0, 0],
      ["sporeTitan", 0, 1],
      ["ironFern", 0, 2],
      ["oracle", 1, 0],
      ["mirrorTurtle", 1, 1],
      ["priest", 2, 0],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "sample-corrosion",
    name: "腐蝕制圧",
    kind: "model",
    description: "範囲攻撃、回復封じ、防御低下、装甲貫通で耐久盤面を崩す。",
    general: "cannoneer",
    keyCards: ["cannoneer", "acidCoral"],
    units: [
      ["lord", 0, 0],
      ["crystalLeech", 1, 0],
      ["acidCoral", 1, 1],
      ["cannoneer", 1, 2],
      ["seer", 2, 0],
      ["strategist", 2, 1],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "guard",
    name: "甲殻前線",
    kind: "legacy",
    general: "captain",
    units: [
      ["lancer", 0, 0],
      ["strategist", 0, 1],
      ["tideguard", 1, 0],
      ["captain", 1, 1],
      ["engineer", 2, 0],
      ["oracle", 2, 1],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "raid",
    name: "擬態奇襲",
    kind: "legacy",
    general: "scout",
    units: [
      ["scout", 0, 2],
      ["duelist", 0, 0],
      ["lancer", 1, 0],
      ["archer", 1, 2],
      ["engineer", 0, 1],
      ["breaker", 1, 1],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "sea",
    name: "礁壁海域",
    kind: "legacy",
    general: "tideguard",
    units: [
      ["engineer", 0, 0],
      ["cannoneer", 0, 1],
      ["captain", 1, 0],
      ["tideguard", 1, 1],
      ["strategist", 1, 2],
      ["oracle", 2, 0],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "charge",
    name: "巨角突破",
    kind: "legacy",
    general: "lancer",
    units: [
      ["lancer", 1, 1],
      ["duelist", 0, 0],
      ["breaker", 1, 0],
      ["scout", 0, 1],
      ["oracle", 2, 0],
      ["cannoneer", 1, 2],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "terrain-guard",
    name: "地形: 巣壁防衛",
    kind: "terrain",
    description: "殻壁上のレジンビートルを軸に、装甲と回復で前線を固定する。",
    general: "engineer",
    units: [
      ["engineer", 0, 0],
      ["tideguard", 0, 1],
      ["oracle", 0, 2],
      ["captain", 1, 0],
      ["strategist", 1, 1],
      ["duelist", 2, 0],
    ],
    terrain: [
      ["rampart", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "terrain-raid",
    name: "地形: 森擬態",
    kind: "terrain",
    description: "森のAG補正でグラスマンティスαをさらに速くし、後衛へ圧をかける。",
    general: "scout",
    units: [
      ["duelist", 0, 0],
      ["engineer", 0, 1],
      ["scout", 0, 2],
      ["lancer", 1, 0],
      ["breaker", 1, 1],
      ["archer", 1, 2],
    ],
    terrain: [
      ["plain", "plain", "forest"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "terrain-sea",
    name: "地形: 海域α",
    kind: "terrain",
    description: "海上のリーフバスティオンαを強化し、海/殻壁対象のα特性を見せる。",
    general: "tideguard",
    units: [
      ["engineer", 0, 0],
      ["seer", 0, 1],
      ["captain", 1, 0],
      ["tideguard", 1, 1],
      ["strategist", 1, 2],
      ["oracle", 2, 0],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "sea", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "terrain-highland",
    name: "地形: 高地熱線",
    kind: "terrain",
    description: "高地ボルカノドレイクの後衛掃射で、前衛崩しを早める。",
    general: "lancer",
    units: [
      ["duelist", 0, 0],
      ["scout", 0, 1],
      ["lancer", 1, 0],
      ["strategist", 1, 1],
      ["cannoneer", 1, 2],
      ["oracle", 2, 0],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "highland"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "lesson-sweep",
    name: "教材: 共鳴掃射",
    kind: "lesson",
    lesson: "ATアップを先に入れて、掃射で前衛全体を削る。",
    general: "cannoneer",
    units: [
      ["captain", 0, 0],
      ["cannoneer", 0, 1],
      ["seer", 0, 2],
      ["strategist", 1, 0],
      ["archer", 1, 1],
      ["oracle", 1, 2],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "lesson-speed",
    name: "教材: 電位集中",
    kind: "lesson",
    lesson: "AGアップで行動順を作り、同列へ攻撃を集中する。",
    general: "scout",
    units: [
      ["duelist", 0, 0],
      ["archer", 0, 1],
      ["scout", 0, 2],
      ["breaker", 1, 0],
      ["lancer", 1, 1],
      ["strategist", 1, 2],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "lesson-armor",
    name: "教材: 甲殻護衛",
    kind: "lesson",
    lesson: "装甲付与で当該ターンの被ダメージを抑え、前線を長く維持する。",
    general: "captain",
    units: [
      ["tideguard", 0, 0],
      ["captain", 0, 1],
      ["strategist", 0, 2],
      ["lancer", 1, 0],
      ["engineer", 1, 1],
      ["oracle", 1, 2],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "lesson-heal",
    name: "教材: 菌糸再生",
    kind: "lesson",
    lesson: "一撃で落ちない耐久を作り、単体回復と治癒陣で確定数をずらす。",
    general: "oracle",
    units: [
      ["tideguard", 0, 0],
      ["engineer", 0, 1],
      ["captain", 1, 0],
      ["oracle", 1, 1],
      ["priest", 1, 2],
      ["lancer", 2, 0],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "lesson-general-skill",
    name: "教材: α特性軸",
    kind: "lesson",
    lesson: "ステータス控えめのシナプスコアαを守り、開戦全体バフで初動を作る。",
    general: "lord",
    units: [
      ["breaker", 0, 0],
      ["engineer", 0, 1],
      ["captain", 1, 0],
      ["lord", 1, 1],
      ["priest", 1, 2],
      ["duelist", 2, 0],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
  {
    id: "lesson-ace-general",
    name: "教材: 頂点α",
    kind: "lesson",
    lesson: "高ステータスαにAT/AG/装甲/回復支援を集めて突破する。",
    general: "breaker",
    units: [
      ["lancer", 0, 0],
      ["paladin", 0, 1],
      ["captain", 1, 0],
      ["breaker", 1, 1],
      ["strategist", 1, 2],
      ["priest", 2, 0],
    ],
    terrain: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
    ],
  },
];

let STANDARD_DECK_GENERATION_RESULT = generateStandardDeckCandidates();
presets.push(...STANDARD_DECK_GENERATION_RESULT.presets);
presets.push(...loadCustomPresets());

const initialPlayerPreset = getPreset("sample-rapid");
const initialEnemyPreset = getPreset("sample-shell");

let setup = {
  playerPreset: "sample-rapid",
  enemyPreset: "sample-shell",
  editSide: "player",
  editMode: "inspect",
  replaySpeed: "1",
  playerUnits: cloneUnits(initialPlayerPreset.units),
  enemyUnits: cloneUnits(initialEnemyPreset.units),
  playerGeneral: initialPlayerPreset.general,
  enemyGeneral: initialEnemyPreset.general,
  playerTerrain: cloneTerrain(initialPlayerPreset.terrain),
  enemyTerrain: cloneTerrain(initialEnemyPreset.terrain),
};

let lastState = null;
let selectedUnitId = null;
let selectedCardId = "duelist";
let draggedCardId = null;
let draggedTerrainId = null;
let lastBattleLog = null;
let activeFrame = null;
let replayTimer = null;
let lastSeriesStats = null;

const els = {
  playerPreset: document.querySelector("#playerPreset"),
  enemyPreset: document.querySelector("#enemyPreset"),
  editSide: document.querySelector("#editSide"),
  editMode: document.querySelector("#editMode"),
  cardPicker: document.querySelector("#cardPicker"),
  cardLibrary: document.querySelector("#cardLibrary"),
  deckName: document.querySelector("#deckName"),
  saveDeck: document.querySelector("#saveDeck"),
  deleteDeck: document.querySelector("#deleteDeck"),
  editorMessage: document.querySelector("#editorMessage"),
  replaySpeed: document.querySelector("#replaySpeed"),
  runBattle: document.querySelector("#runBattle"),
  runRoundRobin: document.querySelector("#runRoundRobin"),
  playReplay: document.querySelector("#playReplay"),
  resetBattle: document.querySelector("#resetBattle"),
  playerBoard: document.querySelector("#playerBoard"),
  enemyBoard: document.querySelector("#enemyBoard"),
  playerCost: document.querySelector("#playerCost"),
  enemyCost: document.querySelector("#enemyCost"),
  costSummary: document.querySelector("#costSummary"),
  winnerSummary: document.querySelector("#winnerSummary"),
  phaseSummary: document.querySelector("#phaseSummary"),
  selectedCardName: document.querySelector("#selectedCardName"),
  cardDetail: document.querySelector("#cardDetail"),
  terrainPalette: document.querySelector("#terrainPalette"),
  terrainCost: document.querySelector("#terrainCost"),
  battleLog: document.querySelector("#battleLog"),
  turnCount: document.querySelector("#turnCount"),
  matchupBadge: document.querySelector("#matchupBadge"),
  matchupSummary: document.querySelector("#matchupSummary"),
  roundRobinTable: document.querySelector("#roundRobinTable"),
  generationSummary: document.querySelector("#generationSummary"),
  cardReference: document.querySelector("#cardReference"),
  actionReference: document.querySelector("#actionReference"),
  terrainReference: document.querySelector("#terrainReference"),
};

function init() {
  renderPresetSelectors();
  renderCardPicker();
  renderCardLibrary();
  els.playerPreset.value = setup.playerPreset;
  els.enemyPreset.value = setup.enemyPreset;
  els.editSide.value = setup.editSide;
  els.editMode.value = setup.editMode;
  els.replaySpeed.value = setup.replaySpeed;
  els.playerPreset.addEventListener("change", () => {
    applyPresetToSide("player", els.playerPreset.value);
    selectedUnitId = null;
    renderSetup();
  });
  els.enemyPreset.addEventListener("change", () => {
    applyPresetToSide("enemy", els.enemyPreset.value);
    selectedUnitId = null;
    renderSetup();
  });
  els.editSide.addEventListener("change", () => {
    setup.editSide = els.editSide.value;
    renderCardLibrary();
  });
  els.editMode.addEventListener("change", () => {
    setup.editMode = els.editMode.value;
    renderCardLibrary();
  });
  els.cardPicker.addEventListener("change", () => {
    selectedCardId = els.cardPicker.value === "__empty" ? null : els.cardPicker.value;
    selectedUnitId = null;
    renderCardLibrary();
    renderSelectedCard(lastState || createBattleState());
  });
  els.cardDetail.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-card-edit-action]");
    if (editButton) {
      handleCardEditorAction(editButton);
      return;
    }
    const button = event.target.closest("[data-general-unit]");
    if (!button) return;
    setGeneralByUnitId(button.dataset.generalUnit);
  });
  els.cardDetail.addEventListener("change", handleCardEditorChange);
  els.replaySpeed.addEventListener("change", () => {
    setup.replaySpeed = els.replaySpeed.value;
  });
  els.saveDeck.addEventListener("click", saveCurrentDeck);
  els.deleteDeck.addEventListener("click", deleteCurrentDeck);
  els.runBattle.addEventListener("click", runBattle);
  els.runRoundRobin.addEventListener("click", runRoundRobin);
  els.playReplay.addEventListener("click", playReplay);
  els.resetBattle.addEventListener("click", () => {
    stopReplay();
    selectedUnitId = null;
    lastState = null;
    lastBattleLog = null;
    lastSeriesStats = null;
    activeFrame = null;
    applyPresetToSide("player", setup.playerPreset);
    applyPresetToSide("enemy", setup.enemyPreset);
    setEditorMessage("初期化しました。");
    renderSetup();
  });
  renderTerrainPalette();
  renderReferences();
  renderGenerationSummary();
  renderSetup();
}

function renderPresetSelectors() {
  const playerValue = setup?.playerPreset || "guard";
  const enemyValue = setup?.enemyPreset || "raid";
  els.playerPreset.innerHTML = "";
  els.enemyPreset.innerHTML = "";
  presets.forEach((preset) => {
    const label = presetOptionLabel(preset);
    els.playerPreset.append(new Option(label, preset.id));
    els.enemyPreset.append(new Option(label, preset.id));
  });
  els.playerPreset.value = getPreset(playerValue).id;
  els.enemyPreset.value = getPreset(enemyValue).id;
}

function renderCardPicker() {
  els.cardPicker.innerHTML = "";
  els.cardPicker.append(new Option("空きマス", "__empty"));
  Object.entries(cards).forEach(([cardId, card]) => {
    els.cardPicker.append(new Option(`${card.name} / ${cardCostPairText(card)}`, cardId));
  });
  if (selectedCardId && cards[selectedCardId]) {
    els.cardPicker.value = selectedCardId;
  } else {
    els.cardPicker.value = "__empty";
  }
}

function renderCardLibrary() {
  if (!els.cardLibrary) return;
  els.cardLibrary.innerHTML = "";
  const activeSideUnits = setup[`${setup.editSide}Units`] || [];
  const activeCards = new Set(activeSideUnits.map(([cardId]) => cardId));

  const newCardItem = document.createElement("button");
  newCardItem.type = "button";
  newCardItem.className = "library-card library-empty library-create";
  newCardItem.innerHTML = `
    <div class="library-card-head">
      <strong>新カード</strong>
      <span>追加</span>
    </div>
    <p>白紙カードを作り、カードプールに追加する。</p>
  `;
  newCardItem.addEventListener("click", () => createNewCard());
  els.cardLibrary.append(newCardItem);

  const emptyItem = document.createElement("button");
  emptyItem.type = "button";
  emptyItem.className = "library-card library-empty";
  emptyItem.draggable = true;
  emptyItem.innerHTML = `
    <div class="library-card-head">
      <strong>空きマス</strong>
      <span>外す</span>
    </div>
    <p>配置済みカードを外す。</p>
  `;
  emptyItem.addEventListener("click", () => {
    selectedCardId = null;
    selectedUnitId = null;
    els.cardPicker.value = "__empty";
    renderCardLibrary();
    renderSelectedCard(lastState || createBattleState());
  });
  emptyItem.addEventListener("dragstart", (event) => {
    draggedCardId = "__empty";
    draggedTerrainId = null;
    event.dataTransfer?.setData("text/card-id", "__empty");
  });
  els.cardLibrary.append(emptyItem);

  Object.entries(cards).forEach(([cardId, card]) => {
    const score = scoreCard(cardId);
    const item = document.createElement("button");
    item.type = "button";
    item.className = `library-card${selectedCardId === cardId ? " selected" : ""}${activeCards.has(cardId) ? " in-deck" : ""}`;
    item.draggable = true;
    item.innerHTML = `
      <div class="library-card-head">
        <strong>${card.name}</strong>
        <span class="library-cost">${cardCostPairShort(card)}</span>
      </div>
      <div class="library-stat-grid">
        <span><b>HP</b>${card.hp}</span>
        <span><b>AT</b>${card.at}</span>
        <span><b>AG</b>${card.ag}</span>
      </div>
      <div class="library-action-grid">
        <span><b>${TERMS.rankShort[0]}</b>${actionTermMarkup(card.front)}</span>
        <span><b>${TERMS.rankShort[1]}</b>${actionTermMarkup(card.middle)}</span>
        <span><b>${TERMS.rankShort[2]}</b>${actionTermMarkup(card.rear)}</span>
      </div>
      <p class="library-score">点 ${score.normalTotal} ${score.normalJudgment} / ${TERMS.alpha} ${score.alphaTotal} ${score.alphaJudgment}</p>
      <div class="tag-line">${cardBadgeMarkup(card)}</div>
    `;
    item.addEventListener("click", () => {
      selectedCardId = cardId;
      selectedUnitId = null;
      els.cardPicker.value = cardId;
      renderCardLibrary();
      renderSelectedCard(lastState || createBattleState());
    });
    item.addEventListener("dragstart", (event) => {
      draggedCardId = cardId;
      draggedTerrainId = null;
      selectedCardId = cardId;
      els.cardPicker.value = cardId;
      event.dataTransfer?.setData("text/card-id", cardId);
      event.dataTransfer?.setData("text/plain", card.name);
    });
    item.addEventListener("dragend", () => {
      draggedCardId = null;
    });
    els.cardLibrary.append(item);
  });
}

function actionTermMarkup(actionKey, label = "") {
  const action = actions[actionKey];
  return termMarkup(`${label}${action.name}`, actionSpecText(actionKey));
}

function terrainTermMarkup(terrainKey) {
  const terrain = terrainTypes[terrainKey];
  return termMarkup(terrain.name, terrainSpecText(terrainKey));
}

function termMarkup(label, description) {
  const text = uiText(label);
  const tooltip = uiText(description);
  return `<span class="term" title="${attrEscape(tooltip)}" data-tooltip="${attrEscape(tooltip)}">${text}</span>`;
}

function attrEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function presetOptionLabel(preset) {
  const labels = {
    model: "平地",
    generated: "生成",
    terrain: "地形",
    lesson: "教材",
    legacy: "旧モデル",
    custom: "登録",
  };
  return uiText(`${labels[preset.kind] || TERMS.deck}: ${preset.name}`);
}

function applyPresetToSide(side, presetId) {
  const preset = getPreset(presetId);
  setup[`${side}Preset`] = preset.id;
  setup[`${side}Units`] = cloneUnits(preset.units);
  setup[`${side}General`] = preset.general;
  setup[`${side}Terrain`] = cloneTerrain(preset.terrain);
}

function currentPresetForSide(side) {
  const preset = getPreset(setup[`${side}Preset`]);
  return {
    ...preset,
    units: cloneUnits(setup[`${side}Units`] || preset.units),
    general: setup[`${side}General`] || preset.general,
    terrain: cloneTerrain(setup[`${side}Terrain`] || preset.terrain),
  };
}

function battlePresetFor(side, options = {}) {
  const prefix = side === "player" ? "player" : "enemy";
  const preset = getPreset(options[`${prefix}PresetId`] || setup[`${prefix}Preset`]);
  if (options[`${prefix}Units`]) {
    return {
      ...preset,
      units: cloneUnits(options[`${prefix}Units`]),
      general: options[`${prefix}General`] || preset.general,
    };
  }
  if (options[`${prefix}PresetId`]) return preset;
  return currentPresetForSide(side);
}

function handleSlotClick(side, row, col, unit, state) {
  if (setup.editSide === side && setup.editMode === "terrain") {
    if (draggedTerrainId) {
      editTerrainSlot(side, row, col, draggedTerrainId);
    } else {
      cycleTerrain(side, row, col);
    }
    return;
  }
  if (setup.editSide === side && setup.editMode === "card") {
    editCardSlot(side, row, col);
    return;
  }
  if (setup.editSide === side && setup.editMode === "general") {
    if (!unit) {
      setEditorMessage("α指定はカードがあるマスのみ有効です。");
      return;
    }
    const nextCost = costForEditedSide(side, { general: unit.cardId });
    if (nextCost.total > COST_LIMIT) {
      setEditorMessage(costLimitMessage(nextCost));
      return;
    }
    setup[`${side}General`] = unit.cardId;
    selectedUnitId = unit.id;
    setEditorMessage(`${unit.card.name}をαに指定しました。`);
    renderSetup();
    return;
  }
  if (unit) {
    selectedUnitId = selectedUnitId === unit.id ? null : unit.id;
    selectedCardId = unit.cardId;
    els.cardPicker.value = unit.cardId;
    renderBoards(state);
    renderCardLibrary();
    renderSelectedCard(state);
  }
}

function setGeneralByUnitId(unitId) {
  const state = lastState || createBattleState();
  const unit = state.units.find((item) => item.id === unitId);
  if (!unit) return;
  const nextCost = costForEditedSide(unit.side, { general: unit.cardId });
  if (nextCost.total > COST_LIMIT) {
    setEditorMessage(costLimitMessage(nextCost));
    return;
  }
  setup[`${unit.side}General`] = unit.cardId;
  setup.editSide = unit.side;
  els.editSide.value = unit.side;
  selectedUnitId = unit.id;
  selectedCardId = unit.cardId;
  els.cardPicker.value = unit.cardId;
  setEditorMessage(`${sideLabel(unit.side)}の${unit.card.name}をαに指定しました。`);
  renderSetup();
}

function editCardSlot(side, row, col, cardId = els.cardPicker.value) {
  let units = cloneUnits(setup[`${side}Units`]);
  const previousCount = units.length;
  const occupied = units.find((unit) => unit[1] === row && unit[2] === col);
  units = units.filter((unit) => !(unit[1] === row && unit[2] === col));

  if (cardId !== "__empty") {
    units = units.filter((unit) => unit[0] !== cardId);
    if (!occupied && previousCount >= MAX_DECK_CARDS && !setup[`${side}Units`].some((unit) => unit[0] === cardId)) {
      setEditorMessage(`盤面は最大${MAX_DECK_CARDS}枚までです。`);
      return;
    }
    const candidate = sortUnits([...units, [cardId, row, col]]);
    if (!isLegalInitialSlot(candidate, row, col)) {
      setEditorMessage(`${ROW_LABELS[row]}${COL_LABELS[col]}には前方のカードが必要です。`);
      return;
    }
    const nextGeneral = candidate.some(([unitCardId]) => unitCardId === setup[`${side}General`])
      ? setup[`${side}General`]
      : candidate[0]?.[0] || cardId;
    const nextCost = costForEditedSide(side, { units: candidate, general: nextGeneral });
    if (nextCost.total > COST_LIMIT) {
      setEditorMessage(costLimitMessage(nextCost));
      return;
    }
    units = candidate;
  }

  units = sortUnits(legalFormationUnits(units).slice(0, MAX_DECK_CARDS));
  setup[`${side}Units`] = units;
  repairGeneral(side);
  selectedUnitId = null;
  selectedCardId = cardId === "__empty" ? null : cardId;
  els.cardPicker.value = cardId;
  setEditorMessage(cardId === "__empty" ? "カードを外しました。" : `${cards[cardId].name}を配置しました。`);
  renderCardLibrary();
  renderSetup();
}

function editTerrainSlot(side, row, col, terrainId) {
  if (!terrainTypes[terrainId]) return;
  const grid = side === "player" ? setup.playerTerrain : setup.enemyTerrain;
  const nextGrid = cloneTerrain(grid);
  nextGrid[row][col] = terrainId;
  const nextCost = costForEditedSide(side, { terrain: nextGrid });
  if (nextCost.total > COST_LIMIT) {
    setEditorMessage(costLimitMessage(nextCost));
    return;
  }
  grid[row][col] = terrainId;
  selectedUnitId = null;
  setEditorMessage(`${sideLabel(side)} ${ROW_LABELS[row]}${COL_LABELS[col]}を${terrainTypes[terrainId].name}に変更しました。`);
  renderSetup();
}

function costForEditedSide(side, overrides = {}) {
  const preset = currentPresetForSide(side);
  return presetCost({
    ...preset,
    units: overrides.units ? cloneUnits(overrides.units) : cloneUnits(preset.units),
    general: overrides.general || preset.general,
    terrain: overrides.terrain ? cloneTerrain(overrides.terrain) : cloneTerrain(preset.terrain),
  });
}

function costLimitMessage(cost) {
  return `${TERMS.cost} ${cost.total}/${COST_LIMIT}です。カード、α指定、地形の合計を${COST_LIMIT}以内にしてください。`;
}

function repairGeneral(side) {
  const units = setup[`${side}Units`];
  const general = setup[`${side}General`];
  if (units.some(([cardId]) => cardId === general)) return;
  setup[`${side}General`] = units[0]?.[0] || "captain";
}

function saveCurrentDeck() {
  const side = setup.editSide;
  const preset = currentPresetForSide(side);
  const cost = presetCost(preset);
  if (preset.units.length === 0) {
    setEditorMessage("カードがありません。");
    return;
  }
  if (cost.total > COST_LIMIT) {
    setEditorMessage(`${TERMS.cost} ${cost.total}/${COST_LIMIT}です。`);
    return;
  }
  const rawName = els.deckName.value.trim();
  const name = rawName || `${preset.name} 編集`;
  const customPreset = {
    id: `custom-${Date.now().toString(36)}`,
    name,
    kind: "custom",
    description: `${preset.name}から登録`,
    general: preset.general,
    units: cloneUnits(preset.units),
    terrain: cloneTerrain(preset.terrain),
  };
  presets.push(customPreset);
  saveCustomPresets();
  setup[`${side}Preset`] = customPreset.id;
  renderPresetSelectors();
  els[`${side}Preset`].value = customPreset.id;
  setEditorMessage(`${name}を登録しました。`);
  renderSetup();
}

function deleteCurrentDeck() {
  const side = setup.editSide;
  const preset = getPreset(setup[`${side}Preset`]);
  if (preset.kind !== "custom") {
    setEditorMessage("登録デッキのみ削除できます。");
    return;
  }
  const index = presets.findIndex((item) => item.id === preset.id);
  if (index >= 0) presets.splice(index, 1);
  saveCustomPresets();
  applyPresetToSide(side, "guard");
  if (setup[`${opposite(side)}Preset`] === preset.id) {
    applyPresetToSide(opposite(side), "guard");
  }
  renderPresetSelectors();
  setEditorMessage(`${preset.name}を削除しました。`);
  renderSetup();
}

function setEditorMessage(message) {
  if (els.editorMessage) els.editorMessage.textContent = uiText(message);
}

function renderSetup() {
  stopReplay();
  const state = createBattleState();
  lastState = state;
  lastBattleLog = null;
  lastSeriesStats = null;
  activeFrame = null;
  renderBoards(state);
  renderCosts(state);
  renderCardLibrary();
  renderLog(["編成を選択済み。戦闘開始でα撃破まで自動解決を実行。"]);
  els.winnerSummary.textContent = "未実行";
  els.phaseSummary.textContent = uiText(setupConceptText());
  els.turnCount.textContent = "0T";
  els.playReplay.disabled = true;
  els.playReplay.textContent = "リプレイ再生";
  els.matchupBadge.textContent = "未実行";
  els.matchupSummary.innerHTML = "";
  els.roundRobinTable.innerHTML = "";
  renderSelectedCard(state);
}

function runBattle() {
  stopReplay();
  const costWarning = validateBattleCosts();
  if (costWarning) {
    setEditorMessage(costWarning);
    return;
  }
  const stats = simulateSeries({
    playerPresetId: setup.playerPreset,
    enemyPresetId: setup.enemyPreset,
    playerUnits: cloneUnits(setup.playerUnits),
    enemyUnits: cloneUnits(setup.enemyUnits),
    playerGeneral: setup.playerGeneral,
    enemyGeneral: setup.enemyGeneral,
    playerTerrain: setup.playerTerrain,
    enemyTerrain: setup.enemyTerrain,
    battles: MATCH_BATTLE_COUNT,
    recordFirst: true,
  });

  lastSeriesStats = stats;
  lastBattleLog = stats.replay.log;
  lastState = stats.replay.state;
  selectedUnitId = null;
  activeFrame = null;
  renderBoards(stats.replay.state);
  renderCosts(stats.replay.state);
  renderLog(stats.replay.log.entries);
  els.winnerSummary.textContent = seriesResultLabel(stats);
  els.phaseSummary.textContent = uiText(summarizeSeries(stats));
  els.turnCount.textContent = `${stats.averageTurns.toFixed(1)}T avg`;
  els.playReplay.disabled = stats.replay.log.frames.length === 0;
  els.playReplay.textContent = "代表戦リプレイ";
  renderMatchupSummary(stats);
  renderSelectedCard(stats.replay.state);
}

function validateBattleCosts() {
  const playerCost = presetCost(currentPresetForSide("player"));
  if (playerCost.total > COST_LIMIT) {
    return `${TERMS.playerSide}: ${costLimitMessage(playerCost)}`;
  }
  const enemyCost = presetCost(currentPresetForSide("enemy"));
  if (enemyCost.total > COST_LIMIT) {
    return `${TERMS.enemySide}: ${costLimitMessage(enemyCost)}`;
  }
  return "";
}

function simulateBattle(options = {}) {
  const state = createBattleState(options);
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
    log.push(`TURN ${turn}`);
    recordFrame(log, state, { type: "turn", text: `ターン ${turn}` });
    resetTurnFlags(state);
    applyTerrainTurnStart(state, log);
    applyStatusTurnStart(state, log);
    result = checkGeneralVictory(state, log);
    if (result) break;
    applyGeneralSkills(state, log, "turnStart");
    chargeUltimates(state);

    const actedIds = new Set();
    while (true) {
      const batch = nextActingBatch(state, actedIds);
      if (!batch) break;
      batch.units.forEach((unit) => actedIds.add(unit.id));
      executeActionBatch(state, batch, log);
      result = checkGeneralVictory(state, log);
      if (result) break;
    }

    cleanupFallen(state, log);
    if (!result) {
      result = checkGeneralVictory(state, log);
    }
    if (result) break;
    compactRows(state, log);
    recordAlphaExposureStates(state);

    const afterTurn = progressSignature(state);
    const repeatedCount = (repeatedPositions.get(afterTurn) || 0) + 1;
    repeatedPositions.set(afterTurn, repeatedCount);
    stagnantTurns = beforeTurn === afterTurn ? stagnantTurns + 1 : 0;
    if (stagnantTurns >= STALEMATE_REPEAT_LIMIT || repeatedCount >= STALEMATE_REPEAT_LIMIT) {
      result = "draw";
      log.push(`HP/位置の停滞または同一盤面の反復が${STALEMATE_REPEAT_LIMIT}回発生したため引き分け`);
      recordFrame(log, state, { type: "draw", text: "膠着による引き分け" });
      break;
    }
  }

  if (!result) {
    result = "draw";
    log.push(`${SAFETY_TURN_LIMIT}ターン経過してもαが倒れないため引き分け`);
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
  };
}

function createBattleLog(initialState) {
  return {
    entries: [],
    frames: [
      {
        type: "setup",
        text: "編成確認",
        logIndex: -1,
        state: snapshotBattleState(initialState),
      },
    ],
    finalState: null,
    result: null,
    push(text) {
      this.entries.push(text);
    },
  };
}

function createSilentLog() {
  return {
    entries: [],
    finalState: null,
    result: null,
    push() {},
  };
}

function simulateSeries(options) {
  const battles = options.battles || MATCH_BATTLE_COUNT;
  const stats = {
    playerPresetId: options.playerPresetId,
    enemyPresetId: options.enemyPresetId,
    battles,
    playerWins: 0,
    enemyWins: 0,
    draws: 0,
    totalTurns: 0,
    replay: null,
    metricTotals: createSeriesMetricTotals(),
  };

  for (let index = 0; index < battles; index += 1) {
    const battle = simulateBattle({
      ...options,
      record: Boolean(options.recordFirst && index === 0),
    });
    if (index === 0 && options.recordFirst) {
      stats.replay = battle;
    }
    if (battle.result === "player") stats.playerWins += 1;
    if (battle.result === "enemy") stats.enemyWins += 1;
    if (battle.result === "draw") stats.draws += 1;
    stats.totalTurns += battle.turns;
    accumulateSeriesMetrics(stats.metricTotals, battle.metrics);
  }

  if (!stats.replay && options.recordFirst) {
    stats.replay = simulateBattle({ ...options, record: true });
  }
  stats.playerWinRate = stats.playerWins / battles;
  stats.enemyWinRate = stats.enemyWins / battles;
  stats.drawRate = stats.draws / battles;
  stats.averageTurns = stats.totalTurns / battles;
  stats.metrics = finalizeSeriesMetrics(stats.metricTotals, battles);
  delete stats.metricTotals;
  stats.matchResult = stats.playerWins > stats.enemyWins
    ? "player"
    : stats.enemyWins > stats.playerWins
      ? "enemy"
      : "draw";
  return stats;
}

function createSeriesMetricTotals() {
  return {
    sides: {
      player: createSideSeriesMetricTotals(),
      enemy: createSideSeriesMetricTotals(),
    },
    tieBreaks: {
      total: 0,
      rarity: 0,
      simultaneous: 0,
      position: 0,
      playerWins: 0,
      enemyWins: 0,
    },
  };
}

function createSideSeriesMetricTotals() {
  return {
    presetName: "",
    keyCardNames: [],
    actions: 0,
    ultimates: 0,
    keyActions: 0,
    keyUltimates: 0,
    keySurvivalTurns: 0,
    searchActions: 0,
    areaActions: 0,
    backlineAccessActions: 0,
    ultimateChargeBoost: 0,
    damageDealt: 0,
    alphaDamageDealt: 0,
    healing: 0,
    healingBlocked: 0,
    armorGranted: 0,
    armorTurnValue: 0,
    damagePrevented: 0,
    kos: 0,
    alphaExposedTurn: 0,
    alphaExposedCount: 0,
    alphaDefeatTurn: 0,
    alphaDefeatCount: 0,
    keyKoTurn: 0,
    keyKoCount: 0,
    statuses: {
      poison: 0,
      healBlock: 0,
      defenseDown: 0,
      contactPoison: 0,
      reflectShell: 0,
    },
  };
}

function accumulateSeriesMetrics(totals, metrics) {
  if (!metrics) return;
  ["player", "enemy"].forEach((side) => accumulateSideSeriesMetrics(totals.sides[side], metrics.sides[side]));
  Object.keys(totals.tieBreaks).forEach((key) => {
    totals.tieBreaks[key] += metrics.tieBreaks[key] || 0;
  });
}

function accumulateSideSeriesMetrics(total, sideMetrics) {
  if (!total.presetName) total.presetName = sideMetrics.presetName;
  if (total.keyCardNames.length === 0) total.keyCardNames = [...sideMetrics.keyCardNames];
  [
    "actions",
    "ultimates",
    "keyActions",
    "keyUltimates",
    "keySurvivalTurns",
    "searchActions",
    "areaActions",
    "backlineAccessActions",
    "ultimateChargeBoost",
    "damageDealt",
    "alphaDamageDealt",
    "healing",
    "healingBlocked",
    "armorGranted",
    "armorTurnValue",
    "damagePrevented",
    "kos",
  ].forEach((key) => {
    total[key] += sideMetrics[key] || 0;
  });
  Object.keys(total.statuses).forEach((key) => {
    total.statuses[key] += sideMetrics.statuses[key] || 0;
  });
  if (sideMetrics.alphaExposedTurn !== null) {
    total.alphaExposedTurn += sideMetrics.alphaExposedTurn;
    total.alphaExposedCount += 1;
  }
  if (sideMetrics.alphaDefeatTurn !== null) {
    total.alphaDefeatTurn += sideMetrics.alphaDefeatTurn;
    total.alphaDefeatCount += 1;
  }
  if (sideMetrics.keyKoTurn !== null) {
    total.keyKoTurn += sideMetrics.keyKoTurn;
    total.keyKoCount += 1;
  }
}

function finalizeSeriesMetrics(totals, battles) {
  return {
    sides: {
      player: finalizeSideSeriesMetrics(totals.sides.player, battles),
      enemy: finalizeSideSeriesMetrics(totals.sides.enemy, battles),
    },
    tieBreaks: Object.fromEntries(Object.entries(totals.tieBreaks).map(([key, value]) => [key, value / battles])),
  };
}

function finalizeSideSeriesMetrics(total, battles) {
  const averaged = {
    presetName: total.presetName,
    keyCardNames: total.keyCardNames,
    statuses: {},
  };
  [
    "actions",
    "ultimates",
    "keyActions",
    "keyUltimates",
    "keySurvivalTurns",
    "searchActions",
    "areaActions",
    "backlineAccessActions",
    "ultimateChargeBoost",
    "damageDealt",
    "alphaDamageDealt",
    "healing",
    "healingBlocked",
    "armorGranted",
    "armorTurnValue",
    "damagePrevented",
    "kos",
  ].forEach((key) => {
    averaged[key] = total[key] / battles;
  });
  Object.keys(total.statuses).forEach((key) => {
    averaged.statuses[key] = total.statuses[key] / battles;
  });
  averaged.alphaExposedTurn = total.alphaExposedCount > 0 ? total.alphaExposedTurn / total.alphaExposedCount : null;
  averaged.alphaExposedRate = total.alphaExposedCount / battles;
  averaged.alphaDefeatTurn = total.alphaDefeatCount > 0 ? total.alphaDefeatTurn / total.alphaDefeatCount : null;
  averaged.alphaDefeatRate = total.alphaDefeatCount / battles;
  averaged.keyKoTurn = total.keyKoCount > 0 ? total.keyKoTurn / total.keyKoCount : null;
  averaged.keyKoRate = total.keyKoCount / battles;
  return averaged;
}

function runRoundRobin() {
  stopReplay();
  const targetPresets = roundRobinPresets();
  const matrix = targetPresets.map((playerPreset) => {
    return targetPresets.map((enemyPreset) => simulateSeries({
      playerPresetId: playerPreset.id,
      enemyPresetId: enemyPreset.id,
      playerTerrain: playerPreset.terrain,
      enemyTerrain: enemyPreset.terrain,
      battles: MATCH_BATTLE_COUNT,
      recordFirst: false,
    }));
  });
  renderRoundRobin(matrix, targetPresets);
  const totals = summarizeMatrix(matrix, targetPresets);
  els.matchupBadge.textContent = "標準総当たり";
  els.matchupSummary.innerHTML = `
    <div class="result-grid">
      <div class="result-cell"><span>組み合わせ</span><strong>${targetPresets.length * targetPresets.length}</strong></div>
      <div class="result-cell"><span>総戦闘数</span><strong>${totals.totalBattles}</strong></div>
      <div class="result-cell"><span>最高勝率</span><strong>${totals.best.winRate}%</strong></div>
      <div class="result-cell"><span>最低勝率</span><strong>${totals.worst.winRate}%</strong></div>
    </div>
    <div class="terrain-item">
      <strong>総合トップ: ${uiText(totals.best.name)}</strong>
      <span>総合最下位: ${uiText(totals.worst.name)}。向き補正後の勝率で、まずはこの差を見てコストや地形相性を調整。</span>
    </div>
    ${roundRobinRiskMarkup(totals.riskFlags)}
  `;
  els.phaseSummary.textContent = uiText(`標準総当たり ${targetPresets.length * targetPresets.length}組を各${MATCH_BATTLE_COUNT}戦で集計。総合トップ/最下位は向き補正後。教材デッキは手動対戦で確認。`);
  els.winnerSummary.textContent = "標準総当たり完了";
}

function roundRobinPresets() {
  return presets.filter((preset) => preset.kind === "model" || preset.kind === "generated");
}

function summarizeMatrix(matrix, targetPresets) {
  const standings = matrix.map((row, index) => {
    const wins = row.reduce((sum, item) => sum + item.playerWins, 0);
    const losses = row.reduce((sum, item) => sum + item.enemyWins, 0);
    const draws = row.reduce((sum, item) => sum + item.draws, 0);
    const battles = row.reduce((sum, item) => sum + item.battles, 0);
    return {
      name: targetPresets[index].name,
      wins,
      losses,
      draws,
      battles,
      winRate: percent(wins / battles),
    };
  });
  const orientationAdjustedStandings = targetPresets.map((preset, index) => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    targetPresets.forEach((_, opponentIndex) => {
      if (index === opponentIndex) return;
      wins += matrix[index][opponentIndex].playerWins;
      losses += matrix[index][opponentIndex].enemyWins;
      draws += matrix[index][opponentIndex].draws;
      wins += matrix[opponentIndex][index].enemyWins;
      losses += matrix[opponentIndex][index].playerWins;
      draws += matrix[opponentIndex][index].draws;
    });
    const battles = wins + losses + draws;
    return {
      name: preset.name,
      wins,
      losses,
      draws,
      battles,
      winRate: percent(wins / battles),
    };
  });
  const sorted = [...orientationAdjustedStandings].sort((a, b) => b.winRate - a.winRate);
  return {
    standings,
    orientationAdjustedStandings,
    totalBattles: matrix.flat().reduce((sum, item) => sum + item.battles, 0),
    best: sorted[0],
    worst: sorted[sorted.length - 1],
    riskFlags: collectRoundRobinRiskFlags(matrix, targetPresets, orientationAdjustedStandings),
  };
}

function collectRoundRobinRiskFlags(matrix, targetPresets, standings) {
  const flags = [];
  standings.forEach((standing) => {
    if (standing.winRate >= ROUND_ROBIN_RISK_RULES.dominantWinRate) {
      flags.push({
        label: "総合突出",
        subject: standing.name,
        detail: `${standing.winRate}% / ${standing.wins}-${standing.losses}-${standing.draws}`,
      });
    }
    if (standing.winRate <= ROUND_ROBIN_RISK_RULES.weakWinRate) {
      flags.push({
        label: "総合低迷",
        subject: standing.name,
        detail: `${standing.winRate}% / ${standing.wins}-${standing.losses}-${standing.draws}`,
      });
    }
  });

  matrix.forEach((row, rowIndex) => {
    row.forEach((stats, colIndex) => {
      const playerPreset = targetPresets[rowIndex];
      const enemyPreset = targetPresets[colIndex];
      if (rowIndex === colIndex) {
        collectMirrorRiskFlags(flags, stats, playerPreset);
        return;
      }
      collectMatchupRiskFlags(flags, stats, playerPreset, enemyPreset);
    });
  });
  return flags;
}

function collectMirrorRiskFlags(flags, stats, preset) {
  const sideBias = Math.abs(stats.playerWins - stats.enemyWins) / stats.battles;
  if (stats.averageTurns >= ROUND_ROBIN_RISK_RULES.longMirrorTurn || stats.drawRate >= ROUND_ROBIN_RISK_RULES.highDrawRate) {
    flags.push({
      label: "長期ミラー",
      subject: preset.name,
      detail: `${stats.averageTurns.toFixed(1)}T / D${percent(stats.drawRate)}%`,
    });
  }
  if (sideBias >= 0.8 && stats.drawRate < ROUND_ROBIN_RISK_RULES.highDrawRate) {
    flags.push({
      label: "ミラー片側固定",
      subject: preset.name,
      detail: `${stats.playerWins}-${stats.enemyWins}-${stats.draws}`,
    });
  }
}

function collectMatchupRiskFlags(flags, stats, playerPreset, enemyPreset) {
  if (stats.matchResult === "draw") return;
  const winnerName = stats.matchResult === "player" ? playerPreset.name : enemyPreset.name;
  const loserName = stats.matchResult === "player" ? enemyPreset.name : playerPreset.name;
  if (stats.averageTurns <= ROUND_ROBIN_RISK_RULES.fastDecisionTurn) {
    flags.push({
      label: "高速決着",
      subject: `${winnerName} > ${loserName}`,
      detail: `${stats.averageTurns.toFixed(1)}T / ${stats.playerWins}-${stats.enemyWins}-${stats.draws}`,
    });
  }
  const loserActions = loserAverageActions(stats);
  if (loserActions <= ROUND_ROBIN_RISK_RULES.lowLoserActions) {
    flags.push({
      label: "敗者行動不足",
      subject: `${winnerName} > ${loserName}`,
      detail: `敗者${metricNumber(loserActions)}行動 / ${stats.averageTurns.toFixed(1)}T`,
    });
  }
}

function loserAverageActions(stats) {
  if (!stats.metrics) return Number.POSITIVE_INFINITY;
  if (stats.matchResult === "player") return stats.metrics.sides.enemy.actions;
  if (stats.matchResult === "enemy") return stats.metrics.sides.player.actions;
  return Number.POSITIVE_INFINITY;
}

function roundRobinRiskMarkup(flags) {
  if (!flags || flags.length === 0) {
    return `
      <div class="terrain-item risk-summary">
        <strong>危険フラグ: なし</strong>
        <span>現閾値では、標準候補の高速決着、長期ミラー、片側固定、総合突出は検出されませんでした。</span>
      </div>
    `;
  }
  const visibleFlags = flags.slice(0, ROUND_ROBIN_RISK_RULES.maxSummaryItems);
  const remaining = flags.length - visibleFlags.length;
  return `
    <div class="terrain-item risk-summary">
      <strong>危険フラグ: ${flags.length}件</strong>
      <span>${visibleFlags.map(roundRobinRiskText).join(" / ")}${remaining > 0 ? ` / 他${remaining}件` : ""}</span>
    </div>
  `;
}

function roundRobinRiskText(flag) {
  return `${uiText(flag.label)}: ${uiText(flag.subject)} (${uiText(flag.detail)})`;
}

function renderMatchupSummary(stats) {
  els.matchupBadge.textContent = seriesResultLabel(stats);
  els.matchupSummary.innerHTML = `
    <div class="result-grid">
      <div class="result-cell"><span>${TERMS.playerSide}勝率</span><strong>${percent(stats.playerWinRate)}%</strong></div>
      <div class="result-cell"><span>${TERMS.playerSide}勝利</span><strong>${stats.playerWins}</strong></div>
      <div class="result-cell"><span>${TERMS.enemySide}勝利</span><strong>${stats.enemyWins}</strong></div>
      <div class="result-cell"><span>引き分け</span><strong>${stats.draws}</strong></div>
    </div>
    <div class="terrain-item">
      <strong>${uiText(getPreset(stats.playerPresetId).name)} vs ${uiText(getPreset(stats.enemyPresetId).name)}</strong>
      <span>${stats.battles}戦 / 平均${stats.averageTurns.toFixed(1)}ターン。代表戦はリプレイで確認できます。</span>
    </div>
    ${validationMetricsMarkup(stats)}
  `;
}

function renderGenerationSummary() {
  if (!els.generationSummary) return;
  const generatedCount = STANDARD_DECK_GENERATION_RESULT.presets.length;
  const supportedPlans = STANDARD_DECK_GENERATION_RESULT.plans.filter((plan) => plan.candidates.length > 0).length;
  els.generationSummary.innerHTML = `
    <div class="result-grid generation-stat-grid">
      <div class="result-cell"><span>勝ち筋</span><strong>${Object.keys(WIN_PLAN_TEMPLATES).length}</strong></div>
      <div class="result-cell"><span>生成</span><strong>${generatedCount}</strong></div>
      <div class="result-cell"><span>成立</span><strong>${supportedPlans}</strong></div>
      <div class="result-cell"><span>上限</span><strong>${COST_LIMIT}</strong></div>
    </div>
    <div class="generation-list">
      ${STANDARD_DECK_GENERATION_RESULT.plans.map(generationPlanMarkup).join("")}
    </div>
  `;
}

function generationPlanMarkup(plan) {
  if (plan.candidates.length === 0) {
    return `
      <article class="generation-item is-empty">
        <strong>${uiText(plan.templateName)}</strong>
        <span>${uiText(plan.blocker || "未生成")}</span>
      </article>
    `;
  }
  return `
    <article class="generation-item">
      <strong>${uiText(plan.templateName)} <small>${plan.candidates.length}</small></strong>
      <span>${plan.candidates.map((candidate) => uiText(`${candidate.preset.name}: ${candidate.evaluation.summary}`)).join(" / ")}</span>
    </article>
  `;
}

function validationMetricsMarkup(stats) {
  const metrics = stats.metrics;
  if (!metrics) return "";
  const player = metrics.sides.player;
  const enemy = metrics.sides.enemy;
  return `
    <div class="metric-grid">
      ${metricCellMarkup(`${TERMS.playerSide}主軸`, keyMetricText(player), keyMetricNote(player))}
      ${metricCellMarkup(`${TERMS.enemySide}主軸`, keyMetricText(enemy), keyMetricNote(enemy))}
      ${metricCellMarkup(`${TERMS.playerSide}延命`, extensionMetricText(player), extensionMetricNote(player))}
      ${metricCellMarkup(`${TERMS.enemySide}延命`, extensionMetricText(enemy), extensionMetricNote(enemy))}
      ${metricCellMarkup("状態付与", `${statusTotalText(player)} / ${statusTotalText(enemy)}`, `${TERMS.playerSide}: ${statusBreakdownText(player)}。${TERMS.enemySide}: ${statusBreakdownText(enemy)}。`)}
      ${metricCellMarkup(`${TERMS.alpha}露出`, `${TERMS.playerSide}${turnMetricText(player.alphaExposedTurn)} / ${TERMS.enemySide}${turnMetricText(enemy.alphaExposedTurn)}`, `${TERMS.alpha}撃破: ${TERMS.playerSide}${turnMetricText(player.alphaDefeatTurn)} / ${TERMS.enemySide}${turnMetricText(enemy.alphaDefeatTurn)}`)}
    </div>
    <div class="terrain-item">
      <strong>同速処理</strong>
      <span>平均${metricNumber(metrics.tieBreaks.total)}回。レアリティ${metricNumber(metrics.tieBreaks.rarity)} / 同時${metricNumber(metrics.tieBreaks.simultaneous)} / 盤面${metricNumber(metrics.tieBreaks.position)}。</span>
    </div>
  `;
}

function metricCellMarkup(label, value, note) {
  return `
    <div class="result-cell metric-cell">
      <span>${uiText(label)}</span>
      <strong>${uiText(value)}</strong>
      <small>${uiText(note)}</small>
    </div>
  `;
}

function keyMetricText(sideMetrics) {
  return `${metricNumber(sideMetrics.keyActions)}行動 / ${metricNumber(sideMetrics.keyUltimates)}必殺`;
}

function keyMetricNote(sideMetrics) {
  const survival = `生存${metricNumber(sideMetrics.keySurvivalTurns)}T`;
  const keyKo = sideMetrics.keyKoTurn === null ? "主軸撃破なし" : `主軸撃破${turnMetricText(sideMetrics.keyKoTurn)}`;
  return `${sideMetrics.keyCardNames.join(" / ")}。${survival}、${keyKo}。`;
}

function extensionMetricText(sideMetrics) {
  return metricNumber(sideMetrics.healing + sideMetrics.damagePrevented);
}

function extensionMetricNote(sideMetrics) {
  return `回復${metricNumber(sideMetrics.healing)} / 軽減${metricNumber(sideMetrics.damagePrevented)} / 装甲${metricNumber(sideMetrics.armorGranted)}。`;
}

function statusTotalText(sideMetrics) {
  return metricNumber(Object.values(sideMetrics.statuses).reduce((sum, value) => sum + value, 0));
}

function statusBreakdownText(sideMetrics) {
  return `毒${metricNumber(sideMetrics.statuses.poison)}、封${metricNumber(sideMetrics.statuses.healBlock)}、低${metricNumber(sideMetrics.statuses.defenseDown)}、接${metricNumber(sideMetrics.statuses.contactPoison)}、反${metricNumber(sideMetrics.statuses.reflectShell)}`;
}

function turnMetricText(value) {
  return value === null || Number.isNaN(value) ? "なし" : `${metricNumber(value)}T`;
}

function metricNumber(value) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function renderRoundRobin(matrix, targetPresets) {
  const header = targetPresets.map((preset) => `<th scope="col">${uiText(preset.name)}</th>`).join("");
  const rows = matrix.map((row, rowIndex) => {
    const cells = row.map((stats) => {
      const rate = percent(stats.playerWinRate);
      const klass = stats.playerWinRate > 0.55 ? "cell-win" : stats.playerWinRate < 0.45 ? "cell-loss" : "cell-even";
      return `
        <td class="${klass}">
          <div class="match-cell">
            <strong>${rate}%</strong>
            <span>${stats.playerWins}-${stats.enemyWins}-${stats.draws}</span>
            <em>${stats.averageTurns.toFixed(1)}T / D${percent(stats.drawRate)}%</em>
          </div>
        </td>
      `;
    }).join("");
    return `<tr><th scope="row">${uiText(targetPresets[rowIndex].name)}</th>${cells}</tr>`;
  }).join("");

  els.roundRobinTable.innerHTML = `
    <table>
      <thead><tr><th scope="col">${TERMS.playerSide}＼${TERMS.enemySide}</th>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function seriesResultLabel(stats) {
  if (stats.matchResult === "player") return `${TERMS.playerSide}勝利 ${stats.playerWins}-${stats.enemyWins}`;
  if (stats.matchResult === "enemy") return `${TERMS.enemySide}勝利 ${stats.playerWins}-${stats.enemyWins}`;
  return `引き分け ${stats.playerWins}-${stats.enemyWins}`;
}

function summarizeSeries(stats) {
  return `${MATCH_BATTLE_COUNT}戦判定: ${TERMS.playerSide}${stats.playerWins}勝 / ${TERMS.enemySide}${stats.enemyWins}勝 / 引き分け${stats.draws}。平均${stats.averageTurns.toFixed(1)}ターン。`;
}

function setupConceptText() {
  const player = getPreset(setup.playerPreset);
  const enemy = getPreset(setup.enemyPreset);
  return `${TERMS.alphaDefeat}で即勝利。${TERMS.playerSide}: ${presetConceptText(player)} / ${TERMS.enemySide}: ${presetConceptText(enemy)}`;
}

function presetConceptText(preset) {
  if (preset.lesson) return uiText(preset.lesson);
  return uiText(`${preset.name}のモデル配置`);
}

function percent(rate) {
  return Math.round(rate * 100);
}

function recordFrame(log, state, event) {
  if (!log || !log.frames) return;
  log.frames.push({
    ...event,
    logIndex: log.entries.length - 1,
    state: snapshotBattleState(state),
  });
}

function recordBuffFrame(log, state, source, target, bonuses, text) {
  recordBuffGroupFrame(log, state, source, [{ targetId: target.id, ...bonuses }], text);
}

function recordBuffGroupFrame(log, state, source, buffEvents, text) {
  if (buffEvents.length === 0) return;
  recordFrame(log, state, {
    type: "buff",
    sourceId: source.id,
    targetId: buffEvents[0].targetId,
    buffEvents,
    text,
  });
}

function snapshotBattleState(state) {
  return {
    turn: state.turn,
    units: state.units.map((unit) => ({
      ...unit,
      card: unit.card,
      armorEffects: (unit.armorEffects || []).map((effect) => ({ ...effect })),
      statEffects: (unit.statEffects || []).map((effect) => ({ ...effect })),
      statusEffects: (unit.statusEffects || []).map((effect) => ({ ...effect })),
    })),
    terrain: {
      player: cloneTerrain(state.terrain.player),
      enemy: cloneTerrain(state.terrain.enemy),
    },
    flags: { ...state.flags },
  };
}

function progressSignature(state) {
  return state.units
    .filter((unit) => unit.hp > 0 || unit.general)
    .map((unit) => {
      const statuses = (unit.statusEffects || [])
        .filter((effect) => effect.expiresOnTurn >= state.turn)
        .map((effect) => `${effect.key}:${effect.expiresOnTurn}`)
        .join(",");
      return `${unit.id}:${unit.hp}:${unit.row}:${unit.col}:${unit.ultimateCharge || 0}:${statuses}`;
    })
    .sort()
    .join("|");
}

function resultLabel(result) {
  if (result === "player") return `${TERMS.playerSide}勝利`;
  if (result === "enemy") return `${TERMS.enemySide}勝利`;
  if (result === "draw") return "引き分け";
  return "未実行";
}

function playReplay() {
  if (!lastBattleLog || lastBattleLog.frames.length === 0) return;
  stopReplay(false);
  const playbackFrames = replayFramesForPlayback(lastBattleLog.frames);
  let frameIndex = 0;
  els.playReplay.disabled = true;
  els.playReplay.textContent = "再生中";

  const step = () => {
    const frame = playbackFrames[frameIndex];
    activeFrame = frame;
    lastState = frame.state;
    renderBoards(frame.state);
    renderCosts(frame.state);
    renderLog(lastBattleLog.entries, frame.logIndex);
    renderSelectedCard(frame.state);
    if (frame.text) {
      els.phaseSummary.textContent = uiText(frame.text);
    }
    els.turnCount.textContent = `${frame.state.turn}T`;
    frameIndex += 1;

    if (frameIndex < playbackFrames.length) {
      replayTimer = globalThis.setTimeout(step, replayDelay(frame));
      return;
    }

    replayTimer = globalThis.setTimeout(() => {
      activeFrame = null;
      lastState = lastBattleLog.finalState;
      renderBoards(lastBattleLog.finalState);
      renderCosts(lastBattleLog.finalState);
      renderLog(lastBattleLog.entries);
      els.winnerSummary.textContent = resultLabel(lastBattleLog.result);
      els.phaseSummary.textContent = uiText(summarizeBattle(lastBattleLog.finalState, lastBattleLog.result));
      els.turnCount.textContent = `${lastBattleLog.finalState.turn}T`;
      els.playReplay.disabled = false;
      els.playReplay.textContent = "リプレイ再生";
      renderSelectedCard(lastBattleLog.finalState);
    }, replayDelay({ type: "finish" }));
  };

  step();
}

function replayFramesForPlayback(frames) {
  return frames.flatMap((frame) => expandReplayFrame(frame));
}

function expandReplayFrame(frame) {
  const setupState = frame.beforeState || frame.state;
  if (frame.type === "attack") {
    return [
      {
        ...frame,
        phase: "windup",
        state: setupState,
        rangeCells: [],
        attackEvents: [],
        targetId: null,
        damage: 0,
      },
      {
        ...frame,
        phase: "range",
        state: setupState,
        attackEvents: [],
        targetId: null,
        damage: 0,
      },
      {
        ...frame,
        phase: "effect",
        rangeCells: [],
      },
    ];
  }
  if (["heal", "buff"].includes(frame.type) && frame.sourceId) {
    return [
      {
        ...frame,
        phase: "windup",
        healEvents: [],
        buffEvents: [],
        targetId: null,
        amount: 0,
      },
      {
        ...frame,
        phase: "effect",
      },
    ];
  }
  return [{ ...frame, phase: "instant" }];
}

function replayDelay(frame) {
  let baseDelay = frame.type === "attack" ? 2000 : ["heal", "buff"].includes(frame.type) ? 1900 : frame.type === "turn" ? 520 : frame.type === "finish" ? 420 : 340;
  if (frame.phase === "windup") baseDelay = frame.type === "attack" ? 200 : 1000;
  if (frame.phase === "range") baseDelay = 900;
  if (frame.phase === "effect") baseDelay = 900;
  const speed = Number(setup.replaySpeed) || 1;
  return Math.round(baseDelay / speed);
}

function stopReplay(resetButton = true) {
  if (replayTimer) {
    globalThis.clearTimeout(replayTimer);
    replayTimer = null;
  }
  activeFrame = null;
  if (resetButton && els.playReplay) {
    els.playReplay.disabled = !lastBattleLog;
    els.playReplay.textContent = "リプレイ再生";
  }
}

function createBattleState(options = {}) {
  const playerPreset = battlePresetFor("player", options);
  const enemyPreset = battlePresetFor("enemy", options);
  const playerTerrain = cloneTerrain(options.playerTerrain || setup.playerTerrain);
  const enemyTerrain = cloneTerrain(options.enemyTerrain || setup.enemyTerrain);
  const units = [
    ...createUnits("player", playerPreset, playerTerrain),
    ...createUnits("enemy", enemyPreset, enemyTerrain),
  ];
  const state = {
    turn: 0,
    units,
    terrain: {
      player: playerTerrain,
      enemy: enemyTerrain,
    },
    flags: {
      playerFirstSnipe: false,
      enemyFirstSnipe: false,
      playerFirstFallHeal: false,
      enemyFirstFallHeal: false,
      playerFallbackWard: false,
      enemyFallbackWard: false,
      playerFinishSignal: false,
      enemyFinishSignal: false,
    },
  };
  state.metrics = createBattleMetrics(state, { player: playerPreset, enemy: enemyPreset });
  recordAlphaExposureStates(state);
  return state;
}

function createUnits(side, preset, terrainGrid) {
  return legalFormationUnits(preset.units).map(([cardId, row, col], index) => {
    const card = cards[cardId];
    if (!isCardAvailable(card)) throw new Error(`Unavailable card in ${ACTIVE_RULESET_PHASE}: ${cardId}`);
    const terrain = terrainTypes[terrainGrid[row][col]];
    if (!isRulesetEntryAvailable(terrain)) throw new Error(`Unavailable terrain in ${ACTIVE_RULESET_PHASE}: ${terrainGrid[row][col]}`);
    const general = cardId === preset.general;
    let maxHp = card.hp + (general ? Math.ceil(card.hp * 0.2) : 0);
    if (card.abilityKey === "seaHp" && terrainGrid[row][col] === "sea") {
      maxHp += 6;
    }
    return {
      id: `${side}-${index}-${cardId}`,
      side,
      cardId,
      card,
      row,
      col,
      hp: maxHp,
      maxHp,
      general,
      tempAt: 0,
      tempAg: 0,
      armorEffects: [],
      statEffects: [],
      statusEffects: [],
      ultimateCharge: 0,
      firstHitReduced: false,
      movedFromRear: false,
      terrain: terrain.name,
    };
  });
}

function createBattleMetrics(state, sidePresets) {
  return {
    turns: 0,
    result: null,
    sides: {
      player: createSideBattleMetrics(state, "player", sidePresets.player),
      enemy: createSideBattleMetrics(state, "enemy", sidePresets.enemy),
    },
    tieBreaks: {
      total: 0,
      rarity: 0,
      simultaneous: 0,
      position: 0,
      playerWins: 0,
      enemyWins: 0,
    },
  };
}

function createSideBattleMetrics(state, side, preset) {
  const sideUnits = state.units.filter((unit) => unit.side === side);
  const keyCardIds = presetKeyCardIds(preset, sideUnits);
  return {
    presetId: preset.id,
    presetName: preset.name,
    keyCardIds,
    keyCardNames: keyCardIds.map((cardId) => cards[cardId]?.name || cardId),
    keyUnitIds: sideUnits.filter((unit) => keyCardIds.includes(unit.cardId)).map((unit) => unit.id),
    actions: 0,
    ultimates: 0,
    keyActions: 0,
    keyUltimates: 0,
    searchActions: 0,
    areaActions: 0,
    backlineAccessActions: 0,
    ultimateChargeBoost: 0,
    damageDealt: 0,
    alphaDamageDealt: 0,
    healing: 0,
    healingBlocked: 0,
    armorGranted: 0,
    armorTurnValue: 0,
    damagePrevented: 0,
    kos: 0,
    keyKoTurn: null,
    keySurvivalTurns: 0,
    alphaExposedTurn: null,
    alphaDefeatTurn: null,
    statuses: {
      poison: 0,
      healBlock: 0,
      defenseDown: 0,
      contactPoison: 0,
      reflectShell: 0,
    },
    units: Object.fromEntries(sideUnits.map((unit) => [unit.id, {
      cardId: unit.cardId,
      cardName: unit.card.name,
      isKey: keyCardIds.includes(unit.cardId),
      actions: 0,
      ultimates: 0,
      lastAliveTurn: 0,
      koTurn: null,
      actionsBeforeFirstKo: null,
    }])),
  };
}

function presetKeyCardIds(preset, sideUnits) {
  const presentCardIds = new Set(sideUnits.map((unit) => unit.cardId));
  const configured = Array.isArray(preset.keyCards)
    ? preset.keyCards.filter((cardId) => presentCardIds.has(cardId))
    : [];
  if (configured.length > 0) return configured;
  if (preset.general && presentCardIds.has(preset.general)) return [preset.general];
  return sideUnits[0] ? [sideUnits[0].cardId] : [];
}

function recordLivingMetrics(state) {
  if (!state.metrics) return;
  allLiving(state).forEach((unit) => {
    const record = metricUnitRecord(state, unit);
    if (record) record.lastAliveTurn = Math.max(record.lastAliveTurn, state.turn);
  });
}

function metricUnitRecord(state, unit) {
  return state.metrics?.sides[unit.side]?.units[unit.id] || null;
}

function metricSideRecord(state, side) {
  return state.metrics?.sides[side] || null;
}

function recordActionMetric(state, unit, actionKey) {
  const side = metricSideRecord(state, unit.side);
  const record = metricUnitRecord(state, unit);
  if (!side || !record) return;
  side.actions += 1;
  record.actions += 1;
  if (record.isKey) side.keyActions += 1;
  const effectIds = actionEffectElementIds(actionKey);
  const targetIds = actionTargetPatternIds(actionKey);
  if (effectIds.includes("searchAttack")) side.searchActions += 1;
  if (effectIds.includes("areaAttack")) side.areaActions += 1;
  if (targetIds.some((targetId) => targetPatternHitsBackline(targetId))) side.backlineAccessActions += 1;
}

function targetPatternHitsBackline(targetPatternId) {
  const pattern = TARGET_PATTERNS[targetPatternId];
  return pattern?.side === "enemy" && (pattern.depthAccess || []).some((depth) => depth >= 1);
}

function recordUltimateMetric(state, unit) {
  const side = metricSideRecord(state, unit.side);
  const record = metricUnitRecord(state, unit);
  if (!side || !record) return;
  side.ultimates += 1;
  record.ultimates += 1;
  if (record.isKey) side.keyUltimates += 1;
}

function recordUltimateChargeBoostMetric(state, unit, amount) {
  const side = metricSideRecord(state, unit.side);
  if (side) side.ultimateChargeBoost += amount;
}

function recordDamageMetric(state, source, target, damage) {
  const sourceSide = typeof source === "string" ? source : source?.side;
  const side = sourceSide ? metricSideRecord(state, sourceSide) : null;
  if (!side || damage <= 0) return;
  side.damageDealt += damage;
  if (target.general) side.alphaDamageDealt += damage;
}

function recordDamagePreventedMetric(state, target, amount) {
  const side = metricSideRecord(state, target.side);
  if (side && amount > 0) side.damagePrevented += amount;
}

function recordHealMetric(state, target, amount, blocked = false) {
  const side = metricSideRecord(state, target.side);
  if (!side || amount <= 0) return;
  if (blocked) {
    side.healingBlocked += amount;
  } else {
    side.healing += amount;
  }
}

function recordArmorMetric(state, target, amount, durationTurns) {
  const side = metricSideRecord(state, target.side);
  if (!side || amount <= 0) return;
  side.armorGranted += amount;
  side.armorTurnValue += amount * durationTurns;
}

function recordStatusAppliedMetric(state, source, statusKey, count) {
  const side = metricSideRecord(state, source.side);
  if (!side || count <= 0) return;
  side.statuses[statusKey] = (side.statuses[statusKey] || 0) + count;
}

function recordKoMetric(state, target, sourceSide = null) {
  const record = metricUnitRecord(state, target);
  const firstKo = !record || record.koTurn === null;
  const source = sourceSide ? metricSideRecord(state, sourceSide) : null;
  if (source && firstKo) source.kos += 1;
  const targetSide = metricSideRecord(state, target.side);
  if (record && record.koTurn === null) {
    record.koTurn = state.turn;
    // Same-AG guaranteed actions are already counted before either side's effects.
    record.actionsBeforeFirstKo = record.actions + record.ultimates;
  }
  if (targetSide && record?.isKey && targetSide.keyKoTurn === null) targetSide.keyKoTurn = state.turn;
  if (targetSide && target.general && targetSide.alphaDefeatTurn === null) targetSide.alphaDefeatTurn = state.turn;
}

function recordAlphaExposureStates(state) {
  if (!state.metrics) return;
  ["player", "enemy"].forEach((side) => {
    const general = generalOf(state, side);
    const sideMetrics = metricSideRecord(state, side);
    if (sideMetrics && sideMetrics.alphaExposedTurn === null && isGeneralExposed(state, general)) {
      sideMetrics.alphaExposedTurn = state.turn;
    }
  });
}

function recordTieBreakMetric(state, topCandidates, tiePriority, simultaneousUnits, priorityFirst) {
  if (!state.metrics || topCandidates.length < 2) return;
  const tie = state.metrics.tieBreaks;
  tie.total += 1;
  const simultaneous = simultaneousUnits.length >= 2 && new Set(simultaneousUnits.map((unit) => unit.side)).size >= 2;
  if (tiePriority.cellCandidates.length < topCandidates.length) {
    tie.position += 1;
  } else if (tiePriority.rarityCandidates.length < tiePriority.cellCandidates.length) {
    tie.rarity += 1;
  } else if (simultaneous) {
    tie.simultaneous += 1;
  } else {
    tie.position += 1;
  }
  if (!simultaneous && priorityFirst?.side) {
    tie[`${priorityFirst.side}Wins`] += 1;
  }
}

function finalizeBattleMetrics(state, result, turns) {
  if (!state.metrics) return null;
  recordLivingMetrics(state);
  recordAlphaExposureStates(state);
  state.metrics.result = result;
  state.metrics.turns = turns;
  ["player", "enemy"].forEach((side) => finalizeSideBattleMetrics(state.metrics.sides[side]));
  return state.metrics;
}

function finalizeSideBattleMetrics(sideMetrics) {
  const keyRecords = sideMetrics.keyUnitIds
    .map((unitId) => sideMetrics.units[unitId])
    .filter(Boolean);
  sideMetrics.keySurvivalTurns = keyRecords.length
    ? average(keyRecords.map((record) => record.lastAliveTurn))
    : 0;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function legalFormationUnits(units) {
  return units.filter(([, row, col]) => isLegalInitialSlot(units, row, col));
}

function isLegalInitialSlot(units, row, col) {
  for (let frontCol = 0; frontCol < col; frontCol += 1) {
    const hasFrontUnit = units.some(([, unitRow, unitCol]) => unitRow === row && unitCol === frontCol);
    if (!hasFrontUnit) return false;
  }
  return true;
}

function applyGeneralSkills(state, log, phase) {
  ["player", "enemy"].forEach((side) => {
    const general = generalOf(state, side);
    if (!general || general.hp <= 0) return;
    const key = general.card.generalKey;
    if (phase === "battleStart") {
      if (key === "frontArmor") {
        const targets = living(state, side).filter((unit) => unit.col === 0);
        const buffEvents = targets.map((unit) => {
          grantArmor(state, unit, FRONT_ARMOR, STANDARD_ARMOR_DURATION);
          return { targetId: unit.id, armor: FRONT_ARMOR, duration: STANDARD_ARMOR_DURATION };
        });
        if (buffEvents.length > 0) {
          log.push(`${unitLabel(general)} のα特性: ${buffTargetSummary(targets)} に装甲+${FRONT_ARMOR}/${STANDARD_ARMOR_DURATION}T`);
          recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} のα特性`);
        }
      }
      if (key === "harborWall") {
        const targets = living(state, side).filter((unit) => ["海", "殻壁"].includes(terrainName(state, unit)));
        const buffEvents = targets.map((unit) => {
          grantArmor(state, unit, HARBOR_WALL_ARMOR, STANDARD_ARMOR_DURATION);
          return { targetId: unit.id, armor: HARBOR_WALL_ARMOR, duration: STANDARD_ARMOR_DURATION };
        });
        if (buffEvents.length > 0) {
          log.push(`${unitLabel(general)} のα特性: ${buffTargetSummary(targets)} に装甲+${HARBOR_WALL_ARMOR}/${STANDARD_ARMOR_DURATION}T`);
          recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} のα特性`);
        }
      }
      if (key === "midAg") {
        const targets = living(state, side).filter((unit) => unit.col === 1);
        const buffEvents = targets.map((unit) => {
          grantStatBuff(state, unit, "ag", 6, COMMAND_DURATION);
          return { targetId: unit.id, ag: 6, duration: COMMAND_DURATION };
        });
        if (buffEvents.length > 0) {
          log.push(`${unitLabel(general)} のα特性: ${buffTargetSummary(targets)} にAG+6/${COMMAND_DURATION}T`);
          recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} のα特性`);
        }
      }
      if (key === "scoutLead") {
        const targets = living(state, side).filter((unit) => unit.card.tags.includes("scout"));
        const buffEvents = targets.map((unit) => {
          grantStatBuff(state, unit, "ag", SCOUT_LEAD_AG, COMMAND_DURATION);
          return { targetId: unit.id, ag: SCOUT_LEAD_AG, duration: COMMAND_DURATION };
        });
        if (buffEvents.length > 0) {
          log.push(`${unitLabel(general)} のα特性: ${buffTargetSummary(targets)} にAG+${SCOUT_LEAD_AG}/${COMMAND_DURATION}T`);
          recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} のα特性`);
        }
      }
      if (key === "allOutOrder") {
        const targets = living(state, side);
        const buffEvents = targets.map((unit) => {
          grantStatBuff(state, unit, "at", ALL_ORDER_AT, ALL_ORDER_DURATION);
          grantStatBuff(state, unit, "ag", ALL_ORDER_AG, ALL_ORDER_DURATION);
          return { targetId: unit.id, at: ALL_ORDER_AT, ag: ALL_ORDER_AG, duration: ALL_ORDER_DURATION };
        });
        if (buffEvents.length > 0) {
          log.push(`${unitLabel(general)} のα特性: ${buffTargetSummary(targets)} にAT+${ALL_ORDER_AT}/AG+${ALL_ORDER_AG}/${ALL_ORDER_DURATION}T`);
          recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} のα特性`);
        }
      }
    }
    if (phase === "battleStartAction" && key === "openingBarrage") {
      const frontCount = living(state, opposite(side)).filter((unit) => unit.col === 0).length;
      if (frontCount >= OPENING_BARRAGE_MIN_FRONT) {
        const targets = enemies(state, side).filter((enemy) => enemy.col === 0);
        if (targets.length === 0) return;
        const damage = Math.max(4, unitStats(state, general).at - OPENING_BARRAGE_OFFSET);
        log.push(`${unitLabel(general)} のα特性: 開幕掃射`);
        dealDamageGroup(state, general, targets.map((target) => ({ target, rawDamage: damage })), "開幕掃射", log);
      }
    }
    if (phase === "turnStart" && key === "turnThreeCharge" && state.turn === 3) {
      const targets = living(state, side).filter((unit) => unit.col === 0);
      const buffEvents = targets.map((unit) => {
        grantStatBuff(state, unit, "at", TURN_THREE_CHARGE_AT, TURN_THREE_CHARGE_DURATION);
        return { targetId: unit.id, at: TURN_THREE_CHARGE_AT, duration: TURN_THREE_CHARGE_DURATION };
      });
      if (buffEvents.length > 0) {
        log.push(`${unitLabel(general)} のα特性: ${buffTargetSummary(targets)} にAT+${TURN_THREE_CHARGE_AT}/${TURN_THREE_CHARGE_DURATION}T`);
        recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} のα特性`);
      }
    }
  });
}

function applyTerrainTurnStart(state, log) {
  allLiving(state).forEach((unit) => {
    const terrainId = state.terrain[unit.side][unit.row][unit.col];
    const terrain = terrainTypes[terrainId];
    if (terrain.onTurnStart) terrain.onTurnStart(state, unit, log);
  });
}

function applyStatusTurnStart(state, log) {
  allLiving(state).forEach((unit) => {
    const poison = activeStatusEffect(state, unit, "poison");
    if (!poison) return;
    const poisonDamage = STATUS_EFFECTS.poison.damage;
    const actualDamage = Math.min(unit.hp, poisonDamage);
    unit.hp = Math.max(0, unit.hp - poisonDamage);
    recordDamageMetric(state, poison.sourceSide, unit, actualDamage);
    log.push(`${unitLabel(unit)} は毒で${poisonDamage}ダメージ`);
    recordFrame(log, state, {
      type: "attack",
      targetId: unit.id,
      damage: poisonDamage,
      attackEvents: [{ targetId: unit.id, damage: poisonDamage }],
      text: `${unit.card.name} 毒ダメージ`,
    });
    if (unit.hp === 0) {
      log.push(`${unitLabel(unit)} が戦闘不能`);
      recordKoMetric(state, unit, poison.sourceSide);
      recordFrame(log, state, { type: "ko", targetId: unit.id, koEvents: [{ targetId: unit.id }], text: `${unit.card.name} 戦闘不能` });
      applyFallTriggers(state, unit, log);
    }
  });
}

function resetTurnFlags(state) {
  expireArmorEffects(state);
  expireStatEffects(state);
  expireStatusEffects(state);
  allLiving(state).forEach((unit) => {
    unit.firstHitReduced = false;
  });
}

function chargeUltimates(state) {
  allLiving(state).forEach((unit) => {
    if (!unit.card.ultimate) return;
    const limit = unit.card.ultimate.turns;
    unit.ultimateCharge = Math.min(limit, (unit.ultimateCharge || 0) + 1);
  });
}

function nextActingBatch(state, actedIds) {
  const candidates = allLiving(state)
    .filter((unit) => !actedIds.has(unit.id))
    .map((unit) => ({ unit, ag: unitStats(state, unit).ag }));
  if (candidates.length === 0) return null;
  const topAg = Math.max(...candidates.map((candidate) => candidate.ag));
  const topCandidates = candidates.filter((candidate) => candidate.ag === topAg);
  const tiePriority = sameAgTiePriorityCandidates(topCandidates);
  const priorityUnits = tiePriority.candidates.map((candidate) => candidate.unit);
  const priorityFirst = priorityUnits[0];
  const simultaneousUnits = priorityUnits.length >= 2 && new Set(priorityUnits.map((unit) => unit.side)).size >= 2
    ? priorityUnits
    : [];
  recordTieBreakMetric(state, topCandidates, tiePriority, simultaneousUnits, priorityFirst);
  if (simultaneousUnits.length >= 2) {
    return { simultaneous: true, units: simultaneousUnits, ag: topAg };
  }
  return { simultaneous: false, units: [priorityFirst], ag: topAg };
}

function sameAgTiePriorityCandidates(candidates) {
  const bestCell = Math.min(...candidates.map((candidate) => sameAgCellTiePriority(candidate.unit)));
  const cellCandidates = candidates.filter((candidate) => sameAgCellTiePriority(candidate.unit) === bestCell);
  const maxRarity = Math.max(...cellCandidates.map((candidate) => rarityTiePriority(candidate.unit)));
  const rarityCandidates = cellCandidates.filter((candidate) => rarityTiePriority(candidate.unit) === maxRarity);
  return {
    cellCandidates,
    rarityCandidates,
    candidates: rarityCandidates.sort((a, b) => sameAgCellTiePriority(a.unit) - sameAgCellTiePriority(b.unit) || boardPriority(a.unit) - boardPriority(b.unit)),
  };
}

function sameAgCellTiePriority(unit) {
  return unit.col * 3 + (SAME_AG_LANE_PRIORITY[unit.row] ?? unit.row);
}

function sameAgCellPriorityLabel(unit) {
  return SAME_AG_CELL_PRIORITY_LABELS[sameAgCellTiePriority(unit)] || `${TERMS.rankShort[unit.col]}${TERMS.laneShort[unit.row]}`;
}

function executeActionBatch(state, batch, log) {
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
      segments: sameAgActionSegments(actionKey),
      scratch: {},
      koActionLogged: false,
    };
  });

  recordSameAgBatchStart(state, batch, entries, log);
  entries.forEach((entry) => {
    if (isUltimateActionKey(entry.actionKey)) {
      recordUltimateMetric(state, entry.unit);
      log.push(`${unitLabel(entry.unit)} の必殺技: ${entry.unit.card.ultimate.name}`);
      entry.unit.ultimateCharge = 0;
    } else {
      recordActionMetric(state, entry.unit, entry.actionKey);
    }
  });

  for (let segmentIndex = 0; segmentIndex < 2; segmentIndex += 1) {
    const stageQueue = [];
    runSameAgLayer(state, entries, segmentIndex, "defense", log, stageQueue);
    runSameAgLayer(state, entries, segmentIndex, "attack", log, stageQueue);
    runSameAgLayer(state, entries, segmentIndex, "heal", log, stageQueue);
    runSameAgStageQueue(state, entries, segmentIndex, log, stageQueue);
  }
}

function recordSameAgBatchStart(state, batch, entries, log) {
  const cell = entries[0] ? sameAgCellPriorityLabel(entries[0].unit) : "";
  const labels = entries.map((entry) => `${unitLabel(entry.unit)}:${actionDisplayName(entry.actionKey, entry.unit)}`).join(" / ");
  log.push(`同AGバッチ${batch.ag != null ? ` AG${batch.ag}` : ""}${cell ? ` ${cell}` : ""}: ${labels}`);
  recordFrame(log, state, { type: "turn", text: `同AGバッチ ${cell}` });
}

function sameAgActionBaseKey(actionKey) {
  return isUltimateActionKey(actionKey) ? String(actionKey).slice("ultimate:".length) : actionKey;
}

function actionDisplayName(actionKey, unit = null) {
  if (isUltimateActionKey(actionKey)) {
    const key = sameAgActionBaseKey(actionKey);
    return unit?.card.ultimate?.name ? `必殺:${unit.card.ultimate.name}` : `必殺:${key}`;
  }
  return actions[actionKey]?.name || actionKey;
}

function sameAgActionSegments(actionKey) {
  const key = sameAgActionBaseKey(actionKey);
  const ultimate = isUltimateActionKey(actionKey);
  const segment = (...operations) => operations.filter(Boolean);
  const defense = (kind) => ({ layer: "defense", kind });
  const attack = (kind) => ({ layer: "attack", kind });
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

function runSameAgLayer(state, entries, segmentIndex, layer, log, stageQueue) {
  entries.forEach((entry) => {
    const operations = (entry.segments[segmentIndex] || []).filter((operation) => operation.layer === layer);
    operations.forEach((operation) => runSameAgOperation(state, entry, operation, log, stageQueue));
  });
}

function runSameAgOperation(state, entry, operation, log, stageQueue) {
  noteSameAgActionAfterKo(entry, log);
  if (operation.layer === "defense") return runSameAgDefenseOperation(state, entry, operation.kind, log);
  if (operation.layer === "attack") return runSameAgAttackOperation(state, entry, operation.kind, log, stageQueue);
  if (operation.layer === "heal") return runSameAgHealOperation(state, entry, operation.kind, log);
  if (operation.layer === "stage") {
    stageQueue.push({ entry, kind: operation.kind });
    return null;
  }
  return null;
}

function noteSameAgActionAfterKo(entry, log) {
  if (entry.unit.hp > 0 || entry.koActionLogged) return;
  entry.koActionLogged = true;
  log.push(`${unitLabel(entry.unit)} は戦闘不能だが、同AGバッチの決定済み行動を続行`);
}

function runSameAgDefenseOperation(state, entry, kind, log) {
  const unit = entry.unit;
  switch (kind) {
    case "guardProtection": return executeGuardProtection(state, unit, log);
    case "shellBind": return executeShellBind(state, unit, log);
    case "generalWardArmor": return sameAgGeneralWardArmor(state, unit, log);
    case "thornGuard": return sameAgThornGuard(state, unit, log);
    case "mirrorShell": return sameAgMirrorShell(state, unit, log);
    case "ultimate:frontBulwark": return ultimateActions.frontBulwark.execute(state, unit, log);
    case "ultimate:teamBarrier": return ultimateActions.teamBarrier.execute(state, unit, log);
    case "ultimate:alphaShellArmor": return sameAgAlphaShellArmor(state, unit, log);
    default: return null;
  }
}

function runSameAgAttackOperation(state, entry, kind, log, stageQueue) {
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
    case "acidBite": return sameAgAttackWithStatus(state, entry, "acidBite", "healBlock", HEAL_BLOCK_DURATION, log, stageQueue);
    case "acidSweepDefense": return sameAgAttackWithStatus(state, entry, "acidSweepDefense", "defenseDown", DEFENSE_DOWN_DURATION, log, stageQueue);
    case "acidSweepHealBlock": return sameAgAttackWithStatus(state, entry, "acidSweepHealBlock", "healBlock", HEAL_BLOCK_DURATION, log, stageQueue);
    case "drainStrike": return sameAgDrainStrikeAttack(state, entry, log);
    case "barrierPierceStrike": return actions.barrierPierceStrike.execute(state, unit, log);
    case "midRearPressure": return actions.midRearPressure.execute(state, unit, log);
    case "sporeCrush": return actions.sporeCrush.execute(state, unit, log);
    case "sporeBarrage": return sameAgAttackWithStatus(state, entry, "sporeBarrage", "poison", POISON_DURATION, log, stageQueue);
    case "ultimate:alphaClaw": return ultimateActions.alphaClaw.execute(state, unit, log);
    case "ultimate:rearExecution": return ultimateActions.rearExecution.execute(state, unit, log);
    case "ultimate:lineCrush": return ultimateActions.lineCrush.execute(state, unit, log);
    case "ultimate:wideScorch": return ultimateActions.wideScorch.execute(state, unit, log);
    case "ultimate:toxicBloom": return sameAgToxicBloomAttack(state, entry, log, stageQueue);
    default: return null;
  }
}

function runSameAgHealOperation(state, entry, kind, log) {
  const unit = entry.unit;
  switch (kind) {
    case "healPrayer": return executeHealPrayer(state, unit, log);
    case "lineHeal": return actions.lineHeal.execute(state, unit, log);
    case "generalWardHeal": return sameAgGeneralWardHeal(state, unit, log);
    case "drainStrikeHeal": return sameAgDrainStrikeHeal(state, entry, log);
    case "ultimate:teamHeal": return executeTeamHealUltimate(state, unit, Math.max(8, Math.floor(unitStats(state, unit).at * 0.55)), log);
    case "ultimate:deepTeamHeal": return executeTeamHealUltimate(state, unit, Math.max(12, Math.floor(unitStats(state, unit).at * 0.75)), log);
    case "ultimate:alphaShellHeal": return sameAgAlphaShellHeal(state, unit, log);
    default: return null;
  }
}

function runSameAgStageQueue(state, entries, segmentIndex, log, stageQueue) {
  const queue = [...stageQueue];
  entries.forEach((entry) => {
    (entry.segments[segmentIndex] || [])
      .filter((operation) => operation.layer === "stage")
      .forEach((operation) => queue.push({ entry, kind: operation.kind }));
  });

  queue
    .filter((item) => sameAgStageKindGroup(item.kind) === "status")
    .sort((a, b) => sameAgStatusKindOrder(a.kind) - sameAgStatusKindOrder(b.kind))
    .forEach((item) => runSameAgStageOperation(state, item.entry, item.kind, log));

  queue
    .filter((item) => sameAgStageKindGroup(item.kind) === "stat")
    .sort((a, b) => sameAgStatKindOrder(a.kind) - sameAgStatKindOrder(b.kind))
    .forEach((item) => runSameAgStageOperation(state, item.entry, item.kind, log));

  runSameAgGaugeStageOperations(state, queue.filter((item) => sameAgStageKindGroup(item.kind) === "gauge"), log);

  queue
    .filter((item) => sameAgStageKindGroup(item.kind) === "other")
    .forEach((item) => runSameAgStageOperation(state, item.entry, item.kind, log));
}

function sameAgStageKindGroup(kind) {
  if (["acidBiteStatus", "acidSweepDefenseStatus", "acidSweepHealBlockStatus", "sporeBarrageStatus", "ultimate:toxicBloomStatus", "healBlockPulse", "toxicNeedle", "toxicCloud"].includes(kind)) return "status";
  if (["rally", "command", "selfAg", "agSnare", "ultimate:synapticSurge"].includes(kind)) return "stat";
  if (["quickenUltimate", "selfUltimateCharge"].includes(kind)) return "gauge";
  return "other";
}

function sameAgStatusKindOrder(kind) {
  return STAGE_END_STATUS_FAMILY_ORDER[STAGE_END_STATUS_FAMILY[sameAgStatusKeyForStageKind(kind)] || "marker"];
}

function sameAgStatusKeyForStageKind(kind) {
  if (kind === "acidSweepDefenseStatus") return "defenseDown";
  if (kind === "acidBiteStatus" || kind === "acidSweepHealBlockStatus" || kind === "healBlockPulse") return "healBlock";
  if (kind === "sporeBarrageStatus" || kind === "ultimate:toxicBloomStatus" || kind === "toxicNeedle" || kind === "toxicCloud") return "poison";
  return kind;
}

function sameAgStatKindOrder(kind) {
  if (kind === "rally" || kind === "command" || kind === "ultimate:synapticSurge") return 0;
  if (kind === "selfAg" || kind === "agSnare") return 1;
  return 2;
}

function runSameAgStageOperation(state, entry, kind, log) {
  const unit = entry.unit;
  noteSameAgActionAfterKo(entry, log);
  switch (kind) {
    case "acidBiteStatus":
    case "acidSweepDefenseStatus":
    case "acidSweepHealBlockStatus":
    case "sporeBarrageStatus":
    case "ultimate:toxicBloomStatus":
      return sameAgApplyQueuedDamageStatus(state, entry, kind, log);
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
    case "fallbackWholeAction": return actions[actionFor(unit)]?.execute(state, unit, log);
    case "fallbackWholeUltimate": return ultimateActions[unit.card.ultimate?.key]?.execute(state, unit, log);
    default: return null;
  }
}

function runSameAgGaugeStageOperations(state, gaugeOperations, log) {
  const grouped = new Map();
  gaugeOperations.forEach((item) => {
    sameAgGaugeTargets(state, item.entry, item.kind).forEach((target) => {
      if (!grouped.has(target.id)) grouped.set(target.id, { target, amount: 0, sources: [] });
      grouped.get(target.id).amount += ULTIMATE_CHARGE_AMOUNT;
      grouped.get(target.id).sources.push(item.entry.unit);
    });
  });
  [...grouped.values()].forEach((item) => {
    chargeUltimateGauge(state, item.target, item.amount);
    const sourceNames = item.sources.map((source) => unitLabel(source)).join("/");
    log.push(`${sourceNames} の時流: ${unitLabel(item.target)} の必殺技を${item.amount}T短縮`);
    recordFrame(log, state, {
      type: "buff",
      sourceId: item.sources[0].id,
      targetId: item.target.id,
      text: `${item.target.card.name} 必殺技短縮`,
    });
  });
}

function sameAgGaugeTargets(state, entry, kind) {
  const unit = entry.unit;
  if (kind === "selfUltimateCharge") return unit.card.ultimate ? [unit] : [];
  if (kind === "quickenUltimate") {
    return living(state, unit.side)
      .filter((ally) => ally.row === unit.row && ally.id !== unit.id && ally.card.ultimate);
  }
  return [];
}

function sameAgGeneralWardArmor(state, unit, log) {
  const target = generalOf(state, unit.side);
  if (!target || target.hp <= 0) return logNoTarget(unit, log);
  const armor = generalWardArmorFor(unit);
  grantArmor(state, target, armor, GENERAL_WARD_DURATION);
  log.push(`${unitLabel(unit)} の献身: ${unitLabel(target)} に装甲+${armor}/${GENERAL_WARD_DURATION}T`);
  recordBuffFrame(log, state, unit, target, { armor, duration: GENERAL_WARD_DURATION }, `${unit.card.name} の献身`);
}

function sameAgGeneralWardHeal(state, unit, log) {
  const target = generalOf(state, unit.side);
  if (!target || target.hp <= 0) return logNoTarget(unit, log);
  const amount = generalWardHealFor(state, unit);
  const healed = heal(state, target, amount);
  log.push(`${unitLabel(unit)} の献身: ${unitLabel(target)} が${healed}回復`);
  if (healed > 0) {
    recordFrame(log, state, { type: "heal", sourceId: unit.id, targetId: target.id, amount: healed, healEvents: [{ targetId: target.id, amount: healed }], text: `${unit.card.name} の献身` });
  }
}

function sameAgThornGuard(state, unit, log) {
  grantArmor(state, unit, THORN_GUARD_ARMOR, STANDARD_ARMOR_DURATION);
  grantStatusEffect(state, unit, "contactPoison", CONTACT_POISON_DURATION, unit);
  recordStatusAppliedMetric(state, unit, "contactPoison", 1);
  log.push(`${unitLabel(unit)} の棘構え: 自身に装甲+${THORN_GUARD_ARMOR}/${STANDARD_ARMOR_DURATION}T、接触毒/${CONTACT_POISON_DURATION}T`);
  recordFrame(log, state, {
    type: "buff",
    sourceId: unit.id,
    targetId: unit.id,
    buffEvents: [{ targetId: unit.id, armor: THORN_GUARD_ARMOR, duration: STANDARD_ARMOR_DURATION, statusKey: "contactPoison" }],
    text: `${unit.card.name} の棘構え`,
  });
}

function sameAgMirrorShell(state, unit, log) {
  grantArmor(state, unit, MIRROR_SHELL_ARMOR, STANDARD_ARMOR_DURATION);
  grantStatusEffect(state, unit, "reflectShell", REFLECT_SHELL_DURATION, unit);
  recordStatusAppliedMetric(state, unit, "reflectShell", 1);
  log.push(`${unitLabel(unit)} の鏡殻: 自身に装甲+${MIRROR_SHELL_ARMOR}/${STANDARD_ARMOR_DURATION}T、反射殻/${REFLECT_SHELL_DURATION}T`);
  recordFrame(log, state, {
    type: "buff",
    sourceId: unit.id,
    targetId: unit.id,
    buffEvents: [{ targetId: unit.id, armor: MIRROR_SHELL_ARMOR, duration: STANDARD_ARMOR_DURATION, statusKey: "reflectShell" }],
    text: `${unit.card.name} の鏡殻`,
  });
}

function sameAgAlphaShellArmor(state, unit, log) {
  const target = generalOf(state, unit.side);
  if (!target || target.hp <= 0) return logNoTarget(unit, log);
  const armor = 26;
  grantArmor(state, target, armor, STANDARD_ARMOR_DURATION);
  log.push(`${unitLabel(unit)} の${unit.card.ultimate.name}: ${unitLabel(target)} に装甲+${armor}/${STANDARD_ARMOR_DURATION}T`);
  recordBuffFrame(log, state, unit, target, { armor, duration: STANDARD_ARMOR_DURATION }, `${unit.card.name} の${unit.card.ultimate.name}`);
}

function sameAgAlphaShellHeal(state, unit, log) {
  const target = generalOf(state, unit.side);
  if (!target || target.hp <= 0) return logNoTarget(unit, log);
  const amount = Math.max(10, Math.floor(unitStats(state, unit).at * 0.55));
  const healed = heal(state, target, amount);
  log.push(`${unitLabel(unit)} の${unit.card.ultimate.name}: ${unitLabel(target)} が${healed}回復`);
  if (healed > 0) {
    recordFrame(log, state, { type: "heal", sourceId: unit.id, targetId: target.id, amount: healed, healEvents: [{ targetId: target.id, amount: healed }], text: `${unit.card.name} の${unit.card.ultimate.name}` });
  }
}

function sameAgAttackWithStatus(state, entry, kind, statusKey, duration, log, stageQueue) {
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
  entry.scratch[`${kind}Events`] = events || [];
  stageQueue.push({ entry, kind: `${kind}Status`, statusKey, duration });
  return events;
}

function sameAgDrainStrikeAttack(state, entry, log) {
  const unit = entry.unit;
  const target = findMostArmoredTarget(state, unit) || findFrontTarget(state, unit);
  if (!target) return logNoTarget(unit, log);
  const events = dealDamageGroup(state, unit, [{ target, rawDamage: Math.max(5, unitStats(state, unit).at - DRAIN_DAMAGE_OFFSET) }], "貫殻吸血", log);
  entry.scratch.drainStrikeDamage = events?.[0]?.damage || 0;
  return events;
}

function sameAgDrainStrikeHeal(state, entry, log) {
  const unit = entry.unit;
  if (unit.hp <= 0) {
    log.push(`${unitLabel(unit)} の吸血: 戦闘不能のため回復なし`);
    return null;
  }
  const healed = heal(state, unit, Math.floor((entry.scratch.drainStrikeDamage || 0) * DRAIN_HEAL_RATE));
  if (healed > 0) {
    log.push(`${unitLabel(unit)} の吸血: HP${healed}回復`);
    recordFrame(log, state, { type: "heal", sourceId: unit.id, targetId: unit.id, amount: healed, healEvents: [{ targetId: unit.id, amount: healed }], text: `${unit.card.name} の貫殻吸血` });
  }
  return healed;
}

function sameAgToxicBloomAttack(state, entry, log, stageQueue) {
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

function sameAgApplyQueuedDamageStatus(state, entry, kind, log) {
  let scratchKey = null;
  let statusKey = null;
  let duration = null;
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
  return applyStatusToDamageEvents(state, entry.unit, events, statusKey, duration, log);
}

function battleActionFor(unit) {
  return ultimateReady(unit) ? `ultimate:${unit.card.ultimate.key}` : actionFor(unit);
}

function ultimateReady(unit) {
  return Boolean(unit.card.ultimate && (unit.ultimateCharge || 0) >= unit.card.ultimate.turns);
}

function isUltimateActionKey(actionKey) {
  return String(actionKey).startsWith("ultimate:");
}

function executeUltimate(state, unit, log) {
  const ultimate = unit.card.ultimate;
  const action = ultimateActions[ultimate?.key];
  if (!ultimate || !action) return;
  recordUltimateMetric(state, unit);
  log.push(`${unitLabel(unit)} の必殺技: ${ultimate.name}`);
  unit.ultimateCharge = 0;
  action.execute(state, unit, log);
}

function actionFor(unit) {
  if (unit.col === 0) return unit.card.front;
  if (unit.col === 1) return unit.card.middle;
  return unit.card.rear;
}

function unitStats(state, unit, context = { kind: "neutral", damage: 0 }) {
  const terrainId = state.terrain[unit.side][unit.row][unit.col];
  const base = {
    at: unit.card.at + unit.tempAt + activeStatTotal(state, unit, "at"),
    ag: unit.card.ag + unit.tempAg + activeStatTotal(state, unit, "ag"),
    armor: activeArmorTotal(state, unit),
    damage: context.damage || 0,
    kind: context.kind || "neutral",
  };
  if (unit.card.abilityKey === "quickStart" && unit.hp === unit.maxHp) {
    base.ag += 5;
  }
  terrainTypes[terrainId].apply(unit, base);
  return base;
}

function guardArmorFor(state, unit) {
  const terrainId = state.terrain[unit.side][unit.row][unit.col];
  return GUARD_ARMOR + (unit.card.abilityKey === "rampartCraft" && terrainId === "rampart" ? RAMPART_GUARD_BONUS : 0);
}

function guardStrikeDamageFor(state, unit) {
  return Math.max(6, Math.floor(unitStats(state, unit).at * GUARD_STRIKE_RATE));
}

function prayerStrikeDamageFor(state, unit) {
  return Math.max(5, Math.floor(unitStats(state, unit).at * PRAYER_STRIKE_RATE));
}

function executeGuardProtection(state, unit, log) {
  const allies = living(state, unit.side);
  const frontAlly = allies
    .filter((ally) => ally.row === unit.row && ally.col < unit.col)
    .sort((a, b) => b.col - a.col)[0];
  const targets = [unit, frontAlly].filter(Boolean);
  const armor = guardArmorFor(state, unit);
  const buffEvents = [];
  targets.forEach((target) => {
    grantArmor(state, target, armor, STANDARD_ARMOR_DURATION);
    buffEvents.push({ targetId: target.id, armor, duration: STANDARD_ARMOR_DURATION });
  });
  log.push(`${unitLabel(unit)} の守護: ${buffTargetSummary(targets)} に装甲+${armor}/${STANDARD_ARMOR_DURATION}T`);
  recordBuffGroupFrame(log, state, unit, buffEvents, `${unit.card.name} の守護`);
}

function executeGuardStrike(state, unit, log) {
  const target = findLaneFrontTarget(state, unit);
  if (!target) return;
  dealDamage(state, unit, target, guardStrikeDamageFor(state, unit), "守護反撃", log);
}

function executeShellBind(state, unit, log) {
  const allies = living(state, unit.side);
  const frontAlly = allies
    .filter((ally) => ally.row === unit.row && ally.col < unit.col)
    .sort((a, b) => b.col - a.col)[0];
  const targets = [unit, frontAlly].filter(Boolean);
  const armor = Math.max(8, Math.floor(guardArmorFor(state, unit) * 0.75));
  const buffEvents = [];
  targets.forEach((target) => {
    grantArmor(state, target, armor, STANDARD_ARMOR_DURATION);
    buffEvents.push({ targetId: target.id, armor, duration: STANDARD_ARMOR_DURATION });
  });
  log.push(`${unitLabel(unit)} の殻結び: ${buffTargetSummary(targets)} に装甲+${armor}/${STANDARD_ARMOR_DURATION}T`);
  recordBuffGroupFrame(log, state, unit, buffEvents, `${unit.card.name} の殻結び`);
}

function executeHealPrayer(state, unit, log) {
  const targets = living(state, unit.side).filter((ally) => ally.hp < ally.maxHp);
  if (targets.length === 0) return;
  const target = targets.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const amount = Math.max(7, Math.floor(unitStats(state, unit).at * SINGLE_HEAL_RATE));
  const healed = heal(state, target, amount);
  if (unit.card.abilityKey === "blessing") {
    grantArmor(state, target, BLESSING_ARMOR, STANDARD_ARMOR_DURATION);
  }
  log.push(`${unitLabel(unit)} の祈祷: ${unitLabel(target)} が${healed}回復`);
  if (unit.card.abilityKey === "blessing") {
    log.push(`${unitLabel(unit)} の能力: ${unitLabel(target)} に装甲+${BLESSING_ARMOR}/${STANDARD_ARMOR_DURATION}T`);
  }
  recordFrame(log, state, {
    type: "heal",
    sourceId: unit.id,
    targetId: target.id,
    amount: healed,
    healEvents: [{ targetId: target.id, amount: healed }],
    buffEvents: unit.card.abilityKey === "blessing" ? [{ targetId: target.id, armor: BLESSING_ARMOR, duration: STANDARD_ARMOR_DURATION }] : [],
    text: `${unit.card.name} の祈祷`,
  });
}

function executePrayerStrike(state, unit, log) {
  const target = findLaneFrontTarget(state, unit);
  if (!target) return;
  dealDamage(state, unit, target, prayerStrikeDamageFor(state, unit), "祈祷弾", log);
}

function executeTeamHealUltimate(state, unit, amount, log) {
  const targets = living(state, unit.side).filter((ally) => ally.hp < ally.maxHp);
  if (targets.length === 0) return logNoTarget(unit, log);
  const healEvents = targets
    .map((target) => ({ target, targetId: target.id, amount: heal(state, target, amount) }))
    .filter((event) => event.amount > 0);
  if (healEvents.length === 0) return logNoTarget(unit, log);
  log.push(`${unitLabel(unit)} の${unit.card.ultimate.name}: ${buffTargetSummary(healEvents.map((event) => event.target))} が${amount}回復`);
  recordFrame(log, state, {
    type: "heal",
    sourceId: unit.id,
    targetId: healEvents[0].targetId,
    amount: healEvents[0].amount,
    healEvents: healEvents.map((event) => ({ targetId: event.targetId, amount: event.amount })),
    text: `${unit.card.name} の${unit.card.ultimate.name}`,
  });
}

function grantArmor(state, unit, amount, durationTurns = STANDARD_ARMOR_DURATION) {
  if (!unit.armorEffects) unit.armorEffects = [];
  unit.armorEffects.push({
    amount,
    duration: durationTurns,
    expiresOnTurn: Math.max(1, state.turn + durationTurns - 1),
  });
  recordArmorMetric(state, unit, amount, durationTurns);
}

function grantStatBuff(state, unit, stat, amount, durationTurns = COMMAND_DURATION) {
  if (!unit.statEffects) unit.statEffects = [];
  unit.statEffects.push({
    stat,
    amount,
    duration: durationTurns,
    expiresOnTurn: Math.max(1, state.turn + durationTurns - 1),
  });
}

function grantStatusEffect(state, unit, key, durationTurns = STATUS_EFFECTS[key]?.defaultDuration ?? 1, source = null) {
  const definition = STATUS_EFFECTS[key];
  if (!isRulesetEntryAvailable(definition) || unit.hp <= 0 || !Number.isInteger(durationTurns) || durationTurns < 1) return null;
  if (!unit.statusEffects) unit.statusEffects = [];
  const current = activeStatusEffect(state, unit, key);
  const incoming = {
    key,
    duration: durationTurns,
    expiresOnTurn: Math.max(1, state.turn + durationTurns - 1),
    sourceId: source?.id || null,
    sourceSide: source?.side || null,
  };
  // AD-G01: equal/shorter reapplications retain both the expiry and its source.
  const selected = current && definition.refresh === "longest" && current.expiresOnTurn >= incoming.expiresOnTurn
    ? current
    : incoming;
  unit.statusEffects = unit.statusEffects.filter((effect) => effect.key !== key);
  unit.statusEffects.push(selected);
  return selected;
}

function clearStatusEffects(state, unit, masks) {
  const selectedMasks = new Set(masks);
  const cleared = [];
  unit.statusEffects = (unit.statusEffects || []).filter((effect) => {
    const matches = effect.expiresOnTurn >= state.turn
      && STATUS_EFFECTS[effect.key]?.clearMasks?.some((mask) => selectedMasks.has(mask));
    if (matches) cleared.push(effect);
    return !matches;
  });
  return cleared;
}

function activeStatusEffect(state, unit, key) {
  return (unit.statusEffects || []).find((effect) => effect.key === key && effect.expiresOnTurn >= state.turn) || null;
}

function expireStatusEffects(state) {
  allLiving(state).forEach((unit) => {
    unit.statusEffects = (unit.statusEffects || []).filter((effect) => effect.expiresOnTurn >= state.turn);
  });
}

function recordStatusFrame(log, state, source, targets, statusKey, text) {
  recordFrame(log, state, {
    type: "buff",
    sourceId: source.id,
    targetId: targets[0]?.id,
    buffEvents: targets.map((target) => ({ targetId: target.id, statusKey })),
    text,
  });
}

function applyStatusToDamageEvents(state, source, events, statusKey, durationTurns, log) {
  const targets = (events || [])
    .map((event) => event.target)
    .filter((target) => target && target.hp > 0);
  applyStatusToTargets(state, source, targets, statusKey, durationTurns, log, "追加効果");
}

function applyStatusToTargets(state, source, targets, statusKey, durationTurns, log, label) {
  const validTargets = (targets || []).filter((target) => target && target.hp > 0
    && grantStatusEffect(state, target, statusKey, durationTurns, source));
  if (validTargets.length === 0) return;
  recordStatusAppliedMetric(state, source, statusKey, validTargets.length);
  const status = STATUS_EFFECTS[statusKey]?.name || statusKey;
  log.push(`${unitLabel(source)} の${label}: ${buffTargetSummary(validTargets)} に${status}/${durationTurns}T`);
  recordStatusFrame(log, state, source, validTargets, statusKey, `${source.card.name} の${status}`);
}

function chargeUltimateGauge(state, unit, amount) {
  if (!unit.card.ultimate) return;
  unit.ultimateCharge = Math.min(unit.card.ultimate.turns, (unit.ultimateCharge || 0) + amount);
  recordUltimateChargeBoostMetric(state, unit, amount);
}

function expireArmorEffects(state) {
  allLiving(state).forEach((unit) => {
    unit.armorEffects = (unit.armorEffects || []).filter((effect) => effect.expiresOnTurn >= state.turn);
  });
}

function expireStatEffects(state) {
  allLiving(state).forEach((unit) => {
    unit.statEffects = (unit.statEffects || []).filter((effect) => effect.expiresOnTurn >= state.turn);
  });
}

function activeArmorTotal(state, unit) {
  return (unit.armorEffects || [])
    .filter((effect) => effect.expiresOnTurn >= state.turn)
    .reduce((sum, effect) => sum + effect.amount, 0);
}

function activeStatTotal(state, unit, stat) {
  return (unit.statEffects || [])
    .filter((effect) => effect.stat === stat && effect.expiresOnTurn >= state.turn)
    .reduce((sum, effect) => sum + effect.amount, 0);
}

function activeStatDuration(state, unit, stat) {
  const effects = (unit.statEffects || []).filter((effect) => effect.stat === stat && effect.expiresOnTurn >= state.turn);
  if (effects.length === 0) return null;
  return Math.max(...effects.map((effect) => effect.duration || COMMAND_DURATION));
}

function armorStatusText(state, unit, total) {
  const effects = (unit.armorEffects || []).filter((effect) => effect.expiresOnTurn >= state.turn);
  if (effects.length === 0) return `${TERMS.armor} ${total}`;
  const duration = Math.max(...effects.map((effect) => effect.duration || STANDARD_ARMOR_DURATION));
  return `${TERMS.armor} ${total}/${duration}T`;
}

function commandAtBonusFor(unit) {
  return 2 + (unit.card.abilityKey === "sharpCommand" ? 1 : 0);
}

function lineHealAmountFor(state, unit) {
  const bonus = unit.card.abilityKey === "widePrayer" ? WIDE_PRAYER_BONUS : 0;
  return Math.max(6, Math.floor(unitStats(state, unit).at * LINE_HEAL_RATE) + bonus);
}

function generalWardArmorFor(unit) {
  return GENERAL_WARD_ARMOR + (unit.card.abilityKey === "devotedWard" ? DEVOTED_WARD_BONUS : 0);
}

function generalWardHealFor(state, unit) {
  return Math.max(5, Math.floor(unitStats(state, unit).at * GENERAL_WARD_HEAL_RATE));
}

function dealDamage(state, source, target, rawDamage, actionName, log) {
  dealDamageGroup(state, source, [{ target, rawDamage }], actionName, log);
}

function dealDamageGroup(state, source, targetSpecs, actionName, log, rangeCellsOverride = null) {
  const events = targetSpecs
    .filter((spec) => spec.target && spec.target.hp > 0)
    .map((spec) => ({
      target: spec.target,
      targetId: spec.target.id,
      damage: damageForTarget(state, source, spec.target, spec.rawDamage, actionName),
    }));
  if (events.length === 0) return logNoTarget(source, log);

  const rangeCells = rangeCellsOverride || rangeCellsForAction(state, source, actionName, events[0].target);
  const beforeState = snapshotBattleState(state);
  events.forEach((event) => {
    const actualDamage = Math.min(event.target.hp, event.damage);
    event.actualDamage = actualDamage;
    recordDamageMetric(state, source, event.target, actualDamage);
    event.target.hp = Math.max(0, event.target.hp - event.damage);
  });

  log.push(`${unitLabel(source)} の${actionName}: ${events.map((event) => `${unitLabel(event.target)}に${event.damage}`).join(" / ")}ダメージ`);
  recordFrame(log, state, {
    type: "attack",
    sourceId: source.id,
    targetId: events[0].targetId,
    damage: events[0].damage,
    attackEvents: events.map((event) => ({ targetId: event.targetId, damage: event.damage })),
    rangeCells,
    beforeState,
    text: `${source.card.name} の${actionName}`,
  });

  applyDamageResponseTriggers(state, source, events, log);

  const fallenEvents = events.filter((event) => event.target.hp === 0);
  if (fallenEvents.length > 0) {
    fallenEvents.forEach((event) => {
      log.push(`${unitLabel(event.target)} が戦闘不能`);
      recordKoMetric(state, event.target, source.side);
    });
    recordFrame(log, state, {
      type: "ko",
      targetId: fallenEvents[0].targetId,
      koEvents: fallenEvents.map((event) => ({ targetId: event.targetId })),
      text: `${fallenEvents.map((event) => event.target.card.name).join(" / ")} 戦闘不能`,
    });
    fallenEvents.forEach((event) => applyFallTriggers(state, event.target, log));
    recordAlphaExposureStates(state);
  }
  return events;
}

function applyDamageResponseTriggers(state, source, events, log) {
  if (!source || source.hp <= 0) return;
  (events || []).forEach((event) => {
    const target = event.target;
    if (!target || target.hp <= 0 || source.hp <= 0 || target.side === source.side || (event.actualDamage || 0) <= 0) return;
    applyContactPoisonResponse(state, target, source, log);
    applyReflectShellResponse(state, target, source, event.actualDamage, log);
  });
}

function applyContactPoisonResponse(state, defender, attacker, log) {
  if (!activeStatusEffect(state, defender, "contactPoison") || attacker.hp <= 0) return;
  grantStatusEffect(state, attacker, "poison", POISON_DURATION, defender);
  recordStatusAppliedMetric(state, defender, "poison", 1);
  log.push(`${unitLabel(defender)} の接触毒: ${unitLabel(attacker)} に毒/${POISON_DURATION}T`);
  recordStatusFrame(log, state, defender, [attacker], "poison", `${defender.card.name} の接触毒`);
}

function applyReflectShellResponse(state, defender, attacker, receivedDamage, log) {
  if (!activeStatusEffect(state, defender, "reflectShell") || attacker.hp <= 0) return;
  const rawReflectDamage = Math.min(REFLECT_DAMAGE_CAP, Math.max(1, Math.floor(receivedDamage * REFLECT_DAMAGE_RATE)));
  const actualReflectDamage = Math.min(attacker.hp, rawReflectDamage);
  if (actualReflectDamage <= 0) return;
  const beforeState = snapshotBattleState(state);
  attacker.hp = Math.max(0, attacker.hp - rawReflectDamage);
  recordDamageMetric(state, defender, attacker, actualReflectDamage);
  log.push(`${unitLabel(defender)} の反射殻: ${unitLabel(attacker)} に${rawReflectDamage}ダメージ`);
  recordFrame(log, state, {
    type: "attack",
    sourceId: defender.id,
    targetId: attacker.id,
    damage: rawReflectDamage,
    attackEvents: [{ targetId: attacker.id, damage: rawReflectDamage }],
    rangeCells: uniqueCells([{ side: attacker.side, row: attacker.row, col: attacker.col }]),
    beforeState,
    text: `${defender.card.name} の反射殻`,
  });
  if (attacker.hp === 0) {
    log.push(`${unitLabel(attacker)} が戦闘不能`);
    recordKoMetric(state, attacker, defender.side);
    recordFrame(log, state, { type: "ko", targetId: attacker.id, koEvents: [{ targetId: attacker.id }], text: `${attacker.card.name} 戦闘不能` });
    applyFallTriggers(state, attacker, log);
    recordAlphaExposureStates(state);
  }
}

function damageForTarget(state, source, target, rawDamage, actionName) {
  let context = unitStats(state, source, { kind: "attack", damage: rawDamage });
  let damage = context.damage;
  if (["貫殻", "貫殻吸血"].includes(actionName)) {
    damage += Math.min(BARRIER_PIERCE_ARMOR_BONUS_CAP, activeArmorTotal(state, target));
  }
  const sourceTerrain = state.terrain[source.side][source.row][source.col];
  if (source.card.abilityKey === "rangedTerrain" && ["forest", "highland"].includes(sourceTerrain)) {
    damage += 2;
  }
  if (source.card.abilityKey === "laneBreaker") {
    const laneEnemies = enemies(state, source.side).filter((unit) => unit.row === source.row);
    if (laneEnemies.length >= 2 && actionName === "貫通") damage += 2;
  }
  if (source.card.abilityKey === "middleRaid" && actionName === "奇襲" && target.col === 1) {
    damage += MIDDLE_RAID_BONUS;
  }
  if (source.card.abilityKey === "generalBreaker" && actionName === "破陣" && target.general) {
    damage += 4;
  }
  if (source.card.abilityKey === "executeHunter" && actionName === "追跡" && target.hp <= Math.floor(target.maxHp / 2)) {
    damage += 3;
  }
  if (source.card.abilityKey === "rearCannon" && source.col === 2 && actionName === "掃射") {
    damage += REAR_CANNON_BONUS;
  }
  if (source.general && source.card.generalKey === "frontDuel" && source.col === 0) {
    damage += 4;
  }
  const firstSnipeFlag = `${source.side}FirstSnipe`;
  const sourceGeneral = generalOf(state, source.side);
  if (actionName === "狙撃" && sourceGeneral?.card.generalKey === "firstSnipe" && !state.flags[firstSnipeFlag]) {
    damage += 5;
    state.flags[firstSnipeFlag] = true;
  }
  if (actionName === "貫通" && target.general && !isGeneralExposed(state, target)) {
    damage = Math.floor(damage * 0.6);
  }
  if (activeStatusEffect(state, target, "defenseDown")) {
    damage += STATUS_EFFECTS.defenseDown.damage;
  }

  const incoming = unitStats(state, target, { kind: "incoming", damage });
  const preDefenseDamage = incoming.damage;
  const ignoresArmor = ["守護反撃", "貫殻", "貫殻吸血"].includes(actionName);
  damage = incoming.damage - (ignoresArmor ? 0 : incoming.armor);
  if (target.card.abilityKey === "steady" && !target.firstHitReduced) {
    damage -= 2;
    target.firstHitReduced = true;
  }
  if (target.card.abilityKey === "rearWard" && target.col === 2 && ["狙撃", "掃射"].includes(actionName)) {
    damage -= 3;
  }
  const finalDamage = Math.max(1, Math.floor(damage));
  recordDamagePreventedMetric(state, target, Math.max(0, Math.floor(preDefenseDamage) - finalDamage));
  return finalDamage;
}

function applyFallTriggers(state, fallen, log) {
  const side = fallen.side;
  const general = generalOf(state, side);
  const flag = `${side}FirstFallHeal`;
  if (general?.card.generalKey === "firstFallHeal" && !state.flags[flag] && !fallen.general) {
    state.flags[flag] = true;
    const healEvents = living(state, side)
      .map((unit) => ({ targetId: unit.id, amount: heal(state, unit, 5) }))
      .filter((event) => event.amount > 0);
    log.push(`${unitLabel(general)} のα特性: 味方全員HP+5`);
    if (healEvents.length > 0) {
      recordFrame(log, state, { type: "heal", sourceId: general.id, targetId: general.id, healEvents, text: `${general.card.name} のα特性` });
    }
  }
}

function heal(state, unit, amount) {
  if (state && activeStatusEffect(state, unit, "healBlock")) {
    recordHealMetric(state, unit, amount, true);
    return 0;
  }
  const before = unit.hp;
  unit.hp = Math.min(unit.maxHp, unit.hp + amount);
  const healed = unit.hp - before;
  recordHealMetric(state, unit, healed);
  return healed;
}

function cleanupFallen(state, log) {
  state.units = state.units.filter((unit) => {
    if (unit.hp > 0 || unit.general) return true;
    return false;
  });
}

function compactRows(state, log) {
  ["player", "enemy"].forEach((side) => {
    for (let row = 0; row < 3; row += 1) {
      const lane = living(state, side)
        .filter((unit) => unit.row === row)
        .sort((a, b) => a.col - b.col);
      lane.forEach((unit, index) => {
        if (unit.col !== index) {
          const from = COL_LABELS[unit.col];
          unit.col = index;
          log.push(`${unitLabel(unit)} が${from}から${COL_LABELS[index]}へ前進`);
          recordFrame(log, state, { type: "move", unitId: unit.id, text: `${unit.card.name} が前進` });
          if (unit.general && index <= 1) {
            triggerFallbackWard(state, unit, log);
            triggerFinishSignal(state, unit, log);
          }
        }
      });
    }
  });
}

function triggerFallbackWard(state, general, log) {
  const flag = `${general.side}FallbackWard`;
  if (general.card.generalKey !== "fallbackWard" || state.flags[flag] || general.col !== 1) return;
  state.flags[flag] = true;
  const buffEvents = living(state, general.side).map((unit) => {
    grantArmor(state, unit, FALLBACK_WARD_ARMOR, STANDARD_ARMOR_DURATION);
    return { targetId: unit.id, armor: FALLBACK_WARD_ARMOR, duration: STANDARD_ARMOR_DURATION };
  });
  log.push(`${unitLabel(general)} のα特性: α中衛化で全員に装甲+${FALLBACK_WARD_ARMOR}/${STANDARD_ARMOR_DURATION}T`);
  recordFrame(log, state, { type: "buff", sourceId: general.id, targetId: general.id, buffEvents, text: `${general.card.name} のα特性` });
}

function triggerFinishSignal(state, exposedGeneral, log) {
  const attackerSide = opposite(exposedGeneral.side);
  const attackerGeneral = generalOf(state, attackerSide);
  const flag = `${attackerSide}FinishSignal`;
  if (attackerGeneral?.card.generalKey !== "finishSignal" || state.flags[flag]) return;
  state.flags[flag] = true;
  grantStatBuff(state, attackerGeneral, "at", FINISH_SIGNAL_AT, FINISH_SIGNAL_DURATION);
  log.push(`${unitLabel(attackerGeneral)} のα特性: 相手α露出で自身にAT+${FINISH_SIGNAL_AT}/${FINISH_SIGNAL_DURATION}T`);
  recordBuffFrame(log, state, attackerGeneral, attackerGeneral, { at: FINISH_SIGNAL_AT, duration: FINISH_SIGNAL_DURATION }, `${attackerGeneral.card.name} のα特性`);
}

function checkGeneralVictory(state, log) {
  const playerGeneral = generalOf(state, "player");
  const enemyGeneral = generalOf(state, "enemy");
  const playerDown = playerGeneral && playerGeneral.hp <= 0;
  const enemyDown = enemyGeneral && enemyGeneral.hp <= 0;
  if (playerDown) recordKoMetric(state, playerGeneral, "enemy");
  if (enemyDown) recordKoMetric(state, enemyGeneral, "player");
  if (playerDown && enemyDown) {
    log.push("双方のαが倒れたため引き分け");
    recordFrame(log, state, { type: "draw", text: "双方α撃破" });
    return "draw";
  }
  if (playerDown) {
    log.push("自分のαが倒れたため相手勝利");
    recordFrame(log, state, { type: "win", targetId: playerGeneral.id, text: "相手勝利" });
    return "enemy";
  }
  if (enemyDown) {
    log.push("相手のαが倒れたため自分勝利");
    recordFrame(log, state, { type: "win", targetId: enemyGeneral.id, text: "自分勝利" });
    return "player";
  }
  return null;
}

function summarizeBattle(state, winner) {
  const playerGeneral = generalOf(state, "player");
  const enemyGeneral = generalOf(state, "enemy");
  const playerHp = playerGeneral ? `${playerGeneral.hp}/${playerGeneral.maxHp}` : "0";
  const enemyHp = enemyGeneral ? `${enemyGeneral.hp}/${enemyGeneral.maxHp}` : "0";
  if (winner === "draw") {
    return `引き分け。${TERMS.alpha}HP ${TERMS.playerSide} ${playerHp} / ${TERMS.enemySide} ${enemyHp}。`;
  }
  const winnerText = winner === "player" ? TERMS.playerSide : TERMS.enemySide;
  return `${winnerText}勝利。${TERMS.alpha}HP ${TERMS.playerSide} ${playerHp} / ${TERMS.enemySide} ${enemyHp}。`;
}

function rangeCellsForAction(state, source, actionName, target) {
  const targetSide = opposite(source.side);
  if (actionName === "掃射") {
    return rowsForCols(targetSide, [0]);
  }
  if (actionName === "貫通") {
    return uniqueCells([
      { side: targetSide, row: source.row, col: 0 },
      { side: targetSide, row: source.row, col: 1 },
    ]);
  }
  if (actionName === "狙撃") {
    return rowsForCols(targetSide, [2]);
  }
  if (actionName === "奇襲") {
    return rowsForCols(targetSide, [1, 2]);
  }
  return uniqueCells([{ side: targetSide, row: target.row, col: target.col }]);
}

function rowsForCols(side, cols) {
  const cells = [];
  for (let row = 0; row < 3; row += 1) {
    cols.forEach((col) => cells.push({ side, row, col }));
  }
  return uniqueCells(cells);
}

function uniqueCells(cells) {
  const seen = new Set();
  return cells.filter((cell) => {
    const key = `${cell.side}:${cell.row}:${cell.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findFrontTarget(state, unit) {
  const sameLane = enemies(state, unit.side)
    .filter((enemy) => enemy.row === unit.row)
    .sort((a, b) => a.col - b.col);
  if (sameLane.length > 0) return sameLane[0];
  return enemies(state, unit.side).sort((a, b) => a.col - b.col || a.hp - b.hp)[0] || null;
}

function findLowestHpEnemy(state, unit) {
  return enemies(state, unit.side)
    .sort((a, b) => a.hp - b.hp || a.col - b.col || a.row - b.row)[0] || null;
}

function findMostArmoredTarget(state, unit) {
  return enemies(state, unit.side)
    .map((enemy) => ({ enemy, armor: activeArmorTotal(state, enemy) }))
    .filter((item) => item.armor > 0)
    .sort((a, b) => b.armor - a.armor || a.enemy.col - b.enemy.col || a.enemy.row - b.enemy.row)[0]?.enemy || null;
}

function findLaneFrontTarget(state, unit) {
  return enemies(state, unit.side)
    .filter((enemy) => enemy.row === unit.row)
    .sort((a, b) => a.col - b.col)[0] || null;
}

function isGeneralExposed(state, general) {
  if (!general || general.hp <= 0) return false;
  const protectors = living(state, general.side).filter((unit) => !unit.general && unit.row === general.row && unit.col < general.col);
  return general.col === 0 || protectors.length === 0;
}

function living(state, side) {
  return state.units.filter((unit) => unit.side === side && unit.hp > 0);
}

function allLiving(state) {
  return state.units.filter((unit) => unit.hp > 0);
}

function enemies(state, side) {
  return living(state, opposite(side));
}

function generalOf(state, side) {
  return state.units.find((unit) => unit.side === side && unit.general);
}

function opposite(side) {
  return side === "player" ? "enemy" : "player";
}

function boardPriority(unit) {
  const sideOffset = unit.side === "player" ? 0 : 100;
  return sideOffset + unit.col * 10 + unit.row;
}

function rarityTiePriority(unit) {
  return RARITIES[unit.card.rarity]?.tiePriority || 0;
}

function unitLabel(unit) {
  const mark = unit.general ? TERMS.alpha : TERMS.normal;
  return `${unit.card.name}(${mark}/${unit.side === "player" ? "自" : "敵"})`;
}

function buffTargetSummary(targets) {
  return targets.map((target) => unitLabel(target)).join(" / ");
}

function logNoTarget(unit, log) {
  log.push(`${unitLabel(unit)} は対象なし`);
}

function terrainName(state, unit) {
  return terrainTypes[state.terrain[unit.side][unit.row][unit.col]].name;
}

function renderBoards(state) {
  renderBoard("player", state, els.playerBoard);
  renderBoard("enemy", state, els.enemyBoard);
}

function renderBoard(side, state, root) {
  root.innerHTML = "";
  const terrainGrid = state.terrain[side];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const terrainId = terrainGrid[row][col];
      const unit = state.units.find((item) => item.side === side && item.row === row && item.col === col && shouldRenderUnit(item));
      const slot = document.createElement("button");
      const slotClasses = slotHighlightClass(side, row, col, unit);
      slot.type = "button";
      slot.draggable = Boolean(unit);
      slot.className = `slot ${terrainTypes[terrainId].className}${slotClasses}${unit?.hp <= 0 ? " ko" : ""}${unit?.id === selectedUnitId ? " is-selected" : ""}`;
      if (slotClasses) {
        slot.style.setProperty("--effect-color", effectColorForFrame(activeFrame));
      }
      slot.style.gridColumn = `${row + 1}`;
      slot.style.gridRow = `${side === "enemy" ? 3 - col : col + 1}`;
      slot.setAttribute("aria-label", `${sideLabel(side)} ${ROW_LABELS[row]} ${COL_LABELS[col]}`);
      slot.addEventListener("click", () => {
        handleSlotClick(side, row, col, unit, state);
      });
      slot.addEventListener("dragover", (event) => {
        event.preventDefault();
        slot.classList.add("is-drop-target");
      });
      slot.addEventListener("dragleave", () => {
        slot.classList.remove("is-drop-target");
      });
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        slot.classList.remove("is-drop-target");
        const terrainId = event.dataTransfer?.getData("text/terrain-id") || draggedTerrainId;
        const cardId = event.dataTransfer?.getData("text/card-id") || draggedCardId;
        if (terrainId) {
          editTerrainSlot(side, row, col, terrainId);
        } else if (cardId) {
          editCardSlot(side, row, col, cardId);
        }
        draggedCardId = null;
        draggedTerrainId = null;
      });
      if (unit) {
        slot.addEventListener("dragstart", (event) => {
          draggedCardId = unit.cardId;
          draggedTerrainId = null;
          selectedCardId = unit.cardId;
          els.cardPicker.value = unit.cardId;
          event.dataTransfer?.setData("text/card-id", unit.cardId);
          event.dataTransfer?.setData("text/plain", unit.card.name);
        });
      }
      slot.innerHTML = `
        <div class="slot-meta">
          <span class="${col === 0 ? "front-label" : col === 1 ? "mid-label" : "rear-label"}">${COL_LABELS[col]}</span>
          ${terrainTermMarkup(terrainId)}
        </div>
        ${unit ? unitMarkup(state, unit) : "<div></div>"}
        ${unit && unit.id === selectedUnitId ? cardPopoverMarkup(state, unit) : ""}
        <div class="slot-meta"><span>${ROW_LABELS[row]}</span>${unit ? actionTermMarkup(actionFor(unit)) : "<span></span>"}</div>
      `;
      root.append(slot);
    }
  }
}

function shouldRenderUnit(unit) {
  return unit.hp > 0 || unit.general || isActiveFrameUnit(unit.id);
}

function isActiveFrameUnit(unitId) {
  if (!activeFrame) return false;
  return [activeFrame.sourceId, activeFrame.targetId, activeFrame.unitId].includes(unitId)
    || Boolean(activeFrame.attackEvents?.some((event) => event.targetId === unitId))
    || Boolean(activeFrame.healEvents?.some((event) => event.targetId === unitId))
    || Boolean(activeFrame.buffEvents?.some((event) => event.targetId === unitId))
    || Boolean(activeFrame.koEvents?.some((event) => event.targetId === unitId));
}

function slotHighlightClass(side, row, col, unit) {
  if (!activeFrame) return "";
  const classes = [];
  if (activeFrame.type === "attack" && activeFrame.rangeCells?.some((cell) => cell.side === side && cell.row === row && cell.col === col)) {
    classes.push("is-range-cell");
  }
  if (unit) {
    classes.push(...unitHighlightClasses(unit));
  }
  return classes.length ? ` ${classes.join(" ")}` : "";
}

function unitHighlightClasses(unit) {
  if (!activeFrame) return [];
  const classes = [];
  if (activeFrame.type === "attack" && activeFrame.sourceId === unit.id) classes.push("is-attack-source");
  if (activeFrame.type === "attack" && attackDamageForActiveFrame(unit.id) > 0) classes.push("is-attack-target");
  if (activeFrame.sourceId === unit.id && activeFrame.type !== "attack") classes.push("is-acting");
  if (healAmountForActiveFrame(unit.id) > 0) classes.push("is-healed");
  if (buffLabelsForActiveFrame(unit.id).length > 0) classes.push("is-buffed");
  if (activeFrame.unitId === unit.id && activeFrame.type === "move") classes.push("is-moving");
  if (activeFrame.targetId === unit.id && ["ko", "win"].includes(activeFrame.type)) classes.push("is-ko");
  if (activeFrame.type === "ko" && activeFrame.koEvents?.some((event) => event.targetId === unit.id)) classes.push("is-ko");
  return classes;
}

function effectColorForFrame(frame) {
  if (!frame) return "#d34836";
  if (frame.type === "heal") return "#3c9a64";
  if (frame.type === "buff") return "#b98524";
  if (frame.type === "move") return "#347f70";
  return "#d34836";
}

function highlightClass(unit) {
  if (!activeFrame) return "";
  const classes = unitHighlightClasses(unit);
  return classes.length ? ` ${classes.join(" ")}` : "";
}

function unitMarkup(state, unit) {
  const hpRate = Math.max(0, Math.round((unit.hp / unit.maxHp) * 100));
  const stats = unitStats(state, unit);
  return `
    <div class="unit">
      <div class="unit-name">
        ${unit.general ? `<span class="general-mark">${TERMS.alpha}</span>` : ""}
        <span>${unit.card.name}</span>
        <span class="unit-cost">${cardCostLabel(unit)}</span>
      </div>
      <div class="stat-line">
        <span class="chip">HP ${unit.hp}/${unit.maxHp}</span>
        <span class="chip">AT ${stats.at}</span>
        <span class="chip">AG ${stats.ag}</span>
      </div>
      <div class="unit-action-line">${actionTermMarkup(actionFor(unit))}</div>
      <div class="hpbar" aria-hidden="true"><span style="width:${hpRate}%"></span></div>
      ${statusMarkup(state, unit)}
    </div>
    ${effectValueMarkup(unit)}
  `;
}

function cardPopoverMarkup(state, unit) {
  const stats = unitStats(state, unit);
  return `
    <div class="card-popover">
      <div class="popover-head">
        <strong>${unit.card.name}${unit.general ? ` / ${TERMS.alpha}` : ""}</strong>
        <span>HP ${unit.maxHp} / AT ${stats.at} / AG ${stats.ag}</span>
      </div>
      <div class="tag-line">${cardBadgeMarkup(unit.card)}</div>
      <div class="popover-actions">
        ${actionVisualMarkup(state, unit, TERMS.rankShort[0], unit.card.front)}
        ${actionVisualMarkup(state, unit, TERMS.rankShort[1], unit.card.middle)}
        ${actionVisualMarkup(state, unit, TERMS.rankShort[2], unit.card.rear)}
      </div>
      ${ultimatePopoverMarkup(state, unit)}
      <div class="popover-note"><b>能力</b><span>${uiText(unit.card.ability)}</span></div>
      <div class="popover-note"><b>${TERMS.alphaTrait}</b><span>${uiText(unit.card.generalSkill)}</span></div>
    </div>
  `;
}

function actionVisualMarkup(state, unit, label, actionKey) {
  const action = actions[actionKey];
  const diagram = actionDiagram(actionKey, unit);
  return `
    <div class="visual-action">
      <div class="visual-action-head">
        <span>${label}</span>
        <strong>${action.name}</strong>
        <em>${diagram.sideLabel}</em>
      </div>
      ${diagramMarkup(diagram)}
      <p>${uiText(actionFormulaText(state, unit, actionKey))}</p>
    </div>
  `;
}

function diagramMarkup(diagram) {
  const marked = new Set(diagram.cells.map((cell) => `${cell.row}:${cell.col}`));
  const cells = [];
  for (let col = 2; col >= 0; col -= 1) {
    for (let row = 0; row < 3; row += 1) {
      const key = `${row}:${col}`;
      cells.push(`<span class="${marked.has(key) ? `mark ${diagram.tone}` : ""}">${cellShortLabel(row, col)}</span>`);
    }
  }
  return `<div class="target-board">${cells.join("")}</div>`;
}

function actionDiagram(actionKey, unit) {
  const ally = { sideLabel: "味方", tone: "ally", cells: [] };
  const enemy = { sideLabel: "敵", tone: "enemy", cells: [] };
  const anyEnemyCol = (col) => ({ ...enemy, cells: rowsForDiagramCols([col]) });
  const anyEnemyCols = (cols) => ({ ...enemy, cells: rowsForDiagramCols(cols) });
  const allyCol = (col) => ({ ...ally, cells: rowsForDiagramCols([col]) });
  const allyLane = () => ({ ...ally, cells: [0, 1, 2].map((col) => ({ row: unit.row, col })) });

  if (actionKey === "slash") return anyEnemyCol(0);
  if (actionKey === "pierce") return { ...enemy, cells: [0, 1].map((col) => ({ row: unit.row, col })) };
  if (actionKey === "sweep") return anyEnemyCol(0);
  if (actionKey === "snipe") return anyEnemyCol(2);
  if (actionKey === "raid") return anyEnemyCols([1, 2]);
  if (actionKey === "siege") return anyEnemyCol(0);
  if (actionKey === "lowHpStrike") return anyEnemyCols([0, 1, 2]);
  if (actionKey === "agSnare") return { ...enemy, cells: [{ row: unit.row, col: 0 }] };
  if (actionKey === "acidBite") return anyEnemyCol(0);
  if (actionKey === "acidSweepDefense") return anyEnemyCol(0);
  if (actionKey === "acidSweepHealBlock") return anyEnemyCol(0);
  if (actionKey === "drainStrike") return anyEnemyCols([0, 1, 2]);
  if (actionKey === "barrierPierceStrike") return anyEnemyCol(0);
  if (actionKey === "healBlockPulse") return anyEnemyCols([0, 1, 2]);
  if (actionKey === "midRearPressure") return anyEnemyCols([1, 2]);
  if (actionKey === "sporeCrush") return anyEnemyCol(0);
  if (actionKey === "sporeBarrage") return anyEnemyCol(0);
  if (actionKey === "toxicNeedle") return anyEnemyCol(0);
  if (actionKey === "toxicCloud") return anyEnemyCol(0);
  if (actionKey === "guard") {
    const cols = [unit.col];
    if (unit.col > 0) cols.push(unit.col - 1);
    return { ...ally, cells: cols.map((col) => ({ row: unit.row, col })) };
  }
  if (actionKey === "shellBind") {
    const cols = [unit.col];
    if (unit.col > 0) cols.push(unit.col - 1);
    return { ...ally, cells: cols.map((col) => ({ row: unit.row, col })) };
  }
  if (actionKey === "rally") return allyCol(0);
  if (actionKey === "heal") return { ...ally, cells: rowsForDiagramCols([0, 1, 2]) };
  if (actionKey === "lineHeal") return allyLane();
  if (actionKey === "generalWard") return { ...ally, cells: [{ row: 1, col: 1 }] };
  if (actionKey === "command") return allyLane();
  if (actionKey === "quickenUltimate") return allyLane();
  if (["selfAg", "selfUltimateCharge", "thornGuard", "mirrorShell"].includes(actionKey)) return { ...ally, cells: [{ row: unit.row, col: unit.col }] };
  return { sideLabel: "-", tone: "neutral", cells: [] };
}

function rowsForDiagramCols(cols) {
  const cells = [];
  cols.forEach((col) => {
    for (let row = 0; row < 3; row += 1) cells.push({ row, col });
  });
  return cells;
}

function cellShortLabel(row, col) {
  return `${TERMS.laneShort[row]}${TERMS.rankShort[col]}`;
}

function effectValueMarkup(unit) {
  if (!activeFrame) return "";
  const attackDamage = attackDamageForActiveFrame(unit.id);
  if (activeFrame.type === "attack" && attackDamage > 0) {
    return `<div class="effect-float damage-float"><span>-${attackDamage}</span></div>`;
  }
  const healAmount = healAmountForActiveFrame(unit.id);
  const buffLabels = buffLabelsForActiveFrame(unit.id);
  const parts = [];
  if (activeFrame.type === "heal" && healAmount > 0) {
    parts.push(`+${healAmount}`);
  }
  if (buffLabels.length > 0) {
    parts.push(...buffLabels);
  }
  if (parts.length > 0) {
    const floatClass = activeFrame.type === "heal" && healAmount > 0 ? "heal-float" : "buff-float";
    return `<div class="effect-float ${floatClass}">${parts.map((part) => `<span>${part}</span>`).join("")}</div>`;
  }
  return "";
}

function statusMarkup(state, unit) {
  const statuses = unitStatuses(state, unit);
  if (statuses.length === 0) return "";
  return `<div class="status-line">${statuses.map((status) => `<span class="status-chip ${status.tone ? `${status.tone}-chip` : ""}">${uiText(status.label)}</span>`).join("")}</div>`;
}

function unitStatuses(state, unit) {
  const statuses = [];
  const stats = unitStats(state, unit);
  const timedAt = activeStatTotal(state, unit, "at");
  const timedAg = activeStatTotal(state, unit, "ag");
  const passiveAtDelta = stats.at - unit.card.at - unit.tempAt - timedAt;
  const passiveAgDelta = stats.ag - unit.card.ag - unit.tempAg - timedAg;
  if (timedAt !== 0) statuses.push(statStatus("AT", timedAt, activeStatDuration(state, unit, "at")));
  if (timedAg !== 0) statuses.push(statStatus("AG", timedAg, activeStatDuration(state, unit, "ag")));
  if (unit.tempAt !== 0) statuses.push(statStatus("AT", unit.tempAt));
  if (unit.tempAg !== 0) statuses.push(statStatus("AG", unit.tempAg));
  if (passiveAtDelta !== 0) statuses.push(statStatus("AT", passiveAtDelta));
  if (passiveAgDelta !== 0) statuses.push(statStatus("AG", passiveAgDelta));
  if (unit.card.ultimate) {
    statuses.push({
      label: ultimateChargeText(unit),
      tone: ultimateReady(unit) ? "buff" : "",
    });
  }
  (unit.statusEffects || [])
    .filter((effect) => effect.expiresOnTurn >= state.turn)
    .forEach((effect) => {
      const status = STATUS_EFFECTS[effect.key];
      statuses.push({
        label: `${status?.name || effect.key}/${effect.duration || 1}T`,
        tone: status?.kind === "buff" ? "buff" : "debuff",
      });
    });
  const incoming = unitStats(state, unit, { kind: "incoming", damage: 0 });
  const terrainId = state.terrain[unit.side][unit.row][unit.col];
  if (incoming.armor > 0) statuses.push({ label: armorStatusText(state, unit, incoming.armor), tone: "guard" });
  if (unit.card.abilityKey === "steady") statuses.push({ label: unit.firstHitReduced ? "初回済" : "初回-2", tone: "guard" });
  if (unit.card.abilityKey === "rearWard" && unit.col === 2) statuses.push({ label: "遠隔-3", tone: "guard" });
  if (terrainId === "rampart" && unit.col === 0) statuses.push({ label: "殻壁-4", tone: "guard" });
  if (unit.general && !isGeneralExposed(state, unit)) statuses.push({ label: TERMS.alphaGuarded, tone: "guard" });
  return statuses;
}

function statStatus(label, value, duration = null) {
  return {
    label: `${label}${signedValue(value)}${duration ? `/${duration}T` : ""}`,
    tone: value > 0 ? "buff" : "debuff",
  };
}

function signedValue(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function healAmountForActiveFrame(unitId) {
  if (!activeFrame || activeFrame.type !== "heal") return 0;
  const event = activeFrame.healEvents?.find((item) => item.targetId === unitId);
  if (event) return event.amount;
  return activeFrame.targetId === unitId ? activeFrame.amount || 0 : 0;
}

function attackDamageForActiveFrame(unitId) {
  if (!activeFrame || activeFrame.type !== "attack") return 0;
  const event = activeFrame.attackEvents?.find((item) => item.targetId === unitId);
  if (event) return event.damage;
  return activeFrame.targetId === unitId ? activeFrame.damage || 0 : 0;
}

function buffLabelsForActiveFrame(unitId) {
  if (!activeFrame) return [];
  return (activeFrame.buffEvents || [])
    .filter((event) => event.targetId === unitId)
    .flatMap((event) => {
      const labels = [];
      const duration = event.duration ? `/${event.duration}T` : "";
      if (event.at) labels.push(`AT${signedValue(event.at)}${duration}`);
      if (event.ag) labels.push(`AG${signedValue(event.ag)}${duration}`);
      if (event.armor) labels.push(`${TERMS.armor}${signedValue(event.armor)}${event.duration ? `/${event.duration}T` : ""}`);
      if (event.statusKey) labels.push(STATUS_EFFECTS[event.statusKey]?.name || event.statusKey);
      return labels;
    });
}

function actionName(unit) {
  return actions[actionFor(unit)].name;
}

function cardCostLabel(unit) {
  return unit.general ? `${TERMS.alpha}${alphaCardCost(unit.card)}` : `${TERMS.costShort}${normalCardCost(unit.card)}`;
}

function renderCosts(state) {
  const player = sideCost(state, "player");
  const enemy = sideCost(state, "enemy");
  els.playerCost.textContent = `${TERMS.cost} ${player.total}/${COST_LIMIT}・${player.cards}枚`;
  els.enemyCost.textContent = `${TERMS.cost} ${enemy.total}/${COST_LIMIT}・${enemy.cards}枚`;
  els.costSummary.textContent = `${TERMS.playerSide} ${player.total}(${player.cards}枚) / ${TERMS.enemySide} ${enemy.total}(${enemy.cards}枚)`;
  els.terrainCost.textContent = `${TERMS.playerSide}地形 ${player.terrain} / ${TERMS.enemySide}地形 ${enemy.terrain}`;
}

function sideCost(state, side) {
  const preset = currentPresetForSide(side);
  const units = createUnits(side, preset, state.terrain[side]);
  const cardCost = units.reduce((sum, unit) => sum + (unit.general ? alphaCardCost(unit.card) : normalCardCost(unit.card)), 0);
  const rawTerrain = terrainGridCost(state.terrain[side]);
  const discount = cards[preset.general].generalKey === "terrainDiscount" ? 2 : 0;
  const terrain = Math.max(0, rawTerrain - discount);
  return { cards: units.length, card: cardCost, terrain, total: cardCost + terrain };
}

function terrainGridCost(grid) {
  return grid.flat().reduce((sum, terrainId) => sum + terrainTypes[terrainId].cost, 0);
}

function actionComponents(actionKey) {
  const components = actions[actionKey]?.components;
  if (Array.isArray(components) && components.length > 0) return components;
  return [{ effectElements: ["wait"], targetPattern: "none" }];
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function actionEffectElementIds(actionKey) {
  return uniqueValues(actionComponents(actionKey).flatMap((component) => component.effectElements || []));
}

function actionTargetPatternIds(actionKey) {
  return uniqueValues(actionComponents(actionKey).map((component) => component.targetPattern));
}

function actionCategoryIds(actionKey) {
  return uniqueValues(actionEffectElementIds(actionKey)
    .map((effectId) => EFFECT_ELEMENTS[effectId]?.category)
    .filter((category) => category && category !== "none" && category !== "trait"));
}

function effectKindIds(effectElements) {
  return uniqueValues((effectElements || []).map((effectId) => EFFECT_ELEMENTS[effectId]?.category || effectId));
}

function targetKeyForPattern(targetPatternId) {
  const keys = {
    frontEnemy: "enemy:front",
    sameLaneFrontEnemy: "enemy:lane-front",
    sameLaneFrontTwoEnemies: "enemy:lane-front-two",
    frontRankEnemies: "enemy:front-rank",
    allEnemies: "enemy:all",
    rearEnemyPriority: "enemy:backline-search",
    lowestHpEnemy: "enemy:low-hp-search",
    armoredEnemyPriority: "enemy:armored",
    middleRearLowestHpEnemy: "enemy:backline-search",
    middleRearEnemies: "enemy:middle-rear",
    exposedAlphaOrFrontEnemy: "enemy:alpha-or-front",
    frontRankAllies: "ally:front-rank",
    allAllies: "ally:all",
    sameLaneAllies: "ally:lane",
    sameLaneDamagedAllies: "ally:lane-damaged",
    lowestHpAlly: "ally:low-hp",
    selfAndForwardAlly: "ally:self-forward",
    allyAlpha: "ally:alpha",
    self: "self",
    none: "none",
  };
  return keys[targetPatternId] || targetPatternId || "none";
}

function positionedTargetKeyForPattern(targetPatternId, position) {
  const baseKey = targetKeyForPattern(targetPatternId);
  if (!position || !["enemy:lane-front", "enemy:lane-front-two", "ally:lane", "ally:lane-damaged", "ally:self-forward"].includes(baseKey)) {
    return baseKey;
  }
  return `${baseKey}:lane-${position.row}`;
}

function estimateActionComponentOutput(card, actionKey, component, position = null) {
  const effectElements = component.effectElements || [];
  const damage = estimateActionDamage(card, actionKey, component.targetPattern, position);
  const support = estimateActionSupport(card, actionKey);
  const hasAttack = effectElements.some((effectId) => ["singleAttack", "areaAttack", "searchAttack"].includes(effectId));
  const hasArea = effectElements.includes("areaAttack");
  const hasHeal = effectElements.includes("heal");
  const hasArmor = effectElements.some((effectId) => ["armor", "barrier", "damageCut"].includes(effectId));
  const hasBuff = effectElements.some((effectId) => ["atBuff", "agBuff", "ultimateCharge"].includes(effectId));
  const hasDebuff = effectElements.some((effectId) => ["atDebuff", "agDebuff", "defenseDown", "healBlock", "barrierPierce", "contactPoison"].includes(effectId));
  const hasCounter = effectElements.some((effectId) => ["counter", "reflect", "contactPoison"].includes(effectId));
  const poisonDamage = effectElements.includes("poison") ? support.poisonDamage : 0;
  const estimatedOutput =
    (hasAttack ? (hasArea ? damage.totalDamage : damage.focusedDamage) : 0) +
    (hasHeal ? support.heal : 0) +
    (hasArmor ? support.armor : 0) +
    (hasBuff ? support.buff : 0) +
    (hasDebuff ? support.disruption : 0) +
    poisonDamage +
    (hasCounter ? support.counter : 0);
  return {
    total: roundScore(estimatedOutput),
    focusedDamage: roundScore(damage.focusedDamage),
    totalDamage: roundScore(damage.totalDamage),
    effectiveTargets: damage.effectiveTargets,
    heal: roundScore(support.heal),
    armor: roundScore(support.armor),
    buff: roundScore(support.buff),
    disruption: roundScore(support.disruption),
    poisonDamage: roundScore(poisonDamage),
    counter: roundScore(support.counter),
  };
}

function estimateActionDamage(card, actionKey, targetPatternId, position = null) {
  const at = card.at;
  const effectiveTargets = estimatedEffectiveTargets(targetPatternId);
  const slotId = slotIdForScorePosition(position);
  const single = {
    slash: at,
    guard: Math.max(6, Math.floor(at * GUARD_STRIKE_RATE)),
    heal: Math.max(5, Math.floor(at * PRAYER_STRIKE_RATE)),
    snipe: Math.max(5, at - SNIPE_DAMAGE_OFFSET),
    raid: Math.max(5, at - RAID_DAMAGE_OFFSET) + (card.abilityKey === "middleRaid" ? MIDDLE_RAID_BONUS : 0),
    siege: at + 6 + (card.abilityKey === "generalBreaker" ? 4 : 0),
    lowHpStrike: Math.max(5, at - LOW_HP_STRIKE_OFFSET) + (card.abilityKey === "executeHunter" ? 3 : 0),
    acidBite: Math.max(5, at - ACID_BITE_OFFSET),
    drainStrike: Math.max(5, at - DRAIN_DAMAGE_OFFSET) + BARRIER_PIERCE_ARMOR_BONUS_CAP,
    barrierPierceStrike: Math.max(5, at - BARRIER_PIERCE_OFFSET) + BARRIER_PIERCE_ARMOR_BONUS_CAP,
    sporeCrush: Math.max(6, at - SPORE_CRUSH_OFFSET),
  }[actionKey] || 0;
  const area = {
    pierce: Math.max(4, at - 5) + Math.max(4, at - 10),
    sweep: sweepDamageForScore(card, slotId) * effectiveTargets,
    acidSweepDefense: Math.max(4, at - ACID_SWEEP_OFFSET) * effectiveTargets,
    acidSweepHealBlock: Math.max(4, at - ACID_SWEEP_OFFSET) * effectiveTargets,
    midRearPressure: Math.max(4, at - MID_REAR_PRESSURE_OFFSET) * effectiveTargets,
    sporeBarrage: Math.max(5, at - SPORE_BARRAGE_OFFSET) * effectiveTargets,
  }[actionKey] || 0;
  const focused = actionKey === "pierce" ? Math.max(4, at - 5) : single || (area && effectiveTargets ? area / effectiveTargets : 0);
  return {
    focusedDamage: focused,
    totalDamage: area || single,
    effectiveTargets,
  };
}

function estimateActionSupport(card, actionKey) {
  const at = card.at;
  const support = {
    guard: {
      armor: armorTurnValueForEstimate(guardArmorForScore(card), "selfAndForwardAlly", STANDARD_ARMOR_DURATION),
      heal: 0,
      buff: 0,
      disruption: 0,
      poisonDamage: 0,
    },
    rally: {
      armor: 0,
      heal: 0,
      buff: RALLY_AT * RALLY_DURATION * 3,
      disruption: 0,
      poisonDamage: 0,
    },
    heal: {
      armor: card.abilityKey === "blessing" ? armorTurnValueForEstimate(BLESSING_ARMOR, "lowestHpAlly", STANDARD_ARMOR_DURATION) : 0,
      heal: Math.max(7, Math.floor(at * SINGLE_HEAL_RATE)),
      buff: 0,
      disruption: 0,
      poisonDamage: 0,
    },
    lineHeal: {
      armor: 0,
      heal: Math.max(6, Math.floor(at * LINE_HEAL_RATE) + (card.abilityKey === "widePrayer" ? WIDE_PRAYER_BONUS : 0)) * 1.8,
      buff: 0,
      disruption: 0,
      poisonDamage: 0,
    },
    generalWard: {
      armor: GENERAL_WARD_ARMOR + (card.abilityKey === "devotedWard" ? DEVOTED_WARD_BONUS : 0),
      heal: Math.max(5, Math.floor(at * GENERAL_WARD_HEAL_RATE)),
      buff: 0,
      disruption: 0,
      poisonDamage: 0,
    },
    command: {
      armor: 0,
      heal: 0,
      buff: COMMAND_AG + commandAtBonusForCard(card) * 4,
      disruption: 0,
      poisonDamage: 0,
    },
    selfAg: {
      armor: 0,
      heal: 0,
      buff: SELF_AG_BUFF,
      disruption: 0,
      poisonDamage: 0,
    },
    agSnare: {
      armor: 0,
      heal: 0,
      buff: 0,
      disruption: AG_DEBUFF + (card.abilityKey === "deepSnare" ? 2 : 0),
      poisonDamage: 0,
    },
    shellBind: {
      armor: armorTurnValueForEstimate(Math.max(8, Math.floor(guardArmorForScore(card) * 0.75)), "selfAndForwardAlly", STANDARD_ARMOR_DURATION),
      heal: 0,
      buff: 0,
      disruption: 0,
      poisonDamage: 0,
    },
    quickenUltimate: {
      armor: 0,
      heal: 0,
      buff: 18,
      disruption: 0,
      poisonDamage: 0,
    },
    acidBite: {
      armor: 0,
      heal: 0,
      buff: 0,
      disruption: 10,
      poisonDamage: 0,
    },
    acidSweepDefense: {
      armor: 0,
      heal: 0,
      buff: 0,
      disruption: DEFENSE_DOWN_DAMAGE * 3,
      poisonDamage: 0,
    },
    acidSweepHealBlock: {
      armor: 0,
      heal: 0,
      buff: 0,
      disruption: 10 * 3,
      poisonDamage: 0,
    },
    drainStrike: {
      armor: 0,
      heal: Math.floor((Math.max(5, at - DRAIN_DAMAGE_OFFSET) + BARRIER_PIERCE_ARMOR_BONUS_CAP) * DRAIN_HEAL_RATE),
      buff: 0,
      disruption: BARRIER_PIERCE_ARMOR_BONUS_CAP,
      poisonDamage: 0,
    },
    barrierPierceStrike: {
      armor: 0,
      heal: 0,
      buff: 0,
      disruption: 12,
      poisonDamage: 0,
    },
    healBlockPulse: {
      armor: 0,
      heal: 0,
      buff: 0,
      disruption: 12,
      poisonDamage: 0,
    },
    sporeBarrage: {
      armor: 0,
      heal: 0,
      buff: 0,
      disruption: 0,
      poisonDamage: POISON_DAMAGE * POISON_DURATION * estimatedEffectiveTargets("frontRankEnemies"),
    },
    toxicNeedle: {
      armor: 0,
      heal: 0,
      buff: 0,
      disruption: 0,
      poisonDamage: POISON_DAMAGE * POISON_DURATION,
    },
    toxicCloud: {
      armor: 0,
      heal: 0,
      buff: 0,
      disruption: 0,
      poisonDamage: POISON_DAMAGE * POISON_DURATION * estimatedEffectiveTargets("frontRankEnemies"),
    },
    thornGuard: {
      armor: THORN_GUARD_ARMOR,
      heal: 0,
      buff: 0,
      disruption: POISON_DAMAGE * POISON_DURATION * 0.65,
      poisonDamage: 0,
      counter: POISON_DAMAGE * POISON_DURATION * 0.85,
    },
    mirrorShell: {
      armor: MIRROR_SHELL_ARMOR,
      heal: 0,
      buff: 0,
      disruption: 0,
      poisonDamage: 0,
      counter: REFLECT_DAMAGE_CAP * 0.95,
    },
    selfUltimateCharge: {
      armor: 0,
      heal: 0,
      buff: 14,
      disruption: 0,
      poisonDamage: 0,
    },
  }[actionKey];
  return normalizeEstimatedSupport(support);
}

function normalizeEstimatedSupport(support) {
  return {
    armor: support?.armor || 0,
    heal: support?.heal || 0,
    buff: support?.buff || 0,
    disruption: support?.disruption || 0,
    poisonDamage: support?.poisonDamage || 0,
    counter: support?.counter || 0,
  };
}

function estimatedEffectiveTargets(targetPatternId) {
  const explicit = {
    sameLaneFrontTwoEnemies: 2,
    frontRankEnemies: 3,
    allEnemies: 6,
    middleRearEnemies: 4,
    frontRankAllies: 3,
    allAllies: 6,
    sameLaneAllies: 2,
    sameLaneDamagedAllies: 2,
    selfAndForwardAlly: 2,
  };
  if (explicit[targetPatternId]) return explicit[targetPatternId];
  const pattern = TARGET_PATTERNS[targetPatternId];
  if (!pattern) return 0;
  if (pattern.shape === "none") return 0;
  if (pattern.shape === "single") return 1;
  if (pattern.shape === "line" || pattern.shape === "lane") return 2;
  if (pattern.shape === "rank") return 3;
  if (pattern.shape === "all") return 6;
  return 1;
}

function buildCardActionSearchIndex(cardCollection, phase = ACTIVE_RULESET_PHASE) {
  return Object.entries(cardCollection).filter(([, card]) => isCardAvailable(card, phase)).flatMap(([cardId, card]) => ACTION_SLOTS.flatMap((slot) => {
    const actionId = card[slot.cardKey];
    const action = actions[actionId];
    if (!action) return [];
    return actionComponents(actionId).map((component, componentIndex) => {
      const estimated = estimateActionComponentOutput(card, actionId, component, slot.id);
      return {
        cardId,
        cardName: card.name,
        slot: slot.id,
        slotLabel: slot.label,
        position: slot.id,
        actionId,
        actionName: action.name,
        componentIndex,
        effectElements: [...(component.effectElements || [])],
        effectKinds: effectKindIds(component.effectElements || []),
        targetPattern: component.targetPattern,
        targetKey: targetKeyForPattern(component.targetPattern),
        estimatedOutput: estimated.total,
        estimated,
      };
    });
  }));
}

function findCardActionRecords({ slot = null, effectElement = null, targetPattern = null } = {}) {
  return CARD_ACTION_SEARCH_INDEX.filter((record) => {
    if (slot && record.slot !== slot) return false;
    if (effectElement && !record.effectElements.includes(effectElement)) return false;
    if (targetPattern && record.targetPattern !== targetPattern) return false;
    return true;
  });
}

function actionSearchSummary(actionKey) {
  const effectLabels = actionEffectElementIds(actionKey).map((effectId) => EFFECT_ELEMENTS[effectId]?.name || effectId);
  const targetLabels = actionTargetPatternIds(actionKey).map((targetId) => TARGET_PATTERNS[targetId]?.name || targetId);
  return `${effectLabels.join(" / ")} -> ${targetLabels.join(" / ")}`;
}

function renderSelectedCard(state) {
  let unit = selectedUnitId ? state.units.find((item) => item.id === selectedUnitId) : null;
  if (!unit && selectedCardId && cards[selectedCardId]) {
    unit = previewUnitForCard(selectedCardId);
  }
  if (!unit) unit = generalOf(state, "player");
  if (!unit) {
    els.selectedCardName.textContent = "選択なし";
    els.cardDetail.innerHTML = "";
    return;
  }
  els.selectedCardName.textContent = unit.preview ? `${unit.card.name} / 図鑑` : unit.general ? `${unit.card.name} / ${TERMS.alpha}` : unit.card.name;
  const stats = unitStats(state, unit);
  els.cardDetail.innerHTML = `
    <div class="detail-grid">
      <div class="detail-cell"><span>HP</span><strong>${unit.hp}/${unit.maxHp}</strong></div>
      <div class="detail-cell"><span>AT</span><strong>${stats.at}</strong></div>
      <div class="detail-cell"><span>AG</span><strong>${stats.ag}</strong></div>
      <div class="detail-cell"><span>${TERMS.cost}</span><strong>${cardCostPairShort(unit.card)}</strong></div>
    </div>
    ${cardScoreMarkup(unit.cardId)}
    <div class="tag-line">${cardBadgeMarkup(unit.card)}</div>
    ${unit.preview ? "" : `<div class="detail-actions"><button type="button" class="secondary" data-general-unit="${unit.id}">${unit.general ? TERMS.alphaAssigned : TERMS.alphaAssign}</button></div>`}
    <div class="action-list">
      ${actionVisualMarkup(state, unit, TERMS.rankShort[0], unit.card.front)}
      ${actionVisualMarkup(state, unit, TERMS.rankShort[1], unit.card.middle)}
      ${actionVisualMarkup(state, unit, TERMS.rankShort[2], unit.card.rear)}
    </div>
    ${ultimateDetailMarkup(state, unit)}
    <div class="terrain-item"><strong>軽減</strong><span>${defenseDetail(state, unit)}</span></div>
    <div class="terrain-item"><strong>能力</strong><span>${uiText(unit.card.ability)}</span></div>
    <div class="terrain-item"><strong>${TERMS.alphaTrait}</strong><span>${uiText(unit.card.generalSkill)}</span></div>
    <div class="terrain-item"><strong>図鑑</strong><span>${uiText(unit.card.codexText || "")}</span></div>
    ${cardEditorMarkup(unit.cardId)}
  `;
}

function cardScoreMarkup(cardId) {
  if (!cards[cardId]) return "";
  const score = scoreCard(cardId);
  return `
    <div class="card-score-card">
      <div class="score-grid">
        ${scoreCellMarkup(TERMS.normal, `${score.normalTotal}`, `${TERMS.costShort}${score.normalCost} / ${score.normalJudgment}`, costBandText("normal", score.normalCost))}
        ${scoreCellMarkup(TERMS.alpha, `${score.alphaTotal}`, `${TERMS.alpha}${score.alphaCost} / ${score.alphaJudgment}`, costBandText("alpha", score.alphaCost))}
        ${scoreCellMarkup("素体", `${score.statScore}`, `行動 ${score.actionScore}`, `能力 ${score.abilityScore}`)}
        ${scoreCellMarkup("必殺/α", `${score.ultimateScore}`, `特性 ${score.alphaTraitScore}`, `αHP ${score.alphaHpScore}`)}
      </div>
    </div>
  `;
}

function scoreCellMarkup(label, value, note, subnote) {
  return `
    <div class="result-cell score-cell">
      <span>${uiText(label)}</span>
      <strong>${uiText(value)}</strong>
      <small>${uiText(note)}</small>
      <small>${uiText(subnote)}</small>
    </div>
  `;
}

function costBandText(kind, cost) {
  const band = SCORING_RULES.costBands[kind]?.[cost];
  return band ? `基準 ${band[0]}-${band[1]}` : "基準外";
}

function cardEditorMarkup(cardId) {
  const card = cards[cardId];
  if (!card) return "";
  const dirty = isCardEdited(cardId);
  const custom = isCustomCard(cardId);
  return `
    <form class="card-editor" data-card-editor="${attrEscape(cardId)}">
      <div class="card-editor-head">
        <strong>調整</strong>
        <span class="cost-pill">${custom ? "追加カード" : dirty ? "調整中" : "初期値"}</span>
      </div>
      <div class="card-editor-grid">
        ${cardTextInputMarkup("name", "名前", card.name, 24)}
        ${cardSelectMarkup("rarity", "レア", rarityOptionEntries(), card.rarity)}
        ${cardSelectMarkup("classification", "分類", classificationOptionEntries(), card.classification)}
        ${cardNumberInputMarkup("hp", "HP", card.hp)}
        ${cardNumberInputMarkup("at", "AT", card.at)}
        ${cardNumberInputMarkup("ag", "AG", card.ag)}
        ${cardNumberInputMarkup("cost", TERMS.cost, normalCardCost(card))}
        ${cardNumberInputMarkup("alphaCost", `${TERMS.alpha}${TERMS.cost}`, alphaCardCost(card))}
      </div>
      <div class="card-editor-grid action-editor-grid">
        ${cardSelectMarkup("front", TERMS.ranks[0], actionOptionEntries(), card.front)}
        ${cardSelectMarkup("middle", TERMS.ranks[1], actionOptionEntries(), card.middle)}
        ${cardSelectMarkup("rear", TERMS.ranks[2], actionOptionEntries(), card.rear)}
        ${cardSelectMarkup("abilityKey", "能力キー", ABILITY_KEY_OPTIONS, card.abilityKey)}
        ${cardSelectMarkup("generalKey", `${TERMS.alpha}キー`, GENERAL_KEY_OPTIONS, card.generalKey)}
        ${cardSelectMarkup("ultimateKey", "必殺キー", ultimateOptionEntries(), card.ultimate?.key || "__none")}
        ${cardTextInputMarkup("ultimateName", "必殺名", card.ultimate?.name || "", 24)}
        ${cardNumberInputMarkup("ultimateTurns", "必殺T", card.ultimate?.turns || ULTIMATE_RULES.defaultTurns)}
      </div>
      ${cardChecklistMarkup("traits", "特性", traitOptionEntries(), card.traits || [])}
      ${cardChecklistMarkup("tags", "タグ", tagOptionEntries(), card.tags || [])}
      <div class="card-editor-grid text-editor-grid">
        ${cardTextareaMarkup("ability", "能力文", card.ability || "")}
        ${cardTextareaMarkup("generalSkill", `${TERMS.alphaTrait}文`, card.generalSkill || "")}
        ${cardTextareaMarkup("codexText", "図鑑", card.codexText || "")}
      </div>
      <div class="button-row card-editor-actions">
        <button type="button" class="secondary" data-card-edit-action="duplicate-card" data-card-id="${attrEscape(cardId)}">複製して新規</button>
        ${custom
          ? `<button type="button" class="secondary danger-button" data-card-edit-action="delete-card" data-card-id="${attrEscape(cardId)}">追加カード削除</button>`
          : `<button type="button" class="secondary" data-card-edit-action="reset-card" data-card-id="${attrEscape(cardId)}">カード初期化</button>`}
        <button type="button" class="secondary" data-card-edit-action="reset-all">既存カード初期化</button>
      </div>
    </form>
  `;
}

function cardTextInputMarkup(field, label, value, maxlength) {
  return `
    <label>
      ${uiText(label)}
      <input type="text" data-card-field="${attrEscape(field)}" value="${attrEscape(value || "")}" maxlength="${maxlength}" />
    </label>
  `;
}

function cardNumberInputMarkup(field, label, value) {
  const rule = CARD_EDIT_NUMBER_FIELDS[field] || CARD_EDIT_NUMBER_FIELDS.hp;
  return `
    <label>
      ${uiText(label)}
      <input type="number" data-card-field="${attrEscape(field)}" value="${Number(value) || 0}" min="${rule.min}" max="${rule.max}" step="1" />
    </label>
  `;
}

function cardSelectMarkup(field, label, options, selectedValue) {
  return `
    <label>
      ${uiText(label)}
      <select data-card-field="${attrEscape(field)}">
        ${selectOptionsMarkup(options, selectedValue)}
      </select>
    </label>
  `;
}

function cardTextareaMarkup(field, label, value) {
  return `
    <label class="wide-field">
      ${uiText(label)}
      <textarea data-card-field="${attrEscape(field)}" rows="2">${attrEscape(value || "")}</textarea>
    </label>
  `;
}

function selectOptionsMarkup(options, selectedValue) {
  return options.map((option) => `
    <option value="${attrEscape(option.id)}"${option.id === selectedValue ? " selected" : ""}>${uiText(option.name)}</option>
  `).join("");
}

function cardChecklistMarkup(field, label, options, selectedValues) {
  const selected = new Set(selectedValues);
  return `
    <fieldset class="card-checks">
      <legend>${uiText(label)}</legend>
      <div class="card-check-grid">
        ${options.map((option) => `
          <label>
            <input type="checkbox" data-card-list-field="${attrEscape(field)}" value="${attrEscape(option.id)}"${selected.has(option.id) ? " checked" : ""} />
            <span>${uiText(option.name)}</span>
          </label>
        `).join("")}
      </div>
    </fieldset>
  `;
}

function rarityOptionEntries() {
  return Object.entries(RARITIES).map(([id, rarity]) => ({ id, name: rarity.name }));
}

function classificationOptionEntries() {
  return Object.entries(CLASSIFICATIONS).map(([id, classification]) => ({ id, name: classification.name }));
}

function actionOptionEntries() {
  return Object.entries(actions).map(([id, action]) => ({ id, name: `${action.name} / ${id}` }));
}

function ultimateOptionEntries() {
  return [
    { id: "__none", name: "なし" },
    ...Object.entries(ultimateActions).map(([id, action]) => ({ id, name: `${action.text} / ${id}` })),
  ];
}

function traitOptionEntries() {
  return Object.entries(TRAITS).map(([id, trait]) => ({ id, name: trait.name }));
}

function tagOptionEntries() {
  return CARD_TAG_OPTIONS.map((id) => ({ id, name: tagLabel(id) }));
}

function handleCardEditorChange(event) {
  const control = event.target.closest("[data-card-field], [data-card-list-field]");
  if (!control) return;
  const form = control.closest("[data-card-editor]");
  const cardId = form?.dataset.cardEditor;
  if (!cardId || !cards[cardId]) return;

  if (control.dataset.cardListField) {
    applyCardListField(cardId, control.dataset.cardListField, form);
  } else {
    applyCardField(cardId, control.dataset.cardField, control.value);
  }

  saveCardEdits();
  setEditorMessage(`${cards[cardId].name}を調整しました。`);
  refreshAfterCardEdit(cardId);
}

function handleCardEditorAction(button) {
  const action = button.dataset.cardEditAction;
  const cardId = button.dataset.cardId || button.closest("[data-card-editor]")?.dataset.cardEditor || selectedCardId;
  if (action === "duplicate-card" && cardId && cards[cardId]) {
    createNewCard(cardId);
    return;
  }
  if (action === "delete-card" && cardId && isCustomCard(cardId)) {
    deleteCustomCard(cardId);
    return;
  }
  if (action === "reset-card" && cardId && BASE_CARDS[cardId]) {
    resetCardEdit(cardId);
    setEditorMessage(`${cards[cardId].name}を初期値に戻しました。`);
    refreshAfterCardEdit(cardId);
    return;
  }
  if (action === "reset-all") {
    resetAllCardEdits();
    setEditorMessage("既存カードを初期値に戻しました。");
    refreshAfterCardEdit(cardId && cards[cardId] ? cardId : selectedCardId);
  }
}

function createNewCard(sourceCardId = null) {
  const cardId = uniqueCustomCardId();
  cards[cardId] = sourceCardId && cards[sourceCardId]
    ? customCardFromSource(cards[sourceCardId])
    : blankCustomCard(nextCustomCardName());
  selectedCardId = cardId;
  selectedUnitId = null;
  saveCardEdits();
  refreshDerivedCardData();
  renderPresetSelectors();
  setEditorMessage(`${cards[cardId].name}を追加しました。`);
  refreshAfterCardEdit(cardId, { skipDerivedRefresh: true });
}

function deleteCustomCard(cardId) {
  const deletedName = cards[cardId]?.name || "追加カード";
  delete cards[cardId];
  removeCardFromSetup("player", cardId);
  removeCardFromSetup("enemy", cardId);
  removeCardFromCustomPresets(cardId);
  selectedCardId = firstCardId();
  selectedUnitId = null;
  saveCardEdits();
  saveCustomPresets();
  refreshDerivedCardData();
  renderPresetSelectors();
  setEditorMessage(`${deletedName}を削除しました。`);
  refreshAfterCardEdit(selectedCardId, { skipDerivedRefresh: true });
}

function removeCardFromSetup(side, cardId) {
  setup[`${side}Units`] = sortUnits((setup[`${side}Units`] || []).filter(([unitCardId]) => unitCardId !== cardId));
  repairGeneral(side);
}

function removeCardFromCustomPresets(cardId) {
  for (let index = presets.length - 1; index >= 0; index -= 1) {
    const preset = presets[index];
    if (preset.kind !== "custom") continue;
    preset.units = sortUnits((preset.units || []).filter(([unitCardId]) => unitCardId !== cardId));
    if (preset.units.length === 0) {
      presets.splice(index, 1);
      continue;
    }
    if (!preset.units.some(([unitCardId]) => unitCardId === preset.general)) {
      preset.general = preset.units[0][0];
    }
  }
  normalizeSelectedPresets();
}

function uniqueCustomCardId() {
  let id = `customCard-${Date.now().toString(36)}`;
  let suffix = 2;
  while (cards[id]) {
    id = `customCard-${Date.now().toString(36)}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function nextCustomCardName() {
  const count = Object.keys(cards).filter((cardId) => isCustomCard(cardId)).length + 1;
  return `新カード${count}`;
}

function firstCardId() {
  return Object.keys(cards)[0] || null;
}

function customCardFromSource(sourceCard) {
  const card = cloneCard(sourceCard);
  card.name = `${sourceCard.name}コピー`.slice(0, 24);
  card.codexText = card.codexText || "複製から作成した試作カード。";
  return normalizeCardForStorage(card);
}

function blankCustomCard(name) {
  return normalizeCardForStorage({
    name,
    rarity: "common",
    classification: "mammal",
    traits: [],
    roles: ["attack"],
    hp: 100,
    at: 30,
    ag: 30,
    cost: 4,
    alphaCost: 6,
    soldierCost: 4,
    generalCost: 6,
    tags: [],
    preferredTerrain: ["plain"],
    ability: "調整中。",
    abilityKey: "none",
    generalSkill: "なし。",
    generalKey: "none",
    ultimate: { name: "新必殺", turns: ULTIMATE_RULES.defaultTurns, key: "alphaClaw" },
    front: "slash",
    middle: "slash",
    rear: "wait",
    codexText: "試作中の新カード。",
  });
}

function applyCardField(cardId, field, value) {
  const card = cards[cardId];
  if (!card || !field) return;
  if (["hp", "at", "ag", "cost", "alphaCost", "ultimateTurns"].includes(field)) {
    applyCardNumberField(card, field, value);
    return;
  }
  if (["name", "ability", "generalSkill", "codexText", "ultimateName"].includes(field)) {
    applyCardTextField(cardId, field, value);
    return;
  }
  if (field === "rarity" && RARITIES[value]) card.rarity = value;
  if (field === "classification" && CLASSIFICATIONS[value]) card.classification = value;
  if (field === "abilityKey" && optionExists(ABILITY_KEY_OPTIONS, value)) card.abilityKey = value;
  if (field === "generalKey" && optionExists(GENERAL_KEY_OPTIONS, value)) card.generalKey = value;
  if (["front", "middle", "rear"].includes(field) && actions[value]) card[field] = value;
  if (field === "ultimateKey") applyCardUltimateKey(card, value);
}

function applyCardNumberField(card, field, value) {
  const rule = CARD_EDIT_NUMBER_FIELDS[field];
  if (!rule) return;
  const fallback = field === "ultimateTurns" ? card.ultimate?.turns || ULTIMATE_RULES.defaultTurns : card[field] || rule.min;
  const nextValue = boundedInteger(value, fallback, rule.min, rule.max);
  if (field === "cost") {
    card.cost = nextValue;
    card.soldierCost = nextValue;
    return;
  }
  if (field === "alphaCost") {
    card.alphaCost = nextValue;
    card.generalCost = nextValue;
    return;
  }
  if (field === "ultimateTurns") {
    ensureCardUltimate(card).turns = nextValue;
    return;
  }
  card[field] = nextValue;
}

function applyCardTextField(cardId, field, value) {
  const card = cards[cardId];
  const limits = { name: 24, ability: 120, generalSkill: 120, codexText: 180, ultimateName: 24 };
  const nextValue = normalizeCardText(value, limits[field] || 80);
  if (field === "name") {
    card.name = nextValue || BASE_CARDS[cardId]?.name || "新カード";
    return;
  }
  if (field === "ultimateName") {
    ensureCardUltimate(card).name = nextValue || "必殺技";
    return;
  }
  card[field] = nextValue;
}

function applyCardUltimateKey(card, value) {
  if (value === "__none") {
    card.ultimate = null;
    return;
  }
  if (!ultimateActions[value]) return;
  const ultimate = ensureCardUltimate(card);
  ultimate.key = value;
  if (!ultimate.name) ultimate.name = "必殺技";
}

function applyCardListField(cardId, field, form) {
  const card = cards[cardId];
  if (!card) return;
  const allowed = field === "traits" ? Object.keys(TRAITS) : CARD_TAG_OPTIONS;
  card[field] = uniqueValues([...form.querySelectorAll(`[data-card-list-field="${field}"]:checked`)]
    .map((item) => item.value)
    .filter((value) => allowed.includes(value)));
}

function refreshAfterCardEdit(cardId, options = {}) {
  stopReplay();
  if (cardId && cards[cardId]) selectedCardId = cardId;
  selectedUnitId = null;
  lastState = null;
  lastBattleLog = null;
  lastSeriesStats = null;
  activeFrame = null;
  if (!options.skipDerivedRefresh) {
    refreshDerivedCardData();
    renderPresetSelectors();
  }
  renderCardPicker();
  if (selectedCardId) els.cardPicker.value = selectedCardId;
  renderReferences();
  renderGenerationSummary();
  renderSetup();
}

function resetCardEdit(cardId) {
  replaceCardData(cardId, BASE_CARDS[cardId]);
  saveCardEdits();
}

function resetAllCardEdits() {
  Object.keys(BASE_CARDS).forEach((cardId) => replaceCardData(cardId, BASE_CARDS[cardId]));
  saveCardEdits();
}

function replaceCardData(cardId, sourceCard) {
  if (!cards[cardId] || !sourceCard) return;
  Object.keys(cards[cardId]).forEach((key) => {
    delete cards[cardId][key];
  });
  Object.assign(cards[cardId], cloneCard(sourceCard));
  cards[cardId].cost ??= cards[cardId].soldierCost;
  cards[cardId].alphaCost ??= cards[cardId].generalCost;
}

function applyStoredCardEdits() {
  const stored = loadStoredCardEdits();
  Object.entries(stored.additions).forEach(([cardId, cardData]) => {
    addStoredCustomCard(cardId, cardData);
  });
  const edits = stored.edits;
  Object.entries(edits).forEach(([cardId, patch]) => {
    applyCardPatch(cardId, patch);
  });
}

function loadStoredCardEdits() {
  const storage = safeLocalStorage();
  if (!storage) return { edits: {}, additions: {} };
  try {
    const raw = JSON.parse(storage.getItem(CARD_TUNING_STORAGE_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { edits: {}, additions: {} };
    if (raw.edits || raw.additions) {
      return {
        edits: raw.edits && typeof raw.edits === "object" && !Array.isArray(raw.edits) ? raw.edits : {},
        additions: raw.additions && typeof raw.additions === "object" && !Array.isArray(raw.additions) ? raw.additions : {},
      };
    }
    return { edits: raw, additions: {} };
  } catch {
    return { edits: {}, additions: {} };
  }
}

function saveCardEdits() {
  const storage = safeLocalStorage();
  if (!storage) return;
  const edits = Object.fromEntries(Object.keys(BASE_CARDS)
    .map((cardId) => [cardId, cardEditPatch(cardId)])
    .filter(([, patch]) => Object.keys(patch).length > 0));
  const additions = Object.fromEntries(Object.keys(cards)
    .filter((cardId) => isCustomCard(cardId))
    .map((cardId) => [cardId, normalizeCardForStorage(cards[cardId])]));
  if (Object.keys(edits).length === 0 && Object.keys(additions).length === 0) {
    storage.removeItem(CARD_TUNING_STORAGE_KEY);
    return;
  }
  storage.setItem(CARD_TUNING_STORAGE_KEY, JSON.stringify({ edits, additions }));
}

function cardEditPatch(cardId) {
  const card = cards[cardId];
  const base = BASE_CARDS[cardId];
  if (!card || !base) return {};
  const fields = ["name", "rarity", "classification", "traits", "tags", "hp", "at", "ag", "cost", "alphaCost", "ability", "abilityKey", "generalSkill", "generalKey", "front", "middle", "rear", "codexText"];
  const patch = {};
  fields.forEach((field) => {
    if (!sameCardField(card[field], base[field])) patch[field] = cloneCardValue(card[field]);
  });
  if (!sameCardField(card.ultimate || null, base.ultimate || null)) {
    patch.ultimate = card.ultimate ? cloneCardValue(card.ultimate) : null;
  }
  return patch;
}

function isCardEdited(cardId) {
  if (isCustomCard(cardId)) return true;
  return Object.keys(cardEditPatch(cardId)).length > 0;
}

function isCustomCard(cardId) {
  return Boolean(cardId && cards[cardId] && !BASE_CARDS[cardId]);
}

function addStoredCustomCard(cardId, cardData) {
  if (!isStoredCustomCardId(cardId) || cards[cardId]) return;
  cards[cardId] = normalizeCardForStorage(cardData);
}

function isStoredCustomCardId(cardId) {
  return typeof cardId === "string" && /^customCard-[a-z0-9-]+$/i.test(cardId) && !BASE_CARDS[cardId];
}

function applyCardPatch(cardId, patch) {
  const card = cards[cardId];
  const base = BASE_CARDS[cardId];
  if (!card || !base || !patch || typeof patch !== "object" || Array.isArray(patch)) return;
  ["name", "ability", "generalSkill", "codexText"].forEach((field) => {
    if (typeof patch[field] === "string") applyCardTextField(cardId, field, patch[field]);
  });
  ["hp", "at", "ag", "cost", "alphaCost"].forEach((field) => {
    if (patch[field] !== undefined) applyCardNumberField(card, field, patch[field]);
  });
  if (RARITIES[patch.rarity]) card.rarity = patch.rarity;
  if (CLASSIFICATIONS[patch.classification]) card.classification = patch.classification;
  if (Array.isArray(patch.traits)) card.traits = sanitizeCardList(patch.traits, Object.keys(TRAITS));
  if (Array.isArray(patch.tags)) card.tags = sanitizeCardList(patch.tags, CARD_TAG_OPTIONS);
  if (optionExists(ABILITY_KEY_OPTIONS, patch.abilityKey)) card.abilityKey = patch.abilityKey;
  if (optionExists(GENERAL_KEY_OPTIONS, patch.generalKey)) card.generalKey = patch.generalKey;
  ["front", "middle", "rear"].forEach((field) => {
    if (actions[patch[field]]) card[field] = patch[field];
  });
  if (patch.ultimate === null) card.ultimate = null;
  if (patch.ultimate && typeof patch.ultimate === "object") {
    const key = ultimateActions[patch.ultimate.key] ? patch.ultimate.key : base.ultimate?.key;
    if (key && ultimateActions[key]) {
      card.ultimate = {
        name: normalizeCardText(patch.ultimate.name || base.ultimate?.name || "必殺技", 24),
        turns: boundedInteger(patch.ultimate.turns, base.ultimate?.turns || ULTIMATE_RULES.defaultTurns, CARD_EDIT_NUMBER_FIELDS.ultimateTurns.min, CARD_EDIT_NUMBER_FIELDS.ultimateTurns.max),
        key,
      };
    }
  }
}

function sanitizeCardList(values, allowedValues) {
  return uniqueValues(values.map((value) => String(value)).filter((value) => allowedValues.includes(value)));
}

function normalizeCardForStorage(card) {
  const base = card && typeof card === "object" ? card : {};
  const cost = boundedInteger(base.cost ?? base.soldierCost, 4, CARD_EDIT_NUMBER_FIELDS.cost.min, CARD_EDIT_NUMBER_FIELDS.cost.max);
  const alphaCost = boundedInteger(base.alphaCost ?? base.generalCost, 6, CARD_EDIT_NUMBER_FIELDS.alphaCost.min, CARD_EDIT_NUMBER_FIELDS.alphaCost.max);
  return {
    unlockPhase: base.unlockPhase === undefined ? "core" : String(base.unlockPhase),
    implemented: base.implemented === undefined ? true : base.implemented === true,
    name: normalizeCardText(base.name || "新カード", 24) || "新カード",
    rarity: RARITIES[base.rarity] ? base.rarity : "common",
    classification: CLASSIFICATIONS[base.classification] ? base.classification : "mammal",
    traits: sanitizeCardList(Array.isArray(base.traits) ? base.traits : [], Object.keys(TRAITS)),
    roles: sanitizeCardList(Array.isArray(base.roles) ? base.roles : ["attack"], Object.keys(ROLES)),
    hp: boundedInteger(base.hp, 100, CARD_EDIT_NUMBER_FIELDS.hp.min, CARD_EDIT_NUMBER_FIELDS.hp.max),
    at: boundedInteger(base.at, 30, CARD_EDIT_NUMBER_FIELDS.at.min, CARD_EDIT_NUMBER_FIELDS.at.max),
    ag: boundedInteger(base.ag, 30, CARD_EDIT_NUMBER_FIELDS.ag.min, CARD_EDIT_NUMBER_FIELDS.ag.max),
    cost,
    alphaCost,
    soldierCost: cost,
    generalCost: alphaCost,
    tags: sanitizeCardList(Array.isArray(base.tags) ? base.tags : [], CARD_TAG_OPTIONS),
    preferredTerrain: sanitizeCardList(Array.isArray(base.preferredTerrain) ? base.preferredTerrain : ["plain"], Object.keys(terrainTypes)),
    ability: normalizeCardText(base.ability || "調整中。", 120),
    abilityKey: optionExists(ABILITY_KEY_OPTIONS, base.abilityKey) ? base.abilityKey : "none",
    generalSkill: normalizeCardText(base.generalSkill || "なし。", 120),
    generalKey: optionExists(GENERAL_KEY_OPTIONS, base.generalKey) ? base.generalKey : "none",
    ultimate: normalizeCardUltimate(base.ultimate),
    front: actions[base.front] ? base.front : "slash",
    middle: actions[base.middle] ? base.middle : "slash",
    rear: actions[base.rear] ? base.rear : "wait",
    codexText: normalizeCardText(base.codexText || "試作中の新カード。", 180),
  };
}

function normalizeCardUltimate(ultimate) {
  if (ultimate === null) return null;
  const source = ultimate && typeof ultimate === "object" ? ultimate : {};
  const key = ultimateActions[source.key] ? source.key : "alphaClaw";
  return {
    name: normalizeCardText(source.name || "新必殺", 24) || "新必殺",
    turns: boundedInteger(source.turns, ULTIMATE_RULES.defaultTurns, CARD_EDIT_NUMBER_FIELDS.ultimateTurns.min, CARD_EDIT_NUMBER_FIELDS.ultimateTurns.max),
    key,
  };
}

function ensureCardUltimate(card) {
  if (!card.ultimate) {
    card.ultimate = { name: "必殺技", turns: ULTIMATE_RULES.defaultTurns, key: "alphaClaw" };
  }
  if (!ultimateActions[card.ultimate.key]) card.ultimate.key = "alphaClaw";
  return card.ultimate;
}

function optionExists(options, id) {
  return options.some((option) => option.id === id);
}

function boundedInteger(value, fallback, min, max) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function normalizeCardText(value, maxLength) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cloneCardPool(pool) {
  return Object.fromEntries(Object.entries(pool).map(([cardId, card]) => [cardId, cloneCard(card)]));
}

function cloneCard(card) {
  return cloneCardValue(card);
}

function cloneCardValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function sameCardField(left, right) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
  }
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function previewUnitForCard(cardId) {
  const card = cards[cardId];
  return {
    id: `preview-${cardId}`,
    side: "player",
    cardId,
    card,
    row: 1,
    col: 1,
    hp: card.hp,
    maxHp: card.hp,
    general: false,
    preview: true,
    tempAt: 0,
    tempAg: 0,
    armorEffects: [],
    statEffects: [],
    statusEffects: [],
    ultimateCharge: 0,
    firstHitReduced: false,
    movedFromRear: false,
    terrain: "平地",
  };
}

function actionDetail(state, unit, label, actionKey) {
  const action = actions[actionKey];
  return `
    <div class="action-item">
      <strong>${label}</strong>
      <div>
        <b>${action.name}</b>
        <span>${uiText(action.text)}</span>
        <span class="formula-line">${uiText(actionFormulaText(state, unit, actionKey))}</span>
      </div>
    </div>
  `;
}

function actionFormulaText(state, unit, actionKey) {
  return uiText(rawActionFormulaText(state, unit, actionKey));
}

function rawActionFormulaText(state, unit, actionKey) {
  const at = unitStats(state, unit).at;
  if (actionKey === "slash") return `式: AT×1.0 = ${at}ダメージ`;
  if (actionKey === "pierce") {
    return `式: 1体目 max(4, AT-5) = ${Math.max(4, at - 5)} / 2体目 max(4, AT-10) = ${Math.max(4, at - 10)}ダメージ / 守られたαは×0.6`;
  }
  if (actionKey === "sweep") {
    const rearBonus = unit.card.abilityKey === "rearCannon" ? ` / 後衛なら能力で+${REAR_CANNON_BONUS}` : "";
    return `式: max(4, AT-${SWEEP_DAMAGE_OFFSET}) = ${Math.max(4, at - SWEEP_DAMAGE_OFFSET)}ダメージ${rearBonus}`;
  }
  if (actionKey === "guard") {
    return `式: 装甲+${guardArmorFor(state, unit)}/${STANDARD_ARMOR_DURATION}T、反撃 max(6, floor(AT×${GUARD_STRIKE_RATE})) = ${guardStrikeDamageFor(state, unit)}ダメージ（装甲無視）${unit.card.abilityKey === "rampartCraft" ? "（殻壁上なら装甲+5込み）" : ""}`;
  }
  if (actionKey === "rally") return `式: 味方前衛にAT+${RALLY_AT}/${RALLY_DURATION}T`;
  if (actionKey === "heal") {
    const blessing = unit.card.abilityKey === "blessing" ? ` / 能力で装甲+${BLESSING_ARMOR}/${STANDARD_ARMOR_DURATION}T` : "";
    return `式: max(7, floor(AT×${SINGLE_HEAL_RATE})) = ${Math.max(7, Math.floor(at * SINGLE_HEAL_RATE))}回復、反撃 max(5, floor(AT×${PRAYER_STRIKE_RATE})) = ${prayerStrikeDamageFor(state, unit)}ダメージ${blessing}`;
  }
  if (actionKey === "lineHeal") {
    const bonus = unit.card.abilityKey === "widePrayer" ? ` / 能力で+${WIDE_PRAYER_BONUS}` : "";
    return `式: 同列味方に max(6, floor(AT×${LINE_HEAL_RATE})) = ${lineHealAmountFor(state, unit)}回復${bonus}`;
  }
  if (actionKey === "generalWard") {
    return `式: 味方αに装甲+${generalWardArmorFor(unit)}/${GENERAL_WARD_DURATION}T / max(5, floor(AT×${GENERAL_WARD_HEAL_RATE})) = ${generalWardHealFor(state, unit)}回復`;
  }
  if (actionKey === "snipe") return `式: max(5, AT-${SNIPE_DAMAGE_OFFSET}) = ${Math.max(5, at - SNIPE_DAMAGE_OFFSET)}ダメージ / 守られたαは×0.55`;
  if (actionKey === "raid") return `式: max(5, AT-${RAID_DAMAGE_OFFSET}) = ${Math.max(5, at - RAID_DAMAGE_OFFSET)}ダメージ / 守られたαは×0.65 / 中衛対象なら+${MIDDLE_RAID_BONUS}`;
  if (actionKey === "command") return `式: 同列味方にAG+${COMMAND_AG} / AT+${commandAtBonusFor(unit)} / ${COMMAND_DURATION}T`;
  if (actionKey === "siege") {
    const breakerBonus = unit.card.abilityKey === "generalBreaker" ? " / 能力でαに+4" : "";
    return `式: AT×1.0 = ${at}ダメージ / 露出αなら+6${breakerBonus}`;
  }
  if (actionKey === "lowHpStrike") return `式: max(5, AT-${LOW_HP_STRIKE_OFFSET}) = ${Math.max(5, at - LOW_HP_STRIKE_OFFSET)}ダメージ / 低HP優先`;
  if (actionKey === "selfAg") return `式: 自身にAG+${SELF_AG_BUFF}/${AG_DEBUFF_DURATION}T`;
  if (actionKey === "agSnare") return `式: 同列最前の敵にAG-${AG_DEBUFF}/${AG_DEBUFF_DURATION}T`;
  if (actionKey === "shellBind") return `式: 自身と前方の味方に装甲+${Math.max(8, Math.floor(guardArmorFor(state, unit) * 0.75))}/${STANDARD_ARMOR_DURATION}T`;
  if (actionKey === "quickenUltimate") return `式: 同列味方の必殺技を${ULTIMATE_CHARGE_AMOUNT}T短縮`;
  if (actionKey === "acidBite") return `式: max(5, AT-${ACID_BITE_OFFSET}) = ${Math.max(5, at - ACID_BITE_OFFSET)}ダメージ + 回復封じ/${HEAL_BLOCK_DURATION}T`;
  if (actionKey === "acidSweepDefense") return `式: 前衛全体に max(4, AT-${ACID_SWEEP_OFFSET}) = ${Math.max(4, at - ACID_SWEEP_OFFSET)}ダメージ + 防御低下で被ダメージ+${DEFENSE_DOWN_DAMAGE}/${DEFENSE_DOWN_DURATION}T`;
  if (actionKey === "acidSweepHealBlock") return `式: 前衛全体に max(4, AT-${ACID_SWEEP_OFFSET}) = ${Math.max(4, at - ACID_SWEEP_OFFSET)}ダメージ + 回復封じ/${HEAL_BLOCK_DURATION}T`;
  if (actionKey === "drainStrike") return `式: max(5, AT-${DRAIN_DAMAGE_OFFSET}) = ${Math.max(5, at - DRAIN_DAMAGE_OFFSET)} + 対象の装甲最大${BARRIER_PIERCE_ARMOR_BONUS_CAP} / 装甲無視 / 与ダメージの${Math.round(DRAIN_HEAL_RATE * 100)}%回復`;
  if (actionKey === "barrierPierceStrike") return `式: max(5, AT-${BARRIER_PIERCE_OFFSET}) = ${Math.max(5, at - BARRIER_PIERCE_OFFSET)} + 対象の装甲最大${BARRIER_PIERCE_ARMOR_BONUS_CAP} / 装甲無視`;
  if (actionKey === "healBlockPulse") return `式: 低HPの敵に回復封じ/${HEAL_BLOCK_DURATION}T`;
  if (actionKey === "midRearPressure") return `式: 中後衛全体に max(4, AT-${MID_REAR_PRESSURE_OFFSET}) = ${Math.max(4, at - MID_REAR_PRESSURE_OFFSET)}ダメージ`;
  if (actionKey === "sporeCrush") return `式: max(6, AT-${SPORE_CRUSH_OFFSET}) = ${Math.max(6, at - SPORE_CRUSH_OFFSET)}ダメージ`;
  if (actionKey === "sporeBarrage") return `式: 前衛全体に max(5, AT-${SPORE_BARRAGE_OFFSET}) = ${Math.max(5, at - SPORE_BARRAGE_OFFSET)}ダメージ + 毒${POISON_DAMAGE}/${POISON_DURATION}T`;
  if (actionKey === "toxicNeedle") return `式: 最前の敵に毒${POISON_DAMAGE}/${POISON_DURATION}T`;
  if (actionKey === "toxicCloud") return `式: 前衛全体に毒${POISON_DAMAGE}/${POISON_DURATION}T`;
  if (actionKey === "thornGuard") return `式: 自身に装甲+${THORN_GUARD_ARMOR}/${STANDARD_ARMOR_DURATION}T + 接触毒/${CONTACT_POISON_DURATION}T`;
  if (actionKey === "mirrorShell") return `式: 自身に装甲+${MIRROR_SHELL_ARMOR}/${STANDARD_ARMOR_DURATION}T + 反射殻/${REFLECT_SHELL_DURATION}T / 反射は被ダメージ×${Math.round(REFLECT_DAMAGE_RATE * 100)}%・最大${REFLECT_DAMAGE_CAP}`;
  if (actionKey === "selfUltimateCharge") return `式: 自身の必殺技を${ULTIMATE_CHARGE_AMOUNT}T短縮`;
  return "式: 効果なし";
}

function defenseDetail(state, unit) {
  const incoming = unitStats(state, unit, { kind: "incoming", damage: 0 });
  const parts = [armorStatusText(state, unit, incoming.armor)];
  const terrainId = state.terrain[unit.side][unit.row][unit.col];
  if (terrainId === "rampart" && unit.col === 0) parts.push("殻壁で被ダメージ-4");
  if (unit.card.abilityKey === "steady") parts.push("各ターン初回被ダメージ-2");
  if (unit.card.abilityKey === "rearWard" && unit.col === 2) parts.push("後衛中は遠隔被ダメージ-3");
  if (terrainId === "shrine") parts.push("活性巣で被ダメージ+1");
  return uiText(parts.join(" / "));
}

function renderTerrainPalette() {
  els.terrainPalette.innerHTML = "";
  Object.entries(terrainTypes).forEach(([key, terrain]) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `terrain-card ${terrain.className}`;
    item.draggable = true;
    item.innerHTML = `
      <strong>${terrainTermMarkup(key)}</strong>
      <span>${TERMS.cost} ${terrain.cost}</span>
      <p>${uiText(terrain.text)}</p>
    `;
    item.addEventListener("click", () => {
      draggedTerrainId = key;
      setEditorMessage(`${terrain.name}を選択中。盤面へドラッグ、または地形変更モードでマスをクリック。`);
    });
    item.addEventListener("dragstart", (event) => {
      draggedTerrainId = key;
      draggedCardId = null;
      event.dataTransfer?.setData("text/terrain-id", key);
      event.dataTransfer?.setData("text/plain", terrain.name);
    });
    item.addEventListener("dragend", () => {
      draggedTerrainId = null;
    });
    els.terrainPalette.append(item);
  });
}

function renderReferences() {
  els.cardReference.innerHTML = Object.values(cards).map((card) => `
    <article class="reference-item">
      <div class="reference-title">
        <strong>${card.name}</strong>
        <span>HP ${card.hp} / AT ${card.at} / AG ${card.ag} / ${cardCostPairText(card)}</span>
      </div>
      <div class="tag-line">${cardBadgeMarkup(card)}</div>
      <p><b>能力</b>${uiText(card.ability)}</p>
      <p><b>${TERMS.alphaTrait}</b>${uiText(card.generalSkill)}</p>
      <p><b>必殺技</b>${uiText(ultimateText(card))}</p>
      <p><b>行動</b>${TERMS.rankShort[0]}:${actions[card.front].name} / ${TERMS.rankShort[1]}:${actions[card.middle].name} / ${TERMS.rankShort[2]}:${actions[card.rear].name}</p>
      <p><b>図鑑</b>${uiText(card.codexText || "")}</p>
    </article>
  `).join("");

  els.actionReference.innerHTML = Object.entries(actions).map(([key, action]) => `
    <article class="reference-item">
      <div class="reference-title">
        <strong>${action.name}</strong>
        <span>${actionKindLabel(key)}</span>
      </div>
      <p>${uiText(action.text)}</p>
      <p><b>検索</b>${uiText(actionSearchSummary(key))}</p>
      <p><b>仕様</b>${uiText(actionSpecText(key))}</p>
    </article>
  `).join("");

  els.terrainReference.innerHTML = Object.entries(terrainTypes).map(([key, terrain]) => `
    <article class="reference-item">
      <div class="reference-title">
        <strong>${terrain.name}</strong>
        <span>${TERMS.cost} ${terrain.cost}</span>
      </div>
      <p>${uiText(terrain.text)}</p>
      <p><b>性質</b>${uiText(terrainSpecText(key))}</p>
    </article>
  `).join("");
}

function cardBadgeMarkup(card) {
  return [
    rarityMarkup(card.rarity),
    classificationMarkup(card.classification),
    ...(card.traits || []).map((traitId) => traitMarkup(traitId)),
  ].filter(Boolean).join("");
}

function rarityMarkup(rarityId) {
  const rarity = RARITIES[rarityId];
  if (!rarity) return "";
  return termMarkup(rarity.name, `${rarity.displayName}。最大${rarity.maxCopies}枚、複雑さ:${rarity.complexity}。`);
}

function classificationMarkup(classificationId) {
  const classification = CLASSIFICATIONS[classificationId];
  if (!classification) return "";
  return termMarkup(classification.name, classification.description);
}

function traitMarkup(traitId) {
  const trait = TRAITS[traitId];
  if (!trait) return termMarkup(traitId, "未定義の特性。");
  return termMarkup(trait.name, trait.rulesText || trait.shortText);
}

function traitNames(card) {
  return (card.traits || []).map((traitId) => TRAITS[traitId]?.name || traitId);
}

function classificationName(card) {
  return CLASSIFICATIONS[card.classification]?.name || card.classification || "-";
}

function ultimateText(card) {
  if (!card.ultimate) return "なし";
  return `${card.ultimate.name} / ${card.ultimate.turns}T`;
}

function ultimateChargeText(unit) {
  if (!unit.card.ultimate) return "";
  const charge = Math.min(unit.ultimateCharge || 0, unit.card.ultimate.turns);
  return charge >= unit.card.ultimate.turns ? "必殺可" : `必殺 ${charge}/${unit.card.ultimate.turns}`;
}

function ultimateDetailMarkup(state, unit) {
  if (!unit.card.ultimate) return "";
  const action = ultimateActions[unit.card.ultimate.key];
  const text = action?.text || "指定ターン経過後、通常行動の代わりに発動。";
  return `
    <div class="terrain-item">
      <strong>必殺技</strong>
      <span>${uiText(`${ultimateText(unit.card)}。${ultimateChargeText(unit)}。${text}`)}</span>
    </div>
  `;
}

function ultimatePopoverMarkup(state, unit) {
  if (!unit.card.ultimate) return "";
  return `<div class="popover-note"><b>必殺技</b><span>${uiText(`${ultimateText(unit.card)}。${ultimateChargeText(unit)}`)}</span></div>`;
}

function tagLabel(tag) {
  const labels = {
    heavy: "重装",
    leader: "同調核",
    sea: "海適性",
    ranged: "遠隔",
    support: "支援",
    scout: "斥候",
    assault: "突撃",
  };
  return labels[tag] || tag;
}

function tagSpecText(tag) {
  const specs = {
    heavy: "高HP/低AG寄り。海ではAGが下がる。",
    leader: "α特性や同調支援に関わるカード群。",
    sea: "海地形でATと装甲が上がる。",
    ranged: "森でAGが上がり、高地/森からの攻撃補正を受けやすい。",
    support: "回復、装甲、AT/AG強化を担当する。",
    scout: "高AGで奇襲や先制行動に向く。",
    assault: "前線突破とα撃破に向く。",
  };
  return uiText(specs[tag] || tag);
}

function actionKindLabel(actionKey) {
  const categories = actionCategoryIds(actionKey);
  if (categories.length > 1) return "複合";
  if (categories.length === 1) return ROLES[categories[0]]?.name || categories[0];
  return "待機";
}

function actionSpecText(actionKey) {
  const specs = {
    slash: "最前の敵1体。AT×1.0ダメージ。",
    pierce: "同列の前から2体。1体目 max(4, AT-5)、2体目 max(4, AT-10)。守られたαには×0.6。トライホーン能力で条件達成時+2。",
    sweep: `敵前衛全体。max(4, AT-${SWEEP_DAMAGE_OFFSET})。ボルカノドレイク能力で後衛時+${REAR_CANNON_BONUS}。`,
    guard: `自身と同列前方の味方に装甲+${GUARD_ARMOR}/1T。レジンビートル能力で殻壁上なら装甲+${GUARD_ARMOR + RAMPART_GUARD_BONUS}/1T。さらに同列最前の敵へ装甲無視の小ダメージ。`,
    rally: "味方前衛全体にAT+3/2T。",
    heal: `HP割合が最も低い味方を max(7, floor(AT×${SINGLE_HEAL_RATE})) 回復し、同列最前の敵へ小ダメージ。ミストミセリウム能力で対象に装甲+${BLESSING_ARMOR}/1T。`,
    lineHeal: `同列の傷ついた味方全体を max(6, floor(AT×${LINE_HEAL_RATE})) 回復。スポアコロニー能力で+2。`,
    generalWard: `味方αに装甲+${GENERAL_WARD_ARMOR}/1Tと max(5, floor(AT×0.35)) 回復。オブシディアンタートル能力で装甲+4。`,
    snipe: `後衛優先。max(5, AT-${SNIPE_DAMAGE_OFFSET})。守られたαには×0.55。スカイレイαの初回狙撃は+5。`,
    raid: `中後衛の低HPを優先。max(5, AT-${RAID_DAMAGE_OFFSET})。守られたαには×0.65。グラスマンティス能力で中衛対象なら+${MIDDLE_RAID_BONUS}。`,
    command: "同列の自分以外の味方にAG+8/AT+2/1T。サンダーイール能力でAT+3。",
    siege: "露出αを優先。AT×1.0、露出αなら+6。ティラノファング能力でα対象ならさらに+4。",
    lowHpStrike: `敵全体から現在HPが最も低い1体を優先。max(5, AT-${LOW_HP_STRIKE_OFFSET})。捕食系能力で条件達成時+3。`,
    selfAg: `自身にAG+${SELF_AG_BUFF}/${AG_DEBUFF_DURATION}T。次ターン以降の行動順を作る。`,
    agSnare: `同列最前の敵にAG-${AG_DEBUFF}/${AG_DEBUFF_DURATION}T。ブリンクフォックス能力ならさらに-2。`,
    shellBind: "自身と同列前方の味方に装甲を付与する。反撃は行わない。",
    quickenUltimate: `同列の自分以外の味方の必殺技ゲージ+${ULTIMATE_CHARGE_AMOUNT}。`,
    acidBite: `最前の敵に max(5, AT-${ACID_BITE_OFFSET}) と回復封じ/${HEAL_BLOCK_DURATION}T。`,
    acidSweepDefense: `敵前衛全体に max(4, AT-${ACID_SWEEP_OFFSET}) と防御低下/${DEFENSE_DOWN_DURATION}T。防御低下中は被ダメージ+${DEFENSE_DOWN_DAMAGE}。`,
    acidSweepHealBlock: `敵前衛全体に max(4, AT-${ACID_SWEEP_OFFSET}) と回復封じ/${HEAL_BLOCK_DURATION}T。`,
    drainStrike: `装甲が残る敵を優先。max(5, AT-${DRAIN_DAMAGE_OFFSET})に対象の装甲を最大${BARRIER_PIERCE_ARMOR_BONUS_CAP}加算し、装甲を無視する。与ダメージの${Math.round(DRAIN_HEAL_RATE * 100)}%を自身が回復。`,
    barrierPierceStrike: `最前の敵に max(5, AT-${BARRIER_PIERCE_OFFSET}) + 対象の装甲最大${BARRIER_PIERCE_ARMOR_BONUS_CAP}。装甲を無視する。`,
    healBlockPulse: `現在HPが最も低い敵に回復封じ/${HEAL_BLOCK_DURATION}T。ダメージは与えない。`,
    midRearPressure: `敵中後衛全体に max(4, AT-${MID_REAR_PRESSURE_OFFSET})。`,
    sporeCrush: `最前の敵に max(6, AT-${SPORE_CRUSH_OFFSET})。`,
    sporeBarrage: `敵前衛全体に max(5, AT-${SPORE_BARRAGE_OFFSET}) と毒/${POISON_DURATION}T。毒はターン開始時に${POISON_DAMAGE}ダメージ。`,
    toxicNeedle: `最前の敵に毒/${POISON_DURATION}T。毒はターン開始時に${POISON_DAMAGE}ダメージ。`,
    toxicCloud: `敵前衛全体に毒/${POISON_DURATION}T。即時ダメージはないが複数体へ継続ダメージを置く。`,
    thornGuard: `自身に装甲+${THORN_GUARD_ARMOR}/${STANDARD_ARMOR_DURATION}Tと接触毒/${CONTACT_POISON_DURATION}T。接触毒中に攻撃を受けると攻撃者へ毒/${POISON_DURATION}T。`,
    mirrorShell: `自身に装甲+${MIRROR_SHELL_ARMOR}/${STANDARD_ARMOR_DURATION}Tと反射殻/${REFLECT_SHELL_DURATION}T。反射殻中に攻撃を受けると被ダメージの${Math.round(REFLECT_DAMAGE_RATE * 100)}%、最大${REFLECT_DAMAGE_CAP}を攻撃者へ返す。`,
    selfUltimateCharge: `自身の必殺技ゲージ+${ULTIMATE_CHARGE_AMOUNT}。`,
    wait: "行動しない。",
  };
  return uiText(specs[actionKey] || "未定義。");
}

function terrainSpecText(terrainKey) {
  const specs = {
    plain: "バランス調整の基準。初期地形は全プリセット平地。",
    forest: "飛行/擬態寄りのカードだけAGが上がる。手数や先制順の調整用。",
    sea: "水棲寄りのカードはATと装甲が上がる。大型甲殻寄りのカードはAGが下がる。",
    highland: "後衛から攻撃した時だけ与ダメージが上がる。",
    shrine: "ターン開始時にHP+3。代償として被ダメージ+1。",
    rampart: "前衛時の被ダメージを下げる。レジンビートルの守護も強化される。",
  };
  return uiText(specs[terrainKey] || "未定義。");
}

function renderLog(log, activeIndex = -1) {
  els.battleLog.innerHTML = "";
  log.forEach((item) => {
    const li = document.createElement("li");
    const index = els.battleLog.children.length;
    if (item.startsWith("TURN")) {
      li.className = "turn-break";
      li.textContent = uiText(item.replace("TURN", "ターン"));
    } else {
      li.textContent = uiText(item);
    }
    if (index === activeIndex) {
      li.className = `${li.className} log-active`.trim();
    }
    els.battleLog.append(li);
  });
}

function cycleTerrain(side, row, col) {
  if (setup.editSide !== side) return;
  const keys = Object.keys(terrainTypes);
  const grid = side === "player" ? setup.playerTerrain : setup.enemyTerrain;
  const current = keys.indexOf(grid[row][col]);
  const nextTerrainId = keys[(current + 1) % keys.length];
  const nextGrid = cloneTerrain(grid);
  nextGrid[row][col] = nextTerrainId;
  const nextCost = costForEditedSide(side, { terrain: nextGrid });
  if (nextCost.total > COST_LIMIT) {
    setEditorMessage(costLimitMessage(nextCost));
    return;
  }
  grid[row][col] = nextTerrainId;
  selectedUnitId = null;
  setEditorMessage(`${sideLabel(side)} ${ROW_LABELS[row]}${COL_LABELS[col]}を${terrainTypes[nextTerrainId].name}に変更しました。`);
  renderSetup();
}

function getPreset(id) {
  return presets.find((preset) => preset.id === id) || presets[0];
}

function presetCost(preset) {
  const units = createUnits("player", preset, preset.terrain);
  const card = units.reduce((sum, unit) => sum + (unit.general ? alphaCardCost(unit.card) : normalCardCost(unit.card)), 0);
  const rawTerrain = terrainGridCost(preset.terrain);
  const discount = cards[preset.general]?.generalKey === "terrainDiscount" ? 2 : 0;
  const terrain = Math.max(0, rawTerrain - discount);
  return { cards: units.length, card, terrain, total: card + terrain };
}

function sortUnits(units) {
  return cloneUnits(units).sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0].localeCompare(b[0]));
}

function cloneUnits(units) {
  return units.map(([cardId, row, col]) => [cardId, row, col]);
}

function cloneTerrain(grid) {
  return grid.map((row) => [...row]);
}

function loadCustomPresets() {
  const storage = safeLocalStorage();
  if (!storage) return [];
  try {
    const raw = JSON.parse(storage.getItem(CUSTOM_DECK_STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(sanitizeCustomPreset).filter(Boolean);
  } catch {
    return [];
  }
}

function saveCustomPresets() {
  const storage = safeLocalStorage();
  if (!storage) return;
  const custom = presets.filter((preset) => preset.kind === "custom");
  storage.setItem(CUSTOM_DECK_STORAGE_KEY, JSON.stringify(custom));
}

function sanitizeCustomPreset(preset) {
  if (!preset || typeof preset !== "object") return null;
  const units = sortUnits((Array.isArray(preset.units) ? preset.units : [])
    .filter(([cardId, row, col]) => cards[cardId] && Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 3 && col >= 0 && col < 3)
    .slice(0, MAX_DECK_CARDS));
  const legalUnits = legalFormationUnits(units);
  if (legalUnits.length === 0) return null;
  const general = legalUnits.some(([cardId]) => cardId === preset.general) ? preset.general : legalUnits[0][0];
  return {
    id: typeof preset.id === "string" && preset.id.startsWith("custom-") ? preset.id : `custom-${Date.now().toString(36)}`,
    name: typeof preset.name === "string" && preset.name.trim() ? preset.name.trim().slice(0, 24) : "登録デッキ",
    kind: "custom",
    description: typeof preset.description === "string" ? preset.description : "登録デッキ",
    general,
    units: legalUnits,
    terrain: sanitizeTerrain(preset.terrain),
  };
}

function sanitizeTerrain(grid) {
  const fallback = [
    ["plain", "plain", "plain"],
    ["plain", "plain", "plain"],
    ["plain", "plain", "plain"],
  ];
  if (!Array.isArray(grid)) return fallback;
  return fallback.map((row, rowIndex) => row.map((terrainId, colIndex) => {
    const value = grid[rowIndex]?.[colIndex];
    return terrainTypes[value] ? value : terrainId;
  }));
}

function safeLocalStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

init();
