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
import {
  createAssignment,
  detectOverallocation,
  wouldOverallocate,
} from "@/lib/scheduling/assignments";

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
  /**
   * Alta y baja de asignaciones. Sin ellas, quien arma el proyecto en la app
   * —sin importar un `.mpp`— tenía esta pestaña vacía para siempre (M14).
   */
  onCreateAssignment?: (assignment: Assignment) => void;
  onDeleteAssignment?: (assignment: Assignment) => void;
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
  onCreateAssignment,
  onDeleteAssignment,
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
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [nuevoRecurso, setNuevoRecurso] = useState("");
  const [nuevasUnidades, setNuevasUnidades] = useState(100);

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

  const candidata: Assignment | null =
    nuevaTarea && nuevoRecurso
      ? createAssignment(
          Number.isNaN(Number(nuevaTarea)) ? nuevaTarea : Number(nuevaTarea),
          Number(nuevoRecurso),
          nuevasUnidades,
          resources,
          tasks,
        )
      : null;

  /** Avisar antes de crear, no después de que Problemas lo descubra (M19). */
  const avisoSobrecarga = candidata
    ? wouldOverallocate(assignments, resources, tasks, candidata)
    : null;

  const sobrecargados = useMemo(() => {
    const marcados = new Set<number>();
    for (const resultado of detectOverallocation(assignments, resources, tasks)) {
      if (resultado.isOverallocated) marcados.add(resultado.resourceId);
    }
    return marcados;
  }, [assignments, resources, tasks]);

  return (
    <div data-testid="assignment-sheet-view" className="apple-module flex h-full flex-col">
      <div className="apple-subtoolbar">
        <span className="apple-subtoolbar-count">
          {assignments.length} {labels.assignments}
        </span>
        <div style={{ flex: 1 }} />
        {onCreateAssignment && !formularioAbierto && (
          <button
            type="button"
            data-testid="assignment-add"
            onClick={() => setFormularioAbierto(true)}
            className="apple-button-secondary rounded-[var(--radius-lg)] px-3 py-1 text-sm font-semibold"
          >
            Asignar recurso
          </button>
        )}
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

      {formularioAbierto && onCreateAssignment && (
        <div className="apple-section m-3 flex flex-wrap items-end gap-3 p-3">
          <label className="flex flex-col gap-1 text-sm">
            Actividad
            <select
              data-testid="assignment-task"
              value={nuevaTarea}
              onChange={(event) => setNuevaTarea(event.target.value)}
              className="gantt-project-toolbar__baseline-name"
            >
              <option value="">Elige una actividad</option>
              {tasks
                .filter((task) => !task.isSummary)
                .map((task) => (
                  <option key={String(task.id)} value={String(task.id)}>
                    {task.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Recurso
            <select
              data-testid="assignment-resource"
              value={nuevoRecurso}
              onChange={(event) => setNuevoRecurso(event.target.value)}
              className="gantt-project-toolbar__baseline-name"
            >
              <option value="">Elige un recurso</option>
              {resources.map((resource) => (
                <option key={resource.uid} value={String(resource.uid)}>
                  {resource.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Dedicación (%)
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              data-testid="assignment-units"
              value={nuevasUnidades}
              onChange={(event) =>
                setNuevasUnidades(Number(event.target.value) || 0)
              }
              className="gantt-project-toolbar__baseline-name"
            />
          </label>

          <button
            type="button"
            data-testid="assignment-confirm"
            disabled={!candidata}
            onClick={() => {
              if (!candidata) return;
              onCreateAssignment(candidata);
              setFormularioAbierto(false);
              setNuevaTarea("");
              setNuevoRecurso("");
            }}
            className="apple-button-primary rounded-[var(--radius-lg)] px-3 py-1.5 text-sm font-semibold"
          >
            Asignar
          </button>

          <button
            type="button"
            onClick={() => setFormularioAbierto(false)}
            className="apple-button-secondary rounded-[var(--radius-lg)] px-3 py-1.5 text-sm font-semibold"
          >
            Cancelar
          </button>

          {avisoSobrecarga && (
            <p
              data-testid="assignment-overload-warning"
              role="status"
              className="basis-full text-sm text-[var(--aia-warn-main)]"
            >
              Con esta asignación, {avisoSobrecarga.resourceName} queda
              sobrecargado: ya tiene trabajo ese día. Puedes asignarlo igual y
              resolverlo después.
            </p>
          )}
        </div>
      )}

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
              {onDeleteAssignment && (
                <th style={{ ...thStyle, width: 90 }}>
                  {locale === "en" ? "Remove" : "Quitar"}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment, index) => {
              const taskKey = String(assignment.taskId);
              const resourceKey = String(assignment.resourceId);
              const rowId = String(assignment.mppFields?.__rowId ?? `${taskKey}:${resourceKey}:${index}`);
              const stripeBg = index % 2 === 0 ? "var(--color-bg-elevated)" : "var(--color-bg-surface-secondary)";
              return (
                <tr
                  key={rowId}
                  {...(sobrecargados.has(assignment.resourceId)
                    ? { "data-testid": "assignment-overloaded" }
                    : {})}
                  style={{
                    background: stripeBg,
                    borderLeft: sobrecargados.has(assignment.resourceId)
                      ? "3px solid var(--aia-alert-main)"
                      : "3px solid transparent",
                  }}
                >
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
                  {onDeleteAssignment && (
                    <td style={{ ...tdStyle, width: 90 }}>
                      <button
                        type="button"
                        data-testid="assignment-delete"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Se va a quitar «${resourceNames.get(resourceKey) ?? resourceKey}» de «${taskNames.get(taskKey) ?? taskKey}». ¿Seguro?`,
                            )
                          ) {
                            return;
                          }
                          onDeleteAssignment(assignment);
                        }}
                        className="gantt-project-toolbar__button gantt-project-toolbar__button--danger"
                      >
                        Quitar
                      </button>
                    </td>
                  )}
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
