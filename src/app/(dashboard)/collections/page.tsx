import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent-context";
import { getMonday, getSunday, toISODate } from "@/lib/dates";
import type { Loan, Payment } from "@/types/loan";
import type { Customer } from "@/types/customer";
import type { CollectionLoan } from "@/types/collections";
import { CollectionsSheet } from "./collections-sheet";

export default async function CollectionsPage() {
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();

  const { data: loansData } = await supabase
    .from("loans")
    .select(
      "id, loan_reference, customer_id, status, weekly_payment, balance, arrears, total_repayable",
    )
    .eq("agent", activeAgent)
    .order("created_at", { ascending: true });

  const loans = (loansData ?? []) as Pick<
    Loan,
    | "id"
    | "loan_reference"
    | "customer_id"
    | "status"
    | "weekly_payment"
    | "balance"
    | "arrears"
    | "total_repayable"
  >[];

  const customerIds = Array.from(
    new Set(loans.map((l) => l.customer_id).filter((id): id is string => Boolean(id))),
  );

  const { data: customersData } =
    customerIds.length > 0
      ? await supabase
          .from("customers")
          .select("id, first_name, surname")
          .in("id", customerIds)
          .eq("agent", activeAgent)
      : { data: [] };

  const customerNames = new Map<string, string>();
  for (const c of (customersData ?? []) as Pick<
    Customer,
    "id" | "first_name" | "surname"
  >[]) {
    customerNames.set(c.id, `${c.first_name} ${c.surname}`);
  }

  const collectionLoans: CollectionLoan[] = loans
    .map((l) => ({
      loanId: l.id,
      loanReference: l.loan_reference,
      customerId: l.customer_id ?? "",
      customerName: l.customer_id
        ? (customerNames.get(l.customer_id) ?? "Unknown Customer")
        : "Unknown Customer",
      status: l.status ?? "active",
      weeklyPayment: l.weekly_payment,
      balance: l.balance,
      arrears: l.arrears ?? 0,
      totalRepayable: l.total_repayable,
    }))
    .sort((a, b) => a.customerName.localeCompare(b.customerName));

  const activeLoanIds = collectionLoans
    .filter((l) => l.status === "active")
    .map((l) => l.loanId);

  const { data: paymentsData } =
    activeLoanIds.length > 0
      ? await supabase
          .from("payments")
          .select("*")
          .in("loan_id", activeLoanIds)
          .eq("agent", activeAgent)
          .order("week_number", { ascending: true })
      : { data: [] };

  const payments = (paymentsData ?? []) as Payment[];

  const paymentsByLoan: Record<string, Payment[]> = {};
  for (const p of payments) {
    if (!p.loan_id) continue;
    (paymentsByLoan[p.loan_id] ??= []).push(p);
  }

  const today = new Date();
  const initialWeek = {
    start: toISODate(getMonday(today)),
    end: toISODate(getSunday(today)),
  };

  return (
    <CollectionsSheet
      key={activeAgent}
      loans={collectionLoans}
      paymentsByLoan={paymentsByLoan}
      initialWeek={initialWeek}
    />
  );
}
