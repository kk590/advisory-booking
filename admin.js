(function(){
  const ADMIN_PASS = "rkk-admin"; // change this
  const $ = s => document.querySelector(s);
  const tbody = $("#tbody");
  const resultCount = $("#resultCount");
  let remoteCache = [];
  let loadingRemote = false;
  let editingTxn = null;

  function unlock(){
    const ok = sessionStorage.getItem("rkk_admin_ok") === "1";
    $("#gate").style.display = ok ? "none" : "block";
    $("#app").style.display = ok ? "block" : "none";
    $("#btnLogout").style.display = ok ? "inline-flex" : "none";
    if(ok) loadAll(true);
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

  function sbClient(){
    if(!window.supabase || !(window.SUPABASE_URL||"").trim() || !(window.SUPABASE_ANON_KEY||"").trim()) return null;
    try {
      return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    } catch(e){ console.warn(e); return null; }
  }

  async function apiBookings(method, body, query){
    const qs = query ? "?" + new URLSearchParams(query).toString() : "";
    const opts = { method, headers: { "Content-Type": "application/json" }, cache: "no-store" };
    if (body != null) opts.body = JSON.stringify(body);
    try {
      const res = await fetch("/api/bookings" + qs, opts);
      let data = null;
      try { data = await res.json(); } catch(_){}
      return { ok: res.ok && data && data.ok !== false, status: res.status, data };
    } catch(e) {
      return { ok: false, status: 0, data: { error: String(e) } };
    }
  }

  async function loadFromSupabase(){
    try{
      const { ok, data, status } = await apiBookings("GET");
      if(ok && data && Array.isArray(data.bookings)){
        return data.bookings;
      }
      if(status === 503) console.warn("[admin] API missing Vercel Supabase env");
    }catch(e){ console.warn("[admin] API list", e); }

    const sb = sbClient();
    if(!sb) return null;
    try{
      const { data, error } = await sb.from("bookings").select("*").order("created_at",{ascending:false}).limit(500);
      if(error){ console.warn("supabase", error); return null; }
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
      [...b, ...a, ...remoteCache].forEach(row => {
        const n = normalize(row);
        const key = n.txnId || n.bookingId || (n.phone + "|" + n.date + "|" + n.time);
        if (key) map.set(String(key), Object.assign({}, row, n));
      });
      return Array.from(map.values());
    } catch(_){ return remoteCache.slice(); }
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
      time: String(b.time || b.time_ist || "").replace(/\s*IST\s*/i,"").trim(),
      amount: b.amount != null ? b.amount : (b.amount_inr != null ? b.amount_inr : ""),
      status: String(b.status || b.paymentStatus || "PENDING").toUpperCase(),
      upiNote: b.upiNote || b.upi_note || "",
      meetLink: b.meetLink || b.meet_link || b.meet || "",
      at: b.at || b.created || b.created_at || ""
    };
  }

  function filterList(q, status){
    const qq = (q||"").trim().toLowerCase();
    let list = localBookings().map(normalize);
    if(status) list = list.filter(b => b.status === status);
    if(qq){
      list = list.filter(b =>
        b.phone.toLowerCase().includes(qq) ||
        b.email.toLowerCase().includes(qq) ||
        b.name.toLowerCase().includes(qq) ||
        String(b.txnId).includes(qq) ||
        String(b.bookingId).toLowerCase().includes(qq) ||
        String(b.date).includes(qq) ||
        String(b.time).includes(qq)
      );
    }
    list.sort((a,b) => String(b.at||b.txnId).localeCompare(String(a.at||a.txnId)));
    return list;
  }

  function badge(status){
    const s = (status||"PENDING").toUpperCase();
    let cls = "pending";
    if(s==="PAID"||s==="CONFIRMED"||s==="VERIFIED") cls = "paid";
    if(s==="REJECTED"||s==="CANCELLED") cls = "cancelled";
    return `<span class="badge ${cls}">${s}</span>`;
  }

  function escapeHtml(s){
    return String(s==null?"":s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function persistLocal(row){
    const list = localBookings();
    const idx = list.findIndex(b =>
      (row.txnId && String(b.txnId)===String(row.txnId)) ||
      (row.bookingId && (String(b.id)===String(row.bookingId)||String(b.bookingId)===String(row.bookingId)))
    );
    const merged = Object.assign({}, idx>=0 ? list[idx] : {}, row);
    if(idx>=0) list[idx] = merged; else list.push(merged);
    localStorage.setItem("bookings", JSON.stringify(list));
    try {
      const inbox = JSON.parse(localStorage.getItem("rkk_admin_inbox")||"[]");
      const i2 = inbox.findIndex(x => row.txnId && String(x.txnId)===String(row.txnId));
      if(i2>=0) inbox[i2] = Object.assign({}, inbox[i2], row);
      else inbox.unshift(row);
      localStorage.setItem("rkk_admin_inbox", JSON.stringify(inbox.slice(0,200)));
    } catch(_){}
    remoteCache = remoteCache.map(r => {
      if (row.txnId && String(r.txnId)===String(row.txnId)) return Object.assign({}, r, row);
      return r;
    });
    if (!remoteCache.some(r => row.txnId && String(r.txnId)===String(row.txnId))) {
      remoteCache.unshift(row);
    }
  }

  async function pushToSupabase(row){
    if(!row.txnId) return false;
    try{
      const { ok } = await apiBookings("PATCH", {
        txnId: row.txnId,
        status: row.status || "PENDING",
        name: row.name || null,
        email: row.email || null,
        phone: row.phone || null,
        date: row.date || null,
        time: row.time || null,
        duration: row.duration ? Number(row.duration) : null,
        meetLink: row.meetLink || null,
        bookingId: row.bookingId || row.id || null
      });
      if(ok) return true;
    }catch(_){}
    const sb = sbClient();
    if(!sb) return false;
    const patch = {
      status: row.status || "PENDING",
      name: row.name || null,
      email: row.email || null,
      phone: row.phone || null,
      date: row.date || null,
      time: row.time || null,
      duration: row.duration ? Number(row.duration) : null,
      meet_link: row.meetLink || null,
      booking_id: row.bookingId || row.id || null
    };
    try{
      const { error } = await sb.from("bookings").update(patch).eq("txn_id", String(row.txnId));
      if(error){ console.warn(error); return false; }
      return true;
    }catch(e){ console.warn(e); return false; }
  }

  function setStatus(row, status){
    const next = Object.assign({}, normalize(row), { status: status, paymentStatus: status });
    persistLocal(next);
    pushToSupabase(next);
    $("#statusSnippet").textContent = JSON.stringify({
      txnId: next.txnId || undefined,
      id: next.bookingId || next.id || undefined,
      status: status,
      date: next.date, time: next.time,
      meetLink: next.meetLink || undefined
    }, null, 2);
    applyFilters();
  }

  function openEdit(row){
    const b = normalize(row);
    editingTxn = b.txnId;
    $("#editTxnId").value = b.txnId || "";
    $("#editName").value = b.name || "";
    $("#editPhone").value = b.phone || "";
    $("#editEmail").value = b.email || "";
    $("#editMeet").value = b.meetLink || "";
    $("#editDate").value = b.date || "";
    let t = b.time || "";
    if(/^\d{1,2}:\d{2}/.test(t)) t = t.slice(0,5);
    $("#editTime").value = t;
    $("#editDuration").value = String(b.duration || 30);
    $("#editStatus").value = ["PENDING","CONFIRMED","CANCELLED","REJECTED"].includes(b.status) ? b.status : "PENDING";
    $("#editErr").textContent = "";
    $("#editPanel").classList.add("open");
    $("#editPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeEdit(){
    editingTxn = null;
    $("#editPanel").classList.remove("open");
    $("#editErr").textContent = "";
  }

  async function saveEdit(){
    const txnId = ($("#editTxnId").value || editingTxn || "").trim();
    if(!txnId){ $("#editErr").textContent = "Missing TxnId."; return; }
    const name = ($("#editName").value || "").trim();
    const phone = ($("#editPhone").value || "").replace(/\s+/g,"");
    const email = ($("#editEmail").value || "").trim();
    const date = ($("#editDate").value || "").trim();
    let time = ($("#editTime").value || "").trim();
    const duration = Number($("#editDuration").value) || 30;
    const status = ($("#editStatus").value || "PENDING").toUpperCase();
    const meetLink = ($("#editMeet").value || "").trim();
    if(!name){ $("#editErr").textContent = "Name is required."; return; }
    if(!phone){ $("#editErr").textContent = "Phone is required."; return; }
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ $("#editErr").textContent = "Invalid email."; return; }
    if(!date){ $("#editErr").textContent = "Date is required."; return; }
    if(!time){ $("#editErr").textContent = "Time is required."; return; }

    const existing = localBookings().map(normalize).find(b => String(b.txnId)===String(txnId)) || {};
    const next = Object.assign({}, existing, {
      txnId, name, phone, email, date, time, duration, status,
      paymentStatus: status, meetLink,
      bookingId: existing.bookingId || existing.id || "",
      amount: existing.amount
    });
    persistLocal(next);
    const ok = await pushToSupabase(next);
    $("#statusSnippet").textContent = JSON.stringify({
      action: "updated",
      txnId, name, phone, email, date, time, duration, status, meetLink,
      cloud: ok ? "saved" : "local-only (check Supabase keys / RLS)"
    }, null, 2);
    $("#editErr").textContent = ok ? "" : "Saved locally. Cloud update failed — check Supabase.";
    closeEdit();
    applyFilters();
  }

  function render(list){
    resultCount.textContent = list.length ? `(${list.length})` : "";
    if(!list.length){
      const hasSb = !!(window.SUPABASE_URL||"").trim() && !!(window.SUPABASE_ANON_KEY||"").trim();
      const hint = hasSb
        ? "No bookings yet. New bookings from the site are stored in Supabase and will appear here."
        : "No bookings yet. Set Vercel env SUPABASE_URL + SUPABASE_ANON_KEY (or supabase-config.js) so mobile bookings appear.";
      tbody.innerHTML = `<tr><td colspan="6" class="empty">${escapeHtml(hint)}</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((b,i) => {
      const timeLabel = b.time ? (String(b.time).includes("IST") ? b.time : b.time + " IST") : "—";
      const dur = b.duration ? b.duration + " min" : "—";
      const client = `
        <div style="line-height:1.55">
          <strong style="font-size:13px">${escapeHtml(b.name||"—")}</strong>
          <div style="color:var(--muted);margin-top:4px">Phone: <span style="color:var(--text)">${escapeHtml(b.phone||"—")}</span></div>
          <div style="color:var(--muted)">Email: <span style="color:var(--text);word-break:break-all">${escapeHtml(b.email||"—")}</span></div>
          <div style="color:var(--gold);font-size:11px;margin-top:6px">Date: ${escapeHtml(b.date||"—")}</div>
          <div style="color:var(--gold);font-size:11px">Time: ${escapeHtml(timeLabel)}</div>
          <div style="color:var(--muted);font-size:11px">Duration: ${escapeHtml(dur)}</div>
          ${b.meetLink
            ? `<div style="margin-top:6px"><a href="${escapeHtml(b.meetLink)}" target="_blank" rel="noopener" style="color:var(--primary);font-size:11px;word-break:break-all">Meet: ${escapeHtml(b.meetLink)}</a></div>`
            : `<div style="color:var(--muted);font-size:11px;margin-top:4px">Meet: —</div>`}
        </div>`;
      const txn = `<span class="mono">${escapeHtml(b.txnId||"—")}</span><br/><span style="color:var(--muted);font-size:10px">${escapeHtml(b.bookingId||"")}</span>`;
      const amt = b.amount !== "" && b.amount != null ? "₹"+Number(b.amount).toLocaleString("en-IN") : "—";
      const slot = [b.date||"", timeLabel, dur].filter(Boolean).join(" · ");
      const isClosed = ["CANCELLED","REJECTED"].includes(b.status);
      const canConfirm = ["PENDING","UNVERIFIED"].includes(b.status);
      let actions = `<button type="button" class="btn ghost" data-act="edit" data-i="${i}">Edit</button>`;
      if(canConfirm){
        actions += `<button type="button" class="btn ok" data-act="confirm" data-i="${i}">✓ Confirm</button>`;
      }
      if(!isClosed){
        actions += `<button type="button" class="btn warn" data-act="cancel" data-i="${i}">Cancel</button>`;
      }
      if(b.status === "PENDING"){
        actions += `<button type="button" class="btn danger" data-act="reject" data-i="${i}">✕ Reject</button>`;
      }
      if(isClosed){
        actions += `<span style="color:var(--muted);font-size:11px">${escapeHtml(b.status)}</span>`;
      }
      const trace = b.upiNote ? `<div class="trace" style="margin-top:6px">${escapeHtml(b.upiNote)}</div>` : "";
      return `<tr data-txn="${escapeHtml(b.txnId)}" data-id="${escapeHtml(b.bookingId)}">
        <td>${badge(b.status)}</td>
        <td>${txn}${trace}</td>
        <td>${client}</td>
        <td style="font-size:12px">${escapeHtml(slot||"—")}</td>
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
        if(act === "cancel"){
          if(confirm("Cancel this booking? The slot will be free for new clients.")){
            setStatus(row, "CANCELLED");
          }
        }
        if(act === "edit") openEdit(row);
      });
    });
  }

  function applyFilters(){
    const q = ($("#q").value||"").trim();
    const status = ($("#statusFilter").value||"").trim();
    render(filterList(q, status));
  }

  function setCloudStatus(msg, ok){
    let el = document.getElementById("cloudStatus");
    if(!el){
      el = document.createElement("div");
      el.id = "cloudStatus";
      el.style.cssText = "font-size:11px;padding:8px 12px;margin:8px 0;border:1px solid #333;color:#a1a1aa";
      const app = document.getElementById("app");
      if(app) app.insertBefore(el, app.firstChild);
    }
    el.textContent = msg;
    el.style.borderColor = ok ? "#6ee7b7" : "#D4AF37";
    el.style.color = ok ? "#6ee7b7" : "#F7E7CE";
  }
  async function loadAll(forceRemote){
    applyFilters();
    if(loadingRemote) return;
    loadingRemote = true;
    try{
      const hasKeys = !!(window.SUPABASE_URL||"").trim() && !!(window.SUPABASE_ANON_KEY||"").trim();
      if(!hasKeys){
        setCloudStatus("Cloud sync checking… Set SUPABASE_URL + SUPABASE_ANON_KEY in Vercel env (or supabase-config.js), run SQL schema, then redeploy.", false);
      }
      const remote = await loadFromSupabase();
      if(remote === null){
        if(hasKeys) setCloudStatus("Cloud sync error — check Supabase URL, anon key, RLS, or Vercel env on /api/bookings.", false);
        else {
          apiBookings("GET").then(({ok,status,data})=>{
            if(ok) setCloudStatus("Cloud sync ON via API — " + ((data&&data.bookings)||[]).length + " booking(s).", true);
            else if(status===503) setCloudStatus("Cloud sync OFF — add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables, then Redeploy.", false);
            else setCloudStatus("Cloud sync OFF — API status "+status+". Create bookings table (supabase-schema.sql) and set env keys.", false);
          });
        }
      } else {
        remoteCache = remote;
        setCloudStatus("Cloud sync ON — " + remote.length + " booking(s) from Supabase. Polling every 3s.", true);
        try{
          const local = JSON.parse(localStorage.getItem("bookings")||"[]");
          const map = new Map();
          [...local, ...remote].forEach(r => {
            const n = normalize(r);
            const k = n.txnId || n.bookingId;
            if(k) map.set(String(k), Object.assign({}, r, n));
          });
          localStorage.setItem("bookings", JSON.stringify(Array.from(map.values())));
        }catch(_){}
      }
      applyFilters();
    } finally {
      loadingRemote = false;
    }
  }

  function doSearch(){ applyFilters(); }

  $("#btnSearch").addEventListener("click", doSearch);
  $("#btnPending").addEventListener("click", () => {
    $("#statusFilter").value = "PENDING";
    $("#q").value = "";
    applyFilters();
  });
  const btnAll = $("#btnAll");
  if(btnAll) btnAll.addEventListener("click", () => {
    $("#statusFilter").value = "";
    $("#q").value = "";
    loadAll(true);
  });
  $("#statusFilter").addEventListener("change", applyFilters);
  $("#q").addEventListener("keydown", e => { if(e.key==="Enter") doSearch(); });
  $("#btnSaveEdit").addEventListener("click", saveEdit);
  $("#btnCloseEdit").addEventListener("click", closeEdit);

  window.addEventListener("storage", (ev) => {
    if (ev.key === "bookings" || ev.key === "rkk_admin_inbox" || ev.key === "rkk_admin_inbox_ts") {
      if (sessionStorage.getItem("rkk_admin_ok") === "1") applyFilters();
    }
  });
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel("rkk_bookings");
      ch.onmessage = () => {
        if (sessionStorage.getItem("rkk_admin_ok") === "1") loadAll(true);
      };
    }
  } catch (_) {}
  setInterval(() => {
    if (sessionStorage.getItem("rkk_admin_ok") === "1") loadAll(true);
  }, 3000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && sessionStorage.getItem("rkk_admin_ok") === "1") loadAll(true);
  });
  window.addEventListener("focus", () => {
    if (sessionStorage.getItem("rkk_admin_ok") === "1") loadAll(true);
  });

  unlock();
})();
