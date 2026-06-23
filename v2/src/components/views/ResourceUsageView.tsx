"use client";

import { useMemo } from "react";
import type { Resource, Assignment } from "@/types/resource";
import type { GanttTask } from "@/components/gantt/types";

interface ResourceUsageViewProps {
  resources: Resource[];
  tasks: GanttTask[];
  assignments: Assignment[];
}

interface PeriodCell {
  start: Date;
  end: Date;
  hours: number;
  label: string;
}

interface ResourceUsageRow {
  resource: Resource;
  totalHours: number;
  periods: PeriodCell[];
}

/** Format a date range label for a period column. */
function periodLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const fmt = new Intl.DateTimeFormat("es-CO", opts);
  return `${fmt.format(start)}\u2013${fmt.format(end)}`;
}

/** Get the Monday of the week containing a date. */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Calculate hours for an assignment within a period. */
function hoursInPeriod(
  task: GanttTask,
  assignment: Assignment,
  periodStart: Date,
  periodEnd: Date,
): number {
  const taskStart = new Date(task.start);
  const taskFinish = new Date(task.finish);
  taskStart.setHours(0, 0, 0, 0);
  taskFinish.setHours(0, 0, 0, 0);
  periodStart.setHours(0, 0, 0, 0);
  periodEnd.setHours(0, 0, 0, 0);

  // No overlap
  if (taskFinish < periodStart || taskStart > periodEnd) return 0;

  const overlapStart = new Date(Math.max(taskStart.getTime(), periodStart.getTime()));
  const overlapEnd = new Date(Math.min(taskFinish.getTime(), periodEnd.getTime()));
  const days = Math.max(0, Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1);

  // Work day = 8 hours, adjusted by assignment units percentage
  return days * 8 * (assignment.units / 100);
}

export default function ResourceUsageView({
  resources,
  tasks,
  assignments,
}: ResourceUsageViewProps) {
  // Build week periods from task date range
  const { periods, taskMap, assignmentMap } = useMemo(() => {
    if (tasks.length === 0 || resources.length === 0) {
      return { periods: [], taskMap: new Map<string, GanttTask>(), assignmentMap: new Map<number, Assignment[]>() };
    }

    const starts = tasks.map((t) => t.start.getTime());
    const finishes = tasks.map((t) => t.finish.getTime());
    const minDate = new Date(Math.min(...starts));
    const maxDate = new Date(Math.max(...finishes));

    const weekStart = getWeekStart(minDate);
    const weekEnd = getWeekStart(maxDate);
    weekEnd.setDate(weekEnd.getDate() + 7); // end of last week

    const periodList: PeriodCell[] = [];
    const cursor = new Date(weekStart);
    while (cursor < weekEnd) {
      const end = new Date(cursor);
      end.setDate(end.getDate() + 6);
      periodList.push({
        start: new Date(cursor),
        end: new Date(end),
        hours: 0,
        label: periodLabel(new Date(cursor), new Date(end)),
      });
      cursor.setDate(cursor.getDate() + 7);
    }

    const taskMap = new Map<string, GanttTask>();
    for (const t of tasks) {
      taskMap.set(String(t.id), t);
    }

    const assignmentMap = new Map<number, Assignment[]>();
    for (const a of assignments) {
      const list = assignmentMap.get(a.resourceId) ?? [];
      list.push(a);
      assignmentMap.set(a.resourceId, list);
    }

    return { periods: periodList, taskMap, assignmentMap };
  }, [tasks, resources, assignments]);

  // Build usage rows
  const usageRows = useMemo<ResourceUsageRow[]>(() => {
    return resources.map((resource) => {
      const resourceAssignments = assignmentMap.get(resource.uid) ?? [];
      let totalHours = 0;
      const periodCells = periods.map((period) => {
        let periodHours = 0;
        for (const assignment of resourceAssignments) {
          const task = taskMap.get(String(assignment.taskId));
          if (task) {
            periodHours += hoursInPeriod(task, assignment, new Date(period.start), new Date(period.end));
          }
        }
        totalHours += periodHours;
        return { ...period, hours: periodHours };
      });
      return { resource, totalHours, periods: periodCells };
    });
  }, [resources, periods, assignmentMap, taskMap]);

  const hasAssignments = assignments.length > 0;
  const maxAvailability = (uid: number) => {
    const r = resources.find((res) => res.uid === uid);
    return (r?.availability ?? 100) / 100;
  };

  if (resources.length === 0) {
    return (
      <div
        data-testid="resource-usage-view"
        className="flex items-center justify-center h-full"
        style={{
          color: "var(--gray-500)",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: "0.9375rem",
        }}
      >
        No hay recursos disponibles.
      </div>
    );
  }

  if (!hasAssignments) {
    return (
      <div data-testid="resource-usage-view" className="flex flex-col h-full">
        <div
          style={{
            background: "var(--aia-corp-dark)",
            padding: "8px 12px",
            borderBottom: "1px solid var(--aia-corp-mid)",
          }}
        >
          <span
            style={{
              fontSize: "0.8125rem",
              fontFamily: "var(--font-montserrat)",
              fontWeight: 600,
              color: "#ffffff",
            }}
          >
            Uso de Recursos
          </span>
        </div>
        <div
          className="flex items-center justify-center flex-1"
          style={{
            color: "var(--gray-500)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: "0.9375rem",
          }}
        >
          No hay asignaciones de recursos.
        </div>
      </div>
    );
  }

  return (
    <div data-testid="resource-usage-view" className="flex flex-col h-full">
      {/* ── Split Layout ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left Panel: Resource List (30%) ── */}
        <div
          style={{
            width: "30%",
            minWidth: 220,
            borderRight: "2px solid var(--aia-corp-mid)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              background: "var(--aia-corp-dark)",
              padding: "8px 10px",
              borderBottom: "1px solid var(--aia-corp-mid)",
            }}
          >
            <span
              style={{
                fontSize: "0.6875rem",
                fontFamily: "var(--font-montserrat)",
                fontWeight: 600,
                color: "#ffffff",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              Recurso
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {usageRows.map((row, index) => (
              <div
                key={row.resource.uid}
                data-testid="resource-usage-row"
                style={{
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--gray-200)",
                  background: index % 2 === 0 ? "var(--aia-alabaster)" : "var(--aia-linen)",
                  minHeight: 38,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "0.8125rem",
                    fontFamily: "var(--font-inter), system-ui, sans-serif",
                    fontWeight: 500,
                    color: "var(--gray-900)",
                  }}
                >
                  {row.resource.name}
                </div>
                <div
                  style={{
                    fontSize: "0.6875rem",
                    fontFamily: "var(--font-inter), system-ui, sans-serif",
                    color: "var(--gray-500)",
                    marginTop: 2,
                  }}
                >
                  {row.totalHours.toFixed(1)}h total
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Panel: Time-Phased Grid (70%) ── */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Period headers */}
          <div
            style={{
              background: "var(--aia-corp-dark)",
              display: "flex",
              borderBottom: "1px solid var(--aia-corp-mid)",
              position: "sticky",
              top: 0,
              zIndex: 5,
            }}
          >
            {periods.map((period, i) => (
              <div
                key={i}
                style={{
                  flex: "0 0 100px",
                  padding: "8px 6px",
                  fontSize: "0.625rem",
                  fontFamily: "var(--font-montserrat)",
                  fontWeight: 600,
                  color: "#ffffff",
                  textAlign: "center",
                  borderLeft: "1px solid var(--aia-corp-mid)",
                  whiteSpace: "nowrap",
                  lineHeight: 1.3,
                }}
              >
                {period.label}
              </div>
            ))}
          </div>

          {/* Grid body */}
          <div className="flex-1 min-h-0 overflow-auto">
            {usageRows.map((row, rowIndex) => (
              <div
                key={row.resource.uid}
                data-testid="resource-usage-grid-row"
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--gray-200)",
                  background: rowIndex % 2 === 0 ? "var(--aia-alabaster)" : "var(--aia-linen)",
                  minHeight: 38,
                }}
              >
                {row.periods.map((cell, cellIndex) => {
                  const avail = maxAvailability(row.resource.uid);
                  const dailyCapacity = avail * 8;
                  const isOverallocated = cell.hours > 0 && cell.hours > dailyCapacity * 7; // weekly capacity

                  return (
                    <div
                      key={cellIndex}
                      data-testid="usage-cell"
                      style={{
                        flex: "0 0 100px",
                        padding: "8px 6px",
                        fontSize: "0.75rem",
                        fontFamily: "var(--font-inter), system-ui, sans-serif",
                        fontWeight: cell.hours > 0 ? 600 : 400,
                        color: isOverallocated ? "var(--aia-alert-main)" : cell.hours > 0 ? "var(--gray-900)" : "var(--gray-400)",
                        textAlign: "center",
                        borderLeft: "1px solid var(--gray-200)",
                        background: isOverallocated ? "var(--aia-alert-xlight)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {cell.hours > 0 ? `${cell.hours.toFixed(1)}h` : "\u2014"}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
