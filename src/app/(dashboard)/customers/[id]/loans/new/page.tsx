import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent-context";
import { PageHeader } from "@/components/layout/page-header";
import type { Customer } from "@/types/customer";
import { NewLoanForm } from "./new-loan-form";

export default async function NewLoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();
  const { data } = await supabase
    .from("customers")
    .select("id, first_name, surname")
    .eq("id", id)
    .eq("agent", activeAgent)
    .single();

  const customer = data as Pick<Customer, "id" | "first_name" | "surname"> | null;

  if (!customer) notFound();

  const fullName = `${customer.first_name} ${customer.surname}`;

  return (
    <>
      <PageHeader
        title="Create New Loan"
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Customers", href: "/customers" },
          { label: fullName, href: `/customers/${customer.id}` },
          { label: "New Loan" },
        ]}
      />
      <div className="px-8 py-8">
        <div className="mx-auto max-w-xl">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Create New Loan
            </h1>
            <p className="mt-1 text-sm text-slate-500">for {fullName}</p>

            <NewLoanForm customerId={customer.id} />
          </div>
        </div>
      </div>
    </>
  );
}
