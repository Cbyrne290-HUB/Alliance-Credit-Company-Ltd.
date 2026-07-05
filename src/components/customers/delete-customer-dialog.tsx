"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteCustomerCascade } from "@/lib/customers";
import { useAgentContext } from "@/components/agent/agent-provider";

export function DeleteCustomerDialog({
  customerId,
  customerName,
  onClose,
  onDeleted,
}: {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { activeAgent } = useAgentContext();

  function close() {
    if (deleting) return;
    onClose();
  }

  async function handleConfirm() {
    setDeleting(true);
    setError(null);

    const supabase = createClient();
    const result = await deleteCustomerCascade(supabase, customerId, activeAgent);

    if (!result.ok) {
      setDeleting(false);
      setError(result.error);
      return;
    }

    onDeleted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-base font-semibold text-slate-900">
          Delete customer
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to permanently delete {customerName}? This
          will remove them and all their loans and payment history. This
          cannot be undone.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={deleting}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
