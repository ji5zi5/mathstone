import test from 'node:test';
import assert from 'node:assert/strict';
import {actionEffect} from '../src/effects.js';

test('a stalled browser animation cannot keep gameplay waiting indefinitely',async()=>{
  const previousDocument=globalThis.document,previousMedia=globalThis.matchMedia;
  let removed=false,cancelled=false;
  const node={className:'',classList:{add(){}},removeAttribute(){},setAttribute(){},style:{},remove(){removed=true;},animate(){return {finished:new Promise(()=>{}),cancel(){cancelled=true;}};}};
  globalThis.matchMedia=()=>({matches:false});
  globalThis.document={createElement:()=>node,body:{append(){}}};
  const app={querySelector:()=>({getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})})};
  try{await actionEffect({type:'power'},0,app,{entities:new Map()});assert.ok(removed);assert.ok(cancelled);}
  finally{globalThis.document=previousDocument;globalThis.matchMedia=previousMedia;}
});
