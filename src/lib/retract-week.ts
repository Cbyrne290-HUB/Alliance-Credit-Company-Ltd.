import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/fetch-all";
import {
  computeLedger,
  fetchPaymentsForLoan,
  persistLedger,
  round2,
  type SavePaymentResult,
} from "@/lib/loans";
import type { ActiveAgent } from "@/types/agent";
import type { Payment } from "@/types/loan";

/**
 * Retract Week: resets every payment the Collections page recorded for one
 * week in the active agent's book back to unpaid, and recomputes each
 * affected loan's ledger (balance/arrears/status) with the same
 * computeLedger maths a save uses (via persistLedger).
 *
 * A row is only ever retracted if ALL of these hold — checked both in the
 * agent-wide lookup and again per-row against freshly loaded history:
 *   - agent = activeAgent
 *   - payment_source = "collections" (never a ledger correction)
 *   - payment_date within [weekStart, weekEnd]
 *   - amount_paid is set
 *
 * Re-runnable: rows are found by those criteria, not by a remembered list,
 * so after a partial failure running it again finishes the remainder and
 * already-retracted loans simply no longer match.
 */

export type RetractWeek = { start: string; end: string };

export type RetractPreview = {
  paymentCount: number;
  loanIds: string[];
  total: number;
  /** Payments (any source) dated after the week — retract is refused if > 0. */
  laterPaymentCount: number;
};

export async function previewRetractWeek(
  supabase: SupabaseClient,
  activeAgent: ActiveAgent,
  week: RetractWeek,
): Promise<RetractPreview> {
  const [rows, later] = await Promise.all([
    fetchAllRows<{ id: string; loan_id: string | null; amount_paid: number | null }>(
      (from, to) =>
        supabase
          .from("payments")
          .select("id, loan_id, amount_paid", { count: "exact" })
          .eq("agent", activeAgent)
          .eq("payment_source", "collections")
          .gte("payment_date", week.start)
          .lte("payment_date", week.end)
          .not("amount_paid", "is", null)
          .order("id", { ascending: true })
          .range(from, to),
    ),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("agent", activeAgent)
      .gt("payment_date", week.end)
      .not("amount_paid", "is", null),
  ]);

  if (later.error) {
    throw new Error(later.error.message);
  }

  const loanIds = new Set<string>();
  let total = 0;
  for (const row of rows) {
    if (row.loan_id) loanIds.add(row.loan_id);
    total = round2(total + (row.amount_paid ?? 0));
  }

  return {
    paymentCount: rows.length,
    loanIds: [...loanIds],
    total,
    laterPaymentCount: later.count ?? 0,
  };
}

function isRetractable(p: Payment, week: RetractWeek) {
  if (p.payment_source !== "collections" || p.amount_paid === null || !p.payment_date) {
    return false;
  }
  const date = p.payment_date.slice(0, 10);
  return date >= week.start && date <= week.end;
}

export type RetractLoanResult = SavePaymentResult & { retractedCount?: number };

/**
 * Retracts one loan's collections payments for the week. Loads the loan and
 * its full history fresh (both agent-scoped), resets only the matching
 * rows, then recomputes and persists the whole ledger.
 */
export async function retractLoanWeek(
  supabase: SupabaseClient,
  loanId: string,
  week: RetractWeek,
  activeAgent: ActiveAgent,
): Promise<RetractLoanResult> {
  const [loanResult, payments] = await Promise.all([
    supabase
      .from("loans")
      .select("id, total_repayable, weekly_payment")
      .eq("id", loanId)
      .eq("agent", activeAgent)
      .single(),
    fetchPaymentsForLoan(supabase, loanId, activeAgent).catch((err: unknown) =>
      err instanceof Error ? err : new Error("Could not load payment history."),
    ),
  ]);

  if (loanResult.error || !loanResult.data) {
    return { ok: false, error: loanResult.error?.message ?? "Loan not found." };
  }
  if (payments instanceof Error) {
    return { ok: false, error: payments.message };
  }

  let retractedCount = 0;
  const updatedPayments = payments.map((p) => {
    if (!isRetractable(p, week)) return p;
    retractedCount += 1;
    return { ...p, amount_paid: null, payment_date: null, payment_source: null };
  });

  const loan = loanResult.data;

  if (retractedCount === 0) {
    // Already retracted (e.g. by an earlier partial run) — nothing to write.
    // The current figures are still reported so the caller can refresh.
    const current = computeLedger(payments, loan.total_repayable, loan.weekly_payment);
    return { ok: true, retractedCount: 0, ...current };
  }

  const result = await persistLedger(supabase, loan, updatedPayments, activeAgent);
  return result.ok ? { ...result, retractedCount } : result;
}
