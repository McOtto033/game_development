# コア中央定義フォーマット v0

## 目的

カード設計に入る前に、最優先で中央定義するデータの形を決める。

対象は以下。

```text
CLASSIFICATIONS
TRAITS
ATTRIBUTES
TERRAINS
PREFERRED_TERRAIN_RULES
EFFECT_ELEMENTS
TARGET_PATTERNS
ACTION_METADATA
STATUS_EFFECTS
ULTIMATE_RULES
RARITIES
RULESET_PHASES
```

`ROLES` はユーザー向け参考情報なので、この文書では低優先とする。検索、採点、戦闘処理では `位置 × 効果要素 × 対象パターン` を主軸にする。

## RULESET_PHASES / unlockPhase

2026-09-07、M1-02で最小導入済み。[段階解禁の仕様 v0](ruleset-phases-v0.md) が現在の本体仕様。`core/depth/metaChanging` に順位を持たせ、`unlockPhase` と `implemented` を独立に判定する。既存29カードはすべてCoreで維持し、未実装状態を段階名だけで有効化しない。以下は設計の背景と初期の定義例。

ゲームシステムの設計は、初期実装/初期公開で使わない効果や状態も含めた完成形を前提に行う。

ただし、公開時は完成形の一部だけを出し、カード追加、シーズン進行、環境変化に合わせて新しい状態や効果を段階解禁する。

そのため、効果要素、状態、カード、特性、地形、生成テンプレートには、必要に応じて `unlockPhase` を持たせる。

```js
const RULESET_PHASES = {
  core: {
    name: "Core",
    description: "初期公開。攻撃、防御、単発回復、基本的な状態付与を中心にする。",
  },
  depth: {
    name: "Depth",
    description: "追加カードとともに相互作用を増やす。継続回復、反撃、解除などを段階的に扱う。",
  },
  metaChanging: {
    name: "Meta-changing",
    description: "環境変化用。行動制御、復活、強い状態対策など、メタを大きく変える要素を扱う。",
  },
};
```

運用方針:

- `unlockPhase` は公開/検証時期を表す。完成形の設計対象から外す印ではない。
- 未公開ギミックも、相互作用、対策、ログ、表示枠を早めに設計する。
- 行動制御は順序枠だけ先に置き、初期実装/初期公開では未使用にする。
- 初期公開後にプレイヤーを飽きさせないため、カード追加と新ギミック解禁を連動させる。

## CLASSIFICATIONS

分類は、生物としての大分類。分類そのものには原則として共通効果を持たせない。

本実装の分類一覧と設計傾向は [カードレイヤー設計メモ v0](card-layer-design-memo-v0.md) を参照する。この節のコードは定義形の最小例。

正規分類ID:

```text
fish
amphibian
reptile
bird
mammal
crustacean
insect
plant
fungi
dragon
inorganicLife
phantomBeast
mollusk
```

`dinosaur` と `pterosaur` は使わない。恐竜系と翼竜系は `reptile` に含める。`crystalLife` は `inorganicLife` へ統合し、`insect` と `crustacean` は独立分類として扱う。

```js
const CLASSIFICATIONS = {
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
    description: "強攻撃、高HP、古代、巨大、水棲などを持ちやすい分類。恐竜系と翼竜系も含む。",
    commonTraits: ["aquatic", "ancient", "giant", "flying", "predation"],
  },
};
```

必須フィールド:

| フィールド | 内容 |
|---|---|
| `name` | UI表示名 |
| `description` | クリック/一覧用説明 |
| `commonTraits` | 付きやすい特性ID。ルール効果ではなく設計傾向 |

## TRAITS

特性は、生態に由来する実効果。UIでクリック/タップ説明を出す。

```js
const TRAITS = {
  flying: {
    name: "飛行",
    shortText: "地形効果を受けない。",
    rulesText: "このカードは配置マスの地形効果を受けない。",
    effectElements: ["terrainBypass"],
    counters: ["antiFlying"],
    scoreModifier: 10,
  },
  aquatic: {
    name: "水棲",
    shortText: "海以外ではAT/AGが0.8倍。",
    rulesText: "海以外の地形にいる間、AT/AGを0.8倍として扱う。",
    effectElements: ["terrainDependency"],
    terrainCondition: {
      except: ["sea"],
      statMultiplier: { at: 0.8, ag: 0.8 },
    },
    scoreModifier: -8,
  },
  predation: {
    name: "捕食",
    shortText: "低HPの敵への攻撃性能が上がる。",
    rulesText: "HP割合が低い敵を攻撃する時、ダメージが上がる。",
    effectElements: ["executeBonus"],
    counters: ["barrier", "heal"],
    scoreModifier: 12,
  },
};
```

必須フィールド:

| フィールド | 内容 |
|---|---|
| `name` | UI表示名 |
| `shortText` | カード詳細ツールチップ用 |
| `rulesText` | 特性一覧/ヘルプ用 |
| `effectElements` | 採点/処理で参照する効果要素 |

任意フィールド:

| フィールド | 内容 |
|---|---|
| `terrainCondition` | 特性固有の地形条件。得意地形はカード本体の `preferredTerrain` に置く |
| `counters` | 対策される効果/特性 |
| `scoreModifier` | 暫定評価点 |

## ATTRIBUTES

属性は、攻撃、状態、効果の性質。分類や特性とは分ける。詳細な採用基準は [カード分類・特性・属性メモ v0](card-taxonomy-traits-attributes-v0.md) を正本にする。

初期方針:

- カード本体へ単一属性を必須で持たせない。
- まずは行動コンポーネントの任意項目 `attributes` として使う。
- 属性名だけでダメージ倍率、弱点、耐性を隠し処理しない。
- 実効果は `effectElements`、`STATUS_EFFECTS`、条件式、式IDへ分解する。

```js
const ATTRIBUTES = {
  physical: {
    name: "物理",
    shortText: "通常の接触、突進、噛みつきなどの属性。",
    relatedEffectElements: ["singleAttack", "areaAttack"],
  },
  electric: {
    name: "電気",
    shortText: "発電系の攻撃やAG操作に使う属性。",
    relatedTraits: ["electric"],
    relatedEffectElements: ["agBuff", "agDebuff"],
    relatedStatusEffects: ["paralysis"],
  },
  acid: {
    name: "酸",
    shortText: "装甲や回復を崩す腐蝕系の属性。",
    relatedEffectElements: ["defenseDown", "healBlock", "barrierPierce"],
  },
  poison: {
    name: "毒",
    shortText: "毒や継続ダメージに使う属性。",
    relatedTraits: ["poisonous", "parasitic"],
    relatedStatusEffects: ["poison", "contactPoison"],
  },
};
```

行動側:

```js
const ACTION_METADATA = {
  highVoltageDischarge: {
    name: "強放電",
    text: "敵前衛へダメージを与え、AGを下げる。",
    components: [
      {
        effectElements: ["areaAttack", "agDebuff"],
        targetPattern: "frontRankEnemies",
        formula: "atDamageAndAgMinus10",
        attributes: ["electric"],
      },
    ],
  },
};
```

耐性や弱点を実装する場合だけ、カード本体に `resistAttributes`、`weakAttributes` などの任意項目を追加する。

## TERRAINS

地形は盤面マスの効果。カード本体の `preferredTerrain`、特性の `terrainCondition` とは分ける。

```js
const PREFERRED_TERRAIN_RULES = {
  statMultiplier: { at: 1.2, ag: 1.2 },
  appliesTo: ["at", "ag"],
};

const TERRAINS = {
  plain: {
    name: "平地",
    shortText: "標準地形。共通ペナルティなし。",
    effects: [],
  },
  forest: {
    name: "森",
    shortText: "森林/ジャングル系の統合候補。",
    effects: [],
  },
  rockyMountain: {
    name: "岩山",
    shortText: "岩場、崖、山岳系の配置コンボ用。",
    effects: [],
  },
  sea: {
    name: "海",
    shortText: "得意でないカードはAGが0.5倍。",
    nonPreferredEffects: [
      { effectElements: ["agDebuff"], statMultiplier: { ag: 0.5 } },
    ],
  },
  desert: {
    name: "砂漠",
    shortText: "得意でないカードはAGが0.8倍。",
    nonPreferredEffects: [
      { effectElements: ["agDebuff"], statMultiplier: { ag: 0.8 } },
    ],
  },
  volcano: {
    name: "火山",
    shortText: "得意でないカードは毎ターンダメージ。",
    nonPreferredEffects: [
      { effectElements: ["terrainDamage"], timing: "turnStart" },
    ],
  },
  polar: {
    name: "極地",
    shortText: "得意でないカードは毎ターンAT/AGが下がる。",
    nonPreferredEffects: [
      { effectElements: ["atDebuff", "agDebuff"], timing: "turnStart" },
    ],
  },
};
```

必須フィールド:

| フィールド | 内容 |
|---|---|
| `name` | UI表示名 |
| `shortText` | 地形ツールチップ用 |
| `effects` / `nonPreferredEffects` | 地形効果。実処理は `effectElements` へ分解する |

現プロトタイプの `高地`、`活性巣`、`殻壁` は、岩山への統合、特殊地形化、カード生成地形化のどれにするか本実装前に決める。

## EFFECT_ELEMENTS

効果要素は、行動、特性、必殺技、α特性を採点するための最小単位。

```js
const EFFECT_ELEMENTS = {
  singleAttack: {
    name: "単体攻撃",
    category: "attack",
    baseScore: 5,
  },
  areaAttack: {
    name: "範囲攻撃",
    category: "attack",
    baseScore: 12,
    riskFlags: ["aoeOverkill"],
  },
  searchAttack: {
    name: "サーチ攻撃",
    category: "attack",
    baseScore: 14,
    riskFlags: ["searchSnowball"],
  },
  executeBonus: {
    name: "追撃補正",
    category: "attack",
    baseScore: 8,
  },
  heal: {
    name: "回復",
    category: "heal",
    baseScore: 4,
  },
  armor: {
    name: "装甲",
    category: "defense",
    baseScore: 5,
  },
  barrier: {
    name: "バリア",
    category: "defense",
    baseScore: 8,
  },
  damageCut: {
    name: "ダメージカット",
    category: "defense",
    baseScore: 7,
  },
  atBuff: {
    name: "AT強化",
    category: "support",
    baseScore: 6,
  },
  agBuff: {
    name: "AG操作",
    category: "support",
    baseScore: 10,
    riskFlags: ["firstStrikeLock"],
  },
  ultimateCharge: {
    name: "必殺技短縮",
    category: "support",
    baseScore: 12,
    riskFlags: ["ultimateLoop"],
  },
  atDebuff: {
    name: "AT弱体",
    category: "disrupt",
    baseScore: 6,
  },
  agDebuff: {
    name: "AG弱体",
    category: "disrupt",
    baseScore: 9,
    riskFlags: ["firstStrikeLock"],
  },
  defenseDown: {
    name: "防御低下",
    category: "disrupt",
    baseScore: 7,
  },
  healBlock: {
    name: "回復封じ",
    category: "disrupt",
    baseScore: 10,
  },
  barrierPierce: {
    name: "バリア貫通",
    category: "disrupt",
    baseScore: 12,
  },
  terrainBypass: {
    name: "地形無視",
    category: "trait",
    baseScore: 10,
  },
  terrainDependency: {
    name: "地形依存",
    category: "trait",
    baseScore: -8,
  },
  terrainDamage: {
    name: "地形ダメージ",
    category: "terrain",
    baseScore: 6,
  },
};
```

必須フィールド:

| フィールド | 内容 |
|---|---|
| `name` | UI/設計表示名 |
| `category` | 攻撃、回復、防御、支援、妨害などの大分類 |
| `baseScore` | 採点の基礎点 |

## TARGET_PATTERNS

対象パターンは、効果が誰に届くかを表す。カード選択画面の検索にも使う。

```js
const TARGET_PATTERNS = {
  frontEnemy: {
    name: "最前の敵",
    side: "enemy",
    shape: "single",
    priority: "front",
    depthAccess: [0],
  },
  frontRankEnemies: {
    name: "敵前衛全体",
    side: "enemy",
    shape: "rank",
    priority: "all",
    depthAccess: [0],
  },
  rearEnemyPriority: {
    name: "敵後衛優先",
    side: "enemy",
    shape: "single",
    priority: "rear",
    depthAccess: [2],
  },
  lowestHpEnemy: {
    name: "低HPの敵",
    side: "enemy",
    shape: "single",
    priority: "lowestHp",
    depthAccess: [0, 1, 2],
  },
  sameLaneAllies: {
    name: "同列の味方",
    side: "ally",
    shape: "lane",
    priority: "all",
    depthAccess: [0, 1, 2],
  },
};
```

必須フィールド:

| フィールド | 内容 |
|---|---|
| `name` | UI/検索表示名 |
| `side` | `enemy` / `ally` / `self` |
| `shape` | `single` / `rank` / `lane` / `all` など |
| `priority` | 最前、後衛優先、低HP優先など |
| `depthAccess` | 届く奥行き。前衛0、中衛1、後衛2 |

## ACTION_METADATA

行動はカード固有名を許容する。ただし、検索と採点のためにメタデータを必ず持つ。

カード固有技であっても、行動IDを作って `ACTION_METADATA` に登録する。カード本体は行動IDだけを参照し、効果要素、対象パターン、式、説明は `ACTION_METADATA` を正本にする。

1つの行動が複数の効果を持つ場合は、`components` に分解する。例えば「回復し、さらに攻撃する」行動は、回復コンポーネントと攻撃コンポーネントを別々に持つ。

```js
const ACTION_METADATA = {
  bite: {
    name: "噛み砕き",
    text: "最前の敵1体にダメージ。",
    components: [
      {
        effectElements: ["singleAttack"],
        targetPattern: "frontEnemy",
        formula: "atDamage",
      },
    ],
  },
  predatoryCharge: {
    name: "捕食突進",
    text: "低HPの敵を狙ってダメージ。",
    components: [
      {
        effectElements: ["singleAttack", "searchAttack"],
        targetPattern: "lowestHpEnemy",
        formula: "atMinus5Min5",
      },
    ],
  },
  nervePulse: {
    name: "神経電位",
    text: "同列の味方にAG強化。",
    components: [
      {
        effectElements: ["agBuff"],
        targetPattern: "sameLaneAllies",
        formula: "agPlus8",
      },
    ],
  },
  guardedMend: {
    name: "防衛再生",
    text: "低HPの味方を回復し、装甲を付与。",
    components: [
      {
        effectElements: ["heal"],
        targetPattern: "lowestHpAlly",
        formula: "atHeal",
      },
      {
        effectElements: ["armor"],
        targetPattern: "lowestHpAlly",
        formula: "fixedArmor",
      },
    ],
  },
};
```

カード側:

```js
frontAction: "bite",
middleAction: "predatoryCharge",
rearAction: "nervePulse",
```

検索時は、カードの `frontAction/middleAction/rearAction` を展開して以下の形にする。

```js
{
  cardId: "megalodon",
  slot: "middle",
  actionId: "predatoryCharge",
  componentIndex: 0,
  effectElements: ["singleAttack", "searchAttack"],
  targetPattern: "lowestHpEnemy",
}
```

この展開データで「中衛でサーチ攻撃できるカード」などを検索する。複合行動はコンポーネントごとに検索レコードが作られるため、「回復できるカード」と「装甲を付与できるカード」の両方で同じ行動を拾える。

## STATUS_EFFECTS

状態異常/状態効果は、継続効果と対策関係を中央定義する。

2026-09-07、M1-01で本体の状態定義を拡張した。実装仕様は [状態効果の仕様 v0](status-effect-rules-v0.md)。下記は初期の最小例であり、現在の本体は `family`, `implemented`, `stacking`, `refresh`, `defaultDuration`, `clearMasks` も保持する。毒/防御低下の固定値も状態定義から参照し、段末付与用ファミリーマップを派生生成する。未公開の継続回復は定義だけを置き、`implemented: false` で付与を拒否する。

```js
const STATUS_EFFECTS = {
  poison: {
    name: "毒",
    kind: "debuff",
    timing: "turnStart",
    shortText: "ターン開始時にダメージ。",
    counters: ["poisonResist"],
  },
  healBlock: {
    name: "回復封じ",
    kind: "debuff",
    timing: "beforeHeal",
    shortText: "回復を受けられない。",
    counters: ["cleanse"],
  },
  barrier: {
    name: "バリア",
    kind: "buff",
    timing: "beforeDamage",
    shortText: "一定量のダメージを防ぐ。",
    counters: ["barrierPierce"],
  },
};
```

## ULTIMATE_RULES

必殺技全体の共通ルール。

```js
const ULTIMATE_RULES = {
  chargeUnit: "turn",
  defaultTiming: "action",
  replacesNormalAction: true,
  resetAfterUse: true,
  followsAgOrder: true,
  minTurns: 3,
  defaultTurns: 5,
};
```

カード固有の必殺技:

```js
ultimate: {
  id: "deepHunt",
  name: "深海捕食",
  turns: 5,
  components: [
    {
      effectElements: ["areaAttack", "executeBonus"],
      targetPattern: "allDamagedEnemies",
      formula: "atMinus8Area",
    },
  ],
}
```

## RARITIES

レアリティは枚数制限、複雑さ、演出価値、入手性の制御に使う。

```js
const RARITIES = {
  common: {
    name: "C",
    displayName: "コモン",
    maxCopies: 3,
    complexity: "low",
  },
  rare: {
    name: "R",
    displayName: "レア",
    maxCopies: 2,
    complexity: "middle",
  },
  legendary: {
    name: "L",
    displayName: "レジェンド",
    maxCopies: 1,
    complexity: "high",
  },
};
```

レアリティは強さの免罪符ではなく、枚数制限と複雑さの管理に使う。

## 最小カードデータ形

最小形は以下。

```js
const card = {
  id: "mosasaurus",
  name: "モササウルス",
  rarity: "rare",
  classification: "reptile",
  traits: ["aquatic", "ancient", "predation"],
  resistAttributes: ["poison"], // 任意。耐性/弱点ルールを実装した段階で使う。
  hp: 150,
  at: 40,
  ag: 22,
  cost: 6,
  alphaCost: 8,
  preferredTerrain: ["sea"],
  frontAction: "bite",
  middleAction: "predatoryCharge",
  rearAction: "divePressure",
  ultimate: "abyssalDevour",
  alphaTrait: "ancientApex",
  codexText: "海域の上位捕食者として観測される大型爬虫類。",
};
```

`roles` は必須にしない。必要なら、行動メタデータから後で推定する。
