-- ============================================================
-- Login rate limiting — brute-force protection for admin sign-in
--
-- Tracks failed sign-in attempts per identifier (the login email, e.g.
-- "jsmith@alliance.local") and imposes a temporary cooldown after too
-- many failures in a row.
--
-- This is in addition to, not a replacement for, Supabase Auth's own
-- IP-based rate limiting on the /auth/v1/token endpoint (Dashboard >
-- Authentication > Rate Limits) — that's the backstop against someone
-- bypassing this app's login page entirely and calling Supabase Auth
-- directly with the public anon key. This table/these functions are
-- what give a legitimate user a clear "try again in N minutes" message
-- and what stops repeated guesses against one specific account through
-- the app's own login form.
--
-- Deliberately NOT anon/authenticated-callable. Both functions are
-- SECURITY DEFINER and granted only to service_role. Letting the anon
-- role call record_login_attempt directly would let an attacker either
-- reset their own counter mid-brute-force (call it with
-- p_success = true) or permanently lock out a legitimate account (call
-- it with p_success = false on a loop) — neither requires a real
-- password, since anon can call any function it's granted regardless of
-- who's actually signing in. The Next.js server action that drives
-- login (signInAction, in src/lib/auth-actions.ts) is the only caller,
-- using the service-role key — never shipped to the browser, never
-- imported by client code. Run this in the Supabase SQL editor.
-- ============================================================

create table if not exists public.login_attempts (
  identifier text primary key,
  failed_count int not null default 0,
  locked_until timestamptz,
  last_attempt_at timestamptz not null default now()
);

alter table public.login_attempts enable row level security;
-- No policies created, on purpose: RLS on + zero policies denies all
-- direct access via PostgREST for every client-facing role. The table
-- is only ever touched from inside the SECURITY DEFINER functions
-- below (which run with the function owner's privilege, bypassing
-- RLS) — never as a raw table through the REST API.

revoke all on public.login_attempts from anon, authenticated;

-- ------------------------------------------------------------
-- check_login_lockout — read-only pre-check, called before attempting
-- a real sign-in so a locked-out identifier never even reaches
-- Supabase Auth.
-- ------------------------------------------------------------
create or replace function public.check_login_lockout(p_identifier text)
returns table(locked boolean, locked_until timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select
    (la.locked_until is not null and la.locked_until > now()) as locked,
    la.locked_until
  from (select lower(btrim(p_identifier)) as identifier) req
  left join public.login_attempts la using (identifier);
$$;

revoke all on function public.check_login_lockout(text) from public, anon, authenticated;
grant execute on function public.check_login_lockout(text) to service_role;

-- ------------------------------------------------------------
-- record_login_attempt — called once per real sign-in attempt, with
-- whatever Supabase Auth actually returned. Locks the row for the
-- duration of the call (SELECT ... FOR UPDATE) so concurrent attempts
-- against the same identifier can't race past the threshold.
--
-- If the identifier has no prior row, or its previous lockout window
-- has fully expired, a failure starts a fresh count of 1 rather than
-- continuing to climb — so one stray typo right after a 15-minute
-- cooldown doesn't instantly re-lock the account for another 15
-- minutes. A real brute-force still never gets more than 5 guesses per
-- 15-minute window, indefinitely.
-- ------------------------------------------------------------
create or replace function public.record_login_attempt(p_identifier text, p_success boolean)
returns table(locked boolean, locked_until timestamptz, attempts_remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_attempts constant int := 5;
  v_lockout_duration constant interval := interval '15 minutes';
  v_identifier text := lower(btrim(p_identifier));
  v_existing public.login_attempts%rowtype;
  v_new_count int;
  v_new_locked_until timestamptz;
begin
  select * into v_existing
  from public.login_attempts
  where identifier = v_identifier
  for update;

  if p_success then
    v_new_count := 0;
    v_new_locked_until := null;
  else
    if v_existing.identifier is null
       or (v_existing.locked_until is not null and v_existing.locked_until <= now())
    then
      v_new_count := 1;
    else
      v_new_count := v_existing.failed_count + 1;
    end if;

    v_new_locked_until := case
      when v_new_count >= v_max_attempts then now() + v_lockout_duration
      else null
    end;
  end if;

  insert into public.login_attempts (identifier, failed_count, locked_until, last_attempt_at)
  values (v_identifier, v_new_count, v_new_locked_until, now())
  on conflict (identifier) do update
    set failed_count = excluded.failed_count,
        locked_until = excluded.locked_until,
        last_attempt_at = excluded.last_attempt_at
  returning * into v_existing;

  return query select
    (v_existing.locked_until is not null and v_existing.locked_until > now()),
    v_existing.locked_until,
    greatest(0, v_max_attempts - v_existing.failed_count);
end;
$$;

revoke all on function public.record_login_attempt(text, boolean) from public, anon, authenticated;
grant execute on function public.record_login_attempt(text, boolean) to service_role;
