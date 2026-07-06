import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/loans";
import { fetchAllRows } from "@/lib/fetch-all";
import type { ActiveAgent } from "@/types/agent";
import { fromISODate } from "@/lib/dates";

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

export type MonthlyHistoryPoint = {
  month: string;
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
 * Reconstructs a monthly Total Collected / Total Out on Loan trend. This
 * used to pull every loan and every payment for the agent (tens of
 * thousands of rows once the book is a few hundred customers deep) just to
 * sum them into 6 numbers in JS — now delegated to a Postgres function
 * (see loan_overview_history in the RLS/scaling SQL) that computes the same
 * sums with SQL aggregates and returns just `monthsCount` rows. The function
 * runs as SECURITY INVOKER, so it's still subject to the same agent_is_visible
 * RLS policy as a direct table query — passing a foreign agent value can't
 * leak rows the caller isn't otherwise allowed to see.
 */
export async function fetchLoanOverviewHistory(
  supabase: SupabaseClient,
  activeAgent: ActiveAgent,
  monthsCount = 6,
): Promise<MonthlyHistoryPoint[]> {
  const { data, error } = await supabase.rpc("loan_overview_history", {
    p_agent: activeAgent,
    p_months: monthsCount,
  });

  if (error) throw new Error(error.message);

  return (
    (data ?? []) as {
      month_start: string;
      total_collected: number | string;
      total_out_on_loan: number | string;
    }[]
  ).map((row) => ({
    month: fromISODate(row.month_start).toLocaleDateString("en-IE", {
      month: "short",
      year: "numeric",
    }),
    totalCollected: round2(Number(row.total_collected)),
    totalOutOnLoan: round2(Number(row.total_out_on_loan)),
  }));
}
