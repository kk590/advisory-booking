/**
 * GET /api/status?phone=...
 * Returns plain text: PAID | pending
 * Reads latest matching booking from Supabase.
 */
function env() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return { url, key };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  try {
    const { url, key } = env();
    if (!url || !key) {
      res.statusCode = 200;
      return res.end("pending");
    }

    const phoneRaw = ((req.query && req.query.phone) || "").toString();
    const digits = phoneRaw.replace(/\D/g, "").slice(-10);

    let endpoint = url + "/rest/v1/bookings?select=status,phone,created_at&order=created_at.desc&limit=20";
    const r = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
      },
    });
    const text = await r.text();
    if (!r.ok) {
      res.statusCode = 200;
      return res.end("pending");
    }
    let rows = [];
    try {
      rows = JSON.parse(text || "[]");
    } catch (_) {
      rows = [];
    }
    if (digits) {
      rows = rows.filter((x) => String(x.phone || "").replace(/\D/g, "").includes(digits));
    }
    const latest = rows[0];
    if (!latest) {
      res.statusCode = 200;
      return res.end("pending");
    }
    const st = String(latest.status || "").toUpperCase();
    res.statusCode = 200;
    return res.end(st === "PAID" ? "PAID" : "pending");
  } catch (e) {
    res.statusCode = 200;
    return res.end("pending");
  }
};
