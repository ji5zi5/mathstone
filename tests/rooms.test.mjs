import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {RoomService,createRoomApi} from '../src/rooms-server.js';
import {deckFor,legalActions} from '../src/engine.js';
import {orientState,serverAction} from '../src/network.js';
function room(){const service=new RoomService(),host=service.create({name:'호스트',deck:deckFor(9),hero:0}),guest=service.join(host.code,{name:'참가자',deck:deckFor(5),hero:1});return {service,host,guest};}
test('rooms reject invalid decks, full joins and unauthorized actions',()=>{
 const {service,host,guest}=room();assert.throws(()=>service.create({deck:['rabbit'],hero:0}));assert.throws(()=>service.join(host.code,{deck:deckFor(0),hero:0}));assert.throws(()=>service.act(host.code,'wrong',{type:'concede'}));
 assert.equal(service.snapshot(host.code,'wrong').seat,-1);assert.notEqual(host.token,guest.token);assert.equal(service.snapshot(host.code,guest.token).seat,1);
});
test('private hands, decks, seeds, secrets and choice options never reach spectators or opponents',()=>{
 const {service,host,guest}=room(),s=service.rooms.get(host.code).game;s.players[0].secrets=['counterexample'];s.log.push({text:'나 → 단 하나의 반례',kind:'play'});s.choice={p:0,options:['rabbit','cat'],kind:'discover'};
 const own=service.snapshot(host.code,host.token).state,other=service.snapshot(host.code,guest.token).state,watch=service.snapshot(host.code).state;
 assert.equal(own.players[0].hand.some(c=>c.id==='hidden'),false);assert(other.players[0].hand.every(c=>c.id==='hidden'));assert(watch.players.every(p=>p.hand.every(c=>c.id==='hidden')));
 assert(watch.players.every(p=>p.deck.every(id=>id===null)));assert.equal(watch.seed,undefined);assert.deepEqual(watch.players[0].secrets,['hidden']);assert(!JSON.stringify(watch.log).includes('단 하나의 반례'));assert.deepEqual(other.choice.options,[null,null]);assert.deepEqual(own.choice.options,['rabbit','cat']);
});
test('both players independently mulligan and only the current player can act',()=>{
 const {service,host,guest}=room(),code=host.code;
 assert.throws(()=>service.act(code,host.token,{type:'mulligan',uids:[-99]}));service.act(code,host.token,{type:'mulligan',uids:[]});assert.equal(service.snapshot(code,guest.token).state.phase,'mulligan');assert.throws(()=>service.act(code,host.token,{type:'mulligan',uids:[]}));
 service.act(code,guest.token,{type:'mulligan',uids:[]});const state=service.rooms.get(code).game;assert.equal(state.phase,'play');assert.equal(state.players[1-state.first].hand.filter(c=>c.id==='tempoCoin').length,1);
 const owner=state.current===0?host:guest,other=state.current===0?guest:host,before=JSON.stringify(state);assert.throws(()=>service.act(code,other.token,{type:'end'}));assert.equal(JSON.stringify(state),before);service.act(code,owner.token,{type:'end'});assert.notEqual(state.current,owner.seat);
});
test('guest perspective remaps heroes, winner and decisions without changing minion IDs',()=>{
 const {service,host,guest}=room();service.act(host.code,host.token,{type:'mulligan',uids:[]});const raw=service.snapshot(host.code,guest.token),view=orientState(raw);assert.equal(view.players[0].hero,'leibniz');assert.equal(view.current,1-raw.state.current);assert.deepEqual(view.mulliganDone,[false,true]);assert.deepEqual(serverAction({type:'attack',uid:'hero0',target:'hero1'},1),{type:'attack',uid:'hero1',target:'hero0'});assert.deepEqual(serverAction({type:'play',uid:15,target:20},1),{type:'play',uid:15,target:20});
 service.act(host.code,guest.token,{type:'concede'});assert.equal(orientState(service.snapshot(host.code,guest.token)).winner,1);
});
test('reconnection preserves authoritative game and server timer advances expired turns',()=>{
 const {service,host,guest}=room();service.act(host.code,host.token,{type:'mulligan',uids:[]});service.act(host.code,guest.token,{type:'mulligan',uids:[]});const s=service.rooms.get(host.code).game,turn=s.turn;s.deadline=Date.now()-1;const view=service.snapshot(host.code,host.token);assert.equal(view.state.turn,turn+1);assert.deepEqual(service.snapshot(host.code,host.token),view);
 const actor=s.current?guest:host,action=legalActions(s).find(a=>a.type==='play')||{type:'end'};service.act(host.code,actor.token,action);assert.equal(service.snapshot(host.code,actor.token).revision,view.revision+1);
});
test('HTTP API rejects foreign-origin mutations and supports create/join/read',async()=>{
 const api=createRoomApi(),server=http.createServer((req,res)=>api(req,res,new URL(req.url,'http://localhost')));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  const rejected=await fetch(base+'/api/rooms',{method:'POST',headers:{Origin:'http://other.example','Content-Type':'application/json'},body:'{}'});assert.equal(rejected.status,403);
  const created=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'나',deck:deckFor(0),hero:0})});assert.equal(created.status,201);const credentials=await created.json();
  const state=await (await fetch(base+'/api/rooms/'+credentials.code,{headers:{Authorization:`Bearer ${credentials.token}`}})).json();assert.equal(state.seat,0);assert.equal(state.state,null);assert.deepEqual(state.names,['나']);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
