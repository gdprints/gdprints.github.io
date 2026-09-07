/* ============================================================
   Admin Messages — DM any manager, or broadcast to everyone
   ============================================================ */

let MY_ID = null;
let ACTIVE_CONV = null;       // either a profile id (DM with me) or BROADCAST_ID
let ACTIVE_PAIR = null;       // { a, b } when observing a conversation NOT involving me
let CONVERSATIONS = [];
let PEOPLE_BY_ID = {};

(async function init(){
  const auth = await requireRole(["admin"]);
  if (!auth) return;
  MY_ID = auth.session.user.id;
  document.getElementById("user-name").textContent = auth.profile.full_name || auth.session.user.email.split("@")[0];
  document.getElementById("user-avatar").textContent = initials(auth.profile.full_name || auth.session.user.email);

  await renderConvList();
  document.getElementById("msg-send-btn").addEventListener("click", sendCurrentMessage);
  document.getElementById("msg-input").addEventListener("keydown", (e) => { if (e.key === "Enter") sendCurrentMessage(); });

  // Live updates: new messages appear instantly, in whichever
  // conversation (or observed pair) is currently open.
  subscribeToInternalMessages((payload) => {
    const m = payload.new;
    if (m.sender_id === MY_ID) return; // our own send already renders locally
    if (ACTIVE_PAIR && (m.sender_id === ACTIVE_PAIR.a || m.sender_id === ACTIVE_PAIR.b)){
      openPairConversation(ACTIVE_PAIR.a, ACTIVE_PAIR.b);
    } else if (ACTIVE_CONV && (m.sender_id === ACTIVE_CONV || m.recipient_id === ACTIVE_CONV || (ACTIVE_CONV === BROADCAST_ID && !m.recipient_id))){
      openConversation(ACTIVE_CONV);
    } else {
      toast("💬 Նոր հաղորդագրություն", "info");
      renderConvList();
    }
  });
})();

async function renderConvList(){
  CONVERSATIONS = await loadConversationList(MY_ID);
  CONVERSATIONS.forEach(c => { PEOPLE_BY_ID[c.id] = c; });
  PEOPLE_BY_ID[MY_ID] = { full_name: "Դուք (Ադմին)" };

  const myThreads = CONVERSATIONS.map(c => `
    <div class="conv-item ${!ACTIVE_PAIR && ACTIVE_CONV === c.id ? "active" : ""}" data-mode="mine" data-id="${c.id}">
      <div class="avatar" style="width:32px; height:32px; font-size:11px;">${c.id === BROADCAST_ID ? "📢" : initials(c.full_name)}</div>
      <span class="name">${c.full_name}${c.role === "manager" ? " · Մենեջեր" : ""}</span>
      ${c.unread ? `<span class="nav-badge">${c.unread}</span>` : ""}
    </div>
  `).join("");

  // Other people's conversations — this is the admin-oversight view,
  // e.g. two managers talking to each other with no admin involvement.
  const otherPairs = (await loadAllConversationPairs(PEOPLE_BY_ID)).filter(p => p.a !== MY_ID && p.b !== MY_ID);
  const otherThreadsHtml = otherPairs.length
    ? `<div class="nav-section-title" style="padding:14px 12px 6px;">Այլ նամակագրություններ</div>` +
      otherPairs.map(p => `
        <div class="conv-item ${ACTIVE_PAIR?.a === p.a && ACTIVE_PAIR?.b === p.b ? "active" : ""}" data-mode="pair" data-a="${p.a}" data-b="${p.b}">
          <div class="avatar" style="width:32px; height:32px; font-size:10px;">👀</div>
          <span class="name">${p.aName} ↔ ${p.bName}</span>
        </div>
      `).join("")
    : "";

  const el = document.getElementById("conv-list");
  el.innerHTML = myThreads + otherThreadsHtml;

  el.querySelectorAll('[data-mode="mine"]').forEach(item => item.addEventListener("click", () => openConversation(item.dataset.id)));
  el.querySelectorAll('[data-mode="pair"]').forEach(item => item.addEventListener("click", () => openPairConversation(item.dataset.a, item.dataset.b)));
}

async function openConversation(otherId){
  ACTIVE_CONV = otherId;
  ACTIVE_PAIR = null;
  const conv = CONVERSATIONS.find(c => c.id === otherId);
  document.getElementById("active-conv-name").textContent = conv?.full_name || "—";
  document.getElementById("msg-input-row").style.display = "flex";
  renderConvList();

  await markThreadRead(MY_ID, otherId);
  const messages = await loadMessages(MY_ID, otherId);
  document.getElementById("msg-scroll").innerHTML = renderMessageBubbles(messages, MY_ID);
  document.getElementById("msg-scroll").scrollTop = 999999;
}

/* Admin observing a conversation between two OTHER people —
   read-only, the admin isn't a participant so can't reply inline here. */
async function openPairConversation(a, b){
  ACTIVE_PAIR = { a, b };
  ACTIVE_CONV = null;
  document.getElementById("active-conv-name").textContent = `👀 ${PEOPLE_BY_ID[a]?.full_name || "—"} ↔ ${PEOPLE_BY_ID[b]?.full_name || "—"} (դիտում)`;
  document.getElementById("msg-input-row").style.display = "none";
  renderConvList();

  const messages = await loadMessagesBetween(a, b);
  document.getElementById("msg-scroll").innerHTML = renderMessageBubbles(messages, a); // align "a" bubbles right, arbitrary but consistent
  document.getElementById("msg-scroll").scrollTop = 999999;
}

async function sendCurrentMessage(){
  const input = document.getElementById("msg-input");
  const text = input.value.trim();
  if (!text || !ACTIVE_CONV) return;

  const { error } = await sendInternalMessage(MY_ID, ACTIVE_CONV, text);
  if (error){ toast("Չհաջողվեց ուղարկել՝ " + error.message, "error"); return; }
  input.value = "";
  openConversation(ACTIVE_CONV);
}
