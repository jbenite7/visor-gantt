"use client";

import { useMemo, useState } from "react";
import type { ProjectCalendar, CalendarException } from "@/types/calendar";
import {
  normalizeProjectCalendar,
  validateProjectCalendar,
} from "@/lib/scheduling/projectCalendar";

interface CalendarSettingsViewProps {
  calendar: ProjectCalendar;
  onChange: (calendar: ProjectCalendar) => void;
}

const DAYS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mié" },
  { id: 4, label: "Jue" },
  { id: 5, label: "Vie" },
  { id: 6, label: "Sáb" },
  { id: 7, label: "Dom" },
];

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm";

export default function CalendarSettingsView({
  calendar,
  onChange,
}: CalendarSettingsViewProps) {
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const commitCalendar = (nextCalendar: ProjectCalendar) => {
    const normalized = normalizeProjectCalendar(nextCalendar);
    const issues = validateProjectCalendar(normalized);
    if (issues.length > 0) {
      setFormError(issues[0].message);
      return;
    }
    setFormError(null);
    onChange(normalized);
  };

  const summary = useMemo(() => {
    const labels = DAYS.filter((day) => calendar.workDays.includes(day.id))
      .map((day) => day.label)
      .join(", ");
    return `${labels} · ${calendar.startHour}-${calendar.endHour} · ${calendar.timeZone}`;
  }, [calendar]);

  const toggleDay = (dayId: number) => {
    const nextDays = calendar.workDays.includes(dayId)
      ? calendar.workDays.filter((id) => id !== dayId)
      : [...calendar.workDays, dayId].sort((a, b) => a - b);
    commitCalendar({ ...calendar, workDays: nextDays });
  };

  const addHoliday = () => {
    if (!holidayDate) {
      setFormError("Selecciona una fecha no laboral.");
      return;
    }
    if (calendar.nonWorkingDays.some((day) => day.date === holidayDate)) {
      setFormError("La fecha ya está configurada.");
      return;
    }
    const exception: CalendarException = {
      id: `${holidayDate}-${Date.now()}`,
      date: holidayDate,
      name: holidayName.trim() || "Día no laboral",
    };
    commitCalendar({
      ...calendar,
      nonWorkingDays: [...calendar.nonWorkingDays, exception].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    });
    setHolidayDate("");
    setHolidayName("");
  };

  const removeHoliday = (id: string) => {
    commitCalendar({
      ...calendar,
      nonWorkingDays: calendar.nonWorkingDays.filter((day) => day.id !== id),
    });
  };

  return (
    <div data-testid="calendar-settings-view" className="apple-module h-full overflow-auto p-5">
      <div className="max-w-4xl space-y-5">
        <section className="apple-section p-5">
          <h2 className="text-lg font-semibold text-[var(--color-text-strong)] font-[var(--font-heading)]">
            Calendario laboral
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{summary}</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-[var(--color-text-strong)]">
                Zona horaria
              </span>
              <input
                value={calendar.timeZone}
                onChange={(event) =>
                  commitCalendar({ ...calendar, timeZone: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--color-text-strong)]">
                Horas por día
              </span>
              <input
                type="number"
                min={1}
                max={24}
                value={calendar.hoursPerDay}
                onChange={(event) =>
                  commitCalendar({
                    ...calendar,
                    hoursPerDay: Number(event.target.value),
                  })
                }
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--color-text-strong)]">
                Inicio jornada
              </span>
              <input
                type="time"
                value={calendar.startHour}
                onChange={(event) =>
                  commitCalendar({ ...calendar, startHour: event.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-[var(--color-text-strong)]">
                Fin jornada
              </span>
              <input
                type="time"
                value={calendar.endHour}
                onChange={(event) =>
                  commitCalendar({ ...calendar, endHour: event.target.value })
                }
                className={inputClass}
              />
            </label>
          </div>

          <div className="mt-5">
            <span className="text-sm font-medium text-[var(--color-text-strong)]">
              Días laborales
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const active = calendar.workDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    data-active={active}
                    className="calendar-workday-toggle"
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="apple-section p-5">
          <h2 className="text-lg font-semibold text-[var(--color-text-strong)] font-[var(--font-heading)]">
            Días no laborales
          </h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="date"
              aria-label="Fecha no laboral"
              value={holidayDate}
              onChange={(event) => {
                setFormError(null);
                setHolidayDate(event.target.value);
              }}
              className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm"
            />
            <input
              aria-label="Nombre del día no laboral"
              value={holidayName}
              onChange={(event) => {
                setFormError(null);
                setHolidayName(event.target.value);
              }}
              placeholder="Nombre"
              className="min-w-0 flex-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addHoliday}
              className="apple-button-primary rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Agregar
            </button>
          </div>
          {formError && (
            <p className="mt-2 text-sm font-medium text-[var(--aia-alert-main)]">
              {formError}
            </p>
          )}

          <div className="mt-4 divide-y divide-[var(--color-hairline)]">
            {calendar.nonWorkingDays.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                No hay excepciones configuradas.
              </p>
            ) : (
              calendar.nonWorkingDays.map((day) => (
                <div
                  key={day.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                      {day.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{day.date}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHoliday(day.id)}
                    className="text-sm font-semibold text-[var(--aia-alert-main)]"
                  >
                    Eliminar
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
