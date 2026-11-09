export function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b)[a,b]=[b,a%b];return a;}
export function divisorSum(n){if(n<2)return 0;let sum=1;for(let d=2;d*d<=n;d++)if(n%d===0){sum+=d;if(d*d!==n)sum+=n/d;}return sum;}
function term(n,d,p){n=BigInt(n);d=BigInt(d);let a=n<0n?-n:n,b=d;while(b)[a,b]=[b,a%b];const g=a||1n;return {n:Number(n/g),d:Number(d/g),p};}
export function evaluateFormula(terms,x){return terms.reduce((value,t)=>value+t.n/t.d*x**t.p,0);}
export function differentiate(terms){return terms.filter(t=>t.p>0).map(t=>term(BigInt(t.n)*BigInt(t.p),t.d,t.p-1));}
export function integrate(terms){return terms.map(t=>term(t.n,BigInt(t.d)*BigInt(t.p+1),t.p+1));}
export function shiftFormula(terms){
  const result=new Map();
  for(const t of terms){let coefficient=1;for(let p=0;p<=t.p;p++){const old=result.get(p)||{n:0,d:1},next=term(BigInt(old.n)*BigInt(t.d)+BigInt(t.n)*BigInt(coefficient)*BigInt(old.d),BigInt(old.d)*BigInt(t.d),p);if(!validFormula([next]))return [next];result.set(p,next);coefficient=coefficient*(t.p-p)/(p+1);}}
  return [...result.values()].filter(t=>t.n).sort((a,b)=>b.p-a.p);
}
export function formulaValue(terms,x){return Math.min(9999,Math.max(0,Math.floor(evaluateFormula(terms,x)+1e-9)));}
export function updateFormula(m,terms,x=m.functionX??1){
  const next=formulaValue(terms,x);m.attack=Math.max(m.auraAttack||0,m.attack+next-(m.functionValue||0));
  m.formula=terms;m.functionX=x;m.functionValue=next;
}
export function addConstant(terms,n){
  const current=terms.find(t=>t.p===0)||{n:0,d:1,p:0};
  const next=term(BigInt(current.n)+BigInt(n)*BigInt(current.d),current.d,0);
  const result=[...terms.filter(t=>t.p!==0),next].filter(t=>t.n);
  return validFormula(result)?result:null;
}
export function formatFormula(terms){
  if(!terms?.length)return '0';
  return terms.filter(t=>t.n).map((t,i)=>{const abs=Math.abs(t.n),coefficient=t.d===1?(abs===1&&t.p?'':String(abs)):`${abs}/${t.d}`,power=String(t.p).replace(/\d/g,n=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[n]);return `${t.n<0?'−':i?'+':''}${coefficient}${t.p===0?'':t.p===1?'x':`x${power}`}`;}).join(' ')||'0';
}
export function transformFormula(terms,rule){
  if(rule==='differentiate')return differentiate(terms);
  if(rule==='integrate')return integrate(terms);
  if(rule==='shift')return shiftFormula(terms);
  if(rule==='substituteSquare')return terms.map(t=>({...t,p:t.p*2}));
  return terms;
}
export function composeFormula(outer,inner){
  const add=(a,b)=>term(BigInt(a.n)*BigInt(b.d)+BigInt(b.n)*BigInt(a.d),BigInt(a.d)*BigInt(b.d),a.p);
  const multiply=(a,b)=>{
    const result=new Map();
    for(const x of a)for(const y of b){const t=term(BigInt(x.n)*BigInt(y.n),BigInt(x.d)*BigInt(y.d),x.p+y.p);result.set(t.p,add(result.get(t.p)||{n:0,d:1,p:t.p},t));}
    const terms=[...result.values()].filter(t=>t.n);return validFormula(terms)?terms:null;
  };
  const result=new Map();
  for(const t of outer){
    let power=[{n:t.n,d:t.d,p:0}];
    for(let i=0;i<t.p;i++){power=multiply(power,inner);if(!power)return null;}
    for(const x of power)result.set(x.p,add(result.get(x.p)||{n:0,d:1,p:x.p},x));
  }
  const terms=[...result.values()].filter(t=>t.n).sort((a,b)=>b.p-a.p);
  return validFormula(terms)?terms:null;
}
// shortcut: persist safe-integer rational polynomials through degree 16; larger functions need a different save format and card layout.
export function validFormula(terms){return terms.every(t=>t.p<=16&&Number.isSafeInteger(t.n)&&Number.isSafeInteger(t.d)&&t.d>0);}
export function cardRules(c){
  if(!c.formula)return (c.text||'').replace(' 한 턴에 두 번 공격할 수 있습니다.','').replace(' 처음 죽으면 생명력이 1인 상태로 돌아옵니다.','').replace(' 소환한 턴에는 하수인만 공격합니다.','').replace(' 이 하수인이 준 피해만큼 내 영웅을 회복합니다.','');
  const x=c.functionX??1;
  return `공격력=f(x)=${formatFormula(c.formula)}. x=${x}. 내 턴 시작: x가 1 증가합니다.`;
}
