const RECIPIENT = 'jamie@floorman.co.nz';
const FROM = 'Floorman Estimator <estimator@floorman.co.nz>';

async function getDropboxAccessToken() {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!refreshToken || !appKey || !appSecret) throw new Error('Dropbox OAuth is not configured');
  const body = new URLSearchParams({ grant_type:'refresh_token', refresh_token:refreshToken, client_id:appKey, client_secret:appSecret });
  const response = await fetch('https://api.dropboxapi.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()});
  const data=await response.json();
  if(!response.ok||!data.access_token) throw new Error('Dropbox token refresh failed');
  return data.access_token;
}

async function saveEnquiryRecord(customer, type, rows, photos) {
  const token=await getDropboxAccessToken();
  const safeFolder=`${customer.name} - ${customer.address}`.replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,80)||'Unassigned';
  const text=[
    'FLOORMAN WAIKATO — ONLINE ESTIMATOR ENQUIRY',
    `Submitted: ${new Date().toLocaleString('en-NZ',{timeZone:'Pacific/Auckland'})}`,
    `Type: ${type}`,
    '',
    ...rows.map(([k,v])=>`${k}: ${v}`),
    '',
    `Photos uploaded: ${photos.length}`
  ].join('\n');
  const dropboxPath=`/Estimator Enquiries/${safeFolder}/Enquiry.txt`;
  const response=await fetch('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Dropbox-API-Arg':JSON.stringify({path:dropboxPath,mode:'overwrite',autorename:false,mute:true}),'Content-Type':'application/octet-stream'},body:Buffer.from(text,'utf8')});
  const data=await response.json();
  if(!response.ok){console.error('Dropbox enquiry record failed',data);throw new Error('Dropbox enquiry record failed');}
  return data.path_display||dropboxPath;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const apiKey=process.env.RESEND_API_KEY;
    if(!apiKey)return res.status(500).json({error:'Email service is not configured'});
    const {type,customer,rows,photos}=req.body||{};
    if(!customer?.name||!customer?.phone||!customer?.email||!customer?.address)return res.status(400).json({error:'Missing customer details'});
    const safeRows=Array.isArray(rows)?rows.slice(0,50):[];
    const safePhotos=Array.isArray(photos)?photos.slice(0,5):[];
    let recordPath='';
    try{recordPath=await saveEnquiryRecord(customer,type==='Concrete'?'Concrete':'Timber',safeRows,safePhotos);}catch(err){console.error(err);}
    const title=`${type==='Concrete'?'Concrete':'Timber'} estimator enquiry — ${customer.name}`;
    const table=safeRows.map(([key,value])=>`<tr><td style="padding:7px 12px;border-bottom:1px solid #ddd;font-weight:600;vertical-align:top">${escapeHtml(key)}</td><td style="padding:7px 12px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('');
    let photoHtml='<p><strong>Dropbox photos:</strong> None</p>';
    if(safePhotos.length){const paths=safePhotos.map(p=>String(p.path||''));const firstPath=paths.find(Boolean)||'';const folder=firstPath.includes('/')?firstPath.split('/').slice(0,-1).join('/'):'Estimator Enquiries';const names=safePhotos.map(p=>{const raw=String(p.name||p.path||'Uploaded photo');return raw.includes('/')?raw.split('/').pop():raw;});photoHtml=`<p><strong>Dropbox photos:</strong> ${safePhotos.length} uploaded</p><p><strong>Folder:</strong> ${escapeHtml(folder)}</p><p><strong>Files:</strong> ${names.map(escapeHtml).join(', ')}</p>`;}
    const recordHtml=recordPath?`<p><strong>Enquiry record:</strong> ${escapeHtml(recordPath)}</p>`:'';
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:FROM,to:[RECIPIENT],reply_to:customer.email,subject:title,html:`<div style="font-family:Arial,sans-serif;max-width:760px"><h2>${escapeHtml(title)}</h2><p>A new enquiry has been submitted through the Floorman online estimator.</p><table style="border-collapse:collapse;width:100%">${table}</table>${photoHtml}${recordHtml}<p style="margin-top:24px;color:#666">Replying to this email will reply to ${escapeHtml(customer.name)} at ${escapeHtml(customer.email)}.</p></div>`})});
    const data=await response.json();
    if(!response.ok){console.error('Resend email failed',data);return res.status(502).json({error:'Enquiry email failed'});}
    return res.status(200).json({ok:true,id:data.id,recordPath});
  }catch(error){console.error('Enquiry submission failed',error);return res.status(500).json({error:'Enquiry submission failed'});}
};
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
