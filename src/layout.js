// The hand-spacing model follows the analyzed ZoneHand fan, projected into 2D.
export function handPose(index,count){
  const offset=index-(count-1)/2;
  const x=Math.min(10.4,45/Math.max(1,count))*offset;
  const angle=count>3?(40+2*count)*(index/(count-1)-.5)*.65:0;
  return {x,y:Math.abs(x)*.22,angle};
}
