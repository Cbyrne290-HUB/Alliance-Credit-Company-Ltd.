-- ============================================================
-- Step 3: Row Level Security — agent-scoped access
-- ============================================================

-- ------------------------------------------------------------
-- Helper: is a row with this agent value visible to the caller?
-- agent_b -> sees A and B. agent_a -> sees only A. anything else -> denied.
-- Reads app_metadata (never user_metadata, which is user-editable).
-- ------------------------------------------------------------
create or replace function public.agent_is_visible(row_agent text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    case coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
      when 'agent_b' then true
      when 'agent_a' then row_agent = 'A'
      else false
    end;
$$;

comment on function public.agent_is_visible(text) is
  'RLS helper keyed off JWT app_metadata.role (never user_metadata, which is user-editable).';

-- ------------------------------------------------------------
-- customers / loans / payments / reconciliations
-- ------------------------------------------------------------
alter table public.customers       enable row level security;
alter table public.loans           enable row level security;
alter table public.payments        enable row level security;
alter table public.reconciliations enable row level security;

drop policy if exists "customers_agent_access" on public.customers;
create policy "customers_agent_access" on public.customers
  for all to authenticated
  using (public.agent_is_visible(agent))
  with check (public.agent_is_visible(agent));

drop policy if exists "loans_agent_access" on public.loans;
create policy "loans_agent_access" on public.loans
  for all to authenticated
  using (public.agent_is_visible(agent))
  with check (public.agent_is_visible(agent));

drop policy if exists "payments_agent_access" on public.payments;
create policy "payments_agent_access" on public.payments
  for all to authenticated
  using (public.agent_is_visible(agent))
  with check (public.agent_is_visible(agent));

drop policy if exists "reconciliations_agent_access" on public.reconciliations;
create policy "reconciliations_agent_access" on public.reconciliations
  for all to authenticated
  using (public.agent_is_visible(agent))
  with check (public.agent_is_visible(agent));

-- ------------------------------------------------------------
-- storage: documents bucket (path = "<customerId>/<slug>.jpg")
--
-- First drop the four old blanket "any authenticated user" policies from
-- the original document-upload work — these are permissive and would
-- silently OR-combine with the new restrictive policy below, defeating
-- the agent scoping entirely if left in place.
-- ------------------------------------------------------------
drop policy if exists "Authenticated users can read documents" on storage.objects;
drop policy if exists "Authenticated users can upload documents" on storage.objects;
drop policy if exists "Authenticated users can update documents" on storage.objects;
drop policy if exists "Authenticated users can delete documents" on storage.objects;

drop policy if exists "documents_agent_access" on storage.objects;
create policy "documents_agent_access" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.customers c
      where c.id::text = (storage.foldername(name))[1]
        and public.agent_is_visible(c.agent)
    )
  )
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from public.customers c
      where c.id::text = (storage.foldername(name))[1]
        and public.agent_is_visible(c.agent)
    )
  );
