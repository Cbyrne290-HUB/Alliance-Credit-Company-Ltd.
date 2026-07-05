import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent-context";
import type { Loan, Payment } from "@/types/loan";
import type { Customer } from "@/types/customer";
import { LoanLedger } from "./loan-ledger";

export default async function LoanLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();

  const { data: loanData } = await supabase
    .from("loans")
    .select("*")
    .eq("id", id)
    .eq("agent", activeAgent)
    .single();

  const loan = loanData as Loan | null;

  if (!loan) notFound();

  const [{ data: customerData }, { data: paymentsData }] = await Promise.all([
    loan.customer_id
      ? supabase
          .from("customers")
          .select("id, first_name, surname")
          .eq("id", loan.customer_id)
          .eq("agent", activeAgent)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("payments")
      .select("*")
      .eq("loan_id", id)
      .eq("agent", activeAgent)
      .order("week_number", { ascending: true }),
  ]);

  const customer = customerData as Pick<
    Customer,
    "id" | "first_name" | "surname"
  > | null;
  const payments = (paymentsData ?? []) as Payment[];

  return <LoanLedger loan={loan} payments={payments} customer={customer} />;
}
