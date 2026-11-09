// References follow cards, not slots. Missing inputs contribute zero.
export function relationInputs(s,m){return (m.relation?.inputs||[]).map(uid=>s.players.flatMap(p=>p.board).find(x=>x.uid===uid&&x.hp>0));}
export function refreshRelations(s){
  const done=new Set(),visiting=new Set(),changes=[];
  function visit(m){
    if(done.has(m.uid)||m.silenced||m.hp<=0)return;
    if(visiting.has(m.uid))return;
    visiting.add(m.uid);
    if(m.relation){
      const inputs=relationInputs(s,m);inputs.filter(Boolean).forEach(visit);
      const [a=0,b=0]=inputs.map(x=>x?.attack||0);
      const value=m.relation.kind==='hypotenuse'?Math.floor(Math.hypot(a,b)):a+b;
      const next=value+(m.auraAttack||0);
      if(m.attack!==next){m.attack=next;changes.push({key:m.uid,expression:m.relation.kind==='hypotenuse'?`⌊√(${a}²+${b}²)⌋ = ${value}`:`${a} + ${b} = ${value}`});}
      m.tempAttack=0;
    }
    if(m.squeeze){const {low,high}=m.squeeze;m.attack=Math.max(low,Math.min(high,m.attack));}
    visiting.delete(m.uid);done.add(m.uid);
  }
  s.players.flatMap(p=>p.board).forEach(visit);return changes;
}
export function mathLabel(m){
  if(m.squeeze)return `${m.squeeze.low} ≤ A ≤ ${m.squeeze.high}`;
  if(m.ant)return `검정 ${m.ant.black.length}칸`;
  if(m.constantStorage)return `C = ${m.constantStorage.value}`;
  if(m.territorySite)return `영토 ${m.territoryCells?.length||0}칸`;
  if(m.frequency!=null)return `주파수 ${m.frequency}`;
  if(m.attackEquation)return `A=H ${m.attack===m.hp?'✓':'✕'}`;
  if(m.relation)return m.relation.kind==='hypotenuse'?'⌊√(a²+b²)⌋':'c=a+b';
  if(m.formula)return `x=${m.functionX}`;
  return '';
}
