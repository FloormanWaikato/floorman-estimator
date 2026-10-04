// Shared by enquiry emails and Dropbox records; calculations remain server-side.
function formatEstimate(estimate) {
  const money = value => new Intl.NumberFormat('en-NZ', {style:'currency', currency:'NZD'}).format(value);
  if (estimate.total != null) return money(estimate.total);
  if (estimate.low != null && estimate.high != null) return `${money(estimate.low)} – ${money(estimate.high)}`;
  return 'Jamie to confirm pricing';
}
module.exports = { formatEstimate };
