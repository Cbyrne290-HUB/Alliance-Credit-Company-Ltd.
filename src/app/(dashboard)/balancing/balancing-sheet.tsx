"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { round2 } from "@/lib/loans";
import {
  computeClosingBalance,
  fetchSavedReconciliation,
  saveReconciliation,
} from "@/lib/reconciliation";
import { WeekPicker } from "@/components/ui/week-picker";
import { PageHeader } from "@/components/layout/page-header";
import { useAgentContext } from "@/components/agent/agent-provider";

type WeekRange = { start: string; end: string };

type DifferenceStatus = {
  amountClass: string;
  pillClass: string;
  pillLabel: string;
};

function getDifferenceStatus(difference: number | null): DifferenceStatus {
  if (difference === null) {
    return {
      amountClass: "text-slate-400",
      pillClass: "bg-slate-100 text-slate-500",
      pillLabel: "Enter handheld balance",
    };
  }
  if (difference === 0) {
    return {
      amountClass: "text-emerald-600",
      pillClass: "bg-emerald-50 text-emerald-700",
      pillLabel: "Balanced",
    };
  }
  if (difference > 0) {
    return {
      amountClass: "text-red-600",
      pillClass: "bg-red-50 text-red-700",
      pillLabel: "Short",
    };
  }
  return {
    amountClass: "text-amber-600",
    pillClass: "bg-amber-50 text-amber-700",
    pillLabel: "Over",
  };
}

export function BalancingSheet({
  initialWeek,
  initialClosingBalance,
  initialHandheldBalance,
}: {
  initialWeek: WeekRange;
  initialClosingBalance: number;
  initialHandheldBalance: number | null;
}) {
  const { activeAgent } = useAgentContext();
  const [week, setWeek] = useState<WeekRange>(initialWeek);
  const [closingBalance, setClosingBalance] = useState(initialClosingBalance);
  const [handheldDraft, setHandheldDraft] = useState(
    initialHandheldBalance !== null ? String(initialHandheldBalance) : "",
  );
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function handleWeekChange(next: WeekRange) {
    setWeek(next);
    setError(null);
    setSavedMessage(null);
    startTransition(async () => {
      const supabase = createClient();
      const [nextClosingBalance, saved] = await Promise.all([
        computeClosingBalance(supabase, activeAgent, next.start, next.end),
        fetchSavedReconciliation(supabase, activeAgent, next.start),
      ]);
      setClosingBalance(nextClosingBalance);
      setHandheldDraft(saved !== null ? String(saved.handheldBalance) : "");
    });
  }

  const trimmedDraft = handheldDraft.trim();
  const handheldNumber = trimmedDraft === "" ? null : Number(trimmedDraft);
  const hasValidHandheld = handheldNumber !== null && !Number.isNaN(handheldNumber);
  const difference = hasValidHandheld
    ? round2(closingBalance - handheldNumber)
    : null;
  const status = getDifferenceStatus(difference);

  async function handleSave() {
    if (!hasValidHandheld) {
      setError("Enter a valid handheld balance.");
      return;
    }

    setSaving(true);
    setError(null);
    setSavedMessage(null);

    const supabase = createClient();
    const result = await saveReconciliation(
      supabase,
      activeAgent,
      week.start,
      handheldNumber,
      closingBalance,
    );

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSavedMessage("Saved.");
  }

  return (
    <>
      <PageHeader
        title="Balancing"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Balancing" }]}
      />
      <div className="px-8 py-8">
        <div className="mx-auto max-w-3xl">
          <WeekPicker selectedWeek={week} onWeekChange={handleWeekChange} />

          <div
            className={`mt-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm transition-opacity duration-200 ${
              isPending ? "opacity-60" : ""
            }`}
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Closing Balance
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                  {formatCurrency(closingBalance)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Recorded as collected this week
                </p>
              </div>

              <div>
                <label
                  htmlFor="handheld-balance"
                  className="block text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                  Handheld Balance
                </label>
                <input
                  id="handheld-balance"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={handheldDraft}
                  onChange={(e) => {
                    setHandheldDraft(e.target.value);
                    setSavedMessage(null);
                  }}
                  disabled={isPending}
                  placeholder="0.00"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-2xl font-semibold text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
                <p className="mt-1 text-xs text-slate-400">Physical cash counted</p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Difference
                </p>
                <p
                  className={`mt-1 text-2xl font-semibold tracking-tight ${status.amountClass}`}
                >
                  {difference === null ? "—" : formatCurrency(Math.abs(difference))}
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${status.pillClass}`}
                >
                  {status.pillLabel}
                </span>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-6">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || isPending || !hasValidHandheld}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Handheld Balance"}
              </button>
              {savedMessage && (
                <p className="text-sm text-emerald-700">{savedMessage}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
