import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
    const FROM_EMAIL = Deno.env.get("WELCOME_FROM_EMAIL") || "GDprint <noreply@example.com>";

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) throw new Error("Մուտքը հաստատված չէ");

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Սեսիան անվավեր է");

    const { data: actor, error: actorErr } = await adminClient
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", userData.user.id)
      .single();
    if (actorErr || actor?.role !== "admin") throw new Error("Այս գործողությունը հասանելի է միայն ադմինին");

    const body = await req.json();
    const managerId = String(body.manager_id || "");
    const action = String(body.action || "");
    if (!managerId || !["approved", "rejected"].includes(action)) throw new Error("Սխալ հարցում");

    const { data: manager, error: managerErr } = await adminClient
      .from("profiles")
      .select("id, role, full_name, email, approval_status")
      .eq("id", managerId)
      .eq("role", "manager")
      .single();
    if (managerErr || !manager) throw new Error("Մենեջերը չի գտնվել");

    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({ approval_status: action })
      .eq("id", managerId);
    if (updateErr) throw updateErr;

    await adminClient.from("notifications").insert({
      recipient_id: managerId,
      type: action === "approved" ? "manager_approved" : "manager_rejected",
      title: action === "approved" ? "Ձեր հաշիվը հաստատվել է" : "Գրանցման կարգավիճակ",
      message: action === "approved"
        ? "Բարի գալուստ GDprint։ Ձեր մենեջերի հաշիվը ակտիվ է, և այժմ կարող եք մուտք գործել։"
        : "Ձեր մենեջերի գրանցումը չի հաստատվել։ Լրացուցիչ տեղեկության համար կապվեք ադմինիստրատորի հետ։",
      link: action === "approved" ? "dashboard.html" : null,
    });

    let emailSent = false;
    let emailWarning = "";
    let recipientEmail = manager.email || "";
    if (!recipientEmail) {
      const { data: authManager } = await adminClient.auth.admin.getUserById(managerId);
      recipientEmail = authManager?.user?.email || "";
    }
    if (recipientEmail && RESEND_API_KEY) {
      const subject = action === "approved" ? "Բարի գալուստ GDprint" : "GDprint գրանցման կարգավիճակ";
      const html = action === "approved"
        ? `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;color:#171717"><h2>Բարի գալուստ GDprint${manager.full_name ? `, ${manager.full_name}` : ""} 👋</h2><p>Ձեր մենեջերի հաշիվը հաստատվել է ադմինիստրատորի կողմից։ Այժմ կարող եք մուտք գործել GDprint մենեջերի պանել և սկսել աշխատանքը։</p><p style="margin-top:24px">Հարգանքով՝<br><strong>GDprint</strong></p></div>`
        : `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:24px;color:#171717"><h2>GDprint գրանցման կարգավիճակ</h2><p>${manager.full_name ? `${manager.full_name}, ` : ""}ձեր մենեջերի գրանցումը չի հաստատվել։ Լրացուցիչ տեղեկության համար կապվեք GDprint ադմինիստրատորի հետ։</p></div>`;

      const mailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM_EMAIL, to: [recipientEmail], subject, html }),
      });
      emailSent = mailRes.ok;
      if (!mailRes.ok) emailWarning = await mailRes.text();
    } else if (!RESEND_API_KEY) {
      emailWarning = "RESEND_API_KEY secret-ը սահմանված չէ. հաշիվը հաստատվել է, բայց email չի ուղարկվել";
    } else if (!recipientEmail) {
      emailWarning = "Մենեջերի email-ը չի գտնվել. հաշիվը հաստատվել է, բայց email չի ուղարկվել";
    }

    await adminClient.from("activity_log").insert({
      actor_id: actor.id,
      action: `${action === "approved" ? "Հաստատեց" : "Մերժեց"} մենեջեր ${manager.full_name || manager.email || manager.id}`,
      target_table: "profiles",
      target_id: manager.id,
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify({ ok: true, status: action, email_sent: emailSent, email_warning: emailWarning }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
