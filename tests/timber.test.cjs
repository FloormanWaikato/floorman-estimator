const {test}=require('node:test');
const assert=require('node:assert/strict');
const {calculateTimber}=require('../api/timber-estimate');
const enquiry=require('../api/enquiry');
const upload=require('../api/upload');
// Deliberately synthetic values: commercial rates are private hosting configuration.
process.env.TIMBER_PRICING_JSON=JSON.stringify({sand:2,water:3,oil:4,stain:5,gapFilling:6,carpetRemoval:7,fixingsRemoval:8,vinylRemoval:9,largeItem:11,minimum:12});
const base={area:20,finish:'water',gapFilling:'no',carpetRemoval:'no',fixingsRemoval:'no',vinylRemoval:'no',largeItems:0,hardboard:'no',stairs:'no',difficultCoatings:'no'};
for(const [finish,total] of [['sand',46],['water',69],['oil',92],['stain',115]])test(`${finish} includes GST`,()=>assert.equal(calculateTimber({...base,finish}).total,total));
test('minimum is applied before GST',()=>assert.equal(calculateTimber({...base,area:1}).total,13.8));
test('all extras and large items',()=>assert.equal(calculateTimber({...base,gapFilling:'yes',carpetRemoval:'yes',fixingsRemoval:'yes',vinylRemoval:'yes',largeItems:3}).total,796.95));
test('each extra independently',()=>{for(const [key,extra] of [['gapFilling',138],['carpetRemoval',161],['fixingsRemoval',184],['vinylRemoval',207]])assert.equal(calculateTimber({...base,[key]:'yes'}).total,69+extra);});
test('review items excluded, nail punching included',()=>{const e=calculateTimber({...base,hardboard:'yes',stairs:'yes',difficultCoatings:'yes'});assert.equal(e.total,69);assert.equal(e.review.length,4);assert.match(e.included,/Nail punching included/);});
test('unknown area or finish never yields misleading minimum',()=>{assert.equal(calculateTimber({...base,area:null}).total,null);assert.equal(calculateTimber({...base,finish:'unknown'}).total,null);});
test('reject invalid quantities and choices',()=>{for(const area of [-1,0,'20',Infinity,NaN,100001])assert.throws(()=>calculateTimber({...base,area}));for(const largeItems of [-1,1.5,'2'])assert.throws(()=>calculateTimber({...base,largeItems}));assert.throws(()=>calculateTimber({...base,gapFilling:'maybe'}));});
test('unknown extras explicitly flagged and rounding to cents',()=>{assert.match(calculateTimber({...base,carpetRemoval:'unknown'}).review.join(),/Carpet removal/);assert.equal(calculateTimber({...base,area:20.1}).total,69.35);});
function response(){return{code:200,status(code){this.code=code;return this},json(body){this.body=body;return this}};}
test('upload, Dropbox record and email preserve photo and authoritative total',async()=>{
 const previous=global.fetch; const saved={...process.env};const calls=[];
 Object.assign(process.env,{DROPBOX_REFRESH_TOKEN:'test',DROPBOX_APP_KEY:'test',DROPBOX_APP_SECRET:'test',RESEND_API_KEY:'test'});
 global.fetch=async(url,options)=>{calls.push({url,options});let data={id:'test-mail'};if(url.includes('oauth2'))data={access_token:'test'};if(url.includes('files/upload')){const arg=JSON.parse(options.headers['Dropbox-API-Arg']);data={path_display:arg.path,name:arg.path.split('/').pop()};}return{ok:true,json:async()=>data}};
 try{
 const photo=response();await upload({method:'POST',body:{filename:'floor.jpg',folder:'Test Customer - Test Address',content:'data:image/jpeg;base64,/9j/2Q=='}},photo);assert.equal(photo.code,200);
 const res=response();await enquiry({method:'POST',body:{type:'Timber',customer:{name:'Test Customer',phone:'021000000',email:'test@example.com',address:'Test Address'},rows:[['Service','Sand & coat']],photos:[photo.body],timber:base,estimate:{total:1}}},res);
 assert.equal(res.code,200);assert.equal(res.body.estimate.total,69);
 const record=calls.find(c=>c.url.includes('files/upload')&&JSON.parse(c.options.headers['Dropbox-API-Arg']).path.endsWith('/Enquiry.txt'));
 assert.ok(record);assert.match(record.options.body.toString(),/69\.00/);assert.match(record.options.body.toString(),/Photos uploaded: 1/);
 assert.equal(JSON.parse(record.options.headers['Dropbox-API-Arg']).path.split('/').slice(0,-1).join('/'),photo.body.path.split('/').slice(0,-1).join('/'));
 const mail=JSON.parse(calls.find(c=>c.url.includes('resend')).options.body);assert.deepEqual(mail.to,['jamie@floorman.co.nz']);assert.match(mail.html,/69\.00/);assert.match(mail.html,/floor.jpg/);
 const concrete=response();await enquiry({method:'POST',body:{type:'Concrete',customer:{name:'Test',phone:'1',email:'test@example.com',address:'Test'},rows:[],photos:[]}},concrete);assert.equal(concrete.code,200);assert.equal(concrete.body.estimate,undefined);
 }finally{global.fetch=previous;for(const key of ['DROPBOX_REFRESH_TOKEN','DROPBOX_APP_KEY','DROPBOX_APP_SECRET','RESEND_API_KEY']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
});
test('invalid pricing rejected before any external submission',async()=>{const old=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='test';try{const r=response();await enquiry({method:'POST',body:{type:'Timber',timber:{...base,area:-1}}},r);assert.equal(r.code,400);}finally{if(old===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=old;}});

test('missing private configuration accepts review without a numeric price',()=>{const saved=process.env.TIMBER_PRICING_JSON;delete process.env.TIMBER_PRICING_JSON;try{const e=calculateTimber({...base,stairs:'yes'});assert.equal(e.total,null);assert.ok(e.review.some(v=>v.includes('Stairs')));}finally{process.env.TIMBER_PRICING_JSON=saved}});
