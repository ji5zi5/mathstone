// The original client fits text to its bounds; Korean glyph count alone is not a useful width.
export function fitCardText(root=document){
  for(const card of root.querySelectorAll('.card')){
    const width=card.clientWidth;
    if(!width||!card.getClientRects().length)continue;
    for(const [selector,ratio] of [['.card-name>span',.095],['.card-rules>span',.078]]){
      const text=card.querySelector(selector),box=text?.parentElement;
      if(!text||!box.clientHeight)continue;
      let size=width*ratio;
      text.style.fontSize=`${size}px`;
      while(size>width*.04&&(text.scrollWidth>text.clientWidth+1||text.scrollHeight>box.clientHeight+1)){
        size=Math.max(width*.04,size-.5);text.style.fontSize=`${size}px`;
      }
    }
  }
}
