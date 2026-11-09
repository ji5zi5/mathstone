export function serverAction(action,seat){
  const flip=key=>seat===1&&/^hero[01]$/.test(String(key))?`hero${1-Number(key.at(-1))}`:key;
  return {...action,...('uid'in action?{uid:flip(action.uid)}:{}),...('target'in action?{target:flip(action.target)}:{})};
}
export function orientState(snapshot){
  const s=snapshot.state?structuredClone(snapshot.state):null;if(!s||snapshot.seat!==1)return s;
  s.players.reverse();s.current=1-s.current;s.first=1-s.first;
  if(typeof s.winner==='number')s.winner=1-s.winner;
  if(s.mulliganDone)s.mulliganDone.reverse();if(s.choice)s.choice.p=1-s.choice.p;
  s.events=(s.events||[]).map(e=>({...e,...(typeof e.key==='string'&&/^hero[01]$/.test(e.key)?{key:`hero${1-Number(e.key.at(-1))}`}:{})}));
  return s;
}
