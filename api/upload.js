const path = require('path');
const DROPBOX_ROOT_NAMESPACE = '13634290';
const ESTIMATOR_ROOT = '/\u200dFLOORMAN  Waikato/Estimator Enquiries';

function asciiJson(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

async function getDropboxAccessToken() {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!refreshToken || !appKey || !appSecret) throw new Error('Dropbox OAuth is not configured');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: appKey,
    client_secret: appSecret
  });
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error('Dropbox token refresh failed', data);
    throw new Error('Dropbox token refresh failed');
  }
  return data.access_token;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = await getDropboxAccessToken();
    const { filename, content, folder } = req.body || {};
    if (!filename || !content) return res.status(400).json({ error: 'Missing photo data' });

    const match = String(content).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Only image files are accepted' });

    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length > 3 * 1024 * 1024) return res.status(413).json({ error: 'Photo is too large. Maximum 3 MB per photo.' });

    const safeName = path.basename(String(filename)).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFolder = String(folder || 'Unassigned').replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'Unassigned';
    const dropboxPath = `${ESTIMATOR_ROOT}/${safeFolder}/${Date.now()}-${safeName}`;

    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Path-Root': asciiJson({ '.tag': 'root', root: DROPBOX_ROOT_NAMESPACE }),
        'Dropbox-API-Arg': asciiJson({ path: dropboxPath, mode: 'add', autorename: true, mute: true }),
        'Content-Type': 'application/octet-stream'
      },
      body: bytes
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Dropbox upload failed', data);
      return res.status(response.status).json({ error: 'Dropbox upload failed' });
    }

    return res.status(200).json({ ok: true, name: data.name, path: data.path_display });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Photo upload failed' });
  }
};
