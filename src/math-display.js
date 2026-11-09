import {cardRules,formatFormula,formulaValue} from './math.js';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const square=x=>`<msup><mi>${x}</mi><mn>2</mn></msup>`;
const floor=x=>`<mo>⌊</mo><mrow>${x}</mrow><mo>⌋</mo>`;
const root=x=>`<msqrt>${x}</msqrt>`;
const data={
  surge:{text:'아군 함수의 기울기만큼\n이번 턴 공격력을 더합니다.\n함수와 x는 유지됩니다.',label:'현재 기울기',equation:'<msup><mi>f</mi><mo>′</mo></msup><mo>(</mo><mi>x</mi><mo>)</mo>',legend:'현재 입력에서 도함수를 계산합니다. 증가량은 0~9999로 제한하고 내립니다.'},
  sword:{text:'공격력 = 아군 함수의 구분구적합\n공격할 때마다 분할 1 → 2 → 4\n함수가 없으면 공격력 4.',label:'오른쪽 직사각형 합',equation:'<mi>Σ</mi><mi>f</mi><mo>(</mo><mi>iΔx</mi><mo>)</mo><mo>·</mo><mi>Δx</mi>',legend:'가장 왼쪽 아군 함수의 [0,x]를 등분합니다. Δx=x/n. 각 구간 오른쪽 끝의 높이×너비를 합합니다.'},
  sandwich:{text:'양끝 아군 공격력 사이로\n적 하나를 가둡니다.\n적의 턴마다 평균을 향해 조입니다.',label:'압착 경계',equation:'<mi>L</mi><mo>≤</mo><mi>A</mi><mo>≤</mo><mi>U</mi>',legend:'아군 둘 필요. 최초 양끝 값의 평균을 내린 값으로 상·하한이 수렴합니다.'},
  diagonal:{text:'상대 손의 비용을 이진수로 씁니다.\n대각선 자릿수를 뒤집어\n그 수만큼 피해 주는 주문을 얻습니다.',label:'대각선 반전',equation:'<msub><mi>b</mi><mi>i</mi></msub><mo>=</mo><mn>1</mn><mo>−</mo><msub><mi>a</mi><mi>ii</mi></msub>',legend:'i번째 비용의 i번째 이진 자릿수와 다른 숫자를 만듭니다. 생성된 주문은 3마나입니다.'},
  discriminant:{text:'왼쪽 두 아군 a,b와 적 생명력 c.\nΔ = b² − 4ac\n음수: 공격력 0. 0: 복사 1. 양수: 복사 2.',label:'판별식',equation:`<mi>Δ</mi><mo>=</mo>${square('b')}<mo>−</mo><mn>4</mn><mi>a</mi><mi>c</mi>`,legend:'a>0인 아군 둘 필요. 서로 다른 실근 수만큼 적을 내 필드에 복사합니다.'},
  ghost:{text:'전투의 함성: 아군 함수의\n양의 정수 상수항 C를 보관합니다.\n죽음의 메아리: 그 함수에 C를 돌려줍니다.',label:'상수항 보관',equation:'<mi>f</mi><mo>(</mo><mi>x</mi><mo>)</mo><mo>−</mo><mi>C</mi>',legend:'함수의 모양과 x는 유지됩니다. 보관한 상수는 이 망령이 죽을 때 돌아갑니다.'},
  amplifier:{text:'전투의 함성: 주파수 0·1·2 중 선택.\n내 턴 종료: 다른 아군 공격력의\n해당 주파수 성분을 두 배로 합니다.',label:'푸리에 증폭',equation:'<msub><mi>F</mi><mi>k</mi></msub><mo>→</mo><mn>2</mn><msub><mi>F</mi><mi>k</mi></msub>',legend:'아군 공격력을 한 수열로 봅니다. 주파수 0은 평균, 나머지는 물결 성분입니다. 켤레 성분도 함께 증폭합니다.'},
  'pythagoras-person':{text:'양옆 아군과 연결됩니다.\n공격력 = √(a² + b²)\n소수점 이하는 버립니다.',equation:floor(root(`${square('a')}<mo>+</mo>${square('b')}`)),legend:'a, b = 소환할 때 양옆 아군의 공격력. 연결된 값이 바뀌면 함께 바뀝니다.'},
  'archimedes-person':{text:'내 턴 종료: 공격력이 원의 넓이가 됩니다.\n넓이 = πr²\n소수점 이하는 버립니다.',equation:floor(`<mi>π</mi>${square('r')}`),legend:'r = 다른 아군 하수인 수.'},
  'bayes-person':{text:'전투의 함성: 상대 손을 공개합니다.\n공격력 = 10(s+1)/(n+2)\n소수점 이하는 버립니다.',equation:floor('<mfrac><mrow><mn>10</mn><mo>(</mo><mi>s</mi><mo>+</mo><mn>1</mn><mo>)</mo></mrow><mrow><mi>n</mi><mo>+</mo><mn>2</mn></mrow></mfrac>'),legend:'n = 상대 손의 카드 수. s = 그중 주문 수.'},
  'hypatia-person':{text:'전투의 함성: 적을 원 위로 투영합니다.\n공격력 = √(r² − H²)\n음수는 0, 소수점 이하는 버립니다.',equation:floor(root(`<mi>max</mi><mo>(</mo><mn>0</mn><mo>,</mo>${square('r')}<mo>−</mo>${square('H')}<mo>)</mo>`)),legend:'r = 내 최대 마나. H = 각 적 하수인의 현재 생명력. 루트 안이 음수이면 0으로 계산합니다.'},
  triangle:{text:'아군 하수인의 공격력을 바꿉니다.\n공격력 = √(A² + H²)\n소수점 이하는 버립니다.',equation:floor(root(`${square('A')}<mo>+</mo>${square('H')}`)),legend:'A = 대상의 공격력. H = 현재 생명력.'},
  log:{text:'하수인의 공격력을 줄입니다.\n공격력 = log₂ A\n소수점 이하는 버립니다. 0은 그대로입니다.',equation:floor('<msub><mi>log</mi><mn>2</mn></msub><mi>A</mi>'),legend:'A = 대상의 공격력. 공격력이 0이면 바꾸지 않습니다.'},
  stirling:{text:'손의 하수인 수 n으로\n스털링 근삿값을 구합니다.\n그만큼 각 비용이 감소합니다.',label:'비용 감소',equation:floor('<mtable columnalign="left" rowspacing=".3em"><mtr><mtd><mi>n</mi><mi>ln</mi><mi>n</mi><mo>−</mo><mi>n</mi></mtd></mtr><mtr><mtd><mo>+</mo><mfrac><mn>1</mn><mn>2</mn></mfrac><mi>ln</mi><mo>(</mo><mn>2</mn><mi>π</mi><mi>n</mi><mo>)</mo></mtd></mtr></mtable>'),legend:'n = 손에 있는 하수인 카드 수. 감소량과 감소 후 비용은 0보다 작아지지 않습니다. 0장일 때는 효과가 없습니다.'},
};

export function displayRules(c){
  if(c.formula)return `공격력 = ${formatFormula(c.formula)}\nx = ${c.functionX??1}\n내 턴 시작: x가 1 증가합니다.`;
  return data[c.id]?.text||cardRules(c);
}

export function polynomialMarkup(terms){
  return terms.filter(t=>t.n).map((t,i)=>{
    const a=Math.abs(t.n),sign=t.n<0?'<mo>−</mo>':i?'<mo>+</mo>':'';
    const coefficient=t.d!==1?`<mfrac><mn>${a}</mn><mn>${escape(t.d)}</mn></mfrac>`:a===1&&t.p?'':`<mn>${a}</mn>`;
    const power=t.p===0?'':t.p===1?'<mi>x</mi>':`<msup><mi>x</mi><mn>${escape(t.p)}</mn></msup>`;
    return sign+coefficient+power;
  }).join('')||'<mn>0</mn>';
}

export function mathPanel(c){
  const entry=data[c.id];
  const state=mechanicState(c);
  if(!entry&&!c.formula&&!state)return '';
  if(!entry&&!c.formula)return `<section class="math-panel" aria-label="수학 상태">${state}</section>`;
  const equation=c.formula?polynomialMarkup(c.formula):entry.equation;
  const legend=c.formula?`x = ${c.functionX??1}. 현재 함수값의 내림값은 ${formulaValue(c.formula,c.functionX??1)}입니다. 내 턴 시작마다 x가 1 증가합니다. 함수 공격력은 0~9999입니다.`:entry.legend+(entry.equation.includes('⌊')?' ⌊ ⌋는 소수점 이하를 버린다는 뜻입니다.':'');
  return `<section class="math-panel" aria-label="계산식"><div class="math-panel-label">${entry?.label||'공격력'}</div><math display="block" xmlns="http://www.w3.org/1998/Math/MathML"><mrow>${equation}</mrow></math><p>${escape(legend)}</p>${state}</section>`;
}

function mechanicState(c){
  let html='';
  if(c.id==='ant'&&!c.silenced||c.ant){const a=c.ant||{x:0,y:0,direction:0,steps:0,black:[]},black=new Set(a.black);html+=`<p>흰 칸 ↱ · 검정 칸 ↰</p><div class="ant-grid" role="img" aria-label="${escape(a.steps)}걸음, 검정 ${black.size}칸">${Array.from({length:49},(_,i)=>{const x=a.x+i%7-3,y=a.y+Math.floor(i/7)-3;return `<i class="${black.has(`${x},${y}`)?'black':''}">${i===24?['↑','→','↓','←'][a.direction]:''}</i>`;}).join('')}</div><p>${escape(a.steps)}걸음 · 검정 ${black.size}칸<br>위치 (${escape(a.x)}, ${escape(a.y)}) · 주변 7×7 표시</p>`;}
  if(c.squeeze)html+=`<p class="mechanic-value">${escape(c.squeeze.low)} ≤ 공격력 ≤ ${escape(c.squeeze.high)}</p><p>수렴값 ${escape(c.squeeze.limit)}</p>`;
  if(c.constantStorage)html+=`<p class="mechanic-value">보관 중: C = ${escape(c.constantStorage.value)}</p>`;
  if(c.territorySite){const cells=c.territoryCells||[];html+=`<p>내 영토 ${cells.length}칸</p><div class="territory-grid" aria-label="0부터 12까지 영토">${Array.from({length:13},(_,i)=>`<i class="${cells.includes(i)?'owned':''}">${i}</i>`).join('')}</div><p>턴 종료: 생명력 +${cells.length}</p>`;}
  if(c.frequency!=null)html+=`<p class="mechanic-value">선택한 주파수: ${escape(c.frequency)}</p>`;
  if(c.quadrature){const q=c.quadrature;html+=`<p class="mechanic-value">${escape(q.parts)}분할 → 공격력 ${escape(q.attack)}</p><p>구간 0~${escape(q.x)} · 너비 ${escape(q.width)}<br>${q.samples.map(s=>escape(Number(s.height.toFixed(3)))).join(' + ')}<br>높이의 합 × 너비 = ${escape(Number(q.area.toFixed(3)))}</p>`;}
  if(c.diagonalWitness)html+=`<p>원래 비용: ${c.diagonalWitness.map(escape).join(', ')}</p><p>이진수: ${c.diagonalWitness.map(n=>escape(n.toString(2))).join(' / ')}</p>`;
  return html;
}
