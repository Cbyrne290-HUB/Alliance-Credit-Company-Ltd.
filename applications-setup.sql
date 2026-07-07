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
--
-- NOTE: if the public application website inserts rows using the
-- Supabase anon key (rather than a server-side service role key),
-- confirm it already has its own INSERT policy for the `anon` role on
-- this table — enabling RLS here does not add one, and if the table
-- currently relies on RLS being OFF for that insert to work, turning
-- RLS on below will silently break new applications from the public
-- site. Add an anon insert policy for `applications` (and the
-- `application-documents` bucket) if one doesn't already exist.
-- ------------------------------------------------------------
alter table public.applications enable row level security;

drop policy if exists "applications_authenticated_access" on public.applications;
create policy "applications_authenticated_access" on public.applications
  for all to authenticated
  using (true)
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
