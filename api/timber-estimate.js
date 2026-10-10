// Server-side only: never include this module in browser assets.
function pricingConfig() {
  let config;
  try { config = JSON.parse(process.env.TIMBER_PRICING_JSON); } catch { return null; }
  if (config && config.areaBands) {
    if (!Array.isArray(config.areaBands) || !config.areaBands.length || !config.areaBands.every(b => Number.isFinite(b.maxArea) && b.maxArea > 0 && Number.isFinite(b.rate) && b.rate > 0) || !Number.isFinite(config.stain) || config.stain <= 0 || !Number.isFinite(config.minimum) || config.minimum <= 0) return null;
    return config;
  }
  const keys = ['sand','water','oil','stain','gapFilling','carpetRemoval','fixingsRemoval','vinylRemoval','largeItem','minimum'];
  if (!config || !keys.every(key => typeof config[key] === 'number' && Number.isFinite(config[key]) && config[key] > 0)) return null;
  return config;
}
const disclaimer = 'Indicative only, not a quote. Jamie will confirm measurements, floor condition, preparation and coating after reviewing your details/photos or a site visit. TBC items are excluded and may increase the final price.';
function calculateTimber(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid timber details');
  const review = ['Travel — TBC'];
  const rates = pricingConfig();
  if (!rates) review.push('Jamie will review your enquiry and confirm pricing.');
  const area = input.area;
  if (area != null && (typeof area !== 'number' || !Number.isFinite(area) || area <= 0 || area > 100000)) throw new Error('Enter a valid floor area');
  if(input.preparationTarget !== undefined) return calculatePreparation(input);
  const finish = ['sand','water','oil','stain','vinyl'].includes(input.finish) ? input.finish : null;
  if (!finish) review.push('Service/coating system — Jamie to recommend');
  if (area == null) review.push('Floor area — TBC');
  let baseRate = rates && finish ? rates[finish] : null;
  if (rates && rates.areaBands && area != null && finish) {
    baseRate = ['sand','vinyl','stain'].includes(finish) ? rates[finish] : rates.areaBands.find(b => area <= b.maxArea)?.rate;
    if (finish === 'vinyl' && input.substrate !== 'yes') {baseRate=null;review.push('Vinyl preparation substrate — Jamie to assess and price');}
    if (!baseRate && ['water','oil'].includes(finish)) review.push('Floor area above approved pricing range — Jamie to confirm');
  }
  let subtotal = area == null || !finish || !rates || !baseRate ? null : area * baseRate;
  if (subtotal != null && rates.areaBands && !['sand','vinyl'].includes(finish) && area <= 10) subtotal = finish === 'stain' ? Math.max(rates.minimum, subtotal) : rates.minimum;
  for (const [key, label] of [['gapFilling','Gap filling'],['carpetRemoval','Carpet removal'],['fixingsRemoval','Tacks/staples/gripper removal'],['vinylRemoval','Normal vinyl/lino removal']]) {
    const choice = input[key];
    if (!['yes','no','unknown'].includes(choice)) throw new Error(`Choose ${label.toLowerCase()}`);
    if (choice === 'unknown') review.push(`${label} — Jamie to price after inspection`);
    if (choice === 'yes' && subtotal != null) {
      if (Number.isFinite(rates[key]) && rates[key] > 0) subtotal += area * rates[key];
      else review.push(`${label} — Jamie to price after inspection`);
    }
  }
  if (input.largeItems == null) review.push('Large items to move — TBC');
  else if (!Number.isInteger(input.largeItems) || input.largeItems < 0 || input.largeItems > 10000) throw new Error('Enter a whole number of large items');
  else if (subtotal != null && input.largeItems > 0) {
    if (Number.isFinite(rates.largeItem) && rates.largeItem > 0) subtotal += input.largeItems * rates.largeItem;
    else review.push('Large items to move — TBC');
  }
  for (const [key,label] of [['hardboard','Hardboard removal — Jamie to price after inspection'],['difficultCoatings','Heavy glue/adhesive, paint or difficult coatings — review/TBC']]) {
    if (!['yes','no','unknown'].includes(input[key])) throw new Error('Complete the review questions');
    if (input[key] !== 'no') review.push(label);
  }
  const total = subtotal == null ? null : Math.round((['sand','vinyl'].includes(finish)?subtotal:Math.max(rates.minimum, subtotal)) * 115) / 100;
  return { status: total == null ? 'review' : 'indicative', total, currency: 'NZD', gst: 'Includes 15% GST', review, disclaimer, included: 'Nail punching included' };
}
module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try { return res.status(200).json(calculateTimber(req.body)); }
  catch (error) { return res.status(400).json({error:error.message}); }
};
module.exports.calculateTimber = calculateTimber;


function calculatePreparation(input={}) {
  const rates=pricingConfig();
  const target=input.preparationTarget, substrate=input.substrate, covering=input.covering||input.surface||'';
  const tiles=covering==='Ceramic tiles'||covering==='Cork tiles';
  const review=['Travel — TBC','Repairs and additional levelling — Jamie to confirm after inspection'];
  let rate=null, included='Floor preparation for the selected covering';
  if(substrate==='timber'&&target==='vinyl') {rate=rates?.vinyl;included='Hardboard overlay — Jamie to confirm suitability after inspection';}
  else if(substrate==='timber'&&target==='laminate') {rate=rates?.laminateTimber;included='Sand timber floor ready for laminate flooring';}
  else if(substrate==='timber'&&target==='coating'&&input.tongueGroove==='yes') {rate=rates?.sand;included='Sand tongue-and-groove timber ready for coating';}
  else if(substrate==='particleboard'&&['vinyl','laminate'].includes(target)) {
    rate=covering==='Vinyl/lino'?rates?.particleVinylLift:rates?.particleSand;
    included=covering==='Vinyl/lino'?'Lift existing vinyl and sand particle board ready for the new flooring':'Sand particle board ready for the new flooring';
  } else if(substrate==='concrete'&&target==='vinyl') {rate=rates?.vinylConcrete;included=covering==='Vinyl/lino'?'Lift existing vinyl, grind and skim preparation — Jamie to confirm suitability after inspection':covering==='Carpet'?'Remove existing carpet, grind and skim preparation — Jamie to confirm suitability after inspection':'Grind and skim preparation — Jamie to confirm suitability after inspection';}
  if(tiles&&(substrate==='particleboard'||substrate==='concrete')) {rate=null;review.unshift('Ceramic or cork tiles — Jamie to discuss removal and preparation before confirming pricing');}
  else if(substrate==='timber'&&covering==='Ceramic tiles') review.unshift('Ceramic tile removal — Jamie to confirm price; removal is excluded from this estimate');
  let subtotal=input.area!=null&&Number.isFinite(rate)&&rate>0?input.area*rate:null;
  if(substrate==='timber'&&covering==='Carpet') {
    if(subtotal!=null&&Number.isFinite(rates?.prepCarpetRemoval)) {subtotal+=input.area*rates.prepCarpetRemoval;included+='; carpet removal and disposal included';}
    else review.unshift('Carpet removal and disposal — Jamie to confirm with the preparation scope');
  }
  const total=subtotal==null?null:Math.round(subtotal*115)/100;
  if(total==null)review.push('Preparation scope and pricing — Jamie to confirm');
  return {status:total==null?'review':'indicative',total,currency:'NZD',gst:'Includes 15% GST',included,review,disclaimer};
}
module.exports.calculatePreparation=calculatePreparation;
