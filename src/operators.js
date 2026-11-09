export const OPERATORS=[
  {id:'input-forward',name:'변수의 전진',cost:1,text:'아군 함수의 x를 1 늘립니다. 함수는 그대로입니다.',flavor:'같은 식, 다른 답.',rule:'inputForward'},
  {id:'input-back',name:'변수의 역행',cost:1,text:'아군 함수의 x를 1 줄입니다. 0보다 작아지지 않습니다.',flavor:'한 칸만 돌아가 보자.',rule:'inputBack'},
  {id:'compose-left',name:'합성함수의 고리',cost:3,text:'아군 함수 f(x)에 왼쪽 함수 g(x)를 넣어 f(g(x))로 바꿉니다. x는 유지합니다.',flavor:'네 답이 내 질문이다.',rule:'composeLeft',mathNote:'왼쪽의 가장 가까운 하수인이 함수여야 합니다. 두 식의 현재 형태를 사용하며 원본은 바꾸지 않습니다. 합성 후 한쪽 식을 바꿔도 다른 쪽에 전파되지는 않습니다.'},
  {id:'split-constant',name:'상수항의 탈출',cost:2,text:'아군 함수에서 양의 정수 상수항 C를 떼어 냅니다. C/C 망령을 소환합니다.',flavor:'없어진 줄 알았지?',rule:'splitConstant',mathNote:'함수의 상수항만 제거합니다. x와 다른 항은 유지합니다. 빈 필드 자리와 양의 정수 상수항이 필요합니다.'},
].map(({rule,...c},i)=>({...c,art:240+i,type:'spell',school:'변환',rarity:'rare',set:'살아 있는 수식',target:'function',effects:[{kind:'math',rule,scope:'target'}]}));
