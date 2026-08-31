function json(data, status=200){
  return new Response(JSON.stringify(data), {
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}

function basicAuthorized(request, password){
  if(!password) return true;
  const header=request.headers.get('Authorization')||'';
  if(!header.startsWith('Basic ')) return false;
  try{
    const decoded=atob(header.slice(6));
    const [user,...rest]=decoded.split(':');
    return user==='client' && rest.join(':')===password;
  }catch{return false}
}

async function getDashboard(request, env){
  const url=new URL(request.url);
  const slug=(url.searchParams.get('slug')||'anchorstrap').toLowerCase();
  if(!env.DB) return json({error:'Live database is not configured yet.', seed_only:true},404);
  const row=await env.DB.prepare(
    'SELECT payload, updated_at FROM dashboard_snapshots WHERE slug = ?'
  ).bind(slug).first();
  if(!row) return json({error:'Dashboard not found.'},404);
  const payload=JSON.parse(row.payload);
  payload.__live=true;
  return json(payload);
}

async function putDashboard(request, env){
  if(!env.DASHBOARD_INGEST_TOKEN) return json({error:'Ingest token is not configured.'},503);
  const auth=request.headers.get('Authorization')||'';
  if(auth !== `Bearer ${env.DASHBOARD_INGEST_TOKEN}`) return json({error:'Unauthorized'},401);
  if(!env.DB) return json({error:'D1 database is not configured.'},503);
  let body;
  try{body=await request.json()}catch{return json({error:'Invalid JSON'},400)}
  const slug=(body?.client?.slug||'').toLowerCase();
  if(!slug) return json({error:'client.slug is required.'},400);
  const now=new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO dashboard_snapshots (slug, client_name, payload, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      client_name=excluded.client_name,
      payload=excluded.payload,
      updated_at=excluded.updated_at
  `).bind(slug, body.client?.name||slug, JSON.stringify(body), now).run();
  return json({ok:true, slug, updated_at:now});
}

function envKey(prefix, requestType){
  return `${prefix}_${String(requestType||'').toUpperCase().replace(/[^A-Z0-9]+/g,'_')}`;
}

async function createClickUpTask(payload, env){
  if(!env.CLICKUP_API_TOKEN) return null;
  const listId=env[envKey('CLICKUP_LIST', payload.request_type)];
  if(!listId) return null;
  const assignee=env[envKey('CLICKUP_ASSIGNEE', payload.request_type)];
  const requestLabel=String(payload.request_type||'request').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
  const title=`[${payload.client_slug||'Client'}] ${requestLabel} - ${payload.summary}`;
  const description=[
    `Client: ${payload.client_slug||''}`,
    `Request type: ${requestLabel}`,
    payload.platform ? `Platform: ${payload.platform}` : '',
    payload.desired_date ? `Desired date: ${payload.desired_date}` : '',
    payload.requester_name ? `Requested by: ${payload.requester_name}` : '',
    payload.requester_email ? `Email: ${payload.requester_email}` : '',
    '',
    'REQUEST DETAILS',
    '---------------',
    payload.description||''
  ].filter(Boolean).join('\n');

  const body={name:title,description};
  if(assignee) body.assignees=[Number(assignee)];
  if(payload.desired_date){
    const ms=Date.parse(`${payload.desired_date}T17:00:00Z`);
    if(Number.isFinite(ms)) body.due_date=ms;
  }
  const r=await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`,{
    method:'POST',
    headers:{'Authorization':env.CLICKUP_API_TOKEN,'Content-Type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!r.ok){
    const text=await r.text();
    throw new Error(`ClickUp ${r.status}: ${text.slice(0,300)}`);
  }
  return await r.json();
}

async function workRequest(request, env){
  let p;
  try{p=await request.json()}catch{return json({error:'Invalid JSON'},400)}
  if(!p.request_type || !p.summary || !p.description) return json({error:'Request type, summary, and details are required.'},400);
  const id=crypto.randomUUID(), now=new Date().toISOString();
  let clickup=null, clickupError=null;
  try{ clickup=await createClickUpTask(p,env); }
  catch(e){ clickupError=e.message; }

  if(env.DB){
    await env.DB.prepare(`
      INSERT INTO work_requests
      (id, client_slug, request_type, summary, description, product_asin, desired_date,
       requester_name, requester_email, status, clickup_task_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,p.client_slug||'',p.request_type,p.summary,p.description,p.product_asin||null,
      p.desired_date||null,p.requester_name||null,p.requester_email||null,
      clickup?'submitted_to_clickup':'received',clickup?.id||null,now
    ).run();
  }
  return json({ok:true,id,status:clickup?'submitted_to_clickup':'received',clickup_task_id:clickup?.id||null,clickup_error:clickupError});
}

export default {
  async fetch(request, env){
    const url=new URL(request.url);

    // Strategy Doc ingestion uses its own bearer token and must not be blocked by portal Basic Auth.
    if(url.pathname==='/api/dashboard' && request.method==='POST') return putDashboard(request,env);

    if(env.PORTAL_PASSWORD && !basicAuthorized(request,env.PORTAL_PASSWORD)){
      return new Response('Authentication required.',{
        status:401,
        headers:{'WWW-Authenticate':'Basic realm="Evolved Commerce Client Dashboard"'}
      });
    }

    if(url.pathname==='/api/dashboard' && request.method==='GET') return getDashboard(request,env);
    if(url.pathname==='/api/work-request' && request.method==='POST') return workRequest(request,env);
    if(url.pathname.startsWith('/api/')) return json({error:'Not found'},404);

    return env.ASSETS.fetch(request);
  }
};
