(function(){
  const ADMIN_PASS = "rkk-admin"; // change this
  const $ = s => document.querySelector(s);
  const tbody = $("#tbody");
  const resultCount = $("#resultCount");

  function unlock(){
    const ok = sessionStorage.getItem("rkk_admin_ok") === "1";
    $("#gate").style.display = ok ? "none" : "block";
    $("#app").style.display = ok ? "block" : "none";
    $("#btnLogout").style.display = ok ? "inline-flex" : "none";
    if(ok) loadPending();
  }

  $("#btnUnlock").addEventListener("click", () => {
    const v = ($("#passInput").value || "").trim();
    if(v === ADMIN_PASS){
      sessionStorage.setItem("rkk_admin_ok","1");
      $("#gateErr").textContent = "";
      unlock();
    } else {
      $("#gateErr").textContent = "Wrong passcode.";
    }
  });
  $("#passInput").addEventListener("keydown", e => { if(e.key==="Enter") $("#btnUnlock").click(); });
  $("#btnLogout").addEventListener("click", () => {
    sessionStorage.removeItem("rkk_admin_ok");
    unlock();
  });

  async function loadFromSupabase(){
    try{
      if(!window.supabase || !(window.SUPABASE_URL||"").trim() || !(window.SUPABASE_ANON_KEY||"").trim()) return null;
      const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      const { data, error } = await sb.from("bookings").select("*").order("created_at",{ascending:false}).limit(200);
      if(error){ console.warn(error); return null; }
      return (data||[]).map(r => ({
        txnId: r.txn_id, id: r.booking_id, bookingId: r.booking_id,
        name: r.name, email: r.email, phone: r.phone, duration: r.duration,
        date: r.date, time: r.time, amount: r.amount, status: r.status,
        upiNote: r.upi_note, meetLink: r.meet_link, at: r.created_at
      }));
    }catch(e){ console.warn(e); return null; }
  }

  function localBookings(){
    try {
      const a = JSON.parse(localStorage.getItem("bookings")||"[]");
      const b = JSON.parse(localStorage.getItem("rkk_admin_inbox")||"[]");
      const map = new Map();
      [...b, ...a].forEach(row => {
        const n = normalize(row);
        const key = n.txnId || n.bookingId || (n.phone + n.date + n.time);
        if (key) map.set(key, row);
      });
      return Array.from(map.values());
    } catch(_){ return []; }
  }

  function normalize(b){
    return {
      txnId: b.txnId || b.txn_id || "",
      id: b.id || b.bookingId || b.booking_id || "",
      bookingId: b.bookingId || b.booking_id || b.id || "",
      name: b.name || "",
      email: b.email || "",
      phone: String(b.phone || ""),
      duration: b.duration || b.duration_min || "",
      date: b.date || "",
      time: b.time || b.time_ist || "",
      amount: b.amount || b.amount_inr || "",
      status: String(b.status || b.paymentStatus || "PENDING").toUpperCase(),
      upiNote: b.upiNote || b.upi_note || "",
      meetLink: b.meetLink || b.meet_link || b.meet || "",
      at: b.at || b.created || ""
    };
  }

  function filterLocal(q, status){
    const qq = (q||"").trim().toLowerCase();
    let list = localBookings().map(normalize);
    if(status) list = list.filter(b => b.status === status);
    if(qq){
      list = list.filter(b =>
        b.phone.toLowerCase().includes(qq) ||
        b.email.toLowerCase().includes(qq) ||
        b.name.toLowerCase().includes(qq) ||
        String(b.txnId).includes(qq) ||
        String(b.bookingId).toLowerCase().includes(qq)
      );
    }
    list.sort((a,b) => String(b.at||b.txnId).localeCompare(String(a.at||a.txnId)));
    return list;
  }

  function badge(status){
    const s = (status||"PENDING").toUpperCase();
    let cls = "pending";
    if(s==="PAID"||s==="CONFIRMED"||s==="VERIFIED") cls = "paid";
    if(s==="REJECTED"||s==="CANCELLED") cls = "rejected";
    return `<span class="badge ${cls}">${s}</span>`;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
  }

  function render(list){
    resultCount.textContent = list.length ? `(${list.length})` : "";
    if(!list.length){
      tbody.innerHTML = `<tr><td colspan="6" class="empty">No bookings found.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((b,i) => {
      const slot = [b.date, b.time ? b.time + (String(b.time).includes("IST")?"":" IST") : "", b.duration ? b.duration+" min" : ""].filter(Boolean).join(" · ");
      const meet = b.meetLink ? `<div style="margin-top:6px"><a href="${escapeHtml(b.meetLink)}" target="_blank" rel="noopener" style="color:var(--primary);word-break:break-all">${escapeHtml(b.meetLink)}</a></div>` : "";
      const timeLabel = b.time ? (String(b.time).includes("IST") ? b.time : b.time + " IST") : "-";
      const client = `<strong>${escapeHtml(b.name||"-")}</strong><br/><span style="color:var(--muted)">${escapeHtml(b.phone)}</span><br/><span style="color:var(--muted)">${escapeHtml(b.email)}</span><br/><span style="color:var(--gold);font-size:11px;margin-top:4px;display:inline-block">Date: ${escapeHtml(b.date||"-")}</span><br/><span style="color:var(--gold);font-size:11px">Time: ${escapeHtml(timeLabel)}</span>${b.meetLink ? `<br/><a href="${escapeHtml(b.meetLink)}" target="_blank" rel="noopener" style="color:var(--primary);font-size:11px;word-break:break-all">Meet: ${escapeHtml(b.meetLink)}</a>` : `<br/><span style="color:var(--muted);font-size:11px">Meet: -</span>`}`;
      const txn = `<span class="mono">${escapeHtml(b.txnId||"-")}</span><br/><span style="color:var(--muted);font-size:10px">${escapeHtml(b.bookingId||"")}</span>`;
      const amt = b.amount !== "" && b.amount != null ? "₹"+Number(b.amount).toLocaleString("en-IN") : "-";
      const canAct = ["PENDING","UNVERIFIED"].includes(b.status);
      const actions = canAct
        ? `<button type="button" class="btn ok" data-act="confirm" data-i="${i}">Confirm</button>
           <button type="button" class="btn danger" data-act="reject" data-i="${i}">Reject</button>`
        : `<span style="color:var(--muted);font-size:11px">-</span>`;
      const trace = b.upiNote ? `<div class="trace" style="margin-top:6px">${escapeHtml(b.upiNote)}</div>` : "";
      return `<tr data-txn="${escapeHtml(b.txnId)}" data-id="${escapeHtml(b.bookingId)}">
        <td>${badge(b.status)}</td>
        <td>${txn}${trace}</td>
        <td>${client}</td>
        <td>${escapeHtml(slot||"-")}${meet}</td>
        <td class="mono">${amt}</td>
        <td><div class="actions">${actions}</div></td>
      </tr>`;
    }).join("");

    window.__adminList = list;

    tbody.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = +btn.dataset.i;
        const act = btn.dataset.act;
        const row = window.__adminList[i];
        if(!row) return;
        if(act === "confirm") setStatus(row, "CONFIRMED");
        if(act === "reject") setStatus(row, "REJECTED");
      });
    });
  }

  function setStatus(row, status){
    try{
      const list = localBookings();
      const idx = list.findIndex(b =>
        (row.txnId && String(b.txnId)===String(row.txnId)) ||
        (row.bookingId && (String(b.id)===String(row.bookingId)||String(b.bookingId)===String(row.bookingId)))
      );
      if(idx>=0){
        list[idx].status = status;
        list[idx].paymentStatus = status;
        if (row.meetLink) list[idx].meetLink = row.meetLink;
        localStorage.setItem("bookings", JSON.stringify(list));
        try {
          const inbox = JSON.parse(localStorage.getItem("rkk_admin_inbox")||"[]").map(x => {
            if ((row.txnId && String(x.txnId)===String(row.txnId)) || (row.bookingId && String(x.bookingId||x.id)===String(row.bookingId))) {
              x.status = status; x.paymentStatus = status;
              if (row.meetLink) x.meetLink = row.meetLink;
            }
            return x;
          });
          localStorage.setItem("rkk_admin_inbox", JSON.stringify(inbox));
        } catch(_){}
      } else {
        row.status = status;
        row.paymentStatus = status;
        list.push(row);
        localStorage.setItem("bookings", JSON.stringify(list));
      }
    }catch(e){ console.warn(e); }

    $("#statusSnippet").textContent = JSON.stringify({
      txnId: row.txnId || undefined,
      id: row.bookingId || row.id || undefined,
      status: status === "CONFIRMED" ? "CONFIRMED" : status,
      meetLink: row.meetLink || undefined
    }, null, 2);

    try{
      if(window.supabase && (window.SUPABASE_URL||"").trim() && (window.SUPABASE_ANON_KEY||"").trim() && row.txnId){
        const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        sb.from("bookings").update({ status: status, meet_link: row.meetLink || null }).eq("txn_id", String(row.txnId)).then(()=>{});
      }
    }catch(_){}

    loadPending();
  }

  function loadPending(){
    const q = ($("#q").value||"").trim();
    const status = $("#statusFilter").value || "PENDING";
    render(filterLocal(q, status === "PENDING" ? "PENDING" : status));
    loadFromSupabase().then(remote => {
      if(!remote || !remote.length) return;
      try{
        const local = JSON.parse(localStorage.getItem("bookings")||"[]");
        const map = new Map();
        [...local, ...remote].forEach(r => {
          const k = r.txnId || r.bookingId;
          if(k) map.set(String(k), r);
        });
        localStorage.setItem("bookings", JSON.stringify(Array.from(map.values())));
      }catch(_){}
      render(filterLocal(q, status === "PENDING" ? "PENDING" : status));
    });
  }

  function doSearch(){
    const q = ($("#q").value||"").trim();
    const status = $("#statusFilter").value;
    render(filterLocal(q, status));
  }

  $("#btnSearch").addEventListener("click", doSearch);
  $("#btnPending").addEventListener("click", () => {
    $("#statusFilter").value = "PENDING";
    $("#q").value = "";
    loadPending();
  });
  $("#q").addEventListener("keydown", e => { if(e.key==="Enter") doSearch(); });

  window.addEventListener("storage", (ev) => {
    if (ev.key === "bookings" || ev.key === "rkk_admin_inbox" || ev.key === "rkk_admin_inbox_ts") {
      if (sessionStorage.getItem("rkk_admin_ok") === "1") loadPending();
    }
  });
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel("rkk_bookings");
      ch.onmessage = () => {
        if (sessionStorage.getItem("rkk_admin_ok") === "1") loadPending();
      };
    }
  } catch (_) {}
  setInterval(() => {
    if (sessionStorage.getItem("rkk_admin_ok") === "1") loadPending();
  }, 3000);

  unlock();
})();
