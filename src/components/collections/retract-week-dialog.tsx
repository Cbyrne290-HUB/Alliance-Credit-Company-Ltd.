"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { previewRetractWeek, type RetractPreview, type RetractWeek } from "@/lib/retract-week";
import { useAgentContext } from "@/components/agent/agent-provider";

type PreviewState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; preview: RetractPreview };

/**
 * Confirmation for Retract Week. Loads a preview of exactly what would be
 * retracted before anything is touched, refuses outright if this agent has
 * payments dated after the week, and only calls onConfirm on an explicit
 * click. The retract itself (and per-row error reporting) is run by the
 * caller, which re-checks everything fresh at that point.
 */
export function RetractWeekDialog({
  week,
  weekLabel,
  onClose,
  onConfirm,
}: {
  week: RetractWeek;
  weekLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { activeAgent } = useAgentContext();
  const [state, setState] = useState<PreviewState>({ kind: "loading" });
  const [retracting, setRetracting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    previewRetractWeek(createClient(), activeAgent, week)
      .then((preview) => {
        if (!cancelled) setState({ kind: "ready", preview });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "Could not load the week's payments.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeAgent, week]);

  function close() {
    if (retracting) return;
    onClose();
  }

  async function handleConfirm() {
    setRetracting(true);
    await onConfirm();
  }

  const preview = state.kind === "ready" ? state.preview : null;
  const blocked = Boolean(preview && preview.laterPaymentCount > 0);
  const canConfirm = Boolean(preview && !blocked && preview.paymentCount > 0) && !retracting;
  const agentLabel = `Agent ${activeAgent}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-base font-semibold text-slate-900">Retract week</h2>

        {state.kind === "loading" && (
          <p className="mt-2 text-sm text-slate-600">Checking this week&apos;s payments...</p>
        )}

        {state.kind === "error" && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.message}
          </p>
        )}

        {preview && blocked && (
          <p role="alert" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {agentLabel} has {preview.laterPaymentCount} payment
            {preview.laterPaymentCount === 1 ? "" : "s"} dated after {weekLabel}. Only the most
            recent week can be retracted — retract later weeks first.
          </p>
        )}

        {preview && !blocked && preview.paymentCount === 0 && (
          <p className="mt-2 text-sm text-slate-600">
            There are no Collections-page payments to retract for {agentLabel}, {weekLabel}.
          </p>
        )}

        {preview && !blocked && preview.paymentCount > 0 && (
          <p className="mt-2 text-sm text-slate-600">
            Retract{" "}
            <span className="font-semibold text-slate-900">
              {preview.paymentCount} payment{preview.paymentCount === 1 ? "" : "s"}
            </span>{" "}
            totalling{" "}
            <span className="font-semibold text-slate-900">{formatCurrency(preview.total)}</span>{" "}
            across{" "}
            <span className="font-semibold text-slate-900">
              {preview.loanIds.length} loan{preview.loanIds.length === 1 ? "" : "s"}
            </span>{" "}
            for {agentLabel}, {weekLabel}? This sets them back to unpaid and recalculates
            balances. This cannot be undone.
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={retracting}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          {preview && !blocked && preview.paymentCount > 0 && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {retracting ? "Retracting..." : "Retract week"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
