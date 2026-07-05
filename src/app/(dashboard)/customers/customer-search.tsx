"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, CircleCheck, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { CustomerRowMenu } from "./customer-row-menu";
import type { CustomerDirectoryRow } from "@/types/customer";

function StatusPill({
  status,
}: {
  status: CustomerDirectoryRow["customerStatus"];
}) {
  if (status === "active") {
    return (
      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        Active
      </span>
    );
  }
  if (status === "cleared") {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        Cleared
      </span>
    );
  }
  return (
    <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-400">
      No Loans
    </span>
  );
}

export function CustomerSearch({
  customers,
  totalCustomers,
  activeLoansCount,
  inArrearsCount,
}: {
  customers: CustomerDirectoryRow[];
  totalCustomers: number;
  activeLoansCount: number;
  inArrearsCount: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;

    return customers.filter(
      (c) =>
        c.first_name.toLowerCase().includes(q) ||
        c.surname.toLowerCase().includes(q) ||
        c.account_number.toLowerCase().includes(q),
    );
  }, [customers, query]);

  return (
    <>
      <PageHeader
        title="Customers"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Customers" }]}
      />
      <div className="px-8 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Customers"
              value={String(totalCustomers)}
              icon={<Users className="h-5 w-5" />}
              color="green"
            />
            <StatCard
              label="Active Loans"
              value={String(activeLoansCount)}
              icon={<CircleCheck className="h-5 w-5" />}
              color="blue"
            />
            <StatCard
              label="In Arrears"
              value={String(inArrearsCount)}
              icon={<TriangleAlert className="h-5 w-5" />}
              color="purple"
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Search by name or account number..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <Link
              href="/customers/new"
              className="flex items-center justify-center whitespace-nowrap rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Add New Customer
            </Link>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">ID/PPSN</th>
                    <th className="px-4 py-3">Loans</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        No customers found.
                      </td>
                    </tr>
                  )}

                  {results.map((c) => {
                    const fullName = `${c.first_name} ${c.surname}`;
                    return (
                      <tr
                        key={c.id}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={fullName} />
                            <div>
                              <p className="font-medium text-slate-900">
                                {fullName}
                              </p>
                              <p className="text-xs text-slate-400">
                                {c.account_number}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {c.phone ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {c.ppsn ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {c.loanCount}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={c.customerStatus} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/customers/${c.id}`}
                              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                              View
                            </Link>
                            <CustomerRowMenu
                              customerId={c.id}
                              customerName={fullName}
                              onDeleted={() => router.refresh()}
                            />
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
