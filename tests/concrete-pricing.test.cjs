const {test} = require('node:test');
const assert = require('node:assert/strict');
const {calculateConcrete} = require('../api/concrete-estimate');
const {formatEstimate} = require('../lib/estimate-format');
const enquiry = require('../api/enquiry');

test('polished concrete uses $110/m² excluding GST', () => {
  const estimate = calculateConcrete({service:'Full polished concrete',area:30,rate:1});
  assert.equal(estimate.total,3795);
  assert.equal(estimate.status,'indicative');
  assert.equal(estimate.gst,'Includes 15% GST');
});
test('grind and seal uses the approved sealer rate', () => {
  assert.equal(calculateConcrete({service:'Grind & seal',sealer:'Concrete sealer',area:30}).total,2242.5);
  assert.equal(calculateConcrete({service:'Grind & seal',sealer:'Epoxy sealer',area:30}).total,2932.5);
});
test('undecided sealer returns a GST-inclusive range', () => {
  const estimate = calculateConcrete({service:'Grind & seal',sealer:'Not sure',area:30});
  assert.equal(estimate.total,null);
  assert.equal(estimate.low,2242.5);
  assert.equal(estimate.high,2932.5);
  assert.equal(formatEstimate(estimate),'$2,242.50 – $2,932.50');
  assert.ok(estimate.review.some(item=>item.includes('Sealer type')));
});
test('preparation, unknown service and unknown area need discussion', () => {
  for(const input of [
    {service:'Floor preparation / levelling',area:30},
    {service:'Other / Not sure',area:30},
    {service:'Full polished concrete',area:null}
  ]) {
    const estimate = calculateConcrete(input);
    assert.equal(estimate.status,'review');
    assert.equal(estimate.total,null);
    assert.equal(estimate.low,null);
  }
});
test('invalid measurements cannot produce a price', () => {
  for(const area of [0,-1,NaN,Infinity,100001,'30']) {
    assert.throws(()=>calculateConcrete({service:'Full polished concrete',area}),/floor area/);
  }
  assert.throws(()=>calculateConcrete(null),/Invalid concrete/);
});
test('money formatting retains Timber totals and review results', () => {
  assert.equal(formatEstimate({total:1234.5}),'$1,234.50');
  assert.equal(formatEstimate({total:null}),'Jamie to confirm pricing');
});
test('Concrete prices reach the response, both emails and Dropbox record', async t => {
  const keys = ['RESEND_API_KEY','DROPBOX_REFRESH_TOKEN','DROPBOX_APP_KEY','DROPBOX_APP_SECRET'];
  const old = Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  keys.forEach(key=>process.env[key]='local-test-only');
  t.after(()=>keys.forEach(key=>old[key]===undefined?delete process.env[key]:process.env[key]=old[key]));
  const calls = [];
  t.mock.method(global,'fetch',async(url,options)=>{
    calls.push({url,options});
    return {ok:true,status:200,json:async()=>url.includes('oauth2/token')?{access_token:'local-test-only'}:url.includes('dropbox')?{path_display:'/TEST/Enquiry.txt'}:{id:'test-email'}};
  });
  for(const concrete of [
    {service:'Full polished concrete',area:30},
    {service:'Grind & seal',area:30,sealer:'Not sure'},
    {service:'Floor preparation / levelling',area:30}
  ]) {
    calls.length=0;
    let status,body;
    const req={method:'POST',body:{type:'Concrete',customer:{name:'Local Test',phone:'0210000000',email:'preview@example.com',address:'Local preview only'},rows:[],photos:[],concrete}};
    const res={status(code){status=code;return this},json(value){body=value;return this}};
    await enquiry(req,res);
    assert.equal(status,200);
    assert.equal(body.customerEmailSent,true);
    const price=formatEstimate(body.estimate);
    const record=calls.find(call=>call.url.includes('content.dropbox'));
    assert.ok(record.options.body.toString().includes(price));
    const emails=calls.filter(call=>call.url==='https://api.resend.com/emails').map(call=>JSON.parse(call.options.body));
    const staff=emails.find(email=>email.to[0]==='jamie@floorman.co.nz');
    const customer=emails.find(email=>email.to[0]==='preview@example.com'&&!email.scheduled_at);
    assert.ok(staff.html.includes(price));
    assert.ok(customer.text.includes(price));
    assert.ok(customer.html.includes(price));
    assert.ok(customer.text.includes('Indicative Concrete pricing guide'));
    assert.equal(emails.filter(email=>email.scheduled_at).length,1);
  }
});

test('selected concrete defects add approved explanation to result and customer email', () => {
  const {buildAcknowledgement}=require('../api/enquiry');
  for(const condition of ['Cracks','Holes or damaged areas','Existing repairs or patches','Oil, stains or contamination']) {
    const estimate=calculateConcrete({area:20,service:'Full polished concrete',conditions:[condition]});
    assert.ok(estimate.disclaimer.includes('some defects') || estimate.disclaimer.includes('defects may remain visible'));
    assert.equal(estimate.total,2530);
    const email=buildAcknowledgement({name:'Test',email:'preview@example.com'},'Concrete',[],[],estimate);
    assert.ok(email.text.includes('Repairs may differ in colour or texture'));
    assert.ok(email.html.includes('Repairs may differ in colour or texture'));
  }
  assert.ok(!calculateConcrete({area:20,service:'Full polished concrete',conditions:['Nothing obvious']}).disclaimer.includes('Existing concrete defects'));
});

test('Bush Hammer uses approved hidden rate with GST and retains unknown-area review', () => {
 const estimate=calculateConcrete({service:'Bush Hammer',area:20,rate:1});
 assert.equal(estimate.total,1725);
 assert.equal(estimate.status,'indicative');
 assert.match(estimate.included,/Bush Hammer/);
 assert.equal(estimate.rate,undefined);
 assert.equal(calculateConcrete({service:'Bush Hammer',area:null}).status,'review');
});
