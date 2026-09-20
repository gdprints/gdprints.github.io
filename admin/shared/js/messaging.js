/* ============================================================
   messaging.js — shared between admin/messages.html and
   manager/messages.html. Conversations are either:
     - a DM between two specific staff members (recipient_id set)
     - a broadcast from admin to everyone (recipient_id = null)
   BROADCAST_ID is a client-side-only sentinel (never written to
   the DB) used to represent the broadcast "conversation" in the
   sidebar list, alongside real profile ids for DMs.
   ============================================================ */

const BROADCAST_ID = "broadcast";

async function loadConversationList(myId){
  const { data: people, error } = await supabaseClient
    .from("profiles").select("*").neq("id", myId).order("full_name");
  if (error){ console.error(error); return []; }

  const { data: unreadRows } = await supabaseClient
    .from("internal_messages").select("sender_id").eq("recipient_id", myId).eq("read", false);
  const unreadBySender = {};
  (unreadRows || []).forEach(r => { unreadBySender[r.sender_id] = (unreadBySender[r.sender_id] || 0) + 1; });

  const { count: broadcastUnread } = await supabaseClient
    .from("internal_messages").select("*", { count: "exact", head: true }).is("recipient_id", null);

  return [
    { id: BROADCAST_ID, full_name: "📢 Ընդհանուր հայտարարություններ", role: "broadcast", unread: 0 },
    ...people.map(p => ({ ...p, unread: unreadBySender[p.id] || 0 })),
  ];
}

async function loadMessages(myId, otherId){
  if (otherId === BROADCAST_ID){
    const { data, error } = await supabaseClient
      .from("internal_messages").select("*, sender:sender_id(full_name)")
      .is("recipient_id", null).order("created_at", { ascending: true });
    if (error) console.error(error);
    return data || [];
  }
  return loadMessagesBetween(myId, otherId);
}

/* Works for ANY two people, not just "me" — used by the admin view
   to open a manager<->manager conversation that doesn't involve
   the admin at all (RLS already lets admin read every row; this
   just removes the "myId" assumption from the query itself). */
async function loadMessagesBetween(idA, idB){
  const { data, error } = await supabaseClient
    .from("internal_messages").select("*, sender:sender_id(full_name)")
    .or(`and(sender_id.eq.${idA},recipient_id.eq.${idB}),and(sender_id.eq.${idB},recipient_id.eq.${idA})`)
    .order("created_at", { ascending: true });
  if (error) console.error(error);
  return data || [];
}

/* Admin-only: every distinct pair of people who have exchanged DMs,
   INCLUDING pairs that don't involve the admin at all (e.g. two
   managers talking to each other). Broadcasts are excluded here
   since they're already shown as their own channel. */
async function loadAllConversationPairs(peopleById){
  const { data, error } = await supabaseClient
    .from("internal_messages").select("sender_id, recipient_id, created_at")
    .not("recipient_id", "is", null);
  if (error){ console.error(error); return []; }

  const pairs = new Map();
  (data || []).forEach(m => {
    const key = [m.sender_id, m.recipient_id].sort().join("_");
    const existing = pairs.get(key);
    if (!existing || new Date(m.created_at) > new Date(existing.lastAt)){
      pairs.set(key, { a: m.sender_id, b: m.recipient_id, lastAt: m.created_at });
    }
  });

  return Array.from(pairs.values())
    .map(p => ({ ...p, aName: peopleById[p.a]?.full_name || "—", bName: peopleById[p.b]?.full_name || "—" }))
    .sort((x, y) => new Date(y.lastAt) - new Date(x.lastAt));
}

async function sendInternalMessage(myId, otherId, text){
  const row = {
    sender_id: myId,
    recipient_id: otherId === BROADCAST_ID ? null : otherId,
    thread_id: otherId === BROADCAST_ID ? myId : (myId < otherId ? myId : otherId), // grouping hint only, not used for querying
    message: text,
  };
  return supabaseClient.from("internal_messages").insert(row);
}

async function markThreadRead(myId, otherId){
  if (otherId === BROADCAST_ID) return; // broadcasts have no per-recipient read tracking in this simple version
  await supabaseClient.from("internal_messages").update({ read: true }).eq("recipient_id", myId).eq("sender_id", otherId).eq("read", false);
}

function renderMessageBubbles(messages, myId){
  if (!messages.length) return `<div style="text-align:center; color:var(--text-muted); font-size:13px; padding:30px;">Դեռ հաղորդագրություններ չկան</div>`;
  return messages.map(m => {
    const mine = m.sender_id === myId;
    return `
      <div style="display:flex; ${mine ? "justify-content:flex-end;" : ""} margin-bottom:10px;">
        <div style="max-width:70%; padding:10px 14px; border-radius:14px; ${mine ? "background:linear-gradient(135deg, var(--ink-cyan), #0090ab); color:#fff;" : "background:var(--surface-solid); border:1px solid var(--border);"}">
          ${!mine ? `<div style="font-size:11px; opacity:.75; margin-bottom:3px; font-weight:600;">${m.sender?.full_name || "—"}</div>` : ""}
          <div style="font-size:13.5px;">${m.message}</div>
          <div style="font-size:10.5px; opacity:.7; margin-top:4px; font-family:var(--font-mono);">${timeAgo(m.created_at)}</div>
        </div>
      </div>`;
  }).join("");
}
