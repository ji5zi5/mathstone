import test from 'node:test';
import assert from 'node:assert/strict';
import {handPose} from '../src/layout.js';

test('hands of 1–10 cards stay centered, ordered, and within the board',()=>{
  for(let count=1;count<=10;count++){
    const poses=Array.from({length:count},(_,i)=>handPose(i,count));
    for(let i=0;i<count;i++){
      const p=poses[i],opposite=poses[count-1-i];
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(Math.abs(p.x+opposite.x)<1e-9);
      assert.ok(Math.abs(p.angle+opposite.angle)<1e-9);
      assert.ok(Math.abs(p.x)+13<50,'expanded hand card fits inside board');
      if(i)assert.ok(p.x>poses[i-1].x);
    }
  }
});
