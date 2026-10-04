const {test} = require('node:test');
const assert = require('node:assert/strict');
const {calculateTimber} = require('../api/timber-estimate');
const {buildAcknowledgement} = require('../api/enquiry');
const {calculateConcrete} = require('../api/concrete-estimate');
const fs = require('node:fs');
const path = require('node:path');

test('Natural Oil uses the revised internal rate while other configured rates stay intact', t => {
  const previous = process.env.TIMBER_PRICING_JSON;
  t.after(()=>previous === undefined ? delete process.env.TIMBER_PRICING_JSON : process.env.TIMBER_PRICING_JSON = previous);
  process.env.TIMBER_PRICING_JSON = JSON.stringify({sand:40,water:60,oil:95,stain:80,gapFilling:10,carpetRemoval:5,fixingsRemoval:3,vinylRemoval:8,largeItem:20,minimum:1});
  const input = {area:30,finish:'oil',gapFilling:'no',carpetRemoval:'no',fixingsRemoval:'no',vinylRemoval:'no',largeItems:0,hardboard:'no',stairs:'no',difficultCoatings:'no'};
  const estimate = calculateTimber(input);
  assert.equal(estimate.total,4140);
  assert.equal(calculateTimber({...input,finish:'water'}).total,2070);
  assert.equal(calculateTimber({...input,gapFilling:'yes'}).total,4485);
  const email = buildAcknowledgement({name:'Test',email:'preview@example.com'},'Timber',[],[],estimate);
  assert.ok(email.text.includes('$4,140.00'));
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
