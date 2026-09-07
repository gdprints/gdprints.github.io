/* ============================================================
   Activity Log — who did what, when
   ============================================================ */

(async function init(){
  const auth = await requireRole(["admin"]);
  if (!auth) return;
  document.getElementById("user-name").textContent = auth.profile.full_name || auth.session.user.email.split("@")[0];
  document.getElementById("user-avatar").textContent = initials(auth.profile.full_name || auth.session.user.email);

  const { data, error } = await supabaseClient
    .from("activity_log")
    .select("*, actor:actor_id(full_name, role)")
    .order("created_at", { ascending: false })
    .limit(200);

  const body = document.getElementById("log-body");
  if (error){
    body.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:40px;">Չհաջողվեց բեռնել՝ ${error.message}</td></tr>`;
    return;
  }
  if (!data?.length){
    body.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:40px;">Դեռ գործողություններ չկան</td></tr>`;
    return;
  }

  document.getElementById("log-count-sub").textContent = `${data.length} գործողություն (վերջին 200)`;
  body.innerHTML = data.map(row => `
    <tr>
      <td>
        <div class="cell-customer"><div class="avatar">${initials(row.actor?.full_name)}</div><span>${row.actor?.full_name || "—"}${row.actor?.role === "admin" ? " (Ադմին)" : ""}</span></div>
      </td>
      <td>${row.action}</td>
      <td class="mono" style="color:var(--text-muted);">${timeAgo(row.created_at)}</td>
    </tr>
  `).join("");
})();
