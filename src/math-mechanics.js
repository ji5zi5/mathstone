import {evaluateFormula} from './math.js';

export function riemannSum(terms,x,parts){
  const width=x/parts,samples=Array.from({length:parts},(_,i)=>({x:(i+1)*width,height:evaluateFormula(terms,(i+1)*width)}));
  const area=samples.reduce((sum,s)=>sum+s.height*width,0);
  return {parts,width,samples,area,attack:Math.min(9999,Math.max(0,Math.floor(area+1e-9)))};
}

export function walkAnt(state={x:0,y:0,direction:0,black:[],steps:0},steps=4){
  let {x,y,direction}=state;const black=new Set(state.black);
  for(let i=0;i<steps;i++){
    const key=`${x},${y}`,wasBlack=black.has(key);
    direction=(direction+(wasBlack?3:1))%4;
    if(wasBlack)black.delete(key);else black.add(key);
    const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][direction];x+=dx;y+=dy;
  }
  return {x,y,direction,black:[...black],steps:state.steps+steps};
}

export function voronoiCells(sites){
  const cells=sites.map(()=>[]);
  for(let x=0;sites.length&&x<=12;x++){
    let winner=0;
    for(let i=1;i<sites.length;i++)if(Math.abs(x-sites[i])<Math.abs(x-sites[winner]))winner=i;
    cells[winner].push(x);
  }
  return cells;
}

export function amplifyFrequency(values,frequency){
  const n=values.length;if(!n)return [];
  const k=frequency%n,scale=k===0||2*k===n?1/n:2/n;
  return values.map((a,j)=>{
    const component=scale*values.reduce((sum,b,l)=>sum+b*Math.cos(2*Math.PI*k*(j-l)/n),0);
    return Math.min(9999,Math.max(0,Math.floor(a+component+1e-9)));
  });
}

export function hanoiMoves(pegs){
  const moves=[];
  for(let from=0;from<3;from++)for(let to=0;to<3;to++)if(from!==to&&pegs[from].length&&(!pegs[to].length||pegs[from].at(-1)<pegs[to].at(-1)))moves.push({from,to});
  return moves;
}

export function nextHanoiMove(pegs){
  const queue=[{pegs,first:null}],seen=new Set([JSON.stringify(pegs)]);
  for(let i=0;i<queue.length;i++){
    const state=queue[i];if(state.pegs[2].length===3)return state.first;
    for(const move of hanoiMoves(state.pegs)){
      const next=state.pegs.map(p=>[...p]);next[move.to].push(next[move.from].pop());
      const key=JSON.stringify(next);if(!seen.has(key)){seen.add(key);queue.push({pegs:next,first:state.first||move});}
    }
  }
  return null;
}
