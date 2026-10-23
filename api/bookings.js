/**
 * Vercel Serverless API → Supabase
 * Env (Vercel Project Settings → Environment Variables):
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY=eyJ...   (or SUPABASE_SERVICE_ROLE_KEY for server-only)
 *
 * GET    /api/bookings              list (optional ?q= &status=)
 * GET    /api/bookings?txnId=...    one row
 * POST   /api/bookings              upsert booking
 * PATCH  /api/bookings              update by txn_id
 */
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function env() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return { url, key };
}

function headers(key) {
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function toRow(b) {
  return {
    txn_id: String(b.txnId || b.txn_id || ""),
    booking_id: b.bookingId || b.booking_id || b.id || null,
    name: b.name || null,
    email: b.email || null,
    phone: b.phone != null ? String(b.phone) : null,
    duration: b.duration != null ? Number(b.duration) : null,
    date: b.date || null,
    time: b.time || null,
    amount: b.amount != null ? Number(b.amount) : null,
    status: (b.status || "PENDING").toUpperCase(),
    upi_note: b.upiNote || b.upi_note || null,
    meet_link: b.meetLink || b.meet_link || null,
  };
}

function fromRow(r) {
  return {
    txnId: r.txn_id,
    bookingId: r.booking_id,
    id: r.booking_id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    duration: r.duration,
    date: r.date,
    time: r.time,
    amount: r.amount,
    status: r.status,
    upiNote: r.upi_note,
    meetLink: r.meet_link,
    at: r.created_at,
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  const { url, key } = env();
  if (!url || !key) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        ok: false,
        error: "missing_env",
        message:
          "Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Vercel → Project → Settings → Environment Variables, then redeploy.",
      })
    );
  }

  const base = url + "/rest/v1/bookings";

  try {
    if (req.method === "GET") {
      const q = (req.query && req.query.q) || "";
      const status = (req.query && req.query.status) || "";
      const txnId = (req.query && req.query.txnId) || "";
      let endpoint = base + "?select=*&order=created_at.desc&limit=500";
      if (txnId) {
        endpoint = base + "?txn_id=eq." + encodeURIComponent(txnId) + "&select=*";
      }
      const r = await fetch(endpoint, { headers: headers(key) });
      const text = await r.text();
      if (!r.ok) {
        res.statusCode = r.status;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ ok: false, error: text }));
      }
      let rows = JSON.parse(text || "[]");
      if (status) {
        rows = rows.filter((x) => String(x.status || "").toUpperCase() === String(status).toUpperCase());
      }
      if (q) {
        const qq = String(q).toLowerCase();
        rows = rows.filter((x) => {
          const blob = [x.name, x.email, x.phone, x.txn_id, x.booking_id, x.date, x.time]
            .map((v) => String(v || "").toLowerCase())
            .join(" ");
          return blob.includes(qq);
        });
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: true, bookings: rows.map(fromRow) }));
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (_) {
          body = {};
        }
      }
      const row = toRow(body || {});
      if (!row.txn_id) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ ok: false, error: "txn_id required" }));
      }
      const r = await fetch(base + "?on_conflict=txn_id", {
        method: "POST",
        headers: {
          ...headers(key),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(row),
      });
      const text = await r.text();
      if (!r.ok) {
        res.statusCode = r.status;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ ok: false, error: text }));
      }
      let saved = [];
      try {
        saved = JSON.parse(text || "[]");
      } catch (_) {}
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          ok: true,
          booking: saved[0] ? fromRow(saved[0]) : fromRow(row),
        })
      );
    }

    if (req.method === "PATCH") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch (_) {
          body = {};
        }
      }
      const txnId = body.txnId || body.txn_id;
      if (!txnId) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ ok: false, error: "txnId required" }));
      }
      const patch = {};
      const map = {
        status: "status",
        name: "name",
        email: "email",
        phone: "phone",
        date: "date",
        time: "time",
        duration: "duration",
        amount: "amount",
        meetLink: "meet_link",
        meet_link: "meet_link",
        bookingId: "booking_id",
        booking_id: "booking_id",
        upiNote: "upi_note",
        upi_note: "upi_note",
      };
      Object.keys(map).forEach((k) => {
        if (body[k] !== undefined && body[k] !== null) patch[map[k]] = body[k];
      });
      if (patch.status) patch.status = String(patch.status).toUpperCase();
      if (patch.duration != null) patch.duration = Number(patch.duration);
      if (patch.amount != null) patch.amount = Number(patch.amount);
      if (patch.phone != null) patch.phone = String(patch.phone);

      const r = await fetch(base + "?txn_id=eq." + encodeURIComponent(String(txnId)), {
        method: "PATCH",
        headers: headers(key),
        body: JSON.stringify(patch),
      });
      const text = await r.text();
      if (!r.ok) {
        res.statusCode = r.status;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ ok: false, error: text }));
      }
      let saved = [];
      try {
        saved = JSON.parse(text || "[]");
      } catch (_) {}
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          ok: true,
          booking: saved[0] ? fromRow(saved[0]) : null,
        })
      );
    }

    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }));
  }
};
