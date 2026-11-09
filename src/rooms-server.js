import {randomBytes} from 'node:crypto';
import {BY_ID} from './cards.js';
import {createGame,validateDeck,submitMulligan,applyAction,choose,endTurn} from './engine.js';
const heroes=['euclid','leibniz','archimedes'];
export class RoomService{
  rooms=new Map();
  create({name,deck,hero}){
    this.validate(deck,hero);let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(this.rooms.has(code));
    const token=randomBytes(24).toString('hex');this.rooms.set(code,{code,players:[{name:this.name(name),deck:[...deck],hero,token}],game:null,revision:0,updated:Date.now()});return {code,token,seat:0};
  }
  validate(deck,hero){if(!Number.isInteger(hero)||!heroes[hero]||!validateDeck(deck,heroes[hero]))throw Error('유효한 영웅과 30장 덱이 필요합니다.');}
  name(name){return String(name||'수학자').trim().slice(0,24)||'수학자';}
  room(code){const room=this.rooms.get(String(code).toUpperCase());if(!room)throw Error('대전방을 찾을 수 없습니다.');room.updated=Date.now();return room;}
  join(code,{name,deck,hero}){
    this.validate(deck,hero);const r=this.room(code);if(r.players.length!==1)throw Error('이미 두 명이 참가한 방입니다.');
    const token=randomBytes(24).toString('hex');r.players.push({name:this.name(name),deck:[...deck],hero,token});r.game=createGame(r.players[0].deck,randomBytes(4).readUInt32LE(),deck,{heroes:r.players.map(p=>p.hero),turnSeconds:90,mode:'online'});r.game.id=`room-${r.code}-${Date.now()}`;r.revision++;return {code:r.code,token,seat:1};
  }
  timeout(r){const s=r.game;if(s?.phase==='play'&&s.deadline&&s.deadline<=Date.now()){for(let i=0;i<3&&s.choice;i++)choose(s,s.current,0);if(s.phase==='play')endTurn(s,s.current);r.revision++;}}
  act(code,token,action){
    const r=this.room(code),p=r.players.findIndex(x=>x.token===token);if(p<0)throw Error('참가자만 행동할 수 있습니다.');if(!r.game)throw Error('상대 참가를 기다리는 중입니다.');this.timeout(r);
    if(!action||typeof action!=='object')throw Error('잘못된 행동입니다.');
    const ok=action.type==='mulligan'?submitMulligan(r.game,p,action.uids):applyAction(r.game,p,action);
    if(!ok)throw Error('지금은 그 행동을 할 수 없습니다.');r.revision++;return this.snapshot(code,token);
  }
  snapshot(code,token){
    const r=this.room(code);this.timeout(r);const seat=r.players.findIndex(x=>x.token===token),state=r.game?structuredClone(r.game):null;
    if(state){
      delete state.seed;
      state.players.forEach((pl,p)=>{
        pl.deck=Array(pl.deck.length).fill(null);
        if(state.phase!=='over'&&p!==seat&&!pl.revealed)pl.hand=pl.hand.map(c=>({uid:c.uid,id:'hidden',cost:0}));
        if(state.phase!=='over'&&p!==seat){const secrets=[...(pl.secrets||[])];pl.secrets=secrets.map(()=> 'hidden');state.log=state.log.map(l=>({...l,text:secrets.reduce((text,id)=>text.replaceAll(BY_ID[id].name,'비밀'),l.text)}));}
      });
      if(state.choice&&state.choice.p!==seat)state.choice.options=state.choice.options.map(()=>null);
      if(state.choice)delete state.choice.prize;
    }
    return {code:r.code,seat,revision:r.revision,names:r.players.map(p=>p.name),state};
  }
  prune(now=Date.now()){for(const [code,r] of this.rooms)if(now-r.updated>6*60*60*1000)this.rooms.delete(code);}
}
export function createRoomApi(service=new RoomService()){
  return async(req,res,url)=>{
    if(!url.pathname.startsWith('/api/rooms'))return false;
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try{
      if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){reply(403,{error:'다른 출처의 요청입니다.'});return true;}
      let body={};if(req.method==='POST'){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>16384)throw Error('요청이 너무 큽니다.');}body=JSON.parse(text||'{}');if(!body||typeof body!=='object')throw Error('잘못된 요청입니다.');}
      const parts=url.pathname.split('/').filter(Boolean),code=parts[2],token=req.headers.authorization?.replace(/^Bearer /,'');service.prune();
      if(req.method==='POST'&&!code)reply(201,service.create(body));
      else if(req.method==='POST'&&parts[3]==='join')reply(200,service.join(code,body));
      else if(req.method==='POST'&&parts[3]==='actions')reply(200,service.act(code,token,body));
      else if(req.method==='GET'&&code&&parts.length===3)reply(200,service.snapshot(code,token));
      else reply(404,{error:'없는 경로입니다.'});
    }catch(error){reply(400,{error:error.message});}return true;
  };
}
