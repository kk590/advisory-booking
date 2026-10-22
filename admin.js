(function(){
  const ADMIN_PASS = "rkk-admin"; // change this
  const $ = s => document.querySelector(s);
  const tbody = $("#tbody");
  const resultCount = $("#resultCount");
  let remoteCache = [];
  let loadingRemote = false;

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
    try { return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY); }
    catch(e){ console.warn(e); return null; }
  }

  async function loadFromSupabase(){
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
      time: b.time || b.time_ist || "",
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
    if(s==="REJECTED"||s==="CANCELLED") cls = "rejected";
    return `<span class="badge ${cls}">${s}</span>`;
  }

  function escapeHtml(s){
    return String(s==null?"":s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function render(list){
    resultCount.textContent = list.length ? `(${list.length})` : "";
    if(!list.length){
      const hasSb = !!(window.SUPABASE_URL||"").trim() && !!(window.SUPABASE_ANON_KEY||"").trim();
      const hint = hasSb
        ? "No bookings yet. New bookings from the site are stored in Supabase and will appear here."
        : "No bookings in this browser. Set SUPABASE_URL and SUPABASE_ANON_KEY in supabase-config.js so bookings persist across devices.";
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
      const canAct = ["PENDING","UNVERIFIED"].includes(b.status);
      const actions = canAct
        ? `<button type="button" class="btn ok" data-act="confirm" data-i="${i}">✓ Confirm</button>
           <button type="button" class="btn danger" data-act="reject" data-i="${i}">✕ Reject</button>`
        : `<span style="color:var(--ok);font-size:11px">${escapeHtml(b.status)}</span>`;
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
      remoteCache = remoteCache.map(r => {
        if (row.txnId && String(r.txnId)===String(row.txnId)) {
          return Object.assign({}, r, { status, paymentStatus: status });
        }
        return r;
      });
    }catch(e){ console.warn(e); }

    $("#statusSnippet").textContent = JSON.stringify({
      txnId: row.txnId || undefined,
      id: row.bookingId || row.id || undefined,
      status: status,
      meetLink: row.meetLink || undefined
    }, null, 2);

    try{
      const sb = sbClient();
      if(sb && row.txnId){
        sb.from("bookings").update({ status: status, meet_link: row.meetLink || null }).eq("txn_id", String(row.txnId)).then(({error})=>{
          if(error) console.warn(error);
        });
      }
    }catch(_){}

    applyFilters();
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
        setCloudStatus("Cloud sync OFF — mobile bookings will not appear here. Put SUPABASE_URL and SUPABASE_ANON_KEY in supabase-config.js, then redeploy.", false);
      }
      const remote = await loadFromSupabase();
      if(remote === null){
        if(hasKeys) setCloudStatus("Cloud sync error — check Supabase URL, anon key, and RLS policies.", false);
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
