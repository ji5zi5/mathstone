import test from 'node:test';
import assert from 'node:assert/strict';
import {BY_ID} from '../src/cards.js';
import {composeFormula,evaluateFormula,formatFormula} from '../src/math.js';
import {createGame,deckFor,mulligan,summon,play,settle,damage,attack,canAttack,usePower,endTurn,targetsFor,redistribute,canRedistribute,applyAction,legalActions} from '../src/engine.js';
const terms=(...pairs)=>pairs.map(([n,p,d=1])=>({n,p,d}));
function setup(){const s=createGame(deckFor(9),900,deckFor(5),{first:0});mulligan(s);s.players.forEach(p=>Object.assign(p,{hand:[],board:[],mana:100,maxMana:10,hp:30,armor:0}));return s;}
function token(s,a,h=20,p=0){return summon(s,p,'token',{attack:a,hp:h,maxHp:h,asleep:false});}
function give(s,id){const c={id,uid:++s.serial,cost:0};s.players[0].hand.push(c);return c;}
function cast(s,id,key=null,position=s.players[0].board.length){assert.ok(play(s,0,give(s,id).uid,key,position),id);return s.players[0].board[position];}
function fn(s,f,x=1){const a=Math.floor(evaluateFormula(f,x));return summon(s,0,'bridgekeeper',{formula:f,functionX:x,functionValue:a,attack:a});}

test('triangle reacts to changes, movement, death and zero inputs',()=>{
 const s=setup(),a=token(s,3),b=token(s,4),c=cast(s,'pythagoras-person',null,1);
 assert.equal(c.attack,5);assert.deepEqual(c.relation.inputs,[a.uid,b.uid]);
 cast(s,'exponential',a.uid);assert.equal(c.attack,7);
 s.players[0].board.reverse();settle(s);assert.equal(c.attack,7);
 damage(s,b.uid,99);settle(s);assert.equal(c.attack,6);
 damage(s,a.uid,99);settle(s);assert.equal(c.attack,0);
});
test('Pascal and Pythagoras form a dependency chain independent of board order',()=>{
 const s=setup(),a=token(s,3),b=token(s,4),triangle=cast(s,'pythagoras-person',null,1),pascal=cast(s,'pascal-person',null,2);
 assert.equal(pascal.attack,9);cast(s,'exponential',a.uid);assert.equal(triangle.attack,7);assert.equal(pascal.attack,11);
 s.players[0].board.reverse();settle(s);assert.equal(pascal.attack,11);
 const restored=JSON.parse(JSON.stringify(s));restored.players[0].board.find(m=>m.uid===b.uid).attack=0;settle(restored);assert.equal(restored.players[0].board.find(m=>m.uid===pascal.uid).attack,6);
});
test('Taylor copies a relation and silence removes only the copied binding',()=>{
 const s=setup(),a=token(s,3);token(s,4);const m=cast(s,'pythagoras-person',null,1);cast(s,'taylor',m.uid);const copy=s.players[0].board.at(-1);
 assert.deepEqual(copy.relation,m.relation);assert.notEqual(copy.uid,m.uid);cast(s,'exponential',a.uid);assert.equal(copy.attack,7);
 s.players[0].board=s.players[0].board.filter(x=>x!==copy);s.players[1].board.push(copy);cast(s,'contradiction',copy.uid);assert.equal(copy.relation,undefined);assert.equal(copy.attack,0);assert.equal(m.attack,7);
});
test('equation blocks attacks, gcd solves it, damage breaks it again',()=>{
 const s=setup(),m=token(s,6,9,1);cast(s,'khwarizmi-person',m.uid);s.current=1;
 assert.equal(canAttack(s,1,m.uid),false);const before=structuredClone(s);assert.equal(attack(s,1,m.uid,'hero0'),false);assert.deepEqual(s,before);
 s.players[1].hero='euclid';assert.ok(usePower(s,1,m.uid));assert.deepEqual([m.attack,m.hp],[3,3]);assert.ok(canAttack(s,1,m.uid));
 damage(s,m.uid,1);settle(s);assert.equal(canAttack(s,1,m.uid),false);
 s.current=0;cast(s,'contradiction',m.uid);assert.equal(m.attackEquation,undefined);
});
test('an equal-stats attack is checked before combat and copied seals persist',()=>{
 const s=setup(),m=token(s,4,4,1);cast(s,'khwarizmi-person',m.uid);cast(s,'taylor',m.uid);assert.equal(s.players[0].board.at(-1).attackEquation,'equalStats');
 const defender=token(s,1,10);s.current=1;assert.ok(attack(s,1,m.uid,defender.uid));assert.equal(m.hp,3);assert.equal(defender.hp,6);
});
test('Noether activation preserves attack sum, excludes bound values and resets next own turn',()=>{
 const s=setup(),a=token(s,8),b=token(s,4),noether=summon(s,0,'conservation'),sum=s.players[0].board.reduce((n,m)=>n+m.attack,0);
 assert.ok(legalActions(s).some(x=>x.type==='redistribute'));assert.ok(applyAction(s,0,{type:'redistribute',uid:noether.uid,target:a.uid}));
 assert.equal(a.attack,0);assert.equal(noether.attack,11);assert.equal(s.players[0].board.reduce((n,m)=>n+m.attack,0),sum);assert.equal(canRedistribute(s,0,noether.uid),false);
 endTurn(s,0);endTurn(s,1);assert.ok(canRedistribute(s,0,noether.uid));s.players[0].mana=100;
 const tri=cast(s,'pythagoras-person',null,1);const before=structuredClone(s);assert.equal(redistribute(s,0,noether.uid,tri.uid),false);assert.deepEqual(s,before);
 assert.ok(redistribute(s,0,noether.uid,b.uid));
});
test('Noether does not move auras or activate after silence',()=>{
 const s=setup(),donor=token(s,8),n=summon(s,0,'conservation');summon(s,0,'choir');const before=donor.attack+n.attack;
 assert.ok(redistribute(s,0,n.uid,donor.uid));assert.equal(donor.attack,1);assert.equal(donor.attack+n.attack,before);
 s.players[0].board=s.players[0].board.filter(x=>x!==n);s.players[1].board.push(n);cast(s,'contradiction',n.uid);s.current=1;assert.equal(canRedistribute(s,1,n.uid),false);
});
test('input movement changes evaluation without changing the expression and cannot go below zero',()=>{
 const s=setup(),m=fn(s,terms([1,2]));cast(s,'input-forward',m.uid);assert.equal(m.attack,4);cast(s,'input-back',m.uid);assert.equal(m.attack,1);cast(s,'input-back',m.uid);assert.equal(m.attack,0);
 const c=give(s,'input-back'),before=structuredClone(s);assert.equal(play(s,0,c.uid,m.uid),false);assert.deepEqual(s,before);assert.equal(formatFormula(m.formula),'x²');
});
test('composition is ordered, exact for fractions, and rejects unsupported growth',()=>{
 const f=terms([1,2]),g=terms([1,1],[1,0]);assert.equal(formatFormula(composeFormula(f,g)),'x² +2x +1');assert.equal(formatFormula(composeFormula(g,f)),'x² +1');
 const result=composeFormula(terms([1,2,2]),terms([1,1],[1,0,2]));for(const x of [0,1,2,4])assert.equal(evaluateFormula(result,x),.5*(x+.5)**2);
 assert.equal(composeFormula(terms([1,16]),terms([1,2])),null);
 assert.equal(composeFormula(terms([Number.MAX_SAFE_INTEGER,2]),terms([2,1])),null);
});
test('compose-left selects only a function with a valid function on its left',()=>{
 const s=setup(),g=fn(s,terms([1,1],[1,0])),f=fn(s,terms([1,2])),c=give(s,'compose-left');
 assert.deepEqual(targetsFor(s,0,c),[f.uid]);assert.ok(play(s,0,c.uid,f.uid));assert.equal(formatFormula(f.formula),'x² +2x +1');assert.equal(f.attack,4);assert.equal(formatFormula(g.formula),'x +1');
 cast(s,'newtonstep',g.uid);assert.equal(formatFormula(f.formula),'x² +2x +1');
});
test('splitting a constant removes precisely that term and summons its value',()=>{
 const s=setup(),m=fn(s,terms([2,2],[7,0]),2);cast(s,'split-constant',m.uid);assert.equal(formatFormula(m.formula),'2x²');assert.equal(m.attack,8);const spirit=s.players[0].board.at(-1);assert.deepEqual([spirit.attack,spirit.hp],[7,7]);
 const c=give(s,'split-constant'),before=structuredClone(s);assert.equal(play(s,0,c.uid,m.uid),false);assert.deepEqual(s,before);
});
test('constant split requires space and cannot consume a fractional constant',()=>{
 const s=setup(),m=fn(s,terms([1,1],[1,0,2])),c=give(s,'split-constant');assert.deepEqual(targetsFor(s,0,c),[]);
 m.formula=terms([1,1],[2,0]);while(s.players[0].board.length<7)token(s,1);assert.deepEqual(targetsFor(s,0,c),[]);assert.equal(play(s,0,c.uid,m.uid),false);
});
