import test from 'node:test';
import assert from 'node:assert/strict';
import {COIN} from '../src/heroes.js';
import {BY_ID} from '../src/cards.js';
import {createGame,deckFor,mulligan,summon,play,usePower,canPower,powerTargets,endTurn,damage,canAttack,chooseAI,applyAction,legalActions} from '../src/engine.js';
function game(hero=0){const s=createGame(deckFor(0),210,deckFor(1),{first:0,heroes:[hero,1]});mulligan(s);s.players.forEach(p=>{p.hand=[];p.mana=10;p.maxMana=10;});return s;}
function give(s,id,p=0){const c={id,uid:++s.serial,cost:BY_ID[id].cost};s.players[p].hand.push(c);return c;}

test('random start supports both seats; second player gets four cards and an uncollectible coin after mulligan',()=>{
  const starts=new Set();
  for(const seed of [1,10000,100000])starts.add(createGame(deckFor(0),seed).first);
  assert.equal(starts.size,2);
  for(const first of [0,1]){
    const s=createGame(deckFor(0),55,deckFor(1),{first});
    assert.deepEqual(s.players.map(p=>p.hand.length),first===0?[3,4]:[4,3]);
    assert.ok(!s.players.some(p=>p.hand.some(c=>c.id===COIN.id)));
    const replaced=s.players[0].hand[0].uid;assert.ok(mulligan(s,[replaced]));
    assert.equal(s.current,first);assert.equal(s.players[first].mana,1);
    assert.equal(s.players[first].hand.length,4);assert.equal(s.players[1-first].hand.length,5);
    assert.equal(s.players[1-first].hand.filter(c=>c.id===COIN.id).length,1);
    assert.ok(!s.players[0].hand.some(c=>c.uid===replaced));
    const old=structuredClone(s);assert.equal(mulligan(s),false);assert.deepEqual(s,old);
  }
});
test('coin gives one temporary mana without increasing next turn maximum',()=>{
  const s=game(),p=s.players[0];p.mana=1;p.maxMana=1;
  const c={id:COIN.id,uid:++s.serial,cost:0,blueprint:COIN};p.hand.push(c);
  assert.ok(play(s,0,c.uid));assert.equal(p.mana,2);assert.equal(p.maxMana,1);assert.equal(p.temporaryMana,1);
  endTurn(s,0);assert.equal(p.temporaryMana,0);endTurn(s,1);assert.equal(p.maxMana,2);assert.equal(p.mana,2);
});
test('hero power consumes two mana, is once per turn, and refreshes only on its owners turn',()=>{
  const s=game(),m=summon(s,0,'cat');assert.ok(usePower(s,0,m.uid));assert.equal(s.players[0].mana,8);assert.equal(m.attack,1);
  const old=structuredClone(s);assert.equal(usePower(s,0),false);assert.deepEqual(s,old);
  endTurn(s,0);assert.equal(canPower(s,0),false);endTurn(s,1);assert.ok(canPower(s,0));
  s.players[0].mana=1;assert.equal(canPower(s,0),false);
});
test('differentiation targets minions on both sides and rejects heroes without spending',()=>{
  const s=game(1),m=summon(s,0,'rabbit');assert.ok(powerTargets(s,0).includes(m.uid));
  const old=structuredClone(s);assert.equal(usePower(s,0,99999),false);assert.deepEqual(s,old);
  assert.ok(usePower(s,0,m.uid));assert.equal(m.attack,0);assert.equal(m.hp,3);
  const t=game(1),f=summon(t,1,'marginscribe');assert.equal(usePower(t,0,'hero1'),false);assert.ok(usePower(t,0,f.uid));assert.equal(f.attack,3);
});
test('circle power uses the actual minion count and ignores locations',()=>{
  const s=game(2);assert.equal(canPower(s,0),false);summon(s,0,'fly');summon(s,0,'cat');summon(s,0,'observatory');assert.ok(usePower(s,0));assert.equal(s.players[0].armor,12);
  const t=game(),m=summon(t,1,'token',{attack:6,hp:9,maxHp:9});assert.ok(usePower(t,0,m.uid));assert.deepEqual([m.attack,m.hp],[3,3]);
});
test('position controls adjacency and invalid positions never spend a card',()=>{
  const s=game(),left=summon(s,0,'token',{attack:4}),right=summon(s,0,'token',{attack:4}),c=give(s,'pascaltriangle');
  for(const invalid of [-1,3,1.5]){const old=structuredClone(s);assert.equal(play(s,0,c.uid,null,invalid),false);assert.deepEqual(s,old);}
  assert.ok(play(s,0,c.uid,null,1));assert.deepEqual(s.players[0].board.map(m=>m.id),['token','pascaltriangle','token']);
  endTurn(s,0);assert.equal(left.attack,4);assert.equal(right.attack,4);assert.equal(s.players[0].board[1].attack,8);
});
test('targeted copy is inserted at the chosen position and preserves copied behavior',()=>{
  const s=game(),cat=summon(s,1,'cat');summon(s,0,'rabbit');const c=give(s,'taylor');
  assert.ok(play(s,0,c.uid,cat.uid,0));assert.equal(s.players[0].board[0].ability,'cat');assert.equal(s.players[0].board[1].id,'rabbit');
});
test('silence removes buffs without healing damage; transformed tokens keep their new base stats',()=>{
  const s=game(),m=summon(s,1,'cat');let c=give(s,'exponential',1);s.current=1;assert.ok(play(s,1,c.uid,m.uid));s.current=0;damage(s,m.uid,2);
  c=give(s,'zero');play(s,0,c.uid);assert.equal(m.attack,0);assert.equal(m.maxHp,3);assert.equal(m.hp,3);assert.equal(m.ability,null);
  const t=game(),monster=summon(t,1,'monster');c=give(t,'cantordust');play(t,0,c.uid,monster.uid);
  assert.equal(monster.hp,1);assert.equal(monster.attack,1);assert.equal(monster.maxHp,1);assert.equal(monster.taunt,false);
  const u=game(),hurt=summon(u,1,'cat');damage(u,hurt.uid,2);c=give(u,'zero');play(u,0,c.uid);assert.equal(hurt.hp,1);
});
test('charge removed during its summon turn cannot attack, but recovers next turn',()=>{
  const s=game(),fly=summon(s,1,'fly');const c=give(s,'zero');play(s,0,c.uid);s.current=1;
  assert.equal(canAttack(s,1,fly.uid),false);
  // Restore positive attack to isolate summoning sickness from zero attack.
  fly.attack=2;assert.equal(canAttack(s,1,fly.uid),false);endTurn(s,1);endTurn(s,0);assert.equal(canAttack(s,1,fly.uid),true);
});
test('AI sees coin into lethal as a sequence and exposes placement and power actions',()=>{
  const s=game(2);s.players[0].mana=0;s.players[0].maxMana=1;s.players[1].hp=3;
  s.players[0].hand.push({id:COIN.id,uid:++s.serial,cost:0,blueprint:COIN});give(s,'needle');
  let action=chooseAI(s);assert.equal(s.players[0].hand.find(c=>c.uid===action.uid).id,COIN.id);assert.ok(applyAction(s,0,action));
  action=chooseAI(s);assert.equal(action.target,'hero1');assert.ok(applyAction(s,0,action));assert.equal(s.winner,0);
  const t=game();summon(t,0,'cat');give(t,'rabbit');assert.deepEqual(legalActions(t).filter(a=>a.type==='play').map(a=>a.position),[0,1]);assert.ok(legalActions(t).some(a=>a.type==='power'));
});
