import type { SupabaseClient } from "@supabase/supabase-js";
import { round2 } from "@/lib/loans";
import type { ActiveAgent } from "@/types/agent";

export const RECONCILIATIONS_TABLE = "reconciliations";

/**
 * The single source of truth for what the system recorded as collected in
 * a week: sum of amount_paid for every payment dated within
 * [weekStart, weekEnd] belonging to the active agent. Always recomputed
 * fresh from the payments table rather than read from a stored snapshot,
 * so it stays correct even if a payment is edited after the fact.
 */
export async function computeClosingBalance(
  supabase: SupabaseClient,
  activeAgent: ActiveAgent,
  weekStart: string,
  weekEnd: string,
): Promise<number> {
  const { data } = await supabase
    .from("payments")
    .select("amount_paid")
    .eq("agent", activeAgent)
    .gte("payment_date", weekStart)
    .lte("payment_date", weekEnd);

  const rows = (data ?? []) as { amount_paid: number | null }[];
  return round2(rows.reduce((sum, r) => sum + (r.amount_paid ?? 0), 0));
}

export type SavedReconciliation = {
  handheldBalance: number;
  closingBalance: number;
  createdAt: string;
};

/** The previously saved handheld figure for a week, if this week has ever been saved. */
export async function fetchSavedReconciliation(
  supabase: SupabaseClient,
  activeAgent: ActiveAgent,
  weekStart: string,
): Promise<SavedReconciliation | null> {
  const { data } = await supabase
    .from(RECONCILIATIONS_TABLE)
    .select("handheld_balance, closing_balance, created_at")
    .eq("agent", activeAgent)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!data) return null;

  return {
    handheldBalance: data.handheld_balance,
    closingBalance: data.closing_balance,
    createdAt: data.created_at,
  };
}

export type SaveReconciliationResult = { ok: true } | { ok: false; error: string };

/**
 * Upserts on (agent, week_start), so re-saving the same week updates the
 * existing row (created_at stays put) instead of accumulating duplicates.
 */
export async function saveReconciliation(
  supabase: SupabaseClient,
  activeAgent: ActiveAgent,
  weekStart: string,
  handheldBalance: number,
  closingBalance: number,
): Promise<SaveReconciliationResult> {
  const { error } = await supabase.from(RECONCILIATIONS_TABLE).upsert(
    {
      agent: activeAgent,
      week_start: weekStart,
      handheld_balance: handheldBalance,
      closing_balance: closingBalance,
    },
    { onConflict: "agent,week_start" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
