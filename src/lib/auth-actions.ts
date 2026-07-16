"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getLoginRateLimitClient } from "@/lib/supabase/rate-limit-client";
import { AGENT_COOKIE } from "@/lib/agent-context";

/**
 * Clears the Supabase session cookies and the active_agent cookie so a
 * shared device lands on a clean login screen for the next user.
 */
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(AGENT_COOKIE);
}

const LOGIN_EMAIL_DOMAIN = "alliance.local";

export type SignInResult =
  | { ok: true }
  | { ok: false; locked: true; secondsRemaining: number }
  | { ok: false; locked: false; error: string };

type LockoutState = { locked: boolean; locked_until: string | null };
type AttemptState = {
  locked: boolean;
  locked_until: string | null;
  attempts_remaining: number;
};

function secondsUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

/**
 * Runs the whole check -> sign-in -> record sequence in one atomic
 * server call, so a client can never split it apart or skip the
 * recording step the way it could if the browser called Supabase Auth
 * directly. Lockout state lives in public.login_attempts (see
 * login-rate-limit-setup.sql), reachable only via the service role —
 * not anon, not authenticated — so nobody holding just the public anon
 * key can read, reset, or forge entries in it.
 *
 * If the rate-limit check itself errors (e.g. misconfiguration), this
 * fails open to the normal sign-in rather than locking every admin out
 * of the app — availability over defense-in-depth for a control that
 * already has Supabase's own IP rate limiting behind it.
 */
export async function signInAction(
  username: string,
  password: string,
): Promise<SignInResult> {
  const email = `${username.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;
  const rateLimiter = getLoginRateLimitClient();

  const { data: lockData, error: lockError } = await rateLimiter
    .rpc("check_login_lockout", { p_identifier: email })
    .single();

  if (!lockError) {
    const lock = lockData as LockoutState;
    if (lock.locked) {
      return { ok: false, locked: true, secondsRemaining: secondsUntil(lock.locked_until) };
    }
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  const { data: recordData } = await rateLimiter
    .rpc("record_login_attempt", { p_identifier: email, p_success: !signInError })
    .single();

  if (signInError) {
    const record = recordData as AttemptState | null;
    if (record?.locked) {
      return { ok: false, locked: true, secondsRemaining: secondsUntil(record.locked_until) };
    }
    return { ok: false, locked: false, error: "Invalid email or password. Please try again." };
  }

  return { ok: true };
}
