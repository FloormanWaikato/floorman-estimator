const disclaimer = 'Indicative only, not a quote. Jamie will confirm measurements, slab condition, preparation and finish after reviewing your details/photos or a site visit. Additional preparation, repairs and travel are excluded and may increase the final price.';
const defectDisclaimer = 'Existing concrete defects: We take care to achieve the best possible finish. However, existing cracks, holes, patches, oil stains or other defects may remain visible after grinding, polishing or sealing. Repairs may differ in colour or texture from the surrounding concrete. Jamie will assess these areas and explain the likely result before work begins.';
const money = amount => Math.round((amount + Number.EPSILON) * 100) / 100;
function calculateConcrete(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid concrete details');
  const area = input.area;
  if (area != null && (typeof area !== 'number' || !Number.isFinite(area) || area <= 0 || area > 100000)) throw new Error('Enter a valid positive floor area, or choose Not sure');
  const review = ['Additional preparation / levelling and repairs — discuss with Jamie', 'Travel — TBC'];
  if (area == null) review.unshift('Floor area — TBC');
  if (input.surface && input.surface !== 'Bare concrete') review.unshift('Existing surface preparation — Jamie to confirm additional costs upon inspection');
  let rateLow = null, rateHigh = null;
  if (input.service === 'Full polished concrete') rateLow = rateHigh = 110;
  else if (input.service === 'Grind & seal') {
    if (input.sealer === 'Concrete sealer') rateLow = rateHigh = 65;
    else if (input.sealer === 'Epoxy sealer') rateLow = rateHigh = 85;
    else {
      rateLow = 65; rateHigh = 85;
      review.unshift('Sealer type — Jamie to recommend');
    }
  } else if(input.service==='Grind and polish — low sheen') review.unshift('Grind and polish — low sheen — Jamie to confirm scope and pricing');
  else if(input.service==='Bush Hammer') review.unshift('Textured Decorative Finish (Bush Hammer) — discuss scope and pricing with Jamie');
  else review.unshift(input.service === 'Floor preparation / levelling' ? 'Floor preparation / levelling — discuss scope and pricing with Jamie' : 'Service / finish — Jamie to recommend');
  const low = area == null || rateLow == null ? null : money(area * rateLow * 1.15);
  const high = area == null || rateHigh == null ? null : money(area * rateHigh * 1.15);
  return {
    status: low == null ? 'review' : low === high ? 'indicative' : 'range',
    total: low != null && low === high ? low : null,
    low, high, currency: 'NZD', gst: 'Includes 15% GST',
    included: input.service === 'Full polished concrete' ? 'Polished concrete finish for the measured area' : input.service === 'Grind & seal' ? 'Grind & seal finish for the measured area' : '',
    review, disclaimer: Array.isArray(input.conditions) && input.conditions.some(condition=>['Cracks','Holes or damaged areas','Existing repairs or patches','Oil, stains or contamination'].includes(condition)) ? disclaimer+'\n\n'+defectDisclaimer : disclaimer
  };
}
module.exports = function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try { return res.status(200).json(calculateConcrete(req.body)); }
  catch (error) { return res.status(400).json({error:error.message}); }
};
module.exports.calculateConcrete = calculateConcrete;
