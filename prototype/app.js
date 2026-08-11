const COST_LIMIT = 30;
const MATCH_BATTLE_COUNT = 100;
const MAX_DECK_CARDS = 6;
const CUSTOM_DECK_STORAGE_KEY = "taisho-custom-decks-v1";
const STALEMATE_REPEAT_LIMIT = 3;
const SAFETY_TURN_LIMIT = 80;
const STANDARD_ARMOR_DURATION = 1;
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
const OPENING_BARRAGE_OFFSET = 14;
const REAR_CANNON_BONUS = 3;
const GUARD_STRIKE_RATE = 0.45;
const PRAYER_STRIKE_RATE = 0.35;
const SNIPE_DAMAGE_OFFSET = 6;
const RAID_DAMAGE_OFFSET = 5;
const MIDDLE_RAID_BONUS = 2;
const COL_LABELS = ["前列", "中列", "後列"];
const ROW_LABELS = ["上段", "中段", "下段"];

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
    text: "弓・斥候のAG+6。",
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
    text: "海適性のAT+3/装甲+1。重装はAG-4。",
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
    text: "後列からの攻撃ダメージ+3。",
    apply(unit, context) {
      if (unit.col === 2 && context.kind === "attack") {
        context.damage += 3;
      }
      return context;
    },
  },
  shrine: {
    name: "祭壇",
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
      const amount = heal(unit, 3);
      log.push(`${unitLabel(unit)} は祭壇でHPを${amount}回復`);
      if (amount > 0) {
        recordFrame(log, state, { type: "heal", targetId: unit.id, amount, healEvents: [{ targetId: unit.id, amount }], text: `${unit.card.name} 祭壇回復` });
      }
    },
  },
  rampart: {
    name: "城壁",
    cost: 3,
    className: "terrain-rampart",
    text: "前列時、受けるダメージ-4。",
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
    execute(state, unit, log) {
      const target = findFrontTarget(state, unit);
      if (!target) return logNoTarget(unit, log);
      dealDamage(state, unit, target, unitStats(state, unit).at, "斬撃", log);
    },
  },
  pierce: {
    name: "貫通",
    text: "同段の前から2体に小ダメージ。",
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
    text: "敵前列全体に小ダメージ。",
    execute(state, unit, log) {
      const targets = enemies(state, unit.side).filter((enemy) => enemy.col === 0);
      if (targets.length === 0) return logNoTarget(unit, log);
      const damage = Math.max(4, unitStats(state, unit).at - SWEEP_DAMAGE_OFFSET);
      dealDamageGroup(state, unit, targets.map((target) => ({ target, rawDamage: damage })), "掃射", log);
    },
  },
  guard: {
    name: "守護",
    text: "自分と前の味方に装甲を付与し、同段最前の敵へ小ダメージ。",
    execute(state, unit, log) {
      executeGuardProtection(state, unit, log);
      executeGuardStrike(state, unit, log);
    },
  },
  rally: {
    name: "鼓舞",
    text: `味方前列のAT+${RALLY_AT}/${RALLY_DURATION}T。`,
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
    text: "最も傷ついた味方を回復し、同段最前の敵へ小ダメージ。",
    execute(state, unit, log) {
      executeHealPrayer(state, unit, log);
      executePrayerStrike(state, unit, log);
    },
  },
  lineHeal: {
    name: "治癒陣",
    text: "同段の味方全体を小回復。",
    execute(state, unit, log) {
      const targets = living(state, unit.side)
        .filter((ally) => ally.row === unit.row && ally.hp < ally.maxHp);
      if (targets.length === 0) return logNoTarget(unit, log);
      const amount = lineHealAmountFor(state, unit);
      const healEvents = targets
        .map((target) => ({ targetId: target.id, amount: heal(target, amount), target }))
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
    text: "味方大将に装甲と小回復。",
    execute(state, unit, log) {
      const target = generalOf(state, unit.side);
      if (!target || target.hp <= 0) return logNoTarget(unit, log);
      const armor = generalWardArmorFor(unit);
      const healAmount = generalWardHealFor(state, unit);
      grantArmor(state, target, armor, GENERAL_WARD_DURATION);
      const healed = heal(target, healAmount);
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
    text: "後列を狙う。守られた大将には軽減。",
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
    text: "中後列の低HPを狙う。",
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
    text: `同段の味方にAG+${COMMAND_AG}/AT+2/${COMMAND_DURATION}T。`,
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
    text: "露出した大将を優先して大ダメージ。",
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
  wait: {
    name: "待機",
    text: "何もしない。",
    execute(state, unit, log) {
      log.push(`${unitLabel(unit)} は待機`);
    },
  },
};

const cards = {
  captain: {
    name: "ガード",
    hp: 135,
    at: 32,
    ag: 34,
    soldierCost: 5,
    generalCost: 7,
    tags: ["heavy", "leader"],
    ability: "各ターン最初に受けるダメージ-2。",
    abilityKey: "steady",
    generalSkill: "開戦時、味方前列に装甲+12/1T。",
    generalKey: "frontArmor",
    front: "slash",
    middle: "guard",
    rear: "rally",
  },
  tideguard: {
    name: "シールド",
    hp: 145,
    at: 30,
    ag: 25,
    soldierCost: 5,
    generalCost: 7,
    tags: ["heavy", "sea"],
    ability: "海マス上で最大HP+6。",
    abilityKey: "seaHp",
    generalSkill: "開戦時、海/城壁上の味方に装甲+10/1T。",
    generalKey: "harborWall",
    front: "guard",
    middle: "slash",
    rear: "rally",
  },
  archer: {
    name: "アーチャー",
    hp: 100,
    at: 37,
    ag: 42,
    soldierCost: 5,
    generalCost: 7,
    tags: ["ranged"],
    ability: "森/高地からの攻撃ダメージ+2。",
    abilityKey: "rangedTerrain",
    generalSkill: "自軍の初回狙撃ダメージ+5。",
    generalKey: "firstSnipe",
    front: "slash",
    middle: "sweep",
    rear: "snipe",
  },
  oracle: {
    name: "ヒーラー",
    hp: 105,
    at: 27,
    ag: 31,
    soldierCost: 4,
    generalCost: 6,
    tags: ["support"],
    ability: "祈祷時、対象に装甲+6/1T。",
    abilityKey: "blessing",
    generalSkill: "味方が初めて倒れた時、全員HP+5。",
    generalKey: "firstFallHeal",
    front: "heal",
    middle: "heal",
    rear: "rally",
  },
  priest: {
    name: "プリースト",
    hp: 102,
    at: 29,
    ag: 30,
    soldierCost: 4,
    generalCost: 6,
    tags: ["support"],
    ability: `治癒陣の回復量+${WIDE_PRAYER_BONUS}。`,
    abilityKey: "widePrayer",
    generalSkill: "味方が初めて倒れた時、全員HP+5。",
    generalKey: "firstFallHeal",
    front: "heal",
    middle: "lineHeal",
    rear: "lineHeal",
  },
  duelist: {
    name: "ソード",
    hp: 110,
    at: 36,
    ag: 53,
    soldierCost: 4,
    generalCost: 6,
    tags: ["scout"],
    ability: "HP満タン時、AG+5。",
    abilityKey: "quickStart",
    generalSkill: "自身が前列にいる間、与ダメージ+4。",
    generalKey: "frontDuel",
    front: "slash",
    middle: "raid",
    rear: "raid",
  },
  lancer: {
    name: "ランス",
    hp: 120,
    at: 39,
    ag: 36,
    soldierCost: 5,
    generalCost: 7,
    tags: ["assault"],
    ability: "同段に敵が2体以上いる時、貫通ダメージ+2。",
    abilityKey: "laneBreaker",
    generalSkill: "3ターン目開始時、味方前列にAT+4。",
    generalKey: "turnThreeCharge",
    front: "pierce",
    middle: "pierce",
    rear: "rally",
  },
  scout: {
    name: "ローグ",
    hp: 95,
    at: 35,
    ag: 47,
    soldierCost: 4,
    generalCost: 6,
    tags: ["scout"],
    ability: `奇襲時、対象が中列ならダメージ+${MIDDLE_RAID_BONUS}。`,
    abilityKey: "middleRaid",
    generalSkill: `1ターン目、味方斥候のAG+${SCOUT_LEAD_AG}。`,
    generalKey: "scoutLead",
    front: "slash",
    middle: "raid",
    rear: "raid",
  },
  engineer: {
    name: "ビルダー",
    hp: 115,
    at: 24,
    ag: 28,
    soldierCost: 4,
    generalCost: 6,
    tags: ["support"],
    ability: `城壁上では守護の装甲+${RAMPART_GUARD_BONUS}。`,
    abilityKey: "rampartCraft",
    generalSkill: "自軍地形コスト-2として扱う。",
    generalKey: "terrainDiscount",
    front: "guard",
    middle: "guard",
    rear: "command",
  },
  paladin: {
    name: "パラディン",
    hp: 125,
    at: 29,
    ag: 32,
    soldierCost: 5,
    generalCost: 7,
    tags: ["heavy", "support"],
    ability: `献身の装甲+${DEVOTED_WARD_BONUS}。`,
    abilityKey: "devotedWard",
    generalSkill: "開戦時、味方前列に装甲+12/1T。",
    generalKey: "frontArmor",
    front: "slash",
    middle: "generalWard",
    rear: "generalWard",
  },
  strategist: {
    name: "コマンダー",
    hp: 100,
    at: 26,
    ag: 39,
    soldierCost: 4,
    generalCost: 6,
    tags: ["support", "leader"],
    ability: "指揮のAT補正+1。",
    abilityKey: "sharpCommand",
    generalSkill: "開戦時、味方中列にAG+6。",
    generalKey: "midAg",
    front: "slash",
    middle: "command",
    rear: "command",
  },
  lord: {
    name: "ロード",
    hp: 92,
    at: 25,
    ag: 37,
    soldierCost: 4,
    generalCost: 8,
    tags: ["support", "leader"],
    ability: "大将スキル重視。兵時は標準的な支援役。",
    abilityKey: "none",
    generalSkill: `開戦時、味方全員にAT+${ALL_ORDER_AT}/AG+${ALL_ORDER_AG}/${ALL_ORDER_DURATION}T。`,
    generalKey: "allOutOrder",
    front: "slash",
    middle: "command",
    rear: "rally",
  },
  breaker: {
    name: "ブレイカー",
    hp: 125,
    at: 41,
    ag: 24,
    soldierCost: 5,
    generalCost: 7,
    tags: ["heavy", "assault"],
    ability: "露出大将への破陣ダメージ+4。",
    abilityKey: "generalBreaker",
    generalSkill: "敵大将が前列へ出た時、自身にAT+6。",
    generalKey: "finishSignal",
    front: "siege",
    middle: "siege",
    rear: "wait",
  },
  cannoneer: {
    name: "キャノン",
    hp: 92,
    at: 43,
    ag: 18,
    soldierCost: 5,
    generalCost: 7,
    tags: ["ranged", "heavy"],
    ability: `後列からの掃射ダメージ+${REAR_CANNON_BONUS}。`,
    abilityKey: "rearCannon",
    generalSkill: "敵前列が2体以上なら、1ターン目に掃射。",
    generalKey: "openingBarrage",
    front: "slash",
    middle: "sweep",
    rear: "sweep",
  },
  seer: {
    name: "メイジ",
    hp: 90,
    at: 32,
    ag: 33,
    soldierCost: 4,
    generalCost: 6,
    tags: ["support", "ranged"],
    ability: "後列にいる間、受ける遠隔ダメージ-3。",
    abilityKey: "rearWard",
    generalSkill: "自軍大将が初めて中列へ出た時、全員に装甲+14/1T。",
    generalKey: "fallbackWard",
    front: "heal",
    middle: "snipe",
    rear: "command",
  },
};

const presets = [
  {
    id: "guard",
    name: "王道護衛",
    kind: "model",
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
    name: "後列奇襲",
    kind: "model",
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
    name: "海陣防衛",
    kind: "model",
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
    name: "前線突破",
    kind: "model",
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
    name: "地形: 城壁護衛",
    kind: "terrain",
    description: "城壁上のビルダーを軸に、守護と回復で前線を固定する。",
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
    name: "地形: 森奇襲",
    kind: "terrain",
    description: "森のAG補正でローグ大将をさらに速くし、後列へ圧をかける。",
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
    name: "地形: 海陣",
    kind: "terrain",
    description: "海上のシールド大将を強化し、海/城壁対象の大将スキルを見せる。",
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
    name: "地形: 高地砲撃",
    kind: "terrain",
    description: "高地キャノンの後列掃射で、前列崩しを早める。",
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
    name: "教材: 鼓舞掃射",
    kind: "lesson",
    lesson: "ATアップを先に入れて、掃射で前列全体を削る。",
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
    name: "教材: 先制集中",
    kind: "lesson",
    lesson: "AGアップで行動順を作り、同じレーンへ攻撃を集中する。",
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
    name: "教材: 装甲護衛",
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
    name: "教材: 回復粘り",
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
    name: "教材: 大将スキル軸",
    kind: "lesson",
    lesson: "ステータス控えめのロード大将を守り、開戦全体バフで初動を作る。",
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
    name: "教材: エース大将",
    kind: "lesson",
    lesson: "高ステータス大将にAT/AG/装甲/回復支援を集めて突破する。",
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

presets.push(...loadCustomPresets());

const initialPlayerPreset = getPreset("guard");
const initialEnemyPreset = getPreset("raid");

let setup = {
  playerPreset: "guard",
  enemyPreset: "raid",
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
    const button = event.target.closest("[data-general-unit]");
    if (!button) return;
    setGeneralByUnitId(button.dataset.generalUnit);
  });
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
    els.cardPicker.append(new Option(`${card.name} / 兵${card.soldierCost} 将${card.generalCost}`, cardId));
  });
  els.cardPicker.value = selectedCardId || "duelist";
}

function renderCardLibrary() {
  if (!els.cardLibrary) return;
  els.cardLibrary.innerHTML = "";
  const activeSideUnits = setup[`${setup.editSide}Units`] || [];
  const activeCards = new Set(activeSideUnits.map(([cardId]) => cardId));

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
    const item = document.createElement("button");
    item.type = "button";
    item.className = `library-card${selectedCardId === cardId ? " selected" : ""}${activeCards.has(cardId) ? " in-deck" : ""}`;
    item.draggable = true;
    item.innerHTML = `
      <div class="library-card-head">
        <strong>${card.name}</strong>
        <span class="library-cost">兵${card.soldierCost} 将${card.generalCost}</span>
      </div>
      <div class="library-stat-grid">
        <span><b>HP</b>${card.hp}</span>
        <span><b>AT</b>${card.at}</span>
        <span><b>AG</b>${card.ag}</span>
      </div>
      <div class="library-action-grid">
        <span><b>前</b>${actionTermMarkup(card.front)}</span>
        <span><b>中</b>${actionTermMarkup(card.middle)}</span>
        <span><b>後</b>${actionTermMarkup(card.rear)}</span>
      </div>
      <div class="tag-line">${card.tags.map((tag) => termMarkup(tagLabel(tag), tagSpecText(tag))).join("")}</div>
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
  return `<span class="term" title="${attrEscape(description)}" data-tooltip="${attrEscape(description)}">${label}</span>`;
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
    terrain: "地形",
    lesson: "教材",
    custom: "登録",
  };
  return `${labels[preset.kind] || "デッキ"}: ${preset.name}`;
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
      setEditorMessage("大将指定はカードがあるマスのみ有効です。");
      return;
    }
    setup[`${side}General`] = unit.cardId;
    selectedUnitId = unit.id;
    setEditorMessage(`${unit.card.name}を大将に指定しました。`);
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
  setup[`${unit.side}General`] = unit.cardId;
  setup.editSide = unit.side;
  els.editSide.value = unit.side;
  selectedUnitId = unit.id;
  selectedCardId = unit.cardId;
  els.cardPicker.value = unit.cardId;
  setEditorMessage(`${unit.side === "player" ? "自軍" : "敵軍"}の${unit.card.name}を大将に指定しました。`);
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
      setEditorMessage(`${MAX_DECK_CARDS}枚までです。`);
      return;
    }
    const candidate = sortUnits([...units, [cardId, row, col]]);
    if (!isLegalInitialSlot(candidate, row, col)) {
      setEditorMessage(`${ROW_LABELS[row]}${COL_LABELS[col]}には前方のカードが必要です。`);
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
  grid[row][col] = terrainId;
  selectedUnitId = null;
  setEditorMessage(`${side === "player" ? "自軍" : "敵軍"} ${ROW_LABELS[row]}${COL_LABELS[col]}を${terrainTypes[terrainId].name}に変更しました。`);
  renderSetup();
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
    setEditorMessage(`Cost ${cost.total}/${COST_LIMIT}です。`);
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
  if (els.editorMessage) els.editorMessage.textContent = message;
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
  renderLog(["編成を選択済み。戦闘開始で大将撃破まで自動解決を実行。"]);
  els.winnerSummary.textContent = "未実行";
  els.phaseSummary.textContent = setupConceptText();
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
  els.phaseSummary.textContent = summarizeSeries(stats);
  els.turnCount.textContent = `${stats.averageTurns.toFixed(1)}T avg`;
  els.playReplay.disabled = stats.replay.log.frames.length === 0;
  els.playReplay.textContent = "代表戦リプレイ";
  renderMatchupSummary(stats);
  renderSelectedCard(stats.replay.state);
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
    const beforeTurn = progressSignature(state);
    log.push(`TURN ${turn}`);
    recordFrame(log, state, { type: "turn", text: `Turn ${turn}` });
    resetTurnFlags(state);
    applyTerrainTurnStart(state, log);
    applyGeneralSkills(state, log, "turnStart");

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
    log.push(`${SAFETY_TURN_LIMIT}ターン経過しても大将が倒れないため引き分け`);
    recordFrame(log, state, { type: "draw", text: "長期化による引き分け" });
  }

  log.finalState = snapshotBattleState(state);
  log.result = result;
  return {
    result,
    state: log.finalState,
    log,
    turns: state.turn,
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
  }

  if (!stats.replay && options.recordFirst) {
    stats.replay = simulateBattle({ ...options, record: true });
  }
  stats.playerWinRate = stats.playerWins / battles;
  stats.enemyWinRate = stats.enemyWins / battles;
  stats.drawRate = stats.draws / battles;
  stats.averageTurns = stats.totalTurns / battles;
  stats.matchResult = stats.playerWins > stats.enemyWins
    ? "player"
    : stats.enemyWins > stats.playerWins
      ? "enemy"
      : "draw";
  return stats;
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
  els.matchupBadge.textContent = "モデル総当たり";
  els.matchupSummary.innerHTML = `
    <div class="result-grid">
      <div class="result-cell"><span>組み合わせ</span><strong>${targetPresets.length * targetPresets.length}</strong></div>
      <div class="result-cell"><span>総戦闘数</span><strong>${totals.totalBattles}</strong></div>
      <div class="result-cell"><span>最高勝率</span><strong>${totals.best.winRate}%</strong></div>
      <div class="result-cell"><span>最低勝率</span><strong>${totals.worst.winRate}%</strong></div>
    </div>
    <div class="terrain-item">
      <strong>総合トップ: ${totals.best.name}</strong>
      <span>総合最下位: ${totals.worst.name}。まずはこの差を見てコストや地形相性を調整。</span>
    </div>
  `;
  els.phaseSummary.textContent = `モデル総当たり ${targetPresets.length * targetPresets.length}組を各${MATCH_BATTLE_COUNT}戦で集計。教材デッキは手動対戦で確認。`;
  els.winnerSummary.textContent = "モデル総当たり完了";
}

function roundRobinPresets() {
  return presets.filter((preset) => preset.kind === "model");
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
  const sorted = [...standings].sort((a, b) => b.winRate - a.winRate);
  return {
    standings,
    totalBattles: matrix.flat().reduce((sum, item) => sum + item.battles, 0),
    best: sorted[0],
    worst: sorted[sorted.length - 1],
  };
}

function renderMatchupSummary(stats) {
  els.matchupBadge.textContent = seriesResultLabel(stats);
  els.matchupSummary.innerHTML = `
    <div class="result-grid">
      <div class="result-cell"><span>自軍勝率</span><strong>${percent(stats.playerWinRate)}%</strong></div>
      <div class="result-cell"><span>自軍勝利</span><strong>${stats.playerWins}</strong></div>
      <div class="result-cell"><span>敵軍勝利</span><strong>${stats.enemyWins}</strong></div>
      <div class="result-cell"><span>引き分け</span><strong>${stats.draws}</strong></div>
    </div>
    <div class="terrain-item">
      <strong>${getPreset(stats.playerPresetId).name} vs ${getPreset(stats.enemyPresetId).name}</strong>
      <span>${stats.battles}戦 / 平均${stats.averageTurns.toFixed(1)}ターン。代表戦はリプレイで確認できます。</span>
    </div>
  `;
}

function renderRoundRobin(matrix, targetPresets) {
  const header = targetPresets.map((preset) => `<th scope="col">${preset.name}</th>`).join("");
  const rows = matrix.map((row, rowIndex) => {
    const cells = row.map((stats) => {
      const rate = percent(stats.playerWinRate);
      const klass = stats.playerWinRate > 0.55 ? "cell-win" : stats.playerWinRate < 0.45 ? "cell-loss" : "cell-even";
      return `
        <td class="${klass}">
          <div class="match-cell">
            <strong>${rate}%</strong>
            <span>${stats.playerWins}-${stats.enemyWins}-${stats.draws}</span>
          </div>
        </td>
      `;
    }).join("");
    return `<tr><th scope="row">${targetPresets[rowIndex].name}</th>${cells}</tr>`;
  }).join("");

  els.roundRobinTable.innerHTML = `
    <table>
      <thead><tr><th scope="col">自軍＼敵軍</th>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function seriesResultLabel(stats) {
  if (stats.matchResult === "player") return `自軍勝利 ${stats.playerWins}-${stats.enemyWins}`;
  if (stats.matchResult === "enemy") return `敵軍勝利 ${stats.playerWins}-${stats.enemyWins}`;
  return `引き分け ${stats.playerWins}-${stats.enemyWins}`;
}

function summarizeSeries(stats) {
  return `${MATCH_BATTLE_COUNT}戦判定: 自軍${stats.playerWins}勝 / 敵軍${stats.enemyWins}勝 / 引き分け${stats.draws}。平均${stats.averageTurns.toFixed(1)}ターン。`;
}

function setupConceptText() {
  const player = getPreset(setup.playerPreset);
  const enemy = getPreset(setup.enemyPreset);
  return `大将撃破で即勝利。自軍: ${presetConceptText(player)} / 敵軍: ${presetConceptText(enemy)}`;
}

function presetConceptText(preset) {
  if (preset.lesson) return preset.lesson;
  return `${preset.name}のモデル配置`;
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
    .map((unit) => `${unit.id}:${unit.hp}:${unit.row}:${unit.col}`)
    .sort()
    .join("|");
}

function resultLabel(result) {
  if (result === "player") return "自軍勝利";
  if (result === "enemy") return "敵軍勝利";
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
      els.phaseSummary.textContent = frame.text;
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
      els.phaseSummary.textContent = summarizeBattle(lastBattleLog.finalState, lastBattleLog.result);
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
  return {
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
}

function createUnits(side, preset, terrainGrid) {
  return legalFormationUnits(preset.units).map(([cardId, row, col], index) => {
    const card = cards[cardId];
    const terrain = terrainTypes[terrainGrid[row][col]];
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
      firstHitReduced: false,
      movedFromRear: false,
      terrain: terrain.name,
    };
  });
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
          log.push(`${unitLabel(general)} の大将スキル: ${buffTargetSummary(targets)} に装甲+${FRONT_ARMOR}/${STANDARD_ARMOR_DURATION}T`);
          recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} の大将スキル`);
        }
      }
      if (key === "harborWall") {
        const targets = living(state, side).filter((unit) => ["海", "城壁"].includes(terrainName(state, unit)));
        const buffEvents = targets.map((unit) => {
          grantArmor(state, unit, HARBOR_WALL_ARMOR, STANDARD_ARMOR_DURATION);
          return { targetId: unit.id, armor: HARBOR_WALL_ARMOR, duration: STANDARD_ARMOR_DURATION };
        });
        if (buffEvents.length > 0) {
          log.push(`${unitLabel(general)} の大将スキル: ${buffTargetSummary(targets)} に装甲+${HARBOR_WALL_ARMOR}/${STANDARD_ARMOR_DURATION}T`);
          recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} の大将スキル`);
        }
      }
      if (key === "midAg") {
        const targets = living(state, side).filter((unit) => unit.col === 1);
        const buffEvents = targets.map((unit) => {
          grantStatBuff(state, unit, "ag", 6, COMMAND_DURATION);
          return { targetId: unit.id, ag: 6, duration: COMMAND_DURATION };
        });
        if (buffEvents.length > 0) {
          log.push(`${unitLabel(general)} の大将スキル: ${buffTargetSummary(targets)} にAG+6/${COMMAND_DURATION}T`);
          recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} の大将スキル`);
        }
      }
      if (key === "scoutLead") {
        const targets = living(state, side).filter((unit) => unit.card.tags.includes("scout"));
        const buffEvents = targets.map((unit) => {
          grantStatBuff(state, unit, "ag", SCOUT_LEAD_AG, COMMAND_DURATION);
          return { targetId: unit.id, ag: SCOUT_LEAD_AG, duration: COMMAND_DURATION };
        });
        if (buffEvents.length > 0) {
          log.push(`${unitLabel(general)} の大将スキル: ${buffTargetSummary(targets)} にAG+${SCOUT_LEAD_AG}/${COMMAND_DURATION}T`);
          recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} の大将スキル`);
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
          log.push(`${unitLabel(general)} の大将スキル: ${buffTargetSummary(targets)} にAT+${ALL_ORDER_AT}/AG+${ALL_ORDER_AG}/${ALL_ORDER_DURATION}T`);
          recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} の大将スキル`);
        }
      }
    }
    if (phase === "battleStartAction" && key === "openingBarrage") {
      const frontCount = living(state, opposite(side)).filter((unit) => unit.col === 0).length;
      if (frontCount >= 2) {
        const targets = enemies(state, side).filter((enemy) => enemy.col === 0);
        if (targets.length === 0) return;
        const damage = Math.max(4, unitStats(state, general).at - OPENING_BARRAGE_OFFSET);
        log.push(`${unitLabel(general)} の大将スキル: 開幕掃射`);
        dealDamageGroup(state, general, targets.map((target) => ({ target, rawDamage: damage })), "掃射", log);
      }
    }
    if (phase === "turnStart" && key === "turnThreeCharge" && state.turn === 3) {
      const targets = living(state, side).filter((unit) => unit.col === 0);
      const buffEvents = targets.map((unit) => {
        grantStatBuff(state, unit, "at", TURN_THREE_CHARGE_AT, TURN_THREE_CHARGE_DURATION);
        return { targetId: unit.id, at: TURN_THREE_CHARGE_AT, duration: TURN_THREE_CHARGE_DURATION };
      });
      if (buffEvents.length > 0) {
        log.push(`${unitLabel(general)} の大将スキル: ${buffTargetSummary(targets)} にAT+${TURN_THREE_CHARGE_AT}/${TURN_THREE_CHARGE_DURATION}T`);
        recordBuffGroupFrame(log, state, general, buffEvents, `${general.card.name} の大将スキル`);
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

function resetTurnFlags(state) {
  expireArmorEffects(state);
  expireStatEffects(state);
  allLiving(state).forEach((unit) => {
    unit.firstHitReduced = false;
  });
}

function nextActingBatch(state, actedIds) {
  const candidates = allLiving(state)
    .filter((unit) => !actedIds.has(unit.id))
    .map((unit) => ({ unit, ag: unitStats(state, unit).ag }))
    .sort((a, b) => b.ag - a.ag || actingTiePriority(a.unit) - actingTiePriority(b.unit));
  if (candidates.length === 0) return null;
  const topAg = candidates[0].ag;
  const topCandidates = candidates.filter((candidate) => candidate.ag === topAg);
  const first = topCandidates[0].unit;
  const firstAction = actionFor(first);
  const simultaneousUnits = topCandidates
    .map((candidate) => candidate.unit)
    .filter((unit) => unit.cardId === first.cardId && actionFor(unit) === firstAction);
  if (simultaneousUnits.length >= 2 && new Set(simultaneousUnits.map((unit) => unit.side)).size >= 2) {
    return { simultaneous: true, actionKey: firstAction, units: simultaneousUnits };
  }
  return { simultaneous: false, actionKey: firstAction, units: [first] };
}

function executeActionBatch(state, batch, log) {
  if (batch.simultaneous && batch.actionKey === "guard") {
    batch.units.forEach((unit) => executeGuardProtection(state, unit, log));
    batch.units.forEach((unit) => executeGuardStrike(state, unit, log));
    return;
  }
  if (batch.simultaneous && batch.actionKey === "heal") {
    batch.units.forEach((unit) => executeHealPrayer(state, unit, log));
    batch.units.forEach((unit) => executePrayerStrike(state, unit, log));
    return;
  }
  batch.units.forEach((unit) => {
    if (!batch.simultaneous && unit.hp <= 0) return;
    const action = actions[actionFor(unit)];
    action.execute(state, unit, log);
  });
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
  const frontAlly = allies.find((ally) => ally.row === unit.row && ally.col < unit.col);
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

function executeHealPrayer(state, unit, log) {
  const targets = living(state, unit.side).filter((ally) => ally.hp < ally.maxHp);
  if (targets.length === 0) return;
  const target = targets.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  const amount = Math.max(7, Math.floor(unitStats(state, unit).at * SINGLE_HEAL_RATE));
  const healed = heal(target, amount);
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

function grantArmor(state, unit, amount, durationTurns = STANDARD_ARMOR_DURATION) {
  if (!unit.armorEffects) unit.armorEffects = [];
  unit.armorEffects.push({
    amount,
    duration: durationTurns,
    expiresOnTurn: Math.max(1, state.turn + durationTurns - 1),
  });
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
  if (effects.length === 0) return `装甲 ${total}`;
  const duration = Math.max(...effects.map((effect) => effect.duration || STANDARD_ARMOR_DURATION));
  return `装甲 ${total}/${duration}T`;
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

function dealDamageGroup(state, source, targetSpecs, actionName, log) {
  const events = targetSpecs
    .filter((spec) => spec.target && spec.target.hp > 0)
    .map((spec) => ({
      target: spec.target,
      targetId: spec.target.id,
      damage: damageForTarget(state, source, spec.target, spec.rawDamage, actionName),
    }));
  if (events.length === 0) return logNoTarget(source, log);

  const rangeCells = rangeCellsForAction(state, source, actionName, events[0].target);
  const beforeState = snapshotBattleState(state);
  events.forEach((event) => {
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

  const fallenEvents = events.filter((event) => event.target.hp === 0);
  if (fallenEvents.length > 0) {
    fallenEvents.forEach((event) => {
      log.push(`${unitLabel(event.target)} が戦闘不能`);
    });
    recordFrame(log, state, {
      type: "ko",
      targetId: fallenEvents[0].targetId,
      koEvents: fallenEvents.map((event) => ({ targetId: event.targetId })),
      text: `${fallenEvents.map((event) => event.target.card.name).join(" / ")} 戦闘不能`,
    });
    fallenEvents.forEach((event) => applyFallTriggers(state, event.target, log));
  }
}

function damageForTarget(state, source, target, rawDamage, actionName) {
  let context = unitStats(state, source, { kind: "attack", damage: rawDamage });
  let damage = context.damage;
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

  const incoming = unitStats(state, target, { kind: "incoming", damage });
  damage = incoming.damage - (actionName === "守護反撃" ? 0 : incoming.armor);
  if (target.card.abilityKey === "steady" && !target.firstHitReduced) {
    damage -= 2;
    target.firstHitReduced = true;
  }
  if (target.card.abilityKey === "rearWard" && target.col === 2 && ["狙撃", "掃射"].includes(actionName)) {
    damage -= 3;
  }
  return Math.max(1, Math.floor(damage));
}

function applyFallTriggers(state, fallen, log) {
  const side = fallen.side;
  const general = generalOf(state, side);
  const flag = `${side}FirstFallHeal`;
  if (general?.card.generalKey === "firstFallHeal" && !state.flags[flag] && !fallen.general) {
    state.flags[flag] = true;
    const healEvents = living(state, side)
      .map((unit) => ({ targetId: unit.id, amount: heal(unit, 5) }))
      .filter((event) => event.amount > 0);
    log.push(`${unitLabel(general)} の大将スキル: 味方全員HP+5`);
    if (healEvents.length > 0) {
      recordFrame(log, state, { type: "heal", sourceId: general.id, targetId: general.id, healEvents, text: `${general.card.name} の大将スキル` });
    }
  }
}

function heal(unit, amount) {
  const before = unit.hp;
  unit.hp = Math.min(unit.maxHp, unit.hp + amount);
  return unit.hp - before;
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
  log.push(`${unitLabel(general)} の大将スキル: 大将中列化で全員に装甲+${FALLBACK_WARD_ARMOR}/${STANDARD_ARMOR_DURATION}T`);
  recordFrame(log, state, { type: "buff", sourceId: general.id, targetId: general.id, buffEvents, text: `${general.card.name} の大将スキル` });
}

function triggerFinishSignal(state, exposedGeneral, log) {
  const attackerSide = opposite(exposedGeneral.side);
  const attackerGeneral = generalOf(state, attackerSide);
  const flag = `${attackerSide}FinishSignal`;
  if (attackerGeneral?.card.generalKey !== "finishSignal" || state.flags[flag]) return;
  state.flags[flag] = true;
  grantStatBuff(state, attackerGeneral, "at", FINISH_SIGNAL_AT, FINISH_SIGNAL_DURATION);
  log.push(`${unitLabel(attackerGeneral)} の大将スキル: 敵大将露出で自身にAT+${FINISH_SIGNAL_AT}/${FINISH_SIGNAL_DURATION}T`);
  recordBuffFrame(log, state, attackerGeneral, attackerGeneral, { at: FINISH_SIGNAL_AT, duration: FINISH_SIGNAL_DURATION }, `${attackerGeneral.card.name} の大将スキル`);
}

function checkGeneralVictory(state, log) {
  const playerGeneral = generalOf(state, "player");
  const enemyGeneral = generalOf(state, "enemy");
  const playerDown = playerGeneral && playerGeneral.hp <= 0;
  const enemyDown = enemyGeneral && enemyGeneral.hp <= 0;
  if (playerDown && enemyDown) {
    log.push("双方の大将が倒れたため引き分け");
    recordFrame(log, state, { type: "draw", text: "双方大将撃破" });
    return "draw";
  }
  if (playerDown) {
    log.push("自軍大将が倒れたため敵軍勝利");
    recordFrame(log, state, { type: "win", targetId: playerGeneral.id, text: "敵軍勝利" });
    return "enemy";
  }
  if (enemyDown) {
    log.push("敵軍大将が倒れたため自軍勝利");
    recordFrame(log, state, { type: "win", targetId: enemyGeneral.id, text: "自軍勝利" });
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
    return `引き分け。大将HP 自軍 ${playerHp} / 敵軍 ${enemyHp}。`;
  }
  const winnerText = winner === "player" ? "自軍" : "敵軍";
  return `${winnerText}勝利。大将HP 自軍 ${playerHp} / 敵軍 ${enemyHp}。`;
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

function actingTiePriority(unit) {
  return -unitActionCost(unit) * 1000 + boardPriority(unit);
}

function unitActionCost(unit) {
  return unit.general ? unit.card.generalCost : unit.card.soldierCost;
}

function unitLabel(unit) {
  const mark = unit.general ? "大将" : "兵";
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
      slot.setAttribute("aria-label", `${side === "player" ? "自軍" : "敵軍"} ${ROW_LABELS[row]} ${COL_LABELS[col]}`);
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
        ${unit.general ? '<span class="general-mark">将</span>' : ""}
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
        <strong>${unit.card.name}${unit.general ? " / 大将" : ""}</strong>
        <span>HP ${unit.maxHp} / AT ${stats.at} / AG ${stats.ag}</span>
      </div>
      <div class="popover-actions">
        ${actionVisualMarkup(state, unit, "前", unit.card.front)}
        ${actionVisualMarkup(state, unit, "中", unit.card.middle)}
        ${actionVisualMarkup(state, unit, "後", unit.card.rear)}
      </div>
      <div class="popover-note"><b>能力</b><span>${unit.card.ability}</span></div>
      <div class="popover-note"><b>大将</b><span>${unit.card.generalSkill}</span></div>
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
      <p>${actionFormulaText(state, unit, actionKey)}</p>
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
  if (actionKey === "guard") {
    const cols = [unit.col];
    if (unit.col > 0) cols.push(unit.col - 1);
    return { ...ally, cells: cols.map((col) => ({ row: unit.row, col })) };
  }
  if (actionKey === "rally") return allyCol(0);
  if (actionKey === "heal") return { ...ally, cells: rowsForDiagramCols([0, 1, 2]) };
  if (actionKey === "lineHeal") return allyLane();
  if (actionKey === "generalWard") return { ...ally, cells: [{ row: 1, col: 1 }] };
  if (actionKey === "command") return allyLane();
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
  if (col === 0) return ["上前", "中前", "下前"][row];
  if (col === 1) return ["上中", "中中", "下中"][row];
  return ["上後", "中後", "下後"][row];
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
  return `<div class="status-line">${statuses.map((status) => `<span class="status-chip ${status.tone ? `${status.tone}-chip` : ""}">${status.label}</span>`).join("")}</div>`;
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
  const incoming = unitStats(state, unit, { kind: "incoming", damage: 0 });
  const terrainId = state.terrain[unit.side][unit.row][unit.col];
  if (incoming.armor > 0) statuses.push({ label: armorStatusText(state, unit, incoming.armor), tone: "guard" });
  if (unit.card.abilityKey === "steady") statuses.push({ label: unit.firstHitReduced ? "初回済" : "初回-2", tone: "guard" });
  if (unit.card.abilityKey === "rearWard" && unit.col === 2) statuses.push({ label: "遠隔-3", tone: "guard" });
  if (terrainId === "rampart" && unit.col === 0) statuses.push({ label: "城壁-4", tone: "guard" });
  if (unit.general && !isGeneralExposed(state, unit)) statuses.push({ label: "大将護衛", tone: "guard" });
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
      if (event.armor) labels.push(`装甲${signedValue(event.armor)}${event.duration ? `/${event.duration}T` : ""}`);
      return labels;
    });
}

function actionName(unit) {
  return actions[actionFor(unit)].name;
}

function cardCostLabel(unit) {
  return `${unit.general ? "将" : "兵"}${unit.general ? unit.card.generalCost : unit.card.soldierCost}`;
}

function renderCosts(state) {
  const player = sideCost(state, "player");
  const enemy = sideCost(state, "enemy");
  els.playerCost.textContent = `Cost ${player.total}/${COST_LIMIT}・${player.cards}枚`;
  els.enemyCost.textContent = `Cost ${enemy.total}/${COST_LIMIT}・${enemy.cards}枚`;
  els.costSummary.textContent = `自軍 ${player.total}(${player.cards}枚) / 敵軍 ${enemy.total}(${enemy.cards}枚)`;
  els.terrainCost.textContent = `自軍地形 ${player.terrain} / 敵軍地形 ${enemy.terrain}`;
}

function sideCost(state, side) {
  const preset = currentPresetForSide(side);
  const units = createUnits(side, preset, state.terrain[side]);
  const cardCost = units.reduce((sum, unit) => sum + (unit.general ? unit.card.generalCost : unit.card.soldierCost), 0);
  const rawTerrain = terrainGridCost(state.terrain[side]);
  const discount = cards[preset.general].generalKey === "terrainDiscount" ? 2 : 0;
  const terrain = Math.max(0, rawTerrain - discount);
  return { cards: units.length, card: cardCost, terrain, total: cardCost + terrain };
}

function terrainGridCost(grid) {
  return grid.flat().reduce((sum, terrainId) => sum + terrainTypes[terrainId].cost, 0);
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
  els.selectedCardName.textContent = unit.preview ? `${unit.card.name} / 図鑑` : unit.general ? `${unit.card.name} / 大将` : unit.card.name;
  const stats = unitStats(state, unit);
  els.cardDetail.innerHTML = `
    <div class="detail-grid">
      <div class="detail-cell"><span>HP</span><strong>${unit.hp}/${unit.maxHp}</strong></div>
      <div class="detail-cell"><span>AT</span><strong>${stats.at}</strong></div>
      <div class="detail-cell"><span>AG</span><strong>${stats.ag}</strong></div>
      <div class="detail-cell"><span>Cost</span><strong>${unit.card.soldierCost}/${unit.card.generalCost}</strong></div>
    </div>
    ${unit.preview ? "" : `<div class="detail-actions"><button type="button" class="secondary" data-general-unit="${unit.id}">${unit.general ? "大将指定中" : "大将に指定"}</button></div>`}
    <div class="action-list">
      ${actionVisualMarkup(state, unit, "前", unit.card.front)}
      ${actionVisualMarkup(state, unit, "中", unit.card.middle)}
      ${actionVisualMarkup(state, unit, "後", unit.card.rear)}
    </div>
    <div class="terrain-item"><strong>軽減</strong><span>${defenseDetail(state, unit)}</span></div>
    <div class="terrain-item"><strong>能力</strong><span>${unit.card.ability}</span></div>
    <div class="terrain-item"><strong>大将スキル</strong><span>${unit.card.generalSkill}</span></div>
  `;
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
        <span>${action.text}</span>
        <span class="formula-line">${actionFormulaText(state, unit, actionKey)}</span>
      </div>
    </div>
  `;
}

function actionFormulaText(state, unit, actionKey) {
  const at = unitStats(state, unit).at;
  if (actionKey === "slash") return `式: AT×1.0 = ${at}ダメージ`;
  if (actionKey === "pierce") {
    return `式: 1体目 max(4, AT-5) = ${Math.max(4, at - 5)} / 2体目 max(4, AT-10) = ${Math.max(4, at - 10)}ダメージ / 守られた大将は×0.6`;
  }
  if (actionKey === "sweep") {
    const rearBonus = unit.card.abilityKey === "rearCannon" ? ` / 後列なら能力で+${REAR_CANNON_BONUS}` : "";
    return `式: max(4, AT-${SWEEP_DAMAGE_OFFSET}) = ${Math.max(4, at - SWEEP_DAMAGE_OFFSET)}ダメージ${rearBonus}`;
  }
  if (actionKey === "guard") {
    return `式: 装甲+${guardArmorFor(state, unit)}/${STANDARD_ARMOR_DURATION}T、反撃 max(6, floor(AT×${GUARD_STRIKE_RATE})) = ${guardStrikeDamageFor(state, unit)}ダメージ（装甲無視）${unit.card.abilityKey === "rampartCraft" ? "（城壁上なら装甲+5込み）" : ""}`;
  }
  if (actionKey === "rally") return `式: 味方前列にAT+${RALLY_AT}/${RALLY_DURATION}T`;
  if (actionKey === "heal") {
    const blessing = unit.card.abilityKey === "blessing" ? ` / 能力で装甲+${BLESSING_ARMOR}/${STANDARD_ARMOR_DURATION}T` : "";
    return `式: max(7, floor(AT×${SINGLE_HEAL_RATE})) = ${Math.max(7, Math.floor(at * SINGLE_HEAL_RATE))}回復、反撃 max(5, floor(AT×${PRAYER_STRIKE_RATE})) = ${prayerStrikeDamageFor(state, unit)}ダメージ${blessing}`;
  }
  if (actionKey === "lineHeal") {
    const bonus = unit.card.abilityKey === "widePrayer" ? ` / 能力で+${WIDE_PRAYER_BONUS}` : "";
    return `式: 同段味方に max(6, floor(AT×${LINE_HEAL_RATE})) = ${lineHealAmountFor(state, unit)}回復${bonus}`;
  }
  if (actionKey === "generalWard") {
    return `式: 味方大将に装甲+${generalWardArmorFor(unit)}/${GENERAL_WARD_DURATION}T / max(5, floor(AT×${GENERAL_WARD_HEAL_RATE})) = ${generalWardHealFor(state, unit)}回復`;
  }
  if (actionKey === "snipe") return `式: max(5, AT-${SNIPE_DAMAGE_OFFSET}) = ${Math.max(5, at - SNIPE_DAMAGE_OFFSET)}ダメージ / 守られた大将は×0.55`;
  if (actionKey === "raid") return `式: max(5, AT-${RAID_DAMAGE_OFFSET}) = ${Math.max(5, at - RAID_DAMAGE_OFFSET)}ダメージ / 守られた大将は×0.65 / 中列対象なら+${MIDDLE_RAID_BONUS}`;
  if (actionKey === "command") return `式: 同段味方にAG+${COMMAND_AG} / AT+${commandAtBonusFor(unit)} / ${COMMAND_DURATION}T`;
  if (actionKey === "siege") {
    const breakerBonus = unit.card.abilityKey === "generalBreaker" ? " / 能力で大将に+4" : "";
    return `式: AT×1.0 = ${at}ダメージ / 露出大将なら+6${breakerBonus}`;
  }
  return "式: 効果なし";
}

function defenseDetail(state, unit) {
  const incoming = unitStats(state, unit, { kind: "incoming", damage: 0 });
  const parts = [armorStatusText(state, unit, incoming.armor)];
  const terrainId = state.terrain[unit.side][unit.row][unit.col];
  if (terrainId === "rampart" && unit.col === 0) parts.push("城壁で被ダメージ-4");
  if (unit.card.abilityKey === "steady") parts.push("各ターン初回被ダメージ-2");
  if (unit.card.abilityKey === "rearWard" && unit.col === 2) parts.push("後列中は遠隔被ダメージ-3");
  if (terrainId === "shrine") parts.push("祭壇で被ダメージ+1");
  return parts.join(" / ");
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
      <span>Cost ${terrain.cost}</span>
      <p>${terrain.text}</p>
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
        <span>HP ${card.hp} / AT ${card.at} / AG ${card.ag} / Cost 兵${card.soldierCost}・将${card.generalCost}</span>
      </div>
      <div class="tag-line">${card.tags.map((tag) => `<span>${tagLabel(tag)}</span>`).join("")}</div>
      <p><b>能力</b>${card.ability}</p>
      <p><b>大将</b>${card.generalSkill}</p>
      <p><b>行動</b>前:${actions[card.front].name} / 中:${actions[card.middle].name} / 後:${actions[card.rear].name}</p>
    </article>
  `).join("");

  els.actionReference.innerHTML = Object.entries(actions).map(([key, action]) => `
    <article class="reference-item">
      <div class="reference-title">
        <strong>${action.name}</strong>
        <span>${actionKindLabel(key)}</span>
      </div>
      <p>${action.text}</p>
      <p><b>仕様</b>${actionSpecText(key)}</p>
    </article>
  `).join("");

  els.terrainReference.innerHTML = Object.entries(terrainTypes).map(([key, terrain]) => `
    <article class="reference-item">
      <div class="reference-title">
        <strong>${terrain.name}</strong>
        <span>Cost ${terrain.cost}</span>
      </div>
      <p>${terrain.text}</p>
      <p><b>性質</b>${terrainSpecText(key)}</p>
    </article>
  `).join("");
}

function tagLabel(tag) {
  const labels = {
    heavy: "重装",
    leader: "指揮官",
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
    leader: "大将スキルや指揮に関わるカード群。",
    sea: "海地形でATと装甲が上がる。",
    ranged: "森でAGが上がり、高地/森からの攻撃補正を受けやすい。",
    support: "回復、装甲、AT/AG強化を担当する。",
    scout: "高AGで奇襲や先制行動に向く。",
    assault: "前線突破と大将撃破に向く。",
  };
  return specs[tag] || tag;
}

function actionKindLabel(actionKey) {
  if (["slash", "pierce", "sweep", "snipe", "raid", "siege"].includes(actionKey)) return "攻撃";
  if (["guard", "generalWard"].includes(actionKey)) return "防御";
  if (["rally", "command"].includes(actionKey)) return "強化";
  if (["heal", "lineHeal"].includes(actionKey)) return "回復";
  return "待機";
}

function actionSpecText(actionKey) {
  const specs = {
    slash: "最前の敵1体。AT×1.0ダメージ。",
    pierce: "同段の前から2体。1体目 max(4, AT-5)、2体目 max(4, AT-10)。守られた大将には×0.6。ランス能力で条件達成時+2。",
    sweep: `敵前列全体。max(4, AT-${SWEEP_DAMAGE_OFFSET})。キャノン能力で後列時+${REAR_CANNON_BONUS}。`,
    guard: `自分と同段前方の味方に装甲+${GUARD_ARMOR}/1T。ビルダー能力で城壁上なら装甲+${GUARD_ARMOR + RAMPART_GUARD_BONUS}/1T。さらに同段最前の敵へ装甲無視の小ダメージ。`,
    rally: "味方前列全体にAT+3/2T。",
    heal: `HP割合が最も低い味方を max(7, floor(AT×${SINGLE_HEAL_RATE})) 回復し、同段最前の敵へ小ダメージ。ヒーラー能力で対象に装甲+${BLESSING_ARMOR}/1T。`,
    lineHeal: `同段の傷ついた味方全体を max(6, floor(AT×${LINE_HEAL_RATE})) 回復。プリースト能力で+2。`,
    generalWard: `味方大将に装甲+${GENERAL_WARD_ARMOR}/1Tと max(5, floor(AT×0.35)) 回復。パラディン能力で装甲+4。`,
    snipe: `後列優先。max(5, AT-${SNIPE_DAMAGE_OFFSET})。守られた大将には×0.55。アーチャー大将の初回狙撃は+5。`,
    raid: `中後列の低HPを優先。max(5, AT-${RAID_DAMAGE_OFFSET})。守られた大将には×0.65。ローグ能力で中列対象なら+${MIDDLE_RAID_BONUS}。`,
    command: "同段の自分以外の味方にAG+8/AT+2/1T。コマンダー能力でAT+3。",
    siege: "露出大将を優先。AT×1.0、露出大将なら+6。ブレイカー能力で大将対象ならさらに+4。",
    wait: "行動しない。",
  };
  return specs[actionKey] || "未定義。";
}

function terrainSpecText(terrainKey) {
  const specs = {
    plain: "バランス調整の基準。初期地形は全プリセット平地。",
    forest: "遠隔/斥候タグのカードだけAGが上がる。手数や先制順の調整用。",
    sea: "海適性タグはATと装甲が上がる。重装タグはAGが下がる。",
    highland: "後列から攻撃した時だけ与ダメージが上がる。",
    shrine: "ターン開始時にHP+3。代償として被ダメージ+1。",
    rampart: "前列時の被ダメージを下げる。ビルダーの守護も強化される。",
  };
  return specs[terrainKey] || "未定義。";
}

function renderLog(log, activeIndex = -1) {
  els.battleLog.innerHTML = "";
  log.forEach((item) => {
    const li = document.createElement("li");
    const index = els.battleLog.children.length;
    if (item.startsWith("TURN")) {
      li.className = "turn-break";
      li.textContent = item.replace("TURN", "Turn");
    } else {
      li.textContent = item;
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
  grid[row][col] = keys[(current + 1) % keys.length];
  selectedUnitId = null;
  renderSetup();
}

function getPreset(id) {
  return presets.find((preset) => preset.id === id) || presets[0];
}

function presetCost(preset) {
  const units = createUnits("player", preset, preset.terrain);
  const card = units.reduce((sum, unit) => sum + (unit.general ? unit.card.generalCost : unit.card.soldierCost), 0);
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
