import {CARDS,BY_ID} from './cards.js';
export const DUST={common:[40,5],rare:[100,20],epic:[400,100],legendary:[1600,400]};
export const QUESTS=[{id:'play',name:'카드 10장 사용',goal:10,gold:50,xp:100},{id:'win',name:'대전 1회 승리',goal:1,gold:50,xp:100},{id:'pack',name:'카드팩 2개 개봉',goal:2,gold:50,xp:100}];
export const ACHIEVEMENTS=[{id:'first-win',name:'첫 번째 증명',stat:'wins',goal:1},{id:'ten-games',name:'열 번의 실험',stat:'games',goal:10},{id:'five-packs',name:'서고의 열쇠',stat:'packs',goal:5},{id:'twenty-spells',name:'식의 연금술사',stat:'spells',goal:20},{id:'first-craft',name:'직접 쓴 한 장',stat:'crafted',goal:1}];
const integer=(n,fallback=0)=>Number.isSafeInteger(n)&&n>=0?n:fallback;
export function today(date=new Date()){return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;}
export function progressionState(raw){
  const stats=Object.fromEntries(['wins','games','packs','spells','crafted','played'].map(k=>[k,integer(raw?.stats?.[k])]));
  const q=raw?.quests,quests=q?.day===today()?{day:q.day,progress:Object.fromEntries(QUESTS.map(x=>[x.id,integer(q.progress?.[x.id])])),claimed:Array.isArray(q.claimed)?q.claimed.filter(id=>QUESTS.some(q=>q.id===id)):[]}:{day:today(),progress:{},claimed:[]};
  const arena=raw?.arena;
  return {gold:integer(raw?.gold,500),dust:integer(raw?.dust,400),xp:integer(raw?.xp),rankStars:integer(raw?.rankStars),stats,quests,rewardClaims:Array.isArray(raw?.rewardClaims)?[...new Set(raw.rewardClaims.filter(n=>Number.isSafeInteger(n)&&n>0))]:[],achievementClaims:Array.isArray(raw?.achievementClaims)?raw.achievementClaims.filter(id=>ACHIEVEMENTS.some(a=>a.id===id)):[],arena:validArena(arena)?structuredClone(arena):null};
}
export function advance(profile,event){
  if(profile.quests.day!==today())profile.quests={day:today(),progress:{},claimed:[]};
  const stat={play:'played',spell:'spells',win:'wins',game:'games',pack:'packs',craft:'crafted'}[event];if(stat)profile.stats[stat]++;
  if(QUESTS.some(q=>q.id===event))profile.quests.progress[event]=(profile.quests.progress[event]||0)+1;
}
export function purchasePacks(profile,count){if(![1,5].includes(count)||profile.gold<count*100)return false;profile.gold-=count*100;profile.packs+=count;return true;}
export function craftCard(profile,id){if(!Object.hasOwn(BY_ID,id))return false;const c=BY_ID[id],price=DUST[c.rarity||'common'][0];if(profile.dust<price)return false;profile.dust-=price;profile.collection[id]=(profile.collection[id]||0)+1;advance(profile,'craft');return true;}
export function reservedCopies(profile,id){return Math.max(0,...profile.decks.map(d=>d.ids.filter(x=>x===id).length));}
export function disenchantCard(profile,id){
  if(!Object.hasOwn(BY_ID,id))return false;const c=BY_ID[id];if((profile.collection[id]||0)<=reservedCopies(profile,id))return false;
  profile.collection[id]--;profile.dust+=DUST[c.rarity||'common'][1];return true;
}
export function disenchantExtras(profile){let dust=0;for(const c of CARDS){const n=Math.max(0,(profile.collection[c.id]||0)-Math.max(c.rarity==='legendary'?1:2,reservedCopies(profile,c.id)));profile.collection[c.id]-=n;dust+=n*DUST[c.rarity||'common'][1];}profile.dust+=dust;return dust;}
export function ownsDeck(profile,ids){return ids.every(id=>ids.filter(x=>x===id).length<=(profile.collection[id]||0));}
export function claimQuest(profile,id){advance(profile,'refresh');const q=QUESTS.find(q=>q.id===id);if(!q||profile.quests.claimed.includes(id)||(profile.quests.progress[id]||0)<q.goal)return false;profile.quests.claimed.push(id);profile.gold+=q.gold;profile.xp+=q.xp;return true;}
export function claimAchievement(profile,id){const a=ACHIEVEMENTS.find(a=>a.id===id);if(!a||profile.achievementClaims.includes(id)||profile.stats[a.stat]<a.goal)return false;profile.achievementClaims.push(id);profile.packs++;profile.xp+=100;return true;}
export function claimLevel(profile,level){if(!Number.isSafeInteger(level)||level<1||level>Math.floor(profile.xp/200)||profile.rewardClaims.includes(level))return false;profile.rewardClaims.push(level);profile.gold+=100;if(level%3===0)profile.packs++;return true;}
export function rankName(stars){const ranks=['브론즈','실버','골드','플래티넘','다이아몬드'];if(stars>=75)return '전설';return `${ranks[Math.floor(stars/15)]} ${5-Math.floor(stars%15/3)} · ${stars%3}/3 ★`;}
export function recordProgress(profile,game){
  advance(profile,'game');profile.xp+=game.winner===0?100:40;
  if(game.winner===0){advance(profile,'win');profile.gold+=30;}
  if(game.mode==='ranked')profile.rankStars=Math.max(0,profile.rankStars+(game.winner===0?1:game.winner===1?-1:0));
  if(game.mode==='arena'&&profile.arena?.runId===game.arenaRun&&!profile.arena.finished){
    if(game.winner===0)profile.arena.wins++;else if(game.winner===1)profile.arena.losses++;
    if(profile.arena.wins>=12||profile.arena.losses>=3)profile.arena.finished=true;
  }
}
function validArena(a){return a&&Array.isArray(a.ids)&&a.ids.length<=30&&a.ids.every(id=>Object.hasOwn(BY_ID,id))&&Number.isInteger(a.hero)&&a.hero>=0&&a.hero<3&&typeof a.runId==='string'&&Array.isArray(a.options)&&a.options.every(id=>Object.hasOwn(BY_ID,id))&&Number.isInteger(a.wins)&&a.wins>=0&&Number.isInteger(a.losses)&&a.losses>=0;}
function draftChoices(arena,random){
  const hero=['euclid','leibniz','archimedes'][arena.hero],pool=CARDS.filter(c=>(!c.heroClass||c.heroClass===hero)&&arena.ids.filter(id=>id===c.id).length<(c.rarity==='legendary'?1:2));
  const choices=[];while(choices.length<3&&pool.length)choices.push(pool.splice(Math.floor(random()*pool.length),1)[0].id);return choices;
}
export function startArena(profile,hero,random=Math.random){
  if(!Number.isInteger(hero)||hero<0||hero>2||profile.arena)return false;
  profile.arena={runId:`${Date.now()}-${random()}`,hero,ids:[],options:[],wins:0,losses:0,finished:false};profile.arena.options=draftChoices(profile.arena,random);return true;
}
export function draftCard(profile,index,random=Math.random){const a=profile.arena;if(!a||a.finished||a.ids.length>=30||!Number.isInteger(index)||index<0||index>=a.options.length)return false;a.ids.push(a.options[index]);a.options=a.ids.length<30?draftChoices(a,random):[];return true;}
export function claimArena(profile){const a=profile.arena;if(!a?.finished)return false;profile.gold+=50+a.wins*25;profile.packs+=1+Math.floor(a.wins/4);profile.arena=null;return true;}
