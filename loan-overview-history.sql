-- ============================================================
-- Loan overview chart — adaptive day/week/month bucketing
--
-- Replaces the old loan_overview_history(p_agent, p_months), which only
-- ever bucketed by calendar month and always looked back a fixed number
-- of months from today. The admin dashboard's date-range picker ("This
-- Week" / "This Month" / "This Year" / a custom range) now drives an
-- explicit start date, end date, and bucket granularity ('day' | 'week'
-- | 'month'), so the trend chart can show ~7 daily points for a week,
-- ~30 for a month, 12 monthly points for a year, or an appropriately
-- scaled bucket count for a custom range. Weeks start Monday, via
-- Postgres's date_trunc('week', ...) — the same convention this app's
-- getMonday()/getSunday() already use.
--
-- Both measures keep their exact original meaning — only the bucket
-- unit and the requested date range changed:
--   - total_collected: sum of payments.amount_paid whose payment_date
--     falls in that bucket.
--   - total_out_on_loan: the outstanding-balance snapshot as of each
--     bucket's END date — summed, over every loan created on/before
--     that date, as greatest(0, total_repayable - cumulative amount
--     paid as of that date). A point-in-time snapshot (like the
--     dashboard's "Total Out on Loan" stat card), not a per-bucket flow.
--
-- The two payments-based CTEs below (bucketed_collected,
-- bucketed_paid_per_loan) are deliberately NOT filtered to [p_start,
-- p_end] — cumulative_paid_per_loan needs full history predating the
-- display window to correctly reflect how much of each loan was already
-- paid off before the window starts. Restricting to the display range
-- there would understate outstanding balances for any window that
-- doesn't start at a loan's origination. Output rows are still limited
-- to the requested range via the join against `bounds`.
--
-- Stays single-pass, set-based SQL — no per-row loops — same as the
-- function this replaces.
--
-- Run this in the Supabase SQL editor.
-- ============================================================

drop function if exists public.loan_overview_history(text, integer);

create or replace function public.loan_overview_history(
  p_agent text,
  p_start date,
  p_end date,
  p_granularity text
)
returns table(bucket_start date, total_collected numeric, total_out_on_loan numeric)
language sql
stable
set search_path to 'public'
as $function$
  with params as (
    select
      case p_granularity
        when 'day' then interval '1 day'
        when 'week' then interval '1 week'
        when 'month' then interval '1 month'
      end as step,
      date_trunc(p_granularity, p_start)::date as first_bucket,
      date_trunc(p_granularity, p_end)::date as last_bucket
  ),
  bounds_range as (
    select step, first_bucket, last_bucket,
      (last_bucket + step - interval '1 day')::date as last_bucket_end
    from params
  ),
  bounds as (
    select
      gs::date as bucket_start,
      (gs + r.step - interval '1 day')::date as bucket_end
    from bounds_range r,
      generate_series(r.first_bucket::timestamp, r.last_bucket::timestamp, r.step) as gs
  ),
  bucketed_collected as (
    select
      date_trunc(p_granularity, p.payment_date)::date as bucket_start,
      sum(p.amount_paid) as total_collected
    from public.payments p
    where p.agent = p_agent
      and p.payment_date is not null
    group by date_trunc(p_granularity, p.payment_date)
  ),
  bucketed_paid_per_loan as (
    select
      p.loan_id,
      date_trunc(p_granularity, p.payment_date)::date as bucket_start,
      sum(p.amount_paid) as paid
    from public.payments p
    where p.agent = p_agent
      and p.payment_date is not null
    group by p.loan_id, date_trunc(p_granularity, p.payment_date)
  ),
  cumulative_paid_per_loan as (
    select
      loan_id,
      bucket_start,
      sum(paid) over (partition by loan_id order by bucket_start) as cumulative_paid
    from bucketed_paid_per_loan
  ),
  loan_paid_as_of as (
    select distinct on (b.bucket_start, cp.loan_id)
      b.bucket_start, cp.loan_id, cp.cumulative_paid
    from bounds b
    join cumulative_paid_per_loan cp on cp.bucket_start <= b.bucket_end
    order by b.bucket_start, cp.loan_id, cp.bucket_start desc
  ),
  loans_scoped as (
    select id, total_repayable, created_at
    from public.loans
    where agent = p_agent
  ),
  bucketed_outstanding as (
    select
      b.bucket_start,
      sum(greatest(0, l.total_repayable - coalesce(pa.cumulative_paid, 0))) as total_out_on_loan
    from bounds b
    join loans_scoped l on l.created_at::date <= b.bucket_end
    left join loan_paid_as_of pa on pa.bucket_start = b.bucket_start and pa.loan_id = l.id
    group by b.bucket_start
  )
  select
    b.bucket_start,
    coalesce(bc.total_collected, 0),
    coalesce(bo.total_out_on_loan, 0)
  from bounds b
  left join bucketed_collected bc on bc.bucket_start = b.bucket_start
  left join bucketed_outstanding bo on bo.bucket_start = b.bucket_start
  order by b.bucket_start;
$function$;
