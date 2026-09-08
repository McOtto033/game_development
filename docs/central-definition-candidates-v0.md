# 中央定義候補 v0

## 目的

カード、UI、戦闘処理、採点、図鑑で同じ概念を別々に直書きしないため、中央定義にする候補を洗い出す。

中央定義は便利だが、増やしすぎるとデータ設計が重くなる。現時点では、以下の基準で採用判断する。

最優先項目の具体的なデータ形は [コア中央定義フォーマット v0](core-data-definitions-v0.md) で管理する。

| 判断基準 | 採用寄りになる条件 |
|---|---|
| 変更頻度 | 用語や効果が今後変わりそう |
| 参照箇所 | UI、戦闘処理、採点、図鑑など複数箇所から参照する |
| ルール性 | そのIDに実際のゲーム効果がある |
| 検索性 | デッキ構築やカード一覧でフィルタしたい |
| 整合性リスク | 直書きすると説明と処理がズレやすい |

## 採用区分

| 区分 | 意味 |
|---|---|
| 必須 | 早めに中央定義すべき |
| 推奨 | 実装が近づいたら中央定義すべき |
| 条件付き | 機能が増えたら中央定義する |
| 後回し | 今は文書管理でよい |
| 非推奨 | 中央定義すると重くなる |

## 候補一覧

| 候補 | 採用判断 | 理由 |
|---|---|---|
| UI用語 | 必須 | `α`、前衛/中衛/後衛などは変更頻度が高く、全画面に出る |
| 盤面座標/表示名 | 必須 | 前衛/中衛/後衛、左列/中央列/右列は対象範囲、ログ、UIで共通 |
| ステータス定義 | 必須 | HP/AT/AGはUI、採点、戦闘計算で共通 |
| コスト種別 | 必須 | 通常コスト、αコスト、地形コストを混同しないため |
| 分類 | 必須 | カード検索、分類強化、図鑑、世界観の軸になる |
| 特性 | 必須 | 飛行/水棲/捕食などは実効果を持ち、処理と説明がズレやすい |
| 属性 | 推奨 | 電気、酸、毒などの攻撃/状態の性質。分類/特性とは別に、行動コンポーネントへ任意付与する |
| 役割タグ | 条件付き | ユーザーへの参考情報。検索/採点の主軸にはしない |
| レアリティ | 推奨 | 枚数制限や演出、入手性と関係する。実装前に中央化したい |
| 地形 | 必須 | すでに `terrainTypes` として中央定義に近い。効果、コスト、説明を一元化すべき |
| 行動 | 必須 | すでに `actions` として中央定義に近い。名前、説明、処理、採点要素を持たせる |
| 行動検索メタデータ | 必須 | デッキ構築で特定の位置、効果、対象を持つカードを探すために必要 |
| 必殺技 | 必須 | 新規UI項目であり、必要ターン、効果、短縮/遅延、採点が絡む |
| 状態異常/状態効果 | 必須 | 毒、麻痺、回復封じ、バリアなどは説明と処理の一致が重要 |
| 効果要素 | 必須 | 攻撃、回復、強化、妨害、範囲、サーチなどは採点自動化に必要 |
| 対象指定パターン | 必須 | 最前、低HP、後衛優先、ランダム対象などは強さに直結する |
| 効果量式 | 推奨 | `AT-6`、`AT*0.65` などを採点と説明に使うなら中央化したい |
| タイミング/フェーズ | 推奨 | 開戦時、ターン開始時、行動時、戦闘不能時、必殺技発動時など |
| 条件式 | 推奨 | 海上なら、α露出時、HP一定以下などはカードが増えると再利用される |
| α特性 | 推奨 | カード固有ではあるが、タイミングや効果要素は中央定義を参照すべき |
| 採点重み | 必須 | コスト・レアリティの納得感に直結するため、文書/データで一元管理する |
| 危険フラグ | 推奨 | `stallRisk`、`ultimateLoop` などは調整レビューに使える |
| ログ文テンプレート | 条件付き | ログ品質が重要になったら中央化。初期は `uiText()` 変換で十分 |
| UIアイコン/色 | 条件付き | 特性、役割、地形を視覚化する段階で中央化 |
| フィルタ項目 | 条件付き | カード一覧/デッキ編集で絞り込みを作る時に中央化 |
| 図鑑カテゴリ | 条件付き | 図鑑が増えたら分類、特性、地形、出典パックで中央化 |
| カードセット/パック | 条件付き | カード入手、収録、環境区分を扱う段階で必要 |
| フォーマット/レギュレーション | 条件付き | レアリティ枚数制限、禁止/制限カード、シーズン制を入れる時に必要 |
| デッキアーキタイプ | 後回し | ユーザーに発見させる部分。内部設計メモとしては有用 |
| カードコンセプト | 後回し | UIには出さない。中央定義というよりカードごとの内部メモ |
| 想定対策/想定シナジー | 後回し | カードごとの内部メモに入れる。検索用DB化は後でよい |
| 調整履歴 | 後回し | カードごとに持つ。中央定義ではなく履歴管理 |
| フレーバー文 | 非推奨 | カード固有文なので中央化しすぎると表現が硬くなる |
| カード名 | 非推奨 | 固有名はカードデータに置く。命名ルールだけ文書化する |
| 個別勝ち筋説明 | 非推奨 | UIに出すと発見の快感を削る |

## 必須で中央定義する項目

### UI用語

現状の `TERMS` が該当する。

```js
const TERMS = {
  alpha: "α",
  alphaTrait: "α特性",
  ranks: ["前衛", "中衛", "後衛"],
  lanes: ["左列", "中央列", "右列"],
};
```

採用理由:

- 用語変更が起きやすい。
- UI、ログ、カード詳細、図鑑に横断的に出る。
- 直書きすると置換漏れが発生しやすい。

### 分類

分類は「何の生物群か」を表す。分類そのものには原則として共通効果を持たせない。

```js
const CLASSIFICATIONS = {
  bird: {
    name: "鳥類",
    description: "高AG、奇襲、後衛到達を持ちやすい分類。",
    examples: ["飛行", "疾走", "擬態"],
  },
  fish: {
    name: "魚類",
    description: "海地形、高ステータス、捕食と相性がよい分類。",
    examples: ["水棲", "捕食", "群泳"],
  },
  reptile: {
    name: "爬虫類",
    description: "高HP、古代、巨大、水棲などを持ちやすい分類。",
    examples: ["水棲", "古代", "巨大", "甲殻"],
  },
};
```

採用理由:

- 分類強化デッキを作れる。
- 図鑑、検索、カード一覧フィルタに使う。
- 特性と分けることで、魚類/爬虫類の水棲横断デッキのような構築を作れる。

### 特性

特性は「生態に由来する実効果」を表す。

```js
const TRAITS = {
  flying: {
    name: "飛行",
    shortText: "地形効果を受けない。",
    rulesText: "このカードは配置マスの地形効果を受けない。",
    scoringTags: ["terrainBypass", "stability"],
  },
  aquatic: {
    name: "水棲",
    shortText: "海以外ではHP/AT/AGが0.8倍。",
    rulesText: "海以外の地形にいる間、HP/AT/AGを0.8倍として扱う。",
    scoringTags: ["terrainDependency", "highBaseStats"],
  },
  predation: {
    name: "捕食",
    shortText: "低HPの敵への攻撃性能が上がる。",
    rulesText: "HP割合が低い敵を攻撃する時、ダメージが上がる。",
    scoringTags: ["execute", "searchSynergy"],
  },
};
```

採用理由:

- UI説明、戦闘処理、採点で必ず参照する。
- 特性説明をクリック/タップで表示できる。
- 特性一覧を自動生成できる。
- 特性強化、特性対策、特性フィルタを作れる。

注意:

- 特定の行動だけに付く効果は特性にしない。
- 例: 「後衛から攻撃時ダメージ+3」は後衛行動の効果に含める。

### 行動検索メタデータ

デッキ構築で本当に必要なのは、「攻撃役」などの大ざっぱな役割よりも、特定の位置で、どの効果を、どの対象へ使えるかである。

```js
const ACTION_METADATA = {
  corrosiveSpray: {
    name: "腐蝕噴霧",
    components: [
      {
        effectElements: ["areaAttack", "defenseDown"],
        targetPattern: "frontRankEnemies",
      },
    ],
  },
  tideMend: {
    name: "潮汐再生",
    components: [
      {
        effectElements: ["heal"],
        targetPattern: "lowestHpAlly",
      },
      {
        effectElements: ["armor"],
        targetPattern: "lowestHpAlly",
      },
    ],
  },
  nervePulse: {
    name: "神経電位",
    components: [
      {
        effectElements: ["agBuff"],
        targetPattern: "sameLaneAllies",
      },
    ],
  },
};
```

採用理由:

- カード選択画面で「後衛で回復できるカード」「中衛でAG操作できるカード」「敵後衛を狙えるカード」を探せる。
- 採点で、行動位置係数、効果要素点、対象面点を機械的に引ける。
- 行動名がカード固有になっても、検索と採点は効果要素で共通化できる。
- UIの役割タグは、このメタデータから後で自動推定できる。

実装データでは、カード側は前衛/中衛/後衛の行動IDだけを持つ。効果要素と対象パターンは `ACTION_METADATA` 側に置く。

```js
frontAction: "jawBreak",
middleAction: "bloodScent",
rearAction: "deepCruise",
```

検索や採点では、カードの行動IDを展開して下記の検索レコードを作る。

```js
{
  cardId: "megalodon",
  slot: "middle",
  actionId: "bloodScent",
  componentIndex: 0,
  effectElements: ACTION_METADATA.bloodScent.components[0].effectElements,
  targetPattern: ACTION_METADATA.bloodScent.components[0].targetPattern,
}
```

`position` は `frontAction/middleAction/rearAction` のキーから分かるため、カード内では重複して持たなくてよい。設計シートでは確認のために効果要素と対象パターンを併記してよいが、実装上の正本は `ACTION_METADATA` とする。

複合行動は `components` の数だけ検索レコードを作る。これにより、「回復+攻撃」の行動を回復検索にも攻撃検索にも自然に出せる。

### 地形

現状の `terrainTypes` が該当する。

中央定義に含めるべき項目:

| 項目 | 用途 |
|---|---|
| 表示名 | UI |
| コスト | デッキ構築 |
| 説明 | ツールチップ/一覧 |
| 効果処理 | 戦闘処理 |
| 採点タグ | コスト評価 |
| 得意な分類/特性 | 図鑑/フィルタ |

採用理由:

- 地形はカード、特性、α特性、コストに強く絡む。
- `水棲` のような特性が増えると、地形との整合性が重要になる。

### 行動

現状の `actions` が該当する。

中央定義に含めるべき項目:

| 項目 | 用途 |
|---|---|
| 表示名 | UI |
| 短い説明 | カード詳細 |
| 効果処理 | 戦闘 |
| 対象パターン | UI図示/採点 |
| 効果要素 | 採点 |
| ログ名 | 戦闘ログ |

採用理由:

- 前衛/中衛/後衛で再利用される。
- 行動名、説明、処理、採点がズレると危険。

ただし、本番ではカード固有技が多くなる想定なので、行動名テンプレートを増やしすぎるより、効果要素と対象パターンを中央定義する方が重要。

### 必殺技

必殺技はカード固有だが、構造は中央定義する。

```js
const ULTIMATE_RULES = {
  chargeUnit: "turn",
  defaultTiming: "action",
  replacesNormalAction: true,
  resetAfterUse: true,
};
```

カード側:

```js
ultimate: {
  name: "深海捕食",
  turns: 5,
  components: [
    {
      effectElements: ["singleAttack", "executeBonus"],
      targetPattern: "lowestHpEnemy",
    },
  ],
}
```

採用理由:

- 必殺技短縮/遅延デッキが成立する。
- 膠着を崩す設計の核になる。
- 必要ターン、短縮、再発動、AG順などのルールがズレるとゲームが壊れやすい。

### 状態異常/状態効果

毒、麻痺、回復封じ、バリア、ダメージカットなど。

```js
const STATUS_EFFECTS = {
  poison: {
    name: "毒",
    type: "debuff",
    timing: "turnStart",
    description: "ターン開始時にダメージを受ける。",
  },
  healBlock: {
    name: "回復封じ",
    type: "debuff",
    timing: "heal",
    description: "回復を受けられない。",
  },
  barrier: {
    name: "バリア",
    type: "buff",
    timing: "incomingDamage",
    description: "一定量のダメージを防ぐ。",
  },
};
```

採用理由:

- 対策関係が重要。
- `回復-回復封じ`、`バリア-バリア貫通` のような軸を明確にできる。
- UI説明と戦闘処理がズレやすい。

### 効果要素

採点自動化の中心。

例:

```js
const EFFECT_ELEMENTS = {
  singleAttack: { baseScore: 5 },
  areaAttack: { baseScore: 12, riskFlags: ["aoeOverkill"] },
  searchAttack: { baseScore: 14, riskFlags: ["searchSnowball"] },
  executeBonus: { baseScore: 8 },
  heal: { baseScore: 4 },
  armor: { baseScore: 5 },
  barrier: { baseScore: 8 },
  damageCut: { baseScore: 7 },
  atBuff: { baseScore: 6 },
  agBuff: { baseScore: 10 },
  ultimateCharge: { baseScore: 12 },
  atDebuff: { baseScore: 6 },
  agDebuff: { baseScore: 9 },
  defenseDown: { baseScore: 7 },
  healBlock: { baseScore: 10 },
  barrierPierce: { baseScore: 12 },
  terrainBypass: { baseScore: 10 },
  terrainDependency: { baseScore: -8 },
};
```

採用理由:

- 行動名ではなく効果要素で採点する方針と一致する。
- 新カード作成時の初期コスト算出に使える。
- AGアップ、範囲攻撃、サーチ攻撃などの重みを管理できる。

### 対象指定パターン

例:

```js
const TARGET_PATTERNS = {
  frontEnemy: {
    name: "最前の敵",
    targetSide: "enemy",
    selector: "front",
    scoringTags: ["baseline"],
  },
  rearEnemyPriority: {
    name: "敵後衛優先",
    targetSide: "enemy",
    selector: "rearPriority",
    scoringTags: ["backlineAccess"],
  },
  lowestHpEnemy: {
    name: "低HPの敵",
    targetSide: "enemy",
    selector: "lowestHp",
    scoringTags: ["searchAttack", "execute"],
  },
  randomFrontEnemy: {
    name: "敵前衛からランダム",
    targetSide: "enemy",
    selector: "randomInFrontRank",
    scoringTags: ["randomRisk", "highDamageAllowed"],
  },
};
```

採用理由:

- サーチ攻撃、後衛到達、ランダム対象は強さに直結する。
- UIの対象範囲図示に使える。
- 採点と戦闘処理を揃えられる。

## 推奨で中央定義する項目

### レアリティ

```js
const RARITIES = {
  common: {
    name: "C",
    displayName: "コモン",
    maxCopies: 3,
    scoreBand: [0, 100],
  },
  rare: {
    name: "R",
    displayName: "レア",
    maxCopies: 2,
    scoreBand: [90, 130],
  },
  legendary: {
    name: "L",
    displayName: "レジェンド",
    maxCopies: 1,
    scoreBand: [120, 170],
  },
};
```

採用理由:

- レアリティと枚数制限をつなげるなら必要。
- 同コスト内の強弱や複雑さの納得感に使える。

現時点判断:

- カードプールを作る段階で採用。
- まだプロトタイプ対戦だけなら後回しでもよい。

### タイミング/フェーズ

例:

```js
const TIMINGS = {
  battleStart: "開戦時",
  turnStart: "ターン開始時",
  action: "行動時",
  beforeDamage: "被ダメージ前",
  afterKo: "戦闘不能時",
  ultimateReady: "必殺技準備完了時",
};
```

採用理由:

- α特性、特性、状態異常、必殺技が増えると必須になる。
- 処理順を明確にできる。

現時点判断:

- 必殺技や状態異常を実装する前に中央化する。

### 条件式

例:

```js
const CONDITIONS = {
  onSea: { name: "海にいる", description: "配置地形が海。" },
  alphaExposed: { name: "α露出", description: "αの前方に味方がいない。" },
  targetDamaged: { name: "負傷対象", description: "対象のHPが最大HP未満。" },
};
```

採用理由:

- 同じ条件を複数カードが使うようになる。
- 採点で条件減点を付けやすい。

現時点判断:

- すぐ必須ではないが、カード数が20〜30枚を超えたら採用。

### 効果量式

例:

```js
const FORMULAS = {
  atMinus6Min5: {
    text: "max(5, AT-6)",
    evaluate: ({ at }) => Math.max(5, at - 6),
    scoringKind: "damage",
  },
};
```

採用理由:

- 説明文、戦闘処理、採点がズレるのを防げる。

現時点判断:

- 本格的な採点自動化時に採用。
- 今すぐ全行動を式ID化すると重い。

### α特性テンプレート

α特性はカード固有性が高いが、効果要素やタイミングは共通化できる。

採用判断:

- α特性そのものを全部テンプレート化する必要はない。
- `timing`、`effects`、`conditions` は中央定義IDを参照する形がよい。

## 条件付きで中央定義する項目

### ログ文テンプレート

採用する条件:

- ログの可読性を本格的に上げる時。
- 多言語化する時。
- リプレイ演出や実況風ログを作る時。

現時点判断:

- まだ後回しでよい。
- ただし `uiText()` のような用語変換出口は維持する。

### UIアイコン/色

採用する条件:

- 分類/特性/役割/地形をアイコン表示する時。

中央定義例:

```js
const UI_BADGES = {
  aquatic: { icon: "waves", color: "blue" },
  flying: { icon: "feather", color: "sky" },
  attack: { icon: "swords", color: "red" },
};
```

現時点判断:

- UIを作り込む段階で採用。
- 今は名前と説明を先に固める。

### 役割タグ

UI表示する場合は5種に絞る。

```js
const ROLES = {
  attack: { name: "攻撃", description: "ダメージ行動を主に持つ。" },
  defense: { name: "防御", description: "ダメージカット、バリア、被ダメージ軽減を持つ。" },
  heal: { name: "回復", description: "HP回復を主に持つ。" },
  support: { name: "支援", description: "AT/AG強化、地形補助、コスト補助を持つ。" },
  disrupt: { name: "妨害", description: "弱体、行動阻害、対象逸らし、回復封じなどを持つ。" },
};
```

現時点判断:

- 役割タグはユーザー向けの参考情報であり、最優先ではない。
- デッキ構築検索は `行動位置 × 効果要素 × 対象パターン` を主軸にする。
- 役割タグは、カードごとに手入力せず、行動検索メタデータや特性から自動推定してもよい。
- UIで表示する場合も、勝ち筋を説明しすぎない粗い粒度に留める。

### フィルタ/検索項目

採用する条件:

- デッキ編集画面で分類、特性、役割、コスト、地形適性フィルタを入れる時。

現時点判断:

- 分類/特性/役割の中央定義があれば自然に作れる。
- 独立した中央定義は後でよい。

### カードセット/パック

採用する条件:

- 収録パック、入手方法、シーズン、カードプール制限を扱う時。

現時点判断:

- 初期カード設計中は不要。
- カードが増えてリリース単位を管理する時に採用。

### フォーマット/レギュレーション

採用する条件:

- レアリティ枚数制限、禁止/制限カード、期間限定ルールを扱う時。

現時点判断:

- 対戦環境を作る段階で採用。
- まずはレアリティ定義までで十分。

### 図鑑カテゴリ

採用する条件:

- 図鑑が単なるカード一覧ではなく、分類、特性、生息地、時代、観測記録で閲覧できるようになった時。

現時点判断:

- 世界観訴求を強める段階で採用。
- 初期は分類/特性/地形から自動生成で足りる。

## 後回し/非推奨の項目

### デッキアーキタイプ

例:

- 水棲海デッキ
- 必殺技短縮デッキ
- 竜類αデッキ
- 回復耐久

判断:

- 内部設計メモとしては有用。
- UIに中央定義として出すのは後回し。
- プレイヤーに発見してもらう快感を残す。

### カードコンセプト

判断:

- カードごとの内部メモに置く。
- 中央定義にすると、カード設計が硬くなりすぎる。

### 想定シナジー/想定対策

判断:

- カードごとの内部メモに置く。
- 検索や自動テストが必要になったら、後で構造化する。

### フレーバー文

判断:

- 中央定義しない。
- 固有の表現が必要なので、カードデータに持たせる。
- ただし文体ガイドは文書化する。

### カード名

判断:

- 中央定義しない。
- カード固有データに置く。
- 命名規則だけ共通文書で管理する。

## 現状システムに照らした優先順位

### 今すぐ整える

1. `CLASSIFICATIONS`
2. `TRAITS`
3. `EFFECT_ELEMENTS`
4. `TARGET_PATTERNS`
5. `ACTION_METADATA`
6. `STATUS_EFFECTS`
7. `ULTIMATE_RULES`
8. `RARITIES`

理由:

- これからカード設計に入るため、カードデータの形に直結する。
- UI表示、クリック説明、採点、自動テストで参照する。
- 後から直すとカード全体の移行が重くなる。

### 既存を拡張する

1. `TERMS`
2. `terrainTypes`
3. `actions`

理由:

- すでに中央定義に近い。
- 分類/特性/必殺技の導入に合わせて、項目を増やせばよい。

### 後でよい

1. `CARD_SETS`
2. `FORMATS`
3. `UI_BADGES`
4. `LOG_TEMPLATES`
5. `CODEX_CATEGORIES`

理由:

- カードプールやUIが増えてからでも移行可能。
- 今やると設計が過剰になる。

## 推奨するカードデータ形

カード側は、表示名や説明をできるだけ持たず、IDを参照する。

```js
const card = {
  id: "megalodon",
  name: "メガロドン",
  rarity: "rare",
  classification: "fish",
  traits: ["aquatic", "predation"],
  roles: ["attack"], // 任意。検索/採点の主軸にはしない。
  hp: 140,
  at: 42,
  ag: 24,
  cost: 6,
  alphaCost: 8,
  preferredTerrain: ["sea"],
  frontAction: "bite",
  middleAction: "predatoryCharge",
  rearAction: "scentBlood",
  ultimate: "deepHunt",
  alphaTrait: "apexPredator",
  codexText: "外洋域で観測される大型捕食種。",
};
```

カード固有技でも、行動IDを作って `ACTION_METADATA` に登録する。カード本体へ効果要素や対象パターンを重複して持たせるのは、設計途中のメモや一時的な検証に留める。

中央定義側:

```js
CLASSIFICATIONS.fish.name; // 魚類
TRAITS.aquatic.rulesText; // 海以外ではHP/AT/AGが0.8倍
RARITIES.rare.maxCopies; // 2
EFFECT_ELEMENTS.searchAttack.baseScore; // サーチ攻撃の評価点
TARGET_PATTERNS.lowestHpEnemy.name; // 低HPの敵
```

この形なら、UI表示、フィルタ、戦闘処理、採点の全てが同じIDを参照できる。

## 採用しすぎを避ける基準

中央定義にすべきか迷ったら、以下で判断する。

| 質問 | Yesなら |
|---|---|
| 3枚以上のカードで使うか | 中央定義候補 |
| UIと戦闘処理の両方で使うか | 中央定義候補 |
| 採点で使うか | 中央定義候補 |
| 後から名称や説明が変わりそうか | 中央定義候補 |
| カード固有の世界観文か | カード側に置く |
| プレイヤーに発見させたい攻略意図か | 内部メモに置く |
