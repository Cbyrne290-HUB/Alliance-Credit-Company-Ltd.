import { getWeekOfYear } from "@/lib/dates";

export function WeekLabel({
  date,
  dateLabel,
  size = "md",
}: {
  date: Date;
  dateLabel: string;
  size?: "sm" | "md" | "lg";
}) {
  const { week, year } = getWeekOfYear(date);

  const titleSize =
    size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-sm";
  const dateSize = size === "lg" ? "text-sm" : "text-xs";

  return (
    <div>
      <p
        className={`font-bold leading-tight tracking-tight text-slate-900 ${titleSize}`}
      >
        Week {week} of {year}
      </p>
      <p className={`mt-0.5 leading-tight text-slate-400 ${dateSize}`}>
        {dateLabel}
      </p>
    </div>
  );
}
