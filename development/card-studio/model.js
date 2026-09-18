(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudioModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const slots = [['front','前衛'],['middle','中衛'],['rear','後衛'],['ultimate','必殺技'],['alpha','αスキル']];
  const classes = ['鳥類','魚類','爬虫類','甲殻類','菌類','昆虫類','哺乳類','竜類','植物','両生類','無機生命','幻獣','軟体類'];
  const classIcons = Object.fromEntries(classes.map((name,i)=>[name,['🐦','🐟','🦎','🦀','🍄','🐞','🐾','🐉','🌿','🐸','💎','🦄','🐚'][i]]));
  const terrains = [['平地','▱'],['森','♧'],['海','≈'],['高地','△'],['活性巣','✧'],['殻壁','▥']];
  const builtins = [
    ['attack','攻撃','⚔','対象にダメージを与える。'],['heal','回復','✚','対象のHPを回復する。'],
    ['buff','強化','↑','対象の能力や有利な効果を付与・強化する。'],['debuff','弱体','↓','対象の能力を下げる。'],
    ['status','状態付与','✦','指定した状態を付与する。'],['remove','解除','◇','指定した状態・効果を取り除く。'],
    ['move','移動','↔','対象の位置を変更する。'],['special','特殊','◎','個別に定義した効果。']
  ].map(([id,name,icon,description])=>({id,name,icon,description,parameters:[]}));
  const conceptFields = [['intent','設計の意図','なぜこのカードを作るか'],['strength','尖った強み','このカードを選ぶ理由'],['usage','想定される使われ方','通常採用・α指定、前／中／後衛、得意地形'],['winPlan','勝ち筋・エンジン','何を蓄積し、どう勝利につなげるか'],['synergy','相性のよい組み合わせ','特性・行動・配置・既存カード'],['counter','対策・弱点','何に弱く、どう止められるか'],['references','参考にした設計','設計ID・既存カード・見送った案と比較']];
  const evaluationFields = [['scoring','採点とコスト・レアリティの根拠','採点規則の版、内訳、総合評価'],['risks','懸念・未確定事項','過剰な相乗効果、曖昧なルールなど'],['testPlan','検証計画・条件','相手、配置、版、比較条件、採否の基準'],['results','検証結果・実際の使われ方','想定と違った使われ方も残す'],['learning','学び・次の調整','新しいカード設計に再利用できる知見']];
  const clone = x => JSON.parse(JSON.stringify(x));
  const id = prefix => prefix + '-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  const definitions = library => [...builtins,...library.definitions];
  function effect(typeId='attack') {
    return {id:id('fx'),typeId,target:{basis:'absolute',ally:[],enemy:[0,1,2,3,4,5,6,7,8],selection:'search',count:1,rule:'残HPが最も低い対象',tie:'前衛→中衛→後衛、同じ衛では左→中央→右',fallback:''},amount:{mode:'multiplier',reference:'AT',value:1,expression:''},duration:{mode:'instant',turns:2},condition:'',alternate:{condition:'',amount:''},details:'',params:{}};
  }
  function blank() {
    const now=new Date().toISOString();
    return {id:id('design'),gameCardId:'',artCredit:'',status:'draft',tags:[],createdAt:now,updatedAt:now,card:{name:'新しいカード',artwork:'',cost:3,alphaCost:3,rarity:'C',classification:'哺乳類',terrains:[],traits:[],hp:100,at:30,ag:20,skills:Object.fromEntries(slots.map(([key])=>[key,{enabled:false,name:'',trigger:'',condition:'',turns:5,effects:[]}]))},notes:Object.fromEntries([...conceptFields,...evaluationFields].map(([key])=>[key,''])),history:[]};
  }
  function template(kind='blank') {
    const d=blank();
    if(kind==='attack') {
      d.card.name='攻撃型・新規設計';
      d.card.skills.front={enabled:true,name:'一閃',trigger:'',condition:'',turns:5,effects:[effect()]};
      d.tags=['攻撃型'];
    } else if(kind==='support') {
      d.card.name='支援型・新規設計'; d.card.classification='植物';
      const heal=effect('heal');heal.target={...heal.target,ally:[0,3,6],enemy:[],selection:'all',rule:''};heal.amount.value=.5;
      d.card.skills.rear={enabled:true,name:'芽吹きの息吹',trigger:'',condition:'',turns:5,effects:[heal]};
      d.tags=['支援型'];
    }
    return d;
  }
  function duplicate(d) { const copy=clone(d);copy.id=id('design');copy.gameCardId='';copy.status='draft';copy.card.name+='（複製）';copy.createdAt=copy.updatedAt=new Date().toISOString();copy.history=[];copy.notes.references=[copy.notes.references,`複製元: ${d.id} / ${d.card.name}`].filter(Boolean).join('\n');return copy; }
  function amountText(a) {
    if(a.mode==='none')return '';
    if(a.mode==='expression')return a.expression;
    if(a.mode==='fixed')return String(a.value);
    if(a.mode==='percent')return `${a.reference}×${a.value}%`;
    const n=Number(a.value);return `${a.reference}×${Number.isInteger(n)?n.toFixed(1):n}`;
  }
  function effectText(e,defs=builtins) {
    const def=defs.find(x=>x.id===e.typeId);const amount=amountText(e.amount);
    return `${def?.name||e.typeId}${amount?'：'+amount:''}${e.alternate.condition?'（'+e.alternate.condition+'：'+e.alternate.amount+'）':''}${e.duration.mode==='always'?' / 常時':e.duration.mode==='turns'?' / '+e.duration.turns+'T':''}`;
  }
  function noUnsafeKeys(value,depth=0) {
    if(depth>40)throw Error('JSONの入れ子が深すぎます。');
    if(value && typeof value==='object') for(const key of Object.keys(value)) {
      if(['__proto__','prototype','constructor'].includes(key))throw Error('使用できないキーが含まれています。');
      noUnsafeKeys(value[key],depth+1);
    }
  }
  function validateLibrary(lib) {
    noUnsafeKeys(lib);
    const check=(ok,message)=>{if(!ok)throw Error(message);};
    const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
    const str=v=>typeof v==='string';
    const num=v=>Number.isFinite(v)&&v>=0;
    const integer=v=>num(v)&&Number.isInteger(v);
    const unique=(list)=>new Set(list).size===list.length;
    check(object(lib)&&lib.schemaVersion===1&&integer(lib.revision),'Card Studio v1のライブラリJSONを指定してください。');
    check(Array.isArray(lib.cards)&&lib.cards.length<=1000&&Array.isArray(lib.definitions)&&lib.definitions.length<=1000,'カード・効果定義は各1000件までです。');
    check(unique(lib.cards.map(x=>x?.id))&&unique([...builtins,...lib.definitions].map(x=>x?.id)),'カードIDまたは効果定義IDが重複しています。');
    for(const def of lib.definitions) {
      check(object(def)&&/^[a-z][a-z0-9_-]{0,63}$/.test(def.id)&&str(def.name)&&def.name.trim()&&str(def.icon)&&str(def.description),'効果定義のID・名前・アイコン・説明を確認してください。');
      check(Array.isArray(def.parameters)&&def.parameters.length<=20&&unique(def.parameters.map(p=>p?.key)),'追加パラメーターは重複なし・20項目までです。');
      for(const p of def.parameters)check(object(p)&&/^[a-z][a-zA-Z0-9_]{0,39}$/.test(p.key)&&str(p.label)&&p.label.trim()&&['text','number'].includes(p.type),'追加パラメーターのキー・名前・型を確認してください。');
    }
    const defs=definitions(lib);
    for(const d of lib.cards) {
      check(object(d)&&str(d.id)&&d.id.length>0&&str(d.gameCardId)&&['draft','testing','adopted','held','archived'].includes(d.status)&&Array.isArray(d.tags)&&d.tags.every(str)&&str(d.createdAt)&&str(d.updatedAt),'設計ID・状態などの管理情報が不正です。');
      const c=d.card;check(object(c)&&['name','artwork','classification'].every(k=>str(c[k]))&&['C','R','SR','UR'].includes(c.rarity),'カード名・分類・レアリティなどの基本情報が不正です。');
      check(!c.artwork||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(c.artwork),'イラストはPNG/JPEG/WebPの埋め込み画像を指定してください。');
      check(['cost','alphaCost','hp','at','ag'].every(k=>integer(c[k])),'コスト・HP・AT・AGは0以上の整数で入力してください。');
      check(Array.isArray(c.terrains)&&c.terrains.every(str)&&Array.isArray(c.traits),'得意地形・特性の形式が不正です。');
      for(const t of c.traits)check(object(t)&&str(t.name)&&str(t.value)&&str(t.description),'特性は名前・数値・説明を持つ形式にしてください。');
      check(object(c.skills),'行動枠がありません。');
      for(const [key,label] of slots) {
        const s=c.skills[key];check(object(s)&&typeof s.enabled==='boolean'&&['name','trigger','condition'].every(k=>str(s[k]))&&integer(s.turns)&&s.turns>0&&Array.isArray(s.effects)&&s.effects.length<=2,`${label}は最大2効果の規定形式にしてください。`);
        for(const e of s.effects) {
          check(object(e)&&str(e.id)&&defs.some(x=>x.id===e.typeId)&&str(e.condition)&&str(e.details),`${label}に未登録の効果種類、または不正な効果があります。`);
          const t=e.target,a=e.amount,u=e.duration;
          check(object(t)&&['absolute','relative'].includes(t.basis)&&['all','search'].includes(t.selection)&&integer(t.count)&&t.count>0&&['rule','tie','fallback'].every(k=>str(t[k])),`${label}の対象条件を確認してください。`);
          for(const side of ['ally','enemy'])check(Array.isArray(t[side])&&t[side].every(v=>integer(v)&&v<9)&&unique(t[side]),'対象マスは0〜8の重複しない番号で指定してください。');
          check(object(a)&&['none','fixed','multiplier','percent','expression'].includes(a.mode)&&num(a.value)&&str(a.reference)&&str(a.expression),'効果量の形式が不正です。');
          check(object(u)&&['instant','turns','always'].includes(u.mode)&&integer(u.turns)&&u.turns>0,'持続期間の形式が不正です。');
          check(object(e.alternate)&&str(e.alternate.condition)&&str(e.alternate.amount)&&object(e.params),'条件別の効果量・追加パラメーターの形式が不正です。');
          for(const p of defs.find(x=>x.id===e.typeId).parameters)if(e.params[p.key]!==undefined)check(p.type==='number'?Number.isFinite(e.params[p.key]):str(e.params[p.key]),`追加パラメーター「${p.label}」の型が不正です。`);
        }
      }
      check(object(d.notes)&&[...conceptFields,...evaluationFields].every(([k])=>str(d.notes[k]))&&Array.isArray(d.history),'設計メモ・調整履歴の形式が不正です。');
      for(const h of d.history)check(object(h)&&str(h.id)&&str(h.at)&&str(h.reason)&&str(h.result)&&str(h.decision)&&Array.isArray(h.changes)&&h.changes.every(x=>object(x)&&str(x.path)),'調整履歴の形式が不正です。');
    }
    return lib;
  }
  function warnings(d) {
    const out=[];const c=d.card;
    if(!c.name.trim()||c.name==='新しいカード')out.push('カード名を決める');
    if(!c.artwork)out.push('イラストを登録する');
    if(!c.classification.trim())out.push('分類を指定する');
    if(!d.notes.intent.trim())out.push('設計の意図を記録する');
    for(const t of c.traits)if(!t.name.trim()||!t.description.trim())out.push('特性名とタップ時の説明を記入する');
    for(const [key,label] of slots) {
      const s=c.skills[key];if(!s.enabled)continue;
      if(!s.name.trim())out.push(`${label}の固有名を記入する`);
      if(!s.effects.length)out.push(`${label}の効果を追加する`);
      for(const e of s.effects) {
        if(!e.target.ally.length&&!e.target.enemy.length)out.push(`${label}の対象マスを選ぶ`);
        if(e.target.selection==='search'&&!e.target.rule.trim())out.push(`${label}のサーチ条件を記入する`);
        if(e.alternate.condition&&!e.alternate.amount)out.push(`${label}の条件成立時の効果量を記入する`);
        if(e.amount.mode==='expression'&&!e.amount.expression)out.push(`${label}の効果量を記入する`);
      }
    }
    return [...new Set(out)];
  }
  function diff(before,after,path='') {
    if(JSON.stringify(before)===JSON.stringify(after))return [];
    if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after))return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(k=>diff(before[k],after[k],path?path+'.'+k:k));
    const val=v=> typeof v==='string'&&v.startsWith('data:image/')?`画像データ（${v.length}文字。実画像は保存時バックアップ参照）`:v??null;
    return [{path,before:val(before),after:val(after)}];
  }
  function designBody(d) {const {history,createdAt,updatedAt,...body}=d;return body;}
  function prepareSave(lib,baseline,log={}) {
    validateLibrary(lib);const next=clone(lib);const now=new Date().toISOString();
    next.cards.forEach(d=>{
      const old=baseline.cards.find(x=>x.id===d.id);
      const changes=old?diff(designBody(old),designBody(d)):[{path:'作成',before:null,after:d.card.name}];
      const note=log[d.id]||{};
      if(changes.length||note.reason||note.result) {
        d.updatedAt=now;d.history.push({id:id('rev'),at:now,reason:note.reason||(old?'設計内容を更新':'新規作成'),result:note.result||'',decision:note.decision||d.status,changes});
      }
    });return next;
  }
  function mergeLibraries(current,incoming) {
    validateLibrary(incoming);const merged=clone(current);let copied=0;let added=0;
    for(const def of incoming.definitions) {
      const prior=definitions(merged).find(x=>x.id===def.id);
      if(prior&&JSON.stringify(prior)!==JSON.stringify(def))throw Error(`効果ID「${def.id}」の定義が異なります。取込元のIDを変更してください。`);
      if(!prior)merged.definitions.push(clone(def));
    }
    for(const d of incoming.cards) {
      const prior=merged.cards.find(x=>x.id===d.id);
      if(prior&&JSON.stringify(prior)===JSON.stringify(d))continue;
      const imported=clone(d);
      if(prior) {imported.id=id('design');imported.card.name+='（取込コピー）';imported.notes.references=[imported.notes.references,`取込元の設計ID: ${d.id}`].filter(Boolean).join('\n');}
      merged.cards.push(imported);prior?copied++:added++;
    }
    validateLibrary(merged);return {library:merged,added,copied};
  }
  function exportCard(d) {return {schemaVersion:1,format:'card-design-spec',designId:d.id,gameCardId:d.gameCardId,card:clone(d.card)};}
  return {slots,classes,classIcons,terrains,builtins,conceptFields,evaluationFields,clone,id,definitions,effect,blank,template,duplicate,amountText,effectText,validateLibrary,warnings,diff,prepareSave,mergeLibraries,exportCard};
});
