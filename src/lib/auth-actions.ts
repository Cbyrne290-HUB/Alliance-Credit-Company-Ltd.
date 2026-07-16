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
 * Both rate-limit calls are wrapped so a failure (missing service-role
 * key, transient network error, RPC error) is always logged — never
 * silently discarded — while still failing open to the normal sign-in.
 * A previous version of record_login_attempt's call site didn't check
 * its `error` at all, which meant a failing write left zero trace
 * anywhere and the lockout counter silently never advanced.
 */
async function checkLockout(identifier: string): Promise<LockoutState | null> {
  try {
    const { data, error } = await getLoginRateLimitClient()
      .rpc("check_login_lockout", { p_identifier: identifier })
      .single();

    if (error) {
      console.error("[login-rate-limit] check_login_lockout failed:", error.message);
      return null;
    }
    return data as LockoutState;
  } catch (err) {
    console.error(
      "[login-rate-limit] could not reach rate limiter for lockout check:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function recordAttempt(
  identifier: string,
  success: boolean,
): Promise<AttemptState | null> {
  try {
    const { data, error } = await getLoginRateLimitClient()
      .rpc("record_login_attempt", { p_identifier: identifier, p_success: success })
      .single();

    if (error) {
      console.error("[login-rate-limit] record_login_attempt failed:", error.message);
      return null;
    }
    return data as AttemptState;
  } catch (err) {
    console.error(
      "[login-rate-limit] could not reach rate limiter to record attempt:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
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
 * already has Supabase's own IP rate limiting behind it. The failure is
 * still always logged (see checkLockout/recordAttempt above) so an
 * outage of the rate limiter itself is never silent.
 */
export async function signInAction(
  username: string,
  password: string,
): Promise<SignInResult> {
  const email = `${username.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;

  const lock = await checkLockout(email);
  if (lock?.locked) {
    return { ok: false, locked: true, secondsRemaining: secondsUntil(lock.locked_until) };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  const record = await recordAttempt(email, !signInError);

  if (signInError) {
    if (record?.locked) {
      return { ok: false, locked: true, secondsRemaining: secondsUntil(record.locked_until) };
    }
    return { ok: false, locked: false, error: "Invalid email or password. Please try again." };
  }

  return { ok: true };
}
