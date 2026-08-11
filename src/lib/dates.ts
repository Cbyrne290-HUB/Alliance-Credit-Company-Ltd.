export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isWithinRange(date: Date, start: Date, end: Date): boolean {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(date: Date, amount: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + amount);
  return d;
}

export function addMonths(date: Date, amount: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + amount);
  return d;
}

export function addYears(date: Date, amount: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + amount);
  return d;
}

/** Monday of the week containing `date` (weeks run Monday–Sunday). */
export function getMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = (day + 6) % 7; // days since the most recent Monday
  return addDays(d, -diff);
}

export function getSunday(date: Date): Date {
  return addDays(getMonday(date), 6);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

/** yyyy-mm-dd using local date components (avoids UTC off-by-one shifts). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatShort(date: Date): string {
  return date.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

export function formatRangeLabel(start: Date, end: Date): string {
  if (isSameDay(start, end)) {
    return `${formatShort(start)} ${start.getFullYear()}`;
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = sameYear
    ? formatShort(start)
    : `${formatShort(start)} ${start.getFullYear()}`;
  const endLabel = `${formatShort(end)} ${end.getFullYear()}`;
  return `${startLabel} – ${endLabel}`;
}

export type HistoryGranularity = "day" | "week" | "month";

/** Chooses a chart bucket granularity for a custom date range based on how
 * long it spans: short enough to read day-by-day, a few months reads
 * better week-by-week, longer collapses to month-by-month. */
export function granularityForRange(start: Date, end: Date): HistoryGranularity {
  const spanDays =
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (spanDays <= 9) return "day";
  if (spanDays <= 120) return "week";
  return "month";
}

/** Formats a chart bucket's start date into an x-axis label appropriate for
 * its granularity: a weekday name when day buckets span a week or less (so
 * "This Week" reads as Mon/Tue/...), day-and-month once day buckets run
 * longer than a week (so "This Month" doesn't repeat the same weekday name
 * ~4 times), the bucket's start date for week buckets, and a month name
 * (with year only if the range crosses more than one calendar year) for
 * month buckets. */
export function formatHistoryBucketLabel(
  bucketStart: Date,
  granularity: HistoryGranularity,
  rangeSpanDays: number,
  multiYear: boolean,
): string {
  if (granularity === "day") {
    return rangeSpanDays <= 7
      ? bucketStart.toLocaleDateString("en-IE", { weekday: "short" })
      : formatShort(bucketStart);
  }
  if (granularity === "week") {
    return formatShort(bucketStart);
  }
  return bucketStart.toLocaleDateString(
    "en-IE",
    multiYear ? { month: "short", year: "numeric" } : { month: "short" },
  );
}

/** The month index (0-based) that starts each week-numbering cycle: June. */
const CYCLE_START_MONTH = 5;

/** The first Monday on or after 1 June of `year` — the start of that year's cycle. */
export function firstMondayOfYear(year: number): Date {
  const jun1 = new Date(year, CYCLE_START_MONTH, 1);
  const day = jun1.getDay(); // 0 = Sun .. 6 = Sat
  const daysUntilMonday = (1 - day + 7) % 7;
  return addDays(jun1, daysUntilMonday);
}

/**
 * Week-of-cycle numbering where week 1 starts on the first Monday on or
 * after 1 June, and the cycle resets every 1 June (so the "year" here is
 * the cycle's start year, not the calendar year of the date itself) —
 * each subsequent Monday begins the next week number. Dates before a
 * cycle's first Monday belong to the previous cycle's last week, which
 * falls out naturally since getMonday() for those dates lands before June
 * of the current cycle year.
 */
export function getWeekOfYear(date: Date): { week: number; year: number } {
  const monday = getMonday(date);
  const year =
    monday.getMonth() >= CYCLE_START_MONTH
      ? monday.getFullYear()
      : monday.getFullYear() - 1;
  const firstMonday = firstMondayOfYear(year);
  const diffDays = Math.round(
    (monday.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24),
  );
  const week = Math.floor(diffDays / 7) + 1;
  return { week, year };
}
