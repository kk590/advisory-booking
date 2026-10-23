// Optional browser fallback. Prefer Vercel env for the API:
//   SUPABASE_URL
//   SUPABASE_ANON_KEY  (or SUPABASE_SERVICE_ROLE_KEY on the server only)
// Set those in Vercel → Project → Settings → Environment Variables → Production
// then Redeploy. Keys do not need to live in this file.
window.SUPABASE_URL = window.SUPABASE_URL || "";
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
