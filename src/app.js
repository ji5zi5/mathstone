import {frameHTML,ribbonHTML,inPlayFrame,gemHTML} from './frames.js';
import {displayRules,mathPanel} from './math-display.js';
import {fitCardText} from './card-text.js';
import {handPose} from './layout.js';
import {cardRules,formatFormula} from './math.js';
import {mathLabel,relationInputs} from './relations.js';
import {hanoiMoves,amplifyFrequency} from './math-mechanics.js';
import {HEROES,heroOf} from './heroes.js';
import {snapshot,actionEffect,resultEffects} from './effects.js';
import {loadProfile,exportDeck,importDeck,recordMatch} from './profile.js';
import {openPack,revealPackCard,finishPack} from './packs.js';
import {DUST,QUESTS,ACHIEVEMENTS,advance,purchasePacks,craftCard,disenchantCard,disenchantExtras,reservedCopies,ownsDeck,claimQuest,claimAchievement,claimLevel,rankName,startArena,draftCard,claimArena} from './progression.js';
import {serverAction,orientState} from './network.js';
import {CARDS,BY_ID,PRESETS} from './cards.js';
import {createGame,deckFor,validateDeck,mulligan,canPlay,canAttack,targetsFor,attackTargets,chooseAI,applyAction,capacity,definitionOf,canPower,powerTargets,canUseLocation,minions,canRedistribute,redistributeTargets} from './engine.js';

const $=s=>document.querySelector(s), app=$('#app'), dialog=$('#dialog');
let textFrame;
const scheduleCardText=()=>{cancelAnimationFrame(textFrame);textFrame=requestAnimationFrame(()=>fitCardText());};
const textObserver=new MutationObserver(scheduleCardText);
for(const root of [app,dialog])textObserver.observe(root,{childList:true,subtree:true});
document.fonts.ready.then(scheduleCardText);
document.fonts.addEventListener('loadingdone',scheduleCardText);
window.addEventListener('resize',scheduleCardText);
let shownMinions = new Set(), suppressClickUntil = 0, busy=false, heroIndex=0;
let matchMode='casual';
let online=null,onlineTimer=null,offlineGame=null;
let game=null,view='home',selected=null,deckIndex=0,custom=[],filter='',school='전체',type='전체',aiTimer=null,soundOn=false,audio=null,drag=null,costFilter='전체',activeDeckId=null,setupDeckId=null,collectionPage=0;
const storage={get(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}},set(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}};
const profile=loadProfile(storage.get('mathstone-profile-v1'),storage.get('mathstone-deck-v1'));
soundOn=profile.settings.sound;
if(profile.decks.length){activeDeckId=profile.decks[0].id;custom=profile.decks[0].ids;heroIndex=profile.decks[0].hero;}
const saved=storage.get('mathstone-save-v2');
if(saved?.version===2&&saved.state?.players?.length===2&&['play','mulligan','over'].includes(saved.state.phase))game=saved.state;
if(game){game.id??=`legacy-${game.seed}`;game.pausedAt??=Date.now();if(game.deadline&&game.deadline<game.pausedAt)game.deadline=game.pausedAt+(game.turnSeconds||60)*1000;}
function saveProfile(){storage.set('mathstone-profile-v1',profile);}
function persistDeck(){let d=profile.decks.find(d=>d.id===activeDeckId);if(!d){d={id:crypto.randomUUID(),name:'새 덱',hero:heroIndex,ids:custom};profile.decks.push(d);activeDeckId=d.id;}d.ids=custom;d.hero=heroIndex;saveProfile();}
function save(){if(game&&!online)storage.set('mathstone-save-v2',{version:2,state:game});}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function artStyle(c){const n=BY_ID[c.id]?.art??c.art??0;return `--art:url('/public/art/sheet-${Math.floor(n/10)}.png');--px:${n%5*25}%;--py:${Math.floor(n%10/5)*100}%;--hue:${n*31%360}`;}
function heroStyle(h){return `background-image:url('/public/art/heroes.png');background-size:300% auto;background-position:${Math.max(0,HEROES.indexOf(h))*50}% 20%`;}
function tone(c){return c.school==='생성'?'growth':c.school==='변환'?'change':'paradox';}
function rules(text){return esc(text).replace(/(전투의 함성|죽음의 메아리|내 턴 종료|내 턴 시작|천상의 보호막|주문 공격력|생명력 흡수|도발|돌진|침묵|속공|질풍|은신|독성|환생|빙결|비밀|발견|선택|퀘스트)/g,'<b>$1</b>');}
const typeName=c=>({minion:'하수인',spell:c.secret?'비밀':c.quest?'퀘스트':'주문',weapon:'무기',location:'장소',hero:'영웅',mathematician:'수학자'}[c.type]||'하수인');
function cardHTML(c,cls='',attrs=''){
  if(c.ability&&BY_ID[c.ability])c={...c,text:BY_ID[c.ability].text};
  const hp=['weapon','location'].includes(c.type)?c.durability??c.hp:c.hp??c.health,atk=c.type==='location'?'⌂':c.attack??0;
  const text=cardRules(c);
  return `<button class="card ${tone(c)} ${c.type||'minion'}-card ${cls}" style="${artStyle(c)};${c.fan||''}" ${attrs} aria-label="${esc(c.name)}. 마나 ${c.cost}. ${esc(text)}"><span class="cost">${gemHTML('mana')}${c.cost}</span><span class="art"></span>${frameHTML(c.type)}<span class="card-name">${ribbonHTML()}<span>${esc(c.name)}</span></span><span class="rarity-gem ${c.rarity||'common'}" aria-hidden="true"></span><span class="card-rules"><span>${displayRules(c).split('\n').map(line=>`<span class="rule-line ${line.includes(' = ')?'equation-line':''}">${rules(line)}</span>`).join('')}</span></span><span class="card-footer">${c.mathematician?'수학자':''}</span>${hp?`<span class="stat atk">${gemHTML('attack')}${atk}</span><span class="stat hp">${gemHTML('health')}${hp}</span>`:'<span class="spell-mark">✦</span>'}</button>`;
}
function toast(text){const e=$('#toast');e.textContent=text;e.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove('show'),2400);}
function sound(kind='play'){
  if(!soundOn)return;
  try{
    audio??=new AudioContext();audio.resume();const now=audio.currentTime;
    const notes=kind==='attack'?[110,65]:kind==='power'?[420,630,840]:kind==='end'?[330,440]:[440,660];
    notes.forEach((frequency,i)=>{const osc=audio.createOscillator(),gain=audio.createGain(),at=now+i*.045;osc.connect(gain);gain.connect(audio.destination);osc.type=kind==='attack'?'triangle':'sine';osc.frequency.setValueAtTime(frequency,at);osc.frequency.exponentialRampToValueAtTime(kind==='attack'?30:frequency*1.2,at+.16);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.065*profile.settings.volume,at+.008);gain.gain.exponentialRampToValueAtTime(.001,at+.23);osc.start(at);osc.stop(at+.24);});
    if(kind==='attack'){const buffer=audio.createBuffer(1,audio.sampleRate*.12,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const noise=audio.createBufferSource(),gain=audio.createGain();noise.buffer=buffer;gain.gain.value=.12*profile.settings.volume;noise.connect(gain);gain.connect(audio.destination);noise.start(now);}
  }catch{}
}
function showDialog(html){dialog.innerHTML=html;if(!dialog.open)dialog.showModal();dialog.querySelector('[data-close]')?.addEventListener('click',()=>dialog.close());}
function newGameMenu(){navigate('setup');}
function startGame(deck,mode=matchMode){
  if(online)return toast('대전방에서 나온 뒤 새 대전을 시작하세요.');
  if(game&&game.phase!=='over')return toast('진행 중인 대전이 있습니다.');
  if(mode!=='arena'&&(deck===custom||setupDeckId)&&!ownsDeck(profile,deck))return toast('덱에 없는 카드가 있습니다.');
  clearTimeout(aiTimer);game=createGame(deck,Date.now(),deckFor((deckIndex+1)%PRESETS.length),{heroes:[heroIndex,(heroIndex+1)%HEROES.length],turnSeconds:profile.settings.turnSeconds,mode});if(mode==='arena')game.arenaRun=profile.arena.runId;selected=null;view='battle';dialog.close();save();render();showMulligan();
}
function showMulligan(){
  if(online?.seat===-1)return;
  if(online&&game.mulliganDone?.[0]){showDialog('<h2>상대의 카드 교체를 기다리는 중</h2>');return;}
  const swap=new Set();showDialog(`<h2>시작 카드 교체</h2><p class="dialog-lead">${(game.first??0)===0?'선공 · 시작 카드 3장':'후공 · 시작 카드 4장 + 동전'}<br>바꿀 카드를 선택하세요.</p><div class="mulligan-cards">${game.players[0].hand.map(c=>cardHTML({...definitionOf(c),cost:c.cost},'',`data-swap="${c.uid}"`)).join('')}</div><button id="confirm-hand" class="gold-button">확인</button>`);
  dialog.querySelectorAll('[data-swap]').forEach(el=>el.onclick=()=>{const id=Number(el.dataset.swap);swap.has(id)?swap.delete(id):swap.add(id);el.classList.toggle('swap',swap.has(id));});
  $('#confirm-hand').onclick=()=>{if(online){networkAction({type:'mulligan',uids:[...swap]});return;}mulligan(game,[...swap]);delete game.pausedAt;dialog.close();save();render();sound();scheduleAI();};
}
function heroHTML(p){
  const pl=game?.players[p]||{hp:30,armor:0},own=p===0,h=heroOf(pl);
  return `<div class="hero-line ${own?'own':'enemy'}"><button class="hero-portrait ${game&&canAttack(game,p,`hero${p}`)?'ready':''} ${validTarget(`hero${p}`)?'targetable':''}" data-target="hero${p}" aria-label="${own?'내':'상대'} 영웅 생명력 ${pl.hp}" style="${heroStyle(h)}"><i class="hero-health">${pl.hp}</i>${pl.armor?`<i class="armor" title="방어도">${pl.armor}</i>`:''}</button><span class="hero-name">${h.name}</span><button data-power="${p}" class="hero-power ${game&&canPower(game,p)?'ready':''} ${pl.powerUsed?'used':''}" aria-label="${h.name} 영웅 능력 ${h.power}. ${h.cost}마나. ${h.text}${pl.powerUsed?' 이번 턴 사용함':''}" title="${h.power} · ${h.cost}마나\n${h.text}" ${!own||!game||!canPower(game,p)?'disabled':''}><span>${pl.powerUsed?'✓':h.icon}</span><i>${h.cost}</i></button>${pl.weapon?`<button class="weapon ${own?'friendly-weapon':''}" ${own?'data-hero-attack':''} aria-label="무기 공격력 ${pl.weapon.attack}, 내구도 ${pl.weapon.durability}"><span>⚔</span><b>${pl.weapon.attack}</b><i>${pl.weapon.durability}</i></button>`:''}</div>`;
}
function manaHTML(p){const pl=game?.players[p]||{mana:0,maxMana:0},total=pl.maxMana+(pl.temporaryMana||0);return `<div class="mana-tray ${p?'enemy-mana':'own-mana'}" aria-label="${p?'상대':'내'} 마나 ${pl.mana}/${total}"><span class="mana-label">${pl.mana}/${total}</span><div class="mana-gems">${Array.from({length:p?0:10},(_,i)=>`<i class="${i<pl.mana?'full':i<total?'spent':'locked'}"></i>`).join('')}</div></div>`;}

function placing(){const c=selected?.type==='play'&&game?.players[0].hand.find(c=>c.uid===selected.uid);return c&&['minion','location'].includes(definitionOf(c).type)&&selected.position===undefined;}
function validTarget(key){
  if(!game||!selected||placing())return false;
  const ts=selected.type==='redistribute'?redistributeTargets(game,0,Number(selected.uid)):selected.type==='location'?minions(game,0).map(m=>m.uid):selected.type==='power'?powerTargets(game,0):selected.type==='play'?targetsFor(game,0,game.players[0].hand.find(c=>c.uid===selected.uid)||{id:'rabbit'}):attackTargets(game,0,selected?.uid);
  return ts.some(k=>String(k)===String(key));
}
function boardHTML(p){
  const b=game?.players[p].board||[],cap=game?capacity(game,p):7;
  return `<div class="minion-row ${p?'enemy-row':'own-row'} ${b.length>7?'expanded':''}" data-board="${p}" aria-label="${p?'상대':'내'} 필드 ${b.length}/${cap}" style="--count:${Math.max(7,b.length)}">${b.map(m=>`<button class="minion ${m.type==='location'?'location-piece':''} ${m.frozenUntil!=null?'frozen':''} ${m.stealth?'stealth':''} ${m.taunt?'taunt':''} ${m.shield?'shield':''} ${canAttack(game,p,m.uid)||canUseLocation(game,p,m.uid)?'ready':''} ${validTarget(m.uid)?'targetable':''} ${String(selected?.uid)===String(m.uid)?'selected':''} ${shownMinions.has(m.uid)?'':'entering'}" style="${artStyle(m)}" data-target="${m.uid}" data-peek-uid="${m.uid}" aria-label="${esc(m.name)} 공격력 ${m.attack}, 생명력 ${m.hp}${m.type==='location'?', 장소':(m.asleep&&!m.charge&&!m.rush)?', 소환 후 대기 중':''}"><span class="minion-art"></span>${m.type==='location'?'':inPlayFrame()}${m.type==='location'?`<span class="location-label">${game.turn>=m.readyTurn?'사용':'휴식'}</span>`:(m.asleep&&!m.charge&&!m.rush)?'<span class="sleep">z<sup>z</sup></span>':''}${m.silenced?'<span class="silenced">×</span>':''}<span class="stat atk">${gemHTML('attack')}${m.type==='location'?'⌂':m.attack}</span><span class="stat hp ${m.hp<m.maxHp?'damaged':''}">${gemHTML('health')}${m.hp}</span>${m.shield?'<span class="shield-label">◇</span>':''}${mathLabel(m)?`<span class="math-badge ${m.attackEquation?(m.attack===m.hp?'satisfied':'unsatisfied'):''}" title="${esc(m.formula?formatFormula(m.formula):mathLabel(m))}">${esc(mathLabel(m))}</span>`:''}</button>${m.ability==='conservation'&&!m.silenced?`<button class="math-activate" data-redistribute="${m.uid}" aria-label="${esc(m.name)} 공격력 이동" ${p!==0||!canRedistribute(game,p,m.uid)?'disabled':''} style="--slot:${b.indexOf(m)}">Σ</button>`:''}`).join('')}${cap>7?`<span class="capacity">${b.length}/${cap}</span>`:''}</div>`;
}
function drawMathLinks(){
  const table=app.querySelector('.table');if(!table||!game)return;
  table.querySelector('.math-links')?.remove();
  const rect=table.getBoundingClientRect(),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('math-links');svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);svg.setAttribute('aria-hidden','true');
  const point=(uid,p)=>{const el=app.querySelector(`[data-target="${uid}"]`);if(!el)return null;const r=el.getBoundingClientRect();return {x:r.left+r.width/2-rect.left,y:(p?r.bottom:r.top)-rect.top};};
  game.players.forEach((pl,p)=>pl.board.forEach(m=>{
    if(!m.relation)return;const from=point(m.uid,p);if(!from)return;
    relationInputs(game,m).filter(Boolean).forEach(input=>{const to=point(input.uid,p);if(!to)return;const line=document.createElementNS(svg.namespaceURI,'path'),bend=p?24:-24;line.setAttribute('d',`M ${from.x} ${from.y} C ${from.x} ${from.y+bend}, ${to.x} ${to.y+bend}, ${to.x} ${to.y}`);line.setAttribute('class',m.relation.kind);svg.append(line);});
  }));
  table.append(svg);
  app.querySelectorAll('[data-redistribute]').forEach(button=>{const el=app.querySelector(`[data-target="${button.dataset.redistribute}"]`),r=el.getBoundingClientRect(),parent=button.parentElement.getBoundingClientRect();button.style.left=`${r.left+r.width/2-parent.left}px`;button.style.top=`${r.bottom-parent.top+10}px`;});
}
window.addEventListener('resize',()=>{if(view==='battle')requestAnimationFrame(drawMathLinks);});
function renderBattle(){
  document.body.classList.toggle('spectating',online?.seat===-1);
  const me=game?.players[0],them=game?.players[1],active=online?.seat!==-1&&game?.current===0&&game?.phase==='play';
  hidePeek();
  const hint=selected?(placing()?'소환 위치 선택':selected.type==='attack'?'공격 대상 선택':'대상 선택'):'';
  app.innerHTML=`<div class="battle-layout"><section class="table" aria-label="대전 전장"><div class="enemy-hand" aria-label="상대 손패 ${them?.hand.length||0}장">${them?.revealed?them.hand.map(c=>`<button class="revealed-card" data-revealed="${c.uid}">${esc(definitionOf(c).name)}</button>`).join(''):Array.from({length:them?.hand.length||0},(_,i)=>`<i class="card-back" style="--back-angle:${(i-((them?.hand.length||0)-1)/2)*5}deg"></i>`).join('')}</div>${heroHTML(1)}${manaHTML(1)}${boardHTML(1)}${boardHTML(0)}${heroHTML(0)}${manaHTML(0)}<button id="end-turn" class="end-turn" ${active?'':'disabled'}>${active?'턴 종료':'상대 턴'}</button><div id="turn-rope" class="turn-rope" hidden><i></i><span></span></div>${statusHTML(0)}${statusHTML(1)}<span class="action-hint">${hint}</span><button class="battle-history" id="show-history" aria-label="대전 기록">${(game?.log||[]).filter(l=>l.kind==='play').slice(-5).map(l=>{const c=CARDS.find(c=>l.text.endsWith(c.name));return c?`<i style="${artStyle(c)}" title="${esc(l.text)}"></i>`:'';}).join('')}</button><div class="deck-pile enemy-deck" title="상대 덱 ${them?.deck.length??30}장"><i></i><span>${them?.deck.length??30}</span></div><div class="deck-pile own-deck" title="내 덱 ${me?.deck.length??30}장"><i></i><span>${me?.deck.length??30}</span></div><div class="hand-zone"><div class="hand">${(me?.hand||[]).map((c,i)=>{const pose=handPose(i,me.hand.length);if(c.id==='hidden')return '<i class="card-back spectator-back"></i>';return cardHTML({...definitionOf(c),cost:c.cost,fan:`--hx:${pose.x}cqw;--hy:${pose.y}cqw;--angle:${pose.angle}deg;--order:${i+1}`},`hand-card ${canPlay(game,0,c)?'playable':''} ${selected?.uid===c.uid?'selected':''}`,`data-hand="${c.uid}"`);}).join('')}</div></div></section><div id="peek" class="card-peek" hidden></div></div>`;
  if(online){const tag=document.createElement('button');tag.className='online-ribbon';tag.textContent=`${online.seat===-1?'관전':'대전방'} ${online.code}`;tag.onclick=()=>navigate('online');app.querySelector('.table').append(tag);}
  drawMathLinks();
  app.querySelectorAll('[data-redistribute]').forEach(el=>el.onclick=e=>{e.stopPropagation();if(busy)return;selected={type:'redistribute',uid:Number(el.dataset.redistribute)};render();});
  shownMinions=new Set(game?.players.flatMap(p=>p.board.map(m=>m.uid))||[]);
  $('#show-history').onclick=()=>showDialog(`<button class="close" data-close aria-label="닫기">×</button><h2>대전 기록</h2><ol class="history">${(game?.log||[]).map(l=>`<li><small>${l.turn||0}턴</small> ${esc(l.text)}</li>`).join('')||'<li>기록 없음</li>'}</ol>`);
  app.querySelectorAll('[data-revealed]').forEach(el=>el.onclick=()=>{const c=them.hand.find(c=>c.uid===Number(el.dataset.revealed));inspect({...definitionOf(c),cost:c.cost});});
  $('#end-turn').onclick=()=>perform({type:'end'});
  $('[data-power="0"]').onclick=()=>{if(busy||!canPower(game,0))return;if(heroOf(me).target){selected=selected?.type==='power'?null:{type:'power'};render();}else perform({type:'power'});};
  app.querySelectorAll('[data-hand]').forEach(el=>{const uid=Number(el.dataset.hand);el.onclick=()=>{if(performance.now()>suppressClickUntil)selectHand(uid);};el.onpointerdown=e=>beginDrag(e,'play',uid);el.onmouseenter=()=>{const c=me.hand.find(c=>c.uid===uid);peek({...definitionOf(c),cost:c.cost},el,true);};el.onmouseleave=hidePeek;el.onfocus=el.onmouseenter;el.onblur=hidePeek;el.oncontextmenu=e=>{e.preventDefault();const c=me.hand.find(c=>c.uid===uid);inspect({...definitionOf(c),cost:c.cost});};});
  app.querySelectorAll('[data-target]').forEach(el=>{const key=el.dataset.target;el.onclick=e=>{e.stopPropagation();if(performance.now()>suppressClickUntil)targetClick(key);};el.onpointerdown=e=>{if(canAttack(game,0,key))beginDrag(e,'attack',key);};const uid=el.dataset.peekUid;if(uid){const m=game.players.flatMap(p=>p.board).find(m=>String(m.uid)===uid);el.onmouseenter=()=>peek(m,el);el.onmouseleave=hidePeek;el.onfocus=()=>peek(m,el);el.onblur=hidePeek;el.oncontextmenu=e=>{e.preventDefault();inspect(m);};}});
  $('[data-board="0"]').onclick=e=>{if(e.target.closest('[data-target],[data-position]'))return;if(placing())placeSelected(insertionIndex(e.clientX));};
  app.querySelectorAll('[data-hero-attack]').forEach(el=>el.onclick=()=>targetClick('hero0'));
  app.querySelectorAll('.weapon').forEach(el=>{const p=el.classList.contains('friendly-weapon')?0:1,weapon=game.players[p].weapon,c={...BY_ID[weapon.id],...weapon};el.onmouseenter=()=>peek(c,el);el.onmouseleave=hidePeek;el.onfocus=el.onmouseenter;el.onblur=hidePeek;el.oncontextmenu=e=>{e.preventDefault();inspect(c);};});
  app.querySelectorAll('[data-hanoi]').forEach(el=>el.onclick=()=>showHanoi(Number(el.dataset.hanoi)));
  if(placing()){showPositions();$('[data-board="0"]').classList.add('dropzone');}
  if(game?.phase==='over')showResult();else if(game?.choice?.p===0&&online?.seat!==-1)showChoice();
  app.querySelectorAll('[data-secret]').forEach(el=>el.onclick=()=>inspect(BY_ID[el.dataset.secret]));
}
function selectHand(uid){
  if(busy||online?.seat===-1||!game||game.choice||game.current!==0||game.phase!=='play')return;
  if(selected?.uid===uid){selected=null;render();return;}
  const c=game.players[0].hand.find(c=>c.uid===uid);
  if(!canPlay(game,0,c)){toast(c.cost>game.players[0].mana?'마나가 부족합니다.':'필드에 자리가 없거나 효과를 적용할 대상이 없습니다.');return;}
  selected={type:'play',uid};
  if(!['minion','location'].includes(definitionOf(c).type)&&!definitionOf(c).target){perform({type:'play',uid});return;}
  render();
}
function targetClick(key){
  if(busy||online?.seat===-1||!game||game.choice||game.current!==0||game.phase!=='play')return;
  if(selected&&validTarget(key)){perform({...selected,target:key});return;}
  if(placing())return;
  if(canUseLocation(game,0,Number(key))){selected={type:'location',uid:Number(key)};render();return;}
  if(canAttack(game,0,key)){selected={type:'attack',uid:key};render();}
  else if(!selected&&key!=='hero1'){const m=game.players[0].board.find(m=>String(m.uid)===String(key));toast(m?.attackEquation&&m.attack!==m.hp?'A=H: 공격력과 생명력이 같아야 합니다.':'지금은 공격할 수 없습니다.');}
}
function insertionIndex(x){
  const nodes=[...app.querySelectorAll('[data-board="0"] .minion')];
  const index=nodes.findIndex(el=>{const r=el.getBoundingClientRect();return x<r.left+r.width/2;});return index<0?nodes.length:index;
}
function showPositions(){
  const row=$('[data-board="0"]');row.querySelectorAll('.place-slot').forEach(el=>el.remove());
  const rect=row.getBoundingClientRect(),nodes=[...row.querySelectorAll('.minion')];
  for(let i=0;i<=nodes.length;i++){
    const left=nodes[i-1]?.getBoundingClientRect(),right=nodes[i]?.getBoundingClientRect();
    const x=left&&right?(left.right+right.left)/2:left?left.right+12:right?right.left-12:rect.left+rect.width/2;
    const slot=document.createElement('button');slot.className='place-slot';slot.dataset.position=i;slot.setAttribute('aria-label',`소환 위치 ${i+1}`);slot.style.left=(x-rect.left)+'px';slot.textContent='+';
    slot.onclick=e=>{e.stopPropagation();if(placing())placeSelected(i);};row.append(slot);
  }
}
function placeSelected(position){
  const c=game.players[0].hand.find(c=>c.uid===selected?.uid);if(!c||busy)return;
  if(definitionOf(c).type!=='location'&&definitionOf(c).target){selected.position=position;render();}
  else perform({...selected,position});
}
async function perform(action,p=0){
  if(busy||!game)return false;
  if(online)return networkAction(action);
  const before=snapshot(game,app);
  if(action.type==='play'){
    const c=game.players[p].hand.find(c=>c.uid===action.uid);
    if(c&&!(p===1&&definitionOf(c).secret)){const wrapper=document.createElement('div');wrapper.innerHTML=cardHTML({...definitionOf(c),cost:c.cost});before.cardNode=wrapper.firstElementChild;before.cardId=c.id;}
  }
  if(!applyAction(game,p,action)){render();toast('지금은 그 행동을 할 수 없습니다.');return false;}
  if(p===0&&action.type==='play'){advance(profile,'play');if(before.cardId&&BY_ID[before.cardId]?.type==='spell')advance(profile,'spell');saveProfile();}
  selected=null;busy=true;document.body.classList.add('busy');hidePeek();$('#target-arrow').style.display='none';save();sound(action.type);
  try{await actionEffect(action,p,app,before);}catch(error){console.error('전투 연출 오류',error);}
  finally{render();try{await resultEffects(game,app,before);}finally{busy=false;document.body.classList.remove('busy');}}
  scheduleAI();return true;
}
function scheduleAI(){clearTimeout(aiTimer);if(online||!game||game.phase!=='play'||game.current!==1||view!=='battle')return;aiTimer=setTimeout(()=>{if(busy||dialog.open||view!=='battle'){scheduleAI();return;}perform(chooseAI(game),1);},800);}
function hidePeek(){const pane=$('#peek');if(pane)pane.hidden=true;}
function peek(c,anchor,hand=false){
  if(busy||selected||drag?.moving||dialog.open)return;
  const pane=$('#peek');if(!pane)return;
  pane.innerHTML=cardHTML(c,'preview-card','tabindex="-1"')+mathPanel(c);pane.hidden=false;
  const r=anchor.getBoundingClientRect(),w=pane.offsetWidth,h=pane.offsetHeight;
  pane.style.left=Math.max(8,Math.min(innerWidth-w-8,hand?r.left+r.width/2-w/2:r.left>innerWidth/2?r.left-w-16:r.right+16))+'px';
  pane.style.top=hand?Math.max(8,innerHeight-h-16)+'px':Math.max(8,Math.min(innerHeight-h-8,r.top-40))+'px';
}
function inspect(c){
  const text=cardRules(c),note=c.mathNote||BY_ID[c.id]?.mathNote,keywords=keywordHelp(text),formula=c.formula||c.target==='function';
  showDialog(`<button class="close" data-close aria-label="닫기">×</button><div class="card-inspection">${cardHTML(c,'detail-card')}${mathPanel(c)}<blockquote>${esc(c.flavor||BY_ID[c.id]?.flavor||'')}</blockquote>${note||keywords||formula?`<details><summary>규칙</summary>${note?`<p>${esc(note)}</p>`:''}${formula?'<p>공격력은 함수값의 내림값입니다. x는 소환할 때 1이며 미분·적분 후에도 유지됩니다. 함수는 16차, 함수 공격력은 9999까지입니다.</p>':''}${keywords}</details>`:''}${c.silenced?'<p>침묵</p>':''}</div>`);
  if(['collection','decks','deckmanage'].includes(view)&&BY_ID[c.id]){
    const [cost,value]=DUST[c.rarity||'common'],owned=profile.collection[c.id]||0;
    dialog.insertAdjacentHTML('beforeend',`<div class="craft-actions"><span>보유 ${owned} · 가루 ${profile.dust}</span><div><button id="craft-card" class="gold-button" ${profile.dust<cost?'disabled':''}>제작 ${cost}</button><button id="dust-card" class="outline-button" ${owned<=reservedCopies(profile,c.id)?'disabled':''} title="저장된 덱에 필요한 카드는 분해하지 않습니다.">분해 +${value}</button></div></div>`);
    const refresh=()=>{saveProfile();renderCollection(view==='collection');inspect(c);};
    $('#craft-card').onclick=()=>{if(craftCard(profile,c.id))refresh();};$('#dust-card').onclick=()=>{if(disenchantCard(profile,c.id))refresh();};
  }
}
function keywordHelp(t){return [['속공','소환한 턴에는 하수인을 공격할 수 있습니다. 영웅은 다음 턴부터 공격할 수 있습니다.'],['질풍','한 턴에 두 번 공격할 수 있습니다.'],['은신','공격하기 전까지 적이 공격이나 주문, 영웅 능력의 대상으로 지정할 수 없습니다. 광역 피해는 받습니다.'],['독성','이 하수인이 실제 피해를 준 하수인을 처치합니다. 천상의 보호막에는 막힙니다.'],['환생','처음 죽으면 강화 효과가 없는 원본을 생명력 1로 소환합니다.'],['빙결','다음 공격 기회를 건너뜁니다.'],['생명력 흡수','실제로 준 피해만큼 내 영웅을 회복합니다.'],['주문 공격력','주문으로 주는 피해가 증가합니다. 영웅 능력과 죽음의 메아리는 증가하지 않습니다.'],['비밀','상대 턴에 조건이 맞으면 공개되고 한 번 발동한 뒤 사라집니다.'],['발견','제시된 세 카드 중 하나를 골라 손으로 가져옵니다.'],['전투의 함성','손에서 낼 때 한 번 발동합니다. 복사·부활 소환으로는 발동하지 않습니다.'],['죽음의 메아리','생명력이 0 이하가 되어 죽을 때 발동합니다. 되돌리기·변신·소멸은 죽음이 아닙니다.'],['도발','적은 도발 하수인을 먼저 공격해야 합니다. 주문의 대상은 제한하지 않습니다.'],['천상의 보호막','다음 피해 한 번을 막습니다. 처치·소멸·능력치 변경은 막지 않습니다.'],['돌진','소환한 턴에도 바로 공격할 수 있습니다.'],['침묵','지속 능력·강화 효과·도발·보호막·돌진을 제거하고 기본 능력치로 돌아갑니다. 입은 피해를 전부 회복하지는 않습니다.'],['원본','강화 효과 없이 수집 카드에 적힌 기본 상태로 돌아옵니다. 소환물은 부활·원본 회수 대상에 포함되지 않습니다.']].filter(([k])=>t.includes(k)).map(([k,v])=>`<p><b>${k}</b> ${v}</p>`).join('');}
function showResult(){
  if(!game||game.phase!=='over'||dialog.open)return;
  if(online?.seat!==-1&&recordMatch(profile,game))saveProfile();
  showDialog(`<div class="result-seal">${game.winner===0?'∎':game.winner==='draw'?'=':'∅'}</div><h1 class="result-title">${game.winner===0?'승리':game.winner==='draw'?'무승부':'패배'}</h1><p>${game.turn}턴 · ${heroOf(game.players[0]).name}</p><div class="menu-bottom"><button class="gold-button" id="again">다음 대전</button><button class="outline-button" id="result-home">메인으로</button><button class="text-button" id="result-log">대전 기록</button></div>`);
  if(online){$('#again').textContent='대전방으로';if(online.seat===-1)dialog.querySelector('.result-title').textContent=game.winner==='draw'?'무승부':`${online.names[game.winner]} 승리`;}
  $('#again').onclick=()=>navigate(online?'online':'setup');$('#result-home').onclick=()=>navigate('home');$('#result-log').onclick=()=>navigate('history');
}
function renderCollection(editing=true){
  const list=CARDS.filter(c=>(school==='전체'||(school==='새 카드'?!!c.set:c.school===school))&&(type==='전체'||(type==='mathematician'?c.mathematician:c.type===type))&&(costFilter==='전체'||(costFilter==='7+'?c.cost>=7:c.cost===Number(costFilter)))&&(c.name+' '+cardRules(c)).includes(filter));
  const pageSize=innerWidth<700?4:8,pages=Math.max(1,Math.ceil(list.length/pageSize));collectionPage=Math.min(collectionPage,pages-1);
  const deck=profile.decks.find(d=>d.id===activeDeckId),count=c=>custom.filter(id=>id===c.id).length,limit=c=>Math.min(c.rarity==='legendary'?1:2,profile.collection[c.id]||0);
  app.innerHTML=`<div class="book-stage"><section class="collection-book"><div class="book-tabs">${['전체','생성','변환','역설','새 카드'].map(x=>`<button class="${school===x?'active':''}" data-school="${x}">${x}</button>`).join('')}</div><h1 class="book-heading">${school==='전체'?'모든 카드':school==='새 카드'?'새 카드':school}</h1><div class="book-card-grid">${list.slice(collectionPage*pageSize,(collectionPage+1)*pageSize).map(c=>`<div class="book-card-slot">${cardHTML(c,'',`data-card="${c.id}"`)}<button class="book-count" data-add="${c.id}" ${!editing||custom.length>=30||count(c)>=limit(c)||(c.heroClass&&c.heroClass!==HEROES[heroIndex].id)?'disabled':''}>${editing?count(c)+' / '+limit(c)+' ＋':'×'+(profile.collection[c.id]||0)}</button></div>`).join('')||'<p class="book-empty">검색 결과가 없습니다.</p>'}</div><div class="book-pagination"><button id="page-prev" aria-label="이전 페이지" ${collectionPage===0?'disabled':''}>◀</button><span>${collectionPage+1} / ${pages}</span><button id="page-next" aria-label="다음 페이지" ${collectionPage===pages-1?'disabled':''}>▶</button></div><div class="book-toolbar"><div class="cost-filters">${['전체',0,1,2,3,4,5,6,'7+'].map(x=>`<button data-cost="${x}" class="${String(x)===costFilter?'active':''}" aria-label="${x==='전체'?'모든 비용':x+'마나'}">${x==='전체'?'∞':x}</button>`).join('')}</div><input id="search" placeholder="검색" aria-label="카드 검색" value="${esc(filter)}"><select id="type-filter" aria-label="카드 종류"><option value="전체">모든 종류</option>${['minion','spell','weapon','location','hero','mathematician'].map(t=>`<option value="${t}" ${type===t?'selected':''}>${typeName({type:t})}</option>`).join('')}</select></div><aside class="book-sidebar">${editing?`<div class="book-deck-heading" style="${heroStyle(HEROES[heroIndex])}"><input id="deck-name" aria-label="덱 이름" maxlength="30" value="${esc(deck?.name||'새 덱')}"></div><select id="custom-hero" aria-label="내 덱의 영웅">${HEROES.map((h,i)=>`<option value="${i}" ${heroIndex===i?'selected':''}>${h.name}</option>`).join('')}</select><div class="book-deck-list">${[...new Set(custom)].sort((a,b)=>BY_ID[a].cost-BY_ID[b].cost).map(id=>`<button data-remove="${id}" title="한 장 빼기" style="${artStyle(BY_ID[id])}"><i>${BY_ID[id].cost}</i><span>${BY_ID[id].name}</span><b>×${custom.filter(x=>x===id).length}</b></button>`).join('')||'<p>카드 아래 ＋를 눌러<br>덱에 추가하세요.</p>'}</div><div class="book-deck-bottom"><strong>${custom.length}/30장</strong>${manaCurve(custom)}<select id="fill-deck" aria-label="견본 불러오기"><option value="">견본 불러오기</option>${PRESETS.map((d,i)=>`<option value="${i}">${d.name}</option>`).join('')}</select><button class="gold-button" id="custom-play" ${validateDeck(custom,HEROES[heroIndex].id)?'':'disabled'}>대전</button><button class="text-button" id="clear-deck">덱 비우기</button></div>`:`<h2>내 덱</h2><div class="book-saved-list">${profile.decks.map(d=>`<button class="deck-ribbon" data-edit="${d.id}" style="${heroStyle(HEROES[d.hero])}"><b>${esc(d.name)}</b><small>${d.ids.length}/30</small></button>`).join('')}<button class="new-ribbon" id="book-new">＋ 새 덱</button></div><div class="book-deck-bottom"><span>${Object.values(profile.collection).filter(n=>n>0).length}종 보유</span><button class="outline-button" id="book-manage">덱 관리</button></div>`}</aside><button class="book-back" id="book-back">${editing?'완료':'뒤로'}</button></section></div>`;
  const update=()=>renderCollection(editing);
  app.querySelectorAll('[data-card]').forEach(el=>el.onclick=()=>inspect(BY_ID[el.dataset.card]));
  app.querySelectorAll('[data-add]').forEach(el=>el.onclick=()=>{custom.push(el.dataset.add);persistDeck();update();});
  app.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{custom.splice(custom.indexOf(el.dataset.remove),1);persistDeck();update();});
  app.querySelectorAll('[data-school]').forEach(el=>el.onclick=()=>{school=el.dataset.school;collectionPage=0;update();});
  app.querySelectorAll('[data-cost]').forEach(el=>el.onclick=()=>{costFilter=el.dataset.cost;collectionPage=0;update();});
  $('#search').oninput=e=>{const pos=e.target.selectionStart;filter=e.target.value;collectionPage=0;update();$('#search').focus();$('#search').setSelectionRange(pos,pos);};
  $('#type-filter').onchange=e=>{type=e.target.value;collectionPage=0;update();};
  $('#page-prev').onclick=()=>{collectionPage--;update();};$('#page-next').onclick=()=>{collectionPage++;update();};$('#book-back').onclick=()=>navigate(editing?'decks':'home');
  if(editing){
    $('#deck-name').oninput=e=>{persistDeck();profile.decks.find(d=>d.id===activeDeckId).name=e.target.value;saveProfile();};
    $('#fill-deck').onchange=e=>{if(e.target.value!==''){custom=deckFor(Number(e.target.value));persistDeck();update();}};
    $('#clear-deck').onclick=()=>{custom=[];persistDeck();update();};
    $('#custom-hero').onchange=e=>{heroIndex=Number(e.target.value);persistDeck();update();};$('#custom-play').onclick=()=>startGame(custom);
  }else{
    app.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>editDeck(el.dataset.edit));
    $('#book-new').onclick=showNewDeck;$('#book-manage').onclick=()=>navigate('deckmanage');
  }
}
function navigate(next){
  if(busy)return;
  clearTimeout(aiTimer);clearPointer();selected=null;hidePeek();dialog.close();
  if(game?.phase==='play'&&!online){
    if(view==='battle'&&next!=='battle')game.pausedAt=Date.now();
    if(next==='battle'&&game.pausedAt){if(game.deadline)game.deadline+=Date.now()-game.pausedAt;delete game.pausedAt;}
    save();
  }
  view=next;render();if(next==='battle'){if(game?.phase==='mulligan')showMulligan();else scheduleAI();}
}
function screen(title,body,back='home'){
  app.innerHTML=`<section class="room-screen ${view==='setup'?'hs-setup':''}"><header class="room-heading"><button class="back-button" id="screen-back">‹ 뒤로</button><h1>${title}</h1><span class="room-mark">∎</span></header>${body}</section>`;
  $('#screen-back').onclick=()=>navigate(back);
}
function renderHome(){
  const ongoing=game&&game.phase!=='over';
  app.innerHTML=`<section class="hub-stage"><div class="hub-chest"><h1>매스스톤</h1><nav class="hub-actions" aria-label="메인 메뉴"><button data-go="setup">대전</button><button data-go="arena">투기장</button><button id="home-brawl">선술집 난투</button><button data-go="modes">게임 모드</button></nav><nav class="hub-utilities"><button data-go="rewards">보상</button><button data-go="online">대전방</button><button data-go="history">기록</button><button data-go="settings">설정</button></nav><button class="hub-shop" data-go="shop">상점</button><button class="hub-plaque left" data-go="packs">카드팩</button><button class="hub-plaque right" data-go="decks">내 카드</button>${ongoing?'<button class="hub-resume" id="resume">이어 하기</button>':''}</div></section>`;
  app.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{if(el.dataset.go==='setup')matchMode='casual';navigate(el.dataset.go);});$('#resume')?.addEventListener('click',()=>navigate('battle'));$('#home-brawl').onclick=()=>{matchMode='brawl';deckIndex=9;setupDeckId=null;navigate('setup');};
}
function renderPacks(justRevealed=null){
  const opening=profile.opening,all=opening?.revealed.length===5;
  app.innerHTML=`<section class="pack-room"><header class="pack-header"><button class="outline-button" id="packs-back">뒤로</button><h1>카드팩</h1><span>보관함 ${profile.packs}</span></header>${opening?`<div class="pack-reveal ${opening.revealed.length?'':'unopened'}" aria-label="카드팩 개봉">${opening.cards.map((id,i)=>{const c=BY_ID[id],revealed=opening.revealed.includes(i);return `<div class="pack-slot ${c.rarity||'common'} ${revealed?'revealed':''} ${revealed&&(justRevealed===i||justRevealed==='all')?'fresh':''}" style="--pack-index:${i}">${revealed?cardHTML(c,'pack-card',`data-pack-inspect="${id}"`):`<button class="sealed-card" data-reveal="${i}" aria-label="${i+1}번째 카드 공개"><span>∑</span></button>`}${revealed?`<span class="pack-rarity">${{rare:'희귀',epic:'특급',legendary:'전설'}[c.rarity]||'일반'} <small>×${profile.collection[id]}</small></span>`:''}</div>`;}).join('')}</div><div class="pack-controls"><button class="gold-button" id="pack-next">${all?'완료':'모두 공개'}</button></div>`:`<div class="pack-pedestal"><div class="pack-orbit" aria-hidden="true"></div><button class="sealed-pack" id="open-pack" aria-label="카드팩 열기" ${profile.packs?'':'disabled'}><span class="pack-title">무한의 서고</span><i>∑</i><span class="pack-seal">MATHSTONE</span></button></div><div class="pack-controls"><button class="gold-button" id="open-pack-button" ${profile.packs?'':'disabled'}>팩 열기</button><button class="text-button" id="claim-packs">팩 5개 받기</button></div>`}</section>`;
  $('#packs-back').onclick=()=>navigate('home');
  const open=()=>{if(openPack(profile)){saveProfile();sound();renderPacks();}};
  $('#open-pack')?.addEventListener('click',open);$('#open-pack-button')?.addEventListener('click',open);
  $('#claim-packs')?.addEventListener('click',()=>{profile.packs+=5;saveProfile();renderPacks();});
  app.querySelectorAll('[data-reveal]').forEach(el=>el.onclick=()=>{if(revealPackCard(profile,Number(el.dataset.reveal))){saveProfile();sound();renderPacks(Number(el.dataset.reveal));}});
  app.querySelectorAll('[data-pack-inspect]').forEach(el=>el.onclick=()=>inspect(BY_ID[el.dataset.packInspect]));
  $('#pack-next')?.addEventListener('click',()=>{if(all)finishPack(profile);else for(let i=0;i<5;i++)revealPackCard(profile,i);saveProfile();renderPacks(all?null:'all');});
}
function wallet(){return `<div class="wallet"><span aria-label="골드 ${profile.gold}"><i class="currency-coin" aria-hidden="true"></i>${profile.gold}</span><span aria-label="가루 ${profile.dust}"><i class="currency-dust" aria-hidden="true"></i>${profile.dust}</span><span aria-label="카드팩 ${profile.packs}"><i class="currency-pack" aria-hidden="true"></i>${profile.packs}</span></div>`;}
function cabinet(title,content){app.innerHTML=`<section class="cabinet-stage"><div class="game-cabinet"><h1 class="cabinet-title">${title}</h1>${content}<button class="cabinet-back" id="screen-back">뒤로</button></div></section>`;$('#screen-back').onclick=()=>navigate('home');}
function renderShop(quantity=1){
  cabinet('상점',`<div class="shop-display"><h2>무한의 서고</h2><div class="shop-fan" aria-hidden="true">${['monster','pythagoras-person','rabbit'].map(id=>cardHTML(BY_ID[id],'shop-sample','tabindex="-1"')).join('')}<div class="sealed-pack"><span class="pack-title">무한의 서고</span><i>∑</i><span class="pack-seal">MATHSTONE</span></div></div><p class="shop-caption">카드 5장 · 희귀 이상 1장 보장</p></div><aside class="cabinet-aside shop-purchase">${wallet()}<h2>카드팩</h2><button class="purchase-option" data-quantity="1" aria-pressed="${quantity===1}" ${profile.gold<100?'disabled':''}><b>1팩</b><span><i class="currency-coin" aria-hidden="true"></i>100</span></button><button class="purchase-option" data-quantity="5" aria-pressed="${quantity===5}" ${profile.gold<500?'disabled':''}><b>5팩</b><span><i class="currency-coin" aria-hidden="true"></i>500</span></button><button class="gold-button" data-buy="${quantity}" ${profile.gold<quantity*100?'disabled':''}>구매 · ${quantity*100} 골드</button><div class="shop-stock">보관함 <b>${profile.packs}</b></div><button class="gold-button" id="shop-open">카드팩 열기</button><button class="text-button" id="extra-dust" title="일반 2장, 전설 1장과 저장된 덱의 필요 수량을 남깁니다.">초과 카드 분해</button></aside>`);
  app.querySelectorAll('[data-quantity]').forEach(el=>el.onclick=()=>renderShop(Number(el.dataset.quantity)));
  app.querySelectorAll('[data-buy]').forEach(el=>el.onclick=()=>{if(purchasePacks(profile,Number(el.dataset.buy))){saveProfile();renderShop();}});$('#shop-open').onclick=()=>navigate('packs');$('#extra-dust').onclick=()=>{const n=disenchantExtras(profile);saveProfile();renderShop();toast(`가루 +${n}`);};
}
function renderRewards(tab='quests',page=null){
  advance(profile,'refresh');saveProfile();const level=Math.floor(profile.xp/200);let start=1;while(start<=level&&profile.rewardClaims.includes(start))start++;
  const entries=tab==='quests'?QUESTS.map(q=>({id:q.id,name:q.name,goal:q.goal,value:profile.quests.progress[q.id]||0,claimed:profile.quests.claimed.includes(q.id),reward:`${q.gold} 골드 · ${q.xp} XP`,kind:'quest'})):ACHIEVEMENTS.map(a=>({id:a.id,name:a.name,objective:({wins:`대전 ${a.goal}회 승리`,games:`대전 ${a.goal}회 완료`,packs:`카드팩 ${a.goal}개 개봉`,spells:`주문 ${a.goal}회 시전`,crafted:`카드 ${a.goal}장 제작`})[a.stat],goal:a.goal,value:profile.stats[a.stat],claimed:profile.achievementClaims.includes(a.id),reward:'카드팩 1개 · 100 XP',kind:'achievement'}));
  const pageCount=Math.max(1,Math.ceil((level+5)/5)),current=Math.max(0,Math.min(pageCount-1,page??Math.floor((start-1)/5)));start=current*5+1;
  const title={quests:'퀘스트',achievements:'업적',track:'보상의 길'}[tab];
  const body=tab==='track'?`<div class="journal-xp"><span class="level-medallion">${level}</span><div><b>보상의 길</b><progress aria-label="다음 레벨" max="200" value="${profile.xp%200}"></progress><small>${profile.xp%200} / 200 XP</small></div></div><div class="reward-map">${Array.from({length:5},(_,i)=>start+i).map(n=>`<article class="reward-node ${n<=level?'unlocked':''} ${profile.rewardClaims.includes(n)?'claimed':''}"><div class="reward-treasure" aria-hidden="true"><i class="${n%3===0?'currency-pack':'currency-coin'}"></i></div><b>${n}</b><p>100 골드${n%3===0?'<br>카드팩 1개':''}</p><button class="gold-button" data-level="${n}" ${n>level||profile.rewardClaims.includes(n)?'disabled':''}>${profile.rewardClaims.includes(n)?'수령함':n>level?'잠김':'받기'}</button></article>`).join('')}</div><div class="journal-pagination"><button id="reward-prev" aria-label="이전 보상" ${current===0?'disabled':''}>◀</button><span>${current+1} / ${pageCount}</span><button id="reward-next" aria-label="다음 보상" ${current===pageCount-1?'disabled':''}>▶</button></div>`:`<h2 class="quest-category">${tab==='quests'?'일일 퀘스트':'업적'}</h2><div class="quest-scrolls ${tab==='achievements'?'achievement-scrolls':''}">${entries.map((q,i)=>`<article class="quest-scroll ${q.claimed?'claimed':''}"><div class="scroll-reward">${q.reward}</div><div class="scroll-illustration" style="--px:${((tab==='quests'?i:i+3)%4)*100/3}%;--py:${Math.floor((tab==='quests'?i:i+3)/4)*100}%" aria-hidden="true"></div><h2>${q.name}</h2>${q.objective?`<p class="quest-objective">${q.objective}</p>`:''}<div class="scroll-progress"><progress aria-label="${q.name} 진행" max="${q.goal}" value="${Math.min(q.goal,q.value)}"></progress><span>${Math.min(q.goal,q.value)} / ${q.goal}</span></div><button class="gold-button" data-${q.kind}="${q.id}" ${q.claimed||q.value<q.goal?'disabled':''}>${q.claimed?'수령함':'받기'}</button></article>`).join('')}</div>`;
  app.innerHTML=`<section class="journal-stage"><div class="journal-frame"><h1>${title}</h1><nav class="journal-tabs" aria-label="보상 종류">${[['quests','퀘스트'],['track','보상'],['achievements','업적']].map(([id,name])=>`<button data-reward-tab="${id}" aria-pressed="${tab===id}">${name}</button>`).join('')}</nav><div class="journal-page">${body}</div><footer>${wallet()}<button class="cabinet-back" id="screen-back">뒤로</button></footer></div></section>`;
  $('#screen-back').onclick=()=>navigate('home');app.querySelectorAll('[data-reward-tab]').forEach(el=>el.onclick=()=>renderRewards(el.dataset.rewardTab));
  $('#reward-prev')?.addEventListener('click',()=>renderRewards('track',current-1));$('#reward-next')?.addEventListener('click',()=>renderRewards('track',current+1));
  for(const [selector,key,claim] of [['[data-quest]','quest',claimQuest],['[data-achievement]','achievement',claimAchievement],['[data-level]','level',claimLevel]])app.querySelectorAll(selector).forEach(el=>el.onclick=()=>{if(claim(profile,key==='level'?Number(el.dataset[key]):el.dataset[key])){saveProfile();renderRewards(tab,current);}});
}
function renderModes(chosen='casual'){
  const modes=[['casual','일반전'],['ranked','연습 등급전'],['arena','투기장'],['brawl','선술집 난투']];
  const current=modes.find(m=>m[0]===chosen)||modes[0],description={casual:'컴퓨터 대전 · 등급 변동 없음',ranked:`컴퓨터 대전 · ${rankName(profile.rankStars)}`,arena:'카드 3장 중 1장씩 선택. 30장으로 덱을 꾸려 12승에 도전하세요. 3패하면 종료됩니다.',brawl:'미분 폭풍: 일반 하수인도 x² 함수가 됩니다. 내 턴 시작마다 x +2.'};
  cabinet('모드 선택',`<div class="mode-medallions">${modes.map(([id,name])=>`<button class="mode-plaque ${id===chosen?'chosen':''}" data-pick-mode="${id}" aria-pressed="${id===chosen}"><span class="mode-portrait" data-mode-art="${id}" aria-hidden="true"></span><span class="mode-name">${name}</span></button>`).join('')}</div><aside class="cabinet-aside mode-detail"><span class="mode-portrait" data-mode-art="${current[0]}" aria-hidden="true"></span><h2>${current[1]}</h2><p>${esc(description[chosen])}</p><button class="gold-button" id="choose-mode">선택</button></aside>`);
  app.querySelectorAll('[data-pick-mode]').forEach(el=>el.onclick=()=>renderModes(el.dataset.pickMode));$('#choose-mode').onclick=()=>{if(chosen==='arena'){navigate('arena');return;}matchMode=chosen;if(chosen==='brawl'){deckIndex=9;setupDeckId=null;}navigate('setup');};
}
function renderArena(chosen=0){
  const a=profile.arena;
  if(!a){
    const hero=HEROES[chosen];
    cabinet('투기장',`<section class="arena-selection"><h2>영웅 선택</h2><div class="arena-heroes">${HEROES.map((h,i)=>`<button class="arena-hero ${i===chosen?'chosen':''}" data-draft-hero="${i}" aria-pressed="${i===chosen}"><span style="${heroStyle(h)}"></span><b>${h.name}</b></button>`).join('')}</div></section><aside class="cabinet-aside"><h2>${hero.power}</h2><p>${hero.text}</p><span class="arena-power-cost">${hero.cost}마나 · 턴마다 한 번</span><button class="gold-button" id="arena-hero-confirm">선택</button></aside>`);
    $('#screen-back').onclick=()=>navigate('modes');app.querySelectorAll('[data-draft-hero]').forEach(el=>el.onclick=()=>renderArena(Number(el.dataset.draftHero)));$('#arena-hero-confirm').onclick=()=>{startArena(profile,chosen);saveProfile();renderArena();};return;
  }
  const drafting=a.ids.length<30;
  cabinet('투기장',`<section class="arena-selection"><h2>${drafting&&!a.finished?'카드 선택':a.finished?'도전 종료':'투기장'}</h2>${drafting&&!a.finished?`<div class="draft-options">${a.options.map((id,i)=>cardHTML(BY_ID[id],'',`data-draft-pick="${i}"`)).join('')}</div>${manaCurve(a.ids)}`:`<div class="arena-run"><strong>${a.wins}승 <small>${a.losses}패</small></strong>${a.finished?`<p>${50+a.wins*25} 골드 · 카드팩 ${1+Math.floor(a.wins/4)}개</p><button class="gold-button" id="arena-claim">보상 받기</button>`:'<button class="gold-button" id="arena-play">시작</button>'}</div>`}</section><aside class="cabinet-aside arena-deck"><h2>${HEROES[a.hero].name}</h2><span>${a.ids.length}/30장</span><div class="arena-deck-list">${[...new Set(a.ids)].sort((x,y)=>BY_ID[x].cost-BY_ID[y].cost).map(id=>`<p><i>${BY_ID[id].cost}</i><span>${esc(BY_ID[id].name)}</span><b>×${a.ids.filter(x=>x===id).length}</b></p>`).join('')}</div>${!a.finished?'<button class="text-button" id="arena-retire">기권</button>':''}</aside>`);
  $('#screen-back').onclick=()=>navigate('modes');
  app.insertAdjacentHTML('beforeend','<div id="peek" class="card-peek" hidden></div>');
  app.querySelectorAll('[data-draft-pick]').forEach(el=>{
    const index=Number(el.dataset.draftPick),card=BY_ID[a.options[index]];
    el.onclick=()=>{draftCard(profile,index);saveProfile();renderArena();};
    el.onmouseenter=el.onfocus=()=>peek(card,el);el.onmouseleave=el.onblur=hidePeek;
    el.oncontextmenu=e=>{e.preventDefault();hidePeek();inspect(card);};
  });$('#arena-play')?.addEventListener('click',()=>{heroIndex=a.hero;startGame(a.ids,'arena');});$('#arena-claim')?.addEventListener('click',()=>{claimArena(profile);saveProfile();renderArena();});$('#arena-retire')?.addEventListener('click',()=>{a.finished=true;saveProfile();renderArena();});
}
async function roomRequest(path,body,token){
  const response=await fetch(`/api/rooms${path}`,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'대전방 요청에 실패했습니다.');return data;
}
function receiveRoom(data){
  if(!online||online.code!==data.code)return;
  online.names=data.names;online.seat=data.seat;online.error='';if(online.revision===data.revision)return;online.revision=data.revision;
  if(data.state){game=orientState(data);selected=null;if(view==='online')view='battle';if(view==='battle'){dialog.close();render();if(game.phase==='mulligan')showMulligan();}}
  else if(view==='online')renderOnline();
}
async function pollRoom(){
  clearTimeout(onlineTimer);if(!online)return;
  try{if(!busy){const data=await roomRequest(`/${online.code}`,undefined,online.token);receiveRoom(data);}}
  catch(error){if(online){online.error=error.message;if(view==='online')renderOnline();}}
  if(online)onlineTimer=setTimeout(pollRoom,1000);
}
function enterRoom(credentials){
  offlineGame=game;clearTimeout(aiTimer);online={...credentials,revision:-1,names:[]};if(credentials.seat!==-1)storage.set('mathstone-online-v1',credentials);view='online';dialog.close();render();pollRoom();
}
async function networkAction(action){
  if(!online||online.seat===-1||busy)return false;busy=true;
  try{const data=await roomRequest(`/${online.code}/actions`,serverAction(action,online.seat),online.token);if(action.type==='play'){const id=game.players[0].hand.find(c=>c.uid===action.uid)?.id;advance(profile,'play');if(BY_ID[id]?.type==='spell')advance(profile,'spell');saveProfile();}receiveRoom(data);return true;}
  catch(error){toast(error.message);return false;}finally{busy=false;}
}
function renderOnline(){
  const savedRoom=storage.get('mathstone-online-v1'),contacts=(storage.get('mathstone-contacts-v1')||[]).filter(x=>x&&typeof x.code==='string'&&typeof x.name==='string');
  if(online){
    screen(online.seat===-1?'관전':'대전방',`<div class="system-panel online-panel"><h2 class="room-code">${esc(online.code)}</h2><p>${online.names.map(esc).join(' vs ')||'연결 중'}</p><p>${esc(online.error||(!game||game.mode!=='online'?'상대의 참가를 기다리는 중':''))}</p><div class="menu-bottom"><button class="outline-button" id="copy-room">방 코드 복사</button>${game?.mode==='online'?'<button class="gold-button" id="room-battle">전장으로</button>':''}<button class="outline-button" id="room-leave">방 나가기</button></div><button class="text-button" id="save-contact">방 저장</button></div>`);
    $('#copy-room').onclick=async()=>{try{await navigator.clipboard.writeText(online.code);toast('방 코드를 복사했습니다.');}catch{toast(online.code);}};
    $('#room-battle')?.addEventListener('click',()=>{view='battle';render();if(game.phase==='mulligan')showMulligan();});
    $('#room-leave').onclick=async()=>{if(online.seat!==-1&&game?.mode==='online'&&game.phase!=='over'){if(!await networkAction({type:'concede'}))return;}clearTimeout(onlineTimer);online=null;storage.set('mathstone-online-v1',null);game=offlineGame;offlineGame=null;document.body.classList.remove('spectating');navigate('online');};
    $('#save-contact').onclick=()=>{if(!contacts.some(x=>x.code===online.code))contacts.push({code:online.code,name:online.names.join(' / ')||online.code});storage.set('mathstone-contacts-v1',contacts);toast('방을 저장했습니다.');};return;
  }
  const options=[...PRESETS.map((d,i)=>({key:`preset:${i}`,name:d.name})),...profile.decks.map(d=>({key:`saved:${d.id}`,name:d.name}))];
  screen('대전방',`<div class="system-grid"><section class="system-panel online-form"><h2>대전 준비</h2><label>이름<input id="online-name" maxlength="24" value="${esc(storage.get('mathstone-player-name')||'수학자')}"></label><label>영웅<select id="online-hero">${HEROES.map((h,i)=>`<option value="${i}">${h.name}</option>`).join('')}</select></label><label>덱<select id="online-deck">${options.map(d=>`<option value="${esc(d.key)}">${esc(d.name)}</option>`).join('')}</select></label><button class="gold-button" id="create-room">방 만들기</button>${savedRoom?.code&&savedRoom?.token?'<button class="outline-button" id="reconnect-room">이전 방 재접속</button>':''}</section><section class="system-panel online-form"><h2>방 코드</h2><input id="room-code" maxlength="6" placeholder="예: A1B2C3" aria-label="방 코드"><div class="menu-bottom"><button class="gold-button" id="join-room">참가</button><button class="outline-button" id="watch-room">관전</button></div><p id="online-error" role="alert"></p><h2>저장한 방</h2>${contacts.map((c,i)=>`<div class="reward-row"><button class="text-button" data-contact="${i}">${esc(c.name)} · ${esc(c.code)}</button><button class="text-button" data-forget="${i}" aria-label="저장한 방 삭제">×</button></div>`).join('')||'<p>저장한 방이 없습니다.</p>'}</section></div>`);
  const configuration=()=>{const value=$('#online-deck').value,hero=Number($('#online-hero').value),name=$('#online-name').value,deck=value.startsWith('preset:')?deckFor(Number(value.slice(7))):profile.decks.find(d=>d.id===value.slice(6))?.ids;storage.set('mathstone-player-name',name);return {hero,name,deck};};
  const connect=async kind=>{try{const code=$('#room-code').value.trim().toUpperCase();if(kind==='watch'){await roomRequest(`/${code}`);enterRoom({code,seat:-1});}else enterRoom(await roomRequest(kind==='create'?'':`/${code}/join`,configuration()));}catch(e){$('#online-error').textContent=e.message;}};
  $('#create-room').onclick=()=>connect('create');$('#join-room').onclick=()=>connect('join');$('#watch-room').onclick=()=>connect('watch');$('#reconnect-room')?.addEventListener('click',()=>enterRoom(savedRoom));
  app.querySelectorAll('[data-contact]').forEach(el=>el.onclick=()=>{$('#room-code').value=contacts[Number(el.dataset.contact)].code;});app.querySelectorAll('[data-forget]').forEach(el=>el.onclick=()=>{contacts.splice(Number(el.dataset.forget),1);storage.set('mathstone-contacts-v1',contacts);renderOnline();});
}
function renderSetup(){
  const selectedDeck=profile.decks.find(d=>d.id===setupDeckId)||profile.decks[0];
  setupDeckId=selectedDeck?.id||null;if(selectedDeck)heroIndex=selectedDeck.hero;
  const ids=selectedDeck?.ids||[],hero=HEROES[heroIndex],ready=validateDeck(ids,hero.id)&&ownsDeck(profile,ids),ongoing=game&&game.phase!=='over';
  screen(matchMode==='brawl'?'선술집 난투':'대전',`<div class="setup-layout"><section class="deck-shelf"><h2>내 덱</h2><div class="shelf-grid">${profile.decks.map(d=>`<button class="deck-box ${setupDeckId===d.id?'chosen':''}" data-saved="${d.id}" aria-pressed="${setupDeckId===d.id}"><span class="deck-banner" style="${heroStyle(HEROES[d.hero])}"><b>${esc(d.name)}</b></span><span class="deck-emblem">${HEROES[d.hero].icon}</span><small>${d.ids.length}/30장</small></button>`).join('')}<button class="deck-box new-deck-box" id="setup-new"><span class="deck-emblem">＋</span><b>새 덱</b></button></div>${!profile.decks.length?'<p class="deck-empty-hint">새 덱을 만들거나 견본을 골라 시작하세요.</p>':''}<button class="text-button" id="setup-edit">내 카드</button></section><aside class="hero-stand">${matchMode==='brawl'?'<div class="brawl-rule"><b>미분 폭풍</b><p>일반 하수인도 x² 함수가 됩니다.<br>내 턴 시작마다 x +2.</p></div>':`<nav class="play-mode-tabs" aria-label="대전 방식"><button data-play-mode="casual" aria-pressed="${matchMode==='casual'}">일반</button><button data-play-mode="ranked" aria-pressed="${matchMode==='ranked'}">등급</button></nav>`}<small class="opponent-label">컴퓨터 대전${matchMode==='ranked'?' · '+rankName(profile.rankStars):''}</small><div class="hero-stand-face" style="${heroStyle(hero)}"></div><h2>${hero.name}</h2><button class="hero-power-info" id="setup-power" aria-label="${hero.power} 능력 보기">${hero.power} <span>${hero.cost}</span></button><div class="chosen-deck-name">${selectedDeck?esc(selectedDeck.name):'덱을 선택하세요'}</div>${selectedDeck?manaCurve(ids):''}<button class="gold-button" id="setup-start" ${ready&&!ongoing?'':'disabled'}>시작</button>${selectedDeck&&!ready?'<small class="deck-warning">내 카드에서 덱을 완성하세요.</small>':''}${ongoing?'<button class="outline-button" id="setup-resume">이어 하기</button>':''}</aside></div>`);
  app.querySelectorAll('[data-saved]').forEach(el=>el.onclick=()=>{setupDeckId=el.dataset.saved;heroIndex=profile.decks.find(d=>d.id===setupDeckId).hero;renderSetup();});
  app.querySelectorAll('[data-play-mode]').forEach(el=>el.onclick=()=>{matchMode=el.dataset.playMode;renderSetup();});
  $('#setup-new').onclick=showNewDeck;$('#setup-power').onclick=()=>showDialog(`<button class="close" data-close aria-label="닫기">×</button><h2>${hero.power}</h2><p>${hero.cost}마나 · 턴마다 한 번</p><p>${hero.text}</p>`);
  $('#setup-edit').onclick=()=>navigate('decks');$('#setup-start').onclick=()=>startGame(ids);$('#setup-resume')?.addEventListener('click',()=>navigate('battle'));
}
function showNewDeck(){
  showDialog(`<button class="close" data-close aria-label="닫기">×</button><h2>새 덱</h2><label class="new-deck-hero">영웅 <select id="new-deck-hero" aria-label="영웅">${HEROES.map((h,i)=>`<option value="${i}">${h.name}</option>`).join('')}</select></label><div class="deck-recipes"><button class="recipe-choice" data-recipe="empty"><b>직접 만들기</b><small>빈 덱</small></button>${PRESETS.map((d,i)=>`<button class="recipe-choice" data-recipe="${i}"><b>${esc(d.name)}</b><small>덱 견본 · 30장</small></button>`).join('')}</div>`);
  dialog.querySelectorAll('[data-recipe]').forEach(el=>el.onclick=()=>{
    const index=el.dataset.recipe,hero=Number($('#new-deck-hero').value),ids=index==='empty'?[]:deckFor(Number(index));
    if(ids.length&&!validateDeck(ids,HEROES[hero].id))return toast('이 영웅으로 사용할 수 없는 견본입니다.');
    const deck={id:crypto.randomUUID(),name:index==='empty'?`내 덱 ${profile.decks.length+1}`:PRESETS[Number(index)].name,hero,ids};
    profile.decks.push(deck);setupDeckId=deck.id;saveProfile();editDeck(deck.id);
  });
}
function manaCurve(ids){const counts=Array.from({length:8},(_,i)=>ids.filter(id=>Math.min(7,BY_ID[id]?.cost)===i).length),max=Math.max(1,...counts);return `<div class="mana-curve" aria-label="마나 곡선">${counts.map((n,i)=>`<div title="${i===7?'7 이상':i}마나 ${n}장"><span>${n||''}</span><i style="height:${Math.max(2,n/max*32)}px"></i><b>${i===7?'7+':i}</b></div>`).join('')}</div>`;}
function editDeck(id){const d=profile.decks.find(d=>d.id===id);if(!d)return;activeDeckId=d.id;custom=d.ids;heroIndex=d.hero;navigate('collection');}
function renderDeckManagement(){
  renderCollection(false);
  showDialog(`<button class="close" data-close aria-label="닫기">×</button><h2>내 덱 관리</h2><div class="manage-deck-list">${profile.decks.map(d=>`<div class="manage-deck-row"><span>${esc(d.name)}<small>${HEROES[d.hero].name} · ${d.ids.length}/30장</small></span><button class="outline-button" data-edit="${d.id}">편집</button><button class="outline-button" data-export="${d.id}" ${validateDeck(d.ids,HEROES[d.hero].id)?'':'disabled'}>덱 코드</button></div>`).join('')}</div><div class="menu-bottom"><button class="gold-button" id="new-deck">새 덱</button><button class="outline-button" id="import-deck">덱 가져오기</button></div>`);
  const add=showNewDeck;
  $('#new-deck').onclick=add;
  dialog.querySelectorAll('[data-edit]').forEach(el=>el.onclick=()=>editDeck(el.dataset.edit));
  dialog.querySelectorAll('[data-export]').forEach(el=>el.onclick=()=>{
    const code=exportDeck(profile.decks.find(d=>d.id===el.dataset.export));showDialog(`<button class="close" data-close aria-label="닫기">×</button><h2>덱 코드</h2><textarea id="deck-code" readonly aria-label="덱 코드">${esc(code)}</textarea><button class="gold-button" id="copy-code">복사</button>`);
    $('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(code);toast('덱 코드를 복사했습니다.');}catch{$('#deck-code').select();toast('선택된 코드를 Ctrl+C로 복사하세요.');}};
  });
  $('#import-deck').onclick=()=>{showDialog('<button class="close" data-close aria-label="닫기">×</button><h2>덱 가져오기</h2><textarea id="deck-code" aria-label="덱 코드" placeholder="MATH1:…"></textarea><p id="import-error" role="alert"></p><button class="gold-button" id="import-confirm">가져오기</button>');$('#import-confirm').onclick=()=>{try{const d={...importDeck($('#deck-code').value.trim()),id:crypto.randomUUID()};profile.decks.push(d);saveProfile();editDeck(d.id);}catch(e){$('#import-error').textContent=e.message;}};};
}
function renderHistory(){
  const result=m=>m.winner===0?'승리':m.winner==='draw'?'무승부':'패배';
  screen('대전 기록',`<div class="match-ledger">${profile.history.length?`<div class="ledger-summary">${profile.history.length}전 · ${profile.history.filter(m=>m.winner===0).length}승</div><div class="ledger-rows">${profile.history.map((m,i)=>`<button class="ledger-row" data-match="${i}"><b class="${m.winner===0?'won':'lost'}">${result(m)}</b><span>${heroOf({hero:m.hero}).name} <small>vs</small> ${heroOf({hero:m.opponent}).name}</span><span>${m.turns}턴</span><time>${new Date(m.date).toLocaleDateString('ko-KR')}</time><i>›</i></button>`).join('')}</div>`:'<div class="empty-ledger"><span>∅</span><h2>대전 기록이 없습니다.</h2><button class="gold-button" id="history-play">대전 시작</button></div>'}</div>`);
  $('#history-play')?.addEventListener('click',()=>navigate('setup'));app.querySelectorAll('[data-match]').forEach(el=>el.onclick=()=>{const m=profile.history[Number(el.dataset.match)];showDialog(`<button class="close" data-close aria-label="닫기">×</button><h2>${result(m)} · ${m.turns}턴</h2><ol class="history">${(m.log||[]).map(l=>`<li><small>${l.turn||0}턴</small> ${esc(l.text)}</li>`).join('')}</ol>`);});
}
function renderSettings(){
  screen('설정',`<div class="settings-book"><label><span>효과음</span><input id="setting-sound" type="checkbox" ${soundOn?'checked':''}></label><label><span>음량</span><input id="setting-volume" type="range" min="0" max="100" value="${profile.settings.volume*100}"></label><label><span>턴 제한 시간<small>다음 대전부터 적용</small></span><select id="setting-timer">${[0,60,90].map(n=>`<option value="${n}" ${profile.settings.turnSeconds===n?'selected':''}>${n?n+'초':'제한 없음'}</option>`).join('')}</select></label><p>컴퓨터 대전은 메뉴에서 일시 정지됩니다. 대전방의 시간은 계속 흐릅니다.</p>${game&&game.phase!=='over'?'<button class="outline-button" id="setting-resume">이어 하기</button><button class="text-button" id="concede-game">항복</button>':''}</div>`);
  $('#setting-sound').onchange=e=>{soundOn=e.target.checked;profile.settings.sound=soundOn;saveProfile();};$('#setting-volume').oninput=e=>{profile.settings.volume=Number(e.target.value)/100;saveProfile();};$('#setting-timer').onchange=e=>{profile.settings.turnSeconds=Number(e.target.value);saveProfile();};
  $('#setting-resume')?.addEventListener('click',()=>navigate('battle'));$('#concede-game')?.addEventListener('click',()=>{if(online){networkAction({type:'concede'});return;}applyAction(game,0,{type:'concede'});save();recordMatch(profile,game);saveProfile();navigate('battle');});
}
function statusHTML(p){
  const pl=game?.players[p];if(!pl)return '';
  return `<div class="battle-status ${p?'enemy-status':'own-status'}">${(pl.secrets||[]).map(id=>`<button ${p||!BY_ID[id]?'':`data-secret="${id}"`} title="${p||!BY_ID[id]?'상대 비밀':esc(BY_ID[id].name)}" aria-label="${p||!BY_ID[id]?'상대 비밀':esc(BY_ID[id].name)}">?</button>`).join('')}${pl.quest?`<span title="주문 3회 시전: 8/8 도발 소환">∎ ${pl.quest.progress}/3</span>`:''}${pl.hanoi?`<button class="hanoi-status" data-hanoi="${p}" aria-label="${p?'상대':'내'} 하노이의 탑 열기">탑 · ${pl.hanoi.moves}회</button>`:''}</div>`;
}
function showHanoi(p=0){
  const tower=game?.players[p].hanoi;if(!tower)return;
  const active=p===0&&game.current===0&&game.phase==='play'&&!game.choice&&online?.seat!==-1;
  const moves=active&&game.players[p].mana>=1?hanoiMoves(tower.pegs):[];
  showDialog(`<button class="close" data-close aria-label="닫기">×</button><div class="hanoi-puzzle"><h2>하노이의 탑</h2><p>작은 원판 위에 큰 원판을 놓을 수 없습니다.</p><div class="hanoi-pegs">${tower.pegs.map((peg,i)=>`<div class="hanoi-peg" aria-label="기둥 ${i+1}, 아래부터 ${peg.join(', ')||'비어 있음'}"><div>${peg.map(n=>`<i style="--disk:${n}">${n}</i>`).join('')}</div><b>${i+1}</b></div>`).join('')}</div><p>${tower.moves}회 이동 · 오른쪽 기둥 완성: 방어도 +49</p><div class="hanoi-actions">${moves.map(m=>`<button class="gold-button" data-from="${m.from}" data-to="${m.to}">${m.from+1} → ${m.to+1}<small>1마나</small></button>`).join('')||`<span>${active?'마나가 부족합니다.':'내 턴에 이동할 수 있습니다.'}</span>`}</div></div>`);
  dialog.querySelectorAll('[data-from]').forEach(el=>el.onclick=async()=>{const from=Number(el.dataset.from),to=Number(el.dataset.to);dialog.close();await perform({type:'hanoiMove',from,to});if(game?.phase==='play'&&game.players[p].hanoi&&!game.choice)showHanoi(p);});
}
function showChoice(){
  const c=game.choice;if(!c||c.p!==0)return;
  if(c.kind==='monty-pick'||c.kind==='monty-switch'){
    const switching=c.kind==='monty-switch';
    showDialog(`<div class="monty-choice"><h2>${esc(c.title)}</h2><div class="monty-doors">${[0,1,2].map(i=>`<button class="monty-door ${switching&&i===c.opened?'opened':''} ${switching&&i===c.selected?'picked':''}" ${switching&&i===c.opened?'disabled':`data-choice="${switching?(i===c.selected?0:1):i}"`} aria-label="${i+1}번 문${switching?i===c.opened?' 염소 공개':i===c.selected?' 유지':' 교체':''}"><b>${i+1}</b><span>${switching?i===c.opened?'염소':i===c.selected?'유지':'교체':'선택'}</span></button>`).join('')}</div><p>${switching?'고르지 않은 염소 문이 열렸습니다.':'자동차 하나, 염소 둘.'}</p></div>`);
  }else if(c.kind==='frequency'){
    const values=minions(game,0).filter(m=>m.uid!==c.source).map(m=>Math.max(0,m.attack-(m.auraAttack||0)));
    showDialog(`<div class="frequency-choice"><h2>증폭할 주파수</h2><p>현재 공격력 [${values.join(', ')}]</p><div class="frequency-options">${c.options.map((k,i)=>`<button data-choice="${i}"><b>${k}</b><span>${k===0?'평균':'주파수 '+k}</span><small>[${amplifyFrequency(values,k).join(', ')}]</small></button>`).join('')}</div><p>현재 필드 기준 예상값 · 턴 종료에 적용</p></div>`);
  }else{
    const choices=c.kind==='discover'?c.options.map(id=>({...BY_ID[id],cost:Math.max(0,BY_ID[id].cost-2)})):[{...BY_ID.dilemma,name:'문을 연다',text:'도발 능력이 있는 3/6 염소를 소환합니다.',attack:3,health:6,type:'minion',cost:0},{...BY_ID.margin,name:'문을 바꾼다',text:'카드를 3장 뽑습니다.',cost:0}];
    showDialog(`<h2>${esc(c.title)}</h2><div class="choice-cards">${choices.map((d,i)=>cardHTML(d,'',`data-choice="${i}"`)).join('')}</div>`);
  }
  dialog.querySelectorAll('[data-choice]').forEach(el=>el.onclick=()=>{const index=Number(el.dataset.choice);dialog.close();perform({type:'choose',index});});
}
setInterval(()=>{
  if(view!=='battle'||!game||game.phase!=='play'||!game.deadline||game.pausedAt)return;
  const left=Math.max(0,Math.ceil((game.deadline-Date.now())/1000)),rope=$('#turn-rope');
  if(rope){rope.hidden=false;rope.classList.toggle('urgent',left<=15);rope.querySelector('i').style.width=Math.min(100,left/game.turnSeconds*100)+'%';rope.querySelector('span').textContent=left+'초';}
  if(left===0&&!busy&&!online){if(dialog.open)dialog.close();for(let i=0;i<3&&game.choice;i++)applyAction(game,game.current,{type:'choose',index:0});save();if(game.phase==='over'){render();return;}perform({type:'end'},game.current);}
},250);
function render(){
  hidePeek();$('#target-arrow').style.display='none';document.body.dataset.view=view;
  $('#battle-nav').classList.toggle('active',view==='battle'||view==='setup');$('#collection-nav').classList.toggle('active',['collection','decks'].includes(view));
  const pages={battle:renderBattle,collection:renderCollection,home:renderHome,setup:renderSetup,decks:()=>renderCollection(false),deckmanage:renderDeckManagement,history:renderHistory,settings:renderSettings,packs:renderPacks,shop:renderShop,rewards:renderRewards,modes:renderModes,arena:renderArena,online:renderOnline};(pages[view]||renderHome)();
}
$('#brand').onclick=e=>{e.preventDefault();if(!busy)navigate('home');};$('#battle-nav').onclick=()=>navigate('setup');$('#collection-nav').onclick=()=>navigate('decks');
$('#sound').onclick=()=>{soundOn=!soundOn;profile.settings.sound=soundOn;saveProfile();$('#sound').classList.toggle('enabled',soundOn);$('#sound').setAttribute('aria-label',soundOn?'효과음 끄기':'효과음 켜기');sound();toast(soundOn?'효과음 켜짐':'효과음 꺼짐');};
$('#help').onclick=()=>showDialog(`<button class="close" data-close aria-label="닫기">×</button><h2>게임 방법</h2><div class="help-copy">
<p class="help-goal">상대 영웅의 생명력을 0으로 만들면 승리합니다.</p>
<details open><summary>카드 사용과 공격</summary><p>초록빛 카드는 사용할 수 있습니다. 카드를 고른 뒤 소환 위치나 대상을 누르세요. 손패에서 전장으로 끌어 놓아도 됩니다. 대상이 없는 주문은 누르면 바로 발동합니다.</p><p>공격할 하수인이나 영웅을 고른 뒤 적을 누르세요. 도발 하수인이 있으면 먼저 공격해야 합니다. 하수인끼리는 서로 피해를 줍니다.</p><p>영웅 오른쪽의 능력은 2마나로, 턴마다 한 번 사용할 수 있습니다.</p></details>
<details><summary>수학 능력</summary><p>함수로 얻는 기본 공격력은 f(x)를 내림한 값이며, 0~9999 범위입니다. 처음 x는 1이며, 미분·적분은 x를 유지한 채 식을 바꿉니다.</p><p>피타고라스와 파스칼은 양옆 하수인의 공격력에 따라 값이 바뀝니다. 연결선을 따라 입력을 확인하세요.</p><p>뇌터의 Σ를 누르고 아군을 고르면 공격력을 가져옵니다. 두 하수인의 공격력 합은 그대로입니다.</p><p>카드를 우클릭하면 능력과 세부 규칙을 볼 수 있습니다.</p></details>
<details><summary>시작 카드와 턴</summary><p>선공은 카드 3장, 후공은 카드 4장과 동전으로 시작합니다. 동전은 이번 턴에만 마나를 1 줍니다.</p><p>내 턴이 시작되면 최대 마나가 1 늘고, 마나가 회복되며 카드를 1장 뽑습니다. 최대 마나는 10입니다.</p><p>하수인은 보통 소환한 다음 턴부터 한 번 공격합니다. 돌진은 즉시, 속공은 소환한 턴에도 하수인을 공격할 수 있습니다.</p></details>
<details><summary>손패와 전장</summary><p>손패는 10장, 전장은 기본 7칸입니다. 호텔 하나마다 3칸 늘어나며 최대 13칸입니다. 호텔이 없어져도 나온 하수인은 남고, 자리가 빌 때까지 더 소환할 수 없습니다.</p><p>덱이 비면 카드를 뽑을 때마다 점점 커지는 탈진 피해를 받습니다.</p></details>
<details><summary>덱 만들기와 저장</summary><p>덱은 30장입니다. 같은 카드는 2장, 전설은 1장까지 넣을 수 있습니다. 영웅 전용 카드는 해당 영웅의 덱에만 넣을 수 있습니다.</p><p>내 카드 → 새 덱에서 직접 만들거나 견본을 고르세요. 진행과 덱은 현재 브라우저에 자동 저장됩니다.</p></details></div>`);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!busy){clearPointer();selected=null;if(!dialog.open)render();}});
function beginDrag(e,type,uid){if(busy||dialog.open||e.button!==0||!game||game.current!==0||game.phase!=='play')return;e.currentTarget.setPointerCapture(e.pointerId);drag={type,uid,x:e.clientX,y:e.clientY,moving:false};}
function clearPointer(){document.querySelector('.drag-ghost')?.remove();document.body.classList.remove('dragging');app.querySelectorAll('.place-slot').forEach(el=>el.remove());$('#target-arrow').style.display='none';drag=null;}
function drawArrow(action,x,y){
  const c=action.type==='play'?game.players[0].hand.find(c=>c.uid===action.uid):null;
  if(action.type==='play'&&(!c||!definitionOf(c).target||['minion','location'].includes(definitionOf(c).type)&&action.position===undefined))return;
  const source=app.querySelector(action.type==='power'?'[data-power="0"]':action.type==='play'?`[data-hand="${action.uid}"]`:`[data-target="${action.uid}"]`);if(!source)return;
  const r=source.getBoundingClientRect(),sx=r.left+r.width/2,sy=r.top+r.height/2;
  $('#target-arrow').style.display='block';$('#arrow-path').setAttribute('d',`M ${sx} ${sy} Q ${(sx+x)/2} ${Math.min(sy,y)-70} ${x} ${y}`);
}
function markDragTargets(){
  const targets=drag.type==='attack'?attackTargets(game,0,drag.uid):targetsFor(game,0,game.players[0].hand.find(c=>c.uid===drag.uid));
  app.querySelectorAll('[data-target]').forEach(el=>el.classList.toggle('targetable',targets.some(k=>String(k)===el.dataset.target)));
}
document.addEventListener('pointermove',e=>{
  if(drag){
    if(!drag.moving&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8){
      if(drag.type==='play'){const c=game.players[0].hand.find(c=>c.uid===drag.uid);if(!canPlay(game,0,c)){clearPointer();return;}const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.innerHTML=cardHTML({...definitionOf(c),cost:c.cost});document.body.append(ghost);}
      drag.moving=true;hidePeek();document.body.classList.add('dragging');markDragTargets();const c=game.players[0].hand.find(c=>c.uid===drag.uid);if(drag.type==='play'&&['minion','location'].includes(definitionOf(c).type))showPositions();
    }
    if(drag.moving){const ghost=document.querySelector('.drag-ghost');if(ghost){ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';}drawArrow(drag,e.clientX,e.clientY);app.querySelectorAll('.place-slot').forEach(el=>el.classList.toggle('active',Number(el.dataset.position)===insertionIndex(e.clientX)));}
  }else if(selected)drawArrow(selected,e.clientX,e.clientY);
});
document.addEventListener('pointerup',e=>{
  if(!drag)return;const d=drag;clearPointer();if(!d.moving)return;
  suppressClickUntil=performance.now()+200;selected=null;
  const hit=document.elementFromPoint(e.clientX,e.clientY),key=hit?.closest('[data-target]')?.dataset.target;
  if(d.type==='attack'){if(key)perform({type:'attack',uid:d.uid,target:key});else render();return;}
  const c=game.players[0].hand.find(c=>c.uid===d.uid);if(!c)return;
  if(['minion','location'].includes(definitionOf(c).type)){if(hit?.closest('[data-board="0"]')){selected={type:'play',uid:c.uid};placeSelected(insertionIndex(e.clientX));}else render();}
  else if(definitionOf(c).target&&key)perform({type:'play',uid:c.uid,target:key});
  else if(!definitionOf(c).target&&hit?.closest('.table'))perform({type:'play',uid:c.uid});
  else render();
});
document.addEventListener('pointercancel',()=>{clearPointer();selected=null;render();});
window.addEventListener('pagehide',()=>{if(game?.phase==='play'){game.pausedAt=Date.now();save();}});
dialog.addEventListener('cancel',e=>{if(view==='battle'&&(game?.phase==='mulligan'||game?.choice))e.preventDefault();});
render();
