import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,BY_ID} from '../src/cards.js';
import {createGame,deckFor,validateDeck,mulligan,summon,play,attack,endTurn,damage,settle,capacity,targetsFor,canPlay,canAttack,chooseAI,applyAction,legalActions,draw} from '../src/engine.js';
function setup(){const s=createGame(deckFor(0),120,deckFor(2),{first:0});mulligan(s);s.players.forEach(p=>{p.hand=[];p.board=[];p.mana=30;p.maxMana=10;p.hp=20;p.armor=6;p.grave=['cat','fly','tomb'];});return s;}
function give(s,id,p=0){const c={id,uid:++s.serial,cost:BY_ID[id].cost};s.players[p].hand.push(c);return c;}
function cast(s,id,target=null){const c=give(s,id);assert.equal(play(s,0,c.uid,target),true,id);}
function invariants(s){const uids=[];for(const p of s.players){assert.ok(p.hand.length<=10);assert.ok(p.board.length<=13);assert.ok(Number.isFinite(p.hp));assert.ok(p.mana>=0);for(const m of p.board){assert.ok(m.hp>0);assert.ok(m.maxHp>=m.hp);assert.ok(m.attack>=0);uids.push(m.uid);}uids.push(...p.hand.map(c=>c.uid));}assert.equal(new Set(uids).size,uids.length);}
test('214 unique playable cards, each has separate ability and flavor text',()=>{assert.equal(CARDS.length,214);assert.equal(new Set(CARDS.map(c=>c.id)).size,214);for(const c of CARDS){assert.ok(c.text.length>8);assert.ok(c.flavor);assert.notEqual(c.text,c.flavor);}assert.ok(validateDeck(deckFor(0)));assert.equal(validateDeck(Array(30).fill('rabbit')),false);});
for(const c of CARDS)test(`card executes: ${c.name}`,()=>{
  const s=setup();for(let p=0;p<2;p++){summon(s,p,'cat');summon(s,p,'turtle');summon(s,p,'fly');}
  if(c.id==='diagonal')give(s,'cat',1);
  if(c.target==='function'){summon(s,0,'bridgekeeper',{formula:[{n:1,d:1,p:1},{n:2,d:1,p:0}],functionX:1,functionValue:3,attack:3});summon(s,0,'bridgekeeper');}
  const hand=give(s,c.id);const targets=targetsFor(s,0,hand);assert.ok(canPlay(s,0,hand));assert.ok(play(s,0,hand.uid,targets[0]??null));invariants(s);
  if(s.phase==='play'){endTurn(s,0);invariants(s);if(s.phase==='play'){endTurn(s,1);invariants(s);}}
});
test('Taylor copies exact current stats, keywords, ongoing ability and its progress; no battlecry',()=>{
  const s=setup(),rabbit=summon(s,1,'rabbit');Object.assign(rabbit,{attack:9,hp:8,maxHp:11,shield:true,taunt:true,previous:2,next:3});cast(s,'taylor',rabbit.uid);
  const copy=s.players[0].board[0];for(const k of ['attack','hp','maxHp','shield','taunt','ability','previous','next'])assert.equal(copy[k],rabbit[k],k);
  assert.notEqual(copy.uid,rabbit.uid);endTurn(s,0);assert.equal(s.players[0].board.length,4);assert.equal(rabbit.next,3);
  const t=setup();summon(t,0,'fly');const barber=summon(t,1,'barber');cast(t,'taylor',barber.uid);assert.equal(t.players[0].board.length,2);assert.equal(t.players[1].board.length,1);
});
test('copied deathrattle and silenced state are preserved',()=>{
  const s=setup(),cat=summon(s,1,'cat');cast(s,'taylor',cat.uid);damage(s,s.players[0].board[0].uid,99);settle(s);assert.equal(s.players[0].hand.at(-1).id,'cat');
  const silent=summon(s,1,'monster',{silenced:true,ability:null,taunt:false});cast(s,'taylor',silent.uid);const copy=s.players[0].board[0];assert.equal(copy.silenced,true);damage(s,copy.uid,4);assert.equal(copy.hp,3);
});
test('hotel adds three actual board slots; removing it does not evict existing minions',()=>{
  const s=setup(),hotel=summon(s,0,'hotel');for(let i=0;i<9;i++)summon(s,0,'fly');assert.equal(capacity(s,0),10);assert.equal(s.players[0].board.length,10);assert.equal(summon(s,0,'fly'),null);
  hotel.hp=0;settle(s);assert.equal(capacity(s,0),7);assert.equal(s.players[0].board.length,9);assert.equal(summon(s,0,'fly'),null);
});
test('hotel copied by Taylor expands its new owners board',()=>{const s=setup(),hotel=summon(s,1,'hotel');cast(s,'taylor',hotel.uid);assert.equal(capacity(s,0),10);endTurn(s,0);assert.equal(s.players[0].board.length,3);});
test('Fibonacci spawns 1, 1, 2, 3, 5; newborns do not recursively reproduce',()=>{
  const s=setup(),r=summon(s,0,'rabbit');for(const n of [1,1,2,3,5]){s.current=0;s.players[0].board=[r];endTurn(s,0);assert.equal(s.players[0].board.length-1,n);}
});
test('taunt, summoning sickness, shield and damage caps',()=>{
  const s=setup(),attacker=summon(s,0,'golem',{asleep:false,shield:false}),guard=summon(s,1,'turtle');assert.equal(attack(s,0,attacker.uid,'hero1'),false);assert.equal(attack(s,0,attacker.uid,guard.uid),true);assert.equal(guard.hp,2);assert.equal(canAttack(s,0,attacker.uid),false);
  const shield=summon(s,1,'snail');damage(s,shield.uid,100);assert.equal(shield.hp,5);assert.equal(shield.shield,false);
  const monster=summon(s,1,'monster');damage(s,monster.uid,100);assert.equal(monster.hp,6);
  const sleepy=summon(s,0,'rabbit');assert.equal(canAttack(s,0,sleepy.uid),false);
});
test('invalid targets and insufficient mana never consume cards or mana',()=>{
  const s=setup(),c=give(s,'triangle');const before=structuredClone(s);assert.equal(play(s,0,c.uid,'hero1'),false);assert.deepEqual(s,before);s.players[0].mana=0;assert.equal(play(s,0,c.uid),false);assert.equal(s.players[0].hand.length,1);
});
test('circle bounces normal cards and tokens without deathrattles, tokens can be replayed',()=>{
  const s=setup();s.current=1;give(s,'carpet',1);play(s,1,s.players[1].hand[0].uid);s.current=0;summon(s,1,'tomb');cast(s,'circle');assert.equal(s.players[1].board.length,0);assert.equal(s.players[1].hand.length,5);
  const c=s.players[1].hand[0];s.current=1;assert.equal(play(s,1,c.uid),true);assert.equal(s.players[1].board[0].taunt,true);invariants(s);
});
test('zero division bypasses deathrattles and armor absorbs damage',()=>{const s=setup();summon(s,1,'tomb');cast(s,'zeroDivide');assert.equal(s.players[1].board.length,0);assert.equal(s.players[0].armor,1);assert.equal(s.players[0].hp,20);});
test('domino repeats only after a kill; deathrattle minions participate in later waves',()=>{const s=setup();summon(s,1,'fly');const cat=summon(s,1,'cat');cast(s,'domino');assert.equal(s.players[1].board.length,0);assert.ok(s.players[1].hand.some(c=>c.id==='cat'));});
test('weapon gives exactly three attacks and does not refresh already-used attack',()=>{const s=setup();cast(s,'sword');for(let i=0;i<3;i++){s.current=0;s.players[0].heroAttacked=false;assert.ok(attack(s,0,'hero0','hero1'));assert.equal(attack(s,0,'hero0','hero1'),false);}assert.equal(s.players[0].weapon,null);});
test('fatigue increases and declares draw when both heroes die simultaneously',()=>{const s=setup();s.players[0].deck=[];s.players[0].armor=0;draw(s,0);draw(s,0);assert.equal(s.players[0].hp,17);s.players.forEach(p=>{p.hp=3;p.armor=0;});cast(s,'zeroDivide');assert.equal(s.winner,'draw');});
test('death triggers are removed together before resolving summons',()=>{const s=setup();for(let i=0;i<7;i++)summon(s,0,'tomb');s.players[0].board.forEach(m=>m.hp=0);settle(s);assert.equal(s.players[0].board.length,7);assert.ok(s.players[0].board.every(m=>m.attack===6));});
test('AI completes seeded matches using legal actions and all 100-card randomized pools',()=>{
  for(let n=0;n<12;n++){
    const mixed=offset=>Array.from({length:15},(_,i)=>CARDS[(offset+i*7)%100].id).flatMap(id=>[id,id]);
    const s=createGame(n<3?deckFor(n):mixed(n*3),300+n,n<3?deckFor((n+1)%3):mixed(n*3+17));mulligan(s);
    let count=0;while(s.phase!=='over'&&count++<1400){const a=chooseAI(s);assert.ok(legalActions(s).some(x=>JSON.stringify(x)===JSON.stringify(a)));assert.ok(applyAction(s,s.current,a));invariants(s);}
    assert.equal(s.phase,'over',`match ${n} stalled after ${count} actions`);
  }
});
