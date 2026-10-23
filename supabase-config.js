/**
 * Optional browser keys (anon is public by design).
 * Preferred: set the same names in Vercel → Project → Settings → Environment Variables
 *   SUPABASE_URL=https://YOUR_PROJECT.supabase.co
 *   SUPABASE_ANON_KEY=eyJ...
 * then Redeploy. The /api/bookings route uses those env vars (no keys needed here).
 *
 * If you paste keys below, the browser SDK also works as a fallback.
 */
window.SUPABASE_URL = window.SUPABASE_URL || "";
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";
// Example:
// window.SUPABASE_URL = "https://xxxx.supabase.co";
// window.SUPABASE_ANON_KEY = "eyJhbGciOi...";
