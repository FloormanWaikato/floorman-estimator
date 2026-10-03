# Floorman estimator

Timber pricing is calculated in `api/timber-estimate.js` and recalculated by the enquiry handler. The browser receives only an indicative total including 15% GST, included work, review exclusions and disclaimer. Concrete submission and photo upload endpoints are preserved.

## Private hosting configuration

Set `TIMBER_PRICING_JSON` in the hosting environment for Preview and Production. It must be a JSON object with positive numeric values for `sand`, `water`, `oil`, `stain`, `gapFilling`, `carpetRemoval`, `fixingsRemoval`, `vinylRemoval`, `largeItem`, and `minimum`. All values are NZD excluding GST. Use Jamie's agreed values supplied separately; never commit the private configuration to this public repository.

If configuration is missing or invalid, enquiries still submit, but customers see “Jamie to confirm” instead of a price. Existing Dropbox and Resend environment settings are unchanged.

The minimum applies to the priced subtotal before GST. Selected preparation covers the full measured area. Partial preparation areas should be marked unsure and described in comments. Unknown area/service gives no numeric estimate; uncertain extras are excluded and flagged. Hardboard, stairs, difficult coatings and travel are TBC. Nail punching is included.

## Verification

Run `npm test` (Node 20+). Tests use deliberately synthetic rates, not commercial pricing. They cover finishes, preparation, minimum, GST, quantity validation, unknowns, authoritative enquiry pricing, photo upload, matching Dropbox folder/Enquiry.txt, email content and Concrete regression. External provider calls are mocked; deployment verification with real credentials remains a launch check.

## Presentation follow-up

Persistent Call/Text/Email Jamie links are included on Timber. Replace the existing text brand with the supplied official Floorman logo and add real job thumbnails when the original assets are available. They are not present in this repository. Preserve the Timber/Concrete journeys; the separate Timesheets app is outside scope.
