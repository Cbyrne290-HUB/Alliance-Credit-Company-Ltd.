import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent-context";
import { CustomerSearch } from "./customer-search";
import type { CustomerDirectoryRow, CustomerListItem } from "@/types/customer";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();

  const [{ data: customersData }, { data: loansData }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, account_number, first_name, surname, phone, ppsn")
      .eq("agent", activeAgent)
      .order("created_at", { ascending: false }),
    supabase.from("loans").select("customer_id, status, arrears").eq("agent", activeAgent),
  ]);

  const customers = (customersData ?? []) as CustomerListItem[];
  const loans = (loansData ?? []) as {
    customer_id: string | null;
    status: string | null;
    arrears: number | null;
  }[];

  const loansByCustomer = new Map<string, typeof loans>();
  for (const loan of loans) {
    if (!loan.customer_id) continue;
    const existing = loansByCustomer.get(loan.customer_id) ?? [];
    existing.push(loan);
    loansByCustomer.set(loan.customer_id, existing);
  }

  const directory: CustomerDirectoryRow[] = customers.map((c) => {
    const customerLoans = loansByCustomer.get(c.id) ?? [];
    const hasActive = customerLoans.some((l) => l.status === "active");
    return {
      ...c,
      loanCount: customerLoans.length,
      customerStatus: hasActive
        ? "active"
        : customerLoans.length > 0
          ? "cleared"
          : "none",
    };
  });

  const activeLoansCount = loans.filter((l) => l.status === "active").length;
  const inArrearsCount = loans.filter(
    (l) => l.status === "active" && (l.arrears ?? 0) > 0,
  ).length;

  return (
    <CustomerSearch
      customers={directory}
      totalCustomers={customers.length}
      activeLoansCount={activeLoansCount}
      inArrearsCount={inArrearsCount}
    />
  );
}
