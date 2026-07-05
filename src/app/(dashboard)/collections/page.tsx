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
          .select("id, first_name, surname, account_number, walking_order")
          .in("id", customerIds)
          .eq("agent", activeAgent)
      : { data: [] };

  const customerInfo = new Map<
    string,
    { name: string; accountNumber: string; walkingOrder: number | null }
  >();
  for (const c of (customersData ?? []) as Pick<
    Customer,
    "id" | "first_name" | "surname" | "account_number" | "walking_order"
  >[]) {
    customerInfo.set(c.id, {
      name: `${c.first_name} ${c.surname}`,
      accountNumber: c.account_number,
      walkingOrder: c.walking_order,
    });
  }

  const collectionLoans: CollectionLoan[] = loans
    .map((l) => {
      const info = l.customer_id ? customerInfo.get(l.customer_id) : undefined;
      return {
        loanId: l.id,
        loanReference: l.loan_reference,
        customerId: l.customer_id ?? "",
        customerName: info?.name ?? "Unknown Customer",
        accountNumber: info?.accountNumber ?? "",
        walkingOrder: info?.walkingOrder ?? null,
        status: l.status ?? "active",
        weeklyPayment: l.weekly_payment,
        balance: l.balance,
        arrears: l.arrears ?? 0,
        totalRepayable: l.total_repayable,
      };
    })
    .sort((a, b) => {
      if (a.walkingOrder != null && b.walkingOrder != null) {
        return a.walkingOrder - b.walkingOrder;
      }
      if (a.walkingOrder != null) return -1;
      if (b.walkingOrder != null) return 1;
      return (
        a.accountNumber.localeCompare(b.accountNumber) ||
        a.customerName.localeCompare(b.customerName)
      );
    });

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
