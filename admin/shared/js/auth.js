/* ============================================================
   GDprint Staff Auth v6.4 — login, staff registration, RBAC,
   password recovery, account state guards and role redirects.
   ============================================================ */

const GD_STAFF_ROLES = [
  "admin","manager","designer","digital_print","large_format","finishing",
  "quality_control","packing","courier","warehouse","finance","it_admin"
];

const GD_ROLE_LABELS = {
  admin:"Super Admin", manager:"Մենեջեր", designer:"Դիզայներ / Prepress",
  digital_print:"Թվային տպագրության օպերատոր", large_format:"Լայնաֆորմատ / Plotter օպերատոր",
  finishing:"Հետտպագրական աշխատակից", quality_control:"Որակի վերահսկում / QC", packing:"Փաթեթավորում", courier:"Առաքիչ",
  warehouse:"Պահեստապետ", finance:"Հաշվապահ / Finance", it_admin:"IT / System Admin"
};

function gdRoleHome(role){
  if(role === "admin") return "admin/dashboard.html";
  if(role === "manager") return "manager/dashboard.html";
  return "staff/dashboard.html";
}

async function getCurrentProfile(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;
  const { data: profile, error } = await supabaseClient
    .from("profiles").select("*").eq("id", session.user.id).single();
  if (error) return null;
  return { session, profile };
}

function pathToRoot(){
  const path = window.location.pathname;
  if (path.includes("/admin/") || path.includes("/manager/") || path.includes("/staff/")) return "../";
  return "";
}

function gdAccountError(profile){
  const status = profile?.account_status || "active";
  if(status === "blocked") return {code:"blocked",msg:"Ձեր հաշիվը արգելափակված է ադմինիստրատորի կողմից։"};
  if(status === "suspended") return {code:"suspended",msg:"Ձեր հաշիվը ժամանակավորապես կասեցված է։"};
  if(status === "disabled") return {code:"disabled",msg:"Ձեր հաշիվն անջատված է։"};
  if(status === "terminated") return {code:"terminated",msg:"Ձեր աշխատակցի հաշիվը փակված է։"};
  return null;
}

async function requireRole(allowedRoles){
  const result = await getCurrentProfile();
  if (!result){ window.location.href = pathToRoot() + "login.html"; return null; }
  const accountErr = gdAccountError(result.profile);
  if(accountErr){
    await supabaseClient.auth.signOut();
    window.location.href = pathToRoot() + "login.html?account=" + accountErr.code;
    return null;
  }
  if(result.profile.role !== "admin" && result.profile.approval_status !== "approved"){
    await supabaseClient.auth.signOut();
    const reason = result.profile.approval_status === "rejected" ? "rejected" : "pending";
    window.location.href = pathToRoot() + "login.html?approval=" + reason;
    return null;
  }
  if (!allowedRoles.includes(result.profile.role)){
    window.location.href = pathToRoot() + gdRoleHome(result.profile.role);
    return null;
  }
  return result;
}

async function requireStaff(){ return requireRole(GD_STAFF_ROLES); }

async function handleLogin(email, password){
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function handleRegisterStaff({ email, password, full_name, phone }){
  /* account_type stays "manager" for backward compatibility with the existing
     profile-creation trigger. The new ERP migration treats all new accounts as
     pending staff and Admin chooses the real role before approval. */
  const { data, error } = await supabaseClient.auth.signUp({
    email, password,
    options: { data: { account_type:"manager", registration_kind:"staff", full_name, phone } }
  });
  if (error) throw error;
  if (data.user && data.session){
    try { await supabaseClient.from("profiles").update({ phone }).eq("id", data.user.id); } catch(_){}
  }
  return data;
}

function gdPasswordResetRedirectUrl(){
  // Production recovery must never depend on Supabase's default Site URL.
  // Keep local development usable, but use the real GDprint URL in production.
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if(isLocal){
    return new URL("reset-password.html", window.location.href).href;
  }
  return "https://gdprint.am/admin/reset-password.html";
}

async function handleForgotPassword(email){
  const redirectTo = gdPasswordResetRedirectUrl();
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
  if(error) throw error;
}

async function handleLogout(){
  try{ await supabaseClient.rpc("log_staff_auth_event",{p_event_type:"logout",p_user_agent:navigator.userAgent}); }catch(_){}
  await supabaseClient.auth.signOut();
  window.location.href = pathToRoot() + "login.html";
}

function showAuthMessage(el, message, tone="error"){
  if(!el) return;
  el.textContent=message; el.style.display="block";
  el.style.color = tone === "ok" ? "var(--success)" : tone === "info" ? "var(--text-muted)" : "var(--danger)";
}

async function gdPrepareRecoveryPage(){
  if(!document.getElementById("reset-form")) return;
  const msg=document.getElementById("reset-message");

  // Supabase JS parses #access_token / #refresh_token automatically.
  // Give it a moment to persist the recovery session before allowing submit.
  for(let i=0;i<20;i++){
    const {data:{session}}=await supabaseClient.auth.getSession();
    if(session) return true;
    await new Promise(r=>setTimeout(r,100));
  }

  showAuthMessage(msg,"Վերականգնման հղումը անվավեր է կամ ժամկետանց։ Խնդրում ենք նոր հղում պահանջել։");
  const form=document.getElementById("reset-form");
  if(form){
    const btn=form.querySelector("button[type=submit]");
    if(btn) btn.disabled=true;
  }
  return false;
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm){
    const qs = new URLSearchParams(window.location.search);
    const errorEl = document.getElementById("login-error");
    const approval = qs.get("approval"), account=qs.get("account"), reset=qs.get("reset");
    if(approval) showAuthMessage(errorEl, approval === "rejected" ? "Ձեր գրանցումը մերժված է։ Կապվեք ադմինիստրատորի հետ։" : "Գրանցումը հաջող է։ Ձեր հաշիվը սպասում է տնօրենի հաստատմանը։", approval==="rejected"?"error":"info");
    if(account){
      const map={blocked:"Ձեր հաշիվը արգելափակված է։",suspended:"Ձեր հաշիվը ժամանակավորապես կասեցված է։",disabled:"Ձեր հաշիվն անջատված է։",terminated:"Ձեր աշխատակցի հաշիվը փակված է։"};
      showAuthMessage(errorEl,map[account]||"Հաշիվը հասանելի չէ։");
    }
    if(reset==="success") showAuthMessage(errorEl,"Գաղտնաբառը հաջողությամբ փոխվել է։ Կարող եք մուտք գործել։","ok");

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector("button[type=submit]");
      if(errorEl) errorEl.style.display="none";
      btn.disabled=true; btn.textContent="Մուտք...";
      try{
        await handleLogin(loginForm.email.value.trim(),loginForm.password.value);
        const result=await getCurrentProfile();
        if(!result) throw new Error("Հաշիվը գտնված է, բայց աշխատակցի profile-ը բացակայում է։");
        const accountErr=gdAccountError(result.profile);
        if(accountErr){ await supabaseClient.auth.signOut(); throw new Error(accountErr.msg); }
        if(result.profile.role!=="admin" && result.profile.approval_status!=="approved"){
          const s=result.profile.approval_status; await supabaseClient.auth.signOut();
          throw new Error(s==="rejected"?"Ձեր գրանցումը մերժված է։ Կապվեք ադմինիստրատորի հետ։":"Ձեր հաշիվը դեռ սպասում է տնօրենի հաստատմանը։");
        }
        try{await supabaseClient.rpc("log_staff_auth_event",{p_event_type:"login",p_user_agent:navigator.userAgent});}catch(_){}
        window.location.href=gdRoleHome(result.profile.role);
      }catch(err){ showAuthMessage(errorEl,err.message||"Անհայտ սխալ"); btn.disabled=false; btn.textContent="Մուտք գործել"; }
    });
  }

  const registerForm=document.getElementById("register-form");
  if(registerForm){
    registerForm.addEventListener("submit",async(e)=>{
      e.preventDefault(); const btn=registerForm.querySelector("button[type=submit]"); const errorEl=document.getElementById("register-error");
      if(errorEl) errorEl.style.display="none";
      if(registerForm.password.value!==registerForm.password_confirm.value){showAuthMessage(errorEl,"Գաղտնաբառերը չեն համընկնում");return;}
      if(registerForm.password.value.length<8){showAuthMessage(errorEl,"Գաղտնաբառը պետք է լինի առնվազն 8 նիշ");return;}
      btn.disabled=true;btn.textContent="Գրանցվում է...";
      try{
        await handleRegisterStaff({email:registerForm.email.value.trim(),password:registerForm.password.value,full_name:registerForm.full_name.value.trim(),phone:registerForm.phone.value.trim()});
        try{await supabaseClient.auth.signOut();}catch(_){}
        if(typeof toast==="function") toast("Գրանցումը հաջող է ✓ Սպասեք տնօրենի հաստատմանը","success");
        setTimeout(()=>window.location.href="login.html?approval=pending",1000);
      }catch(err){showAuthMessage(errorEl,err.message||"Գրանցումը չհաջողվեց");btn.disabled=false;btn.textContent="Գրանցվել";}
    });
  }

  const forgotForm=document.getElementById("forgot-form");
  if(forgotForm){
    forgotForm.addEventListener("submit",async(e)=>{
      e.preventDefault(); const btn=forgotForm.querySelector("button[type=submit]"); const msg=document.getElementById("forgot-message");
      btn.disabled=true; btn.textContent="Ուղարկվում է...";
      try{await handleForgotPassword(forgotForm.email.value.trim());showAuthMessage(msg,"Եթե տվյալ հասցեով հաշիվ կա, վերականգնման հղումն ուղարկված է։ Ստուգեք նաև Spam պանակը։","ok");forgotForm.reset();}
      catch(err){showAuthMessage(msg,err.message||"Չհաջողվեց ուղարկել հղումը");}
      finally{btn.disabled=false;btn.textContent="Ուղարկել վերականգնման հղումը";}
    });
  }

  const resetForm=document.getElementById("reset-form");
  if(resetForm){
    gdPrepareRecoveryPage();
    resetForm.addEventListener("submit",async(e)=>{
      e.preventDefault(); const btn=resetForm.querySelector("button[type=submit]"); const msg=document.getElementById("reset-message");
      const p=resetForm.password.value, c=resetForm.password_confirm.value;
      if(p!==c){showAuthMessage(msg,"Գաղտնաբառերը չեն համընկնում");return;}
      if(p.length<8){showAuthMessage(msg,"Գաղտնաբառը պետք է լինի առնվազն 8 նիշ");return;}
      btn.disabled=true;btn.textContent="Պահպանվում է...";
      try{
        const {error}=await supabaseClient.auth.updateUser({password:p}); if(error)throw error;
        try{await supabaseClient.rpc("log_staff_auth_event",{p_event_type:"password_reset",p_user_agent:navigator.userAgent});}catch(_){}
        await supabaseClient.auth.signOut(); window.location.href="login.html?reset=success";
      }catch(err){showAuthMessage(msg,err.message||"Չհաջողվեց փոխել գաղտնաբառը");btn.disabled=false;btn.textContent="Պահպանել նոր գաղտնաբառը";}
    });
  }

  document.querySelectorAll("[data-logout]").forEach(el=>el.addEventListener("click",e=>{e.preventDefault();handleLogout();}));
});
