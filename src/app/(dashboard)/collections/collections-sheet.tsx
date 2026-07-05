"use client";

import { useMemo, useState } from "react";
import { Users, CheckCircle2, Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { findNextPendingRow, savePaymentForRow } from "@/lib/loans";
import { WeekPicker } from "@/components/ui/week-picker";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { useAgentContext } from "@/components/agent/agent-provider";
import type { Payment } from "@/types/loan";
import type { CollectionLoan } from "@/types/collections";

type WeekRange = { start: string; end: string };
type Filter = "ongoing" | "cleared" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ongoing", label: "Ongoing" },
  { key: "cleared", label: "Cleared" },
  { key: "all", label: "All" },
];

export function CollectionsSheet({
  loans,
  paymentsByLoan,
  initialWeek,
}: {
  loans: CollectionLoan[];
  paymentsByLoan: Record<string, Payment[]>;
  initialWeek: WeekRange;
}) {
  const [week, setWeek] = useState<WeekRange>(initialWeek);
  const [filter, setFilter] = useState<Filter>("ongoing");
  const [loansState, setLoansState] = useState<Record<string, CollectionLoan>>(
    () => Object.fromEntries(loans.map((l) => [l.loanId, l])),
  );
  const [paymentsState, setPaymentsState] =
    useState<Record<string, Payment[]>>(paymentsByLoan);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingLoanId, setSavingLoanId] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const { activeAgent } = useAgentContext();

  // The row each active loan would record a payment against — always its
  // next unpaid week, same as the Loan Ledger. The selected week only
  // controls what payment_date gets stamped, not which row is targeted.
  const nextRowByLoan = useMemo(() => {
    const map: Record<string, Payment | null> = {};
    for (const loan of Object.values(loansState)) {
      if (loan.status !== "active") continue;
      map[loan.loanId] = findNextPendingRow(paymentsState[loan.loanId] ?? []);
    }
    return map;
  }, [loansState, paymentsState]);

  function handleWeekChange(next: WeekRange) {
    setWeek(next);
    setBulkMessage(null);
    setBulkError(null);
  }

  async function performSave(loanId: string): Promise<{ ok: boolean }> {
    const loan = loansState[loanId];
    const row = nextRowByLoan[loanId];

    if (!loan || !row) {
      return { ok: true };
    }

    const draftValue = drafts[loanId] ?? String(row.amount_due);
    const trimmed = draftValue.trim();
    const amount = Number(trimmed);

    if (trimmed === "" || Number.isNaN(amount) || amount < 0) {
      setRowErrors((prev) => ({ ...prev, [loanId]: "Enter a valid amount." }));
      return { ok: false };
    }

    setRowErrors((prev) => {
      if (!(loanId in prev)) return prev;
      const next = { ...prev };
      delete next[loanId];
      return next;
    });

    const supabase = createClient();
    const result = await savePaymentForRow(
      supabase,
      {
        id: loan.loanId,
        total_repayable: loan.totalRepayable,
        weekly_payment: loan.weeklyPayment,
      },
      paymentsState[loanId] ?? [],
      row.id,
      amount,
      week.start,
      activeAgent,
    );

    if (!result.ok) {
      setRowErrors((prev) => ({ ...prev, [loanId]: result.error }));
      return { ok: false };
    }

    setPaymentsState((prev) => ({
      ...prev,
      [loanId]: result.rows,
    }));
    setLoansState((prev) => ({
      ...prev,
      [loanId]: {
        ...prev[loanId],
        balance: result.balance,
        arrears: result.arrears,
        status: result.status,
      },
    }));
    setDrafts((prev) => {
      if (!(loanId in prev)) return prev;
      const next = { ...prev };
      delete next[loanId];
      return next;
    });

    return { ok: true };
  }

  async function handleSaveRow(loanId: string) {
    setSavingLoanId(loanId);
    setBulkMessage(null);
    setBulkError(null);
    await performSave(loanId);
    setSavingLoanId(null);
  }

  async function handleSaveAll() {
    setIsSavingAll(true);
    setBulkMessage(null);
    setBulkError(null);

    const eligibleLoanIds = filteredLoans
      .filter((l) => Boolean(nextRowByLoan[l.loanId]))
      .map((l) => l.loanId);

    const results = await Promise.all(eligibleLoanIds.map((id) => performSave(id)));

    setIsSavingAll(false);

    const failedCount = results.filter((r) => !r.ok).length;
    if (eligibleLoanIds.length === 0) {
      setBulkMessage("Nothing to save for this week.");
    } else if (failedCount > 0) {
      setBulkError(
        `${failedCount} of ${eligibleLoanIds.length} payments failed to save. Check the highlighted rows.`,
      );
    } else {
      setBulkMessage(
        `Saved ${eligibleLoanIds.length} payment${eligibleLoanIds.length === 1 ? "" : "s"}.`,
      );
    }
  }

  const allLoans = Object.values(loansState);
  const filteredLoans = allLoans.filter((loan) => {
    if (filter === "ongoing") return loan.status === "active";
    if (filter === "cleared") return loan.status === "cleared";
    return true;
  });

  const ongoingCount = allLoans.filter((l) => l.status === "active").length;
  const clearedCount = allLoans.filter((l) => l.status === "cleared").length;
  const totalOutstanding = allLoans
    .filter((l) => l.status === "active")
    .reduce((sum, l) => sum + l.balance, 0);

  return (
    <>
      <PageHeader
        title="Collections"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Collections" }]}
      />
      <div className="px-8 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Ongoing Loans"
            value={String(ongoingCount)}
            icon={<Users className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            label="Cleared Loans"
            value={String(clearedCount)}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            label="Total Outstanding"
            value={formatCurrency(totalOutstanding)}
            icon={<Landmark className="h-5 w-5" />}
            color="purple"
          />
        </div>

        <div className="mt-6">
          <WeekPicker selectedWeek={week} onWeekChange={handleWeekChange} />
        </div>

        <div className="mt-6 flex items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={
                filter === f.key
                  ? "rounded-full bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition-colors"
                  : "rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Amount Due</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      No customers to show.
                    </td>
                  </tr>
                )}

                {filteredLoans.map((loan) => {
                  const isActive = loan.status === "active";
                  const row = nextRowByLoan[loan.loanId];
                  const editable = isActive && Boolean(row);
                  const value =
                    editable && row
                      ? (drafts[loan.loanId] ?? String(row.amount_due))
                      : "";
                  const error = rowErrors[loan.loanId];

                  return (
                    <tr key={loan.loanId} className={error ? "bg-red-50/60" : ""}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={loan.customerName} size="sm" />
                          <div>
                            <p className="font-medium text-slate-900">
                              {loan.customerName}
                            </p>
                            <p className="text-xs text-slate-400">
                              {loan.loanReference}
                            </p>
                          </div>
                        </div>
                        {error && (
                          <p className="mt-1 text-xs text-red-600">{error}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isActive ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Ongoing
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Cleared</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editable ? (
                          <input
                            type="number"
                            step="any"
                            value={value}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [loan.loanId]: e.target.value,
                              }))
                            }
                            disabled={savingLoanId === loan.loanId || isSavingAll}
                            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-900">
                          {formatCurrency(loan.balance)}
                        </span>
                        {isActive && loan.arrears > 0 && (
                          <span className="ml-2 text-xs font-medium text-red-600">
                            Arrears {formatCurrency(loan.arrears)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editable && (
                          <button
                            type="button"
                            onClick={() => handleSaveRow(loan.loanId)}
                            disabled={savingLoanId === loan.loanId || isSavingAll}
                            className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingLoanId === loan.loanId ? "Saving..." : "Save"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {(bulkMessage || bulkError) && (
            <p
              className={`border-t border-slate-100 px-4 py-3 text-sm ${
                bulkError ? "text-red-700" : "text-emerald-700"
              }`}
            >
              {bulkError ?? bulkMessage}
            </p>
          )}

          {filteredLoans.some((l) => l.status === "active") && (
            <div className="border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSavingAll || savingLoanId !== null}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingAll ? "Saving All..." : "Save All"}
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
