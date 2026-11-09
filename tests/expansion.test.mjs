import test from 'node:test';
import assert from 'node:assert/strict';
import {BY_ID} from '../src/cards.js';
import {HEROES,heroOf} from '../src/heroes.js';
import {createGame,deckFor,mulligan,summon,play,damage,settle,canAttack,attack,attackTargets,targetsFor,endTurn,choose,legalActions,applyAction,canUseLocation,useLocation,validateDeck,canPlay,usePower,chooseAI} from '../src/engine.js';
import {loadProfile,exportDeck,importDeck,recordMatch} from '../src/profile.js';
function game(){const s=createGame(deckFor(1),42,deckFor(2),{first:0});mulligan(s);s.players.forEach(p=>{p.hand=[];p.board=[];p.mana=50;p.maxMana=10;});return s;}
function give(s,id,p=s.current){const c={id,cost:BY_ID[id].cost,uid:++s.serial};s.players[p].hand.push(c);return c;}
function cast(s,id,key=null,p=s.current,pos){return play(s,p,give(s,id,p).uid,key,pos);}
test('discover suspends other actions; invalid choices never spend and chosen card is discounted',()=>{
  const s=game();cast(s,'discovery');assert.equal(s.choice.options.length,3);assert.equal(new Set(s.choice.options).size,3);assert.ok(legalActions(s).every(a=>a.type==='choose'));
  assert.equal(endTurn(s,0),false);assert.equal(usePower(s,0),false);assert.equal(choose(s,1,0),false);assert.equal(choose(s,0,3),false);
  const id=s.choice.options[1];assert.ok(choose(s,0,1));assert.equal(s.players[0].hand.at(-1).id,id);assert.equal(s.players[0].hand.at(-1).cost,Math.max(0,BY_ID[id].cost-2));assert.equal(s.choice,null);
});
test('Monty doors resolve both decisions and survive a saved JSON round trip',()=>{
  for(const index of [0,1]){let s=game();cast(s,'dilemma');s.choice.prize=0;assert.ok(choose(s,0,0));s=JSON.parse(JSON.stringify(s));assert.ok(choose(s,0,index));assert.equal(s.players[0].board[0].hp,index===0?7:3);}
});
test('counter secret is unique, triggers only against opponent, spends the countered card and hides its identity',()=>{
  const s=game();cast(s,'counterexample');assert.equal(canPlay(s,0,give(s,'counterexample')),false);cast(s,'crown');assert.equal(s.players[0].secrets.length,1);
  s.current=1;const armor=s.players[1].armor;cast(s,'crown');assert.equal(s.players[1].armor,armor);assert.equal(s.players[0].secrets.length,0);
  cast(s,'ambush');assert.equal(s.log.at(-1).text,'상대 → 비밀');
});
test('attack secret kills the attacker before combat, including deathrattles',()=>{
  const s=game();cast(s,'ambush');s.current=1;const m=summon(s,1,'fly');const hp=s.players[0].hp;assert.ok(attack(s,1,m.uid,'hero0'));assert.equal(s.players[0].hp,hp);assert.ok(!s.players[1].board.length);assert.equal(s.players[1].hand.length,1);
});
test('locations share board slots but are not minions, cannot be attacked or hit by board clears',()=>{
  const s=game();cast(s,'observatory');const loc=s.players[0].board[0];assert.equal(loc.hp,3);assert.ok(!canAttack(s,0,loc.uid));
  const c=give(s,'cantordust',1);assert.ok(!targetsFor(s,1,c).includes(loc.uid));assert.ok(!attackTargets(s,1).includes(loc.uid));damage(s,loc.uid,99);assert.equal(loc.hp,3);
  cast(s,'zeroDivide');assert.equal(s.players[0].board[0].uid,loc.uid);
});
test('location buffs require a friendly minion, spend durability, and cool down across the next own turn',()=>{
  const s=game();cast(s,'observatory');const l=s.players[0].board[0];assert.equal(canUseLocation(s,0,l.uid),false);const m=summon(s,0,'cat');
  assert.equal(useLocation(s,0,l.uid,'hero0'),false);assert.ok(useLocation(s,0,l.uid,m.uid));assert.equal(m.attack,6);assert.equal(l.hp,2);assert.equal(useLocation(s,0,l.uid,m.uid),false);
  endTurn(s,0);endTurn(s,1);assert.equal(canUseLocation(s,0,l.uid),false);endTurn(s,0);endTurn(s,1);assert.ok(canUseLocation(s,0,l.uid));
  l.hp=1;useLocation(s,0,l.uid,m.uid);assert.ok(!s.players[0].board.includes(l));assert.ok(!s.players[0].grave.includes('observatory'));
});
test('rush excludes heroes until next turn; windfury grants exactly two attacks',()=>{
  const s=game(),r=summon(s,0,'achilles'),e=summon(s,1,'tomb');assert.ok(canAttack(s,0,r.uid));assert.ok(!attackTargets(s,0,r.uid).includes('hero1'));assert.ok(attack(s,0,r.uid,e.uid));assert.equal(attack(s,0,r.uid,e.uid),false);
  const t=game(),w=summon(t,0,'doubleblade',{asleep:false});assert.ok(attack(t,0,w.uid,'hero1'));assert.ok(attack(t,0,w.uid,'hero1'));assert.equal(attack(t,0,w.uid,'hero1'),false);
});
test('stealth blocks enemy targeting and taunt until attack; poison respects shields',()=>{
  const s=game(),hidden=summon(s,0,'hiddenroot',{asleep:false,taunt:true}),shield=summon(s,1,'snail');assert.ok(!attackTargets(s,1).includes(hidden.uid));assert.ok(attackTargets(s,1).includes('hero0'));assert.ok(!targetsFor(s,1,give(s,'delta',1)).includes(hidden.uid));
  assert.ok(attack(s,0,hidden.uid,shield.uid));assert.ok(!hidden.stealth);assert.equal(shield.hp,5);hidden.attacks=0;assert.ok(attack(s,0,hidden.uid,shield.uid));assert.ok(!s.players[1].board.includes(shield));
});
test('reborn uses one health once, silence cancels it; deathrattle summons preserve position',()=>{
  const s=game(),left=summon(s,0,'cat'),phoenix=summon(s,0,'phoenix'),right=summon(s,0,'cat');damage(s,phoenix.uid,50);settle(s);const reborn=s.players[0].board[1];assert.equal(reborn.hp,1);assert.equal(reborn.reborn,false);assert.equal(s.players[0].board[2].uid,right.uid);damage(s,reborn.uid,50);settle(s);assert.deepEqual(s.players[0].board.map(m=>m.uid),[left.uid,right.uid]);
  const tomb=summon(s,0,'tomb',{},1);damage(s,tomb.uid,50);settle(s);assert.equal(s.players[0].board[1].name,'묘비의 해답');
  const p=summon(s,1,'phoenix');cast(s,'contradiction',p.uid);damage(s,p.uid,50);settle(s);assert.equal(s.players[1].board.length,0);
});
test('lifesteal works on damage including retaliation and weapons have independent effects',()=>{
  const s=game();s.players[0].hp=10;const m=summon(s,0,'leecher',{asleep:false});attack(s,0,m.uid,'hero1');assert.equal(s.players[0].hp,13);
  cast(s,'razor');const e=summon(s,1,'cat');attack(s,0,'hero0','hero1');assert.equal(s.players[0].hp,16);assert.equal(e.hp,3);s.current=1;cast(s,'rust');assert.equal(s.players[0].weapon,null);
});
test('spell power buffs damage instances but not deathrattles or hero powers',()=>{
  const s=game();summon(s,0,'token',{spellDamage:2});assert.ok(cast(s,'quaternion','hero1'));assert.equal(s.players[1].hp,24);s.players[0].hero='leibniz';const f=summon(s,0,'marginscribe');assert.ok(usePower(s,0,f.uid));assert.equal(f.attack,3);assert.equal(s.players[1].hp,24);
  const r=summon(s,0,'remainder');cast(s,'cut',r.uid);assert.equal(s.players[1].hp,20);
});
test('freeze skips next attack turn then thaws; temporary attack and aura expire independently',()=>{
  const s=game(),m=summon(s,1,'doubleblade',{asleep:false});cast(s,'freeze',m.uid);endTurn(s,0);assert.equal(canAttack(s,1,m.uid),false);endTurn(s,1);endTurn(s,0);assert.ok(canAttack(s,1,m.uid));
  const t=game(),c=summon(t,0,'bridgekeeper'),choir=summon(t,0,'choir');assert.equal(c.attack,2);assert.ok(cast(t,'surge',c.uid));assert.equal(c.attack,4);endTurn(t,0);assert.equal(c.attack,2);damage(t,choir.uid,99);settle(t);assert.equal(c.attack,1);
});
test('quest counts subsequent spells only and hero replacement changes power',()=>{
  const s=game();cast(s,'proofquest');assert.equal(s.players[0].quest.progress,0);for(let i=0;i<3;i++)cast(s,'crown');assert.equal(s.players[0].quest,null);assert.ok(s.players[0].board.some(m=>m.attack===8&&m.taunt));
  cast(s,'eulerhero');assert.equal(heroOf(s.players[0]).power,'등식');const m=summon(s,1,'token',{attack:2,hp:8,maxHp:8});assert.ok(usePower(s,0,m.uid));assert.deepEqual([m.attack,m.hp],[5,5]);assert.equal(s.players[1].hp,30);
});
test('setting attack replaces a temporary increase without producing negative attack at turn end',()=>{
  const s=game(),m=summon(s,0,'bridgekeeper');cast(s,'surge',m.uid);assert.equal(m.attack,3);cast(s,'log',m.uid);assert.equal(m.attack,1);endTurn(s,0);assert.equal(m.attack,1);
});
test('deck codes enforce count, legendary limit and class; old drafts migrate without losing cards',()=>{
  const ids=deckFor(1),profile=loadProfile(null,ids);assert.deepEqual(profile.decks[0].ids,ids);const d={name:'토끼와 호텔',hero:0,ids};assert.deepEqual(importDeck(exportDeck(d)),d);
  assert.throws(()=>importDeck('MATH1:{}'));assert.throws(()=>importDeck('MATH1:null'));assert.throws(()=>importDeck('MATH1:'+JSON.stringify({...d,ids:Array(30).fill('rabbit')})));
  assert.equal(validateDeck([...ids.slice(0,29),'constructor']),false);assert.deepEqual(loadProfile(null,['__proto__','constructor','rabbit']).decks[0].ids,['rabbit']);
  ids[0]='eulerhero';assert.equal(validateDeck(ids,HEROES[0].id),false);assert.ok(validateDeck(ids,HEROES[1].id));ids[1]='eulerhero';assert.equal(validateDeck(ids,HEROES[1].id),false);
});
test('concede records a match once; unknown actions leave state untouched',()=>{
  const s=game(),profile=loadProfile(null);const old=structuredClone(s);assert.equal(applyAction(s,0,{type:'wat'}),false);assert.deepEqual(s,old);assert.ok(applyAction(s,0,{type:'concede'}));assert.equal(s.winner,1);assert.ok(recordMatch(profile,s));assert.equal(recordMatch(profile,s),false);assert.equal(profile.history.length,1);
});
test('AI completes the expansion preset and resolves discovery without stalling',()=>{
  for(const seed of [7,91,301]){const s=createGame(deckFor(0),seed,deckFor(0));mulligan(s);let n=0;while(s.phase!=='over'&&n++<1000){const a=chooseAI(s);assert.ok(applyAction(s,s.current,a));for(const p of s.players){assert.ok(p.hand.length<=10);assert.ok(p.board.length<=13);assert.ok(p.board.every(m=>m.hp>0&&m.attack>=0));}}assert.equal(s.phase,'over');}
});
