import {CARDS,BY_ID} from './cards.js';
import {advance} from './progression.js';
export function packState(raw){
  const count=n=>Number.isSafeInteger(n)&&n>=0?n:0;
  const collection=Object.fromEntries(CARDS.map(c=>[c.id,raw?.collection&&Object.hasOwn(raw.collection,c.id)?count(raw.collection[c.id]):c.rarity==='legendary'?1:2]));
  const pending=raw?.opening,valid=Array.isArray(pending?.cards)&&pending.cards.length===5&&pending.cards.every(id=>typeof id==='string'&&Object.hasOwn(BY_ID,id));
  return {collection,packs:raw?.packs===undefined?5:count(raw.packs),opening:valid?{cards:[...pending.cards],revealed:[...new Set((Array.isArray(pending.revealed)?pending.revealed:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<5))]}:null};
}
export function openPack(profile,random=Math.random){
  if(profile.opening||profile.packs<1)return false;
  const cards=[];
  for(let i=0;i<5;i++){
    const roll=random(),tier=roll<.02?'legendary':roll<.08?'epic':roll<.30?'rare':'common';
    const guarantee=i===4&&cards.every(id=>(BY_ID[id].rarity||'common')==='common');
    let pool=CARDS.filter(c=>(c.rarity||'common')===(guarantee&&tier==='common'?'rare':tier));
    if(!pool.length)pool=CARDS.filter(c=>c.rarity==='rare');
    cards.push(pool[Math.min(pool.length-1,Math.floor(random()*pool.length))].id);
  }
  profile.packs--;profile.opening={cards,revealed:[]};
  advance(profile,'pack');
  for(const id of cards)profile.collection[id]=(profile.collection[id]||0)+1;
  return true;
}
export function revealPackCard(profile,index){
  const p=profile.opening;if(!p||!Number.isInteger(index)||index<0||index>=5||p.revealed.includes(index))return false;
  p.revealed.push(index);return true;
}
export function finishPack(profile){if(profile.opening?.revealed.length!==5)return false;profile.opening=null;return true;}
