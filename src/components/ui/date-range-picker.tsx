"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfYear,
  formatRangeLabel,
  fromISODate,
  getMonday,
  getSunday,
  granularityForRange,
  isSameDay,
  startOfMonth,
  startOfYear,
  toISODate,
  type HistoryGranularity,
} from "@/lib/dates";

type Preset = "week" | "month" | "year" | "custom";
export type DateRange = { start: string; end: string; granularity: HistoryGranularity };

const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "custom", label: "Custom Range" },
];

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function presetRange(preset: "week" | "month" | "year", today: Date): DateRange {
  if (preset === "week") {
    return {
      start: toISODate(getMonday(today)),
      end: toISODate(getSunday(today)),
      granularity: "day",
    };
  }
  if (preset === "month") {
    return {
      start: toISODate(startOfMonth(today)),
      end: toISODate(endOfMonth(today)),
      granularity: "day",
    };
  }
  return {
    start: toISODate(startOfYear(today)),
    end: toISODate(endOfYear(today)),
    granularity: "month",
  };
}

function buildCalendarDays(visibleMonth: Date): Date[] {
  const gridStart = getMonday(startOfMonth(visibleMonth));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function DateRangePicker({
  initialRange,
  onRangeChange,
}: {
  initialRange: DateRange;
  onRangeChange: (range: DateRange) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<Preset>("week");
  const [range, setRange] = useState<DateRange>(initialRange);
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    startOfMonth(fromISODate(initialRange.end)),
  );
  const [selectingStart, setSelectingStart] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const rangeStart = fromISODate(range.start);
  const rangeEnd = fromISODate(range.end);

  const previewRange = useMemo(() => {
    if (selectingStart && hoverDate) {
      return selectingStart.getTime() <= hoverDate.getTime()
        ? { start: selectingStart, end: hoverDate }
        : { start: hoverDate, end: selectingStart };
    }
    return null;
  }, [selectingStart, hoverDate]);

  const displayStart = previewRange ? previewRange.start : rangeStart;
  const displayEnd = previewRange ? previewRange.end : rangeEnd;

  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  function applyPreset(key: Preset) {
    setPreset(key);
    setSelectingStart(null);
    setHoverDate(null);

    if (key === "custom") {
      return;
    }

    const next = presetRange(key, today);
    setRange(next);
    setVisibleMonth(startOfMonth(fromISODate(next.end)));
    onRangeChange(next);
  }

  function handleDayClick(day: Date) {
    setPreset("custom");

    if (day.getMonth() !== visibleMonth.getMonth() || day.getFullYear() !== visibleMonth.getFullYear()) {
      setVisibleMonth(startOfMonth(day));
    }

    if (!selectingStart) {
      setSelectingStart(day);
      setRange({ start: toISODate(day), end: toISODate(day), granularity: "day" });
      return;
    }

    const start = selectingStart.getTime() <= day.getTime() ? selectingStart : day;
    const end = selectingStart.getTime() <= day.getTime() ? day : selectingStart;
    const next: DateRange = {
      start: toISODate(start),
      end: toISODate(end),
      granularity: granularityForRange(start, end),
    };

    setSelectingStart(null);
    setHoverDate(null);
    setRange(next);
    onRangeChange(next);
  }

  const monthLabel = visibleMonth.toLocaleDateString("en-IE", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            className={
              preset === p.key
                ? "rounded-full bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition-colors"
                : "rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
            }
          >
            {p.label}
          </button>
        ))}
        <span className="ml-auto text-sm font-medium text-slate-500">
          {formatRangeLabel(rangeStart, rangeEnd)}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <NavButton label="Previous year" onClick={() => setVisibleMonth((m) => addYears(m, -1))}>
            «
          </NavButton>
          <NavButton label="Previous month" onClick={() => setVisibleMonth((m) => addMonths(m, -1))}>
            ‹
          </NavButton>
        </div>
        <p className="text-sm font-semibold text-slate-900">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <NavButton label="Next month" onClick={() => setVisibleMonth((m) => addMonths(m, 1))}>
            ›
          </NavButton>
          <NavButton label="Next year" onClick={() => setVisibleMonth((m) => addYears(m, 1))}>
            »
          </NavButton>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7" onMouseLeave={() => setHoverDate(null)}>
        {days.map((day) => {
          const inCurrentMonth = day.getMonth() === visibleMonth.getMonth();
          const isToday = isSameDay(day, today);
          const isStart = isSameDay(day, displayStart);
          const isEnd = isSameDay(day, displayEnd);
          const inRange =
            day.getTime() >= displayStart.getTime() &&
            day.getTime() <= displayEnd.getTime();
          const columnIndex = (day.getDay() + 6) % 7; // Mon = 0 .. Sun = 6
          const roundLeft = isStart || columnIndex === 0;
          const roundRight = isEnd || columnIndex === 6;

          return (
            <div key={day.toISOString()} className="relative py-0.5">
              {inRange && (
                <div
                  className={[
                    "absolute inset-y-0.5 left-0 right-0 bg-slate-100",
                    roundLeft ? "rounded-l-full" : "",
                    roundRight ? "rounded-r-full" : "",
                  ].join(" ")}
                />
              )}
              <button
                type="button"
                onClick={() => handleDayClick(day)}
                onMouseEnter={() => setHoverDate(day)}
                className={[
                  "relative z-10 mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors",
                  isStart || isEnd
                    ? "bg-slate-900 font-semibold text-white"
                    : inCurrentMonth
                      ? "text-slate-700 hover:bg-slate-200"
                      : "text-slate-300 hover:bg-slate-100",
                  isToday && !isStart && !isEnd ? "ring-1 ring-inset ring-slate-400" : "",
                ].join(" ")}
              >
                {day.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </button>
  );
}
