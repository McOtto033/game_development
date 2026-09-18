(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioTargeting=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const stats=[['hp','残HP'],['hpPercent','HP割合（%）'],['maxHP','最大HP'],['AT','AT'],['AG','AG'],['armor','装甲'],['cost','コスト'],['alphaCost','αコスト'],['custom','その他']];
  const comparisons=[['gte','以上'],['lte','以下'],['gt','より大きい'],['lt','より小さい'],['eq','と等しい'],['ne','と異なる'],['max','最高'],['min','最低']];
  const kinds=[['stat','ステータス'],['attribute','状態・特性・地形・分類'],['order','行動順'],['custom','自然言語の条件']];
  const attributes=[['status','状態'],['trait','特性'],['terrain','現在の地形'],['preferredTerrain','得意地形'],['class','分類']];
  const sides=[['both','敵味方'],['ally','味方'],['enemy','敵']];
  const timings=[['once','効果開始時に1回（対象を固定）'],['each','各回の実行直前（毎回選び直す）'],['event','指定イベントが起きるたび']];
  function mode(t){
    const q=t.query;
    if(!q)return t.selection==='all'?'area':'search';
    if(t.mode)return t.mode;
    const sideFits=q.side==='both'||((!t.source||t.source==='grid')&&((q.side==='ally'&&!t.enemy.length)||(q.side==='enemy'&&!t.ally.length)));
    return q.pick.mode==='all'&&!q.conditions.items.length&&q.self==='include'&&q.life==='alive'&&q.absence.mode==='skip'&&sideFits?'area':'search';
  }
  function effective(t){
    const q=t.query||fromLegacy(t);
    if(mode(t)==='search')return q;
    const direct=create();direct.pick.mode='all';direct.timing={...q.timing};return direct;
  }
  const label=(pairs,key)=>pairs.find(x=>x[0]===key)?.[1]||key;
  const statName=r=>r.stat==='custom'?(r.customStat||'能力名未入力'):label(stats,r.stat);
  const group=()=>({kind:'group',op:'all',items:[]});
  function condition(kind='stat') {
    if(kind==='group')return group();
    if(kind==='attribute')return {kind,key:'status',value:'毒',customValue:'',operator:'is'};
    if(kind==='order')return {kind,direction:'previous',scope:'global',offset:1};
    if(kind==='custom')return {kind,text:''};
    return {kind:'stat',stat:'hp',customStat:'',operator:'lte',value:20};
  }
  function create(){return {version:1,side:'both',self:'include',life:'alive',conditions:group(),pick:{mode:'rank',stat:'hp',customStat:'',direction:'asc',count:1,text:'',ties:'position',tieText:''},timing:{mode:'once',event:'attackReceived',text:''},absence:{mode:'skip',text:''}};}
  function fromLegacy(t) {
    const q=create();
    if(t.selection==='all'||(t.source&&t.source!=='grid'))q.pick.mode='all';
    else {q.pick.count=t.count;if(t.rule!=='残HPが最も低い対象'){q.pick.mode='custom';q.pick.text=t.rule+' / '+t.count+'体';}}
    if(t.tie){q.pick.ties='custom';q.pick.tieText=t.tie;}
    if(t.fallback){q.absence.mode='custom';q.absence.text=t.fallback;}
    return q;
  }
  const events=[['attackReceived','自身が攻撃を受ける'],['attackDealt','自身が攻撃する'],['damage','ダメージが発生する'],['heal','回復が発生する'],['status','状態付与が発生する'],['action','カードが行動する'],['custom','その他']];
  function conditionText(c){
    if(c.kind==='group'){
      if(!c.items.length)return '条件なし';
      const text=c.items.map(conditionText).join(c.op==='any'?' OR ':' AND ');
      return c.op==='none'?'NOT（'+c.items.map(conditionText).join(' OR ')+'）':'（'+text+'）';
    }
    if(c.kind==='stat')return statName(c)+(['min','max'].includes(c.operator)?'が'+label(comparisons,c.operator)+'（条件で絞る前の候補内・同率を含む）':'が'+c.value+label(comparisons,c.operator));
    if(c.kind==='attribute')return label(attributes,c.key)+'：'+(c.value==='custom'?(c.customValue||'名称未入力'):c.value)+(c.operator==='isNot'?'を持たない／該当しない':'を持つ／該当する');
    if(c.kind==='order')return (c.scope==='global'?'全体の行動順':c.scope==='ally'?'味方内の行動順':'敵内の行動順')+'で'+(c.direction==='previous'?'直前から':'直後から')+c.offset+'番目（自身の今回の行動基準）';
    return c.text||'自然言語の条件を記入';
  }
  function summary(q){
    const p=q.pick,scope=label(sides,q.side)+(q.self==='exclude'?'・自身を除く':q.self==='only'?'・自身のみ':'')+' / '+label([['alive','生存中'],['fallen','戦闘不能'],['any','生存状態を問わない']],q.life);
    const pick=p.mode==='all'?'条件に合う全員':p.mode==='rank'?statName(p)+'が'+(p.direction==='asc'?'低い':'高い')+'順に'+p.count+'体':(p.text||'対象数を含めて選び方を記入');
    const out=['候補：'+scope,'条件：'+conditionText(q.conditions),'選択：'+pick,'再判定：'+label(timings,q.timing.mode)+(q.timing.mode==='event'?' / '+(q.timing.event==='custom'?q.timing.text:label(events,q.timing.event)):'')];
    if(p.mode!=='all')out.push('同値：'+(p.ties==='include'?'境界の同値を全員含む（X体を超える場合あり）':p.ties==='custom'?(p.tieText||'優先順を記入'):'前衛→中衛→後衛、同じ衛では左→中央→右。両陣営同位置は味方→敵'));
    out.push('対象なし／無効：'+(q.absence.mode==='skip'?'その回は不発・別対象で補充しない':q.absence.mode==='stop'?'この効果の残り回数を打ち切る':q.absence.text||'扱いを記入'));
    return out;
  }
  function validate(q){
    const fail=(ok,message)=>{if(!ok)throw Error('対象指定：'+message);};
    const obj=v=>v&&typeof v==='object'&&!Array.isArray(v),str=v=>typeof v==='string';
    const member=(values,v)=>values.some(x=>(Array.isArray(x)?x[0]:x)===v);
    const positive=v=>Number.isSafeInteger(v)&&v>0;
    fail(obj(q)&&q.version===1,'形式の版が不正です。');
    fail(member(sides,q.side)&&member(['include','exclude','only'],q.self)&&member(['alive','fallen','any'],q.life),'陣営・自身・生存状態を確認してください。');
    let size=0;
    function visit(c,depth){
      fail(++size<=40&&depth<=5,'条件は合計40項目・入れ子5段までです。');
      fail(obj(c),'条件の形式が不正です。');
      if(c.kind==='group'){fail(member(['all','any','none'],c.op)&&Array.isArray(c.items),'条件グループが不正です。');c.items.forEach(x=>visit(x,depth+1));return;}
      if(c.kind==='stat'){fail(member(stats,c.stat)&&str(c.customStat)&&member(comparisons,c.operator)&&Number.isFinite(c.value),'ステータス条件が不正です。');return;}
      if(c.kind==='attribute'){fail(member(attributes,c.key)&&str(c.value)&&str(c.customValue)&&member(['is','isNot'],c.operator),'属性条件が不正です。');return;}
      if(c.kind==='order'){fail(member(['previous','next'],c.direction)&&member(['global','ally','enemy'],c.scope)&&positive(c.offset),'行動順条件が不正です。');return;}
      fail(c.kind==='custom'&&str(c.text),'未対応の条件形式です。');
    }
    fail(obj(q.conditions)&&q.conditions.kind==='group','条件のルートはグループにしてください。');visit(q.conditions,0);
    const p=q.pick,t=q.timing,a=q.absence;
    fail(obj(p)&&member(['all','rank','custom'],p.mode)&&member(stats,p.stat)&&str(p.customStat)&&member(['asc','desc'],p.direction)&&positive(p.count)&&str(p.text)&&member(['position','include','custom'],p.ties)&&str(p.tieText),'選び方・対象数・同値規則を確認してください。');
    fail(obj(t)&&member(timings,t.mode)&&member(events,t.event)&&str(t.text),'再判定の指定が不正です。');
    fail(obj(a)&&member(['skip','stop','custom'],a.mode)&&str(a.text),'対象不在時の指定が不正です。');return q;
  }
  function warnings(q){
    const out=[];
    function visit(c){
      if(c.kind==='group'){if(c!==q.conditions&&!c.items.length)out.push('空の条件グループを記入・削除する');c.items.forEach(visit);}
      else if(c.kind==='stat'&&c.stat==='custom'&&!c.customStat.trim())out.push('条件の能力名を記入する');
      else if(c.kind==='attribute'&&!(c.value==='custom'?c.customValue:c.value).trim())out.push('条件の状態・特性等を指定する');
      else if(c.kind==='custom'&&!c.text.trim())out.push('自然言語の条件を記入する');
    }visit(q.conditions);
    if(q.pick.mode==='rank'&&q.pick.stat==='custom'&&!q.pick.customStat.trim())out.push('並べ替えに使う能力名を記入する');
    if(q.pick.mode==='custom'&&!q.pick.text.trim())out.push('対象の選び方を記入する');
    if(q.pick.mode!=='all'&&q.pick.ties==='custom'&&!q.pick.tieText.trim())out.push('同値時の優先順を記入する');
    if(q.timing.mode==='event'&&q.timing.event==='custom'&&!q.timing.text.trim())out.push('再判定するイベントを記入する');
    if(q.absence.mode==='custom'&&!q.absence.text.trim())out.push('対象なし／無効時の扱いを記入する');
    if(q.side==='enemy'&&q.self==='only')out.push('敵のみと自身のみの矛盾を解消する');
    return out;
  }
  return {stats,comparisons,kinds,attributes,sides,timings,events,label,group,condition,create,fromLegacy,conditionText,summary,validate,warnings,mode,effective};
});
