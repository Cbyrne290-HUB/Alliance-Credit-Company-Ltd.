"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteCustomerDialog } from "@/components/customers/delete-customer-dialog";

export function DeleteCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50"
      >
        Delete
      </button>

      {open && (
        <DeleteCustomerDialog
          customerId={customerId}
          customerName={customerName}
          onClose={() => setOpen(false)}
          onDeleted={() => {
            router.push("/customers");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
