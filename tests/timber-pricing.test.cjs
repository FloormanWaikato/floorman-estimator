const {test} = require('node:test');
const assert = require('node:assert/strict');
const {calculateTimber} = require('../api/timber-estimate');
const {buildAcknowledgement} = require('../api/enquiry');
const {calculateConcrete} = require('../api/concrete-estimate');
const fs = require('node:fs');
const path = require('node:path');

test('Legacy configured rates remain intact', t => {
  const previous = process.env.TIMBER_PRICING_JSON;
  t.after(()=>previous === undefined ? delete process.env.TIMBER_PRICING_JSON : process.env.TIMBER_PRICING_JSON = previous);
  process.env.TIMBER_PRICING_JSON = JSON.stringify({sand:40,water:60,oil:95,stain:80,gapFilling:10,carpetRemoval:5,fixingsRemoval:3,vinylRemoval:8,largeItem:20,minimum:1});
  const input = {area:30,finish:'oil',gapFilling:'no',carpetRemoval:'no',fixingsRemoval:'no',vinylRemoval:'no',largeItems:0,hardboard:'no',stairs:'no',difficultCoatings:'no'};
  const estimate = calculateTimber(input);
  assert.equal(estimate.total,3277.5);
  assert.equal(calculateTimber({...input,finish:'water'}).total,2070);
  assert.equal(calculateTimber({...input,gapFilling:'yes'}).total,3622.5);
  const email = buildAcknowledgement({name:'Test',email:'preview@example.com'},'Timber',[],[],estimate);
  assert.ok(email.text.includes('$3,277.50'));
  assert.ok(!email.text.includes('$120'));
  assert.ok(!email.html.includes('$120'));
});
test('Concrete response contains total pricing without internal rates', () => {
  const estimate = calculateConcrete({area:30,service:'Grind & seal',sealer:'Not sure'});
  assert.equal(estimate.low,2242.5);
  assert.equal(estimate.high,2932.5);
  for(const key of ['rateLow','rateHigh','rateBasis','rates','formula']) assert.ok(!(key in estimate));
});
test('both customer forms retain required contact fields and four stages without unit rates', () => {
  for(const page of ['index.html','concrete.html']){
    const html = fs.readFileSync(path.join(__dirname,'..',page),'utf8');
    assert.deepEqual([...html.matchAll(/data-step="(\d+)"/g)].map(match=>match[1]),['1','2','3','4']);
    assert.ok(!/\$\d[^<]*\/m²/.test(html));
    for(const name of ['name','phone','email','address']) assert.match(html,new RegExp('required[^>]*name="'+name+'"'));
    assert.ok(html.includes('Selected photos are uploaded'));
  }
});

test('approved area bands, minimum and staining remain server-only', t => {
  const previous = process.env.TIMBER_PRICING_JSON;
  t.after(()=>previous === undefined ? delete process.env.TIMBER_PRICING_JSON : process.env.TIMBER_PRICING_JSON = previous);
  process.env.TIMBER_PRICING_JSON = JSON.stringify({areaBands:[{maxArea:70,rate:85},{maxArea:130,rate:80}],stain:100,minimum:650});
  const input = {finish:'oil',gapFilling:'no',carpetRemoval:'no',fixingsRemoval:'no',vinylRemoval:'no',largeItems:0,hardboard:'no',stairs:'no',difficultCoatings:'no'};
  for(const [area,total] of [[1,747.5],[10,747.5],[11,1075.25],[70,6842.5],[71,6532],[130,11960],[131,null]]) {
    for(const finish of ['oil','water','sand']) assert.equal(calculateTimber({...input,area,finish}).total,total);
  }
  assert.equal(calculateTimber({...input,area:140,finish:'stain'}).total,16100);
  assert.equal(calculateTimber({...input,area:5,finish:'stain'}).total,747.5);
  const extras=calculateTimber({...input,area:20,gapFilling:'yes',largeItems:2});
  assert.equal(extras.total,1955);
  assert.ok(extras.review.includes('Gap filling — Jamie to price after inspection'));
  assert.ok(extras.review.includes('Large items to move — TBC'));
});
