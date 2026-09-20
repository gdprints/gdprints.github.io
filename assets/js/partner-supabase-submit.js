/* GDprint v7.5.5 — public partner registration -> Supabase + optional FormSubmit email */
(function(){
  "use strict";

  function lang(){
    const l=(document.documentElement.lang||"").toLowerCase();
    if(l.startsWith("ru")) return "ru";
    if(l.startsWith("en")) return "en";
    return "hy";
  }
  function t(hy,ru,en){ return lang()==="ru"?ru:(lang()==="en"?en:hy); }
  function val(form,name,id){
    return String(form.querySelector(`[name="${name}"]`)?.value ?? (id?document.getElementById(id)?.value:"") ?? "").trim();
  }
  function num(form,name,id){
    const n=Number(val(form,name,id)); return Number.isFinite(n)&&n>0?n:null;
  }
  function setBusy(btn,busy){
    if(!btn)return;
    if(busy){ btn.dataset.oldText=btn.textContent; btn.disabled=true; btn.textContent=t("Ուղարկվում է...","Отправка...","Sending..."); }
    else { btn.disabled=false; if(btn.dataset.oldText) btn.textContent=btn.dataset.oldText; }
  }
  function showSuccess(form){
    document.getElementById("partnerModalOverlay")?.classList.remove("active");
    document.getElementById("successModal")?.classList.add("active");
    form.reset();
    form.querySelectorAll(".plan-option.selected").forEach(x=>x.classList.remove("selected"));
    const hidden=form.querySelector('#selectedPlan,[name="plan"]'); if(hidden) hidden.value="";
  }
  async function sendEmailCopy(form){
    try{
      if(!form.action || !/^https:\/\/formsubmit\.co\//i.test(form.action)) return;
      const fd=new FormData(form);
      await fetch(form.action,{method:"POST",body:fd,headers:{Accept:"application/json"}});
    }catch(err){ console.warn("Partner email copy failed; Supabase record is already saved.",err); }
  }

  async function submitPartner(e){
    const form=e.target;
    if(!(form instanceof HTMLFormElement) || form.id!=="partnerRegistrationForm") return;

    // Capture-phase handler intentionally replaces old page-specific FormSubmit listeners.
    e.preventDefault();
    e.stopImmediatePropagation();

    if(!form.checkValidity()){ form.reportValidity(); return; }
    const terms=document.getElementById("agreeTerms");
    if(terms && !terms.checked){
      alert(t("Խնդրում ենք համաձայնվել պայմաններին։","Пожалуйста, согласитесь с условиями.","Please agree to the terms."));
      return;
    }
    const db = window.supabaseClient || (typeof supabaseClient !== "undefined" ? supabaseClient : null);
    if(!db){
      console.error("GDprint partner form: Supabase client is not initialized", {
        vendorLoaded: !!window.supabase,
        createClientAvailable: !!window.supabase?.createClient
      });
      alert(t("Տվյալների համակարգին կապը հասանելի չէ։ Խնդրում ենք թարմացնել էջը և փորձել կրկին։","Нет соединения с системой данных. Обновите страницу и повторите попытку.","The data connection is unavailable. Refresh the page and try again."));
      return;
    }

    const btn=form.querySelector('button[type="submit"],.submit-btn');
    setBusy(btn,true);

    const params={
      p_plan: val(form,"plan","selectedPlan"),
      p_first_name: val(form,"first_name","firstName"),
      p_last_name: val(form,"last_name","lastName"),
      p_phone: val(form,"phone","phone"),
      p_email: val(form,"email","email"),
      p_company: val(form,"company","companyName"),
      p_company_type: val(form,"company_type","companyType"),
      p_tin: val(form,"tin","tin"),
      p_address: val(form,"address","address"),
      p_expected_volume: num(form,"expected_volume","expectedVolume"),
      p_source: val(form,"source","hearAboutUs"),
      p_comments: val(form,"comments","comments"),
      p_language: lang()
    };

    try{
      const {data,error}=await db.rpc("submit_partner_application",params);
      if(error) throw error;
      if(!data) throw new Error("Application ID was not returned");

      // Save first; email notification is secondary and must never erase the DB success.
      sendEmailCopy(form);
      showSuccess(form);
    }catch(err){
      console.error("Partner application save failed",err);
      alert(t("Հայտը չի գրանցվել՝ ","Заявка не сохранена: ","Application was not saved: ")+(err?.message||""));
    }finally{
      setBusy(btn,false);
    }
  }

  // Capture phase makes this run before the old inline bubble listeners on HY/RU/EN pages.
  document.addEventListener("submit",submitPartner,true);
})();
