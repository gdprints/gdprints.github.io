(function(){
  'use strict';

  const script = document.currentScript || Array.from(document.scripts).find(s => /pwa-install\.js(?:\?|$)/.test(s.src));
  if (!script) return;

  const adminBase = new URL('../../', script.src);
  const swUrl = new URL('sw.js', adminBase);
  let deferredPrompt = null;
  let modal = null;

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(swUrl.href, {scope: adminBase.pathname}).catch(err => console.warn('GDprint Admin SW:', err));
    });
  }

  function makeModal(){
    if (document.getElementById('gdAdminInstallModal')) return document.getElementById('gdAdminInstallModal');
    const root = document.createElement('div');
    root.id = 'gdAdminInstallModal';
    root.className = 'gd-pwa-install-modal';
    root.setAttribute('role','dialog');
    root.setAttribute('aria-modal','true');
    root.setAttribute('aria-labelledby','gdPwaTitle');
    root.innerHTML = `
      <div class="gd-pwa-install-card">
        <button type="button" class="gd-pwa-install-close" data-pwa-close aria-label="Փակել">×</button>
        <div class="gd-pwa-install-head">
          <img class="gd-pwa-install-icon" src="${new URL('icons/admin-192.png',adminBase).href}" alt="GDprint Admin">
          <div><div class="gd-pwa-install-kicker">GDprint Admin</div><h2 id="gdPwaTitle">Տեղադրել կառավարման վահանակը</h2></div>
        </div>
        <p>Տեղադրեք GDprint Admin-ը համակարգչի, հեռախոսի կամ պլանշետի էկրանին և բացեք այն սովորական հավելվածի նման՝ առանց հասցեն ամեն անգամ գրելու։</p>
        <div class="gd-pwa-install-points">
          <div class="gd-pwa-install-point">✓ Արագ մուտք մեկ սեղմումով</div>
          <div class="gd-pwa-install-point">✓ Առանձին հավելվածի պատուհան</div>
          <div class="gd-pwa-install-point">✓ Desktop / Mobile / Tablet</div>
          <div class="gd-pwa-install-point">✓ Նույն անվտանգ հաշիվը</div>
        </div>
        <div class="gd-pwa-install-actions">
          <button type="button" class="gd-pwa-install-btn gd-pwa-install-primary" data-pwa-install>Տեղադրել հիմա</button>
          <button type="button" class="gd-pwa-install-btn gd-pwa-install-secondary" data-pwa-close>Հետո</button>
        </div>
        <div class="gd-pwa-install-help" data-pwa-help></div>
      </div>`;
    document.body.appendChild(root);
    root.querySelectorAll('[data-pwa-close]').forEach(btn => btn.addEventListener('click', () => {
      root.classList.remove('is-open');
      sessionStorage.setItem('gd_admin_pwa_dismissed','1');
    }));
    root.addEventListener('click', e => { if(e.target === root){root.classList.remove('is-open'); sessionStorage.setItem('gd_admin_pwa_dismissed','1');} });
    root.querySelector('[data-pwa-install]').addEventListener('click', installApp);
    return root;
  }

  function fallbackHelp(){
    const help = modal.querySelector('[data-pwa-help]');
    const button = modal.querySelector('[data-pwa-install]');
    if (isIOS()) {
      help.innerHTML = 'iPhone/iPad-ում Safari-ն մեկ սեղմումով տեղադրում չի թույլատրում։ Սեղմեք <b>Share</b> → <b>Add to Home Screen</b> → <b>Add</b>։';
      button.textContent = 'Ինչպես տեղադրել';
    } else {
      help.innerHTML = 'Եթե տեղադրման պատուհանը չի հայտնվում, բացեք browser-ի մենյուն և ընտրեք <b>Install GDprint Admin</b> կամ <b>Add to Home screen</b>։ Chrome/Edge-ում տեղադրումը հասանելի է նաև հասցեի տողի install նշանից։';
      button.textContent = 'Տեղադրման տարբերակները';
    }
    help.classList.add('is-visible');
  }

  async function installApp(){
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') modal.classList.remove('is-open');
        else fallbackHelp();
      } catch (e) { fallbackHelp(); }
      return;
    }
    fallbackHelp();
  }

  function openModal(force){
    if (isStandalone()) return;
    if (!force && sessionStorage.getItem('gd_admin_pwa_dismissed') === '1') return;
    modal = modal || makeModal();
    modal.classList.add('is-open');
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (document.readyState === 'complete') setTimeout(() => openModal(false), 450);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (modal) modal.classList.remove('is-open');
    localStorage.setItem('gd_admin_pwa_installed','1');
  });

  document.addEventListener('DOMContentLoaded', () => {
    modal = makeModal();
    if (isStandalone()) return;
    // Show on entry even before browser install event is available; button will use native prompt when supported.
    setTimeout(() => openModal(false), 900);
  });

  window.GDAdminPWA = { openInstallModal: () => openModal(true) };
})();

/* === GDprint v5.1 Staff Web Push === */
(function(){
  function b64(s){const p='='.repeat((4-s.length%4)%4),raw=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')),a=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i);return a}
  async function enable(){
    if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw new Error('Այս սարքը Push ծանուցումներ չի աջակցում։');
    const {data:cfg,error:ce}=await supabaseClient.rpc('get_staff_push_public_config');if(ce)throw ce;if(!cfg?.vapid_public_key)throw new Error('Push public key-ը կարգավորված չէ։');
    const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Ծանուցումների թույլտվությունը չի տրվել։');
    const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(cfg.vapid_public_key)});
    const j=sub.toJSON();const {error}=await supabaseClient.rpc('save_staff_push_subscription',{p_endpoint:j.endpoint,p_p256dh:j.keys?.p256dh||'',p_auth:j.keys?.auth||'',p_user_agent:navigator.userAgent});if(error)throw error;
    localStorage.setItem('gd_staff_push_enabled','1');return true;
  }
  async function already(){if(!('serviceWorker'in navigator))return false;const r=await navigator.serviceWorker.ready;return !!(await r.pushManager?.getSubscription())}
  function modal(){
    if(document.getElementById('gdPushPrompt'))return;
    const x=document.createElement('div');x.id='gdPushPrompt';x.className='gd-pwa-install-modal';x.innerHTML=`<div class="gd-pwa-install-card"><button class="gd-pwa-install-close" data-x>×</button><div class="gd-pwa-install-head"><img class="gd-pwa-install-icon" src="${new URL('icons/admin-192.png',new URL('../../',document.querySelector('script[src*="pwa-install.js"]').src)).href}"><div><div class="gd-pwa-install-kicker">GDprint Notifications</div><h2>Միացնել իրական ծանուցումները</h2></div></div><p>Ստացեք նոր պատվերների, հաղորդագրությունների և կարևոր փոփոխությունների մասին ծանուցումներ հեռախոսի կամ համակարգչի վրա՝ նույնիսկ երբ GDprint Admin-ը փակ է։</p><div class="gd-pwa-install-actions"><button class="gd-pwa-install-btn gd-pwa-install-primary" data-on>Միացնել ծանուցումները</button><button class="gd-pwa-install-btn gd-pwa-install-secondary" data-x>Հետո</button></div><div class="gd-pwa-install-help" data-msg></div></div>`;document.body.appendChild(x);
    x.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{x.classList.remove('is-open');localStorage.setItem('gd_staff_push_asked','1')});
    x.querySelector('[data-on]').onclick=async e=>{e.currentTarget.disabled=true;try{await enable();x.classList.remove('is-open')}catch(err){const m=x.querySelector('[data-msg]');m.textContent=err.message||String(err);m.classList.add('is-visible');e.currentTarget.disabled=false}};
    return x;
  }
  window.GDStaffPush={enable};
  window.addEventListener('load',async()=>{try{const {data:{session}}=await supabaseClient.auth.getSession();if(!session||await already()||Notification.permission==='denied'||localStorage.getItem('gd_staff_push_asked'))return;setTimeout(()=>modal()?.classList.add('is-open'),2400)}catch(e){}});
})();
