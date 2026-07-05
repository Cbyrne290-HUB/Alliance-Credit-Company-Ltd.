"use client";

import { useState } from "react";
import { sendArrearsReminderAction } from "@/lib/sms-actions";

export function ArrearsReminderButton({
  loanId,
  customerName,
  phone,
}: {
  loanId: string;
  customerName: string;
  phone: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setSending(true);
    setError(null);
    const result = await sendArrearsReminderAction(loanId);
    setSending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setSentMessage("Reminder sent.");
  }

  if (!phone) {
    return (
      <p className="text-xs text-slate-400">
        No phone number on file — cannot send a reminder.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setSentMessage(null);
            setOpen(true);
          }}
          className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50"
        >
          Send Arrears Reminder
        </button>
        {sentMessage && (
          <p className="text-xs font-medium text-emerald-700">{sentMessage}</p>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-base font-semibold text-slate-900">
              Send arrears reminder
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Send arrears reminder to {customerName} at {phone}?
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
                onClick={() => setOpen(false)}
                disabled={sending}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={sending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
