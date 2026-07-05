"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { fromISODate } from "@/lib/dates";
import { findNextPendingRow, savePaymentForRow, weeksRemaining } from "@/lib/loans";
import { PageHeader } from "@/components/layout/page-header";
import { WeekLabel } from "@/components/ui/week-label";
import { useAgentContext } from "@/components/agent/agent-provider";
import type { Loan, Payment } from "@/types/loan";
import type { Customer } from "@/types/customer";

type LoanState = {
  balance: number;
  arrears: number;
  status: string;
};

function nextPendingId(rows: Payment[]) {
  return findNextPendingRow(rows)?.id ?? null;
}

export function LoanLedger({
  loan,
  payments,
  customer,
}: {
  loan: Loan;
  payments: Payment[];
  customer: Pick<Customer, "id" | "first_name" | "surname"> | null;
}) {
  const [paymentsState, setPaymentsState] = useState(payments);
  const [loanState, setLoanState] = useState<LoanState>({
    balance: loan.balance,
    arrears: loan.arrears ?? 0,
    status: loan.status ?? "active",
  });
  const [activeRowId, setActiveRowId] = useState<string | null>(
    loanState.status === "cleared" ? null : nextPendingId(payments),
  );
  const [draftAmount, setDraftAmount] = useState("");
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const { activeAgent } = useAgentContext();

  const isCleared = loanState.status === "cleared";

  function startEditing(row: Payment) {
    setActiveRowId(row.id);
    setDraftAmount(row.amount_paid !== null ? String(row.amount_paid) : "");
    setRowError(null);
  }

  function cancelEditing() {
    setActiveRowId(isCleared ? null : nextPendingId(paymentsState));
    setDraftAmount("");
    setRowError(null);
  }

  async function handleSave() {
    if (!activeRowId) return;

    const trimmed = draftAmount.trim();
    const amount = Number(trimmed);

    if (trimmed === "" || Number.isNaN(amount) || amount < 0) {
      setRowError("Enter a valid amount.");
      return;
    }

    setSavingRowId(activeRowId);
    setRowError(null);

    const today = new Date().toISOString().slice(0, 10);
    const supabase = createClient();

    const result = await savePaymentForRow(
      supabase,
      {
        id: loan.id,
        total_repayable: loan.total_repayable,
        weekly_payment: loan.weekly_payment,
      },
      paymentsState,
      activeRowId,
      amount,
      today,
      activeAgent,
    );

    setSavingRowId(null);

    if (!result.ok) {
      setRowError(result.error);
      return;
    }

    setPaymentsState(result.rows);
    setLoanState({
      balance: result.balance,
      arrears: result.arrears,
      status: result.status,
    });
    setActiveRowId(result.status === "cleared" ? null : nextPendingId(result.rows));
    setDraftAmount("");
  }

  const summary = [
    { label: "Amount Borrowed", value: formatCurrency(loan.principal) },
    { label: "Interest", value: formatCurrency(loan.interest) },
    { label: "Total Repayable", value: formatCurrency(loan.total_repayable) },
    { label: "Weekly Payment", value: formatCurrency(loan.weekly_payment) },
    { label: "Current Balance", value: formatCurrency(loanState.balance) },
    {
      label: "Weeks Remaining",
      value: String(weeksRemaining(loanState.balance, loan.weekly_payment)),
    },
  ];

  const customerName = customer
    ? `${customer.first_name} ${customer.surname}`
    : "Customers";

  return (
    <>
      <PageHeader
        title={loan.loan_reference}
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Customers", href: "/customers" },
          ...(customer
            ? [{ label: customerName, href: `/customers/${customer.id}` }]
            : []),
          { label: loan.loan_reference },
        ]}
      />
      <div className="px-8 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {loan.loan_reference}
            </h1>
            {isCleared ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                Cleared
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Active
              </span>
            )}
          </div>

          {loanState.arrears > 0 && !isCleared && (
            <p className="mt-2 text-sm text-red-600">
              In arrears: {formatCurrency(loanState.arrears)}
            </p>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3">
            {summary.map((s) => (
              <div key={s.label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {s.label}
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Amount Due</th>
                  <th className="px-4 py-3">Amount Paid</th>
                  <th className="px-4 py-3">Balance</th>
                  <th className="px-4 py-3">Weeks Left</th>
                  <th className="px-4 py-3">Arrears</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentsState.map((row) => {
                  const isProcessed = row.amount_paid !== null;
                  const isActive = row.id === activeRowId;
                  const isLocked = !isProcessed && !isActive;

                  return (
                    <tr
                      key={row.id}
                      className={
                        row.flagged
                          ? "bg-red-50/60"
                          : isActive
                            ? "bg-slate-50"
                            : isLocked
                              ? "text-slate-400"
                              : ""
                      }
                    >
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {row.week_number}
                      </td>
                      <td className="px-4 py-3">
                        {formatCurrency(row.amount_due)}
                      </td>
                      <td className="px-4 py-3">
                        {isActive ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="any"
                              autoFocus
                              value={draftAmount}
                              onChange={(e) => setDraftAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSave();
                                }
                              }}
                              disabled={savingRowId === row.id}
                              className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                            />
                            <button
                              type="button"
                              onClick={handleSave}
                              disabled={savingRowId === row.id}
                              className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {savingRowId === row.id ? "Saving..." : "Save"}
                            </button>
                            {isProcessed && (
                              <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={savingRowId === row.id}
                                className="text-xs text-slate-500 hover:text-slate-700"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        ) : isProcessed ? (
                          <div className="flex items-center gap-2">
                            <span>{formatCurrency(row.amount_paid!)}</span>
                            <button
                              type="button"
                              onClick={() => startEditing(row)}
                              className="text-xs text-slate-500 hover:text-slate-700"
                            >
                              Edit
                            </button>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.balance_after !== null
                          ? formatCurrency(row.balance_after)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.balance_after !== null
                          ? weeksRemaining(row.balance_after, loan.weekly_payment)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.arrears_after !== null && row.arrears_after > 0 ? (
                          <span className="font-medium text-red-600">
                            {formatCurrency(row.arrears_after)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.payment_date ? (
                          <WeekLabel
                            date={fromISODate(row.payment_date)}
                            dateLabel={formatDate(row.payment_date)}
                            size="sm"
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isCleared && (
            <p className="border-t border-slate-100 px-4 py-3 text-sm text-emerald-700">
              This loan is cleared — no further payments due.
            </p>
          )}

          {rowError && (
            <p
              role="alert"
              className="border-t border-slate-100 px-4 py-3 text-sm text-red-700"
            >
              {rowError}
            </p>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "paid") {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Paid
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        Arrears
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
      Pending
    </span>
  );
}
