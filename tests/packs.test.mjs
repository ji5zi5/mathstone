import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,BY_ID} from '../src/cards.js';
import {openPack,revealPackCard,finishPack} from '../src/packs.js';
import {loadProfile,recordMatch} from '../src/profile.js';
import {deckFor} from '../src/engine.js';

test('legacy profiles keep their decks, full playable collection and receive five packs once',()=>{
 const ids=deckFor(0),p=loadProfile(null,ids);assert.deepEqual(p.decks[0].ids,ids);assert.equal(p.packs,5);
 for(const c of CARDS)assert.equal(p.collection[c.id],c.rarity==='legendary'?1:2);
 p.packs=0;assert.equal(loadProfile(JSON.parse(JSON.stringify(p))).packs,0);
});
test('opening consumes exactly one pack, adds five copies and guarantees rare or better',()=>{
 const p=loadProfile(null),before=Object.values(p.collection).reduce((a,b)=>a+b,0);assert.ok(openPack(p,()=>.9));
 assert.equal(p.packs,4);assert.equal(p.opening.cards.length,5);assert(p.opening.cards.some(id=>['rare','epic','legendary'].includes(BY_ID[id].rarity)));
 assert.equal(Object.values(p.collection).reduce((a,b)=>a+b,0),before+5);const snapshot=structuredClone(p);assert.equal(openPack(p),false);assert.deepEqual(p,snapshot);
});
test('reload preserves rolls and revealed slots without granting cards again',()=>{
 const p=loadProfile(null);openPack(p,()=>.01);revealPackCard(p,2);const saved=JSON.stringify(p),restored=loadProfile(JSON.parse(saved));
 assert.deepEqual(restored.opening,p.opening);assert.deepEqual(restored.collection,p.collection);assert.equal(restored.packs,p.packs);assert.equal(revealPackCard(restored,2),false);
 assert.equal(finishPack(restored),false);for(let i=0;i<5;i++)revealPackCard(restored,i);assert.ok(finishPack(restored));assert.equal(restored.opening,null);
});
test('empty stock and invalid reveal indexes do not change inventory',()=>{
 const p=loadProfile({packs:0}),before=structuredClone(p);assert.equal(openPack(p),false);assert.equal(revealPackCard(p,0),false);assert.deepEqual(p,before);
 p.packs=1;openPack(p);const snapshot=structuredClone(p);for(const i of [-1,5,NaN,.5,'1'])assert.equal(revealPackCard(p,i),false);assert.deepEqual(p,snapshot);
});
test('malformed saved pack state is ignored without discarding decks or history',()=>{
 const raw={packs:-3,opening:{cards:'abcde'},collection:{rabbit:-4,cat:3},decks:[{id:'saved',name:'보존',hero:0,ids:deckFor(0)}],history:[{id:'old'}]};
 const p=loadProfile(raw);assert.equal(p.packs,0);assert.equal(p.opening,null);assert.equal(p.collection.rabbit,0);assert.equal(p.collection.cat,3);assert.equal(p.decks[0].name,'보존');assert.equal(p.history[0].id,'old');
 assert.equal(loadProfile({opening:{cards:Array(5).fill('__proto__')}}).opening,null);
});
test('winning grants one pack once while losing grants none',()=>{
 const p=loadProfile(null),s={phase:'over',id:'win',winner:0,turn:10,players:[{hero:'euclid'},{hero:'leibniz'}],log:[]};
 assert.ok(recordMatch(p,s));assert.equal(p.packs,6);assert.equal(recordMatch(p,s),false);assert.equal(p.packs,6);
 recordMatch(p,{...s,id:'loss',winner:1});assert.equal(p.packs,6);
});
