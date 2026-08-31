const $ = (id) => document.getElementById(id);
let dashboard = null;

const fmtMoney = (n, compact=false) =>
  new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:compact?0:0,notation:compact?'compact':'standard'}).format(Number(n||0));
const fmtPct = (n, digits=1) => `${(Number(n||0)*100).toFixed(digits)}%`;
const fmtNum = n => new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Number(n||0));
const fmtRoas = n => `${Number(n||0).toFixed(2)}x`;
const statusClass = s => s === 'HEALTHY' ? 'healthy' : s === 'WATCH' ? 'watch' : 'action';
const statusLabel = s => ({HEALTHY:'Healthy',ACTION_NEEDED:'Action Needed',WATCH:'Watch',NEEDS_ATTENTION:'Needs Attention'}[s] || String(s||'').replaceAll('_',' '));

function slugFromHost(){
  const host = location.hostname.toLowerCase();
  const parts = host.split('.');
  if(host.endsWith('.evolvedcommerce.com') && parts.length > 2) return parts[0];
  const q = new URLSearchParams(location.search).get('client');
  return q || 'anchorstrap';
}

async function loadDashboard(){
  const slug = slugFromHost();
  let data = null;
  try{
    const r = await fetch(`/api/dashboard?slug=${encodeURIComponent(slug)}`, {headers:{'Accept':'application/json'}});
    if(r.ok) data = await r.json();
  }catch(e){}
  if(!data){
    const fallback = await fetch(`/data/${slug}.json`);
    if(!fallback.ok) throw new Error(`No dashboard data found for ${slug}`);
    data = await fallback.json();
    data.__seed = true;
  }
  dashboard = data;
  render(data);
}

function render(d){
  $('client-name').textContent = d.client?.name || 'Client Dashboard';
  $('period-label').textContent = d.period_label || '';
  const through = d.data_through?.sales ? `Data through ${new Date(d.data_through.sales+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : '';
  $('updated-label').textContent = d.__seed ? `${through} • Prototype data` : through;

  $('health-headline').textContent = d.summary?.headline || statusLabel(d.health?.overall);
  $('health-detail').textContent = d.summary?.detail || '';
  const healthItems = [
    ['Growth',d.health?.growth],['Advertising',d.health?.advertising],
    ['Conversion',d.health?.conversion],['Inventory',d.health?.inventory],
    ['Data',d.health?.data_freshness]
  ];
  $('health-grid').innerHTML = healthItems.map(([name,s]) =>
    `<div class="health-item"><span>${name}</span><span class="status ${statusClass(s)}">${statusLabel(s)}</span></div>`).join('');

  $('kpi-sales').textContent = fmtMoney(d.kpis?.total_sales);
  $('kpi-ad-sales').textContent = fmtMoney(d.kpis?.ad_sales);
  $('kpi-ad-spend').textContent = fmtMoney(d.kpis?.ad_spend);
  $('kpi-roas').textContent = fmtRoas(d.kpis?.roas);
  $('kpi-tacos').textContent = fmtPct(d.kpis?.tacos);
  $('sales-goal').textContent = d.goals?.monthly_sales?.target ? `Projected ${fmtMoney(d.kpis?.projected_sales)} • Goal ${fmtMoney(d.goals.monthly_sales.target)}` : 'Month to date';
  $('roas-target').textContent = d.goals?.roas?.target ? `Target ≥ ${fmtRoas(d.goals.roas.target)}` : '';
  $('tacos-target').textContent = d.goals?.tacos?.target ? `Target ≤ ${fmtPct(d.goals.tacos.target)}` : '';
  $('tacos-chart-target').textContent = d.goals?.tacos?.target ? `Target ≤ ${fmtPct(d.goals.tacos.target)}` : '';

  fillList('wins-list', d.wins || []);
  fillList('focus-list', d.focus || []);
  fillList('watch-list', d.watching || []);

  $('product-table').innerHTML = (d.top_products||[]).map(p => {
    const trend = Number(p.sales_change||0);
    const trendClass = trend > .002 ? 'trend-up' : trend < -.002 ? 'trend-down' : 'trend-flat';
    const arrow = trend > .002 ? '↑' : trend < -.002 ? '↓' : '—';
    return `<tr>
      <td><span class="product-name">${prettyName(p.product)}</span><span class="asin">${p.asin||''}</span></td>
      <td>${fmtMoney(p.sales)}</td>
      <td class="${trendClass}">${arrow} ${Math.abs(trend*100).toFixed(1)}%</td>
      <td>${fmtPct(p.conversion_rate)}</td>
    </tr>`;
  }).join('');

  const inv = d.inventory || {};
  $('inventory-count').textContent = `${fmtNum(inv.risk_products)} risks`;
  $('out-of-stock').textContent = fmtNum(inv.out_of_stock);
  $('order-now').textContent = fmtNum(inv.order_now);
  $('inventory-list').innerHTML = (inv.critical_products||[]).slice(0,5).map(x =>
    `<div class="inventory-row"><div><strong>${prettyName(x.product)}</strong><span>${x.asin||''}</span></div><b>${fmtNum(x.recommended_units)} units</b></div>`).join('');

  drawSalesChart(d);
  drawTacosChart(d);
  $('request-client-slug').value = d.client?.slug || 'anchorstrap';
}

function fillList(id, items){ $(id).innerHTML = items.map(x=>`<li>${escapeHtml(x)}</li>`).join(''); }

function prettyName(v=''){
  let s = String(v).replace('Anchor Strap Co | ','').replaceAll(' | ',' · ');
  if(s.length > 72) s = s.slice(0,69).trim()+'…';
  return s;
}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

function drawSalesChart(d){
  const points = [...(d.monthly_trend||[])].map(x=>({label:x.month.slice(0,3),value:x.total_sales}));
  points.push({label:'Aug*',value:d.kpis?.projected_sales||0});
  drawLine('sales-chart', points, {value:v=>fmtMoney(v,true), stroke:'#2d5bd1', fill:'#eef3ff'});
}

function drawTacosChart(d){
  const points = [...(d.monthly_trend||[])].map(x=>({label:x.month.slice(0,3),value:x.tacos}));
  points.push({label:'Aug',value:d.kpis?.tacos||0});
  drawLine('tacos-chart', points, {value:v=>fmtPct(v,0), stroke:'#18864b', fill:'#eaf8f0', target:d.goals?.tacos?.target});
}

function drawLine(id, points, opts){
  const el = $(id); const w=720,h=220,pad={l:48,r:18,t:20,b:34};
  if(!points.length){el.innerHTML='';return}
  const vals=points.map(p=>Number(p.value||0)); let min=Math.min(...vals,opts.target??Infinity),max=Math.max(...vals,opts.target??-Infinity);
  if(min===max){min*=.8;max*=1.2}
  const spread=max-min; min=Math.max(0,min-spread*.18); max=max+spread*.18;
  const x=i=>pad.l+(i*(w-pad.l-pad.r)/Math.max(1,points.length-1));
  const y=v=>pad.t+(max-v)*(h-pad.t-pad.b)/(max-min);
  const coords=points.map((p,i)=>[x(i),y(p.value)]);
  const line=coords.map((c,i)=>(i?'L':'M')+c[0].toFixed(1)+','+c[1].toFixed(1)).join(' ');
  const area=`M${coords[0][0]},${h-pad.b} `+coords.map(c=>`L${c[0]},${c[1]}`).join(' ')+` L${coords.at(-1)[0]},${h-pad.b} Z`;
  const grid=[0,.5,1].map(t=>{const val=max-(max-min)*t,yy=pad.t+(h-pad.t-pad.b)*t;return `<line x1="${pad.l}" y1="${yy}" x2="${w-pad.r}" y2="${yy}" stroke="#edf0f5"/><text x="4" y="${yy+4}" class="axis-label">${opts.value(val)}</text>`}).join('');
  const labels=points.map((p,i)=>`<text x="${x(i)}" y="${h-10}" text-anchor="middle" class="axis-label">${p.label}</text>`).join('');
  const dots=coords.map((c,i)=>`<circle cx="${c[0]}" cy="${c[1]}" r="3.7" fill="#fff" stroke="${opts.stroke}" stroke-width="2"/><text x="${c[0]}" y="${c[1]-10}" text-anchor="middle" class="chart-value">${opts.value(points[i].value)}</text>`).join('');
  let target='';
  if(opts.target !== undefined && opts.target !== null){
    const ty=y(opts.target); target=`<line x1="${pad.l}" y1="${ty}" x2="${w-pad.r}" y2="${ty}" stroke="#b66a08" stroke-width="1.3" stroke-dasharray="5 5"/>`;
  }
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${grid}${target}<path d="${area}" fill="${opts.fill}" opacity=".65"/><path d="${line}" fill="none" stroke="${opts.stroke}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${dots}${labels}</svg>`;
}

const dialog = $('request-dialog');
$('request-work-btn').addEventListener('click',()=>dialog.showModal());
$('close-dialog').addEventListener('click',()=>dialog.close());
$('request-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const status=$('request-status'); const form=e.currentTarget;
  status.textContent='Submitting…';
  const payload=Object.fromEntries(new FormData(form).entries());
  try{
    const r=await fetch('/api/work-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(result.error||'Request service is not configured yet.');
    status.textContent=result.clickup_task_id?'Submitted to the Evolved team ✓':'Request saved ✓';
    setTimeout(()=>{dialog.close();form.reset();status.textContent='';},1300);
  }catch(err){
    const local={...payload,created_at:new Date().toISOString()};
    const existing=JSON.parse(localStorage.getItem('evolved_prototype_requests')||'[]');
    existing.push(local); localStorage.setItem('evolved_prototype_requests',JSON.stringify(existing));
    status.textContent='Prototype saved locally — ClickUp turns on next.';
  }
});

loadDashboard().catch(err=>{
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin',`<div class="loading-banner">Dashboard data could not be loaded: ${escapeHtml(err.message)}</div>`);
});
