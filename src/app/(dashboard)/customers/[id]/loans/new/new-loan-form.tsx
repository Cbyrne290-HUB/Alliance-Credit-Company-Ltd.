"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import {
  DEFAULT_INTEREST_RATE,
  DEFAULT_TERM_WEEKS,
  computeFinalWeekPayment,
  computeLoanFinancials,
  generateLoanReference,
} from "@/lib/loans";
import { useAgentContext } from "@/components/agent/agent-provider";

export function NewLoanForm({ customerId }: { customerId: string }) {
  const router = useRouter();
  const { activeAgent } = useAgentContext();
  const [loanReference, setLoanReference] = useState(() => generateLoanReference());
  const [principal, setPrincipal] = useState("");
  const [startWeek, setStartWeek] = useState("");
  const [termWeeks, setTermWeeks] = useState(String(DEFAULT_TERM_WEEKS));
  const [interestRate, setInterestRate] = useState(String(DEFAULT_INTEREST_RATE));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsedPrincipal = Number(principal);
  const parsedTermWeeks = Number(termWeeks);
  const parsedInterestRate = Number(interestRate);

  const preview = useMemo(() => {
    if (
      !principal ||
      !termWeeks ||
      !interestRate ||
      parsedPrincipal <= 0 ||
      parsedTermWeeks <= 0 ||
      parsedInterestRate < 0
    ) {
      return null;
    }
    return computeLoanFinancials(
      parsedPrincipal,
      parsedInterestRate,
      parsedTermWeeks,
    );
  }, [
    principal,
    termWeeks,
    interestRate,
    parsedPrincipal,
    parsedTermWeeks,
    parsedInterestRate,
  ]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const parsedStartWeek = Number(startWeek);

    if (!principal || parsedPrincipal <= 0) {
      setError("Enter a valid loan amount.");
      return;
    }
    if (!startWeek || !Number.isInteger(parsedStartWeek) || parsedStartWeek <= 0) {
      setError("Enter a valid start week number.");
      return;
    }
    if (!termWeeks || !Number.isInteger(parsedTermWeeks) || parsedTermWeeks <= 0) {
      setError("Enter a valid term in weeks.");
      return;
    }
    if (!interestRate || parsedInterestRate < 0) {
      setError("Enter a valid interest rate.");
      return;
    }

    setSaving(true);

    const { interest, totalRepayable, weeklyPayment } = computeLoanFinancials(
      parsedPrincipal,
      parsedInterestRate,
      parsedTermWeeks,
    );

    const supabase = createClient();

    const { data: loan, error: loanError } = await supabase
      .from("loans")
      .insert({
        agent: activeAgent,
        customer_id: customerId,
        loan_reference: loanReference.trim() || generateLoanReference(),
        principal: parsedPrincipal,
        interest,
        total_repayable: totalRepayable,
        weekly_payment: weeklyPayment,
        term_weeks: parsedTermWeeks,
        start_week: parsedStartWeek,
        status: "active",
        balance: totalRepayable,
        arrears: 0,
      })
      .select("id")
      .single();

    if (loanError || !loan) {
      setError(loanError?.message ?? "Could not create loan. Please try again.");
      setSaving(false);
      return;
    }

    const finalWeekPayment = computeFinalWeekPayment(
      totalRepayable,
      weeklyPayment,
      parsedTermWeeks,
    );

    const schedule = Array.from({ length: parsedTermWeeks }, (_, i) => ({
      agent: activeAgent,
      loan_id: loan.id,
      week_number: parsedStartWeek + i,
      amount_due: i === parsedTermWeeks - 1 ? finalWeekPayment : weeklyPayment,
      status: "pending",
      flagged: false,
    }));

    const { error: scheduleError } = await supabase
      .from("payments")
      .insert(schedule);

    if (scheduleError) {
      setError(
        `Loan created, but the payment schedule failed to generate: ${scheduleError.message}`,
      );
      setSaving(false);
      return;
    }

    router.push(`/loans/${loan.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <Field
        label="Loan Reference"
        value={loanReference}
        onChange={setLoanReference}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Loan Amount (€)"
          type="number"
          value={principal}
          onChange={setPrincipal}
          required
        />
        <Field
          label="Start Week Number"
          type="number"
          value={startWeek}
          onChange={setStartWeek}
          required
        />
        <Field
          label="Term (weeks)"
          type="number"
          value={termWeeks}
          onChange={setTermWeeks}
          required
        />
        <Field
          label="Interest Rate (%)"
          type="number"
          value={interestRate}
          onChange={setInterestRate}
          required
        />
      </div>

      {preview && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
          <PreviewStat label="Interest" value={formatCurrency(preview.interest)} />
          <PreviewStat
            label="Total Repayable"
            value={formatCurrency(preview.totalRepayable)}
          />
          <PreviewStat
            label="Weekly Payment"
            value={formatCurrency(preview.weeklyPayment)}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Creating Loan..." : "Create Loan"}
      </button>
    </form>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      />
    </div>
  );
}
