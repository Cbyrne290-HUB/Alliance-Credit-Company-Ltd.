"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAgentContext } from "@/components/agent/agent-provider";
import { PageHeader } from "@/components/layout/page-header";
import { formatCurrency, formatDate } from "@/lib/format";
import { DEFAULT_INTEREST_RATE, computeLoanFinancials } from "@/lib/loans";
import { getWeekOfYear } from "@/lib/dates";
import { approveApplication, declineApplication } from "@/lib/applications";
import type { DeclarationSignatureKey } from "@/lib/declarations";
import type { Application, ApplicationStatus } from "@/types/application";
import { DeclarationsSection } from "./declarations-section";

type DocumentView = { label: string; path: string | null; signedUrl: string | null };

function StatusBanner({ status }: { status: ApplicationStatus }) {
  if (status === "approved") {
    return (
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        This application has been approved.
      </p>
    );
  }
  if (status === "declined") {
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        This application has been declined.
      </p>
    );
  }
  return (
    <p className="rounded-lg bg-amber-100 px-4 py-3 text-sm font-medium text-amber-800">
      Awaiting review.
    </p>
  );
}

type DetailItem = {
  label: string;
  value: string;
  fullWidth?: boolean;
  muted?: boolean;
};

function DetailSection({ title, items }: { title: string; items: DetailItem[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h2>
      <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className={item.fullWidth ? "sm:col-span-2" : undefined}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {item.label}
            </dt>
            <dd
              className={`mt-1 text-sm whitespace-pre-wrap ${
                item.muted ? "text-slate-400 italic" : "text-slate-900"
              }`}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DeclineDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeclining(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decline application.");
      setDeclining(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h2 className="text-base font-semibold text-slate-900">Decline application</h2>
        <p className="mt-2 text-sm text-slate-600">
          The application will be marked as declined, and its uploaded documents and signed
          declarations will be permanently deleted from storage. This cannot be undone.
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={declining}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={declining}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {declining ? "Declining..." : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveDialog({
  application,
  onClose,
  onConfirm,
}: {
  application: Application;
  onClose: () => void;
  onConfirm: (values: {
    accountNumber: string;
    walkingOrder: string;
    startWeek: string;
  }) => Promise<void>;
}) {
  const [accountNumber, setAccountNumber] = useState("");
  const [walkingOrder, setWalkingOrder] = useState("");
  const [startWeek, setStartWeek] = useState(String(getWeekOfYear(new Date()).week));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { interest, totalRepayable, weeklyPayment } = computeLoanFinancials(
    application.loan_amount,
    DEFAULT_INTEREST_RATE,
    application.loan_term_weeks,
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!accountNumber.trim()) {
      setError("Enter an account number for the new customer.");
      return;
    }
    const parsedStartWeek = Number(startWeek);
    if (!startWeek || !Number.isInteger(parsedStartWeek) || parsedStartWeek <= 0) {
      setError("Enter a valid start week number.");
      return;
    }

    setSaving(true);
    try {
      await onConfirm({ accountNumber: accountNumber.trim(), walkingOrder, startWeek });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve application.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
      >
        <h2 className="text-base font-semibold text-slate-900">Approve application</h2>
        <p className="mt-2 text-sm text-slate-600">
          This creates a new customer and a{" "}
          {formatCurrency(application.loan_amount)} loan over {application.loan_term_weeks}{" "}
          weeks at {DEFAULT_INTEREST_RATE}% interest.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Interest</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{formatCurrency(interest)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Total Repayable
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {formatCurrency(totalRepayable)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Weekly Payment
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {formatCurrency(weeklyPayment)}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Account Number</label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              autoFocus
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Walking Order (optional)
              </label>
              <input
                type="number"
                value={walkingOrder}
                onChange={(e) => setWalkingOrder(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Start Week</label>
              <input
                type="number"
                required
                value={startWeek}
                onChange={(e) => setStartWeek(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Approving..." : "Approve & Create Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ApplicationDetail({
  application: initialApplication,
  documents,
  signatureUrls,
}: {
  application: Application;
  documents: DocumentView[];
  signatureUrls: Record<DeclarationSignatureKey, string | null>;
}) {
  const { activeAgent } = useAgentContext();
  const [application, setApplication] = useState(initialApplication);
  const [approveOpen, setApproveOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ label: string; url: string } | null>(null);
  const [newCustomer, setNewCustomer] = useState<{ id: string } | null>(null);
  const [cleanupWarning, setCleanupWarning] = useState<string | null>(null);

  const fullName = `${application.first_name} ${application.last_name}`;

  async function handleDecline() {
    const supabase = createClient();
    const result = await declineApplication(supabase, application.id);
    if (!result.ok) throw new Error(result.error);
    setApplication((prev) => ({ ...prev, status: "declined" }));
    setCleanupWarning(
      result.filesDeleted
        ? null
        : `Application declined, but its uploaded files could not be removed automatically (${result.cleanupError}). Delete them manually from the application-documents bucket.`,
    );
    setDeclineOpen(false);
  }

  async function handleApprove(values: {
    accountNumber: string;
    walkingOrder: string;
    startWeek: string;
  }) {
    const supabase = createClient();
    const result = await approveApplication(supabase, {
      application,
      activeAgent,
      accountNumber: values.accountNumber,
      walkingOrder: values.walkingOrder.trim() === "" ? null : Number(values.walkingOrder),
      startWeek: Number(values.startWeek),
    });

    if (!result.ok) throw new Error(result.error);

    setApplication((prev) => ({ ...prev, status: "approved" }));
    setNewCustomer({ id: result.customerId });
    setApproveOpen(false);
  }

  const reasonForBorrowing = application.reason_for_borrowing?.trim() || null;

  const loanDetails = [
    { label: "Loan Amount", value: formatCurrency(application.loan_amount) },
    { label: "Term", value: `${application.loan_term_weeks} weeks` },
    { label: "Submitted", value: formatDate(application.created_at) },
    {
      label: "Reason for Borrowing",
      value: reasonForBorrowing ?? "Not provided",
      fullWidth: true,
      muted: !reasonForBorrowing,
    },
  ];

  const personalDetails = [
    { label: "Full Name", value: fullName },
    { label: "Address", value: application.address ?? "—" },
    { label: "Eircode", value: application.eircode ?? "—" },
    { label: "Phone", value: application.phone ?? "—" },
    { label: "Marital Status", value: application.marital_status ?? "—" },
    { label: "Dependants", value: application.dependants?.toString() ?? "—" },
    { label: "Residential Status", value: application.residential_status ?? "—" },
    {
      label: "Housing Cost",
      value: application.housing_cost != null ? formatCurrency(application.housing_cost) : "—",
    },
  ];

  const incomeDetails = [
    { label: "Employment Status", value: application.employment_status ?? "—" },
    { label: "Income Frequency", value: application.income_frequency ?? "—" },
    {
      label: "Income After Tax",
      value:
        application.income_after_tax != null ? formatCurrency(application.income_after_tax) : "—",
    },
  ];

  return (
    <>
      <PageHeader
        title={fullName}
        breadcrumb={[
          { label: "Home", href: "/dashboard" },
          { label: "Applications", href: "/applications" },
          { label: fullName },
        ]}
      />
      <div className="px-8 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {cleanupWarning && (
            <p role="alert" className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {cleanupWarning}
            </p>
          )}

          <div className="flex items-center justify-between gap-4">
            <StatusBanner status={application.status} />
            {application.status === "pending" && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setDeclineOpen(true)}
                  className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => setApproveOpen(true)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  Approve
                </button>
              </div>
            )}
          </div>

          {newCustomer && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-medium text-emerald-800">
                Customer created from this application.
              </p>
              <Link
                href={`/customers/${newCustomer.id}`}
                className="shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
              >
                View Customer
              </Link>
            </div>
          )}

          <DetailSection title="Loan Details" items={loanDetails} />
          <DetailSection title="Personal Details" items={personalDetails} />
          <DetailSection title="Employment & Income" items={incomeDetails} />

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Documents
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {documents.map((doc) => (
                <div key={doc.label} className="flex flex-col gap-1.5">
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    {doc.signedUrl ? (
                      <button
                        type="button"
                        onClick={() => setLightbox({ label: doc.label, url: doc.signedUrl! })}
                        className="block h-full w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={doc.signedUrl}
                          alt={doc.label}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-center text-xs text-slate-400">
                        Not provided
                      </div>
                    )}
                  </div>
                  <span className="text-center text-xs text-slate-500">{doc.label}</span>
                </div>
              ))}
            </div>
          </div>

          <DeclarationsSection
            declarations={application.declarations}
            signatureUrls={signatureUrls}
            onOpenImage={(label, url) => setLightbox({ label, url })}
          />
        </div>
      </div>

      {declineOpen && (
        <DeclineDialog onClose={() => setDeclineOpen(false)} onConfirm={handleDecline} />
      )}

      {approveOpen && (
        <ApproveDialog
          application={application}
          onClose={() => setApproveOpen(false)}
          onConfirm={handleApprove}
        />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-4 text-white">
              <span className="text-sm font-medium">{lightbox.label}</span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="rounded-md px-2 py-1 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                Close
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.label}
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
