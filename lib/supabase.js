import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses the service-role key, so this module must NEVER be
// imported into a "use client" component.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
