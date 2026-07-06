import type { SupabaseClient } from "@supabase/supabase-js";
import type { Payment } from "@/types/loan";
import type { ActiveAgent } from "@/types/agent";

export const DEFAULT_TERM_WEEKS = 37;
export const DEFAULT_INTEREST_RATE = 28.5;

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeLoanFinancials(
  principal: number,
  interestRatePercent: number,
  termWeeks: number,
) {
  const interest = round2(principal * (interestRatePercent / 100));
  const totalRepayable = round2(principal + interest);
  const weeklyPayment = round2(totalRepayable / termWeeks);
  return { interest, totalRepayable, weeklyPayment };
}

/**
 * The standard weekly_payment is total_repayable / term_weeks rounded to 2
 * decimals, so paying it every week almost never lands exactly on
 * total_repayable. The final week absorbs that rounding remainder so the
 * full schedule sums to exactly total_repayable.
 */
export function computeFinalWeekPayment(
  totalRepayable: number,
  weeklyPayment: number,
  termWeeks: number,
) {
  return round2(totalRepayable - weeklyPayment * (termWeeks - 1));
}

export function generateLoanReference() {
  const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LN-${ymd}-${rand}`;
}

export function weeksRemaining(balance: number, weeklyPayment: number) {
  if (balance <= 0 || weeklyPayment <= 0) return 0;
  return Math.ceil(balance / weeklyPayment);
}

/** First row in week order with no payment recorded yet, or null if none. */
export function findNextPendingRow(payments: Payment[]): Payment | null {
  const sorted = [...payments].sort((a, b) => a.week_number - b.week_number);
  return sorted.find((p) => p.amount_paid === null) ?? null;
}

export type LedgerComputation = {
  rows: Payment[];
  balance: number;
  arrears: number;
  status: string;
};

/**
 * Recomputes the entire payment ledger from scratch, from the full ordered
 * payment history — never an incremental delta. This is what makes editing
 * any past week (or entering payments in a different order/amount) always
 * land on the correct numbers instead of drifting:
 *
 * - Balance = total repayable minus the SUM of every amount_paid so far.
 * - Arrears = what SHOULD have been paid by now (weeks-paid × weekly
 *   payment) minus what HAS actually been paid. Because this compares
 *   totals rather than accumulating each week's shortfall independently, an
 *   overpayment in a later week automatically cancels an earlier
 *   underpayment instead of leaving stale arrears behind.
 *
 * Rows with no payment yet freeze at the current running balance/arrears
 * (they haven't been collected, so they don't move the totals).
 */
export function computeLedger(
  payments: Payment[],
  totalRepayable: number,
  weeklyPayment: number,
): LedgerComputation {
  const sorted = [...payments].sort((a, b) => a.week_number - b.week_number);

  let totalPaid = 0;
  let weeksPaid = 0;

  const rows = sorted.map((row) => {
    if (row.amount_paid === null) {
      const balanceAfter = round2(Math.max(0, totalRepayable - totalPaid));
      const expected = round2(weeksPaid * weeklyPayment);
      const arrearsAfter = round2(Math.max(0, expected - totalPaid));
      return {
        ...row,
        balance_after: balanceAfter,
        arrears_after: arrearsAfter,
        status: "pending",
        flagged: false,
      };
    }

    totalPaid = round2(totalPaid + row.amount_paid);
    weeksPaid += 1;

    const balanceAfter = round2(Math.max(0, totalRepayable - totalPaid));
    const expected = round2(weeksPaid * weeklyPayment);
    const arrearsAfter = round2(Math.max(0, expected - totalPaid));
    const rowShortfall = Math.max(0, round2(weeklyPayment - row.amount_paid));

    return {
      ...row,
      balance_after: balanceAfter,
      arrears_after: arrearsAfter,
      status: rowShortfall > 0 ? "partial" : "paid",
      flagged: rowShortfall > 0,
    };
  });

  const balance = round2(Math.max(0, totalRepayable - totalPaid));
  const expectedTotal = round2(weeksPaid * weeklyPayment);
  const arrears = round2(Math.max(0, expectedTotal - totalPaid));

  return {
    rows,
    balance,
    arrears,
    status: balance <= 0 ? "cleared" : "active",
  };
}

/**
 * Loads one loan's full payment history, ordered for computeLedger. Bounded
 * to a single loan's schedule (term_weeks rows, never more than a few
 * dozen), so no pagination is needed here the way it is for agent-wide
 * queries. Used to fetch the ledger inputs on demand right before a save,
 * rather than preloading every loan's full history up front.
 */
export async function fetchPaymentsForLoan(
  supabase: SupabaseClient,
  loanId: string,
  activeAgent: ActiveAgent,
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("loan_id", loanId)
    .eq("agent", activeAgent)
    .order("week_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Payment[];
}

export type SavePaymentResult =
  | {
      ok: true;
      rows: Payment[];
      balance: number;
      arrears: number;
      status: string;
    }
  | { ok: false; error: string };

/**
 * Applies one week's payment and recomputes the whole ledger from the full
 * payment history, then persists every row plus the loan's new
 * balance/arrears/status. Used by both the Loan Ledger and the Collections
 * Sheet so they can never drift apart.
 *
 * activeAgent scopes the loan update so a write can never land on a loan
 * outside the caller's active book. The payment rows themselves aren't
 * re-filtered by agent here since they're upserted by id, and those ids
 * only ever come from a payments array the caller already loaded scoped to
 * activeAgent.
 */
export async function savePaymentForRow(
  supabase: SupabaseClient,
  loan: { id: string; total_repayable: number; weekly_payment: number },
  payments: Payment[],
  rowId: string,
  amount: number,
  paymentDate: string,
  activeAgent: ActiveAgent,
): Promise<SavePaymentResult> {
  const updatedPayments = payments.map((p) =>
    p.id === rowId ? { ...p, amount_paid: amount, payment_date: paymentDate } : p,
  );

  const { rows, balance, arrears, status } = computeLedger(
    updatedPayments,
    loan.total_repayable,
    loan.weekly_payment,
  );

  const [paymentsResult, loanResult] = await Promise.all([
    supabase.from("payments").upsert(
      rows.map((r) => ({
        id: r.id,
        week_number: r.week_number,
        amount_due: r.amount_due,
        amount_paid: r.amount_paid,
        balance_after: r.balance_after,
        arrears_after: r.arrears_after,
        status: r.status,
        flagged: r.flagged,
        payment_date: r.payment_date,
      })),
    ),
    supabase
      .from("loans")
      .update({ balance, arrears, status })
      .eq("id", loan.id)
      .eq("agent", activeAgent),
  ]);

  if (paymentsResult.error || loanResult.error) {
    return {
      ok: false,
      error:
        paymentsResult.error?.message ??
        loanResult.error?.message ??
        "Could not save payment. Please try again.",
    };
  }

  return { ok: true, rows, balance, arrears, status };
}
