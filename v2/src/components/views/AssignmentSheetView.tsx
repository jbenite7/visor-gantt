"use client";

import { useCallback, useMemo, useState } from "react";
import type { GanttTask } from "@/components/gantt/types";
import ColumnSelector, { type ColumnConfig } from "@/components/gantt/table/ColumnSelector";
import { inspectMppField } from "@/lib/mpp/fieldInspector";
import { formatMppValue, getMppRecordValue } from "@/lib/mpp/recordValues";
import {
  DEFAULT_ASSIGNMENT_COLUMN_SETTINGS,
  normalizeAssignmentColumnSettings,
} from "@/lib/mpp/taskColumns";
import type { Assignment, Resource } from "@/types/resource";
import type {
  AssignmentColumnSettings,
  MppAssignmentColumn,
  MppCustomFieldDefinition,
} from "@/types/mppColumns";
import type { UILocale } from "@/types/ui";

interface AssignmentSheetViewProps {
  assignments: Assignment[];
  tasks: GanttTask[];
  resources: Resource[];
  mppAssignmentColumns?: MppAssignmentColumn[];
  customFieldDefinitions?: MppCustomFieldDefinition[];
  columnSettings?: AssignmentColumnSettings;
  locale?: UILocale;
  onColumnSettingsChange?: (settings: AssignmentColumnSettings) => void;
  /** Restablecer columnas borra la configuración del usuario: el padre puede hacerlo deshacible. */
  onResetColumns?: () => void;
  onLocaleChange?: (locale: UILocale) => void;
}

const thStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: "0.6875rem",
  fontFamily: "var(--font-montserrat)",
  fontWeight: 600,
  color: "var(--color-text-strong)",
  textAlign: "left",
  whiteSpace: "nowrap",
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: "0.8125rem",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  color: "var(--gray-700)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export default function AssignmentSheetView({
  assignments,
  tasks,
  resources,
  mppAssignmentColumns = [],
  customFieldDefinitions = [],
  columnSettings,
  locale = "es",
  onColumnSettingsChange,
  onResetColumns,
  onLocaleChange,
}: AssignmentSheetViewProps) {
  const labels =
    locale === "en"
      ? {
          assignments: "assignments",
          task: "Task",
          taskName: "Task name",
          resource: "Resource",
          resourceName: "Resource name",
          units: "Units",
          cost: "Cost",
          empty: "No imported assignments.",
        }
      : {
          assignments: "asignaciones",
          task: "Tarea",
          taskName: "Nombre tarea",
          resource: "Recurso",
          resourceName: "Nombre recurso",
          units: "Unidades",
          cost: "Costo",
          empty: "No hay asignaciones importadas.",
        };
  const [localColumnSettings, setLocalColumnSettings] = useState<AssignmentColumnSettings>(
    normalizeAssignmentColumnSettings(columnSettings, locale),
  );
  const effectiveColumnSettings = columnSettings
    ? normalizeAssignmentColumnSettings(columnSettings, locale)
    : localColumnSettings;
  const updateColumnSettings = onColumnSettingsChange ?? setLocalColumnSettings;

  const taskNames = useMemo(
    () => new Map(tasks.map((task) => [String(task.id), task.name])),
    [tasks],
  );
  const resourceNames = useMemo(
    () => new Map(resources.map((resource) => [String(resource.uid), resource.name])),
    [resources],
  );

  const extraColumns = useMemo<ColumnConfig[]>(
    () =>
      mppAssignmentColumns.map((column) => ({
        key: column.key,
        label: locale === "en" ? column.labelEn : column.labelEs,
        labelEn: column.labelEn,
        labelEs: column.labelEs,
        width: column.width ?? 140,
        align: column.dataType === "number" || column.dataType === "currency" ? "right" : "left",
        defaultVisible: false,
        sourceKey: column.sourceKey,
        dataType: column.dataType,
        readOnly: true,
        group: column.group,
        calculationSpec: column.calculationSpec,
      })),
    [mppAssignmentColumns, locale],
  );
  const fieldInspections = useMemo(() => {
    const inspections: Record<string, ReturnType<typeof inspectMppField>> = {};
    for (const column of mppAssignmentColumns) {
      let inspectionForColumn: ReturnType<typeof inspectMppField> | undefined;
      for (const assignment of assignments) {
        const inspection = inspectMppField({
          record: assignment,
          column,
          customFieldDefinitions,
          locale,
        });
        if (inspection.value !== undefined && inspection.value !== null && inspection.value !== "") {
          inspectionForColumn = inspection;
          break;
        }
      }
      if (!inspectionForColumn && assignments[0]) {
        inspectionForColumn = inspectMppField({
          record: assignments[0],
          column,
          customFieldDefinitions,
          locale,
        });
      }
      if (inspectionForColumn) {
        inspections[column.key] = inspectionForColumn;
      }
    }
    return inspections;
  }, [assignments, customFieldDefinitions, locale, mppAssignmentColumns]);
  const visibleExtraColumns = useMemo(
    () => extraColumns.filter((column) => effectiveColumnSettings.visible.includes(column.key)),
    [extraColumns, effectiveColumnSettings.visible],
  );

  const handleToggleColumn = useCallback(
    (key: string) => {
      const visible = effectiveColumnSettings.visible.includes(key)
        ? effectiveColumnSettings.visible.filter((columnKey) => columnKey !== key)
        : [...effectiveColumnSettings.visible, key];
      updateColumnSettings({
        ...effectiveColumnSettings,
        visible,
        labelLocale: locale,
      });
    },
    [effectiveColumnSettings, locale, updateColumnSettings],
  );

  const handleResetColumns = useCallback(() => {
    if (onResetColumns) {
      onResetColumns();
      return;
    }
    updateColumnSettings({
      ...DEFAULT_ASSIGNMENT_COLUMN_SETTINGS,
      visible: [
        ...DEFAULT_ASSIGNMENT_COLUMN_SETTINGS.visible,
        ...extraColumns.filter((column) => column.defaultVisible).map((column) => column.key),
      ],
      labelLocale: locale,
    });
  }, [extraColumns, locale, updateColumnSettings, onResetColumns]);

  return (
    <div data-testid="assignment-sheet-view" className="apple-module flex h-full flex-col">
      <div className="apple-subtoolbar">
        <span className="apple-subtoolbar-count">
          {assignments.length} {labels.assignments}
        </span>
        <div style={{ flex: 1 }} />
        {extraColumns.length > 0 && (
          <ColumnSelector
            columns={extraColumns}
            visibleColumns={visibleExtraColumns.map((column) => column.key)}
            locale={locale}
            onToggle={handleToggleColumn}
            onReset={handleResetColumns}
            onLocaleChange={onLocaleChange ?? (() => undefined)}
            fieldInspections={fieldInspections}
          />
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="apple-table" style={{ width: "100%", tableLayout: "fixed" }}>
          <thead>
            <tr className="apple-grid-header" style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <th style={{ ...thStyle, width: 110 }}>{labels.task}</th>
              <th style={{ ...thStyle }}>{labels.taskName}</th>
              <th style={{ ...thStyle, width: 120 }}>{labels.resource}</th>
              <th style={{ ...thStyle }}>{labels.resourceName}</th>
              <th style={{ ...thStyle, width: 90, textAlign: "right" }}>{labels.units}</th>
              <th style={{ ...thStyle, width: 110, textAlign: "right" }}>{labels.cost}</th>
              {visibleExtraColumns.map((column) => (
                <th
                  key={column.key}
                  style={{ ...thStyle, width: column.width, textAlign: column.align }}
                >
                  {locale === "en" ? column.labelEn ?? column.label : column.labelEs ?? column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment, index) => {
              const taskKey = String(assignment.taskId);
              const resourceKey = String(assignment.resourceId);
              const rowId = String(assignment.mppFields?.__rowId ?? `${taskKey}:${resourceKey}:${index}`);
              const stripeBg = index % 2 === 0 ? "var(--color-bg-elevated)" : "var(--color-bg-surface-secondary)";
              return (
                <tr key={rowId} style={{ background: stripeBg, borderLeft: "3px solid transparent" }}>
                  <td style={{ ...tdStyle, width: 110 }}>{taskKey}</td>
                  <td style={tdStyle}>{taskNames.get(taskKey) ?? "-"}</td>
                  <td style={{ ...tdStyle, width: 120 }}>{resourceKey}</td>
                  <td style={tdStyle}>{resourceNames.get(resourceKey) ?? "-"}</td>
                  <td style={{ ...tdStyle, width: 90, textAlign: "right" }}>{assignment.units}%</td>
                  <td style={{ ...tdStyle, width: 110, textAlign: "right" }}>
                    {assignment.cost ? `$${assignment.cost.toFixed(2)}` : "-"}
                  </td>
                  {visibleExtraColumns.map((column) => {
                    const formatted = formatMppValue(
                      getMppRecordValue(assignment, column.sourceKey ?? column.key),
                      column.dataType,
                      locale,
                    );
                    return (
                      <td
                        key={column.key}
                        style={{ ...tdStyle, width: column.width, textAlign: column.align }}
                        title={formatted}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td
                  colSpan={6 + visibleExtraColumns.length}
                  style={{
                    padding: "48px 16px",
                    textAlign: "center",
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-inter), system-ui, sans-serif",
                    fontSize: "0.9375rem",
                  }}
                >
                  {labels.empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
