-- ============================================================
-- Payment source stamp — which screen recorded a payment
--
-- payments.payment_source records where a payment's amount_paid came
-- from:
--   'collections' — saved from the Collections page (row Save or Save All)
--   'ledger'      — saved/corrected on an individual loan's ledger page
--   NULL          — unpaid, or paid before this column existed
--
-- "Retract Week" on the Collections page only ever resets rows stamped
-- 'collections' (for the active agent, dated within the selected week),
-- so a manual correction made on a loan ledger can never be wiped by it.
-- A ledger edit of a row that was originally a collections save re-stamps
-- it 'ledger', taking it out of retract's reach.
--
-- Existing rows are deliberately left NULL (not backfilled): history
-- can't reliably tell which screen saved them, and guessing wrong would
-- let retract wipe a manual correction. See the optional, scoped
-- backfill at the bottom if a week saved before this migration needs
-- retracting.
--
-- Run this in the Supabase SQL editor BEFORE deploying the code that
-- writes the column — the save path sends payment_source on every row
-- and will fail against a table that doesn't have it yet.
-- ============================================================

alter table public.payments
  add column if not exists payment_source text;

alter table public.payments
  drop constraint if exists payments_payment_source_check;

alter table public.payments
  add constraint payments_payment_source_check
  check (payment_source is null or payment_source in ('collections', 'ledger'));

comment on column public.payments.payment_source is
  'Which screen recorded amount_paid: collections | ledger | NULL (unpaid or pre-dates this column). Retract Week only touches collections.';

-- Retract looks rows up by agent + source + payment_date range.
create index if not exists payments_agent_source_date_idx
  on public.payments (agent, payment_source, payment_date);

-- ------------------------------------------------------------
-- OPTIONAL one-off backfill — only if you need to retract a week that
-- was saved BEFORE this migration. Collections saves always stamp
-- payment_date with the selected week's Monday exactly; ledger saves
-- stamp the calendar date the edit was made. So rows dated exactly that
-- Monday are almost certainly collections saves (the exception being a
-- ledger edit that happened to be made on that Monday). Review the
-- SELECT before running the UPDATE. Replace the agent and date.
-- ------------------------------------------------------------
-- select id, loan_id, week_number, amount_paid, payment_date
--   from public.payments
--  where agent = 'A'
--    and payment_date = '2026-09-28'
--    and amount_paid is not null
--    and payment_source is null;
--
-- update public.payments
--    set payment_source = 'collections'
--  where agent = 'A'
--    and payment_date = '2026-09-28'
--    and amount_paid is not null
--    and payment_source is null;
