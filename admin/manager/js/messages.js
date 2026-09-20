/* ============================================================
   Manager Messages — DM admin/other managers, view-only broadcast
   ============================================================ */

let MY_ID = null;
let ACTIVE_CONV = null;
let CONVERSATIONS = [];

(async function init(){
  const auth = await requireRole(["manager"]);
  if (!auth) return;
  MY_ID = auth.session.user.id;
  document.getElementById("user-name").textContent = auth.profile.full_name || auth.session.user.email.split("@")[0];
  document.getElementById("user-avatar").textContent = initials(auth.profile.full_name || auth.session.user.email);

  await renderConvList();
  document.getElementById("msg-send-btn").addEventListener("click", sendCurrentMessage);
  document.getElementById("msg-input").addEventListener("keydown", (e) => { if (e.key === "Enter") sendCurrentMessage(); });

  subscribeToInternalMessages((payload) => {
    const m = payload.new;
    if (m.sender_id === MY_ID) return;
    if (ACTIVE_CONV && (m.sender_id === ACTIVE_CONV || m.recipient_id === MY_ID || (ACTIVE_CONV === BROADCAST_ID && !m.recipient_id))){
      openConversation(ACTIVE_CONV);
    } else {
      toast("💬 Նոր հաղորդագրություն", "info");
      renderConvList();
    }
  });
})();

async function renderConvList(){
  CONVERSATIONS = await loadConversationList(MY_ID);
  const el = document.getElementById("conv-list");
  el.innerHTML = CONVERSATIONS.map(c => `
    <div class="conv-item ${ACTIVE_CONV === c.id ? "active" : ""}" data-id="${c.id}">
      <div class="avatar" style="width:32px; height:32px; font-size:11px;">${c.id === BROADCAST_ID ? "📢" : initials(c.full_name)}</div>
      <span class="name">${c.full_name}${c.role === "admin" ? " · Ադմին" : c.role === "manager" ? " · Մենեջեր" : ""}</span>
      ${c.unread ? `<span class="nav-badge">${c.unread}</span>` : ""}
    </div>
  `).join("");
  el.querySelectorAll(".conv-item").forEach(item => item.addEventListener("click", () => openConversation(item.dataset.id)));
}

async function openConversation(otherId){
  ACTIVE_CONV = otherId;
  const conv = CONVERSATIONS.find(c => c.id === otherId);
  document.getElementById("active-conv-name").textContent = conv?.full_name || "—";
  renderConvList();

  // Managers can only READ the broadcast channel, not post to it.
  const inputRow = document.getElementById("msg-input-row");
  inputRow.style.display = otherId === BROADCAST_ID ? "none" : "flex";

  await markThreadRead(MY_ID, otherId);
  const messages = await loadMessages(MY_ID, otherId);
  document.getElementById("msg-scroll").innerHTML = renderMessageBubbles(messages, MY_ID);
  document.getElementById("msg-scroll").scrollTop = 999999;
}

async function sendCurrentMessage(){
  const input = document.getElementById("msg-input");
  const text = input.value.trim();
  if (!text || !ACTIVE_CONV || ACTIVE_CONV === BROADCAST_ID) return;

  const { error } = await sendInternalMessage(MY_ID, ACTIVE_CONV, text);
  if (error){ toast("Չհաջողվեց ուղարկել՝ " + error.message, "error"); return; }
  input.value = "";
  openConversation(ACTIVE_CONV);
}
