import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/loans";
import { fetchAllRows } from "@/lib/fetch-all";
import type { ActiveAgent } from "@/types/agent";
import { formatHistoryBucketLabel, fromISODate, type HistoryGranularity } from "@/lib/dates";

export type DashboardMetrics = {
  totalCollected: number;
  totalOutOnLoan: number;
  activeLoansCount: number;
  inArrearsCount: number;
};

export type ArrearsRow = {
  loanId: string;
  loanReference: string;
  customerName: string;
  arrears: number;
  weeksBehind: number;
};

export type StatusBreakdown = {
  active: number;
  inArrears: number;
  cleared: number;
};

export type AgingBucket = {
  label: string;
  amount: number;
};

export type LoanHistoryPoint = {
  label: string;
  totalCollected: number;
  totalOutOnLoan: number;
};

type LoanRow = {
  id: string;
  loan_reference: string;
  customer_id: string | null;
  status: string | null;
  balance: number;
  arrears: number | null;
  weekly_payment: number;
};

type CustomerNameRow = {
  id: string;
  first_name: string;
  surname: string;
};

export async function fetchDashboardData(
  supabase: SupabaseClient,
  range: { start: string; end: string },
  activeAgent: ActiveAgent,
): Promise<{
  metrics: DashboardMetrics;
  arrears: ArrearsRow[];
  statusBreakdown: StatusBreakdown;
  agingBuckets: AgingBucket[];
}> {
  const [paymentsData, allLoans] = await Promise.all([
    fetchAllRows<{ amount_paid: number | null }>((from, to) =>
      supabase
        .from("payments")
        .select("amount_paid", { count: "exact" })
        .eq("agent", activeAgent)
        .gte("payment_date", range.start)
        .lte("payment_date", range.end)
        .range(from, to),
    ),
    fetchAllRows<LoanRow>((from, to) =>
      supabase
        .from("loans")
        .select("id, loan_reference, customer_id, status, balance, arrears, weekly_payment", {
          count: "exact",
        })
        .eq("agent", activeAgent)
        .range(from, to),
    ),
  ]);

  const totalCollected = round2(
    paymentsData.reduce((sum, p) => sum + (p.amount_paid ?? 0), 0),
  );

  const activeLoans = allLoans.filter((l) => l.status === "active");
  const clearedLoans = allLoans.filter((l) => l.status === "cleared");
  const arrearsLoans = activeLoans.filter((l) => (l.arrears ?? 0) > 0);

  const totalOutOnLoan = round2(
    activeLoans.reduce((sum, l) => sum + l.balance, 0),
  );

  // Fetched directly by agent rather than via .in() on the arrears loans'
  // customer_id list — that list can run into the hundreds/thousands, and
  // an IN(...) clause that large gets rejected outright (400) well before
  // it'd ever hit a realistic URL-length limit.
  const customers = await fetchAllRows<CustomerNameRow>((from, to) =>
    supabase
      .from("customers")
      .select("id, first_name, surname", { count: "exact" })
      .eq("agent", activeAgent)
      .range(from, to),
  );

  const customerNames = new Map(
    customers.map((c) => [c.id, `${c.first_name} ${c.surname}`]),
  );

  const arrears: ArrearsRow[] = arrearsLoans
    .map((l) => ({
      loanId: l.id,
      loanReference: l.loan_reference,
      customerName: l.customer_id
        ? (customerNames.get(l.customer_id) ?? "Unknown Customer")
        : "Unknown Customer",
      arrears: l.arrears ?? 0,
      weeksBehind:
        l.weekly_payment > 0
          ? Math.ceil((l.arrears ?? 0) / l.weekly_payment)
          : 0,
    }))
    .sort((a, b) => b.arrears - a.arrears);

  return {
    metrics: {
      totalCollected,
      totalOutOnLoan,
      activeLoansCount: activeLoans.length,
      inArrearsCount: arrearsLoans.length,
    },
    arrears,
    statusBreakdown: {
      active: activeLoans.length - arrearsLoans.length,
      inArrears: arrearsLoans.length,
      cleared: clearedLoans.length,
    },
    agingBuckets: computeAgingBuckets(arrears),
  };
}

function computeAgingBuckets(arrears: ArrearsRow[]): AgingBucket[] {
  const buckets = [
    { label: "1-30 days", min: 0, max: 30, amount: 0 },
    { label: "31-60 days", min: 31, max: 60, amount: 0 },
    { label: "61-90 days", min: 61, max: 90, amount: 0 },
    { label: "90+ days", min: 91, max: Infinity, amount: 0 },
  ];

  for (const row of arrears) {
    const days = row.weeksBehind * 7;
    const bucket =
      buckets.find((b) => days >= b.min && days <= b.max) ?? buckets[0];
    bucket.amount = round2(bucket.amount + row.arrears);
  }

  return buckets.map((b) => ({ label: b.label, amount: b.amount }));
}

/**
 * Reconstructs a Total Collected / Total Out on Loan trend at whatever
 * granularity the caller's date range calls for (day/week/month), so the
 * dashboard's Loan Overview chart can show ~7 daily points for "This
 * Week", ~30 for "This Month", 12 monthly points for "This Year", or an
 * appropriately-scaled bucket count for a custom range. Delegated to a
 * Postgres function (see loan-overview-history.sql) that computes the
 * sums with SQL aggregates rather than pulling every loan and payment for
 * the agent into JS. The function runs as SECURITY INVOKER, so it's still
 * subject to the same agent_is_visible RLS policy as a direct table
 * query — passing a foreign agent value can't leak rows the caller isn't
 * otherwise allowed to see.
 */
export async function fetchLoanOverviewHistory(
  supabase: SupabaseClient,
  activeAgent: ActiveAgent,
  range: { start: string; end: string; granularity: HistoryGranularity },
): Promise<LoanHistoryPoint[]> {
  const { data, error } = await supabase.rpc("loan_overview_history", {
    p_agent: activeAgent,
    p_start: range.start,
    p_end: range.end,
    p_granularity: range.granularity,
  });

  if (error) throw new Error(error.message);

  const rangeSpanDays =
    Math.round(
      (fromISODate(range.end).getTime() - fromISODate(range.start).getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1;
  const multiYear =
    fromISODate(range.start).getFullYear() !== fromISODate(range.end).getFullYear();

  return (
    (data ?? []) as {
      bucket_start: string;
      total_collected: number | string;
      total_out_on_loan: number | string;
    }[]
  ).map((row) => ({
    label: formatHistoryBucketLabel(
      fromISODate(row.bucket_start),
      range.granularity,
      rangeSpanDays,
      multiYear,
    ),
    totalCollected: round2(Number(row.total_collected)),
    totalOutOnLoan: round2(Number(row.total_out_on_loan)),
  }));
}
