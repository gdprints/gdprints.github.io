/* Extracted from admin/manager/new-order.html — GDprint v8.0 */
document.addEventListener("DOMContentLoaded", async () => {
  const auth = await requireRole(["manager"]);
  if (!auth) return;
  const name = auth.profile?.full_name || "Մենեջեր";
  const un = document.getElementById("user-name"), av = document.getElementById("user-avatar");
  if (un) un.textContent = name;
  if (av) av.textContent = name.charAt(0).toUpperCase();
});
