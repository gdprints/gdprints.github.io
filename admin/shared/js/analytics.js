/* GDprint detailed analytics: daily / monthly / quarterly / yearly */
let ANALYTICS_ORDERS = [], ANALYTICS_PROFILES = [], ANALYTICS_PROFILE = null;
const money = n => new Intl.NumberFormat("hy-AM").format(Math.round(Number(n)||0)) + " դր.";
function earningFor(o, pct){
  if (o.cost_amount == null || o.payment_status !== "paid") return 0;
  return Math.max(0,(Number(o.total_amount)||0)-(Number(o.cost_amount)||0)) * ((Number(pct)||10)/100);
}
function rangeFor(period, anchor){
  const d=new Date(anchor); let start,end,label;
  if(period==='daily'){ start=new Date(d.getFullYear(),d.getMonth(),d.getDate()); end=new Date(start); end.setDate(end.getDate()+1); label=start.toLocaleDateString('hy-AM'); }
  else if(period==='monthly'){ start=new Date(d.getFullYear(),d.getMonth(),1); end=new Date(d.getFullYear(),d.getMonth()+1,1); label=start.toLocaleDateString('hy-AM',{month:'long',year:'numeric'}); }
  else if(period==='quarterly'){ const q=Math.floor(d.getMonth()/3); start=new Date(d.getFullYear(),q*3,1); end=new Date(d.getFullYear(),q*3+3,1); label=`Q${q+1} ${d.getFullYear()}`; }
  else { start=new Date(d.getFullYear(),0,1); end=new Date(d.getFullYear()+1,0,1); label=String(d.getFullYear()); }
  return {start,end,label};
}
function profilePct(id){ return Number(ANALYTICS_PROFILES.find(p=>p.id===id)?.commission_percent)||10; }
function renderAnalytics(){
  const period=document.getElementById('period').value, anchor=document.getElementById('anchor-date').value || new Date().toISOString().slice(0,10);
  const {start,end,label}=rangeFor(period,anchor); document.getElementById('period-label').textContent=label;
  const rows=ANALYTICS_ORDERS.filter(o=>{const x=new Date(o.created_at);return x>=start&&x<end;});
  const valid=rows.filter(o=>o.status!=='cancelled');
  const revenue=valid.reduce((s,o)=>s+(Number(o.total_amount)||0),0);
  const paid=valid.filter(o=>o.payment_status==='paid').reduce((s,o)=>s+(Number(o.total_amount)||0),0);
  const cost=valid.reduce((s,o)=>s+(Number(o.cost_amount)||0),0);
  const profit=Math.max(0,revenue-cost);
  const role=document.body.dataset.analyticsRole;
  const earnings=valid.reduce((s,o)=>s+earningFor(o, role==='manager' ? ANALYTICS_PROFILE?.commission_percent : profilePct(o.created_by_manager_id)),0);
  document.getElementById('a-orders').textContent=rows.length;
  document.getElementById('a-revenue').textContent=money(revenue);
  document.getElementById('a-paid').textContent=money(paid);
  document.getElementById('a-cost').textContent=money(cost);
  document.getElementById('a-profit').textContent=money(profit);
  document.getElementById('a-earnings').textContent=money(earnings);
  document.getElementById('earnings-label').textContent=role==='manager'?'Իմ հաշվարկված վաստակը':'Մենեջերների հաշվարկված վաստակ';
  renderTrend(valid,start,end,period); renderServices(valid); renderStatuses(rows); if(role==='admin') renderManagers(valid); else document.getElementById('manager-section').style.display='none';
}
function keyFor(d,p){ if(p==='daily') return d.toLocaleTimeString('hy-AM',{hour:'2-digit'})+':00'; if(p==='monthly') return d.toLocaleDateString('hy-AM',{day:'2-digit'}); if(p==='quarterly') return d.toLocaleDateString('hy-AM',{month:'short'}); return d.toLocaleDateString('hy-AM',{month:'short'}); }
function renderTrend(rows,start,end,period){
  const m=new Map(); rows.forEach(o=>{const k=keyFor(new Date(o.created_at),period); const v=m.get(k)||{n:0,r:0};v.n++;v.r+=Number(o.total_amount)||0;m.set(k,v)});
  const vals=[...m.values()].map(x=>x.r), max=Math.max(1,...vals);
  document.getElementById('trend').innerHTML=m.size?[...m.entries()].map(([k,v])=>`<div class="trend-row"><div>${k}</div><div class="trend-track"><span style="width:${Math.max(2,v.r/max*100)}%"></span></div><div class="mono">${money(v.r)} · ${v.n}</div></div>`).join(''):'<div class="empty-state">Այս ժամանակահատվածում տվյալ չկա</div>';
}
function renderServices(rows){ const m={}; rows.forEach(o=>{const k=o.service_name||o.service_key||'Այլ';m[k]??={n:0,r:0};m[k].n++;m[k].r+=Number(o.total_amount)||0}); document.getElementById('service-body').innerHTML=Object.entries(m).sort((a,b)=>b[1].r-a[1].r).map(([k,v])=>`<tr><td>${k}</td><td>${v.n}</td><td class="mono">${money(v.r)}</td></tr>`).join('')||'<tr><td colspan="3">Տվյալ չկա</td></tr>'; }
function renderStatuses(rows){ const m={}; rows.forEach(o=>m[o.status]=(m[o.status]||0)+1); document.getElementById('status-body').innerHTML=Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<tr><td>${typeof statusLabel==='function'?statusLabel(k):k}</td><td>${v}</td><td>${rows.length?Math.round(v/rows.length*100):0}%</td></tr>`).join('')||'<tr><td colspan="3">Տվյալ չկա</td></tr>'; }
function renderManagers(rows){ const m={}; rows.filter(o=>o.created_by_manager_id).forEach(o=>{const id=o.created_by_manager_id, p=ANALYTICS_PROFILES.find(x=>x.id===id);m[id]??={name:p?.full_name||'Մենեջեր',n:0,r:0,e:0};m[id].n++;m[id].r+=Number(o.total_amount)||0;m[id].e+=earningFor(o,p?.commission_percent)}); document.getElementById('manager-body').innerHTML=Object.values(m).sort((a,b)=>b.e-a.e).map(v=>`<tr><td>${v.name}</td><td>${v.n}</td><td class="mono">${money(v.r)}</td><td class="mono">${money(v.e)}</td></tr>`).join('')||'<tr><td colspan="4">Տվյալ չկա</td></tr>'; }


function safeFilePart(v){ return String(v||'report').replace(/[^a-zA-Z0-9\u0531-\u058F_-]+/g,'-').replace(/^-+|-+$/g,''); }
function analyticsCurrentRows(){
  const period=document.getElementById('period').value;
  const anchor=document.getElementById('anchor-date').value || new Date().toISOString().slice(0,10);
  const {start,end,label}=rangeFor(period,anchor);
  const rows=ANALYTICS_ORDERS.filter(o=>{const x=new Date(o.created_at);return x>=start&&x<end;});
  return {period,anchor,start,end,label,rows};
}
function managerName(id){ return ANALYTICS_PROFILES.find(p=>p.id===id)?.full_name || ''; }
function paymentLabel(v){
  const m={paid:'Վճարված',unpaid:'Չվճարված',partial:'Մասնակի վճարված',refunded:'Վերադարձված'};
  return m[v]||v||'—';
}
function orderStatusText(v){ return typeof statusLabel==='function' ? statusLabel(v) : (v||'—'); }
function serviceText(o){ return o.service_name||o.service_key||'Այլ'; }
function toExcelDate(v){ const d=v?new Date(v):null; return d && !isNaN(d) ? d : ''; }
function buildOrderRows(rows,role){
  return rows.map(o=>{
    const total=Number(o.total_amount)||0, cost=Number(o.cost_amount)||0;
    const profit=Math.max(0,total-cost);
    const pct=role==='manager' ? ANALYTICS_PROFILE?.commission_percent : profilePct(o.created_by_manager_id);
    return {
      number:o.order_number||o.id||'', date:toExcelDate(o.created_at), service:serviceText(o),
      customer:o.customer_name||'', phone:o.customer_phone||'', email:o.customer_email||'',
      status:orderStatusText(o.status), payment:paymentLabel(o.payment_status), total, cost, profit,
      manager:role==='manager'?(ANALYTICS_PROFILE?.full_name||''):managerName(o.created_by_manager_id),
      earning:earningFor(o,pct), note:o.notes||o.comment||o.description||''
    };
  });
}
function excelAvailable(){ return typeof ExcelJS!=='undefined'; }
function downloadBlob(blob,filename){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function styleWorksheet(ws, widths){
  ws.views=[{state:'frozen',ySplit:1}];
  ws.autoFilter={from:{row:1,column:1},to:{row:1,column:ws.columnCount}};
  const header=ws.getRow(1); header.height=26;
  header.eachCell(c=>{ c.font={bold:true,color:{argb:'FFFFFFFF'}}; c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1F2937'}}; c.alignment={vertical:'middle',horizontal:'center',wrapText:true}; c.border={bottom:{style:'thin',color:{argb:'FF9CA3AF'}}}; });
  widths.forEach((w,i)=>ws.getColumn(i+1).width=w);
  ws.eachRow((row,n)=>{ if(n>1){ row.height=21; row.eachCell(c=>{ c.alignment={vertical:'middle',wrapText:true}; c.border={bottom:{style:'hair',color:{argb:'FFE5E7EB'}}}; }); if(n%2===0) row.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF9FAFB'}}); }});
}
function addTitleSheet(wb,title,label,metrics){
  const ws=wb.addWorksheet('Ամփոփում',{properties:{tabColor:{argb:'FF2563EB'}}});
  ws.mergeCells('A1:D1'); ws.getCell('A1').value='GDprint — '+title; ws.getCell('A1').font={bold:true,size:18,color:{argb:'FFFFFFFF'}}; ws.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF111827'}}; ws.getCell('A1').alignment={vertical:'middle'}; ws.getRow(1).height=34;
  ws.mergeCells('A2:D2'); ws.getCell('A2').value='Ժամանակահատված՝ '+label; ws.getCell('A2').font={italic:true,color:{argb:'FF4B5563'}}; ws.getRow(2).height=24;
  ws.getCell('A4').value='Ցուցիչ'; ws.getCell('B4').value='Արժեք';
  const names=[['Պատվերների քանակ',metrics.orders],['Շրջանառություն',metrics.revenue],['Վճարված',metrics.paid],['Ծախս',metrics.cost],['Շահույթ',metrics.profit],['Մենեջերների վաստակ',metrics.earnings]];
  ws.getRange && null;
  names.forEach((x,i)=>{ws.getCell(5+i,1).value=x[0];ws.getCell(5+i,2).value=x[1];});
  ['A4','B4'].forEach(a=>{const c=ws.getCell(a);c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2563EB'}};c.alignment={horizontal:'center'};});
  ws.getColumn(1).width=30;ws.getColumn(2).width=22;ws.getColumn(2).numFmt='#,##0 "AMD"';ws.getCell('B5').numFmt='0';
  for(let r=5;r<=10;r++){ws.getRow(r).height=23;ws.getCell(r,1).border={bottom:{style:'thin',color:{argb:'FFE5E7EB'}}};ws.getCell(r,2).border={bottom:{style:'thin',color:{argb:'FFE5E7EB'}}};}
  ws.getCell('A12').value='Ստեղծվել է';ws.getCell('B12').value=new Date();ws.getCell('B12').numFmt='dd.mm.yyyy hh:mm';ws.getCell('A12').font={bold:true};
  return ws;
}
async function buildExcelReport(rows,label,role,filename,title){
  if(!excelAvailable()) throw new Error('Excel export library-ը չի բեռնվել։ Ստուգեք ինտերնետ կապը և փորձեք կրկին։');
  const wb=new ExcelJS.Workbook(); wb.creator='GDprint Admin'; wb.created=new Date(); wb.modified=new Date();
  const data=buildOrderRows(rows,role), valid=rows.filter(o=>o.status!=='cancelled');
  const revenue=valid.reduce((s,o)=>s+(Number(o.total_amount)||0),0),paid=valid.filter(o=>o.payment_status==='paid').reduce((s,o)=>s+(Number(o.total_amount)||0),0),cost=valid.reduce((s,o)=>s+(Number(o.cost_amount)||0),0),profit=Math.max(0,revenue-cost),earnings=valid.reduce((s,o)=>s+earningFor(o,role==='manager'?ANALYTICS_PROFILE?.commission_percent:profilePct(o.created_by_manager_id)),0);
  addTitleSheet(wb,title,label,{orders:rows.length,revenue,paid,cost,profit,earnings});
  const ws=wb.addWorksheet('Պատվերներ');
  ws.columns=[
    {header:'Պատվերի համար',key:'number'},{header:'Գրանցման ամսաթիվ',key:'date'},{header:'Ծառայություն',key:'service'},
    {header:'Հաճախորդ',key:'customer'},{header:'Հեռախոս',key:'phone'},{header:'Էլ. փոստ',key:'email'},
    {header:'Կարգավիճակ',key:'status'},{header:'Վճարման կարգավիճակ',key:'payment'},{header:'Ընդհանուր գին',key:'total'},
    {header:'Ծախս',key:'cost'},{header:'Շահույթ',key:'profit'},{header:'Մենեջեր',key:'manager'},{header:'Մենեջերի վաստակ',key:'earning'},{header:'Նշում',key:'note'}
  ];
  data.forEach(r=>ws.addRow(r)); styleWorksheet(ws,[18,20,25,24,18,26,18,21,16,16,16,22,20,32]);
  ws.getColumn('date').numFmt='dd.mm.yyyy hh:mm'; ['total','cost','profit','earning'].forEach(k=>ws.getColumn(k).numFmt='#,##0 "AMD"');
  const sm={};valid.forEach(o=>{const k=serviceText(o);sm[k]??={n:0,r:0};sm[k].n++;sm[k].r+=Number(o.total_amount)||0});
  const ss=wb.addWorksheet('Ծառայություններ');ss.columns=[{header:'Ծառայություն',key:'service'},{header:'Պատվերների քանակ',key:'count'},{header:'Շրջանառություն',key:'revenue'}];Object.entries(sm).sort((a,b)=>b[1].r-a[1].r).forEach(([k,v])=>ss.addRow({service:k,count:v.n,revenue:v.r}));styleWorksheet(ss,[35,20,22]);ss.getColumn('revenue').numFmt='#,##0 "AMD"';
  const stm={};rows.forEach(o=>stm[orderStatusText(o.status)]=(stm[orderStatusText(o.status)]||0)+1);const st=wb.addWorksheet('Կարգավիճակներ');st.columns=[{header:'Կարգավիճակ',key:'status'},{header:'Քանակ',key:'count'},{header:'Բաժին',key:'pct'}];Object.entries(stm).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>st.addRow({status:k,count:v,pct:rows.length?v/rows.length:0}));styleWorksheet(st,[30,15,15]);st.getColumn('pct').numFmt='0%';
  if(role==='admin'){
    const mm={};valid.filter(o=>o.created_by_manager_id).forEach(o=>{const id=o.created_by_manager_id,p=ANALYTICS_PROFILES.find(x=>x.id===id);mm[id]??={name:p?.full_name||'Մենեջեր',n:0,r:0,e:0};mm[id].n++;mm[id].r+=Number(o.total_amount)||0;mm[id].e+=earningFor(o,p?.commission_percent)});
    const ms=wb.addWorksheet('Մենեջերներ');ms.columns=[{header:'Մենեջեր',key:'name'},{header:'Պատվերների քանակ',key:'n'},{header:'Շրջանառություն',key:'r'},{header:'Վաստակ',key:'e'}];Object.values(mm).sort((a,b)=>b.e-a.e).forEach(v=>ms.addRow(v));styleWorksheet(ms,[30,20,22,22]);ms.getColumn('r').numFmt='#,##0 "AMD"';ms.getColumn('e').numFmt='#,##0 "AMD"';
  }
  const buffer=await wb.xlsx.writeBuffer();downloadBlob(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename);
}
async function exportAnalyticsReport(){
  const role=document.body.dataset.analyticsRole,{period,label,rows}=analyticsCurrentRows();
  try{await buildExcelReport(rows,label,role,`GDprint-${role==='admin'?'analytics':'manager-report'}-${period}-${safeFilePart(label)}.xlsx`,role==='admin'?'Ընդհանուր հաշվետվություն':'Մենեջերի հաշվետվություն');if(typeof toast==='function')toast(`Excel հաշվետվությունը պատրաստ է՝ ${rows.length} պատվեր`,'success');}catch(e){if(typeof toast==='function')toast(e.message||'Excel export-ի սխալ','error');}
}
async function exportFullBackup(){
  if(document.body.dataset.analyticsRole!=='admin')return;const rows=ANALYTICS_ORDERS||[];if(!rows.length){if(typeof toast==='function')toast('Backup-ի համար տվյալ չկա','error');return;}
  try{await buildExcelReport(rows,'Բոլոր պատվերները','admin',`GDprint-full-backup-${new Date().toISOString().slice(0,10)}.xlsx`,'Ամբողջական Backup');if(typeof toast==='function')toast(`Պրոֆեսիոնալ Excel backup-ը պատրաստ է՝ ${rows.length} պատվեր`,'success');}catch(e){if(typeof toast==='function')toast(e.message||'Backup-ի սխալ','error');}
}

(async function(){ const role=document.body.dataset.analyticsRole; const auth=await requireRole([role]); if(!auth)return; ANALYTICS_PROFILE=auth.profile; const q=[supabaseClient.from('orders').select('*').order('created_at',{ascending:false})]; if(role==='admin')q.push(supabaseClient.from('profiles').select('id,full_name,commission_percent').eq('role','manager')); const res=await Promise.all(q); if(res[0].error){toast('Analytics-ը չբեռնվեց՝ '+res[0].error.message,'error');return} ANALYTICS_ORDERS=res[0].data||[]; ANALYTICS_PROFILES=res[1]?.data||[]; document.getElementById('anchor-date').value=new Date().toISOString().slice(0,10); document.getElementById('period').addEventListener('change',renderAnalytics); document.getElementById('anchor-date').addEventListener('change',renderAnalytics); document.getElementById('export-report-xlsx')?.addEventListener('click',exportAnalyticsReport); document.getElementById('export-backup-xlsx')?.addEventListener('click',exportFullBackup); renderAnalytics(); })();
