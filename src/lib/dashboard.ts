import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/loans";
import type { ActiveAgent } from "@/types/agent";
import {
  addMonths,
  endOfMonth,
  fromISODate,
  isWithinRange,
  startOfMonth,
} from "@/lib/dates";

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
  const [{ data: paymentsData }, { data: loansData }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount_paid")
      .eq("agent", activeAgent)
      .gte("payment_date", range.start)
      .lte("payment_date", range.end),
    supabase
      .from("loans")
      .select("id, loan_reference, customer_id, status, balance, arrears, weekly_payment")
      .eq("agent", activeAgent),
  ]);

  const totalCollected = round2(
    ((paymentsData ?? []) as { amount_paid: number | null }[]).reduce(
      (sum, p) => sum + (p.amount_paid ?? 0),
      0,
    ),
  );

  const allLoans = (loansData ?? []) as LoanRow[];
  const activeLoans = allLoans.filter((l) => l.status === "active");
  const clearedLoans = allLoans.filter((l) => l.status === "cleared");
  const arrearsLoans = activeLoans.filter((l) => (l.arrears ?? 0) > 0);

  const totalOutOnLoan = round2(
    activeLoans.reduce((sum, l) => sum + l.balance, 0),
  );

  const customerIds = Array.from(
    new Set(
      arrearsLoans
        .map((l) => l.customer_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const customerNames = new Map<string, string>();

  if (customerIds.length > 0) {
    const { data: customersData } = await supabase
      .from("customers")
      .select("id, first_name, surname")
      .in("id", customerIds)
      .eq("agent", activeAgent);

    for (const c of (customersData ?? []) as CustomerNameRow[]) {
      customerNames.set(c.id, `${c.first_name} ${c.surname}`);
    }
  }

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
 * Reconstructs a monthly Total Collected / Total Out on Loan trend from the
 * loans and payments tables (there's no historical balance snapshot table,
 * so "out on loan as of month end" is derived from each loan's total
 * repayable minus everything paid on it by that point).
 */
export async function fetchLoanOverviewHistory(
  supabase: SupabaseClient,
  activeAgent: ActiveAgent,
  monthsCount = 6,
): Promise<MonthlyHistoryPoint[]> {
  type LoanHistoryRow = {
    id: string;
    total_repayable: number;
    created_at: string | null;
  };
  type PaymentHistoryRow = {
    loan_id: string | null;
    amount_paid: number | null;
    payment_date: string | null;
  };

  const [{ data: loansData }, { data: paymentsData }] = await Promise.all([
    supabase
      .from("loans")
      .select("id, total_repayable, created_at")
      .eq("agent", activeAgent),
    supabase
      .from("payments")
      .select("loan_id, amount_paid, payment_date")
      .eq("agent", activeAgent),
  ]);

  const loans = (loansData ?? []) as LoanHistoryRow[];
  const payments = (paymentsData ?? []) as PaymentHistoryRow[];

  const today = new Date();
  const months = Array.from({ length: monthsCount }, (_, i) => {
    const monthDate = addMonths(startOfMonth(today), -(monthsCount - 1 - i));
    const end = endOfMonth(monthDate);
    end.setHours(23, 59, 59, 999);
    return {
      start: startOfMonth(monthDate),
      end,
      label: monthDate.toLocaleDateString("en-IE", {
        month: "short",
        year: "numeric",
      }),
    };
  });

  return months.map(({ start, end, label }) => {
    const totalCollected = round2(
      payments
        .filter(
          (p) =>
            p.payment_date &&
            isWithinRange(fromISODate(p.payment_date), start, end),
        )
        .reduce((sum, p) => sum + (p.amount_paid ?? 0), 0),
    );

    const totalOutOnLoan = round2(
      loans.reduce((sum, l) => {
        if (!l.created_at) return sum;
        if (new Date(l.created_at).getTime() > end.getTime()) return sum;

        const paidToDate = payments
          .filter(
            (p) =>
              p.loan_id === l.id &&
              p.payment_date &&
              fromISODate(p.payment_date).getTime() <= end.getTime(),
          )
          .reduce((s, p) => s + (p.amount_paid ?? 0), 0);

        return sum + Math.max(0, l.total_repayable - paidToDate);
      }, 0),
    );

    return { month: label, totalCollected, totalOutOnLoan };
  });
}
