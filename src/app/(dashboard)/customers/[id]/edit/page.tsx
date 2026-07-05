import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentContext } from "@/lib/agent-context";
import { EditCustomerForm } from "./edit-customer-form";
import { PageHeader } from "@/components/layout/page-header";
import type { Customer } from "@/types/customer";
import type { CustomerFormValues } from "@/components/forms/customer-form";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { activeAgent } = await getAgentContext();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("agent", activeAgent)
    .single();

  const customer = data as Customer | null;

  if (!customer) notFound();

  const fullName = `${customer.first_name} ${customer.surname}`;

  const initialValues: CustomerFormValues = {
    account_number: customer.account_number,
    first_name: customer.first_name,
    surname: customer.surname,
    date_of_birth: customer.date_of_birth ?? "",
    address: customer.address ?? "",
    eircode: customer.eircode ?? "",
    phone: customer.phone ?? "",
    ppsn: customer.ppsn ?? "",
    walking_order:
      customer.walking_order != null ? String(customer.walking_order) : "",
  };

  return (
    <>
      <PageHeader
        title="Edit Customer"
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Customers", href: "/customers" },
          { label: fullName, href: `/customers/${id}` },
          { label: "Edit" },
        ]}
      />
      <div className="px-8 py-8">
        <div className="mx-auto max-w-xl">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Edit Customer
            </h1>
            <EditCustomerForm customerId={id} initialValues={initialValues} />
          </div>
        </div>
      </div>
    </>
  );
}
