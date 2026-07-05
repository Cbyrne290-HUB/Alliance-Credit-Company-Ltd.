"use client";

import { useState } from "react";
import {
  getChristmasBroadcastPreviewAction,
  sendChristmasBroadcastAction,
} from "@/lib/sms-actions";

type Step = "idle" | "loading" | "confirm" | "sending" | "done" | "error";

export function ChristmasBroadcastButton() {
  const [step, setStep] = useState<Step>("idle");
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);

  async function handleOpen() {
    setStep("loading");
    setError(null);
    setSummary(null);
    const preview = await getChristmasBroadcastPreviewAction();
    if (!preview.ok) {
      setError(preview.error);
      setStep("error");
      return;
    }
    setCount(preview.count);
    setStep("confirm");
  }

  async function handleConfirm() {
    setStep("sending");
    const result = await sendChristmasBroadcastAction();
    if (!result.ok) {
      setError(result.error);
      setStep("error");
      return;
    }
    setSummary(result);
    setStep("done");
  }

  function close() {
    setStep("idle");
  }

  const dialogOpen =
    step === "confirm" || step === "sending" || step === "done" || step === "error";

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={step === "loading"}
        className="rounded-md bg-[#2563eb] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {step === "loading" ? "Checking..." : "Send Christmas Message"}
      </button>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-base font-semibold text-slate-900">
              Send Christmas message
            </h2>

            {step === "confirm" && (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Send the Christmas message to {count} customer
                  {count === 1 ? "" : "s"}? This will send {count} text message
                  {count === 1 ? "" : "s"}.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={count === 0}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Send
                  </button>
                </div>
              </>
            )}

            {step === "sending" && (
              <p className="mt-2 text-sm text-slate-600">
                Sending {count} message{count === 1 ? "" : "s"}...
              </p>
            )}

            {step === "done" && summary && (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Sent {summary.sent} of {summary.total} messages successfully
                  {summary.failed > 0 ? `; ${summary.failed} failed.` : "."}
                </p>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {step === "error" && error && (
              <>
                <p
                  role="alert"
                  className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {error}
                </p>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
