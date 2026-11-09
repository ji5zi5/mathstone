import test from 'node:test';
import assert from 'node:assert/strict';
import {BY_ID} from '../src/cards.js';
import {createGame,deckFor,mulligan,summon,play,choose,chooseAI,applyAction,endTurn,damage,settle,canPlay,targetsFor,attack,hanoiMove,usePower,legalActions} from '../src/engine.js';
import {updateFormula,differentiate,integrate,shiftFormula,addConstant} from '../src/math.js';
import {riemannSum,walkAnt,voronoiCells,amplifyFrequency,hanoiMoves,nextHanoiMove} from '../src/math-mechanics.js';
import {mathPanel} from '../src/math-display.js';
import {RoomService} from '../src/rooms-server.js';
const square=[{n:1,d:1,p:2}];
function game(){const s=createGame(deckFor(0),42,deckFor(2),{first:0});mulligan(s);s.players.forEach(p=>{p.hand=[];p.board=[];p.mana=100;p.maxMana=10;});return s;}
function give(s,id,p=0){const c={id,uid:++s.serial,cost:BY_ID[id].cost};s.players[p].hand.push(c);return c;}
function cast(s,id,key=null,p=0){assert.ok(play(s,p,give(s,id,p).uid,key),id);}
function unit(s,p,a=2,h=30){return summon(s,p,'token',{attack:a,hp:h,maxHp:h});}

test('implicit calculus and hero differentiation preserve input zero',()=>{
  for(const transform of [differentiate,integrate,shiftFormula,t=>addConstant(t,3)]){
    const m={formula:square,functionX:0,functionValue:0,attack:0};updateFormula(m,transform(square));assert.equal(m.functionX,0);
  }
  const s=game(),f=summon(s,0,'bridgekeeper');cast(s,'input-back',f.uid);cast(s,'newtonstep',f.uid);assert.equal(f.functionX,0);assert.equal(f.attack,0);
  s.players[0].hero='leibniz';assert.ok(usePower(s,0,f.uid));assert.equal(f.functionX,0);assert.equal(f.attack,2);
});
test('full healing reaches max health even when the missing amount exceeds 99',()=>{
  const s=game(),m=summon(s,0,'brouwer');for(let i=0;i<6;i++)cast(s,'exponential',m.uid);assert.equal(m.maxHp,384);damage(s,m.uid,120);endTurn(s,0);assert.equal(m.hp,384);
});
test('surge uses the derivative at the current input and expires without changing the function',()=>{
  const s=game(),f=summon(s,0,'bridgekeeper');updateFormula(f,square,3);cast(s,'surge',f.uid);assert.equal(f.attack,15);assert.equal(f.tempAttack,6);assert.deepEqual(f.formula,square);assert.equal(f.functionX,3);endTurn(s,0);assert.equal(f.attack,9);
  s.current=0;s.players[0].mana=100;updateFormula(f,square,0);cast(s,'surge',f.uid);assert.equal(f.attack,0);assert.equal(f.functionX,0);
});
test('quadrature weapon uses 1, 2, 4 right rectangles and no longer deals splash damage',()=>{
  assert.deepEqual([1,2,4].map(n=>riemannSum(square,2,n).area),[8,5,3.75]);
  const s=game(),f=summon(s,0,'bridgekeeper'),enemy=unit(s,1);updateFormula(f,square,2);cast(s,'sword');
  for(const [parts,atk] of [[1,8],[2,5],[4,3]]){s.players[0].heroAttacked=false;assert.equal(s.players[0].weapon.attack,atk);assert.equal(s.players[0].weapon.quadrature.parts,parts);assert.ok(attack(s,0,'hero0','hero1'));assert.equal(enemy.hp,30);}
  assert.equal(s.players[0].weapon,null);cast(s,'sword');cast(s,'contradiction',enemy.uid);damage(s,f.uid,99);settle(s);assert.equal(s.players[0].weapon.attack,4);
});
test('Markov transitions use current parity and wrap around the current enemy row',()=>{
  const run=(a,seed)=>{const s=game(),row=[unit(s,1,a),unit(s,1,2),unit(s,1,2)];s.seed=seed;cast(s,'chain',row[0].uid);return {s,row,hit:s.events.filter(e=>e.kind==='damage').map(e=>e.key)};};
  // Seed 1000 gives a first draw between 1/4 and 3/4, separating the two kernels.
  const even=run(2,1000),odd=run(3,1000);assert.equal(even.hit[1],even.row[1].uid);assert.equal(odd.hit[1],odd.row[2].uid);assert.equal(even.hit.length,4);assert.equal(even.row.reduce((n,m)=>n+30-m.hp,0),12);
  assert.deepEqual(run(2,1000).hit,even.hit);
});
test('squeeze narrows at target turns, overrides buffs, and silence releases the bounds',()=>{
  const s=game();unit(s,0,2);unit(s,0,10);const m=unit(s,1,20);cast(s,'sandwich',m.uid);assert.equal(m.attack,10);assert.deepEqual(m.squeeze,{low:2,high:10,limit:6});
  endTurn(s,0);assert.deepEqual(m.squeeze,{low:4,high:8,limit:6});m.attack=99;settle(s);assert.equal(m.attack,8);
  endTurn(s,1);endTurn(s,0);assert.deepEqual(m.squeeze,{low:5,high:7,limit:6});endTurn(s,1);endTurn(s,0);assert.equal(m.attack,6);
  s.current=0;s.players[0].mana=100;cast(s,'contradiction',m.uid);assert.equal(m.squeeze,undefined);m.attack=20;settle(s);assert.equal(m.attack,20);
});
test('diagonal builds a differing binary witness and its generated spell actually resolves',()=>{
  const s=game(),empty=give(s,'diagonal');assert.equal(canPlay(s,0,empty),false);s.players[0].hand=[];
  for(const cost of [1,2,7,8]){const c=give(s,'cat',1);c.cost=cost;}
  cast(s,'diagonal');const c=s.players[0].hand[0],n=c.blueprint.effects[0].amount;assert.equal(n,0);assert.deepEqual(c.blueprint.diagonalWitness,[1,2,7,8]);
  c.blueprint.diagonalWitness.forEach((a,i)=>assert.notEqual((a>>i)&1,(n>>i)&1));assert.ok(play(s,0,c.uid,'hero1'));assert.equal(s.players[1].hp,30);
  s.players[1].hand.forEach(c=>c.cost=0);cast(s,'diagonal');const other=s.players[0].hand[0];assert.equal(other.blueprint.effects[0].amount,15);assert.ok(play(s,0,other.uid,'hero1'));assert.equal(s.players[1].hp,15);
});
test('discriminant maps negative, repeated and two real roots to distinct board effects',()=>{
  for(const [b,c,count] of [[2,2,0],[4,4,1],[6,4,2]]){const s=game();unit(s,0,1);unit(s,0,b);const enemy=summon(s,1,'rabbit',{hp:c,maxHp:c,attack:3});cast(s,'discriminant',enemy.uid);assert.equal(s.players[0].board.length,2+count);assert.equal(s.players[1].board[0],enemy);if(!count)assert.equal(enemy.attack,0);else assert.ok(s.players[0].board.slice(2).every(m=>m.ability==='rabbit'&&m.next===enemy.next));}
  const s=game();unit(s,0,0);unit(s,0,6);const e=unit(s,1,3,4),c=give(s,'discriminant');assert.equal(canPlay(s,0,c),false);s.players[0].board[0].attack=1;while(s.players[0].board.length<7)unit(s,0);assert.equal(canPlay(s,0,c),false);s.players[0].board[1].attack=2;assert.ok(canPlay(s,0,c));
});
test('Langton ant preserves its grid, position and direction through copies and saves',()=>{
  const first=walkAnt(undefined,1);assert.deepEqual(first,{x:1,y:0,direction:1,black:['0,0'],steps:1});const four=walkAnt();assert.deepEqual([four.x,four.y,four.direction,four.black.length],[0,0,0,4]);assert.deepEqual(walkAnt(four),walkAnt(undefined,8));
  let s=game();const ant=summon(s,0,'ant');endTurn(s,0);assert.equal(ant.attack,4);s.current=0;s.players[0].mana=100;cast(s,'taylor',ant.uid);assert.deepEqual(s.players[0].board[1].ant,ant.ant);s=JSON.parse(JSON.stringify(s));endTurn(s,0);assert.equal(s.players[0].board[0].ant.steps,8);assert.deepEqual(s.players[0].board[0].ant,s.players[0].board[1].ant);
  assert.match(mathPanel(s.players[0].board[0]),/ant-grid/);
});
test('Monty host never opens the prize and switching wins exactly two of three prize placements',()=>{
  for(const selected of [0,1,2]){let stay=0,swap=0;for(const prize of [0,1,2])for(const decision of [0,1]){const s=game();cast(s,'dilemma');s.choice.prize=prize;const before=structuredClone(s);assert.equal(choose(s,1,selected),false);assert.equal(choose(s,0,3),false);assert.deepEqual(s,before);assert.ok(choose(s,0,selected));assert.notEqual(s.choice.opened,selected);assert.notEqual(s.choice.opened,prize);assert.equal(endTurn(s,0),false);assert.ok(choose(s,0,decision));const car=s.players[0].board[0].attack===7;if(decision)swap+=car;else stay+=car;}assert.equal(stay,1);assert.equal(swap,2);}
});
test('Monty AI does not inspect the prize when choosing or switching',()=>{
  for(let prize=0;prize<3;prize++){const s=game();cast(s,'dilemma');s.choice.prize=prize;assert.deepEqual(chooseAI(s),{type:'choose',index:0});choose(s,0,0);assert.deepEqual(chooseAI(s),{type:'choose',index:1});}
});
test('constant ghost removes and restores C at x=0; copying carries the stored constant exactly',()=>{
  const s=game(),f=summon(s,0,'cauchywisp');cast(s,'input-back',f.uid);cast(s,'ghost',f.uid);const ghost=s.players[0].board[1];assert.equal(f.functionX,0);assert.equal(f.attack,0);assert.equal(ghost.constantStorage.value,2);assert.equal(targetsFor(s,0,give(s,'ghost')).length,0);cast(s,'taylor',ghost.uid);const copy=s.players[0].board[2];assert.deepEqual(copy.constantStorage,ghost.constantStorage);damage(s,ghost.uid,99);settle(s);assert.equal(f.attack,2);assert.equal(f.functionX,0);damage(s,copy.uid,99);settle(s);assert.equal(f.attack,4);assert.equal(f.functionX,0);
});
test('silencing a constant ghost cancels its return; missing target does not crash',()=>{
  for(const silence of [false,true]){const s=game(),f=summon(s,0,'cauchywisp');cast(s,'ghost',f.uid);const ghost=s.players[0].board[1];if(silence){s.current=1;cast(s,'contradiction',ghost.uid,1);}else damage(s,f.uid,99);damage(s,ghost.uid,99);settle(s);if(silence)assert.equal(f.attack,1);}
});
test('Voronoi territory follows distance, ties, current attack and surviving sites',()=>{
  assert.deepEqual(voronoiCells([2,6,10]),[[0,1,2,3,4],[5,6,7,8],[9,10,11,12]]);
  const s=game(),sites=[2,6,10].map(a=>unit(s,0,a));cast(s,'voronoi');assert.deepEqual(sites.map(m=>m.territoryCells.length),[5,4,4]);endTurn(s,0);assert.deepEqual(sites.map(m=>m.hp),[35,34,34]);sites[0].attack=6;settle(s);assert.deepEqual(sites.map(m=>m.territoryCells.length),[9,0,4]);damage(s,sites[0].uid,999);settle(s);assert.deepEqual(sites.slice(1).map(m=>m.territoryCells.length),[9,4]);
});
test('Hanoi validates moves, spends mana, survives saves and completes in seven AI moves',()=>{
  let s=game();cast(s,'hanoi');assert.equal(canPlay(s,0,give(s,'hanoi')),false);const before=structuredClone(s);for(const args of [[0,0],[1,2],[-1,2],[0,'2']])assert.equal(hanoiMove(s,0,...args),false);assert.equal(hanoiMove(s,1,0,2),false);assert.deepEqual(s,before);
  assert.ok(hanoiMove(s,0,0,2));const blocked=structuredClone(s);assert.equal(hanoiMove(s,0,0,2),false);assert.deepEqual(s,blocked);s=JSON.parse(JSON.stringify(s));let count=1;while(s.players[0].hanoi){const a=chooseAI(s);assert.equal(a.type,'hanoiMove');assert.ok(legalActions(s).some(x=>JSON.stringify(x)===JSON.stringify(a)));assert.ok(applyAction(s,0,a));assert.ok(++count<=7);}assert.equal(count,7);assert.equal(s.players[0].armor,49);assert.equal(s.players[0].mana,87);
  assert.equal(nextHanoiMove([[],[],[3,2,1]]),null);assert.equal(hanoiMoves([[3,2,1],[],[]]).length,2);
});
test('Hanoi rejects empty mana and pending choices without consuming progress',()=>{
  const s=game();cast(s,'hanoi');s.players[0].mana=0;assert.equal(hanoiMove(s,0,0,1),false);s.players[0].mana=100;cast(s,'dilemma');const before=structuredClone(s);assert.equal(hanoiMove(s,0,0,1),false);assert.deepEqual(s,before);
});
test('Fourier amplification doubles DC and alternating components, not every attack',()=>{
  assert.deepEqual(amplifyFrequency([2,4,2,4],0),[5,7,5,7]);assert.deepEqual(amplifyFrequency([2,4,2,4],1),[2,4,2,4]);assert.deepEqual(amplifyFrequency([2,4,2,4],2),[1,5,1,5]);assert.deepEqual(amplifyFrequency([],2),[]);assert.deepEqual(amplifyFrequency([3],2),[6]);
  const s=game(),row=[2,4,2,4].map(a=>unit(s,0,a));cast(s,'amplifier');assert.equal(s.choice.kind,'frequency');choose(s,0,2);const amp=s.players[0].board.at(-1);assert.equal(amp.frequency,2);assert.equal(amp.spellDamage,0);endTurn(s,0);assert.deepEqual(row.map(m=>m.attack),[1,5,1,5]);assert.equal(amp.attack,2);
});
test('online snapshots hide the prize from every seat and timer completes both choices',()=>{
  const service=new RoomService(),host=service.create({deck:deckFor(0),hero:0}),guest=service.join(host.code,{deck:deckFor(2),hero:2}),r=service.rooms.get(host.code);r.game=game();cast(r.game,'dilemma');
  for(const token of [host.token,guest.token,undefined])assert.equal(service.snapshot(host.code,token).state.choice.prize,undefined);
  service.act(host.code,host.token,{type:'choose',index:0});assert.equal(service.snapshot(host.code,host.token).state.choice.kind,'monty-switch');assert.equal(service.snapshot(host.code,host.token).state.choice.prize,undefined);
  r.game.deadline=Date.now()-1;const turn=r.game.turn;service.snapshot(host.code,host.token);assert.equal(r.game.choice,null);assert.equal(r.game.turn,turn+1);
  r.game=game();cast(r.game,'dilemma');r.game.deadline=Date.now()-1;service.snapshot(host.code,host.token);assert.equal(r.game.choice,null);assert.equal(r.game.current,1);
});
