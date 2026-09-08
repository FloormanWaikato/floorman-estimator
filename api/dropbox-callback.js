export default async function handler(req, res) {
  const { code, error, error_description: errorDescription } = req.query;
  if (error) {
    return res.status(400).send(`<h2>Dropbox connection cancelled</h2><p>${escapeHtml(errorDescription || error)}</p>`);
  }
  if (!code) {
    return res.status(400).send('<h2>Missing Dropbox authorization code.</h2>');
  }

  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!appKey || !appSecret) {
    return res.status(500).send('<h2>Dropbox app credentials are not configured in Vercel.</h2>');
  }

  const redirectUri = 'https://floorman-estimator.vercel.app/api/dropbox-callback';
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: appKey,
    client_secret: appSecret,
    redirect_uri: redirectUri,
  });

  try {
    const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await tokenResponse.json();
    if (!tokenResponse.ok || !data.refresh_token) {
      console.error('Dropbox OAuth exchange failed', data);
      return res.status(500).send('<h2>Dropbox connection failed.</h2><p>No refresh token was returned. Please return to ChatGPT.</p>');
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(`<!doctype html><html><head><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dropbox connected</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:50px auto;padding:20px;line-height:1.5}code{display:block;padding:14px;background:#f3f3f3;overflow-wrap:anywhere;border-radius:8px}strong{color:#b42318}</style></head><body><h1>Dropbox connected</h1><p>Your permanent refresh token is below.</p><p><strong>Keep this private. Do not paste it into ChatGPT.</strong></p><code>${escapeHtml(data.refresh_token)}</code><p>Leave this page open and return to ChatGPT for the next step.</p></body></html>`);
  } catch (err) {
    console.error('Dropbox OAuth callback error', err);
    return res.status(500).send('<h2>Dropbox connection failed.</h2><p>Please return to ChatGPT.</p>');
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
