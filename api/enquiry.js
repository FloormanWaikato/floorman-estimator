const RECIPIENT = 'jamie@floorman.co.nz';
const FROM = 'Floorman Estimator <estimator@floorman.co.nz>';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Email service is not configured' });

    const { type, customer, rows, photos } = req.body || {};
    if (!customer?.name || !customer?.phone || !customer?.email || !customer?.address) {
      return res.status(400).json({ error: 'Missing customer details' });
    }

    const safeRows = Array.isArray(rows) ? rows.slice(0, 50) : [];
    const safePhotos = Array.isArray(photos) ? photos.slice(0, 5) : [];
    const title = `${type === 'Concrete' ? 'Concrete' : 'Timber'} estimator enquiry — ${customer.name}`;
    const table = safeRows.map(([key, value]) => `<tr><td style="padding:7px 12px;border-bottom:1px solid #ddd;font-weight:600;vertical-align:top">${escapeHtml(key)}</td><td style="padding:7px 12px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('');
    const photoHtml = safePhotos.length
      ? `<p><strong>Dropbox photos:</strong> ${safePhotos.length}</p><ul>${safePhotos.map(p => `<li>${escapeHtml(p.path || p.name || 'Uploaded photo')}</li>`).join('')}</ul>`
      : '<p><strong>Dropbox photos:</strong> None</p>';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [RECIPIENT],
        reply_to: customer.email,
        subject: title,
        html: `<div style="font-family:Arial,sans-serif;max-width:760px"><h2>${escapeHtml(title)}</h2><p>A new enquiry has been submitted through the Floorman online estimator.</p><table style="border-collapse:collapse;width:100%">${table}</table>${photoHtml}<p style="margin-top:24px;color:#666">Replying to this email will reply to ${escapeHtml(customer.name)} at ${escapeHtml(customer.email)}.</p></div>`
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Resend email failed', data);
      return res.status(502).json({ error: 'Enquiry email failed' });
    }
    return res.status(200).json({ ok: true, id: data.id });
  } catch (error) {
    console.error('Enquiry submission failed', error);
    return res.status(500).json({ error: 'Enquiry submission failed' });
  }
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
