import test from 'node:test';
import assert from 'node:assert/strict';
import {BY_ID,PRESETS} from '../src/cards.js';
import {gcd,divisorSum,differentiate,integrate,shiftFormula,evaluateFormula,formatFormula,cardRules,formulaValue} from '../src/math.js';
import {createGame,deckFor,mulligan,summon,play,endTurn,targetsFor,canPlay,attack,canAttack,attackTargets,applyAction,chooseAI,legalActions,useLocation,redistribute} from '../src/engine.js';
function setup(){const s=createGame(deckFor(5),125,deckFor(4),{first:0});mulligan(s);s.players.forEach(p=>Object.assign(p,{hand:[],board:[],mana:100,maxMana:10,hp:30,armor:0}));return s;}
function give(s,id){const c={id,uid:++s.serial,cost:0};s.players[0].hand.push(c);return c;}
function cast(s,id,target){assert.ok(play(s,0,give(s,id).uid,target),id);}
function creature(s,a,h,p=0){return summon(s,p,'token',{attack:a,hp:h,maxHp:h});}
function cycle(s){assert.ok(endTurn(s,0));assert.ok(endTurn(s,1));s.players[0].mana=100;}
test('polynomials retain exact fractions under calculus and expand f(x+1)',()=>{
 const cubic=[{n:1,d:1,p:3}];assert.deepEqual(differentiate(cubic),[{n:3,d:1,p:2}]);assert.deepEqual(integrate(differentiate(cubic)),cubic);
 assert.deepEqual(integrate([{n:1,d:1,p:1}]),[{n:1,d:2,p:2}]);assert.equal(formatFormula([]),'0');assert.deepEqual(differentiate([{n:7,d:1,p:0}]),[]);
 const shifted=shiftFormula(cubic);for(let x=0;x<6;x++)assert.equal(evaluateFormula(shifted,x),(x+1)**3);
 assert.equal(gcd(6,9),3);assert.equal(divisorSum(220),284);assert.equal(divisorSum(284),220);assert.equal(divisorSum(1),0);
 assert.equal(formulaValue([{n:1,d:1,p:16}],20),9999);
});
test('function minions grow x, differentiate, integrate, shift and display their current function',()=>{
 const s=setup(),m=summon(s,0,'marginscribe');assert.equal(m.attack,1);cycle(s);assert.equal(m.attack,8);assert.equal(m.functionX,2);
 cast(s,'newtonstep',m.uid);assert.equal(m.attack,12);assert.equal(formatFormula(m.formula),'3x²');assert.match(cardRules(m),/3x²/);
 cast(s,'liouville',m.uid);assert.equal(m.attack,8);cast(s,'laplacetransform',m.uid);assert.equal(m.attack,27);
 cast(s,'knutharrows',m.uid);assert.equal(m.attack,125);assert.equal(m.functionX,2);
});
test('Taylor preserves modified functions, x and additional buffs; silence stops growth',()=>{
 const s=setup(),m=summon(s,0,'bridgekeeper');cycle(s);cast(s,'newtonstep',m.uid);m.attack+=5;
 cast(s,'taylor',m.uid);const clone=s.players[0].board[1];assert.deepEqual(clone.formula,m.formula);assert.equal(clone.functionX,2);assert.equal(clone.attack,9);
 cycle(s);assert.equal(clone.attack,11);s.players[0].board=s.players[0].board.filter(x=>x!==clone);s.players[1].board.push(clone);cast(s,'contradiction',clone.uid);assert.equal(clone.formula,null);cycle(s);assert.equal(clone.attack,0);
 cast(s,'taylor',clone.uid);assert.equal(s.players[0].board.at(-1).formula,null);
});
test('function targets exclude normal minions and reject degree overflow without spending',()=>{
 const s=setup();creature(s,2,2);const c=give(s,'newtonstep');assert.equal(canPlay(s,0,c),false);
 const m=summon(s,0,'bridgekeeper');for(let i=0;i<3;i++)cast(s,'knutharrows',m.uid);
 const overflow=give(s,'knutharrows'),before=structuredClone(s);assert.deepEqual(targetsFor(s,0,overflow),[]);assert.equal(play(s,0,overflow.uid,m.uid),false);assert.deepEqual(s,before);
});
test('definite integral uses area from 0 to current x, not generic spell damage',()=>{
 const s=setup(),m=summon(s,0,'bridgekeeper');cycle(s);cycle(s);summon(s,0,'token',{spellDamage:2});cast(s,'residue',m.uid);assert.equal(s.players[1].hp,21);
});
test('GCD, normalization, divisor sums and diagonal eigenvalues use current stats',()=>{
 const s=setup(),a=creature(s,6,9),b=creature(s,12,18);cast(s,'lhopital',a.uid);assert.deepEqual([a.attack,a.hp],[3,3]);
 cast(s,'normalization');assert.deepEqual([b.attack,b.hp],[2,3]);cast(s,'eigenvalue',b.uid);assert.deepEqual([b.attack,b.hp],[3,2]);
 const c=creature(s,220,4);cast(s,'amicable');assert.equal(c.attack,284);
});
test('Noether moves a chosen attack value and conserves the pair total',()=>{
 const s=setup();creature(s,2,5);const donor=creature(s,8,5),noether=summon(s,0,'conservation');assert.ok(redistribute(s,0,noether.uid,donor.uid));
 assert.deepEqual(s.players[0].board.map(m=>m.attack),[2,0,11]);
});
test('cyclic permutation and sorting leave locations in place',()=>{
 const s=setup(),a=creature(s,1,5),location=summon(s,0,'riemannsurface'),b=creature(s,5,5),c=creature(s,3,5);
 cast(s,'galoiscorrespondence');assert.deepEqual([a.attack,b.attack,c.attack],[3,1,5]);cast(s,'abelsilence');assert.deepEqual(s.players[0].board.map(m=>m.uid),[b.uid,location.uid,a.uid,c.uid]);
});
test('interpolation includes endpoints and rounds the middle',()=>{
 const s=setup();[2,10,10,7].forEach(a=>creature(s,a,5));cast(s,'interpolation');assert.deepEqual(s.players[0].board.map(m=>m.attack),[2,4,5,7]);
});
test('determinant respects column order, zero dependence and two-minion requirement',()=>{
 const s=setup(),a=creature(s,2,3),b=creature(s,4,8);cast(s,'determinant','hero1');assert.equal(s.players[1].hp,26);
 b.hp=6;cast(s,'determinant','hero1');assert.equal(s.players[1].hp,26);s.players[0].board=[a];const c=give(s,'determinant');assert.equal(canPlay(s,0,c),false);
});
test('CRT finds a unique solution from 1 to 15, including zero residues',()=>{
 for(const [a,h,n] of [[2,4,14],[3,5,15],[6,9,9]]){const s=setup(),m=creature(s,a,h);cast(s,'remainderseal',m.uid);assert.equal(s.players[0].board.at(-1).attack,n);}
});
test('binomial coefficients appear in order and truncate at field capacity',()=>{
 const s=setup();cast(s,'binomial');assert.deepEqual(s.players[0].board.map(m=>m.attack),[1,4,6,4,1]);cast(s,'binomial');assert.deepEqual(s.players[0].board.slice(-2).map(m=>m.attack),[1,4]);
});
test('Turing flips four binary positions and then halts',()=>{
 const s=setup(),m=summon(s,0,'halting');for(const a of [11,9,13,5,5]){cycle(s);assert.equal(m.attack,a);}
});
test('Germain transforms only prime p with prime 2p+1; parity correction is literal',()=>{
 const s=setup(),a=creature(s,3,5),b=creature(s,7,6);const c=give(s,'germain');assert.ok(play(s,0,c.uid,null,1));assert.equal(a.attack,7);assert.equal(b.attack,7);
 cast(s,'hamming');assert.deepEqual([a.attack,a.hp,b.attack,b.hp],[8,6,8,6]);
});
test('Gauss sums 1..maxMana and perfect numbers alone receive protection',()=>{
 const s=setup();s.players[0].maxMana=5;cast(s,'younggauss');assert.equal(s.players[0].armor,15);
 const perfect=creature(s,28,10),ordinary=creature(s,12,10);perfect.hp=5;cast(s,'perfectsix');assert.equal(perfect.hp,10);assert.equal(perfect.shield,true);assert.ok(!ordinary.shield);
});
test('Hamilton can visit each enemy once, respects rush/taunt, and resets next turn',()=>{
 const s=setup(),m=summon(s,0,'hamiltonchariot',{hp:50,maxHp:50}),a=creature(s,1,20,1),b=creature(s,1,20,1);
 assert.ok(attack(s,0,m.uid,a.uid));assert.equal(attack(s,0,m.uid,a.uid),false);assert.ok(attack(s,0,m.uid,b.uid));assert.equal(canAttack(s,0,m.uid),false);
 cycle(s);assert.ok(attack(s,0,m.uid,a.uid));assert.ok(attack(s,0,m.uid,'hero1'));assert.equal(attack(s,0,m.uid,'hero1'),false);
 const t=setup(),h=summon(t,0,'hamiltonchariot',{hp:50}),guard=creature(t,1,20,1);guard.taunt=true;creature(t,1,20,1);assert.ok(attack(t,0,h.uid,guard.uid));assert.deepEqual(attackTargets(t,0,h.uid),[]);
});
test('mathematical location activation and reversed resurrection use the shared engine',()=>{
 const s=setup(),m=creature(s,6,9),l=summon(s,0,'exhaustionroom');assert.ok(useLocation(s,0,l.uid,m.uid));assert.deepEqual([m.attack,m.hp],[6,3]);assert.equal(l.hp,1);
 s.players[0].grave=['cat','fly'];cast(s,'transfinite');assert.deepEqual(s.players[0].board.slice(-2).map(m=>m.id),['fly','cat']);
});
test('all expansion preset decks finish seeded matches with legal finite states',()=>{
 for(let i=4;i<PRESETS.length;i++){
  const s=createGame(deckFor(i),800+i,deckFor(4+(i-3)%4),{first:i%2});mulligan(s);let actions=0;
  while(s.phase!=='over'&&actions++<900){const a=chooseAI(s);assert.ok(legalActions(s).some(x=>JSON.stringify(x)===JSON.stringify(a)));assert.ok(applyAction(s,s.current,a));for(const pl of s.players)for(const m of pl.board){assert.ok(Number.isFinite(m.attack)&&m.attack>=0);assert.ok(m.hp>0&&m.hp<=m.maxHp);}}
  assert.equal(s.phase,'over',`${PRESETS[i].name} did not finish`);
 }
});
