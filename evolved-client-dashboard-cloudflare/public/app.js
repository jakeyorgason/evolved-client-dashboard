const $=id=>document.getElementById(id); let dashboard=null; let performanceWindow='6M'; let trafficWindow='3M';
const fmtMoney=(n,compact=false)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0,notation:compact?'compact':'standard'}).format(Number(n||0));
const fmtPct=(n,d=1)=>`${(Number(n||0)*100).toFixed(d)}%`;
const fmtNum=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Number(n||0));
const fmtRoas=n=>`${Number(n||0).toFixed(2)}x`;
function slugFromHost(){const h=location.hostname.toLowerCase(),p=h.split('.');if(h.endsWith('.evolvedcommerce.com')&&p.length>2)return p[0];return new URLSearchParams(location.search).get('client')||'anchorstrap'}
async function loadDashboard(){const slug=slugFromHost();let data=null;try{const r=await fetch(`/api/dashboard?slug=${encodeURIComponent(slug)}`);if(r.ok)data=await r.json()}catch(e){}if(!data){const r=await fetch(`/data/${slug}.json`);if(!r.ok)throw new Error(`No dashboard data found for ${slug}`);data=await r.json();data.__seed=true}dashboard=data;render(data)}
function render(d){
  $('client-name').textContent=d.client?.name||'Client Dashboard';
  const strategyLink=$('strategy-doc-link');
  if(d.client?.strategy_doc_url){strategyLink.href=d.client.strategy_doc_url;strategyLink.hidden=false}else{strategyLink.hidden=true}
  $('period-label').textContent=d.period_label||'';
  const through=d.data_through?.sales?new Date(d.data_through.sales+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
  $('updated-label').textContent=(through?`Data through ${through}`:'')+(d.__seed?' · Prototype data':'');
  $('hero-summary').textContent=neutralSummary(d);

  const k=d.kpis||{},g=d.goals||{},inv=d.inventory||{};
  $('kpi-sales').textContent=fmtMoney(k.total_sales);$('kpi-ad-sales').textContent=fmtMoney(k.ad_sales);$('kpi-ad-spend').textContent=fmtMoney(k.ad_spend);$('kpi-roas').textContent=fmtRoas(k.roas);$('kpi-tacos').textContent=fmtPct(k.tacos);
  $('sales-goal').textContent=g.monthly_sales?.target?`Projected ${fmtMoney(k.projected_sales)} · Target ${fmtMoney(g.monthly_sales.target)}`:'Month to date';
  $('roas-target').textContent=g.roas?.target?`Target ${fmtRoas(g.roas.target)}`:'';
  $('tacos-target').textContent=g.tacos?.target?`Target ${fmtPct(g.tacos.target)}`:'';

  $('strip-projected').textContent=fmtMoney(k.projected_sales);
  $('strip-projected-note').textContent=g.monthly_sales?.target?`${fmtPct(k.projected_sales/g.monthly_sales.target,0)} of target`:'Current projection';
  $('strip-sessions').textContent=fmtNum(k.sessions);
  $('strip-sessions-note').textContent=g.monthly_sessions?.target?`Target ${fmtNum(g.monthly_sessions.target)}`:'Month to date';
  $('strip-conversion').textContent=fmtPct(k.conversion_rate);
  $('strip-conversion-note').textContent=g.conversion_rate?.target?`Target ${fmtPct(g.conversion_rate.target)}`:'Current month';
  $('strip-inventory').textContent=`${fmtNum(inv.risk_products)} flagged`;
  $('strip-inventory-note').textContent=`${fmtNum(inv.out_of_stock)} out of stock`;

  renderPerformanceCharts(d);
  renderTrafficConversion(d);
  renderInventory(d);
  renderProducts(d);
  $('request-client-slug').value=d.client?.slug||'anchorstrap';
}
function neutralSummary(d){const k=d.kpis||{};return `${fmtMoney(k.total_sales)} in month-to-date sales across ${fmtNum(k.sessions)} sessions, with ${fmtMoney(k.ad_sales)} in Amazon-attributed ad sales.`}

function dataThroughDate(d){
  const raw=d?.data_through?.sales||d?.data_through?.traffic||'';
  if(raw){
    const parsed=new Date(`${String(raw).slice(0,10)}T12:00:00Z`);
    if(!Number.isNaN(parsed.getTime()))return parsed;
  }
  return new Date();
}
const MONTH_INDEX={january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
function completedMonths(d){
  return [...(d.monthly_trend||[])].map(x=>{
    const monthName=String(x.month||'').trim();
    return {...x,_date:new Date(Date.UTC(Number(x.year||0),MONTH_INDEX[monthName.toLowerCase()]??0,1))};
  }).filter(x=>Number.isFinite(x._date.getTime())).sort((a,b)=>a._date-b._date);
}
function currentMonthLabel(d,suffix=''){
  return dataThroughDate(d).toLocaleDateString('en-US',{month:'short',timeZone:'UTC'})+suffix;
}
function performancePoints(d,metric){
  const k=d.kpis||{},months=completedMonths(d),current=dataThroughDate(d);
  if(performanceWindow==='MTD'){
    if(metric==='sales'){
      return [
        {label:'MTD',value:Number(k.total_sales||0)},
        {label:'Projected',value:Number(k.projected_sales||k.total_sales||0)}
      ];
    }
    return [{label:'MTD',value:Number(k.tacos||0)}];
  }

  const currentPoint={
    year:current.getUTCFullYear(),
    month:current.toLocaleDateString('en-US',{month:'long',timeZone:'UTC'}),
    _date:new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth(),1)),
    total_sales:Number(k.projected_sales||k.total_sales||0),
    tacos:Number(k.tacos||0),
    _current:true
  };
  let rows=[...months,currentPoint];

  if(performanceWindow==='YTD'){
    rows=rows.filter(x=>x._date.getUTCFullYear()===current.getUTCFullYear());
  }else{
    const count=performanceWindow==='3M'?3:6;
    rows=rows.slice(-count);
  }
  return rows.map(x=>({
    label:(x._current?currentMonthLabel(d,'*'):String(x.month||'').slice(0,3)),
    value:Number(metric==='sales'?x.total_sales:x.tacos||0)
  }));
}
function renderPerformanceCharts(d){
  const target=d.goals?.tacos?.target;
  const salesNote=$('sales-chart')?.closest('.performance-panel')?.querySelector('.panel-note');
  if(salesNote){
    salesNote.textContent=performanceWindow==='MTD'?'Current month + projection':'Completed months + current projection';
  }
  $('tacos-chart-target').textContent=target
    ? (performanceWindow==='MTD'?`Current month · target ${fmtPct(target)}`:`Reference target ${fmtPct(target)}`)
    : 'Current monthly trend';
  drawSalesPerformance('sales-chart',performancePoints(d,'sales'));
  drawTacosPerformance('tacos-chart',performancePoints(d,'tacos'),Number(target||0));
}
function drawSalesPerformance(id,points){
  const el=$(id);
  if(!points.length){el.innerHTML='<div class="chart-window-empty">No sales history is available for this lookback window.</div>';return}
  const w=Math.max(600,Math.round(el.getBoundingClientRect().width||720));
  const h=Math.max(280,Math.round(el.getBoundingClientRect().height||300));
  const p={l:56,r:22,t:30,b:38};
  const vals=points.map(x=>x.value);
  let min=Math.min(...vals),max=Math.max(...vals);
  const spread=Math.max(1,max-min);
  min=Math.max(0,min-spread*.22);
  max=max+spread*.22;
  if(max===min)max=min+1;

  const X=i=>points.length===1?(p.l+w-p.r)/2:p.l+i*(w-p.l-p.r)/(points.length-1);
  const Y=v=>p.t+(max-v)*(h-p.t-p.b)/(max-min);
  const c=points.map((x,i)=>[X(i),Y(x.value)]);
  const line=c.map((a,i)=>(i?'L':'M')+a[0].toFixed(1)+','+a[1].toFixed(1)).join(' ');
  const area=points.length>1?`M${c[0][0]},${h-p.b} `+c.map(a=>`L${a[0]},${a[1]}`).join(' ')+` L${c.at(-1)[0]},${h-p.b} Z`:'';

  const grid=[0,.5,1].map(t=>{
    const value=max-(max-min)*t,y=p.t+(h-p.t-p.b)*t;
    return `<line x1="${p.l}" y1="${y}" x2="${w-p.r}" y2="${y}" stroke="rgba(255,255,255,.12)"/>
      <text x="${p.l-10}" y="${y+4}" text-anchor="end" class="light-axis">${fmtMoney(value,true)}</text>`;
  }).join('');
  const labels=points.map((x,i)=>`<text x="${X(i)}" y="${h-11}" text-anchor="middle" class="light-axis">${escapeHtml(x.label)}</text>`).join('');
  const dots=c.map((a,i)=>`<circle cx="${a[0]}" cy="${a[1]}" r="4.3" fill="#fff" stroke="#F47322" stroke-width="2.4"><title>${escapeHtml(points[i].label)}: ${fmtMoney(points[i].value)}</title></circle>
    <text x="${a[0]}" y="${Math.max(16,a[1]-13)}" text-anchor="middle" class="light-value">${fmtMoney(points[i].value,true)}</text>`).join('');

  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}">
    <defs>
      <linearGradient id="salesLightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F47322" stop-opacity=".34"/><stop offset="100%" stop-color="#F47322" stop-opacity=".035"/></linearGradient>
      <filter id="salesLightGlow"><feGaussianBlur stdDeviation="3.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    ${grid}${area?`<path d="${area}" fill="url(#salesLightFill)"/>`:''}
    ${points.length>1?`<path d="${line}" fill="none" stroke="#FF7A1A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#salesLightGlow)"/>`:''}
    ${dots}${labels}
  </svg>`;
}
function drawTacosPerformance(id,points,target){
  const el=$(id);
  if(!points.length){el.innerHTML='<div class="chart-window-empty">No advertising efficiency history is available for this lookback window.</div>';return}
  const w=Math.max(520,Math.round(el.getBoundingClientRect().width||620));
  const h=Math.max(280,Math.round(el.getBoundingClientRect().height||300));
  const p={l:54,r:28,t:30,b:38};
  const vals=points.map(x=>x.value);
  const rawMax=Math.max(...vals,target||0);
  const step=.20;
  const yMax=Math.max(.60,Math.ceil(rawMax/step)*step);
  const X=i=>points.length===1?(p.l+w-p.r)/2:p.l+i*(w-p.l-p.r)/(points.length-1);
  const Y=v=>p.t+(yMax-v)*(h-p.t-p.b)/yMax;
  const c=points.map((x,i)=>[X(i),Y(x.value)]);
  const line=c.map((a,i)=>(i?'L':'M')+a[0].toFixed(1)+','+a[1].toFixed(1)).join(' ');
  const area=points.length>1?`M${c[0][0]},${h-p.b} `+c.map(a=>`L${a[0]},${a[1]}`).join(' ')+` L${c.at(-1)[0]},${h-p.b} Z`:'';

  const ticks=[];for(let v=0;v<=yMax+.0001;v+=step)ticks.push(Number(v.toFixed(4)));
  const grid=ticks.map(v=>{const y=Y(v);return `<line x1="${p.l}" y1="${y}" x2="${w-p.r}" y2="${y}" stroke="rgba(255,255,255,.12)"/><text x="${p.l-10}" y="${y+4}" text-anchor="end" class="light-axis">${Math.round(v*100)}%</text>`}).join('');
  const labels=points.map((x,i)=>`<text x="${X(i)}" y="${h-11}" text-anchor="middle" class="light-axis">${escapeHtml(x.label)}</text>`).join('');
  const dots=c.map((a,i)=>`<circle cx="${a[0]}" cy="${a[1]}" r="4.3" fill="#fff" stroke="#4E79FF" stroke-width="2.4"><title>${escapeHtml(points[i].label)}: ${fmtPct(points[i].value)}</title></circle><text x="${a[0]}" y="${Math.max(16,a[1]-13)}" text-anchor="middle" class="light-value">${Math.round(points[i].value*100)}%</text>`).join('');

  let targetLine='';if(target>0){const y=Y(target);targetLine=`<line x1="${p.l}" y1="${y}" x2="${w-p.r}" y2="${y}" stroke="#F47322" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${w-p.r}" y="${y-8}" text-anchor="end" class="light-target">${Math.round(target*100)}% target</text>`}
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}">
    <defs><linearGradient id="tacosLightFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4E79FF" stop-opacity=".28"/><stop offset="100%" stop-color="#4E79FF" stop-opacity=".03"/></linearGradient><filter id="tacosGlow"><feGaussianBlur stdDeviation="3.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    ${grid}${targetLine}${area?`<path d="${area}" fill="url(#tacosLightFill)"/>`:''}
    ${points.length>1?`<path d="${line}" fill="none" stroke="#4E79FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#tacosGlow)"/>`:''}
    ${dots}${labels}
  </svg>`;
}

function getTC(d){
  const tc=d.traffic_conversion||{};
  let weeks=tc.weekly_trend||tc.weekly||[];
  if(!weeks.length&&d.weekly_trend)weeks=d.weekly_trend;
  const mapped=weeks.map((w,i)=>({
    week_start:w.week_start||w.date||'',
    label:w.label||w.week||w.period||`W${i+1}`,
    sessions:Number(w.sessions??w.traffic??0),
    conversion:Number(w.conversion_rate??w.conversion??0),
    orders:Number(w.orders||0),
    units:Number(w.units||0),
    total_sales:Number(w.total_sales||0)
  })).filter(x=>x.sessions||x.conversion).sort((a,b)=>String(a.week_start).localeCompare(String(b.week_start)));
  return {tc,weeks:mapped};
}
function trafficWeeksForWindow(d,weeks){
  if(!weeks.length)return [];
  const end=dataThroughDate(d);
  let filtered=[];
  if(trafficWindow==='MTD'){
    filtered=weeks.filter(w=>{
      const dt=new Date(`${w.week_start}T12:00:00Z`);
      return !Number.isNaN(dt.getTime())&&dt.getUTCFullYear()===end.getUTCFullYear()&&dt.getUTCMonth()===end.getUTCMonth();
    });
  }else if(trafficWindow==='YTD'){
    filtered=weeks.filter(w=>{
      const dt=new Date(`${w.week_start}T12:00:00Z`);
      return !Number.isNaN(dt.getTime())&&dt.getUTCFullYear()===end.getUTCFullYear();
    });
  }else{
    const months=trafficWindow==='3M'?3:6;
    const start=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-(months-1),1));
    filtered=weeks.filter(w=>{
      const dt=new Date(`${w.week_start}T12:00:00Z`);
      return !Number.isNaN(dt.getTime())&&dt>=start&&dt<=end;
    });
  }
  return filtered.length?filtered:weeks.slice(-8);
}
function renderTrafficConversion(d){
  const k=d.kpis||{},g=d.goals||{},tcx=getTC(d),tc=tcx.tc,allWeeks=tcx.weeks,weeks=trafficWeeksForWindow(d,allWeeks);
  $('traffic-current').textContent=fmtNum(k.sessions);
  $('traffic-projected').textContent=fmtNum(tc.projected_sessions||k.projected_sessions||k.sessions);
  $('traffic-target').textContent=g.monthly_sessions?.target?fmtNum(g.monthly_sessions.target):'—';
  $('traffic-latest').textContent=allWeeks.length?fmtNum(allWeeks.at(-1).sessions):'—';
  $('conversion-current').textContent=fmtPct(k.conversion_rate);
  $('conversion-orders').textContent=fmtNum(tc.orders||k.orders||0);
  $('conversion-units').textContent=fmtNum(tc.units||k.units||0);
  $('conversion-target').textContent=g.conversion_rate?.target?fmtPct(g.conversion_rate.target):'—';
  drawPremiumTraffic('traffic-chart',weeks);
  drawPremiumConversion('conversion-chart',weeks,Number(g.conversion_rate?.target||0));
}
function chartLabelStep(count){return Math.max(1,Math.ceil(count/8))}
function drawPremiumTraffic(id,weeks){
  const el=$(id);if(!weeks.length){el.innerHTML='<div class="chart-window-empty">No traffic history is available for this lookback window.</div>';return}
  const w=Math.max(520,Math.round(el.getBoundingClientRect().width||600)),h=Math.max(250,Math.round(el.getBoundingClientRect().height||260)),p={l:50,r:18,t:24,b:34};
  const vals=weeks.map(x=>x.sessions),max=Math.max(...vals)*1.18,min=0,step=chartLabelStep(weeks.length);
  const X=i=>weeks.length===1?(p.l+w-p.r)/2:p.l+i*(w-p.l-p.r)/(weeks.length-1),Y=v=>p.t+(max-v)*(h-p.t-p.b)/(max-min||1);
  const c=weeks.map((x,i)=>[X(i),Y(x.sessions)]);
  const line=c.map((a,i)=>(i?'L':'M')+a[0].toFixed(1)+','+a[1].toFixed(1)).join(' ');
  const area=weeks.length>1?`M${c[0][0]},${h-p.b} `+c.map(a=>`L${a[0]},${a[1]}`).join(' ')+` L${c.at(-1)[0]},${h-p.b} Z`:'';
  const grid=[0,.5,1].map(t=>{const v=max*(1-t),y=p.t+(h-p.t-p.b)*t;return `<line x1="${p.l}" y1="${y}" x2="${w-p.r}" y2="${y}" stroke="rgba(255,255,255,.12)"/><text x="${p.l-10}" y="${y+4}" text-anchor="end" class="dark-axis">${fmtNum(v)}</text>`}).join('');
  const labels=weeks.map((x,i)=>(i%step===0||i===weeks.length-1)?`<text x="${X(i)}" y="${h-10}" text-anchor="middle" class="dark-axis">${escapeHtml(shortLabel(x.label))}</text>`:'').join('');
  const dots=c.map((a,i)=>{const show=i%step===0||i===weeks.length-1;return `<circle cx="${a[0]}" cy="${a[1]}" r="${weeks.length>18?3.2:4.3}" fill="#fff" stroke="#F47322" stroke-width="2.3"><title>${escapeHtml(weeks[i].label)}: ${fmtNum(weeks[i].sessions)} sessions</title></circle>${show?`<text x="${a[0]}" y="${Math.max(16,a[1]-12)}" text-anchor="middle" class="dark-value">${fmtNum(weeks[i].sessions)}</text>`:''}`}).join('');
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}"><defs><linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#F47322" stop-opacity=".38"/><stop offset="100%" stop-color="#F47322" stop-opacity="0"/></linearGradient><filter id="trafficGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><style>.dark-axis{fill:#B8C5CB;font:300 10px Montserrat}.dark-value{fill:#fff;font:600 10px Montserrat;paint-order:stroke;stroke:#102333;stroke-width:3px}</style>${grid}${area?`<path d="${area}" fill="url(#trafficFill)"/>`:''}${weeks.length>1?`<path d="${line}" fill="none" stroke="#F47322" stroke-width="3" filter="url(#trafficGlow)" stroke-linecap="round" stroke-linejoin="round"/>`:''}${dots}${labels}</svg>`
}
function drawPremiumConversion(id,weeks,target){
  const el=$(id);if(!weeks.length){el.innerHTML='<div class="chart-window-empty">No conversion history is available for this lookback window.</div>';return}
  const w=Math.max(520,Math.round(el.getBoundingClientRect().width||600)),h=Math.max(250,Math.round(el.getBoundingClientRect().height||260)),p={l:50,r:18,t:24,b:34};
  const vals=weeks.map(x=>x.conversion),max=Math.max(.06,Math.max(...vals,target||0)*1.18),min=0,step=chartLabelStep(weeks.length);
  const X=i=>weeks.length===1?(p.l+w-p.r)/2:p.l+i*(w-p.l-p.r)/(weeks.length-1),Y=v=>p.t+(max-v)*(h-p.t-p.b)/(max-min||1);
  const c=weeks.map((x,i)=>[X(i),Y(x.conversion)]);
  const line=c.map((a,i)=>(i?'L':'M')+a[0].toFixed(1)+','+a[1].toFixed(1)).join(' ');
  const area=weeks.length>1?`M${c[0][0]},${h-p.b} `+c.map(a=>`L${a[0]},${a[1]}`).join(' ')+` L${c.at(-1)[0]},${h-p.b} Z`:'';
  const ticks=[0,.02,.04,.06].filter(v=>v<=max+.001);
  const grid=ticks.map(v=>{const y=Y(v);return `<line x1="${p.l}" y1="${y}" x2="${w-p.r}" y2="${y}" stroke="rgba(255,255,255,.12)"/><text x="${p.l-10}" y="${y+4}" text-anchor="end" class="dark-axis">${Math.round(v*100)}%</text>`}).join('');
  const labels=weeks.map((x,i)=>(i%step===0||i===weeks.length-1)?`<text x="${X(i)}" y="${h-10}" text-anchor="middle" class="dark-axis">${escapeHtml(shortLabel(x.label))}</text>`:'').join('');
  const dots=c.map((a,i)=>{const show=i%step===0||i===weeks.length-1;return `<circle cx="${a[0]}" cy="${a[1]}" r="${weeks.length>18?3.2:4.3}" fill="#fff" stroke="#4B7CF3" stroke-width="2.3"><title>${escapeHtml(weeks[i].label)}: ${fmtPct(weeks[i].conversion)}</title></circle>${show?`<text x="${a[0]}" y="${Math.max(16,a[1]-12)}" text-anchor="middle" class="dark-value">${fmtPct(weeks[i].conversion)}</text>`:''}`}).join('');
  let targetLine='';if(target>0){const y=Y(target);targetLine=`<line x1="${p.l}" y1="${y}" x2="${w-p.r}" y2="${y}" stroke="#F47322" stroke-width="1.4" stroke-dasharray="5 5"/><text x="${w-p.r}" y="${y-7}" text-anchor="end" class="target-label">Target ${fmtPct(target)}</text>`}
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}"><defs><linearGradient id="convFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4B7CF3" stop-opacity=".42"/><stop offset="100%" stop-color="#4B7CF3" stop-opacity="0"/></linearGradient><filter id="convGlow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><style>.dark-axis{fill:#B8C5CB;font:300 10px Montserrat}.dark-value{fill:#fff;font:600 10px Montserrat;paint-order:stroke;stroke:#102333;stroke-width:3px}.target-label{fill:#FF8A3D;font:600 9px Montserrat}</style>${grid}${targetLine}${area?`<path d="${area}" fill="url(#convFill)"/>`:''}${weeks.length>1?`<path d="${line}" fill="none" stroke="#4B7CF3" stroke-width="3" filter="url(#convGlow)" stroke-linecap="round" stroke-linejoin="round"/>`:''}${dots}${labels}</svg>`
}
function shortLabel(v=''){const s=String(v);return s.length>10?s.slice(0,10):s}

function renderInventory(d){
  const inv=d.inventory||{},items=getReplenishmentItems(inv),units=items.reduce((s,x)=>s+Number(x.recommended_units||0),0);
  $('inventory-total').textContent=fmtNum(inv.risk_products||items.length);
  $('legend-oos').textContent=fmtNum(inv.out_of_stock);
  $('legend-order').textContent=fmtNum(inv.order_now);
  $('legend-units').textContent=fmtNum(units);

  const total=Math.max(1,Number(inv.risk_products||items.length||1)),oos=Number(inv.out_of_stock||0),ord=Number(inv.order_now||0),rest=Math.max(0,total-oos-ord);
  const oosPct=oos/total*100,ordPct=ord/total*100;
  $('inventory-donut').style.background=`conic-gradient(#F47322 0 ${oosPct}%,#FDBA31 ${oosPct}% ${oosPct+ordPct}%,#415A68 ${oosPct+ordPct}% 100%)`;

  $('refill-table').innerHTML=items.slice(0,5).map(x=>`<tr>
    <td><strong>${escapeHtml(x.sku||'—')}</strong><span class="asin">${escapeHtml(x.asin||'')}</span></td>
    <td>${escapeHtml(prettyName(x.product))}</td>
    <td><span class="status-pill ${String(x.status).includes('ORDER')?'order':''}">${escapeHtml(x.status||'')}</span></td>
    <td>${fmtNum(x.recommended_units)}</td>
  </tr>`).join('');
}
function getReplenishmentItems(inv){if(Array.isArray(inv.replenishment_items))return inv.replenishment_items;return (inv.critical_products||[]).map(x=>({...x,sku:'',fnsku:'',available:'',inbound_working:'',inbound_shipped:''}))}
function renderProducts(d){$('product-table').innerHTML=(d.top_products||[]).map(p=>{const t=Number(p.sales_change||0),sign=t>0?'+':'';return `<tr><td><span class="product-name">${escapeHtml(prettyName(p.product))}</span><span class="asin">${escapeHtml(p.asin||'')}</span></td><td>${fmtMoney(p.sales)}</td><td class="change">${sign}${(t*100).toFixed(1)}%</td><td>${fmtPct(p.conversion_rate)}</td></tr>`}).join('')}
function downloadInventoryCsv(){if(!dashboard)return;const items=getReplenishmentItems(dashboard.inventory||{});if(!items.length){alert('No replenishment recommendations are available in the current dashboard data.');return}const headers=['Status','Recommended Qty','ASIN','Merchant SKU','FNSKU','Product Name','Available','Inbound - Working','Inbound - Shipped','Units 30D','Sales 30D'];const rows=items.map(x=>[x.status,x.recommended_units,x.asin,x.sku,x.fnsku,x.product,x.available,x.inbound_working,x.inbound_shipped,x.units_30d,x.sales_30d]);const csv=[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);const date=(dashboard.data_through?.sales||new Date().toISOString().slice(0,10)).slice(0,10);a.download=`${dashboard.client?.slug||'client'}-inventory-replenishment-${date}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function csvCell(v){const s=String(v??'');return `"${s.replaceAll('"','""')}"`}
function prettyName(v=''){let s=String(v).replace('Anchor Strap Co | ','').replaceAll(' | ',' · ');if(s.length>72)s=s.slice(0,69).trim()+'…';return s}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

/* Request center logic retained */
const dialog=$('request-dialog'),requestForm=$('request-form'),requestCore=$('request-core-fields'),requestPlatform=$('request-platform'),requestSpecific=$('request-specific-fields');let selectedRequestType='';
const PLATFORM_HELP={'Amazon':'Amazon requirements vary by Product Type. We collect the core data here, then validate category-specific attributes against the current Amazon product-type requirements before upload.','Walmart':'Walmart requirements vary by Product Type and fulfillment method. We collect the core item/offer data here, then validate the item against Walmart’s current product-type spec.','TikTok Shop':'TikTok Shop listings require complete PDP content and may require category-specific attributes, approvals, warnings, or certifications.','Target Plus':'Target Plus is curated and item requirements vary by approved assortment/category. We collect the common item data here plus Target-specific compliance and content inputs.'};
const PRODUCT_TEMPLATES={'Amazon':['seller_sku','product_type','brand','product_name','gtin_upc_ean','price','inventory_qty','variation_theme','parent_sku','color','size','material','country_of_origin','package_length','package_width','package_height','package_weight','main_image_url','additional_image_urls','title_copy','bullet_1','bullet_2','bullet_3','bullet_4','bullet_5','description','backend_search_terms','compliance_notes'],'Walmart':['seller_sku','product_type','gtin_upc_ean','brand','product_name','short_description','key_feature_1','key_feature_2','price','inventory_qty','country_of_origin','package_length','package_width','package_height','package_weight','main_image_url','additional_image_urls','variant_group_id','color','size','condition','compliance_notes'],'TikTok Shop':['seller_sku','category','brand','product_name','description','price','inventory_qty','variation_1_name','variation_1_value','main_image_url','additional_image_urls','video_url','package_length','package_width','package_height','package_weight','material','country_of_origin','compliance_notes'],'Target Plus':['seller_sku','target_item_type','gs1_upc_gtin','brand','product_title','description','bullet_feature_1','bullet_feature_2','price','inventory_qty','color','size','material','country_of_origin','package_length','package_width','package_height','package_weight','main_image_url','additional_image_urls','compliance_notes']};
function field(name,label,type='text',opts={}){const req=opts.required?' required':'',ph=opts.placeholder?` placeholder="${escapeHtml(opts.placeholder)}"`:'',help=opts.help?`<div class="request-help">${escapeHtml(opts.help)}</div>`:'',tag=opts.required?'<span class="required-tag">REQUIRED</span>':'';if(type==='textarea')return `<div class="field"><label>${label}${tag}</label><textarea name="${name}" rows="${opts.rows||3}"${req}${ph}></textarea>${help}</div>`;if(type==='select'){const options=(opts.options||[]).map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');return `<div class="field"><label>${label}${tag}</label><select name="${name}"${req}><option value="">Choose...</option>${options}</select>${help}</div>`}return `<div class="field"><label>${label}${tag}</label><input name="${name}" type="${type}"${req}${ph}>${help}</div>`}
function checkbox(name,label,value='Yes'){return `<label class="check-option"><input type="checkbox" name="${name}" value="${escapeHtml(value)}"><span>${label}</span></label>`}
function renderRequestFields(){if(!selectedRequestType){requestSpecific.innerHTML='<div class="request-empty">Choose a request type.</div>';return}const platform=requestPlatform.value;if(selectedRequestType==='new_product_upload'&&!platform){requestSpecific.innerHTML='<div class="request-empty">Choose a platform above to load the product setup checklist.</div>';return}const renders={design:designFields,copy:copyFields,promotion:promotionFields,new_product_upload:newProductFields};requestSpecific.innerHTML=renders[selectedRequestType](platform);requestSpecific.querySelectorAll('[data-template-platform]').forEach(btn=>btn.addEventListener('click',()=>downloadProductTemplate(btn.dataset.templatePlatform)))}
function designFields(platform){return `<div class="request-section"><div class="request-section-title">Creative deliverable</div><div class="field-grid">${field('design_deliverable','Deliverable','select',{required:true,options:['Main image','Secondary image set','A+ / Enhanced content','Brand Story','Storefront','Infographic','Lifestyle creative','Video / storyboard','Other']})}${field('design_quantity','Number of assets / concepts','number',{placeholder:'e.g. 6'})}</div>${field('design_objective','What should this creative communicate?','textarea',{required:true,rows:3})}<div class="field-grid">${field('design_asset_link','Product photos / source asset folder','url',{placeholder:'https://...'})}${field('design_reference_link','Reference / inspiration link','url',{placeholder:'https://...'})}</div>${field('design_required_copy','Required text, claims, or callouts','textarea',{rows:2})}${field('design_constraints','Brand / legal / compliance constraints','textarea',{rows:2})}<div class="request-requirement-note">${platform?`We’ll size and format the final assets for ${escapeHtml(platform)}.`:'Choose a platform above so we can format the deliverable correctly.'}</div></div>`}
function copyFields(platform){return `<div class="request-section"><div class="request-section-title">Copy scope</div><div class="check-grid">${checkbox('copy_scope','Full listing')}${checkbox('copy_title','Title')}${checkbox('copy_bullets','Bullets / highlights')}${checkbox('copy_description','Description')}${checkbox('copy_backend','Backend keywords / search terms')}${checkbox('copy_aplus','A+ / enhanced content')}${checkbox('copy_storefront','Storefront')}${checkbox('copy_other','Other')}</div><div class="field-grid">${field('copy_existing_listing','Existing listing URL','url')}${field('copy_keyword_research','Keyword / research file','url')}</div>${field('copy_product_facts','Product facts, features, materials, ingredients, dimensions, or differentiators','textarea',{required:true,rows:4})}${field('copy_required_claims','Required claims / approved language','textarea',{rows:2})}${field('copy_prohibited_claims','Claims or wording to avoid','textarea',{rows:2})}<div class="request-requirement-note">${platform?`We’ll write to current ${escapeHtml(platform)} content requirements and the appropriate product category.`:'Choose a platform above so we can apply the correct content rules.'}</div></div>`}
function promotionFields(platform){const promoOptions={'Amazon':['Coupon','Price Discount','Prime Exclusive Discount','Deal / Event submission','Promotion code','Other'],'Walmart':['Price promotion','Rollback / event pricing','Sponsored promotion support','Other'],'TikTok Shop':['Product discount','Seller coupon','Flash deal / campaign','Creator / affiliate promotion','Other'],'Target Plus':['Price promotion','Event / seasonal promotion','Other'],'Other':['Discount','Coupon','Event promotion','Other']}[platform||'Other'];return `<div class="request-section"><div class="request-section-title">Promotion setup</div><div class="field-grid">${field('promotion_type','Promotion type','select',{required:true,options:promoOptions})}${field('promotion_goal','Goal','select',{options:['Drive sales volume','Launch support','Inventory sell-through','Seasonal event','Conversion support','Other']})}</div><div class="field-grid">${field('promotion_start','Start date','date',{required:true})}${field('promotion_end','End date','date',{required:true})}</div><div class="field-grid three">${field('promotion_discount','Discount / target price','text',{required:true})}${field('promotion_budget','Budget / funding cap','text')}${field('promotion_inventory','Available inventory','number')}</div>${field('promotion_guardrails','Pricing / margin / participation guardrails','textarea',{rows:2})}</div>`}
function newProductFields(platform){const helper=PLATFORM_HELP[platform]||'';return `<div class="request-requirement-note">${escapeHtml(helper)}</div><div class="template-row"><div><strong>Multiple SKUs or variations?</strong><small>Download a ${escapeHtml(platform)} starter template and send us the completed sheet.</small></div><button type="button" class="template-btn" data-template-platform="${escapeHtml(platform)}">Download CSV Template</button></div><div class="request-section"><div class="request-section-title">Product structure</div><div class="field-grid">${field('upload_structure','Launch structure','select',{required:true,options:['Single standalone SKU','Parent with variations','Multiple standalone SKUs','Existing catalog item / new offer']})}${field('product_category','Category / product type','text',{required:true})}</div>${field('bulk_product_sheet','Completed product / variation data sheet','url')}</div><div class="request-section"><div class="request-section-title">Core product identity</div><div class="field-grid">${field('brand','Brand','text',{required:true})}${field('product_name','Product name / working title','text',{required:true})}${field('seller_sku','Seller SKU','text',{required:true})}${field('gtin','UPC / GTIN / EAN','text')}${field('manufacturer','Manufacturer','text')}${field('model_mpn','Model / MPN','text')}</div></div><div class="request-section"><div class="request-section-title">Commerce & fulfillment</div><div class="field-grid three">${field('price','Selling price','text',{required:true})}${field('msrp','MSRP / list price','text')}${field('inventory_qty','Launch inventory quantity','number',{required:true})}</div><div class="field-grid">${field('fulfillment_method','Fulfillment method','select',{required:true,options:fulfillmentOptions(platform)})}${field('country_of_origin','Country of origin','text',{required:true})}</div><div class="field-grid four">${field('item_dimensions','Item dimensions','text')}${field('item_weight','Item weight','text')}${field('package_dimensions','Package dimensions','text',{required:true})}${field('package_weight','Package weight','text',{required:true})}</div></div><div class="request-section"><div class="request-section-title">Content & assets</div>${field('product_facts','Product facts / features / specifications','textarea',{required:true,rows:4})}<div class="field-grid">${field('copy_status','Listing copy','select',{required:true,options:['Evolved should write the listing','Final copy is provided','Existing listing copy can be adapted']})}${field('image_asset_link','Image / video asset folder','url',{required:true})}</div>${field('variation_details','Variation details','textarea',{rows:3})}</div><div class="request-section"><div class="request-section-title">${escapeHtml(platform)}-specific information</div>${platformSpecificProductFields(platform)}</div><div class="request-section"><div class="request-section-title">Compliance & restrictions</div><div class="check-grid">${checkbox('contains_battery','Contains batteries')}${checkbox('chemical_or_aerosol','Chemical / aerosol')}${checkbox('pesticide','Pesticide / treated article')}${checkbox('prop65','California Prop 65 applies')}${checkbox('childrens_product','Children’s product / choking warning may apply')}${checkbox('wearable','Wearable item / size chart applies')}</div>${field('compliance_docs','Compliance / certification documents','url')}${field('warnings_claims','Required warnings, regulated claims, or compliance notes','textarea',{rows:3})}</div>`}
function fulfillmentOptions(platform){return {'Amazon':['FBA','FBM / Seller Fulfilled','Not sure'],'Walmart':['WFS','Seller Fulfilled','Not sure'],'TikTok Shop':['Seller Shipping','Platform fulfillment / FBT if enrolled','Not sure'],'Target Plus':['Seller Fulfilled','Not sure'],'Other':['Seller Fulfilled','Platform Fulfilled','Not sure']}[platform]||['Seller Fulfilled','Platform Fulfilled','Not sure']}
function platformSpecificProductFields(platform){if(platform==='Amazon')return `<div class="field-grid">${field('amazon_product_type','Amazon Product Type','text',{required:true})}${field('amazon_variation_theme','Variation theme','text')}${field('amazon_condition','Condition','select',{required:true,options:['New','Used - Like New','Used - Very Good','Used - Good','Other']})}${field('amazon_marketplace','Marketplace','select',{required:true,options:['US','Canada','Mexico','Other']})}</div>`;if(platform==='Walmart')return `<div class="field-grid">${field('walmart_product_type','Walmart Product Type','text',{required:true})}${field('walmart_fulfillment_center','Fulfillment center ID','text')}${field('walmart_condition','Condition','select',{required:true,options:['New','Pre-Owned','Restored','Other']})}${field('walmart_warranty','Warranty URL / warranty text','text')}</div>`;if(platform==='TikTok Shop')return `<div class="field-grid">${field('tiktok_category','TikTok Shop category','text',{required:true})}${field('tiktok_video_url','Product video URL','url')}${field('tiktok_material','Material / ingredients','text')}${field('tiktok_specifications','Key specifications','text')}</div>`;if(platform==='Target Plus')return `<div class="field-grid">${field('target_item_type','Target Plus item type','text',{required:true})}${field('target_gs1_upc','GS1-certified UPC / GTIN','text',{required:true})}${field('target_assortment_notes','Approved assortment / category notes','text')}${field('target_wercs','UL WERCSmart registration / reference','text')}</div>`;return field('platform_specific_notes','Platform-specific listing requirements','textarea',{rows:3})}
function downloadProductTemplate(platform){const headers=PRODUCT_TEMPLATES[platform]||['seller_sku','product_name','brand','category','gtin_upc_ean','price','inventory_qty','image_urls','product_facts','compliance_notes'];const csv=[headers,headers.map((h,i)=>i===0?'REPLACE THIS ROW WITH PRODUCT DATA':'')].map(row=>row.map(csvCell).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${platform.toLowerCase().replaceAll(' ','-')}-new-product-upload-template.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
function humanLabel(name){return name.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
function buildStructuredDescription(fd){const skip=new Set(['request_type','summary','client_slug','requester_name','requester_email','desired_date']);const lines=[`Platform: ${fd.get('platform')||''}`];const products=fd.get('products');if(products)lines.push(`Products / ASINs / SKUs: ${products}`);for(const [key,value] of fd.entries()){if(skip.has(key)||key==='platform'||key==='products'||!String(value).trim())continue;lines.push(`${humanLabel(key)}: ${value}`)}return lines.join('\n')}

$('request-work-btn').addEventListener('click',()=>dialog.showModal());
$('close-dialog').addEventListener('click',()=>dialog.close());
$('download-inventory').addEventListener('click',downloadInventoryCsv);
document.querySelectorAll('input[name="request_type"]').forEach(r=>r.addEventListener('change',e=>{selectedRequestType=e.target.value;requestCore.hidden=false;renderRequestFields()}));
requestPlatform.addEventListener('change',renderRequestFields);
requestForm.addEventListener('submit',async e=>{e.preventDefault();const status=$('request-status'),fd=new FormData(requestForm);if(!selectedRequestType){status.textContent='Choose a request type.';return}if(!requestForm.reportValidity())return;const payload=Object.fromEntries(fd.entries());payload.request_type=selectedRequestType;payload.description=buildStructuredDescription(fd);status.textContent='Submitting…';try{const r=await fetch('/api/work-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),result=await r.json().catch(()=>({}));if(!r.ok)throw new Error(result.error||'Request service is not configured yet.');status.textContent=result.clickup_task_id?'Submitted to the Evolved team ✓':'Request saved ✓';setTimeout(()=>{dialog.close();requestForm.reset();selectedRequestType='';requestCore.hidden=true;requestSpecific.innerHTML='';status.textContent=''},1400)}catch(err){const existing=JSON.parse(localStorage.getItem('evolved_prototype_requests')||'[]');existing.push({...payload,created_at:new Date().toISOString()});localStorage.setItem('evolved_prototype_requests',JSON.stringify(existing));status.textContent='Prototype saved locally — ClickUp turns on next.'}});


document.querySelectorAll('[data-window-switch]').forEach(group=>{
  group.querySelectorAll('button[data-window]').forEach(button=>{
    button.addEventListener('click',()=>{
      const windowValue=button.dataset.window;
      const groupName=group.dataset.windowSwitch;
      group.querySelectorAll('button[data-window]').forEach(b=>{
        const active=b===button;
        b.classList.toggle('active',active);
        b.setAttribute('aria-pressed',active?'true':'false');
      });
      if(groupName==='performance'){
        performanceWindow=windowValue;
        if(dashboard)renderPerformanceCharts(dashboard);
      }else if(groupName==='traffic'){
        trafficWindow=windowValue;
        if(dashboard)renderTrafficConversion(dashboard);
      }
    });
  });
});

let resizeTimer=null;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(dashboard){renderPerformanceCharts(dashboard);renderTrafficConversion(dashboard)}},120)});
loadDashboard().catch(err=>{console.error(err);document.body.insertAdjacentHTML('afterbegin',`<div style="margin:12px;padding:10px;border:1px solid #F09E55;background:#fff8f3;border-radius:4px;font:600 10px Montserrat,sans-serif;color:#D9541F">Dashboard data could not be loaded: ${escapeHtml(err.message)}</div>`)});
