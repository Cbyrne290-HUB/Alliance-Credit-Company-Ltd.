import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Standalone scripts don't get Next.js's automatic .env.local loading, so
// load it explicitly. Safe to call from any script in this directory.
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    [
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
      "",
      "Add the service role key from:",
      "  Supabase Dashboard > Project Settings > API > Project API keys > service_role",
      "",
      "This key bypasses Row Level Security entirely — it must only ever live in",
      ".env.local (already gitignored), never in client code, never committed.",
    ].join("\n"),
  );
  process.exit(1);
}

/**
 * Admin client for one-off local scripts only (seeding/cleaning test data).
 * Uses the service role key, which bypasses RLS by design — that's exactly
 * why this must never be imported from anything the Next.js app serves.
 */
export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
