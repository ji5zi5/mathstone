import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProfile,recordMatch} from '../src/profile.js';
import {craftCard,disenchantCard,disenchantExtras,purchasePacks,advance,claimQuest,claimAchievement,claimLevel,startArena,draftCard,claimArena,rankName,ownsDeck} from '../src/progression.js';
import {createGame,deckFor,validateDeck,mulligan,summon,endTurn} from '../src/engine.js';

test('shop and crafting exchange currency once, reject invalid purchases and protect saved decks',()=>{
 const p=loadProfile(null,deckFor(0));assert.ok(purchasePacks(p,5));assert.equal(p.gold,0);assert.equal(p.packs,10);assert.equal(purchasePacks(p,1),false);assert.equal(purchasePacks(p,-1),false);
 const n=p.collection.rabbit;assert.ok(craftCard(p,'rabbit'));assert.equal(p.collection.rabbit,n+1);assert.equal(p.dust,360);assert.ok(disenchantCard(p,'rabbit'));assert.equal(p.dust,365);
 assert.equal(disenchantCard(p,'discovery'),false);assert.equal(p.collection.discovery,2);assert.equal(craftCard(p,'__proto__'),false);
 assert.ok(ownsDeck(p,deckFor(0)));p.collection.discovery=1;assert.equal(ownsDeck(p,deckFor(0)),false);
});
test('extra dust leaves playsets and saved deck reservations',()=>{
 const p=loadProfile(null,deckFor(0));p.collection.rabbit=5;p.collection.eulerhero=3;const before=p.dust;assert.equal(disenchantExtras(p),815);assert.equal(p.dust,before+815);assert.equal(p.collection.rabbit,2);assert.equal(p.collection.eulerhero,1);assert.equal(disenchantExtras(p),0);
});
test('quests, achievements and reward-track claims are idempotent across reloads',()=>{
 const p=loadProfile(null);for(let i=0;i<10;i++)advance(p,'play');assert.ok(claimQuest(p,'play'));assert.equal(claimQuest(p,'play'),false);assert.equal(p.gold,550);assert.equal(p.xp,100);
 advance(p,'win');assert.ok(claimAchievement(p,'first-win'));assert.equal(p.xp,200);assert.ok(claimLevel(p,1));assert.equal(claimLevel(p,2),false);
 const restored=loadProfile(JSON.parse(JSON.stringify(p)));assert.equal(claimLevel(restored,1),false);assert.equal(claimAchievement(restored,'first-win'),false);assert.equal(claimQuest(restored,'play'),false);
 restored.quests.day='old';advance(restored,'play');assert.equal(restored.quests.progress.play,1);assert.deepEqual(restored.quests.claimed,[]);
});
test('rank and arena results advance only once per match',()=>{
 const p=loadProfile(null),s={phase:'over',id:'rank-1',mode:'ranked',winner:0,turn:5,players:[{hero:'euclid'},{hero:'leibniz'}],log:[]};recordMatch(p,s);recordMatch(p,s);assert.equal(p.rankStars,1);assert.equal(p.stats.wins,1);assert.equal(p.stats.games,1);assert.equal(p.xp,100);assert.equal(rankName(75),'전설');
 startArena(p,0,()=>.2);p.arena.ids=deckFor(0);p.arena.losses=2;recordMatch(p,{...s,id:'arena-1',mode:'arena',arenaRun:p.arena.runId,winner:1});assert.equal(p.arena.finished,true);const packs=p.packs;assert.ok(claimArena(p));assert.equal(p.packs,packs+1);assert.equal(claimArena(p),false);
});
test('draft offers persist and thirty choices make a legal hero-compatible deck',()=>{
 let p=loadProfile(null);assert.ok(startArena(p,1,()=>.31));assert.equal(startArena(p,0),false);
 for(let i=0;i<30;i++){const options=[...p.arena.options];p=loadProfile(JSON.parse(JSON.stringify(p)));assert.deepEqual(p.arena.options,options);assert.ok(draftCard(p,i%3,()=>.47));}
 assert.equal(p.arena.ids.length,30);assert.ok(validateDeck(p.arena.ids,'leibniz'));assert.deepEqual(p.arena.options,[]);assert.equal(draftCard(p,0),false);
});
test('brawl gives ordinary minions functions and advances inputs by two',()=>{
 const s=createGame(deckFor(9),10,deckFor(5),{first:0,mode:'brawl'});mulligan(s);s.players[0].board=[];const m=summon(s,0,'fly');assert.deepEqual(m.formula,[{n:1,d:1,p:2}]);assert.equal(m.attack,1);endTurn(s,0);endTurn(s,1);assert.equal(m.functionX,3);assert.equal(m.attack,9);
});
