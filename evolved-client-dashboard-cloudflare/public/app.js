const $=id=>document.getElementById(id); let dashboard=null;
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
  $('kpi-sales').textContent=fmtMoney(d.kpis?.total_sales);$('kpi-ad-sales').textContent=fmtMoney(d.kpis?.ad_sales);$('kpi-ad-spend').textContent=fmtMoney(d.kpis?.ad_spend);$('kpi-roas').textContent=fmtRoas(d.kpis?.roas);$('kpi-tacos').textContent=fmtPct(d.kpis?.tacos);
  $('sales-goal').textContent=d.goals?.monthly_sales?.target?`Projected ${fmtMoney(d.kpis?.projected_sales)} · Target ${fmtMoney(d.goals.monthly_sales.target)}`:'Month to date';
  $('roas-target').textContent=d.goals?.roas?.target?`Target ${fmtRoas(d.goals.roas.target)}`:'';
  $('tacos-target').textContent=d.goals?.tacos?.target?`Target ${fmtPct(d.goals.tacos.target)}`:'';
  $('tacos-chart-target').textContent=d.goals?.tacos?.target?`Reference target ${fmtPct(d.goals.tacos.target)}`:'';
  renderComparisons(d);renderSignals(d);renderProducts(d);renderInventory(d);drawSalesChart(d);drawTacosChart(d);$('request-client-slug').value=d.client?.slug||'anchorstrap'
}
function neutralSummary(d){const k=d.kpis||{};return `${fmtMoney(k.total_sales)} in month-to-date sales across ${fmtNum(k.sessions)} sessions, with ${fmtMoney(k.ad_sales)} in Amazon-attributed ad sales.`}
function renderComparisons(d){const k=d.kpis||{},g=d.goals||{},inv=d.inventory||{},target=Number(g.monthly_sales?.target||0),proj=Number(k.projected_sales||0);const rows=[['Projected sales',fmtMoney(proj),target?`${fmtPct(proj/target,0)} of target`:'Current projection'],['Sessions',fmtNum(k.sessions),g.monthly_sessions?.target?`Target ${fmtNum(g.monthly_sessions.target)}`:'Month to date'],['Conversion',fmtPct(k.conversion_rate),g.conversion_rate?.target?`Target ${fmtPct(g.conversion_rate.target)}`:'Current month'],['Inventory',`${fmtNum(inv.risk_products)} flagged`,`${fmtNum(inv.out_of_stock)} out of stock`]];$('comparison-grid').innerHTML=rows.map(([l,v,n])=>`<div class="comparison-item"><span>${l}</span><strong>${v}</strong><small>${n}</small></div>`).join('')}
function renderSignals(d){const k=d.kpis||{},inv=d.inventory||{};signal('sales-signals',[['Month-to-date sales',fmtMoney(k.total_sales)],['Projected sales',fmtMoney(k.projected_sales)],['Sessions',fmtNum(k.sessions)],['Conversion rate',fmtPct(k.conversion_rate)]]);signal('ad-signals',[['Attributed sales',fmtMoney(k.ad_sales)],['Ad spend',fmtMoney(k.ad_spend)],['ROAS',fmtRoas(k.roas)],['TACOS',fmtPct(k.tacos)]]);signal('ops-signals',[['Inventory flags',fmtNum(inv.risk_products)],['Out of stock',fmtNum(inv.out_of_stock)],['Order now',fmtNum(inv.order_now)],['Data age',`${fmtNum(d.health?.data_age_days||0)} days`]])}
function signal(id,rows){$(id).innerHTML=rows.map(([l,v])=>`<div class="signal-row"><span>${l}</span><strong>${v}</strong></div>`).join('')}
function renderProducts(d){$('product-table').innerHTML=(d.top_products||[]).map(p=>{const t=Number(p.sales_change||0),sign=t>0?'+':'';return `<tr><td><span class="product-name">${escapeHtml(prettyName(p.product))}</span><span class="asin">${escapeHtml(p.asin||'')}</span></td><td>${fmtMoney(p.sales)}</td><td class="change">${sign}${(t*100).toFixed(1)}%</td><td>${fmtPct(p.conversion_rate)}</td></tr>`}).join('')}
function renderInventory(d){
  const inv=d.inventory||{},items=getReplenishmentItems(inv),units=items.reduce((s,x)=>s+Number(x.recommended_units||0),0);
  $('out-of-stock').textContent=fmtNum(inv.out_of_stock);$('order-now').textContent=fmtNum(inv.order_now);$('replenishment-units').textContent=fmtNum(units);
  $('inventory-copy').textContent=`${fmtNum(items.length)} actionable SKU recommendations are included in the current replenishment file.`;
  $('inventory-list').innerHTML=items.slice(0,5).map(x=>`<div class="inventory-row"><div><strong>${escapeHtml(prettyName(x.product))}</strong><span>${escapeHtml(x.sku||'')} · ${escapeHtml(x.asin||'')}</span></div><b>${fmtNum(x.recommended_units)} units</b></div>`).join('');
}
function getReplenishmentItems(inv){if(Array.isArray(inv.replenishment_items))return inv.replenishment_items;return (inv.critical_products||[]).map(x=>({...x,sku:'',fnsku:'',available:'',inbound_working:'',inbound_shipped:''}))}
function downloadInventoryCsv(){
  if(!dashboard)return;const items=getReplenishmentItems(dashboard.inventory||{});if(!items.length){alert('No replenishment recommendations are available in the current dashboard data.');return}
  const headers=['Status','Recommended Qty','ASIN','Merchant SKU','FNSKU','Product Name','Available','Inbound - Working','Inbound - Shipped','Units 30D','Sales 30D'];
  const rows=items.map(x=>[x.status,x.recommended_units,x.asin,x.sku,x.fnsku,x.product,x.available,x.inbound_working,x.inbound_shipped,x.units_30d,x.sales_30d]);
  const csv=[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  const date=(dashboard.data_through?.sales||new Date().toISOString().slice(0,10)).slice(0,10);a.download=`${dashboard.client?.slug||'client'}-inventory-replenishment-${date}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500)
}
function csvCell(v){const s=String(v??'');return `"${s.replaceAll('"','""')}"`}
function prettyName(v=''){let s=String(v).replace('Anchor Strap Co | ','').replaceAll(' | ',' · ');if(s.length>72)s=s.slice(0,69).trim()+'…';return s}
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function drawSalesChart(d){const p=[...(d.monthly_trend||[])].map(x=>({label:x.month.slice(0,3),value:x.total_sales}));p.push({label:'Aug*',value:d.kpis?.projected_sales||0});drawLine('sales-chart',p,{value:v=>fmtMoney(v,true),stroke:'#F47322',fill:'#FDF1E9'})}
function drawTacosChart(d){
  const p=[...(d.monthly_trend||[])].map(x=>({label:x.month.slice(0,3),value:Number(x.tacos||0)}));
  p.push({label:'Aug',value:Number(d.kpis?.tacos||0)});
  drawTacosReadable('tacos-chart',p,Number(d.goals?.tacos?.target||0));
}
function drawTacosReadable(id,points,target){
  const el=$(id);
  if(!points.length){el.innerHTML='';return}
  const w=Math.max(420,Math.round(el.getBoundingClientRect().width||520));
  const h=Math.max(250,Math.round(el.getBoundingClientRect().height||280));
  const pad={l:54,r:30,t:34,b:38};

  const vals=points.map(x=>Number(x.value||0));
  const rawMax=Math.max(...vals,target||0);
  const step=.20;
  const yMax=Math.max(.60,Math.ceil(rawMax/step)*step);
  const yMin=0;

  const X=i=>pad.l+i*(w-pad.l-pad.r)/Math.max(1,points.length-1);
  const Y=v=>pad.t+(yMax-v)*(h-pad.t-pad.b)/(yMax-yMin);

  const ticks=[];
  for(let v=0;v<=yMax+.0001;v+=step)ticks.push(Number(v.toFixed(4)));
  const grid=ticks.map(v=>{
    const y=Y(v);
    return `<line x1="${pad.l}" y1="${y}" x2="${w-pad.r}" y2="${y}" stroke="#E6EAEC" stroke-width="1"/>
      <text x="${pad.l-10}" y="${y+4}" text-anchor="end" class="tacos-axis-label">${Math.round(v*100)}%</text>`;
  }).join('');

  const coords=points.map((p,i)=>[X(i),Y(p.value)]);
  const line=coords.map((c,i)=>(i?'L':'M')+c[0].toFixed(1)+','+c[1].toFixed(1)).join(' ');
  const area=`M${coords[0][0]},${h-pad.b} `+coords.map(c=>`L${c[0]},${c[1]}`).join(' ')+` L${coords.at(-1)[0]},${h-pad.b} Z`;

  const labels=points.map((p,i)=>
    `<text x="${X(i)}" y="${h-12}" text-anchor="middle" class="tacos-axis-label">${p.label}</text>`
  ).join('');

  const dots=coords.map((c,i)=>{
    const labelY=Math.max(17,c[1]-13);
    return `<circle cx="${c[0]}" cy="${c[1]}" r="4.5" fill="#fff" stroke="#415A68" stroke-width="2.5"/>
      <text x="${c[0]}" y="${labelY}" text-anchor="middle" class="tacos-data-label">${Math.round(points[i].value*100)}%</text>`;
  }).join('');

  let targetLine='';
  if(target>0){
    const ty=Y(target);
    targetLine=`<line x1="${pad.l}" y1="${ty}" x2="${w-pad.r}" y2="${ty}" stroke="#F47322" stroke-width="1.5" stroke-dasharray="6 5"/>
      <text x="${w-pad.r}" y="${ty-8}" text-anchor="end" class="tacos-target-label">${Math.round(target*100)}% target</text>`;
  }

  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${grid}${targetLine}<path d="${area}" fill="#EEF1F3" opacity=".75"/><path d="${line}" fill="none" stroke="#415A68" stroke-width="3" vector-effect="non-scaling-stroke"/>${dots}${labels}</svg>`;
}
function drawLine(id,points,o){
  const el=$(id);
  if(!points.length){el.innerHTML='';return}
  const w=Math.max(520,Math.round(el.getBoundingClientRect().width||720));
  const h=Math.max(250,Math.round(el.getBoundingClientRect().height||280));
  const p={l:54,r:24,t:28,b:38};

  const vals=points.map(x=>Number(x.value||0));
  let min=Math.min(...vals,o.target??Infinity),max=Math.max(...vals,o.target??-Infinity);
  if(min===max){min*=.8;max*=1.2}
  const sp=max-min;
  min=Math.max(0,min-sp*.18);
  max=max+sp*.18;

  const X=i=>p.l+i*(w-p.l-p.r)/Math.max(1,points.length-1);
  const Y=v=>p.t+(max-v)*(h-p.t-p.b)/(max-min);
  const c=points.map((x,i)=>[X(i),Y(x.value)]);
  const line=c.map((a,i)=>(i?'L':'M')+a[0].toFixed(1)+','+a[1].toFixed(1)).join(' ');
  const area=`M${c[0][0]},${h-p.b} `+c.map(a=>`L${a[0]},${a[1]}`).join(' ')+` L${c.at(-1)[0]},${h-p.b} Z`;

  const grid=[0,.5,1].map(t=>{
    const v=max-(max-min)*t,y=p.t+(h-p.t-p.b)*t;
    return `<line x1="${p.l}" y1="${y}" x2="${w-p.r}" y2="${y}" stroke="#edf0f1"/>
      <text x="${p.l-10}" y="${y+4}" text-anchor="end" class="axis-label">${o.value(v)}</text>`;
  }).join('');

  const labels=points.map((x,i)=>`<text x="${X(i)}" y="${h-12}" text-anchor="middle" class="axis-label">${x.label}</text>`).join('');
  const dots=c.map((a,i)=>`<circle cx="${a[0]}" cy="${a[1]}" r="4" fill="#fff" stroke="${o.stroke}" stroke-width="2.5"/>
    <text x="${a[0]}" y="${Math.max(16,a[1]-13)}" text-anchor="middle" class="chart-value">${o.value(points[i].value)}</text>`).join('');

  let target='';
  if(o.target!=null){
    const y=Y(o.target);
    target=`<line x1="${p.l}" y1="${y}" x2="${w-p.r}" y2="${y}" stroke="#FDBA31" stroke-width="1.4" stroke-dasharray="5 5"/>`;
  }
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${grid}${target}<path d="${area}" fill="${o.fill}" opacity=".8"/><path d="${line}" fill="none" stroke="${o.stroke}" stroke-width="2.7" vector-effect="non-scaling-stroke"/>${dots}${labels}</svg>`;
}
$('download-inventory').addEventListener('click',downloadInventoryCsv);

const dialog=$('request-dialog');
const requestForm=$('request-form');
const requestCore=$('request-core-fields');
const requestPlatform=$('request-platform');
const requestSpecific=$('request-specific-fields');
let selectedRequestType='';

const PLATFORM_HELP={
  'Amazon':'Amazon requirements vary by Product Type. We collect the core data here, then validate category-specific attributes against the current Amazon product-type requirements before upload.',
  'Walmart':'Walmart requirements vary by Product Type and fulfillment method. We collect the core item/offer data here, then validate the item against Walmart’s current product-type spec.',
  'TikTok Shop':'TikTok Shop listings require complete PDP content and may require category-specific attributes, approvals, warnings, or certifications.',
  'Target Plus':'Target Plus is curated and item requirements vary by approved assortment/category. We collect the common item data here plus Target-specific compliance and content inputs.'
};

const PRODUCT_TEMPLATES={
  'Amazon':['seller_sku','product_type','brand','product_name','gtin_upc_ean','gtin_exemption','manufacturer','model_mpn','price','msrp','fulfillment','inventory_qty','variation_theme','parent_sku','color','size','material','country_of_origin','item_length','item_width','item_height','item_weight','package_length','package_width','package_height','package_weight','main_image_url','additional_image_urls','title_copy','bullet_1','bullet_2','bullet_3','bullet_4','bullet_5','description','backend_search_terms','battery_info','hazmat_info','prop65_warning','compliance_notes'],
  'Walmart':['seller_sku','product_type','gtin_upc_ean','brand','product_name','short_description','site_description','key_feature_1','key_feature_2','price','msrp','fulfillment','fulfillment_center_id','inventory_qty','country_of_origin','item_length','item_width','item_height','item_weight','package_length','package_width','package_height','package_weight','main_image_url','additional_image_urls','variant_group_id','variant_attribute_names','color','size','condition','warranty','prop65_warning','is_chemical','is_aerosol','is_pesticide','sds_url','compliance_notes'],
  'TikTok Shop':['seller_sku','category','brand','product_name','description','price','inventory_qty','variation_1_name','variation_1_value','variation_2_name','variation_2_value','main_image_url','additional_image_urls','video_url','package_length','package_width','package_height','package_weight','material','specifications','size_chart_url','country_of_origin','prop65_warning','choking_hazard_warning','compliance_certifications','compliance_notes'],
  'Target Plus':['seller_sku','target_item_type','gs1_upc_gtin','brand','product_title','description','bullet_feature_1','bullet_feature_2','price','inventory_qty','color','size','material','country_of_origin','package_length','package_width','package_height','package_weight','main_image_url','additional_image_urls','size_chart_url','wercsmart_registration','hazmat_esim_notes','compliance_notes']
};

function field(name,label,type='text',opts={}){
  const req=opts.required?' required':'';
  const ph=opts.placeholder?` placeholder="${escapeHtml(opts.placeholder)}"`:'';
  const help=opts.help?`<div class="request-help">${escapeHtml(opts.help)}</div>`:'';
  const tag=opts.required?'<span class="required-tag">REQUIRED</span>':'';
  if(type==='textarea') return `<div class="field"><label>${label}${tag}</label><textarea name="${name}" rows="${opts.rows||3}"${req}${ph}></textarea>${help}</div>`;
  if(type==='select'){
    const options=(opts.options||[]).map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
    return `<div class="field"><label>${label}${tag}</label><select name="${name}"${req}><option value="">Choose...</option>${options}</select>${help}</div>`;
  }
  return `<div class="field"><label>${label}${tag}</label><input name="${name}" type="${type}"${req}${ph}>${help}</div>`;
}
function checkbox(name,label,value='Yes'){return `<label class="check-option"><input type="checkbox" name="${name}" value="${escapeHtml(value)}"><span>${label}</span></label>`}

function renderRequestFields(){
  if(!selectedRequestType){requestSpecific.innerHTML='<div class="request-empty">Choose a request type.</div>';return}
  const platform=requestPlatform.value;
  if(selectedRequestType==='new_product_upload' && !platform){
    requestSpecific.innerHTML='<div class="request-empty">Choose a platform above to load the product setup checklist.</div>';return
  }
  const renders={design:designFields,copy:copyFields,promotion:promotionFields,new_product_upload:newProductFields};
  requestSpecific.innerHTML=renders[selectedRequestType](platform);
  requestSpecific.querySelectorAll('[data-template-platform]').forEach(btn=>btn.addEventListener('click',()=>downloadProductTemplate(btn.dataset.templatePlatform)));
}
function designFields(platform){
  return `
    <div class="request-section">
      <div class="request-section-title">Creative deliverable</div>
      <div class="field-grid">
        ${field('design_deliverable','Deliverable','select',{required:true,options:['Main image','Secondary image set','A+ / Enhanced content','Brand Story','Storefront','Infographic','Lifestyle creative','Video / storyboard','Other']})}
        ${field('design_quantity','Number of assets / concepts','number',{placeholder:'e.g. 6'})}
      </div>
      ${field('design_objective','What should this creative communicate?','textarea',{required:true,rows:3,placeholder:'Key message, product benefit, launch goal, problem to solve...'})}
      <div class="field-grid">
        ${field('design_asset_link','Product photos / source asset folder','url',{placeholder:'https://...'})}
        ${field('design_reference_link','Reference / inspiration link','url',{placeholder:'https://...'})}
      </div>
      ${field('design_required_copy','Required text, claims, or callouts','textarea',{rows:2,placeholder:'Include any wording that must appear exactly as provided.'})}
      ${field('design_constraints','Brand / legal / compliance constraints','textarea',{rows:2,placeholder:'Anything we must include or avoid.'})}
      <div class="request-requirement-note">${platform?`We’ll size and format the final assets for ${escapeHtml(platform)}.`:'Choose a platform above so we can format the deliverable correctly.'}</div>
    </div>`;
}
function copyFields(platform){
  return `
    <div class="request-section">
      <div class="request-section-title">Copy scope</div>
      <div class="check-grid">
        ${checkbox('copy_scope','Full listing')}
        ${checkbox('copy_title','Title')}
        ${checkbox('copy_bullets','Bullets / highlights')}
        ${checkbox('copy_description','Description')}
        ${checkbox('copy_backend','Backend keywords / search terms')}
        ${checkbox('copy_aplus','A+ / enhanced content')}
        ${checkbox('copy_storefront','Storefront')}
        ${checkbox('copy_other','Other')}
      </div>
      <div class="field-grid">
        ${field('copy_existing_listing','Existing listing URL','url',{placeholder:'https://...'})}
        ${field('copy_keyword_research','Keyword / research file','url',{placeholder:'https://...'})}
      </div>
      ${field('copy_product_facts','Product facts, features, materials, ingredients, dimensions, or differentiators','textarea',{required:true,rows:4})}
      ${field('copy_required_claims','Required claims / approved language','textarea',{rows:2})}
      ${field('copy_prohibited_claims','Claims or wording to avoid','textarea',{rows:2})}
      ${field('copy_competitors','Competitor / reference listings','textarea',{rows:2,placeholder:'Paste URLs, one per line.'})}
      <div class="request-requirement-note">${platform?`We’ll write to current ${escapeHtml(platform)} content requirements and the appropriate product category.`:'Choose a platform above so we can apply the correct content rules.'}</div>
    </div>`;
}
function promotionFields(platform){
  const promoOptions={
    'Amazon':['Coupon','Price Discount','Prime Exclusive Discount','Deal / Event submission','Promotion code','Other'],
    'Walmart':['Price promotion','Rollback / event pricing','Sponsored promotion support','Other'],
    'TikTok Shop':['Product discount','Seller coupon','Flash deal / campaign','Creator / affiliate promotion','Other'],
    'Target Plus':['Price promotion','Event / seasonal promotion','Other'],
    'Other':['Discount','Coupon','Event promotion','Other']
  }[platform||'Other'];
  return `
    <div class="request-section">
      <div class="request-section-title">Promotion setup</div>
      <div class="field-grid">
        ${field('promotion_type','Promotion type','select',{required:true,options:promoOptions})}
        ${field('promotion_goal','Goal','select',{options:['Drive sales volume','Launch support','Inventory sell-through','Seasonal event','Conversion support','Other']})}
      </div>
      <div class="field-grid">
        ${field('promotion_start','Start date','date',{required:true})}
        ${field('promotion_end','End date','date',{required:true})}
      </div>
      <div class="field-grid three">
        ${field('promotion_discount','Discount / target price','text',{required:true,placeholder:'e.g. 20% or $39.99'})}
        ${field('promotion_budget','Budget / funding cap','text',{placeholder:'e.g. $2,000'})}
        ${field('promotion_inventory','Available inventory','number',{placeholder:'Units available'})}
      </div>
      ${field('promotion_event','Event / campaign name','text',{placeholder:'Prime Day, Labor Day, launch week...'})}
      ${field('promotion_guardrails','Pricing / margin / participation guardrails','textarea',{rows:2,placeholder:'Minimum price, max discount, products to exclude, etc.'})}
    </div>`;
}
function newProductFields(platform){
  const helper=PLATFORM_HELP[platform]||'';
  const platformBlock=platformSpecificProductFields(platform);
  return `
    <div class="request-requirement-note">${escapeHtml(helper)}</div>
    <div class="template-row">
      <div><strong>Multiple SKUs or variations?</strong><small>Download a ${escapeHtml(platform)} starter template and send us the completed sheet.</small></div>
      <button type="button" class="template-btn" data-template-platform="${escapeHtml(platform)}">Download CSV Template</button>
    </div>

    <div class="request-section">
      <div class="request-section-title">Product structure</div>
      <div class="field-grid">
        ${field('upload_structure','Launch structure','select',{required:true,options:['Single standalone SKU','Parent with variations','Multiple standalone SKUs','Existing catalog item / new offer']})}
        ${field('product_category','Category / product type','text',{required:true,placeholder:'Be as specific as possible'})}
      </div>
      ${field('bulk_product_sheet','Completed product / variation data sheet','url',{placeholder:'Google Sheet, Drive, Dropbox, or other shared file link',help:'Recommended for launches with more than one SKU.'})}
    </div>

    <div class="request-section">
      <div class="request-section-title">Core product identity</div>
      <div class="field-grid">
        ${field('brand','Brand','text',{required:true})}
        ${field('product_name','Product name / working title','text',{required:true})}
        ${field('seller_sku','Seller SKU','text',{required:true})}
        ${field('gtin','UPC / GTIN / EAN','text',{placeholder:'Enter barcode or explain exemption below'})}
        ${field('manufacturer','Manufacturer','text')}
        ${field('model_mpn','Model / MPN','text')}
      </div>
      <div class="check-grid">
        ${checkbox('gtin_exemption_needed','No barcode / exemption may be needed')}
        ${checkbox('new_brand_setup','Brand is new to this platform')}
      </div>
    </div>

    <div class="request-section">
      <div class="request-section-title">Commerce & fulfillment</div>
      <div class="field-grid three">
        ${field('price','Selling price','text',{required:true,placeholder:'e.g. 49.99'})}
        ${field('msrp','MSRP / list price','text',{placeholder:'e.g. 59.99'})}
        ${field('inventory_qty','Launch inventory quantity','number',{required:true})}
      </div>
      <div class="field-grid">
        ${field('fulfillment_method','Fulfillment method','select',{required:true,options:fulfillmentOptions(platform)})}
        ${field('country_of_origin','Country of origin','text',{required:true})}
      </div>
      <div class="field-grid four">
        ${field('item_dimensions','Item dimensions','text',{placeholder:'L × W × H + unit'})}
        ${field('item_weight','Item weight','text',{placeholder:'value + unit'})}
        ${field('package_dimensions','Package dimensions','text',{required:true,placeholder:'L × W × H + unit'})}
        ${field('package_weight','Package weight','text',{required:true,placeholder:'value + unit'})}
      </div>
    </div>

    <div class="request-section">
      <div class="request-section-title">Content & assets</div>
      ${field('product_facts','Product facts / features / specifications','textarea',{required:true,rows:4,placeholder:'Materials, ingredients, compatibility, use cases, included components, technical specs, benefits, etc.'})}
      <div class="field-grid">
        ${field('copy_status','Listing copy','select',{required:true,options:['Evolved should write the listing','Final copy is provided','Existing listing copy can be adapted']})}
        ${field('image_asset_link','Image / video asset folder','url',{required:true,placeholder:'https://...'})}
      </div>
      ${field('existing_copy_link','Existing copy / spec sheet / PDP link','url',{placeholder:'https://...'})}
      ${field('variation_details','Variation details','textarea',{rows:3,placeholder:'Variation theme and values, e.g. Color: Black, Navy; Size: 20mm, 22mm.'})}
    </div>

    <div class="request-section">
      <div class="request-section-title">${escapeHtml(platform)}-specific information</div>
      ${platformBlock}
    </div>

    <div class="request-section">
      <div class="request-section-title">Compliance & restrictions</div>
      <div class="check-grid">
        ${checkbox('contains_battery','Contains batteries')}
        ${checkbox('chemical_or_aerosol','Chemical / aerosol')}
        ${checkbox('pesticide','Pesticide / treated article')}
        ${checkbox('prop65','California Prop 65 applies')}
        ${checkbox('childrens_product','Children’s product / choking warning may apply')}
        ${checkbox('wearable','Wearable item / size chart applies')}
      </div>
      <div class="field-grid">
        ${field('compliance_docs','Compliance / certification documents','url',{placeholder:'SDS, test reports, certificates, WERCS, etc.'})}
        ${field('size_chart_link','Size chart link','url',{placeholder:'If applicable'})}
      </div>
      ${field('warnings_claims','Required warnings, regulated claims, or compliance notes','textarea',{rows:3})}
    </div>`;
}
function fulfillmentOptions(platform){
  return {
    'Amazon':['FBA','FBM / Seller Fulfilled','Not sure'],
    'Walmart':['WFS','Seller Fulfilled','Not sure'],
    'TikTok Shop':['Seller Shipping','Platform fulfillment / FBT if enrolled','Not sure'],
    'Target Plus':['Seller Fulfilled','Not sure'],
    'Other':['Seller Fulfilled','Platform Fulfilled','Not sure']
  }[platform]||['Seller Fulfilled','Platform Fulfilled','Not sure'];
}
function platformSpecificProductFields(platform){
  if(platform==='Amazon') return `
    <div class="field-grid">
      ${field('amazon_product_type','Amazon Product Type','text',{required:true,placeholder:'e.g. PET_SUPPLIES, WATCH_BAND'})}
      ${field('amazon_variation_theme','Variation theme','text',{placeholder:'Color, Size, ColorSize, etc.'})}
      ${field('amazon_condition','Condition','select',{required:true,options:['New','Used - Like New','Used - Very Good','Used - Good','Other']})}
      ${field('amazon_marketplace','Marketplace','select',{required:true,options:['US','Canada','Mexico','Other']})}
    </div>
    ${field('amazon_backend_terms','Backend search terms / keywords','textarea',{rows:2,placeholder:'If final keywords are already approved; otherwise Evolved can research them.'})}`;
  if(platform==='Walmart') return `
    <div class="field-grid">
      ${field('walmart_product_type','Walmart Product Type','text',{required:true})}
      ${field('walmart_fulfillment_center','Fulfillment center ID','text',{placeholder:'If seller fulfilled / applicable'})}
      ${field('walmart_condition','Condition','select',{required:true,options:['New','Pre-Owned','Restored','Other']})}
      ${field('walmart_warranty','Warranty URL / warranty text','text',{placeholder:'If applicable'})}
    </div>
    <div class="check-grid">
      ${checkbox('walmart_is_chemical','Walmart: item is chemical')}
      ${checkbox('walmart_is_aerosol','Walmart: item is aerosol')}
      ${checkbox('walmart_is_pesticide','Walmart: item is pesticide')}
    </div>
    ${field('walmart_sds','Safety Data Sheet URL','url',{placeholder:'If conditionally required'})}`;
  if(platform==='TikTok Shop') return `
    <div class="field-grid">
      ${field('tiktok_category','TikTok Shop category','text',{required:true})}
      ${field('tiktok_video_url','Product video URL','url',{placeholder:'Optional'})}
      ${field('tiktok_material','Material / ingredients','text',{placeholder:'As applicable'})}
      ${field('tiktok_specifications','Key specifications','text',{placeholder:'Model, capacity, dimensions, compatibility, etc.'})}
    </div>
    ${field('tiktok_brand_authorization','Brand authorization / category approval docs','url',{placeholder:'If applicable'})}
    <div class="request-help">For listing quality, provide a folder with multiple high-resolution product images and all category-specific details available.</div>`;
  if(platform==='Target Plus') return `
    <div class="field-grid">
      ${field('target_item_type','Target Plus item type','text',{required:true})}
      ${field('target_gs1_upc','GS1-certified UPC / GTIN','text',{required:true})}
      ${field('target_assortment_notes','Approved assortment / category notes','text',{placeholder:'If provided by Target'})}
      ${field('target_wercs','UL WERCSmart registration / reference','text',{placeholder:'Required for applicable ESIM / Hazmat items'})}
    </div>
    ${field('target_features','Target PDP bullet features / key selling points','textarea',{rows:2})}`;
  return field('platform_specific_notes','Platform-specific listing requirements','textarea',{rows:3});
}
function downloadProductTemplate(platform){
  const headers=PRODUCT_TEMPLATES[platform]||['seller_sku','product_name','brand','category','gtin_upc_ean','price','inventory_qty','image_urls','product_facts','compliance_notes'];
  const noteRow=headers.map((h,i)=>i===0?'REPLACE THIS ROW WITH PRODUCT DATA':'');
  const csv=[headers,noteRow].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${platform.toLowerCase().replaceAll(' ','-')}-new-product-upload-template.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500)
}
function humanLabel(name){return name.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}
function buildStructuredDescription(formData){
  const skip=new Set(['request_type','summary','client_slug','requester_name','requester_email','desired_date']);
  const lines=[];
  lines.push(`Platform: ${formData.get('platform')||''}`);
  const products=formData.get('products');if(products)lines.push(`Products / ASINs / SKUs: ${products}`);
  const seen=new Set();
  for(const [key,value] of formData.entries()){
    if(skip.has(key)||key==='platform'||key==='products'||!String(value).trim())continue;
    if(seen.has(key)){
      const idx=lines.findIndex(x=>x.startsWith(`${humanLabel(key)}:`));
      if(idx>=0)lines[idx]+=`; ${value}`;
    }else{
      lines.push(`${humanLabel(key)}: ${value}`);seen.add(key)
    }
  }
  return lines.join('\n');
}

$('request-work-btn').addEventListener('click',()=>dialog.showModal());
$('close-dialog').addEventListener('click',()=>dialog.close());
document.querySelectorAll('input[name="request_type"]').forEach(r=>r.addEventListener('change',e=>{
  selectedRequestType=e.target.value;requestCore.hidden=false;renderRequestFields();
}));
requestPlatform.addEventListener('change',renderRequestFields);

requestForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const status=$('request-status');
  const fd=new FormData(requestForm);
  if(!selectedRequestType){status.textContent='Choose a request type.';return}
  if(!requestForm.reportValidity())return;
  const payload=Object.fromEntries(fd.entries());
  payload.request_type=selectedRequestType;
  payload.description=buildStructuredDescription(fd);
  status.textContent='Submitting…';
  try{
    const r=await fetch('/api/work-request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(result.error||'Request service is not configured yet.');
    status.textContent=result.clickup_task_id?'Submitted to the Evolved team ✓':'Request saved ✓';
    setTimeout(()=>{
      dialog.close();requestForm.reset();selectedRequestType='';requestCore.hidden=true;requestSpecific.innerHTML='';status.textContent='';
    },1400)
  }catch(err){
    const existing=JSON.parse(localStorage.getItem('evolved_prototype_requests')||'[]');
    existing.push({...payload,created_at:new Date().toISOString()});
    localStorage.setItem('evolved_prototype_requests',JSON.stringify(existing));
    status.textContent='Prototype saved locally — ClickUp turns on next.';
  }
});


let dashboardResizeTimer=null;
window.addEventListener('resize',()=>{
  clearTimeout(dashboardResizeTimer);
  dashboardResizeTimer=setTimeout(()=>{
    if(dashboard){drawSalesChart(dashboard);drawTacosChart(dashboard)}
  },120);
});

loadDashboard().catch(err=>{console.error(err);document.body.insertAdjacentHTML('afterbegin',`<div style="margin:12px;padding:10px;border:1px solid #F09E55;background:#fff8f3;border-radius:4px;font:600 10px Montserrat,sans-serif;color:#D9541F">Dashboard data could not be loaded: ${escapeHtml(err.message)}</div>`)});
