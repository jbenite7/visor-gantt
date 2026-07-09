"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GanttTask } from "@/components/gantt/types";
import type { ProjectCalendar } from "@/types/calendar";
import { isProjectWorkingDay } from "@/lib/scheduling/projectCalendar";

interface CalendarViewProps {
  tasks: GanttTask[];
  calendar: ProjectCalendar;
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function buildMonthDays(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  const offset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function taskTouchesDay(task: GanttTask, day: Date): boolean {
  const start = new Date(task.start);
  const finish = new Date(task.finish);
  start.setHours(0, 0, 0, 0);
  finish.setHours(23, 59, 59, 999);
  return day.getTime() >= start.getTime() && day.getTime() <= finish.getTime();
}

export default function CalendarView({ tasks, calendar }: CalendarViewProps) {
  const initialMonth = useMemo(() => startOfMonth(tasks[0]?.start ?? new Date()), [tasks]);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const days = useMemo(() => buildMonthDays(visibleMonth), [visibleMonth]);
  const holidayKeys = useMemo(
    () => new Set(calendar.nonWorkingDays.map((day) => day.date)),
    [calendar.nonWorkingDays],
  );
  const specialWorkingKeys = useMemo(
    () => new Set(calendar.dateOverrides.filter((day) => day.isWorking).map((day) => day.date)),
    [calendar.dateOverrides],
  );

  const summary = useMemo(() => {
    let working = 0;
    let weekend = 0;
    let holidays = 0;
    let special = 0;
    for (const day of days) {
      if (day.getMonth() !== visibleMonth.getMonth()) continue;
      const key = dateKey(day);
      if (specialWorkingKeys.has(key)) special += 1;
      if (holidayKeys.has(key)) holidays += 1;
      if (day.getDay() === 0) weekend += 1;
      if (isProjectWorkingDay(day, calendar)) working += 1;
    }
    return { working, weekend, holidays, special };
  }, [calendar, days, holidayKeys, specialWorkingKeys, visibleMonth]);

  return (
    <div data-testid="calendar-view" className="apple-module h-full overflow-auto">
      <div className="apple-module-header flex items-center justify-between gap-4 px-5 py-4">
        <div>
          <h2 className="font-[var(--font-heading)] text-lg font-semibold capitalize text-[var(--color-text-strong)]">
            Calendario
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {summary.working} laborales · {summary.weekend} domingos · {summary.holidays} festivos · {summary.special} laborales especiales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="apple-icon-button h-8 w-8" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))} title="Mes anterior">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-40 text-center text-sm font-semibold capitalize text-[var(--color-text-strong)]">
            {monthLabel(visibleMonth)}
          </span>
          <button type="button" className="apple-icon-button h-8 w-8" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} title="Mes siguiente">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-7 border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)]">
          {WEEKDAYS.map((day) => (
            <div key={day} className="border-b border-[var(--color-hairline)] px-2 py-2 text-center text-xs font-semibold text-[var(--color-text-muted)]">
              {day}
            </div>
          ))}
          {days.map((day) => {
            const key = dateKey(day);
            const outsideMonth = day.getMonth() !== visibleMonth.getMonth();
            const isHoliday = holidayKeys.has(key);
            const isSpecial = specialWorkingKeys.has(key);
            const isWorking = isProjectWorkingDay(day, calendar);
            const dayTasks = tasks.filter((task) => taskTouchesDay(task, day)).slice(0, 3);
            const tone = isSpecial
              ? "special"
              : isHoliday
                ? "holiday"
                : isWorking
                  ? "working"
                  : "nonworking";

            return (
              <div
                key={key}
                className="gantt-calendar-day min-h-28 border-b border-r border-[var(--color-hairline)] p-2"
                data-tone={tone}
                data-outside-month={outsideMonth}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-text-strong)]">{day.getDate()}</span>
                  <span className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                    {isHoliday ? "Festivo" : isSpecial ? "Especial" : isWorking ? "Lab." : "No lab."}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayTasks.map((task) => (
                    <div key={String(task.id)} className="truncate rounded-sm bg-[var(--aia-corp-main)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-on-primary)]" title={task.name}>
                      {task.name}
                    </div>
                  ))}
                  {tasks.filter((task) => taskTouchesDay(task, day)).length > 3 && (
                    <div className="text-[10px] text-[var(--color-text-muted)]">
                      +{tasks.filter((task) => taskTouchesDay(task, day)).length - 3} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Cada barra resume tareas activas durante el día; las fechas usan el calendario del proyecto.
        </p>
      </div>
    </div>
  );
}
