import test from 'node:test';
import assert from 'node:assert/strict';
import {BY_ID,CARDS} from '../src/cards.js';
import {IDENTITY_REWORK} from '../src/identity-cards.js';
import {createGame,deckFor,mulligan,summon,play,endTurn,damage,settle,usePower,canAttack,targetsFor,random,refreshAuras,redistribute} from '../src/engine.js';
import {mathPanel,displayRules} from '../src/math-display.js';
import {orientState} from '../src/network.js';

function game(){const s=createGame(deckFor(0),123,deckFor(0),{first:0});mulligan(s);for(const p of s.players){p.hand=[];p.board=[];p.mana=100;p.maxMana=10;p.armor=0;p.hp=1000;p.deck=Array(30).fill('fly');}return s;}
function give(s,id,p=0){const c={id,uid:++s.serial,cost:0};s.players[p].hand.push(c);return c;}
function cast(s,id,key=null,p=0){s.current=p;const c=give(s,id,p);assert.ok(play(s,p,c.uid,key),id);return s.players[p].board.at(-1);}
function unit(s,p,a,h=30){return summon(s,p,'token',{attack:a,hp:h,maxHp:h});}
function finish(s,p=0){s.current=p;assert.ok(endTurn(s,p));}
function next(s){finish(s,0);finish(s,1);}

test('reworked definitions and displayed rules use the same executable card record',()=>{
  for(const [id,patch] of Object.entries(IDENTITY_REWORK)){assert.equal(BY_ID[id].text,patch.text);assert.equal(displayRules(BY_ID[id]),patch.text);assert.ok(BY_ID[id].mathNote);}
  assert.equal(CARDS.length,214);
});
test('nondifferentiable monster doubles on differentiation; silence removes the response',()=>{
  const s=game();s.players[0].hero='leibniz';const m=summon(s,1,'monster');const a=m.attack;assert.ok(usePower(s,0,m.uid));assert.equal(m.attack,2*a);
  const own=summon(s,0,'monster');cast(s,'newtonstep',own.uid);assert.equal(own.attack,2*a);
  cast(s,'contradiction',m.uid);s.players[0].powerUsed=false;assert.ok(usePower(s,0,m.uid));assert.equal(m.attack,0);
});
test('Zeno halves remaining health, reaches one, blocks zero-damage poison, but not spells',()=>{
  const s=game(),m=summon(s,1,'turtle');const hp=[];for(let i=0;i<5;i++){damage(s,m.uid,100,{p:0});hp.push(m.hp);}assert.deepEqual(hp,[4,2,1,1,1]);
  damage(s,m.uid,100,{p:0,poisonous:true});assert.equal(m.hp,1);damage(s,m.uid,1);settle(s);assert.ok(!s.players[1].board.includes(m));
});
test('Maxwell transfers one without creating attack and skips empty donors',()=>{
  const s=game(),m=summon(s,0,'maxwell'),cold=unit(s,0,1),hot=unit(s,1,8);finish(s);assert.equal(hot.attack,7);assert.equal(cold.attack,2);
  hot.attack=0;finish(s);assert.equal(cold.attack,2);assert.ok(m.hp>0);
});
test('cat map uses simultaneous coordinates modulo eleven including health residue zero',()=>{
  const s=game(),m=summon(s,0,'cat',{attack:5,hp:3,maxHp:3});finish(s);assert.deepEqual([m.attack,m.hp],[8,11]);
  finish(s);assert.deepEqual([m.attack,m.hp],[8,8]);assert.match(mathPanel(m),/mod 11/);
});
test('limacon samples and Mersenne exponents continue across owner turns only',()=>{
  const s=game(),snail=summon(s,0,'snail'),monk=summon(s,0,'monk'),r=[],a=[];
  for(let i=0;i<4;i++){next(s);r.push(snail.attack);a.push(monk.attack);}assert.deepEqual(r,[5,3,1,3]);assert.deepEqual(a,[1,3,7,15]);
});
test('Agnesi falloff follows distance from left center and ignores locations',()=>{
  const s=game();summon(s,0,'witch');const row=[0,0,0,0,0].map(a=>unit(s,1,a));summon(s,1,'observatory');cast(s,'polygon');assert.deepEqual(row.map(m=>30-m.hp),[1,4,8,4,1]);assert.equal(s.players[1].hp,1000);
});
test('Gabriel finite volume approaches three while surface damage keeps increasing',()=>{
  const s=game(),m=summon(s,0,'horn');finish(s);assert.equal(m.identityState.length,2);assert.equal(s.players[0].armor,1);assert.equal(s.players[1].hp,996);
  finish(s);assert.equal(s.players[0].armor,3);assert.equal(s.players[1].hp,988);finish(s);assert.equal(s.players[0].armor,5);assert.equal(s.players[1].hp,975);
});
test('Klein swaps simultaneous rows, leaves locations and never drops pieces at the absolute cap',()=>{
  const s=game(),a=unit(s,0,2),b=unit(s,1,4),l=summon(s,0,'observatory');cast(s,'bottle');assert.deepEqual(s.players[0].board.map(m=>m.uid),[l.uid,b.uid]);assert.deepEqual(s.players[1].board.map(m=>m.uid),[a.uid]);assert.equal(b.asleep,true);
  const t=game();for(let p=0;p<2;p++){summon(t,p,'hotel');summon(t,p,'hotel');for(let i=0;i<11;i++)summon(t,p,i<3+p?'observatory':'fly');}
  const all=t.players.flatMap(p=>p.board.map(m=>m.uid)).sort((a,b)=>a-b);cast(t,'bottle');assert.ok(t.players.every(p=>p.board.length<=13));assert.deepEqual(t.players.flatMap(p=>p.board.map(m=>m.uid)).sort((a,b)=>a-b),all);
});
test('Napier adds decimal digits of the product, including large non-exponential products',()=>{
  const s=game(),m=unit(s,0,7,8);cast(s,'bones',m.uid);assert.equal(m.attack,18);
  const big=unit(s,0,1e12,1e12);cast(s,'bones',big.uid);assert.equal(big.attack,1e12+1);
});
test('Buffon draws twelve geometric crossings deterministically',()=>{
  const s=game(),copy=structuredClone(s);let hits=0;for(let i=0;i<12;i++){const theta=random(copy)*Math.PI,d=random(copy)/2;if(d<=Math.sin(theta)/2)hits++;}cast(s,'needle','hero1');assert.equal(s.players[1].hp,1000-hits);assert.equal(s.seed,copy.seed);
});
test('horseshoe folds rather than only doubling; buoyancy uses current and missing health',()=>{
  const s=game(),row=[2,7,12].map(a=>unit(s,0,a));cast(s,'horseshoe');assert.deepEqual(row.map(m=>m.attack),[4,6,4]);
  const e=unit(s,1,9,10);damage(s,e.uid,4);cast(s,'crown',e.uid);assert.equal(s.players[0].armor,6);assert.equal(e.attack,5);
});
test('taxi pair locks seventeen while together and restores its base after losing the partner',()=>{
  const s=game();cast(s,'taxi');const [a,b]=s.players[0].board;assert.deepEqual([a.attack,b.attack],[17,17]);cast(s,'log',a.uid);assert.equal(a.attack,17);
  damage(s,b.uid,99);settle(s);assert.equal(a.attack,1);cast(s,'contradiction',a.uid,1);assert.equal(a.taxiPartner,undefined);
  const t=game();for(let i=0;i<6;i++)unit(t,0,1);cast(t,'taxi');assert.equal(t.players[0].board.at(-1).attack,1);
});
test('fixed taxi values cannot be duplicated by conservation and linked formulas see their final values',()=>{
  const s=game();cast(s,'taxi');const [a,b]=s.players[0].board,n=summon(s,0,'conservation');assert.equal(redistribute(s,0,n.uid,a.uid),false);
  const c=give(s,'pythagoras-person');assert.ok(play(s,0,c.uid,null,1));const p=s.players[0].board[1];assert.equal(p.attack,24);a.attack=0;refreshAuras(s);assert.deepEqual([a.attack,p.attack,b.attack],[17,24,17]);
});
test('Goldbach actually searches prime pairs and does not invent a pair for one',()=>{
  const s=game(),m=unit(s,0,28);cast(s,'goldbach',m.uid);assert.deepEqual(s.players[0].board.slice(1).map(m=>m.attack),[5,23]);assert.equal(m.attack,28);
  const t=game(),n=unit(t,0,1);cast(t,'goldbach',n.uid);assert.equal(t.players[0].board.length,1);
  n.attack=1e12;cast(t,'goldbach',n.uid);assert.equal(t.players[0].board.length,1);assert.match(t.log.at(-1).text,/9999/);
});
test('Durer rows cycle with sum 34, copy their column state, and stop on silence',()=>{
  const s=game(),row=Array.from({length:4},()=>unit(s,0,1));cast(s,'square');assert.deepEqual(row.map(m=>m.attack),[16,3,2,13]);
  for(const expected of [[5,10,11,8],[9,6,7,12],[4,15,14,1],[16,3,2,13]]){next(s);assert.deepEqual(row.map(m=>m.attack),expected);assert.equal(row.reduce((n,m)=>n+m.attack,0),34);}
  cast(s,'taylor',row[1].uid);assert.deepEqual(s.players[0].board.at(-1).magicSquare,row[1].magicSquare);cast(s,'contradiction',row[0].uid,1);assert.equal(row[0].magicSquare,undefined);assert.match(mathPanel(BY_ID.square),/mtable/);
});
test('quaternion stores signed rotation, restores after four turns and honors intervening stat changes',()=>{
  const s=game(),m=unit(s,0,3,7);for(let i=0;i<4;i++)cast(s,'quaternion',m.uid);assert.deepEqual([m.attack,m.hp,m.rotation.x,m.rotation.y,m.rotation.turn],[3,7,3,7,0]);
  m.attack=9;cast(s,'quaternion',m.uid);assert.deepEqual([m.attack,m.hp],[7,9]);assert.match(mathPanel(m),/90°/);
});
test('undecidable branch changes dynamically and never protects from area effects or silence',()=>{
  const s=game(),m=unit(s,1,4,4);m.asleep=false;cast(s,'oracle',m.uid);s.current=1;assert.equal(canAttack(s,1,m.uid),false);
  m.attack=5;assert.equal(canAttack(s,1,m.uid),true);assert.ok(!targetsFor(s,0,{id:'delta'}).includes(m.uid));cast(s,'zero');assert.equal(m.undecidable,undefined);
});
test('Lorenz integration retains deterministic finite coordinates and attacks the x-selected edge',()=>{
  const s=game(),m=summon(s,0,'butterfly'),left=unit(s,1,0,200),right=unit(s,1,0,200);let x=1,y=1,z=1;
  for(let i=0;i<10;i++){const dx=10*(y-x),dy=x*(28-z)-y,dz=x*y-8*z/3;x+=dx*.01;y+=dy*.01;z+=dz*.01;}
  finish(s);assert.equal(m.identityState.x,x);assert.equal(m.identityState.z,z);assert.equal(left.hp,200);assert.equal(right.hp,200-Math.floor(Math.abs(z)));
  finish(s);assert.notEqual(m.identityState.x,x);assert.ok(Number.isFinite(m.identityState.z));
});
test('pigeonhole counts a simultaneous parity partition, including itself',()=>{
  const s=game(),a=unit(s,0,2),b=unit(s,0,3);cast(s,'pigeon');const p=s.players[0].board.at(-1),original=BY_ID.pigeon.attack,counts=[1+(original%2===0),1+(original%2===1)];assert.deepEqual([a.attack,b.attack,p.attack],[2+counts[0],3+counts[1],original+counts[original%2]]);
});
test('random walk retains its prior position and consumes exactly four random steps',()=>{
  const s=game(),m=summon(s,0,'brown'),e=unit(s,1,0,100),copy=structuredClone(s);let pos=0;
  for(let turn=0;turn<2;turn++){for(let i=0;i<4;i++)pos+=random(copy)<.5?-1:1;const hp=e.hp;finish(s);assert.equal(m.identityState.position,pos);assert.equal(hp-e.hp,Math.abs(pos));}
});
test('Turing tape writes three cells, halts once, survives JSON and Taylor copies progress',()=>{
  let s=game();const original=summon(s,0,'turing');next(s);s=JSON.parse(JSON.stringify(s));let m=s.players[0].board.find(m=>m.uid===original.uid);assert.equal(m.identityState.head,1);cast(s,'taylor',m.uid);assert.deepEqual(s.players[0].board.at(-1).identityState,m.identityState);s.players[0].board.pop();
  next(s);next(s);assert.deepEqual(m.identityState.tape,[1,1,1,1]);const before=s.players[0].deck.length;next(s);assert.equal(m.identityState.halted,true);assert.equal(before-s.players[0].deck.length,4);const after=s.players[0].deck.length;next(s);assert.equal(after-s.players[0].deck.length,1);
});
test('Noether records a sum and restores losses, not gains',()=>{
  const s=game(),a=unit(s,0,7);cast(s,'noether');const n=s.players[0].board.at(-1),total=a.attack+n.attack;damage(s,a.uid,99);settle(s);finish(s);assert.equal(n.attack,total);n.attack+=5;finish(s);assert.equal(n.attack,total+5);
});
test('normal vector swaps magnitudes and removes shield; discontinuity checks original neighbors',()=>{
  const s=game(),a=unit(s,1,3,8);a.shield=true;cast(s,'normal',a.uid);assert.deepEqual([a.attack,a.hp,a.shield],[8,3,false]);
  const t=game(),row=[1,2,8,9,9].map(a=>unit(t,1,a));cast(t,'fault');assert.deepEqual(t.players[1].board.map(m=>m.uid),[row[0].uid,row[3].uid,row[4].uid]);
});
test('Bayes discount uses posterior probability, counts opponent spells and excludes minion costs',()=>{
  const s=game();give(s,'fly',1);give(s,'polygon',1);const spell=give(s,'polygon');spell.cost=8;const m=give(s,'fly');m.cost=8;cast(s,'bayes');assert.equal(spell.cost,4);assert.equal(m.cost,8);assert.equal(s.players[1].revealed,true);
});
test('Euler visits the original path once and ends at the hero with attack zero',()=>{
  const s=game(),row=[2,7,4].map(a=>unit(s,1,a));cast(s,'euler');assert.deepEqual(row.map(m=>30-m.hp),[1,5,3]);assert.equal(s.players[1].hp,996);
});
test('Menger shrinks volume and returns its spell; Koch grows only length',()=>{
  const s=game(),m=unit(s,0,9,27);cast(s,'menger',m.uid);assert.deepEqual([m.attack,m.hp],[12,20]);assert.ok(s.players[0].hand.some(c=>c.id==='menger'));cast(s,'koch',m.uid);assert.deepEqual([m.attack,m.hp],[16,20]);
});
test('Mandelbrot distinguishes bounded sample c=0 from escaping c=3 and respects eight-step limit',()=>{
  const s=game(),inside=unit(s,1,5,5),outside=unit(s,1,17,5);cast(s,'mandelbrot');assert.ok(s.players[1].board.includes(inside));assert.ok(!s.players[1].board.includes(outside));
});
test('De Morgan negates the union, conjugation gives squared modulus, limit never heals final point',()=>{
  const s=game(),row=[[3,9],[9,3],[4,4]].map(([a,h])=>unit(s,1,a,h));cast(s,'demorgan');assert.deepEqual(s.players[1].board.map(m=>m.uid),row.slice(0,2).map(m=>m.uid));
  const t=game(),m=unit(t,0,3,4);cast(t,'conjugate');assert.equal(t.players[0].board.at(-1).attack,25);m.maxHp=10;m.hp=2;for(const hp of [6,8,9,9]){cast(t,'limit');assert.equal(m.hp,hp);}
});
test('math states survive seat reversal and targeted silence removes independent enchantments',()=>{
  const s=game(),m=unit(s,0,3,7);cast(s,'quaternion',m.uid);cast(s,'square');const flipped=orientState({seat:1,state:s});assert.deepEqual(flipped.players[1].board[0],m);
  cast(s,'contradiction',m.uid,1);assert.equal(m.rotation,undefined);assert.equal(m.magicSquare,undefined);refreshAuras(s);assert.ok(m.attack>=0);
});
