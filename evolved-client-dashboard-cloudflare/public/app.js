const $ = (id) => document.getElementById(id);
let dashboard = null;

const fmtMoney = (n, compact=false) =>
  new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0,notation:compact?'compact':'standard'}).format(Number(n||0));
const fmtPct = (n, digits=1) => `${(Number(n||0)*100).toFixed(digits)}%`;
const fmtNum = n => new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Number(n||0));
const fmtRoas = n => `${Number(n||0).toFixed(2)}x`;

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
  const through = d.data_through?.sales
    ? `Data through ${new Date(d.data_through.sales+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`
    : '';
  $('updated-label').textContent = d.__seed ? `${through} · Prototype data` : through;

  $('snapshot-title').textContent = `${d.period_label || 'Current'} performance snapshot`;
  $('snapshot-detail').textContent = neutralSummary(d);
  renderComparisons(d);

  $('kpi-sales').textContent = fmtMoney(d.kpis?.total_sales);
  $('kpi-ad-sales').textContent = fmtMoney(d.kpis?.ad_sales);
  $('kpi-ad-spend').textContent = fmtMoney(d.kpis?.ad_spend);
  $('kpi-roas').textContent = fmtRoas(d.kpis?.roas);
  $('kpi-tacos').textContent = fmtPct(d.kpis?.tacos);
  $('sales-goal').textContent = d.goals?.monthly_sales?.target
    ? `Projected ${fmtMoney(d.kpis?.projected_sales)} · Goal ${fmtMoney(d.goals.monthly_sales.target)}`
    : 'Month to date';
  $('roas-target').textContent = d.goals?.roas?.target ? `Target ${fmtRoas(d.goals.roas.target)}` : '';
  $('tacos-target').textContent = d.goals?.tacos?.target ? `Target ${fmtPct(d.goals.tacos.target)}` : '';
  $('tacos-chart-target').textContent = d.goals?.tacos?.target ? `Reference target ${fmtPct(d.goals.tacos.target)}` : '';

  renderSignals(d);

  $('product-table').innerHTML = (d.top_products||[]).map(p => {
    const trend = Number(p.sales_change||0);
    const sign = trend > 0 ? '+' : '';
    return `<tr>
      <td><span class="product-name">${escapeHtml(prettyName(p.product))}</span><span class="asin">${escapeHtml(p.asin||'')}</span></td>
      <td>${fmtMoney(p.sales)}</td>
      <td class="change">${sign}${(trend*100).toFixed(1)}%</td>
      <td>${fmtPct(p.conversion_rate)}</td>
    </tr>`;
  }).join('');

  const inv = d.inventory || {};
  $('inventory-count').textContent = `${fmtNum(inv.risk_products)} flagged`;
  $('out-of-stock').textContent = fmtNum(inv.out_of_stock);
  $('order-now').textContent = fmtNum(inv.order_now);
  $('inventory-list').innerHTML = (inv.critical_products||[]).slice(0,5).map(x =>
    `<div class="inventory-row"><div><strong>${escapeHtml(prettyName(x.product))}</strong><span>${escapeHtml(x.asin||'')}</span></div><b>${fmtNum(x.recommended_units)} units</b></div>`
  ).join('');

  drawSalesChart(d);
  drawTacosChart(d);
  $('request-client-slug').value = d.client?.slug || 'anchorstrap';
}

function neutralSummary(d){
  const k = d.kpis || {};
  const g = d.goals || {};
  const bits = [];
  bits.push(`Month-to-date sales are ${fmtMoney(k.total_sales)} with ${fmtMoney(k.projected_sales)} projected for the month.`);
  if(g.monthly_sales?.target) bits.push(`The current monthly sales target is ${fmtMoney(g.monthly_sales.target)}.`);
  bits.push(`Advertising has generated ${fmtMoney(k.ad_sales)} in attributed sales on ${fmtMoney(k.ad_spend)} in spend, with ${fmtRoas(k.roas)} ROAS and ${fmtPct(k.tacos)} TACOS.`);
  if(k.conversion_rate !== undefined) bits.push(`Conversion is ${fmtPct(k.conversion_rate)} across ${fmtNum(k.sessions)} sessions.`);
  return bits.join(' ');
}

function renderComparisons(d){
  const k=d.kpis||{}, g=d.goals||{}, inv=d.inventory||{};
  const salesTarget=Number(g.monthly_sales?.target||0);
  const projected=Number(k.projected_sales||0);
  const attainment=salesTarget ? projected/salesTarget : null;
  const items=[
    ['Projected sales', fmtMoney(projected), salesTarget ? `${fmtPct(attainment,0)} of ${fmtMoney(salesTarget)} target` : 'Current projection'],
    ['ROAS', fmtRoas(k.roas), g.roas?.target ? `Target ${fmtRoas(g.roas.target)}` : 'Current month'],
    ['Conversion', fmtPct(k.conversion_rate), g.conversion_rate?.target ? `Target ${fmtPct(g.conversion_rate.target)}` : 'Current month'],
    ['Inventory', `${fmtNum(inv.risk_products)} flagged`, `${fmtNum(inv.out_of_stock)} out of stock`]
  ];
  $('comparison-grid').innerHTML=items.map(([label,value,note]) =>
    `<div class="comparison-item"><span>${label}</span><strong>${value}</strong><small>${note}</small></div>`
  ).join('');
}

function renderSignals(d){
  const k=d.kpis||{}, g=d.goals||{}, inv=d.inventory||{};
  renderSignalList('sales-signals',[
    ['Month-to-date sales',fmtMoney(k.total_sales)],
    ['Projected month sales',fmtMoney(k.projected_sales)],
    ['Sessions',fmtNum(k.sessions)],
    ['Conversion rate',fmtPct(k.conversion_rate)]
  ]);
  renderSignalList('ad-signals',[
    ['Attributed ad sales',fmtMoney(k.ad_sales)],
    ['Ad spend',fmtMoney(k.ad_spend)],
    ['ROAS',fmtRoas(k.roas)],
    ['TACOS',fmtPct(k.tacos)]
  ]);
  renderSignalList('ops-signals',[
    ['Inventory flags',fmtNum(inv.risk_products)],
    ['Out of stock',fmtNum(inv.out_of_stock)],
    ['Reorder flags',fmtNum(inv.order_now)],
    ['Data age',`${fmtNum(d.health?.data_age_days||0)} days`]
  ]);
}

function renderSignalList(id, rows){
  $(id).innerHTML=rows.map(([label,value]) =>
    `<div class="signal-row"><span>${label}</span><strong>${value}</strong></div>`
  ).join('');
}

function prettyName(v=''){
  let s = String(v).replace('Anchor Strap Co | ','').replaceAll(' | ',' · ');
  if(s.length > 72) s = s.slice(0,69).trim()+'…';
  return s;
}
function escapeHtml(s=''){
  return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function drawSalesChart(d){
  const points = [...(d.monthly_trend||[])].map(x=>({label:x.month.slice(0,3),value:x.total_sales}));
  points.push({label:'Aug*',value:d.kpis?.projected_sales||0});
  drawLine('sales-chart', points, {value:v=>fmtMoney(v,true), stroke:'#2d5fd2', fill:'#edf3ff'});
}

function drawTacosChart(d){
  const points = [...(d.monthly_trend||[])].map(x=>({label:x.month.slice(0,3),value:x.tacos}));
  points.push({label:'Aug',value:d.kpis?.tacos||0});
  drawLine('tacos-chart', points, {value:v=>fmtPct(v,0), stroke:'#596b94', fill:'#f1f3f8', target:d.goals?.tacos?.target});
}

function drawLine(id, points, opts){
  const el=$(id), w=720,h=220,pad={l:48,r:18,t:20,b:34};
  if(!points.length){el.innerHTML='';return}
  const vals=points.map(p=>Number(p.value||0));
  let min=Math.min(...vals,opts.target??Infinity),max=Math.max(...vals,opts.target??-Infinity);
  if(min===max){min*=.8;max*=1.2}
  const spread=max-min; min=Math.max(0,min-spread*.18); max=max+spread*.18;
  const x=i=>pad.l+(i*(w-pad.l-pad.r)/Math.max(1,points.length-1));
  const y=v=>pad.t+(max-v)*(h-pad.t-pad.b)/(max-min);
  const coords=points.map((p,i)=>[x(i),y(p.value)]);
  const line=coords.map((c,i)=>(i?'L':'M')+c[0].toFixed(1)+','+c[1].toFixed(1)).join(' ');
  const area=`M${coords[0][0]},${h-pad.b} `+coords.map(c=>`L${c[0]},${c[1]}`).join(' ')+` L${coords.at(-1)[0]},${h-pad.b} Z`;
  const grid=[0,.5,1].map(t=>{
    const val=max-(max-min)*t,yy=pad.t+(h-pad.t-pad.b)*t;
    return `<line x1="${pad.l}" y1="${yy}" x2="${w-pad.r}" y2="${yy}" stroke="#edf0f5"/><text x="4" y="${yy+4}" class="axis-label">${opts.value(val)}</text>`;
  }).join('');
  const labels=points.map((p,i)=>`<text x="${x(i)}" y="${h-10}" text-anchor="middle" class="axis-label">${p.label}</text>`).join('');
  const dots=coords.map((c,i)=>`<circle cx="${c[0]}" cy="${c[1]}" r="3.3" fill="#fff" stroke="${opts.stroke}" stroke-width="2"/><text x="${c[0]}" y="${c[1]-10}" text-anchor="middle" class="chart-value">${opts.value(points[i].value)}</text>`).join('');
  let target='';
  if(opts.target !== undefined && opts.target !== null){
    const ty=y(opts.target);
    target=`<line x1="${pad.l}" y1="${ty}" x2="${w-pad.r}" y2="${ty}" stroke="#b18a50" stroke-width="1.2" stroke-dasharray="5 5"/>`;
  }
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${grid}${target}<path d="${area}" fill="${opts.fill}" opacity=".72"/><path d="${line}" fill="none" stroke="${opts.stroke}" stroke-width="2.3" vector-effect="non-scaling-stroke"/>${dots}${labels}</svg>`;
}

const dialog=$('request-dialog');
$('request-work-btn').addEventListener('click',()=>dialog.showModal());
$('close-dialog').addEventListener('click',()=>dialog.close());
$('request-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const status=$('request-status'), form=e.currentTarget;
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
    existing.push(local);
    localStorage.setItem('evolved_prototype_requests',JSON.stringify(existing));
    status.textContent='Prototype saved locally — ClickUp turns on next.';
  }
});

loadDashboard().catch(err=>{
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin',`<div style="margin:12px;padding:10px;border:1px solid #e6d8bd;background:#fffaf0;border-radius:10px;font:12px system-ui;color:#7b5d24">Dashboard data could not be loaded: ${escapeHtml(err.message)}</div>`);
});
