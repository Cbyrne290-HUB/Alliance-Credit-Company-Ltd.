import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActiveAgent } from "@/types/agent";

export type DeleteCustomerResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes a customer along with all their loans and payment history.
 * Children are removed before parents to satisfy FK constraints: payments
 * for each loan, then the loans themselves, then the customer.
 *
 * All three steps are scoped to activeAgent so a customer belonging to the
 * other agent's book can never be deleted through this call.
 */
export async function deleteCustomerCascade(
  supabase: SupabaseClient,
  customerId: string,
  activeAgent: ActiveAgent,
): Promise<DeleteCustomerResult> {
  const { data: loans, error: loansFetchError } = await supabase
    .from("loans")
    .select("id")
    .eq("customer_id", customerId)
    .eq("agent", activeAgent);

  if (loansFetchError) {
    return { ok: false, error: loansFetchError.message };
  }

  const loanIds = ((loans ?? []) as { id: string }[]).map((l) => l.id);

  if (loanIds.length > 0) {
    const { error: paymentsError } = await supabase
      .from("payments")
      .delete()
      .in("loan_id", loanIds);

    if (paymentsError) {
      return { ok: false, error: paymentsError.message };
    }

    const { error: loansError } = await supabase
      .from("loans")
      .delete()
      .in("id", loanIds);

    if (loansError) {
      return { ok: false, error: loansError.message };
    }
  }

  const { error: customerError } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("agent", activeAgent);

  if (customerError) {
    return { ok: false, error: customerError.message };
  }

  return { ok: true };
}
