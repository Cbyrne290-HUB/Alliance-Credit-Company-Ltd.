"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CustomerForm, type CustomerFormValues } from "@/components/forms/customer-form";
import { PageHeader } from "@/components/layout/page-header";
import { useAgentContext } from "@/components/agent/agent-provider";

export default function NewCustomerPage() {
  const router = useRouter();
  const { activeAgent } = useAgentContext();

  async function handleCreate(values: CustomerFormValues) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        agent: activeAgent,
        account_number: values.account_number,
        first_name: values.first_name,
        surname: values.surname,
        date_of_birth: values.date_of_birth || null,
        address: values.address || null,
        eircode: values.eircode || null,
        phone: values.phone || null,
        ppsn: values.ppsn || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return error?.message ?? "Could not save customer. Please try again.";
    }

    router.push(`/customers/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Add New Customer"
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Customers", href: "/customers" },
          { label: "Add New" },
        ]}
      />
      <div className="px-8 py-8">
        <div className="mx-auto max-w-xl">
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Add New Customer
            </h1>
            <CustomerForm submitLabel="Save Customer" onSubmit={handleCreate} />
          </div>
        </div>
      </div>
    </>
  );
}
