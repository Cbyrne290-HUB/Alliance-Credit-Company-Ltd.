import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent-context";
import { getMonday, getSunday, toISODate } from "@/lib/dates";
import { fetchAllRows } from "@/lib/fetch-all";
import type { Loan } from "@/types/loan";
import type { Customer } from "@/types/customer";
import type { CollectionLoan, NextPendingPayment } from "@/types/collections";
import { CollectionsSheet } from "./collections-sheet";

export default async function CollectionsPage() {
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();

  const loans = await fetchAllRows<
    Pick<
      Loan,
      | "id"
      | "loan_reference"
      | "customer_id"
      | "status"
      | "weekly_payment"
      | "balance"
      | "arrears"
      | "total_repayable"
    >
  >((from, to) =>
    supabase
      .from("loans")
      .select(
        "id, loan_reference, customer_id, status, weekly_payment, balance, arrears, total_repayable",
        { count: "exact" },
      )
      .eq("agent", activeAgent)
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  // Fetched directly by agent (not via .in() on the loans' customer_id
  // list) — an agent-scoped list can run into the thousands, and a query
  // string with that many UUIDs in an IN(...) clause gets rejected outright
  // (400) well before it'd ever hit a realistic URL-length limit.
  const customers = await fetchAllRows<
    Pick<Customer, "id" | "first_name" | "surname" | "account_number" | "address" | "walking_order">
  >((from, to) =>
    supabase
      .from("customers")
      .select("id, first_name, surname, account_number, address, walking_order", {
        count: "exact",
      })
      .eq("agent", activeAgent)
      .range(from, to),
  );

  const customerInfo = new Map<
    string,
    {
      name: string;
      accountNumber: string;
      address: string | null;
      walkingOrder: number | null;
    }
  >();
  for (const c of customers) {
    customerInfo.set(c.id, {
      name: `${c.first_name} ${c.surname}`,
      accountNumber: c.account_number,
      address: c.address,
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
        address: info?.address ?? null,
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

  // Sourced from the next_pending_payments SQL view (one row per loan —
  // its next unpaid week — not the loan's full history), so this is
  // roughly the size of the active-loan count, not every payment ever
  // recorded. The view still enforces the same agent_is_visible RLS policy
  // as the payments table directly (created with security_invoker so RLS
  // is evaluated as the calling user, not the view owner).
  const nextPendingRows = await fetchAllRows<{
    id: string;
    loan_id: string;
    week_number: number;
    amount_due: number;
  }>((from, to) =>
    supabase
      .from("next_pending_payments")
      .select("id, loan_id, week_number, amount_due", { count: "exact" })
      .eq("agent", activeAgent)
      .range(from, to),
  );

  const nextPendingByLoan: Record<string, NextPendingPayment> = {};
  for (const row of nextPendingRows) {
    nextPendingByLoan[row.loan_id] = {
      id: row.id,
      weekNumber: row.week_number,
      amountDue: row.amount_due,
    };
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
      nextPendingByLoan={nextPendingByLoan}
      initialWeek={initialWeek}
    />
  );
}
