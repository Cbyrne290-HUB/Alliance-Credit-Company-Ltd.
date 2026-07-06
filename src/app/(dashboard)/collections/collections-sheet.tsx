"use client";

import { useState } from "react";
import { Users, CheckCircle2, Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import { fetchPaymentsForLoan, findNextPendingRow, savePaymentForRow } from "@/lib/loans";
import { fromISODate, formatRangeLabel, getWeekOfYear } from "@/lib/dates";
import { WeekPicker } from "@/components/ui/week-picker";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { useAgentContext } from "@/components/agent/agent-provider";
import type { CollectionLoan, NextPendingPayment } from "@/types/collections";

type WeekRange = { start: string; end: string };
type Filter = "ongoing" | "cleared" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ongoing", label: "Ongoing" },
  { key: "cleared", label: "Cleared" },
  { key: "all", label: "All" },
];

export function CollectionsSheet({
  loans,
  nextPendingByLoan: initialNextPendingByLoan,
  initialWeek,
}: {
  loans: CollectionLoan[];
  nextPendingByLoan: Record<string, NextPendingPayment>;
  initialWeek: WeekRange;
}) {
  const [week, setWeek] = useState<WeekRange>(initialWeek);
  const [filter, setFilter] = useState<Filter>("ongoing");
  const [loansState, setLoansState] = useState<Record<string, CollectionLoan>>(
    () => Object.fromEntries(loans.map((l) => [l.loanId, l])),
  );
  // Just the next unpaid week per active loan (from the next_pending_payments
  // view) — not each loan's full payment history. A loan's complete history
  // is only fetched on demand, right at the moment a save happens (see
  // performSave), rather than preloaded for every loan up front.
  const [nextPendingByLoan, setNextPendingByLoan] = useState<
    Record<string, NextPendingPayment>
  >(initialNextPendingByLoan);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingLoanId, setSavingLoanId] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const { activeAgent } = useAgentContext();

  function handleWeekChange(next: WeekRange) {
    setWeek(next);
    setBulkMessage(null);
    setBulkError(null);
  }

  async function performSave(loanId: string): Promise<{ ok: boolean }> {
    const loan = loansState[loanId];
    const nextPending = loan?.status === "active" ? nextPendingByLoan[loanId] : undefined;

    if (!loan || !nextPending) {
      return { ok: true };
    }

    const draftValue = drafts[loanId] ?? String(nextPending.amountDue);
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

    // Fetched fresh right here rather than kept preloaded for every loan —
    // computeLedger (inside savePaymentForRow) still gets the exact same
    // complete, week_number-ordered history for this loan it always did, so
    // the balance/arrears/cleared recomputation is byte-for-byte identical
    // to before; only the timing of the fetch changed.
    let existingPayments;
    try {
      existingPayments = await fetchPaymentsForLoan(supabase, loanId, activeAgent);
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [loanId]: err instanceof Error ? err.message : "Could not load payment history.",
      }));
      return { ok: false };
    }

    const result = await savePaymentForRow(
      supabase,
      {
        id: loan.loanId,
        total_repayable: loan.totalRepayable,
        weekly_payment: loan.weeklyPayment,
      },
      existingPayments,
      nextPending.id,
      amount,
      week.start,
      activeAgent,
    );

    if (!result.ok) {
      setRowErrors((prev) => ({ ...prev, [loanId]: result.error }));
      return { ok: false };
    }

    const newNextRow = findNextPendingRow(result.rows);
    setNextPendingByLoan((prev) => {
      const next = { ...prev };
      if (newNextRow) {
        next[loanId] = {
          id: newNextRow.id,
          weekNumber: newNextRow.week_number,
          amountDue: newNextRow.amount_due,
        };
      } else {
        delete next[loanId];
      }
      return next;
    });
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
      .filter((l) => l.status === "active" && Boolean(nextPendingByLoan[l.loanId]))
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

  const weekInfo = getWeekOfYear(fromISODate(week.start));
  const weekRangeLabel = formatRangeLabel(
    fromISODate(week.start),
    fromISODate(week.end),
  );
  const agentLabel = `Agent ${activeAgent}`;
  const printRows = allLoans.filter((l) => l.status === "active");

  const PRINT_COLUMN_SIZE = 25;
  const printPages: { left: CollectionLoan[]; right: CollectionLoan[] }[] = [];
  for (let i = 0; i < printRows.length; i += PRINT_COLUMN_SIZE * 2) {
    const chunk = printRows.slice(i, i + PRINT_COLUMN_SIZE * 2);
    printPages.push({
      left: chunk.slice(0, PRINT_COLUMN_SIZE),
      right: chunk.slice(PRINT_COLUMN_SIZE),
    });
  }
  if (printPages.length === 0) {
    printPages.push({ left: [], right: [] });
  }

  return (
    <>
      <div className="print:hidden">
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

        <div className="mt-6 flex items-center gap-4">
          <WeekPicker
            selectedWeek={week}
            onWeekChange={handleWeekChange}
            className="flex-1"
            labelSize="lg"
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="shrink-0 rounded-md bg-[#2563eb] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
          >
            Print Sheet
          </button>
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
                  const nextPending = isActive ? nextPendingByLoan[loan.loanId] : undefined;
                  const editable = Boolean(nextPending);
                  const value =
                    editable && nextPending
                      ? (drafts[loan.loanId] ?? String(nextPending.amountDue))
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
      </div>

      <div id="print-collection-sheet" className="hidden print:block">
        {printPages.map((page, pageIndex) => {
          const isLastPage = pageIndex === printPages.length - 1;
          return (
            <div key={pageIndex} className={pageIndex > 0 ? "break-before-page" : ""}>
              <div className="flex items-center gap-4 border-b-2 border-black pb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-print.png"
                  alt=""
                  className="h-14 w-auto shrink-0"
                />
                <div>
                  <p className="text-xl font-bold leading-tight text-black">
                    The Alliance Credit Company Ltd.
                  </p>
                  <p className="mt-1 text-xs font-medium text-black">
                    Week {weekInfo.week} · {weekRangeLabel}
                  </p>
                  <p className="text-xs font-medium text-black">{agentLabel}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-6">
                <div className="flex-1">
                  <PrintColumnTable rows={page.left} />
                </div>
                <div className="flex-1">
                  <PrintColumnTable rows={page.right} />
                </div>
              </div>

              {isLastPage && (
                <div className="mt-2 flex justify-end">
                  <table className="border-collapse text-[11px] text-black">
                    <tbody>
                      <tr>
                        <td className="w-[110px] border border-black bg-[#f0f0f0] px-2 py-1.5 font-bold">
                          Total
                        </td>
                        <td className="w-[100px] border border-black px-2 py-1.5">
                          &nbsp;
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PrintColumnTable({ rows }: { rows: CollectionLoan[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-[11px] text-black">
      <colgroup>
        <col className="w-[7%]" />
        <col className="w-[24%]" />
        <col className="w-[29%]" />
        <col className="w-[18%]" />
        <col className="w-[22%]" />
      </colgroup>
      <thead>
        <tr>
          <th className="border border-black bg-[#f0f0f0] px-1 py-1.5 text-left font-bold">
            #
          </th>
          <th className="border border-black bg-[#f0f0f0] px-1 py-1.5 text-left font-bold">
            Customer Name
          </th>
          <th className="border border-black bg-[#f0f0f0] px-1 py-1.5 text-left font-bold">
            Address
          </th>
          <th className="border border-black bg-[#f0f0f0] px-1 py-1.5 text-left font-bold">
            Amount Due
          </th>
          <th className="border border-black bg-[#f0f0f0] px-1 py-1.5 text-left font-bold">
            Paid
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.loanId}>
            <td className="border border-black px-1 py-1.5 align-top">
              {row.walkingOrder ?? "—"}
            </td>
            <td className="border border-black px-1 py-1.5 align-top">
              {row.customerName}
            </td>
            <td className="border border-black px-1 py-1.5 align-top">
              {row.address ?? ""}
            </td>
            <td className="border border-black px-1 py-1.5 align-top">
              {formatCurrency(row.weeklyPayment)}
            </td>
            <td className="border border-black px-1 py-1.5 align-top">&nbsp;</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
