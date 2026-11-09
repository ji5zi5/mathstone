import {BY_ID} from './cards.js';
import {HEROES} from './heroes.js';
import {validateDeck} from './engine.js';
import {packState} from './packs.js';
import {progressionState,recordProgress} from './progression.js';

export function deckDraft(ids){
  if(!Array.isArray(ids))return [];
  const counts={};return ids.filter(id=>typeof id==='string'&&Object.hasOwn(BY_ID,id)&&(counts[id]=(counts[id]||0)+1)<=(BY_ID[id].rarity==='legendary'?1:2)).slice(0,30);
}
export function loadProfile(raw,legacy=[]){
  const decks=Array.isArray(raw?.decks)?raw.decks.filter(d=>d&&typeof d.id==='string').map(d=>({id:d.id,name:String(d.name||'내 덱').slice(0,30),hero:HEROES[d.hero]?d.hero:0,ids:deckDraft(d.ids)})):[];
  if(!decks.length&&deckDraft(legacy).length)decks.push({id:'legacy',name:'내 덱',hero:0,ids:deckDraft(legacy)});
  return {...packState(raw),...progressionState(raw),decks,history:Array.isArray(raw?.history)?raw.history.filter(x=>x&&typeof x.id==='string').slice(0,50):[],settings:{sound:!!raw?.settings?.sound,volume:Math.max(0,Math.min(1,Number(raw?.settings?.volume??.6)||0)),turnSeconds:[0,60,90].includes(raw?.settings?.turnSeconds)?raw.settings.turnSeconds:0}};
}
export function exportDeck(deck){
  if(!validateDeck(deck.ids,HEROES[deck.hero]?.id))throw new Error('영웅에 맞는 카드 30장으로 덱을 완성하세요.');
  return 'MATH1:'+JSON.stringify({name:deck.name,hero:deck.hero,ids:deck.ids});
}
export function importDeck(code){
  if(typeof code!=='string'||code.length>10000||!code.startsWith('MATH1:'))throw new Error('매스스톤 덱 코드가 아닙니다.');
  let d;try{d=JSON.parse(code.slice(6));}catch{throw new Error('덱 코드를 읽을 수 없습니다.');}
  if(!d||!Number.isInteger(d.hero)||!HEROES[d.hero]||!validateDeck(d.ids,HEROES[d.hero].id))throw new Error('카드 수, 중복 제한 또는 영웅이 맞지 않습니다.');
  return {name:String(d.name||'가져온 덱').slice(0,30),hero:d.hero,ids:[...d.ids]};
}
export function recordMatch(profile,game){
  if(game.phase!=='over'||profile.history.some(m=>m.id===game.id))return false;
  if(game.winner===0)profile.packs=(profile.packs??0)+1;
  recordProgress(profile,game);
  profile.history.unshift({id:game.id,date:Date.now(),winner:game.winner,turns:game.turn,hero:game.players[0].hero,opponent:game.players[1].hero,log:game.log.slice(-300)});
  profile.history=profile.history.slice(0,50);return true;
}
