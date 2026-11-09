import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {CARDS,BY_ID} from '../src/cards.js';
import {displayRules,polynomialMarkup,mathPanel} from '../src/math-display.js';

test('polynomial display preserves fractions, negative signs, powers and zero',()=>{
  assert.equal(polynomialMarkup([]),'<mn>0</mn>');
  const terms=[{n:0,d:1,p:3},{n:-1,d:2,p:2},{n:1,d:1,p:1},{n:3,d:1,p:0}];
  assert.equal(polynomialMarkup(terms),'<mo>−</mo><mfrac><mn>1</mn><mn>2</mn></mfrac><msup><mi>x</mi><mn>2</mn></msup><mo>+</mo><mi>x</mi><mo>+</mo><mn>3</mn>');
  const card={formula:terms,functionX:2};
  assert.match(displayRules(card),/x = 2/);
  assert.match(mathPanel(card),/내림값은 3/);
  assert.ok(!mathPanel({...card,functionX:'<img src=x onerror=alert(1)>'}).includes('<img'));
  assert.ok(!polynomialMarkup([{n:1,d:'<img>',p:'<svg>'}]).includes('<svg>'));
});
test('calculation details explain the hard formulas while ordinary cards stay unchanged',()=>{
  assert.match(mathPanel(BY_ID['bayes-person']),/<mfrac>/);
  assert.match(mathPanel(BY_ID['bayes-person']),/상대 손의 카드 수/);
  assert.match(mathPanel(BY_ID['hypatia-person']),/<msqrt>/);
  assert.match(mathPanel(BY_ID['hypatia-person']),/음수이면 0/);
  assert.equal(mathPanel(BY_ID.rabbit),'');
  assert.equal(displayRules(BY_ID.rabbit),BY_ID.rabbit.text);
});
test('every collectible card has its own existing illustration cell',()=>{
  assert.equal(new Set(CARDS.map(c=>c.art)).size,CARDS.length);
  for(const c of CARDS)assert.ok(existsSync(new URL(`../public/art/sheet-${Math.floor(c.art/10)}.png`,import.meta.url)),c.id);
});
