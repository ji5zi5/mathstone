export const HEROES = [
  {id:'euclid',name:'유클리드',school:'생성',art:65,icon:'△',power:'호제법',cost:2,text:'하수인의 공격력·생명력을 두 수의 최대공약수로 바꿉니다.',target:true},
  {id:'leibniz',name:'라이프니츠',school:'변환',art:35,icon:'∂',power:'미분',cost:2,text:'하수인의 함수를 미분합니다. 함수가 없으면 공격력이 0이 됩니다.',target:true},
  {id:'archimedes',name:'아르키메데스',school:'역설',art:43,icon:'○',power:'원의 넓이',cost:2,text:'아군 하수인이 r명이면 방어도를 ⌊πr²⌋ 얻습니다.'},
];
export const COIN = {id:'tempoCoin',name:'동전 한 닢',cost:0,attack:0,health:0,type:'spell',target:null,art:83,school:'공용',text:'이번 턴에만 마나를 1 얻습니다.',flavor:'한 발 늦었으니, 한 푼 더.'};
export function heroOf(player){return player.hero==='euler'?{id:'euler',name:'오일러',power:'등식',cost:2,text:'적 하수인의 공격력·생명력을 두 수의 평균으로 바꿉니다. 소수는 버립니다.',target:true,icon:'='}:HEROES.find(h=>h.id===player.hero)||HEROES[2];}
