const GD_PRICE = {
  business_cards: d => {
    const q = Math.max(1000, parseInt(d.quantity || 0));
    return { amount: q * 8, normalized: {...d, quantity:q}, note:'Նվազագույնը՝ 1000 հատ, 8 AMD/հատ' };
  },
  photo_printing: d => {
    const rates={A4:400,A5:200,A6:100}; const size=d.size||'A4', q=Math.max(1,parseInt(d.quantity||1));
    return {amount:(rates[size]||400)*q,normalized:{...d,size,quantity:q}};
  },
  printable_forms: d => {
    const rate=d.print_type==='color'?50:30,q=Math.max(1,parseInt(d.quantity||1));
    return {amount:rate*q,normalized:{...d,print_type:d.print_type||'bw',quantity:q}};
  },
  cup_printing: d => {
    const q=Math.max(1,parseInt(d.quantity||1)),rate=q>50?1900:2000;
    return {amount:q*rate,normalized:{...d,quantity:q},note:rate+' AMD/հատ'};
  },
  poster_placement: d => {
    const sqm=Math.max(.1,Number(d.square_meters||.1)); return {amount:Math.round(sqm*4200),normalized:{...d,square_meters:sqm}};
  },
  rollup: d => {
    const rates={'60x160':10150,'80x200':16900,'85x200':18000,'100x200':21100,'120x200':25350,'150x200':31700};
    const size=d.size||'80x200',q=Math.max(1,parseInt(d.quantity||1)); return {amount:(rates[size]||0)*q,normalized:{...d,size,quantity:q}};
  },
  canvas: d => {
    const rates={'20x30':5460,'30x40':5850,'40x50':6370,'50x70':6890,'60x80':7410,'70x100':7930,'100x150':14820,'20x20':5670,'25x35':6100,'35x35':6620,'40x60':6620,'60x60':7700,'80x120':9180,'100x100':10400,'120x180':19700};
    const size=d.size||'30x40',q=Math.max(1,parseInt(d.quantity||1)); return {amount:(rates[size]||0)*q,normalized:{...d,size,quantity:q}};
  },
  flyer: d => {
    const rates={A4:300,A5:195,'A4 1/3':25}; const size=d.size||'A5',q=Math.max(2000,parseInt(d.quantity||2000));
    const wf=String(d.weight||'115').includes('170')?1.3:String(d.weight||'115').includes('150')?1.1:1;
    const tf=(d.paper_type||'Փայլուն')==='Անփայլ'?1:1.1;
    let discount=q>=1000?.15:q>=500?.10:q>=100?.05:0; const base=(rates[size]||0)*q*wf*tf;
    return {amount:Math.round(base*(1-discount)),normalized:{...d,size,quantity:q,weight:d.weight||'115գր կավճապատ',paper_type:d.paper_type||'Փայլուն'},note:discount?`Զեղչ՝ ${discount*100}%`:''};
  },
  wide_format: d => {
    const w=Math.max(.5,Number(d.width||.5)),h=Math.max(.5,Number(d.height||.5));
    const allowed=[4500,6000,8000,10000], rate=allowed.includes(Number(d.package_rate))?Number(d.package_rate):4500;
    const border=Number(d.border_cut||0)===100?100:0; const material=d.material||'Banner'; let amount=w*h*rate;
    if(border) amount+=2*(w+h)*border;
    let eyes=0;
    if(material==='Banner+ողակ'){
      const ew=Math.max(w-.024,0),eh=Math.max(h-.024,0); const auto=Math.floor(ew/.3)+2+Math.floor(eh/.3)+2;
      eyes=Math.max(8,parseInt(d.eyelet_count||auto)); amount+=eyes*100;
    }
    return {amount:Math.round(amount),normalized:{...d,width:w,height:h,package_rate:rate,border_cut:border,material,eyelet_count:eyes}};
  },
  plotter_cutting: d => ({amount:0,normalized:{...d,quote_required:true},contractual:true,note:'Գինը՝ պայմանագրային'}),
  calendar: d => ({amount:0,normalized:{...d,quote_required:true},contractual:true,note:'Գինը՝ պայմանագրային'})
};
function gdCalculatePrice(key,details){ return (GD_PRICE[key]||(()=>({amount:0,normalized:details,contractual:true})))(details||{}); }
