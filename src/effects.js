const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export function snapshot(game,app){
  const entities=new Map();
  for(const [p,player] of game.players.entries())for(const [key,hp] of [[`hero${p}`,player.hp+player.armor],...player.board.map(m=>[String(m.uid),m.hp])]){
    const el=app.querySelector(`[data-target="${key}"]`);
    if(el)entities.set(key,{hp,rect:el.getBoundingClientRect(),node:el.cloneNode(true)});
  }
  return {entities,turn:game.turn};
}
async function floatNode(node,rect,frames,duration){
  node.classList.add('effect-ghost');node.removeAttribute('id');
  node.setAttribute('aria-hidden','true');node.tabIndex=-1;
  Object.assign(node.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:0});
  document.body.append(node);
  const animation=node.animate(frames,{duration,easing:'ease-in-out',fill:'forwards'});let timer;
  // Background tabs may pause compositor animations; never leave gameplay locked waiting for one.
  try{await Promise.race([animation.finished,new Promise(resolve=>{timer=setTimeout(resolve,duration+100);})]);}finally{clearTimeout(timer);animation.cancel();node.remove();}
}
export async function actionEffect(action,p,app,before){
  if(reduced()||action.type==='end')return;
  const target=before.entities.get(String(action.target));
  if(action.type==='attack'){
    const source=before.entities.get(String(action.uid));if(!source||!target)return;
    const dx=target.rect.left+target.rect.width/2-source.rect.left-source.rect.width/2,dy=target.rect.top+target.rect.height/2-source.rect.top-source.rect.height/2;
    const el=app.querySelector(`[data-target="${action.uid}"]`);el?.classList.add('attacking-origin');
    try{await floatNode(source.node,source.rect,[{transform:'translate(0,0) scale(1)'},{transform:`translate(${dx*.85}px,${dy*.85}px) scale(1.14)`,offset:.5},{transform:'translate(0,0) scale(1)'}],340);}finally{el?.classList.remove('attacking-origin');}
    return;
  }
  const source=app.querySelector(action.type==='power'?`[data-power="${p}"]`:action.type==='location'?`[data-target="${action.uid}"]`:p===0?`[data-hand="${action.uid}"]`:'.enemy-hand');
  if(!source)return;
  if(p===1&&before.cardNode){
    const table=app.querySelector('.table').getBoundingClientRect(),width=Math.min(180,table.width*.17);
    await floatNode(before.cardNode,{left:table.left+table.width*.055,top:table.top+table.height*.30,width,height:width*1.47},[{opacity:0,transform:'scale(.7) rotate(-12deg)'},{opacity:1,transform:'scale(1) rotate(0)',offset:.2},{opacity:1,offset:.85},{opacity:0}],650);
  }
  const r=source.getBoundingClientRect(),board=app.querySelector(`[data-board="${p}"]`).getBoundingClientRect();
  const end=target?.rect||board;
  const dx=end.left+end.width/2-r.left-r.width/2,dy=end.top+end.height/2-r.top-r.height/2;
  const orb=document.createElement('div');orb.className=`spell-orb ${action.type==='power'?'power-orb':''}`;
  const origin={left:r.left+r.width/2-14,top:r.top+r.height/2-14,width:28,height:28};
  await floatNode(orb,origin,[{transform:'translate(0,0) scale(.5)',opacity:0},{opacity:1,offset:.2},{transform:`translate(${dx}px,${dy}px) scale(2)`,opacity:0}],300);
}
export async function resultEffects(game,app,before){
  const events=(game.events||[]).filter(e=>['damage','heal','shield','secret','math'].includes(e.kind));
  if(!reduced())for(const event of events){
    if(event.kind==='secret'){
      const banner=document.createElement('div');banner.className='turn-banner';banner.textContent=event.name;document.body.append(banner);setTimeout(()=>banner.remove(),1000);
    }else{
      const el=app.querySelector(`[data-target="${event.key}"]`),r=el?.getBoundingClientRect()||before.entities.get(String(event.key))?.rect;
      if(r){const hit=document.createElement('span');hit.className=`hit-number ${event.kind==='math'?'math-result':event.kind==='heal'?'heal':''}`;hit.textContent=event.kind==='math'?event.expression:event.kind==='shield'?'◇':`${event.kind==='heal'?'+':'−'}${event.amount}`;hit.style.left=(r.left+r.width/2)+'px';hit.style.top=(r.top+r.height/2)+'px';document.body.append(hit);setTimeout(()=>hit.remove(),900);el?.classList.add('impact');}
    }
    await new Promise(resolve=>setTimeout(resolve,events.length>12?60:130));
  }
  const live=new Map(game.players.flatMap((p,i)=>[[`hero${i}`,p.hp+p.armor],...p.board.map(m=>[String(m.uid),m.hp])]));
  for(const [key,old] of before.entities){
    if(!live.has(key)){
      if(!reduced()){
        const frames=before.cardId==='circle'?[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(-240px) scale(.2) rotate(-20deg)'}]:[{opacity:1,transform:'scale(1)'},{opacity:.7,filter:'grayscale(1) brightness(2)',offset:.3},{opacity:0,transform:'translateY(25px) scale(.55) rotate(9deg)'}];
        void floatNode(old.node,old.rect,frames,430);
      }
      continue;
    }
    const delta=live.get(key)-old.hp;if(!delta||events.length)continue;
    const el=app.querySelector(`[data-target="${key}"]`);if(!el)continue;
    const r=el.getBoundingClientRect(),hit=document.createElement('span');hit.className=`hit-number ${delta>0?'heal':''}`;hit.textContent=delta>0?'+'+delta:String(delta);
    hit.style.left=(r.left+r.width/2)+'px';hit.style.top=(r.top+r.height/2)+'px';document.body.append(hit);setTimeout(()=>hit.remove(),900);el.classList.add('impact');
  }
  if(before.turn!==game.turn&&game.phase==='play'){
    const banner=document.createElement('div');banner.className='turn-banner';banner.textContent=game.current===0?'내 턴':'상대 턴';document.body.append(banner);setTimeout(()=>banner.remove(),1000);
  }
}
