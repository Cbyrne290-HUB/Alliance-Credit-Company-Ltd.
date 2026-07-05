"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  Banknote,
  HandCoins,
  ListChecks,
  TriangleAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";
import {
  fetchDashboardData,
  type AgingBucket,
  type ArrearsRow,
  type DashboardMetrics,
  type MonthlyHistoryPoint,
  type StatusBreakdown,
} from "@/lib/dashboard";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { useAgentContext } from "@/components/agent/agent-provider";

type DateRange = { start: string; end: string };

const STATUS_COLORS: Record<string, string> = {
  Active: "#2563eb",
  "In Arrears": "#dc2626",
  Cleared: "#059669",
};

export function DashboardHome({
  initialRange,
  initialMetrics,
  initialArrears,
  statusBreakdown,
  agingBuckets,
  history,
}: {
  initialRange: DateRange;
  initialMetrics: DashboardMetrics;
  initialArrears: ArrearsRow[];
  statusBreakdown: StatusBreakdown;
  agingBuckets: AgingBucket[];
  history: MonthlyHistoryPoint[];
}) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [arrears, setArrears] = useState(initialArrears);
  const [isPending, startTransition] = useTransition();
  const { activeAgent } = useAgentContext();

  function handleRangeChange(next: DateRange) {
    startTransition(async () => {
      const supabase = createClient();
      const result = await fetchDashboardData(supabase, next, activeAgent);
      setMetrics(result.metrics);
      setArrears(result.arrears);
    });
  }

  const statusData = [
    { name: "Active", value: statusBreakdown.active },
    { name: "In Arrears", value: statusBreakdown.inArrears },
    { name: "Cleared", value: statusBreakdown.cleared },
  ];
  const hasStatusData = statusData.some((d) => d.value > 0);
  const hasAgingData = agingBuckets.some((b) => b.amount > 0);
  const hasHistoryData = history.some(
    (h) => h.totalCollected > 0 || h.totalOutOnLoan > 0,
  );

  return (
    <>
      <PageHeader
        title="Dashboard"
        breadcrumb={[{ label: "Home", href: "/dashboard" }, { label: "Dashboard" }]}
      />
      <div className="px-8 py-8">
      <div className="mx-auto max-w-6xl">
        <div
          className={`grid grid-cols-1 gap-4 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-4 ${
            isPending ? "opacity-60" : ""
          }`}
        >
          <StatCard
            label="Total Collected"
            value={formatCurrency(metrics.totalCollected)}
            icon={<Banknote className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            label="Total Out on Loan"
            value={formatCurrency(metrics.totalOutOnLoan)}
            icon={<HandCoins className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            label="Active Loans"
            value={String(metrics.activeLoansCount)}
            icon={<ListChecks className="h-5 w-5" />}
            color="purple"
          />
          <StatCard
            label="In Arrears"
            value={String(metrics.inArrearsCount)}
            icon={<TriangleAlert className="h-5 w-5" />}
            color="orange"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ChartCard title="Loan Overview" className="lg:col-span-2">
            {hasHistoryData ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `€${v}`}
                    width={64}
                  />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="totalOutOnLoan"
                    name="Total Out on Loan"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalCollected"
                    name="Total Collected"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="No loan activity yet." />
            )}
          </ChartCard>

          <div className="flex flex-col gap-6">
            <ChartCard title="Total Collected Range">
              <DateRangePicker
                initialRange={initialRange}
                onRangeChange={handleRangeChange}
              />
            </ChartCard>
          </div>

          <ChartCard title="Loan Status Breakdown">
            {hasStatusData ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="No loans yet." />
            )}
          </ChartCard>

          <ChartCard title="Aging of In Arrears">
            {hasAgingData ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agingBuckets} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v: number) => `€${v}`}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={72}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="amount" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="No accounts in arrears." />
            )}
          </ChartCard>

          <ChartCard title="Top In Arrears">
            {arrears.length === 0 ? (
              <p className="text-sm text-slate-500">
                No customers are currently in arrears.
              </p>
            ) : (
              <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
                {arrears.slice(0, 8).map((row) => (
                  <Link
                    key={row.loanId}
                    href={`/loans/${row.loanId}`}
                    className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-slate-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {row.customerName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.weeksBehind}{" "}
                        {row.weeksBehind === 1 ? "week" : "weeks"} behind
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-red-600">
                      {formatCurrency(row.arrears)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </div>
      </div>
    </>
  );
}

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
      {message}
    </div>
  );
}
