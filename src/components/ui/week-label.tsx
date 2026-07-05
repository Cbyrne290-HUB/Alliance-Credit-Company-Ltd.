import { getWeekOfYear } from "@/lib/dates";

export function WeekLabel({
  date,
  dateLabel,
  size = "md",
}: {
  date: Date;
  dateLabel: string;
  size?: "sm" | "md";
}) {
  const { week, year } = getWeekOfYear(date);

  return (
    <div>
      <p
        className={`font-bold leading-tight tracking-tight text-slate-900 ${
          size === "md" ? "text-base" : "text-sm"
        }`}
      >
        Week {week} of {year}
      </p>
      <p className="mt-0.5 text-xs leading-tight text-slate-400">
        {dateLabel}
      </p>
    </div>
  );
}
