import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Service-role client used only for the two login-rate-limit RPCs
 * (check_login_lockout / record_login_attempt — see
 * login-rate-limit-setup.sql). Deliberately bypasses RLS: the lockout
 * counter must be readable/writable by trusted server code but never by
 * a client holding just the public anon key, otherwise an attacker
 * could call record_login_attempt directly to reset their own counter
 * mid-brute-force, or to lock out a legitimate account, without ever
 * attempting a real password.
 *
 * Only ever imported from the "use server" signInAction in
 * src/lib/auth-actions.ts, and only ever used to call those two RPCs —
 * never for general table access. Never imported by client code, and
 * the key itself is never sent to the browser.
 */
export function getLoginRateLimitClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — required for login rate limiting.",
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}
