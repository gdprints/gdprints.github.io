(function(){
  "use strict";
  const CFG={
    tshirt_printing:{minQty:1,base:4500,qty:"Քանակ",tiers:[[1,5500],[5,4800],[10,4500],[25,3900],[50,3400],[100,3000]],mods:{"Տեղադրում":{"Առջև":1,"Մեջք":1,"Առջև + մեջք":1.45,"Այլ":1.15}}},
    x_banner:{minQty:1,base:18000,qty:"Քանակ",tiers:[[1,18000],[5,16500],[10,15000]],mods:{"Կազմ":{"Տպագրություն + X-ստենդ":1,"Միայն տպագրություն":0.48,"Միայն ստենդ":0.58}}},
    self_adhesive_sticker:{minQty:100,base:30,qty:"Քանակ",tiers:[[100,55],[300,40],[500,30],[1000,23],[2000,18],[5000,14]],mods:{"Նյութ":{"Փայլուն":1,"Անփայլ":1.08,"Սպիտակ PVC":1.3,"Թափանցիկ PVC":1.45,"Այլ":1.2},"Կտրվածք":{"Ուղղանկյուն":1,"Կլոր":1.05,"Ֆիգուրային":1.22,"Այլ":1.15}}}
  };
  const fld=(f,n)=>f.querySelector(`[name="${CSS.escape(n)}"]`);
  const money=n=>Math.max(0,Math.round(n)).toLocaleString('hy-AM')+' AMD';
  function tier(tiers,q,base){let p=base;for(const [min,price] of tiers||[])if(q>=min)p=price;return p}
  function run(form){const key=form.dataset.serviceKey,c=CFG[key];if(!c)return;const qel=fld(form,c.qty);let q=parseInt(qel?.value||c.minQty,10);if(!Number.isFinite(q)||q<c.minQty){q=c.minQty;if(qel)qel.value=q}let unit=tier(c.tiers,q,c.base);for(const [name,map] of Object.entries(c.mods||{}))unit*=map[fld(form,name)?.value]||1;const total=q*unit;const out=form.querySelector('#gdPrice_'+key);if(out)out.textContent='Արժեքը: '+money(total);const hidden=form.querySelector('.gd-calculated-total');if(hidden)hidden.value=money(total)}
  function init(){document.querySelectorAll('form[data-market-calculator="1"]').forEach(f=>{if(!CFG[f.dataset.serviceKey])return;const go=()=>run(f);f.addEventListener('input',go);f.addEventListener('change',go);go()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
