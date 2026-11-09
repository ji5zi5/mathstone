import { CARDS, BY_ID, PRESETS } from './cards.js';
import {HEROES,COIN,heroOf} from './heroes.js';
import {gcd,divisorSum,evaluateFormula,differentiate,integrate,formulaValue,updateFormula,transformFormula,validFormula,composeFormula,formatFormula,addConstant} from './math.js';
import {riemannSum,walkAnt,voronoiCells,amplifyFrequency,hanoiMoves,nextHanoiMove} from './math-mechanics.js';
import {refreshRelations} from './relations.js';

export function random(s) { s.seed = (Math.imul(s.seed,1664525)+1013904223)>>>0; return s.seed/4294967296; }
function shuffle(s,a) { for(let i=a.length-1;i>0;i--) { const j=Math.floor(random(s)*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
export function deckFor(index) { return PRESETS[index].ids.flatMap(id=>[id,id]); }
export function validateDeck(ids,hero) {
  if(!Array.isArray(ids)||ids.length!==30||ids.some(id=>typeof id!=='string'||!Object.hasOwn(BY_ID,id))) return false;
  return ids.every(id=>ids.filter(x=>x===id).length<=(BY_ID[id].rarity==='legendary'?1:2)&&(!hero||!BY_ID[id].heroClass||BY_ID[id].heroClass===hero));
}
function card(s,id,cost=BY_ID[id].cost) { return {uid:++s.serial,id,cost}; }
export function createGame(deck=deckFor(0), seed=Date.now(), enemyDeck=deckFor(2), options={}) {
  if(!validateDeck(deck,HEROES[options.heroes?.[0]??0]?.id)||!validateDeck(enemyDeck,HEROES[options.heroes?.[1]??2]?.id)) throw new Error('덱은 30장, 같은 카드 최대 2장(전설 1장)이며 영웅에 맞는 카드여야 합니다.');
  const s={seed:seed>>>0,serial:0,current:0,turn:0,phase:'mulligan',winner:null,log:[],players:[deck,enemyDeck].map((ids,i)=>({hp:30,armor:0,mana:0,maxMana:0,temporaryMana:0,hand:[],board:[],deck:[...ids],grave:[],fatigue:0,weapon:null,heroAttacked:false,powerUsed:false,hero:HEROES[options.heroes?.[i]??(i?2:0)]?.id||HEROES[0].id,revealed:false}))};
  s.first=options.first??(random(s)<.5?0:1);
  if(![0,1].includes(s.first))throw new Error('잘못된 선공');
  s.current=s.first;
  s.events=[];s.id=`${seed}-${s.first}`;s.turnSeconds=options.turnSeconds||0;
  s.mode=['casual','ranked','arena','brawl','online'].includes(options.mode)?options.mode:'casual';
  s.players.forEach(pl=>{pl.secrets=[];pl.quest=null;});
  s.players.forEach((p,i)=>{shuffle(s,p.deck);for(let n=0;n<(i===s.first?3:4);n++)draw(s,i);});
  return s;
}
function log(s,text,kind='effect') {s.log.push({text,kind,turn:s.turn}); if(s.log.length>300)s.log.shift();}
function emit(s,event){(s.events??=[]).push(event);if(s.events.length>200)s.events.shift();}
export function capacity(s,p) {return Math.min(13,7+s.players[p].board.filter(m=>m.ability==='hotel'&&!m.silenced&&m.hp>0).length*3);}
const KEYWORD_KEYS=['taunt','shield','charge','rush','windfury','stealth','poisonous','lifesteal','reborn','spellDamage','uniqueAttack'];
function keywords(id) {return {taunt:['monster','turtle','tomb'].includes(id),shield:id==='snail',charge:id==='fly',...Object.fromEntries(KEYWORD_KEYS.filter(k=>BY_ID[id]?.[k]).map(k=>[k,BY_ID[id][k]]))};}
export function minions(s,p){return s.players[p].board.filter(m=>m.type!=='location');}
export function refreshAuras(s){
  for(let p=0;p<2;p++)for(const m of minions(s,p)){
    const amount=minions(s,p).filter(x=>x!==m&&x.hp>0&&!x.silenced&&x.ability==='choir').length;
    m.attack+=amount-(m.auraAttack||0);m.auraAttack=amount;
  }
  for(const change of refreshRelations(s))emit(s,{kind:'math',...change});
  for(const pl of s.players){
    const sites=pl.board.filter(m=>m.territorySite&&!m.silenced&&m.hp>0),cells=voronoiCells(sites.map(m=>m.attack));
    sites.forEach((m,i)=>m.territoryCells=cells[i]);
    for(const m of pl.board)if(m.ability==='amplifier'&&m.frequency==null){m.frequency=1;m.spellDamage=0;}
    if(pl.weapon?.id==='sword'){
      const f=pl.board.find(m=>m.formula&&!m.silenced&&m.hp>0),terms=f?.formula||[{n:4,d:1,p:0}],x=f?.functionX??1;
      pl.weapon.quadrature={...riemannSum(terms,x,2**Math.max(0,3-pl.weapon.durability)),terms:structuredClone(terms),x};
      pl.weapon.attack=pl.weapon.quadrature.attack;
    }
  }
}
export function summon(s,p,id,options={},position=s.players[p].board.length) {
  if(s.players[p].board.length>=capacity(s,p)) return null;
  const b=BY_ID[id] || {id,name:options.name||'수학적 존재',attack:options.attack||1,health:options.health||1,cost:0,art:0,text:'',school:'생성'};
  const m={uid:++s.serial,id:b.id,type:b.type==='location'?'location':'minion',name:b.name,cost:b.cost,art:b.art,school:b.school,text:b.text,attack:b.attack,hp:b.type==='location'?b.durability:b.health,maxHp:b.type==='location'?b.durability:b.health,readyTurn:0,ability:BY_ID[id]?id:null,silenced:false,...keywords(id),attacks:0,asleep:true,step:0,previous:0,next:1,...options};
  if(['golem','fixedpoint','primeguard'].includes(id))m.taunt=true;
  if(['golem','primeguard'].includes(id))m.shield=true;
  if(b.formula&&!Object.hasOwn(options,'formula')){m.formula=structuredClone(b.formula);m.functionX=1;m.functionValue=formulaValue(m.formula,1);m.attack=m.functionValue;}
  if(s.mode==='brawl'&&m.type!=='location'&&!m.silenced&&!m.formula&&!Object.hasOwn(options,'formula')){m.formula=[{n:1,d:1,p:2}];m.functionX=1;m.functionValue=1;m.attack=1;}
  m.baseAttack??=BY_ID[id]?.attack??m.attack;m.baseHealth??=BY_ID[id]?.health??m.maxHp;
  s.players[p].board.splice(position,0,m);refreshAuras(s);emit(s,{kind:'summon',key:m.uid,name:m.name});return m;
}
function token(s,p,name,attack,health,opts={},position) {return summon(s,p,'token',{name,attack,hp:health,maxHp:health,art:opts.art??0,...opts},position);}
export function findTarget(s,key) {
  if(key==='hero0'||key==='hero1')return {p:Number(key.at(-1)),hero:true,entity:s.players[Number(key.at(-1))]};
  for(let p=0;p<2;p++){const entity=s.players[p].board.find(m=>String(m.uid)===String(key));if(entity)return {p,hero:false,entity};}
  return null;
}
const targetKey=t=>t.hero?`hero${t.p}`:t.entity.uid;
function characters(s,p) {return [`hero${p}`,...minions(s,p).map(m=>m.uid)];}
function heal(s,key,amount) {const t=findTarget(s,key);if(t){const before=t.entity.hp;t.entity.hp=Math.min(t.hero?30:t.entity.maxHp,t.entity.hp+amount);if(t.entity.hp>before)emit(s,{kind:'heal',key,amount:t.entity.hp-before});}}
export function damage(s,key,amount,source=null) {
  const t=findTarget(s,key); if(!t||amount<=0)return;
  const e=t.entity;if(e.type==='location')return;
  const before=e.hp+(t.hero?e.armor:0);
  if(t.hero){const blocked=Math.min(e.armor,amount);e.armor-=blocked;e.hp-=amount-blocked;}
  else if(e.shield){e.shield=false;emit(s,{kind:'shield',key});return;}
  else {if(!e.silenced&&e.ability==='monster')amount=Math.min(1,amount);if(!e.silenced&&e.ability==='invariant')amount=Math.min(2,amount);if(!e.silenced&&e.ability==='turtle')amount=Math.ceil(amount/2);e.hp-=amount;}
  const dealt=before-e.hp-(t.hero?e.armor:0);emit(s,{kind:'damage',key,amount:dealt});
  log(s,`${t.hero?(t.p?'상대 영웅':'내 영웅'):e.name}: 피해 ${dealt}`,'damage');
  if(source?.poisonous&&!t.hero)e.hp=0;
  if(source?.lifesteal)heal(s,`hero${source.p}`,dealt);
}
function addHand(s,p,id,cost) {if(s.players[p].hand.length<10){const c=card(s,id,cost);s.players[p].hand.push(c);return c;} log(s,`${BY_ID[id].name}: 손패 초과로 소멸`);return null;}
export function draw(s,p,discount=0) {
  const pl=s.players[p]; if(!pl.deck.length){damage(s,`hero${p}`,++pl.fatigue);log(s,`${p?'상대':'나'}: 탈진 피해 ${pl.fatigue}`);return;}
  const id=pl.deck.shift();return addHand(s,p,id,Math.max(0,BY_ID[id].cost-discount));
}
export function settle(s) {
  // Remove each simultaneous death wave before resolving its deathrattles.
  for(let wave=0;wave<30;wave++){
    const dead=[];
    s.players.forEach((p,i)=>{const original=[...p.board];p.board=p.board.filter((m,j)=>{if(m.hp<=0){dead.push([i,m,original.slice(j+1).filter(x=>x.hp>0).map(x=>x.uid)]);if(m.type!=='location'&&BY_ID[m.id])p.grave.push(m.id);emit(s,{kind:'death',key:m.uid,name:m.name});return false;}return true;});});
    refreshAuras(s);
    if(!dead.length)break;
    for(const [p,m,right] of dead.sort((a,b)=>a[1].uid-b[1].uid)){
      if(m.silenced)continue;
      const at=()=>{const index=s.players[p].board.findIndex(x=>right.includes(x.uid));return index<0?s.players[p].board.length:index;};
      if(m.ability==='cat')addHand(s,p,'cat',Math.max(0,m.cost-1));
      if(m.ability==='ghost'&&m.constantStorage){
        const {targetUid,value}=m.constantStorage,target=findTarget(s,targetUid)?.entity;
        const terms=target?.formula&&addConstant(target.formula,value);
        if(terms){updateFormula(target,terms);emit(s,{kind:'math',key:target.uid,expression:`C = ${value} 귀환`});}
      }
      if(m.ability==='fly')draw(s,p);
      if(m.ability==='tomb')token(s,p,'묘비의 해답',6,6,{art:26},at());
      if(m.ability==='schrodinger'&&random(s)<.5)summon(s,p,'schrodinger',{},at());
      if(m.ability==='remainder')damage(s,`hero${1-p}`,4);
      if(m.ability==='recurrence')s.players[p].grave.filter(id=>id!=='recurrence').slice(-2).forEach(id=>addHand(s,p,id));
      runEffects(s,p,BY_ID[m.ability]?.onDeath,{source:m,position:at(),deferSettle:true});
      if(m.reborn)summon(s,p,m.id,{hp:1,reborn:false},at());
    }
  }
  if(s.players.some(p=>p.hp<=0)){s.winner=s.players.every(p=>p.hp<=0)?'draw':s.players[0].hp<=0?1:0;s.phase='over';}
}
function copyMinion(s,p,m,position) {
  const copy=structuredClone(m);delete copy.uid;copy.attack-=copy.auraAttack||0;copy.auraAttack=0;
  return summon(s,p,m.id,{...copy,attacks:0,asleep:true,visitedTargets:[]},position);
}
function buff(m,a,h){m.attack+=a;m.hp+=h;m.maxHp+=h;}
function setAttack(m,n){m.attack=n+(m.auraAttack||0);m.tempAttack=0;}
function silence(m){
  const baseHp=m.baseHealth??BY_ID[m.id]?.health??m.maxHp;
  m.attack=m.baseAttack??BY_ID[m.id]?.attack??m.attack;
  m.hp=Math.min(baseHp,m.hp+Math.max(0,baseHp-m.maxHp));m.maxHp=baseHp;
  m.silenced=true;for(const key of KEYWORD_KEYS)m[key]=false;m.ability=null;m.tempAttack=0;m.auraAttack=0;m.frozenUntil=null;
  m.formula=null;m.visitedTargets=[];delete m.relation;delete m.attackEquation;
  delete m.squeeze;delete m.ant;delete m.constantStorage;delete m.territorySite;delete m.territoryCells;delete m.frequency;
}
function startTurn(s,p) {
  s.current=p;s.turn++;const pl=s.players[p];pl.maxMana=Math.min(10,pl.maxMana+1);pl.mana=pl.maxMana;pl.temporaryMana=0;pl.heroAttacked=false;pl.powerUsed=false;
  s.deadline=s.turnSeconds?Date.now()+s.turnSeconds*1000:null;
  if(s.turn>180){s.phase='over';s.winner='draw';return;}
  pl.board.forEach(m=>{m.asleep=false;m.attacks=0;m.visitedTargets=[];});draw(s,p);
  for(const m of [...pl.board])if(!m.silenced){
    if(m.squeeze){const b=m.squeeze;b.low=Math.ceil((b.low+b.limit)/2);b.high=Math.floor((b.high+b.limit)/2);}
    if(m.formula)updateFormula(m,m.formula,m.functionX+(s.mode==='brawl'?2:1));
    if(m.ability==='demon'){draw(s,p);draw(s,p);}
    if(m.ability==='snail')m.attack+=2;
    if(m.ability==='fixedpoint')m.hp=m.maxHp;
    if(m.ability==='turing')draw(s,p,2);
    if(m.ability==='cicada'&&++m.step===2)buff(m,7,7);
    if(m.hp>0)runEffects(s,p,BY_ID[m.ability]?.onStart,{source:m});
  }
  settle(s);log(s,`${p?'상대':'나'}의 ${pl.maxMana}마나 턴`,'turn');
}
function replaceOpening(s,p,uids){
  const player=s.players[p],replace=player.hand.filter(c=>uids.includes(c.uid));
  player.hand=player.hand.filter(c=>!uids.includes(c.uid));
  replace.forEach(()=>draw(s,p));player.deck.push(...replace.map(c=>c.id));shuffle(s,player.deck);
}
export function submitMulligan(s,p,uids=[]){
  if(s.phase!=='mulligan'||![0,1].includes(p)||s.mulliganDone?.[p]||!Array.isArray(uids)||new Set(uids).size!==uids.length||uids.some(uid=>!s.players[p].hand.some(c=>c.uid===uid)))return false;
  replaceOpening(s,p,uids);s.mulliganDone??=[false,false];s.mulliganDone[p]=true;
  if(!s.mulliganDone.every(Boolean))return true;
  const second=1-(s.first??0);
  s.players[second].hand.push({id:COIN.id,cost:0,uid:++s.serial,blueprint:COIN});
  s.phase='play';startTurn(s,s.first??0);return true;
}
export function mulligan(s,uids=[]){if(!submitMulligan(s,0,uids))return false;return submitMulligan(s,1,s.players[1].hand.filter(c=>c.cost>3).map(c=>c.uid));}
export function powerTargets(s,p){const h=heroOf(s.players[p]);return h.target?[...minions(s,p),...minions(s,1-p).filter(m=>!m.stealth)].filter(m=>h.id!=='euler'||s.players[1-p].board.includes(m)).map(m=>m.uid):[];}
export function canPower(s,p){
  const pl=s.players[p],h=heroOf(pl);
  return s.phase==='play'&&!s.choice&&s.current===p&&!pl.powerUsed&&pl.mana>=h.cost&&(!h.target||powerTargets(s,p).length>0)&&(h.id!=='archimedes'||minions(s,p).length>0);
}
export function usePower(s,p,key=null){
  if(!canPower(s,p))return false;
  const pl=s.players[p],h=heroOf(pl);
  if(h.target&&!powerTargets(s,p).some(t=>String(t)===String(key)))return false;
  pl.mana-=h.cost;pl.powerUsed=true;
  const m=findTarget(s,key)?.entity;
  if(h.id==='euclid')mathEffect(s,p,{rule:'gcd'},{},[m]);
  if(h.id==='leibniz'){if(m.formula)updateFormula(m,transformFormula(m.formula,'differentiate'));else setAttack(m,0);}
  if(h.id==='euler'){const n=Math.floor((m.attack+m.hp)/2);setAttack(m,n);m.hp=m.maxHp=n;}
  if(h.id==='archimedes')pl.armor+=Math.floor(Math.PI*minions(s,p).length**2);
  log(s,`${h.name} → ${h.power}`,'power');settle(s);return true;
}
export function targetsFor(s,p,c) {
  const definition=definitionOf(c);const type=definition.target;
  if(!type)return [];
  const result=[];
  for(let side=0;side<2;side++){
    if(['friendly','function'].includes(type)&&side!==p)continue;
    if((type==='enemy'||type==='enemyCharacter')&&side===p)continue;
    if(type==='enemyCharacter')result.push(`hero${side}`);
    result.push(...minions(s,side).filter(m=>(side===p||!m.stealth)&&(type!=='function'||m.formula&&validFormula(transformFormula(m.formula,definition.effects?.[0]?.rule)))).map(m=>m.uid));
  }
  return result.filter(key=>{
    const m=findTarget(s,key)?.entity,rule=definition.effects?.[0]?.rule;
    if(c.id==='ghost')return m.formula?.some(t=>t.p===0&&t.n>0&&t.d===1);
    if(c.id==='discriminant'){
      const [a,b]=minions(s,p);if(!a||!b||a.attack<=0)return false;
      return b.attack**2-4*a.attack*m.hp<0||s.players[p].board.length<capacity(s,p);
    }
    if(rule==='inputBack')return m.functionX>0;
    if(rule==='splitConstant')return m.formula.some(t=>t.p===0&&t.n>0&&t.d===1)&&s.players[p].board.length<capacity(s,p);
    if(rule==='composeLeft'){const list=minions(s,p),left=list[list.indexOf(m)-1];return !!left?.formula&&!!composeFormula(m.formula,left.formula);}
    return true;
  });
}
export function canPlay(s,p,c) {
  if(s.phase!=='play'||s.choice||s.current!==p||!c||c.cost>s.players[p].mana)return false;
  const def=definitionOf(c);
  if(def.requiresFriendly&&minions(s,p).length<def.requiresFriendly)return false;
  if(['minion','location'].includes(def.type)&&s.players[p].board.length>=capacity(s,p))return false;
  if(def.secret&&((s.players[p].secrets||[]).length>=5||(s.players[p].secrets||[]).includes(c.id)))return false;
  if(def.quest&&s.players[p].quest)return false;
  if(c.id==='bottle'&&s.players[p].board.length>=capacity(s,p))return false;
  if(c.id==='diagonal'&&!s.players[1-p].hand.length)return false;
  if(c.id==='hanoi'&&s.players[p].hanoi)return false;
  return def.type==='location'||!def.target||targetsFor(s,p,c).length>0;
}
function temporaryMana(player,amount){player.mana=Math.min(10,player.mana+amount);player.temporaryMana=Math.min(Math.max(0,10-player.maxMana),(player.temporaryMana||0)+amount);}
function freezeTarget(s,t){const m=t.entity;m.frozenUntil=s.turn+(t.p===s.current?((m.asleep||(t.hero?m.heroAttacked:m.attacks>0))?2:0):1);}
function effectTargets(s,p,e,{source,key}){
  const own=minions(s,p).filter(m=>m.hp>0),enemy=minions(s,1-p).filter(m=>m.hp>0);
  const highest=list=>[...list].sort((a,b)=>b.attack-a.attack).slice(0,1);
  const target=findTarget(s,key),board=s.players[p].board,index=board.indexOf(source);
  let keys=[];
  switch(e.scope){
    case 'target':keys=target&&target.entity.hp>0?[key]:[];break;
    case 'self':keys=source?.hp>0?[source.uid]:[];break;
    case 'friendly':keys=own.map(m=>m.uid);break;
    case 'others':keys=own.filter(m=>m!==source).map(m=>m.uid);break;
    case 'enemy':keys=enemy.map(m=>m.uid);break;
    case 'all':keys=[...own,...enemy].map(m=>m.uid);break;
    case 'hero':keys=[`hero${p}`];break;
    case 'friendlyCharacters':keys=[`hero${p}`,...own.map(m=>m.uid)];break;
    case 'randomEnemy':{const choices=[`hero${1-p}`,...enemy.map(m=>m.uid)];keys=[choices[Math.floor(random(s)*choices.length)]];break;}
    case 'highestEnemy':keys=highest(enemy).map(m=>m.uid);break;
    case 'highestEach':keys=[...highest(own),...highest(enemy)].map(m=>m.uid);break;
    case 'enemyEdges':keys=[...new Set([enemy[0]?.uid,enemy.at(-1)?.uid].filter(x=>x!=null))];break;
    case 'neighbors':keys=index<0?[]:[board[index-1],board[index+1]].filter(m=>m&&m.type!=='location'&&m.hp>0).map(m=>m.uid);break;
  }
  return keys.filter(k=>{const t=findTarget(s,k),m=t?.entity;return m&&(e.maxAttack==null||m.attack<=e.maxAttack)&&(!e.even||m.attack%2===0)&&(!e.prime||isPrime(m.attack))&&(!e.equalStats||m.attack===m.hp);});
}
function mathEffect(s,p,e,context,entities){
  const me=s.players[p],source=context.source||{},own=minions(s,p).filter(m=>m.hp>0);
  switch(e.rule){
    case 'triangleLink':case 'sumLink':{
      const i=own.indexOf(source);source.relation={kind:e.rule==='triangleLink'?'hypotenuse':'sum',inputs:[own[i-1]?.uid??null,own[i+1]?.uid??null]};break;
    }
    case 'equationSeal':entities.forEach(m=>{m.attackEquation='equalStats';emit(s,{kind:'math',key:m.uid,expression:`${m.attack} = ${m.hp} ?`});});break;
    case 'inputForward':case 'inputBack':entities.forEach(m=>{updateFormula(m,m.formula,m.functionX+(e.rule==='inputForward'?1:-1));emit(s,{kind:'math',key:m.uid,expression:`f(${m.functionX}) = ${m.functionValue}`});});break;
    case 'composeLeft':entities.forEach(m=>{const left=own[own.indexOf(m)-1],terms=composeFormula(m.formula,left.formula);if(terms){updateFormula(m,terms);emit(s,{kind:'math',key:m.uid,expression:`f(g(x)) = ${formatFormula(terms)}`});}});break;
    case 'splitConstant':entities.forEach(m=>{const c=m.formula.find(t=>t.p===0&&t.n>0&&t.d===1);if(c){updateFormula(m,m.formula.filter(t=>t.p!==0));token(s,p,`상수항 ${c.n}`,c.n,c.n,{art:13});emit(s,{kind:'math',key:m.uid,expression:`C = ${c.n}`});}});break;
    case 'hypotenuse':own.forEach(m=>setAttack(m,Math.floor(Math.hypot(m.attack,m.hp))));break;
    case 'circleArea':setAttack(source,Math.floor(Math.PI*own.filter(m=>m!==source).length**2));break;
    case 'fibonacciRow':{let a=1,b=1;for(const m of own){setAttack(m,a);[a,b]=[b,a+b];}break;}
    case 'pascalRow':{let n=1;own.forEach((m,i)=>{setAttack(m,n);n=n*(own.length-1-i)/(i+1);});break;}
    case 'reflect':own.forEach(m=>{const a=m.attack;setAttack(m,m.hp);m.hp=m.maxHp=a;});break;
    case 'binomialTrial':{const k=own.filter(m=>m!==source).reduce(n=>n+(random(s)<.5?1:0),0);if(k)token(s,p,'이항분포의 표본',k,k,{art:source.art});break;}
    case 'posterior':{const hand=s.players[1-p].hand,n=hand.length,k=hand.filter(c=>definitionOf(c).type==='spell').length;s.players[1-p].revealed=true;setAttack(source,Math.floor(10*(k+1)/(n+2)));break;}
    case 'taxicab':{const sums=new Map();let answer=Infinity;for(const m of own){const value=m.attack**3+m.hp**3,pair=[m.attack,m.hp].sort((a,b)=>a-b).join(',');if(sums.has(value)&&sums.get(value)!==pair)answer=Math.min(answer,value);else sums.set(value,pair);}if(Number.isFinite(answer))me.armor+=answer;break;}
    case 'circleProjection':minions(s,1-p).forEach(m=>setAttack(m,Math.floor(Math.sqrt(Math.max(0,me.maxMana**2-m.hp**2)))));break;
    case 'linearEquation':entities.filter(m=>m.attack>0).forEach(m=>setAttack(m,Math.floor(m.hp/m.attack)));break;
    case 'gcd':entities.forEach(m=>{const n=gcd(m.attack,m.hp);setAttack(m,n);m.hp=m.maxHp=n;});break;
    case 'coprime':entities.forEach(m=>{const g=gcd(m.attack,m.hp)||1;setAttack(m,m.attack/g);m.hp=m.maxHp=m.hp/g;});break;
    case 'diagonal':entities.forEach(m=>{const a=m.attack,h=m.hp;setAttack(m,Math.max(a,h));m.hp=m.maxHp=Math.min(a,h);});break;
    case 'subtract':entities.forEach(m=>{if(m.attack>m.hp)setAttack(m,m.attack-m.hp);else if(m.hp>m.attack)m.hp=m.maxHp=m.hp-m.attack;});break;
    case 'divisorSum':entities.forEach(m=>setAttack(m,divisorSum(m.attack)));break;
    case 'triangularArmor':me.armor+=me.maxMana*(me.maxMana+1)/2;break;
    case 'germain':entities.forEach(m=>{if(isPrime(m.attack)&&isPrime(2*m.attack+1))setAttack(m,2*m.attack+1);});break;
    case 'evenCorrection':entities.forEach(m=>{setAttack(m,m.attack+m.attack%2);const n=m.hp%2;m.hp+=n;m.maxHp+=n;});break;
    case 'conserve':{const sum=own.reduce((n,m)=>n+m.attack-(m.auraAttack||0),0),q=Math.floor(sum/(own.length||1)),r=sum%(own.length||1);own.forEach((m,i)=>setAttack(m,q+(i<r?1:0)));break;}
    case 'rotate':{const values=own.map(m=>m.attack-(m.auraAttack||0));own.forEach((m,i)=>setAttack(m,values[(i+own.length-1)%own.length]));break;}
    case 'sort':{const sorted=[...own].sort((a,b)=>a.attack-b.attack);me.board=me.board.map(m=>m.type==='location'?m:sorted.shift());break;}
    case 'interpolate':{if(own.length>1){const a=own[0].attack,b=own.at(-1).attack;own.forEach((m,i)=>setAttack(m,Math.round(a+(b-a)*i/(own.length-1))));}break;}
    case 'halfAttack':entities.forEach(m=>setAttack(m,Math.floor(m.attack/2)));break;
    case 'cover':{const seen=new Set();for(const m of own)if(!seen.has(m.attack)){m.shield=true;seen.add(m.attack);}break;}
    case 'handSum':me.armor+=me.hand.reduce((n,c)=>n+c.cost,0);break;
    case 'determinant':{const [a,b]=own;if(a&&b)damage(s,context.key,Math.abs(a.attack*b.hp-b.attack*a.hp));break;}
    case 'complement':{const present=new Set(own.map(m=>m.attack));for(let n=1;n<=7;n++)if(!present.has(n))token(s,p,`여집합의 ${n}`,n,n,{art:source.art});break;}
    case 'product':entities.filter(m=>m.hp%2===0).forEach(m=>{setAttack(m,m.attack*2);m.hp=m.maxHp=m.hp/2;});break;
    case 'meanDamage':{const mean=Math.floor(own.reduce((sum,m)=>sum+m.attack,0)/(own.length||1));characters(s,1-p).forEach(k=>damage(s,k,mean));break;}
    case 'mean':{const mean=Math.floor(own.reduce((sum,m)=>sum+m.attack,0)/(own.length||1));own.forEach(m=>setAttack(m,mean));heal(s,`hero${p}`,mean);break;}
    case 'crt':{const m=entities[0];if(m){const n=Array.from({length:15},(_,i)=>i+1).find(n=>n%3===m.attack%3&&n%5===m.hp%5);token(s,p,`합동식의 해 ${n}`,n,n,{art:source.art});}break;}
    case 'bezout':{const g=own.reduce((a,m)=>gcd(a,m.attack),0);if(g)token(s,p,`최대공약수 ${g}`,g,g,{art:source.art});break;}
    case 'wilson':entities.forEach(m=>{if(isPrime(m.attack))m.hp=m.maxHp=1;else setAttack(m,1);});break;
    case 'martingale':me.armor=random(s)<.5?me.armor*2:0;break;
    case 'stirling':{const n=me.hand.filter(c=>definitionOf(c).type==='minion').length,discount=n?Math.max(0,Math.floor(n*Math.log(n)-n+.5*Math.log(2*Math.PI*n))):0;me.hand.filter(c=>definitionOf(c).type==='minion').forEach(c=>c.cost=Math.max(0,c.cost-discount));break;}
    case 'differentiate':case 'integrate':case 'shift':case 'substituteSquare':entities.filter(m=>m.formula).forEach(m=>updateFormula(m,transformFormula(m.formula,e.rule)));break;
    case 'definiteIntegral':{const m=entities.find(m=>m.formula);if(m){const antiderivative=integrate(m.formula),value=evaluateFormula(antiderivative,m.functionX)-evaluateFormula(antiderivative,0);damage(s,`hero${1-p}`,Math.max(0,Math.floor(value+1e-9)));}break;}
    case 'ackermann':source.step=Math.min(5,(source.step||0)+1);setAttack(source,2**(source.step+3)-3);break;
    case 'sixFaces':source.step=((source.step||0)+1)%6;setAttack(source,source.step+1);source.hp=source.maxHp=6-source.step;break;
    case 'tape':if((source.step||0)<4){source.tape=(source.tape??10)^(1<<(source.step||0));source.step=(source.step||0)+1;setAttack(source,source.tape);}break;
    case 'pendulum':source.step=(source.step||0)+1;setAttack(source,source.step%2?6:2);break;
    case 'beaver':{let n=0;while(me.board.length<capacity(s,p)){token(s,p,'비버의 작업 기록',1,1,{art:source.art});n++;}source.attack+=n;break;}
    case 'glider':{const i=me.board.indexOf(source),j=(i+1)%me.board.length;if(i>=0)[me.board[i],me.board[j]]=[me.board[j],me.board[i]];break;}
    case 'cardinality':{const n=new Set(own.filter(m=>m!==source).map(m=>m.attack)).size;for(let i=0;i<n;i++)token(s,p,'집합의 원소',1,1,{art:source.art});break;}
    case 'perfect':own.filter(m=>m.attack>0&&divisorSum(m.attack)===m.attack).forEach(m=>{m.hp=m.maxHp;m.shield=true;});break;
    case 'bernoulli':{const first=random(s)<.5,second=random(s)<.5;if(first&&second)me.armor+=8;break;}
    case 'missingCost':{const costs=new Set(me.hand.map(c=>c.cost)),pool=CARDS.filter(c=>c.type==='spell'&&!costs.has(c.cost));if(pool.length)addHand(s,p,pool[Math.floor(random(s)*pool.length)].id);break;}
    default:throw new Error(`Unknown mathematical operation: ${e.rule}`);
  }
}
function runEffects(s,p,effects,context={}){
  if(!effects)return;
  const me=s.players[p],source=context.source||{};
  let position=context.position;
  for(const e of effects)for(let repeat=0;repeat<(e.repeat||1);repeat++){
    if(s.phase==='over')return;
    const keys=effectTargets(s,p,e,context),entities=keys.map(k=>findTarget(s,k).entity);
    const bonus=context.spell?minions(s,p).reduce((n,m)=>n+(!m.silenced&&m.hp>0?(m.spellDamage||0):0),0):0;
    switch(e.kind){
      case 'math':mathEffect(s,p,e,context,entities);break;
      case 'damage':keys.forEach(k=>damage(s,k,e.amount+bonus));break;
      case 'heal':keys.forEach(k=>{const t=findTarget(s,k);heal(s,k,e.full?(t.hero?30:t.entity.maxHp)-t.entity.hp:e.amount);});break;
      case 'buff':entities.forEach(m=>{m.attack=Math.max(m.auraAttack||0,m.attack+e.attack);m.hp+=e.health;m.maxHp+=e.health;});break;
      case 'buffHand':entities.forEach(m=>buff(m,me.hand.length,me.hand.length));break;
      case 'buffBoard':entities.forEach(m=>{const n=minions(s,p).filter(x=>x!==m).length;buff(m,n,n);});break;
      case 'draw':for(let i=0;i<e.count;i++)draw(s,p,e.discount||0);break;
      case 'refill':{const n=Math.max(0,e.count-me.hand.length);for(let i=0;i<n;i++)draw(s,p);break;}
      case 'drawType':{const side=e.enemy?1-p:p,player=s.players[side];for(let i=0;i<e.count;i++){let choices=player.deck.map((id,index)=>({id,index})).filter(x=>BY_ID[x.id].type===e.type&&(!e.evenCost||BY_ID[x.id].cost%2===0));if(e.highest)choices.sort((a,b)=>BY_ID[b.id].cost-BY_ID[a.id].cost);if(!choices.length)break;addHand(s,side,player.deck.splice(choices[0].index,1)[0]);}break;}
      case 'randomSpell':{const pool=CARDS.filter(c=>c.type==='spell');for(let i=0;i<e.count;i++)addHand(s,p,pool[Math.floor(random(s)*pool.length)].id);break;}
      case 'armor':me.armor+=e.amount;break;
      case 'armorHand':me.armor+=me.hand.length*e.amount;break;
      case 'doubleArmor':me.armor=me.armor?me.armor*2:5;break;
      case 'discount':me.hand.filter(c=>!e.type||definitionOf(c).type===e.type).forEach(c=>c.cost=Math.max(0,c.cost-e.amount));break;
      case 'summon':for(let i=0;i<e.count;i++){const m=token(s,p,e.name,e.attack,e.health,{art:source.art??0,...e.keywords},position);if(m&&position!=null)position++;}break;
      case 'copy':for(const m of entities)for(let i=0;i<e.count;i++)copyMinion(s,p,m);break;
      case 'destroy':entities.forEach(m=>m.hp=0);break;
      case 'silence':entities.forEach(silence);break;
      case 'freeze':keys.forEach(k=>freezeTarget(s,findTarget(s,k)));break;
      case 'setHealth':entities.forEach(m=>m.hp=m.maxHp=e.amount);break;
      case 'setStats':entities.forEach(m=>{setAttack(m,e.attack);m.hp=m.maxHp=e.health;});break;
      case 'setAttack':entities.forEach(m=>setAttack(m,e.amount));break;
      case 'multiplyAttack':entities.forEach(m=>{const factor=e.amount;m.attack*=factor;m.tempAttack=(m.tempAttack||0)*factor;});break;
      case 'tempAttack':entities.forEach(m=>{m.attack+=e.amount;m.tempAttack=(m.tempAttack||0)+e.amount;});break;
      case 'swap':entities.forEach(m=>{const attack=m.attack;setAttack(m,m.hp);m.hp=m.maxHp=attack;});break;
      case 'keyword':entities.forEach(m=>m[e.keyword]=true);break;
      case 'spellPower':entities.forEach(m=>m.spellDamage=(m.spellDamage||0)+e.amount);break;
      case 'residue':damage(s,`hero${1-p}`,3+minions(s,1-p).length+bonus);break;
      case 'resurrect':{const ids=me.grave.slice(-e.count);if(e.reverse)ids.reverse();ids.forEach(id=>summon(s,p,id,{...e.keywords}));break;}
      case 'bounce':for(const key of keys){const t=findTarget(s,key),m=t.entity,owner=s.players[t.p];owner.board=owner.board.filter(x=>x!==m);if(BY_ID[m.id])addHand(s,t.p,m.id);else if(owner.hand.length<10)owner.hand.push({uid:++s.serial,id:'token',cost:1,blueprint:{...m,type:'minion',target:null,health:m.maxHp,hp:m.maxHp,cost:1}});}break;
      default:throw new Error(`Unknown card effect: ${e.kind}`);
    }
    if(!context.deferSettle)settle(s);
  }
}
function spell(s,p,id,key,definition=BY_ID[id]) {
  if(definition?.effects){runEffects(s,p,definition.effects,{key,source:definition,spell:true});return;}
  const me=s.players[p],enemy=s.players[1-p],t=findTarget(s,key),m=t?.entity;
  const bonus=minions(s,p).reduce((n,x)=>n+(!x.silenced?(x.spellDamage||0):0),0);
  const hit=(key,n)=>damage(s,key,n+bonus);
  const enemyDamage=n=>characters(s,1-p).forEach(k=>hit(k,n));
  switch(id){
    case 'chain': {let current=m;for(let i=0;i<4&&current;i++){const row=minions(s,1-p),at=row.indexOf(current),chance=current.attack%2===0?.75:.25,right=random(s)<chance,next=row[(at+(right?1:row.length-1))%row.length];emit(s,{kind:'math',key:current.uid,expression:`${current.attack%2===0?'짝수':'홀수'} → ${right?'오른쪽':'왼쪽'}`});hit(current.uid,3);settle(s);if(s.phase==='over')break;current=minions(s,1-p).find(x=>x.uid===next.uid);}break;}
    case 'cut': {const pos=s.players[t.p].board.indexOf(m);m.hp=0;settle(s);token(s,t.p,'절단면',1,1,{art:17},pos);token(s,t.p,'절단면',1,1,{art:17},pos+1);break;}
    case 'sieve': for(const pl of s.players)for(const x of pl.board.filter(x=>x.type!=='location'))if(!isPrime(x.attack))x.hp=0;break;
    case 'bottle': enemy.board=enemy.board.filter(x=>x!==m);m.asleep=true;m.attacks=0;me.board.push(m);break;
    case 'mobius': {const old=m.attack;setAttack(m,m.hp);m.hp=old;m.maxHp=old;m.shield=true;break;}
    case 'tempoCoin':temporaryMana(me,1);break;
    case 'bones':temporaryMana(me,3);draw(s,p);break;
    case 'needle':hit(key,3);if(random(s)<.5)hit(key,3);break;
    case 'horseshoe':minions(s,p).forEach(x=>x.attack*=2);break;
    case 'sword':me.weapon={attack:4,durability:3};break;
    case 'sandwich':{const row=minions(s,p),a=row[0].attack,b=row.at(-1).attack;m.squeeze={low:Math.min(a,b),high:Math.max(a,b),limit:Math.floor((a+b)/2)};break;}
    case 'crown':me.armor+=8;draw(s,p);break;
    case 'margin':for(let i=0;i<3;i++)draw(s,p,1);break;
    case 'letter':me.grave.slice(-3).forEach(x=>summon(s,p,x));break;
    case 'notebook': {const spells=CARDS.filter(c=>c.type==='spell');for(let i=0;i<3;i++){const c=spells[Math.floor(random(s)*spells.length)];addHand(s,p,c.id,Math.max(0,c.cost-2));}break;}
    case 'taxi':token(s,p,'1729번 택시 · 앞좌석',1,7,{charge:true,art:31});token(s,p,'1729번 택시 · 뒷좌석',2,9,{charge:true,art:31});break;
    case 'goldbach':token(s,p,'첫 번째 소수',3,3,{art:32});token(s,p,'두 번째 소수',5,5,{art:32});break;
    case 'suitcase':me.hand.forEach(c=>c.cost=Math.max(0,c.cost-1));break;
    case 'square':minions(s,p).forEach(x=>{buff(x,2,2);x.hp=x.maxHp;});break;
    case 'epsilon':m.hp=1;m.maxHp=1;draw(s,p);break;
    case 'aleph': {const slots=capacity(s,p)-me.board.length;for(let i=0;i<slots;i++)token(s,p,'셀 수 있는 무한소',2,2,{art:36});break;}
    case 'zero':minions(s,1-p).forEach(x=>{silence(x);x.attack=0;});break;
    case 'quaternion':hit(key,4);token(s,p,'사원수의 허수',4,4,{art:38});break;
    case 'octonion':hit(key,8);heal(s,`hero${p}`,8);break;
    case 'oracle':enemy.hand.forEach(c=>c.cost=Math.min(10,c.cost+2));break;
    case 'infinity':minions(s,p).forEach(x=>copyMinion(s,p,x));break;
    case 'triangle':setAttack(m,Math.floor(Math.hypot(m.attack,m.hp)));break;
    case 'circle': {const returning=minions(s,1-p);enemy.board=enemy.board.filter(x=>x.type==='location');returning.forEach(x=>{if(BY_ID[x.id])addHand(s,1-p,x.id);else if(enemy.hand.length<10)enemy.hand.push({uid:++s.serial,id:'token',cost:1,blueprint:{...x,type:'minion',target:null,health:x.maxHp,hp:x.maxHp,cost:1}});});log(s,'“내 원을 밟지 마라!”');break;}
    case 'bridge':for(const pl of s.players){const best=pl.board.filter(x=>x.type!=='location').sort((a,b)=>b.attack-a.attack)[0];pl.board.filter(x=>x.type!=='location').forEach(x=>{if(x!==best)x.hp=0;});}break;
    case 'star':enemyDamage(3);characters(s,p).forEach(k=>heal(s,k,3));break;
    case 'carpet':for(let i=0;i<4;i++)token(s,p,'양탄자 조각',1,3,{taunt:true,art:46});break;
    case 'polygon':me.armor+=17;break;
    case 'door': {const car=random(s)<2/3;token(s,p,car?'세 번째 문의 자동차':'첫 번째 문의 염소',car?7:3,car?7:3,{art:48});break;}
    case 'domino':for(let i=0;i<30&&enemy.board.length;i++){const before=enemy.board.length;minions(s,1-p).forEach(x=>hit(x.uid,2));settle(s);if(enemy.board.length>=before)break;}break;
    case 'delta':hit(key,7);break;
    case 'kronecker':s.players.forEach(pl=>pl.board.filter(x=>x.type!=='location').forEach(x=>{if(x.attack===x.hp)x.hp=0;}));break;
    case 'cantordust':Object.assign(m,{name:'칸토어의 먼지',attack:1,hp:1,maxHp:1,baseAttack:1,baseHealth:1,art:72,text:'',id:'token'});silence(m);break;
    case 'diagonal':{const costs=enemy.hand.map(c=>c.cost),n=costs.reduce((sum,c,i)=>sum+((c>>i)&1?0:2**i),0),blueprint={id:'token',name:`목록 밖의 수 ${n}`,cost:3,type:'spell',attack:0,health:0,art:BY_ID.diagonal.art,school:'역설',target:'enemyCharacter',text:`적 하나에게 피해를 ${n} 줍니다.`,flavor:'네가 적은 목록에는 없다.',diagonalWitness:costs,mathNote:`비용 목록 ${costs.join(', ')}의 i번째 수에서 i번째 이진 자릿수를 뒤집었습니다.`,effects:[{kind:'damage',scope:'target',amount:n}]};if(me.hand.length<10)me.hand.push({id:'token',uid:++s.serial,cost:3,blueprint});emit(s,{kind:'math',key:`hero${p}`,expression:`대각선 반전 → ${n}`});break;}
    case 'choice':for(let i=0;i<2&&me.deck.length;i++){let index=0;me.deck.forEach((id,j)=>{if(BY_ID[id].cost>BY_ID[me.deck[index]].cost)index=j;});const [id]=me.deck.splice(index,1);addHand(s,p,id,Math.max(0,BY_ID[id].cost-3));}break;
    case 'zeroDivide':s.players.forEach(pl=>{pl.board=pl.board.filter(m=>m.type==='location');});hit('hero0',5);hit('hero1',5);break;
    case 'descent':minions(s,1-p).forEach(x=>{setAttack(x,Math.floor(x.attack/2));x.hp=Math.floor(x.hp/2);x.maxHp=Math.max(x.hp,Math.floor(x.maxHp/2));});break;
    case 'log':setAttack(m,m.attack>0?Math.floor(Math.log2(m.attack)):0);break;
    case 'exponential':m.attack*=2;m.hp*=2;m.maxHp*=2;break;
    case 'integral':me.armor+=minions(s,p).reduce((sum,x)=>sum+x.hp,0);break;
    case 'normal':hit(key,4);m.taunt=true;break;
    case 'fault':s.players.forEach(pl=>pl.board.filter(x=>x.type!=='location').forEach(x=>{if(x.attack>=4)x.hp=0;}));break;
    case 'dice':for(let i=0;i<6;i++){const ts=characters(s,1-p);hit(ts[Math.floor(random(s)*ts.length)],1);settle(s);if(s.phase==='over')break;}break;
    case 'coin':if(random(s)<.5){draw(s,p);draw(s,p);draw(s,p);}else token(s,p,'행운의 동전',5,5,{art:83});break;
    case 'bayes':enemy.revealed=true;draw(s,p);draw(s,p);break;
    case 'gauss': {const n=Math.max(0,...enemy.board.map(x=>x.attack));minions(s,1-p).forEach(x=>{if(x.attack===n)x.hp=0;});break;}
    case 'euler': {const top=minions(s,1-p).sort((a,b)=>b.hp-a.hp)[0];if(top)hit(top.uid,7);minions(s,1-p).filter(x=>x!==top).forEach(x=>hit(x.uid,1));break;}
    case 'voronoi':minions(s,p).forEach(x=>x.territorySite=true);break;
    case 'menger':minions(s,1-p).forEach(x=>hit(x.uid,me.armor));me.armor=0;break;
    case 'hanoi':me.hanoi={pegs:[[3,2,1],[],[]],moves:0};break;
    case 'koch':for(let i=0;i<3;i++)token(s,p,'코흐의 작은 눈송이',1,2,{taunt:true,art:90});me.armor+=3;break;
    case 'mandelbrot':minions(s,1-p).forEach(()=>token(s,p,'심연의 프랙탈',3,3,{art:91}));break;
    case 'banach':copyMinion(s,p,m);copyMinion(s,p,m);break;
    case 'demorgan':s.players.forEach(pl=>pl.board.filter(x=>x.type!=='location').forEach(x=>{const a=x.attack;setAttack(x,x.hp);x.hp=a;x.maxHp=a;}));break;
    case 'contradiction':silence(m);m.attack=0;draw(s,p);break;
    case 'golden':{const a=m.attack,h=m.hp;setAttack(m,h);m.hp=m.maxHp=a+h;break;}
    case 'discriminant':{const [a,b]=minions(s,p).slice(0,2).map(x=>x.attack),delta=b*b-4*a*m.hp;emit(s,{kind:'math',key:m.uid,expression:`Δ = ${b}² − 4×${a}×${m.hp} = ${delta}`});if(delta<0)setAttack(m,0);else for(let i=0;i<(delta===0?1:2);i++)copyMinion(s,p,m);break;}
    case 'conjugate':for(let i=0;i<2;i++)token(s,p,'켤레의 검사',3,2,{charge:true,art:97});break;
    case 'limit':minions(s,p).forEach(x=>x.shield=true);me.armor+=6;break;
    case 'qed':hit(`hero${1-p}`,minions(s,p).length>=5?30:15);break;
    case 'discovery':{const pool=shuffle(s,CARDS.filter(c=>c.type==='spell'&&!c.heroClass).map(c=>c.id));s.choice={p,kind:'discover',title:'주문 발견',options:pool.slice(0,3)};break;}
    case 'dilemma':s.choice={p,kind:'monty-pick',title:'문 하나를 고르세요',options:[0,1,2],prize:Math.floor(random(s)*3)};break;
    case 'counterexample':case 'ambush':(me.secrets??=[]).push(id);break;
    case 'rust':enemy.weapon=null;draw(s,p);break;
    case 'freeze':hit(key,2);freezeTarget(s,t);break;
    case 'surge':{const n=formulaValue(differentiate(m.formula),m.functionX??1);m.attack+=n;m.tempAttack=(m.tempAttack||0)+n;emit(s,{kind:'math',key:m.uid,expression:`f′(${m.functionX??1}) = ${n}`});break;}
    case 'proofquest':me.quest={id,progress:0};break;
    case 'euclidgift':token(s,p,'공준의 도형',2,4,{taunt:true,art:65});break;
    case 'archimedesgift':me.armor+=6;draw(s,p);draw(s,p);break;
    default:throw new Error(`처리되지 않은 주문: ${id}`);
  }
}
export function isPrime(n){if(n<2)return false;for(let i=2;i*i<=n;i++)if(n%i===0)return false;return true;}
export function play(s,p,uid,key=null,position=s.players[p].board.length) {
  const me=s.players[p],c=me.hand.find(x=>x.uid===uid);
  if(!canPlay(s,p,c))return false;
  const def=definitionOf(c);
  if(['minion','location'].includes(def.type)&&(!Number.isInteger(position)||position<0||position>me.board.length))return false;
  if(def.type!=='location'&&def.target&&!targetsFor(s,p,c).some(k=>String(k)===String(key)))return false;
  me.mana-=c.cost;me.hand=me.hand.filter(x=>x!==c);log(s,`${p?'상대':'나'} → ${p&&def.secret?'비밀':def.name}`,'play');
  if(def.type==='spell'&&triggerSecret(s,1-p,'counterexample')){settle(s);return true;}
  if(def.type==='minion'){
    if(c.id==='taylor'){const target=findTarget(s,key).entity;const copy=copyMinion(s,p,target,position);copy.name=`모조품 · ${target.name.replace('모조품 · ','')}`;}
    else {
      const options=c.blueprint?{...structuredClone(c.blueprint),cost:c.cost,attacks:0,asleep:true}:{cost:c.cost};delete options.uid;
      const placed=summon(s,p,c.id,options,position);
      if(c.id==='demon')s.players[1-p].revealed=true;
      if(c.id==='barber')minions(s,1-p).forEach(x=>{if(x.attack%2!==0)x.hp=0;});
      if(c.id==='pigeon')for(let i=0;i<2;i++)token(s,p,'집 없는 비둘기',2,2,{art:52});
      if(c.id==='emptyking'&&me.board.length===1)buff(placed,6,6);
      if(c.id==='group')buff(placed,(me.board.length-1)*2,(me.board.length-1)*2);
      if(c.id==='nash'&&me.board.length<capacity(s,p)){const enemy=s.players[1-p],x=enemy.board.find(x=>x.attack<=2);if(x){enemy.board=enemy.board.filter(m=>m!==x);x.asleep=true;x.attacks=0;me.board.push(x);}}
      if(c.id==='euclid')for(let i=0;i<2;i++){const index=me.deck.findIndex(id=>BY_ID[id].type==='minion');if(index>=0)addHand(s,p,me.deck.splice(index,1)[0]);}
      if(c.id==='ghost'){
        const target=findTarget(s,key).entity,value=target.formula.find(t=>t.p===0).n;
        placed.constantStorage={targetUid:target.uid,value};updateFormula(target,target.formula.filter(t=>t.p!==0));
        emit(s,{kind:'math',key:placed.uid,expression:`C = ${value} 보관`});
      }
      if(c.id==='amplifier'){placed.frequency=1;s.choice={p,kind:'frequency',title:'증폭할 주파수',source:placed.uid,options:[0,1,2]};}
      runEffects(s,p,def.onPlay,{key,source:placed});
    }
  }else if(def.type==='location')summon(s,p,c.id,{},position);
  else if(def.type==='weapon')me.weapon={id:c.id,attack:def.attack,durability:def.durability,lifesteal:!!def.lifesteal};
  else if(def.type==='hero'){me.hero='euler';me.armor+=5;me.powerUsed=false;}
  else {
    spell(s,p,c.id,key,def);
    settle(s);
    if(me.quest&&c.id!=='proofquest'&&++me.quest.progress>=3){token(s,p,'완성된 증명',8,8,{taunt:true,art:99});me.quest=null;log(s,'미완성의 증명 완료','quest');}
    if(s.phase!=='over')for(const watcher of [...me.board])if(!watcher.silenced){if(watcher.ability==='witch')characters(s,1-p).forEach(k=>damage(s,k,1));if(watcher.ability==='hypatia')me.armor+=3;}
  }
  settle(s);return true;
}
function triggerSecret(s,p,id){
  const secrets=s.players[p].secrets||[],index=secrets.indexOf(id);
  if(s.current===p||index<0)return false;
  secrets.splice(index,1);log(s,`비밀 공개: ${BY_ID[id].name}`,'secret');emit(s,{kind:'secret',name:BY_ID[id].name});return true;
}
export function choose(s,p,index){
  const c=s.choice;if(s.phase!=='play'||!c||c.p!==p||!Number.isInteger(index)||index<0||index>=c.options.length)return false;
  if(c.kind==='monty-pick'){const doors=[0,1,2].filter(x=>x!==index&&x!==c.prize);Object.assign(c,{kind:'monty-switch',title:'문을 바꾸시겠습니까?',selected:index,opened:doors[Math.floor(random(s)*doors.length)],options:['stay','switch']});return true;}
  if(c.kind==='discover')addHand(s,p,c.options[index],Math.max(0,BY_ID[c.options[index]].cost-2));
  else if(c.kind==='frequency'){const m=minions(s,p).find(x=>x.uid===c.source);if(m)m.frequency=c.options[index];}
  else if(c.kind==='monty-switch'){const door=index===0?c.selected:[0,1,2].find(x=>x!==c.selected&&x!==c.opened),car=door===c.prize;token(s,p,car?'몬티 홀의 자동차':'몬티 홀의 염소',car?7:3,car?7:3,{...(car?{rush:true}:{taunt:true}),art:BY_ID.dilemma.art});log(s,`${door+1}번 문: ${car?'자동차':'염소'}`);}
  else if(index===0)token(s,p,'몬티 홀의 염소',3,6,{taunt:true,art:48});
  else for(let i=0;i<3;i++)draw(s,p);
  s.choice=null;log(s,`${p?'상대':'나'}: 선택 완료`);settle(s);return true;
}
export function hanoiMove(s,p,from,to){
  const pl=s.players[p],tower=pl?.hanoi;
  if(s.phase!=='play'||s.current!==p||s.choice||!tower||pl.mana<1||!hanoiMoves(tower.pegs).some(m=>m.from===from&&m.to===to))return false;
  pl.mana--;tower.pegs[to].push(tower.pegs[from].pop());tower.moves++;
  emit(s,{kind:'math',key:`hero${p}`,expression:`${from+1} → ${to+1} · ${tower.moves}회`});
  if(tower.pegs[2].length===3){pl.armor+=49;delete pl.hanoi;log(s,'하노이의 탑 완성 · 방어도 +49');}
  settle(s);return true;
}
export function canUseLocation(s,p,uid){const m=s.players[p].board.find(m=>m.uid===uid);return !!(s.phase==='play'&&!s.choice&&s.current===p&&m?.type==='location'&&s.turn>=m.readyTurn&&minions(s,p).length>0);}
export function redistributeTargets(s,p,uid){return minions(s,p).filter(m=>m.uid!==uid&&m.hp>0&&!m.relation&&m.attack>(m.auraAttack||0)).map(m=>m.uid);}
export function canRedistribute(s,p,uid){const m=s.players[p].board.find(m=>m.uid===uid);return !!(s.phase==='play'&&!s.choice&&s.current===p&&m?.hp>0&&m.ability==='conservation'&&!m.silenced&&!m.relation&&m.mathUsedTurn!==s.turn&&redistributeTargets(s,p,uid).length);}
export function redistribute(s,p,uid,key){
  if(!canRedistribute(s,p,uid)||!redistributeTargets(s,p,uid).some(k=>String(k)===String(key)))return false;
  const source=findTarget(s,uid).entity,target=findTarget(s,key).entity,n=target.attack-(target.auraAttack||0),sum=source.attack+target.attack;
  source.attack+=n;target.attack-=n;source.mathUsedTurn=s.turn;
  emit(s,{kind:'math',key:uid,expression:`${sum} = ${source.attack} + ${target.attack}`});
  log(s,`${target.name} → ${source.name}: 공격력 ${n} 이동`);settle(s);return true;
}
export function useLocation(s,p,uid,key){
  if(!canUseLocation(s,p,uid))return false;
  const t=findTarget(s,key);if(!t||t.hero||t.p!==p||t.entity.type==='location')return false;
  const m=s.players[p].board.find(m=>m.uid===uid);m.hp--;m.readyTurn=s.turn+4;
  if(BY_ID[m.id]?.locationEffects)runEffects(s,p,BY_ID[m.id].locationEffects,{key,source:m});else buff(t.entity,2,2);
  log(s,`${m.name} → ${t.entity.name}`,'location');settle(s);return true;
}
export function concede(s,p){if(!['play','mulligan'].includes(s.phase)||![0,1].includes(p))return false;s.phase='over';s.winner=1-p;s.choice=null;log(s,`${p?'상대':'나'}: 항복`);return true;}
export function attackTargets(s,p,from) {
  const visible=minions(s,1-p).filter(m=>!m.stealth&&m.hp>0),guards=visible.filter(m=>m.taunt);
  const attacker=from?findTarget(s,from)?.entity:null,rushOnly=attacker?.asleep&&attacker.rush&&!attacker.charge;
  const keys=guards.length?guards.map(m=>m.uid):[...(rushOnly?[]:[`hero${1-p}`]),...visible.map(m=>m.uid)];
  return attacker?.uniqueAttack?keys.filter(k=>!(attacker.visitedTargets||[]).includes(String(k))):keys;
}
export function canAttack(s,p,key) {
  if(s.phase!=='play'||s.choice||s.current!==p)return false;
  const t=findTarget(s,key);if(!t||t.p!==p)return false;
  if(t.entity.frozenUntil!=null||t.entity.type==='location')return false;
  if(!t.hero&&t.entity.attackEquation&&t.entity.attack!==t.entity.hp)return false;
  return !!(t.hero?!!t.entity.weapon&&!t.entity.heroAttacked:t.entity.attack>0&&(!t.entity.asleep||t.entity.charge||t.entity.rush)&&t.entity.attacks<(t.entity.uniqueAttack?Infinity:t.entity.windfury?2:1)&&(!t.entity.uniqueAttack||attackTargets(s,p,key).length>0));
}
export function attack(s,p,from,to) {
  if(!canAttack(s,p,from)||!attackTargets(s,p,from).some(k=>String(k)===String(to)))return false;
  const a=findTarget(s,from),b=findTarget(s,to),atk=a.hero?a.entity.weapon.attack:a.entity.attack,ret=b.hero?0:b.entity.attack;
  a.entity.stealth=false;
  if(!a.hero&&a.entity.uniqueAttack)(a.entity.visitedTargets??=[]).push(String(to));
  if(b.hero&&triggerSecret(s,1-p,'ambush')){damage(s,from,6);settle(s);if(s.phase==='over'||!findTarget(s,from))return true;}
  damage(s,to,atk,{...(a.hero?a.entity.weapon:a.entity),p});damage(s,from,ret,{...b.entity,p:1-p});
  if(a.hero){a.entity.heroAttacked=true;const weapon=a.entity.weapon;if(!weapon.id)minions(s,1-p).forEach(m=>damage(s,m.uid,1));if(weapon.quadrature)emit(s,{kind:'math',key:from,expression:`${weapon.quadrature.parts}분할 · 구분구적합 ${weapon.quadrature.area.toFixed(2)} → ${atk}`});if(--weapon.durability<=0)a.entity.weapon=null;runEffects(s,p,BY_ID[weapon.id]?.afterAttack,{key:to,source:BY_ID[weapon.id]});}else a.entity.attacks++;
  log(s,`${a.hero?'영웅':a.entity.name} → ${b.hero?'영웅':b.entity.name} (${atk})`,'attack');settle(s);return true;
}
export function endTurn(s,p) {
  if(s.phase!=='play'||s.choice||s.current!==p)return false;
  for(const m of [...s.players[p].board]){
    if(m.hp<=0||m.silenced)continue;
    switch(m.ability){
      case 'rabbit': {const n=m.next;[m.previous,m.next]=[m.next,Math.min(99,m.previous+m.next)];for(let i=0;i<n&&s.players[p].board.length<capacity(s,p);i++)token(s,p,'피보나치의 작은 토끼',1,1,{art:0});break;}
      case 'ant':m.ant=walkAnt(m.ant);setAttack(m,m.ant.black.length);emit(s,{kind:'math',key:m.uid,expression:`${m.ant.steps}걸음 · 검정 ${m.ant.black.length}칸`});break;
      case 'amplifier':{const row=minions(s,p).filter(x=>x!==m),values=row.map(x=>Math.max(0,x.attack-(x.auraAttack||0))),next=amplifyFrequency(values,m.frequency??1);row.forEach((x,i)=>setAttack(x,next[i]));emit(s,{kind:'math',key:m.uid,expression:`주파수 ${m.frequency??1}: [${values.join(', ')}] → [${next.join(', ')}]`});break;}
      case 'monk':minions(s,p).forEach(x=>x.attack++);break;
      case 'hotel':for(let i=0;i<2;i++)token(s,p,'무한 호텔의 손님',2,2,{art:14});break;
      case 'horn':characters(s,1-p).forEach(k=>damage(s,k,2));break;
      case 'maxwell': {const target=minions(s,1-p).sort((a,b)=>b.attack-a.attack)[0];if(target)damage(s,target.uid,3);heal(s,`hero${p}`,3);break;}
      case 'butterfly': {const ts=characters(s,1-p);damage(s,ts[Math.floor(random(s)*ts.length)],4);break;}
      case 'brown': {const ts=minions(s,1-p);if(ts.length)damage(s,ts[Math.floor(random(s)*ts.length)].uid,3);break;}
      case 'goddess': {const spells=CARDS.filter(c=>c.type==='spell');addHand(s,p,spells[Math.floor(random(s)*spells.length)].id,0);break;}
      case 'noether':minions(s,p).filter(x=>x!==m).forEach(x=>x.shield=true);break;
      case 'pascaltriangle': {const b=minions(s,p),i=b.indexOf(m);setAttack(m,(b[i-1]?.attack||0)+(b[i+1]?.attack||0));break;}
    }
    if(m.hp>0)runEffects(s,p,BY_ID[m.ability]?.onEnd,{source:m});
    settle(s);if(s.phase==='over')return true;
  }
  for(const m of minions(s,p))if(m.territorySite&&!m.silenced)buff(m,0,m.territoryCells?.length||0);
  s.players[p].mana=Math.max(0,s.players[p].mana-(s.players[p].temporaryMana||0));s.players[p].temporaryMana=0;
  for(const pl of s.players)for(const m of pl.board){m.attack=Math.max(m.auraAttack||0,m.attack-(m.tempAttack||0));m.tempAttack=0;}
  for(const m of [s.players[p],...minions(s,p)])if(m.frozenUntil!=null&&s.turn>=m.frozenUntil)m.frozenUntil=null;
  startTurn(s,1-p);return true;
}
export function legalActions(s,p=s.current) {
  if(s.phase!=='play'||s.current!==p)return [];
  if(s.choice)return s.choice.p===p?s.choice.options.map((_,index)=>({type:'choose',index})):[];
  const result=[];
  if(s.players[p].hanoi&&s.players[p].mana>=1)for(const move of hanoiMoves(s.players[p].hanoi.pegs))result.push({type:'hanoiMove',...move});
  for(const c of s.players[p].hand)if(canPlay(s,p,c)){
    const def=definitionOf(c),ts=def.target&&def.type!=='location'?targetsFor(s,p,c):[null];
    const positions=['minion','location'].includes(def.type)?Array.from({length:s.players[p].board.length+1},(_,i)=>i):[undefined];
    for(const target of ts)for(const position of positions)result.push({type:'play',uid:c.uid,target,...(position===undefined?{}:{position})});
  }
  if(canPower(s,p))for(const target of heroOf(s.players[p]).target?powerTargets(s,p):[null])result.push({type:'power',target});
  for(const m of s.players[p].board)if(canUseLocation(s,p,m.uid))minions(s,p).forEach(t=>result.push({type:'location',uid:m.uid,target:t.uid}));
  for(const m of minions(s,p))if(canRedistribute(s,p,m.uid))redistributeTargets(s,p,m.uid).forEach(target=>result.push({type:'redistribute',uid:m.uid,target}));
  for(const key of characters(s,p))if(canAttack(s,p,key))attackTargets(s,p,key).forEach(target=>result.push({type:'attack',uid:key,target}));
  result.push({type:'end'});return result;
}
export function applyAction(s,p,a) {
  const handlers={play:()=>play(s,p,a.uid,a.target,a.position),power:()=>usePower(s,p,a.target),attack:()=>attack(s,p,a.uid,a.target),end:()=>endTurn(s,p),choose:()=>choose(s,p,a.index),hanoiMove:()=>hanoiMove(s,p,a.from,a.to),location:()=>useLocation(s,p,a.uid,a.target),redistribute:()=>redistribute(s,p,a.uid,a.target),concede:()=>concede(s,p)};
  if(!handlers[a?.type])return false;
  const previous=s.events;s.events=[];const ok=handlers[a.type]();if(!ok)s.events=previous;return ok;
}
function boardValue(p){return p.board.reduce((v,m)=>v+m.attack*.7+m.hp*.4+(m.taunt?1:0)+(m.shield?2:0)+(m.silenced?0:['hotel','rabbit','horn','witch','monk'].includes(m.ability)?3:m.ability==='pascaltriangle'?Math.min(2,p.board.length-1)*2:0),0);}
export function evaluate(s,p) {
  if(s.phase==='over')return s.winner==='draw'?0:s.winner===p?100000:-100000;
  const a=s.players[p],b=s.players[1-p];return boardValue(a)-boardValue(b)+(a.hp-b.hp)*.6+(a.armor-b.armor)*.25+(a.hand.length-b.hand.length)*1.3+(a.weapon?3:0)-(b.weapon?3:0);
}
export function chooseAI(s) {
  if(s.choice?.kind==='monty-pick')return {type:'choose',index:0};
  if(s.choice?.kind==='monty-switch')return {type:'choose',index:1};
  if(!s.choice&&s.players[s.current].hanoi&&s.players[s.current].mana>=1){const move=nextHanoiMove(s.players[s.current].hanoi.pegs);if(move)return {type:'hanoiMove',...move};}
  const p=s.current,ranked=legalActions(s,p).map(action=>{
    const state=structuredClone(s);applyAction(state,p,action);
    return {action,state,score:evaluate(state,p)+(action.type==='end'?-.2:0)};
  }).sort((a,b)=>b.score-a.score);
  // shortcut: examine two actions, keeping six candidates plus mana spells; longer combos need a larger search budget.
  const candidates=ranked.filter((x,i)=>i<6||(x.action.type==='play'&&['tempoCoin','bones'].includes(s.players[p].hand.find(c=>c.uid===x.action.uid)?.id)));
  let best=ranked[0].action,bestScore=-Infinity;
  for(const candidate of candidates){
    let score=candidate.score;
    if(candidate.state.phase==='play'&&candidate.state.current===p){
      for(const next of legalActions(candidate.state,p)){
        const sim=structuredClone(candidate.state);applyAction(sim,p,next);
        score=Math.max(score,evaluate(sim,p)+(next.type==='end'?-.2:0));
      }
    }
    if(score>bestScore){bestScore=score;best=candidate.action;}
  }
  return best;
}
export function definitionOf(c){return c.blueprint||BY_ID[c.id];}
