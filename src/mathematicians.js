const rows=[
 ['pythagoras-person','피타고라스',4,3,4,'양옆 아군과 연결됩니다. 내 공격력=⌊√(a²+b²)⌋. 연결된 공격력이 변하면 함께 변합니다.','세 변이면 충분하다.','triangleLink','onPlay'],
 ['archimedes-person','아르키메데스',5,3,6,'내 턴 종료: 다른 아군이 r명일 때, 공격력이 ⌊πr²⌋가 됩니다.','내 원을 밟지 마라!','circleArea','onEnd'],
 ['fibonacci-person','레오나르도 피보나치',4,2,5,'전투의 함성: 아군 공격력을 왼쪽부터 1, 1, 2, 3, 5…로 바꿉니다.','토끼는 계산이 끝나기를 기다려 주지 않는다.','fibonacciRow','onPlay'],
 ['pascal-person','블레즈 파스칼',5,3,5,'양옆 아군과 연결됩니다. 내 공격력=a+b. 연결된 공격력이 변하면 함께 변합니다.','사이에는 이웃의 합.','sumLink','onPlay'],
 ['descartes-person','르네 데카르트',3,2,5,'전투의 함성: 모든 아군의 공격력과 현재 생명력을 바꿉니다.','좌표만 바꿔도 세상이 달라 보인다.','reflect','onPlay'],
 ['bernoulli-person','야코프 베르누이',4,2,6,'내 턴 종료: 다른 아군 수만큼 동전을 던져, 앞면 수 k의 k/k를 소환합니다. 0은 제외합니다.','지난번 결과는 잊어도 된다.','binomialTrial','onEnd'],
 ['bayes-person','토머스 베이즈',4,5,5,'전투의 함성: 상대 손을 공개합니다. 공격력=⌊10(s+1)/(n+2)⌋. n은 손패 수, s는 주문 수.','새 증거가 들어왔다.','posterior','onPlay'],
 ['ramanujan-person','스리니바사 라마누잔',6,9,10,'전투의 함성: 공격력³+생명력³이 같은 서로 다른 아군 조합을 찾습니다. 가장 작은 공통값만큼 방어도를 얻습니다.','그 택시 번호는 꽤 재미있는데요.','taxicab','onPlay'],
 ['hypatia-person','히파티아',5,3,7,'전투의 함성: 각 적의 공격력을 ⌊√max(0,r²−생명력²)⌋로 바꿉니다. r은 내 최대 마나입니다.','원을 벗어난 점부터 다시 보자.','circleProjection','onPlay'],
 ['khwarizmi-person','알콰리즈미',3,3,5,'적에게 A=H를 겁니다. 공격력과 현재 생명력이 같을 때만 공격할 수 있습니다.','양변부터 맞추게.','equationSeal','onPlay'],
];
export const MATHEMATICIANS=rows.map(([id,name,cost,attack,health,text,flavor,rule,hook],i)=>({id,name,cost,attack,health,text,flavor,type:'minion',school:i%3===0?'생성':i%3===1?'변환':'역설',mathematician:true,rarity:'rare',set:'무한의 서고',art:210+i,target:rule==='equationSeal'?'enemy':null,[hook]:[{kind:'math',rule,scope:rule==='equationSeal'?'target':'friendly'}]}));
for(const i of [0,3])Object.assign(MATHEMATICIANS[i],{mathNote:'소환할 때 양옆 하수인에 연결됩니다. 장소는 건너뜁니다. 자리나 진영이 바뀌어도 같은 대상을 따릅니다. 없는 쪽과 떠난 대상은 0입니다. 공격력은 연결식과 오라로 결정됩니다. 침묵되면 연결이 끊어집니다.'});
Object.assign(MATHEMATICIANS[4],{mathNote:'(공격력, 생명력)을 좌표로 보고 직선 y=x에 대칭시킵니다.'});
Object.assign(MATHEMATICIANS[6],{mathNote:'주문 여부를 베르누이 관측으로 보고 Beta(1,1) 사전분포를 갱신합니다. 사후평균은 (s+1)/(n+2)입니다.'});
Object.assign(MATHEMATICIANS[7],{mathNote:'1³+12³=9³+10³=1729. 같은 능력치 둘이나 공격력·생명력만 뒤바뀐 쌍은 다른 조합으로 세지 않습니다.'});
