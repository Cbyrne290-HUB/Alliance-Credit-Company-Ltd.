-- ============================================================
-- Applications review queue — RLS for the admin dashboard
--
-- The "applications" table holds loan applications submitted by the
-- public application website. Unlike customers/loans/payments, these
-- rows are NOT agent-scoped — an application isn't assigned to a book
-- until an admin approves it — so both Agent A and Agent B logins can
-- see and act on every row here. Run this in the Supabase SQL editor.
-- ============================================================

-- ------------------------------------------------------------
-- public.applications
-- ------------------------------------------------------------
alter table public.applications enable row level security;

drop policy if exists "applications_authenticated_access" on public.applications;
create policy "applications_authenticated_access" on public.applications
  for all to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- anon insert — public application website
--
-- The public application website (a separate project, not this admin
-- repo) submits new applications directly with the Supabase anon key.
-- This policy is what makes that insert legal under RLS; it is
-- documented here as source of truth so this repo doesn't drift from
-- what's actually live in Supabase, but it is owned/created by the
-- apply website's own setup, not by this admin app.
--
-- INSERT-only, `with check (true)` so any submitted row is accepted —
-- deliberately no `using` clause and no other command, so the anon
-- role gets no select/update/delete on this table at all: the public
-- site can create an application but can never read back, modify, or
-- remove any application (its own or anyone else's) once submitted.
-- ------------------------------------------------------------
drop policy if exists "applications_anon_insert" on public.applications;
create policy "applications_anon_insert" on public.applications
  for insert to anon
  with check (true);

-- ------------------------------------------------------------
-- storage: application-documents bucket (private)
--
-- Admins need read access to generate signed URLs for the four
-- uploaded documents, and storage's cross-bucket copy() (used when an
-- application is approved, to bring the docs into the customer's
-- "documents" bucket) requires `select` on the source object in
-- addition to `insert` on the destination — which the existing
-- documents_agent_access policy (see rls-setup.sql) already grants
-- once the new customer row exists.
-- ------------------------------------------------------------
drop policy if exists "application_documents_authenticated_read" on storage.objects;
create policy "application_documents_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'application-documents');
