"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  addDays,
  addMonths,
  addYears,
  formatRangeLabel,
  fromISODate,
  getMonday,
  getSunday,
  isSameDay,
  startOfMonth,
  toISODate,
} from "@/lib/dates";
import { WeekLabel } from "@/components/ui/week-label";

type WeekRange = { start: string; end: string };

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildCalendarDays(visibleMonth: Date): Date[] {
  const gridStart = getMonday(startOfMonth(visibleMonth));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function WeekPicker({
  selectedWeek,
  onWeekChange,
}: {
  selectedWeek: WeekRange;
  onWeekChange: (week: WeekRange) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [showCalendar, setShowCalendar] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    startOfMonth(fromISODate(selectedWeek.start)),
  );

  const weekStart = fromISODate(selectedWeek.start);
  const weekEnd = fromISODate(selectedWeek.end);
  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  function selectWeekContaining(day: Date, collapseAfter = false) {
    const monday = getMonday(day);
    const sunday = getSunday(day);
    setVisibleMonth(startOfMonth(day));
    onWeekChange({ start: toISODate(monday), end: toISODate(sunday) });
    if (collapseAfter) setShowCalendar(false);
  }

  function jumpWeeks(amount: number) {
    selectWeekContaining(addDays(weekStart, amount * 7));
  }

  const monthLabel = visibleMonth.toLocaleDateString("en-IE", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekLabel date={weekStart} dateLabel={formatRangeLabel(weekStart, weekEnd)} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => jumpWeeks(-1)}
            className="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            ← Previous Week
          </button>
          <button
            type="button"
            onClick={() => selectWeekContaining(today)}
            className="rounded-full bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            This Week
          </button>
          <button
            type="button"
            onClick={() => jumpWeeks(1)}
            className="rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
          >
            Next Week →
          </button>
          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            aria-expanded={showCalendar}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            {showCalendar ? "Hide calendar" : "Jump to week"}
          </button>
        </div>
      </div>

      {showCalendar && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between">
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

          <div className="mt-3 grid grid-cols-7 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const inCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isToday = isSameDay(day, today);
              const inSelectedWeek =
                day.getTime() >= weekStart.getTime() && day.getTime() <= weekEnd.getTime();
              const columnIndex = (day.getDay() + 6) % 7; // Mon = 0 .. Sun = 6
              const roundLeft = columnIndex === 0;
              const roundRight = columnIndex === 6;

              return (
                <div key={day.toISOString()} className="relative py-0.5">
                  {inSelectedWeek && (
                    <div
                      className={[
                        "absolute inset-y-0.5 left-0 right-0 bg-slate-900",
                        roundLeft ? "rounded-l-full" : "",
                        roundRight ? "rounded-r-full" : "",
                      ].join(" ")}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => selectWeekContaining(day, true)}
                    className={[
                      "relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                      inSelectedWeek
                        ? "font-semibold text-white"
                        : inCurrentMonth
                          ? "text-slate-700 hover:bg-slate-200"
                          : "text-slate-300 hover:bg-slate-100",
                      isToday && !inSelectedWeek ? "ring-1 ring-inset ring-slate-400" : "",
                    ].join(" ")}
                  >
                    {day.getDate()}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
