/* ============================================================
   Auth — login (role-based redirect), manager registration, guards
   ============================================================ */

async function getCurrentProfile(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;
  const { data: profile, error } = await supabaseClient
    .from("profiles").select("*").eq("id", session.user.id).single();
  if (error) return null;
  return { session, profile };
}

/* Call at the top of every protected page.
   allowedRoles: array like ["admin"] or ["admin","manager"] */
async function requireRole(allowedRoles){
  const result = await getCurrentProfile();
  if (!result){
    window.location.href = pathToRoot() + "login.html";
    return null;
  }
  if (!allowedRoles.includes(result.profile.role)){
    // Logged in, but wrong section — send them to their own home.
    window.location.href = pathToRoot() + (result.profile.role === "admin" ? "admin/dashboard.html" : "manager/dashboard.html");
    return null;
  }
  // A newly registered manager must be approved by an admin before any
  // protected manager page can be opened. Existing installations are
  // migrated to approval_status='approved' by 002_manager_approval_notifications.sql.
  if (result.profile.role === "manager" && result.profile.account_status === "blocked"){
    await supabaseClient.auth.signOut();
    window.location.href = pathToRoot() + "login.html?approval=blocked";
    return null;
  }
  if (result.profile.role === "manager" && result.profile.approval_status !== "approved"){
    await supabaseClient.auth.signOut();
    const reason = result.profile.approval_status === "rejected" ? "rejected" : "pending";
    window.location.href = pathToRoot() + "login.html?approval=" + reason;
    return null;
  }
  return result;
}

/* Figures out the relative path back to the project root, so guards
   work the same whether the page lives in /admin/, /manager/, or root. */
function pathToRoot(){
  const path = window.location.pathname;
  if (path.includes("/admin/") || path.includes("/manager/")) return "../";
  return "";
}

async function handleLogin(email, password){
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function handleRegisterManager({ email, password, full_name, phone }){
  const { data, error } = await supabaseClient.auth.signUp({
    email, password,
    options: { data: { account_type: 'manager', full_name, phone } }
  });
  if (error) throw error;
  // The DB trigger creates the profiles row automatically with role='manager'.
  // Fill in the phone number as a follow-up update once the row exists.
  if (data.user){
    await supabaseClient.from("profiles").update({ phone }).eq("id", data.user.id);
  }
  return data;
}

async function handleLogout(){
  await supabaseClient.auth.signOut();
  window.location.href = pathToRoot() + "login.html";
}

document.addEventListener("DOMContentLoaded", () => {
  // ---------- Login form ----------
  const loginForm = document.getElementById("login-form");
  if (loginForm){
    const approval = new URLSearchParams(window.location.search).get("approval");
    const errorEl = document.getElementById("login-error");
    if (approval && errorEl){
      errorEl.textContent = approval === "rejected"
        ? "Ձեր մենեջերի գրանցումը չի հաստատվել։ Կապվեք ադմինիստրատորի հետ։"
        : approval === "blocked" ? "Ձեր հաշիվը արգելափակված է ադմինիստրատորի կողմից։"
        : "Գրանցումը հաջող է։ Ձեր հաշիվը սպասում է ադմինի հաստատմանը։";
      errorEl.style.display = "block";
      errorEl.style.color = approval === "rejected" ? "var(--danger)" : "var(--text-muted)";
    }
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector("button[type=submit]");
      const errorEl = document.getElementById("login-error");
      errorEl.style.display = "none";
      btn.disabled = true;
      btn.innerHTML = '<span class="reg-mark"></span> Մուտք...';

      try {
        await handleLogin(loginForm.email.value.trim(), loginForm.password.value);
        const result = await getCurrentProfile();
        if (!result) throw new Error("Հաշիվը գտնված է, բայց profile տող չկա 'profiles' աղյուսակում");
        if (result.profile.role === "manager" && result.profile.account_status === "blocked") {
          await supabaseClient.auth.signOut();
          throw new Error("Ձեր հաշիվը արգելափակված է ադմինիստրատորի կողմից։");
        }
        if (result.profile.role === "manager" && result.profile.approval_status !== "approved") {
          const status = result.profile.approval_status;
          await supabaseClient.auth.signOut();
          throw new Error(status === "rejected"
            ? "Ձեր մենեջերի գրանցումը չի հաստատվել։ Կապվեք ադմինիստրատորի հետ։"
            : "Ձեր մենեջերի հաշիվը դեռ սպասում է ադմինի հաստատմանը։");
        }
        window.location.href = result.profile.role === "admin" ? "admin/dashboard.html" : "manager/dashboard.html";
      } catch (err) {
        console.error("Login error:", err);
        errorEl.textContent = err.message || "Անհայտ սխալ";
        errorEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Մուտք գործել";
      }
    });
  }

  // ---------- Registration form (managers only) ----------
  const registerForm = document.getElementById("register-form");
  if (registerForm){
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = registerForm.querySelector("button[type=submit]");
      const errorEl = document.getElementById("register-error");
      errorEl.style.display = "none";

      if (registerForm.password.value !== registerForm.password_confirm.value){
        errorEl.textContent = "Գաղտնաբառերը չեն համընկնում";
        errorEl.style.display = "block";
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="reg-mark"></span> Գրանցվում է...';

      try {
        await handleRegisterManager({
          email: registerForm.email.value.trim(),
          password: registerForm.password.value,
          full_name: registerForm.full_name.value.trim(),
          phone: registerForm.phone.value.trim(),
        });
        // Manager accounts stay pending until an administrator approves them.
        await supabaseClient.auth.signOut();
        toast("Գրանցումը հաջող է ✓ Սպասեք ադմինի հաստատմանը", "success");
        setTimeout(() => { window.location.href = "login.html?approval=pending"; }, 1500);
      } catch (err) {
        console.error("Register error:", err);
        errorEl.textContent = err.message || "Անհայտ սխալ";
        errorEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Գրանցվել";
      }
    });
  }

  document.querySelectorAll("[data-logout]").forEach(el => el.addEventListener("click", handleLogout));
});
