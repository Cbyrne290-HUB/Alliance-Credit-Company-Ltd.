import type { ReactNode } from "react";

export type StatColor = "green" | "blue" | "purple" | "orange";

const COLOR_STYLES: Record<StatColor, string> = {
  green: "bg-emerald-100 text-emerald-600",
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  orange: "bg-orange-100 text-orange-600",
};

export function StatCard({
  label,
  value,
  icon,
  color = "blue",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  color?: StatColor;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${COLOR_STYLES[color]}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
