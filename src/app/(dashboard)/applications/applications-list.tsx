"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Clock, CircleCheck, CircleX } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ApplicationListItem, ApplicationStatus } from "@/types/application";

type Filter = "pending" | "approved" | "declined" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

function StatusPill({ status }: { status: ApplicationStatus }) {
  if (status === "approved") {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Approved
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        Declined
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
      Pending
    </span>
  );
}

/** Pending-first, newest-first within each status — keeps the review
 * queue's most urgent rows on top no matter which filter is active. */
function sortForQueue(applications: ApplicationListItem[]): ApplicationListItem[] {
  return [...applications].sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === "pending") return -1;
      if (b.status === "pending") return 1;
    }
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  });
}

export function ApplicationsList({
  applications,
}: {
  applications: ApplicationListItem[];
}) {
  const [filter, setFilter] = useState<Filter>("pending");

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;
  const declinedCount = applications.filter((a) => a.status === "declined").length;

  const filtered = useMemo(() => {
    const rows = filter === "all" ? applications : applications.filter((a) => a.status === filter);
    return sortForQueue(rows);
  }, [applications, filter]);

  return (
    <>
      <PageHeader
        title="Applications"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Applications" }]}
      />
      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatCard
              label="Total Applications"
              value={String(applications.length)}
              icon={<ClipboardList className="h-5 w-5" />}
              color="blue"
            />
            <StatCard
              label="Pending Review"
              value={String(pendingCount)}
              icon={<Clock className="h-5 w-5" />}
              color="orange"
            />
            <StatCard
              label="Approved"
              value={String(approvedCount)}
              icon={<CircleCheck className="h-5 w-5" />}
              color="green"
            />
            <StatCard
              label="Declined"
              value={String(declinedCount)}
              icon={<CircleX className="h-5 w-5" />}
              color="purple"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
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
              <table className="w-full text-sm sm:min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3 sm:px-4">Applicant</th>
                    <th className="px-3 py-3 sm:px-4">Loan Amount</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Term</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Submitted</th>
                    <th className="px-3 py-3 sm:px-4">Status</th>
                    <th className="px-3 py-3 sm:px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        No applications found.
                      </td>
                    </tr>
                  )}

                  {filtered.map((application) => {
                    const fullName = `${application.first_name} ${application.last_name}`;
                    const pending = application.status === "pending";
                    return (
                      <tr
                        key={application.id}
                        className={
                          pending
                            ? "bg-amber-50/60 transition-colors hover:bg-amber-50"
                            : "transition-colors hover:bg-slate-50"
                        }
                      >
                        <td className="px-3 py-3 sm:px-4">
                          <p className="font-medium text-slate-900">{fullName}</p>
                          <p className="text-xs text-slate-400 sm:hidden">
                            {formatDate(application.created_at)}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-slate-600 sm:px-4">
                          {formatCurrency(application.loan_amount)}
                          <p className="text-xs text-slate-400 sm:hidden">
                            {application.loan_term_weeks} weeks
                          </p>
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                          {application.loan_term_weeks} weeks
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                          {formatDate(application.created_at)}
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <StatusPill status={application.status} />
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <div className="flex items-center justify-end">
                            <Link
                              href={`/applications/${application.id}`}
                              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium sm:py-1.5 text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              Review
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
