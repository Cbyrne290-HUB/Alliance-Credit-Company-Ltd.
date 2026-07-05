"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CustomerForm, type CustomerFormValues } from "@/components/forms/customer-form";
import { useAgentContext } from "@/components/agent/agent-provider";

export function EditCustomerForm({
  customerId,
  initialValues,
}: {
  customerId: string;
  initialValues: CustomerFormValues;
}) {
  const router = useRouter();
  const { activeAgent } = useAgentContext();

  async function handleUpdate(values: CustomerFormValues) {
    const supabase = createClient();
    const { error } = await supabase
      .from("customers")
      .update({
        account_number: values.account_number,
        first_name: values.first_name,
        surname: values.surname,
        date_of_birth: values.date_of_birth || null,
        address: values.address || null,
        eircode: values.eircode || null,
        phone: values.phone || null,
        ppsn: values.ppsn || null,
        walking_order:
          values.walking_order.trim() === "" ? null : Number(values.walking_order),
      })
      .eq("id", customerId)
      .eq("agent", activeAgent);

    if (error) {
      return error.message;
    }

    router.push(`/customers/${customerId}`);
    router.refresh();
  }

  return (
    <CustomerForm
      initialValues={initialValues}
      submitLabel="Save Changes"
      onSubmit={handleUpdate}
    />
  );
}
