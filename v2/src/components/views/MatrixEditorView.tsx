"use client";

import { useMemo, useState } from "react";
import { Check, Grid3X3, Plus, RefreshCw, RotateCcw } from "lucide-react";
import type { GanttTask } from "@/components/gantt/types";
import type {
  ActivityRecipe,
  ActivityRecipeItem,
  AreaNode,
  MatrixActivityOverride,
  MatrixCell,
  MatrixPlan,
  ScopeNode,
} from "@/types/matrix";
import { createDefaultMatrixPlan } from "@/lib/matrix/templates";
import { generateScheduleFromMatrix } from "@/lib/matrix/matrixGenerator";

interface MatrixEditorViewProps {
  matrixPlan?: MatrixPlan;
  tasks: GanttTask[];
  onApplyMatrixPlan: (matrixPlan: MatrixPlan) => void;
  onSyncFromGantt: () => void;
  applyLabel?: string;
}

interface SelectedCellRef {
  scopeId: string;
  areaId: string;
}

function leafScopes(nodes: ScopeNode[]): ScopeNode[] {
  return nodes.flatMap((node) =>
    node.children && node.children.length > 0
      ? leafScopes(node.children)
      : [node],
  );
}

function clonePlan(plan: MatrixPlan): MatrixPlan {
  return JSON.parse(JSON.stringify(plan)) as MatrixPlan;
}

function replaceScope(nodes: ScopeNode[], nextScope: ScopeNode): ScopeNode[] {
  return nodes.map((node) => {
    if (node.id === nextScope.id) return nextScope;
    if (!node.children) return node;
    return { ...node, children: replaceScope(node.children, nextScope) };
  });
}

function cellKey(scopeId: string, areaId: string) {
  return `${scopeId}::${areaId}`;
}

function findRecipeForArea(areaId: string, plan: MatrixPlan): string | undefined {
  if (areaId === "estructura") {
    return plan.recipes.find((recipe) => recipe.id.includes("estructura"))?.id;
  }
  if (areaId === "arquitectura") {
    return plan.recipes.find((recipe) => recipe.id.includes("arquitectura"))?.id;
  }
  return plan.recipes[0]?.id;
}

function getRecipe(plan: MatrixPlan, cell?: MatrixCell): ActivityRecipe | undefined {
  return plan.recipes.find((recipe) => recipe.id === cell?.recipeId);
}

function getOverride(
  cell: MatrixCell | undefined,
  activity: ActivityRecipeItem,
): MatrixActivityOverride {
  const existing = cell?.activityOverrides?.find(
    (override) => override.activityId === activity.id,
  );

  return {
    activityId: activity.id,
    quantity: existing?.quantity ?? cell?.quantity ?? activity.defaultQuantity ?? 1,
    unit: existing?.unit ?? cell?.unit ?? activity.unit ?? "und",
    productivityPerDay:
      existing?.productivityPerDay ??
      cell?.productivityOverridePerDay ??
      activity.productivityPerDay,
    lastEditedAt:
      existing?.lastEditedAt ??
      cell?.lastEditedAt ??
      "2026-01-01T00:00:00.000Z",
    lastEditedFrom: existing?.lastEditedFrom ?? cell?.lastEditedFrom ?? "matrix",
  };
}

function durationDays(override: MatrixActivityOverride): number {
  if (override.quantity <= 0) return 0;
  if (!override.productivityPerDay || override.productivityPerDay <= 0) return 0;
  return Math.max(1, Math.ceil(override.quantity / override.productivityPerDay));
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatQuantitySummary(overrides: MatrixActivityOverride[]): string {
  if (overrides.length === 0) return "Sin cantidades";
  return overrides
    .map((override) =>
      `${formatNumber(override.quantity)} ${override.unit?.trim() || "und"}`,
    )
    .join(" · ");
}

function activityAlerts(
  activity: ActivityRecipeItem,
  override: MatrixActivityOverride,
): string[] {
  const alerts: string[] = [];
  if (override.quantity <= 0) {
    alerts.push(`${activity.name} necesita cantidad mayor a 0.`);
  }
  if (!override.unit?.trim()) {
    alerts.push(`${activity.name} necesita unidad.`);
  }
  if (!override.productivityPerDay || override.productivityPerDay <= 0) {
    alerts.push(`${activity.name} necesita rendimiento mayor a 0.`);
  }
  return alerts;
}

function createOverridesForRecipe(
  recipe: ActivityRecipe | undefined,
  timestamp: string,
): MatrixActivityOverride[] {
  return (
    recipe?.activities.map((activity) => ({
      activityId: activity.id,
      quantity: activity.defaultQuantity ?? 1,
      unit: activity.unit ?? "und",
      productivityPerDay: activity.productivityPerDay,
      lastEditedAt: timestamp,
      lastEditedFrom: "matrix" as const,
    })) ?? []
  );
}

export default function MatrixEditorView({
  matrixPlan,
  tasks,
  onApplyMatrixPlan,
  onSyncFromGantt,
  applyLabel = "Aplicar",
}: MatrixEditorViewProps) {
  const [draft, setDraft] = useState<MatrixPlan | undefined>(
    matrixPlan ? clonePlan(matrixPlan) : undefined,
  );
  const [newScopeName, setNewScopeName] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [selectedCell, setSelectedCell] = useState<SelectedCellRef | null>(() => {
    if (!matrixPlan) return null;
    const firstScope = leafScopes(matrixPlan.scopeTree)[0];
    const firstArea = matrixPlan.areas[0];
    return firstScope && firstArea
      ? { scopeId: firstScope.id, areaId: firstArea.id }
      : null;
  });

  const scopes = useMemo(() => (draft ? leafScopes(draft.scopeTree) : []), [draft]);
  const cellsByPair = useMemo(() => {
    const map = new Map<string, MatrixCell>();
    draft?.cells.forEach((cell) => map.set(cellKey(cell.scopeId, cell.areaId), cell));
    return map;
  }, [draft]);
  const preview = useMemo(
    () => (draft ? generateScheduleFromMatrix(draft) : undefined),
    [draft],
  );
  const matrixTaskCount = tasks.filter((task) => task.matrixSource).length;
  const selectedScope = scopes.find((scope) => scope.id === selectedCell?.scopeId);
  const selectedArea = draft?.areas.find((area) => area.id === selectedCell?.areaId);
  const selectedMatrixCell = selectedCell
    ? cellsByPair.get(cellKey(selectedCell.scopeId, selectedCell.areaId))
    : undefined;
  const selectedRecipe = draft ? getRecipe(draft, selectedMatrixCell) : undefined;
  const selectedOverrides =
    selectedRecipe?.activities.map((activity) =>
      getOverride(selectedMatrixCell, activity),
    ) ?? [];
  const selectedAlerts =
    selectedRecipe?.activities.flatMap((activity) =>
      activityAlerts(activity, getOverride(selectedMatrixCell, activity)),
    ) ?? [];

  const createDraft = () => {
    const firstTaskStart = tasks[0]?.start.toISOString().slice(0, 10);
    const plan = createDefaultMatrixPlan({
      name: "Programación Matricial",
      startDate: firstTaskStart ?? new Date().toISOString().slice(0, 10),
    });
    setDraft(plan);
    const firstScope = leafScopes(plan.scopeTree)[0];
    const firstArea = plan.areas[0];
    if (firstScope && firstArea) {
      setSelectedCell({ scopeId: firstScope.id, areaId: firstArea.id });
    }
  };

  const updateCell = (scopeId: string, areaId: string, updates: Partial<MatrixCell>) => {
    if (!draft) return;
    const existing = cellsByPair.get(cellKey(scopeId, areaId));
    const timestamp = new Date().toISOString();
    const nextCell: MatrixCell = {
      id: existing?.id ?? `cell-${scopeId}-${areaId}`,
      scopeId,
      areaId,
      recipeId: existing?.recipeId ?? findRecipeForArea(areaId, draft),
      active: existing?.active ?? true,
      activityOverrides: existing?.activityOverrides ?? [],
      ...existing,
      ...updates,
      lastEditedAt: timestamp,
      lastEditedFrom: "matrix",
    };

    setDraft({
      ...draft,
      cells: existing
        ? draft.cells.map((cell) => (cell.id === existing.id ? nextCell : cell))
        : [...draft.cells, nextCell],
    });
  };

  const updateActivityOverride = (
    activity: ActivityRecipeItem,
    updates: Partial<MatrixActivityOverride>,
  ) => {
    if (!draft || !selectedCell) return;
    const cell = cellsByPair.get(cellKey(selectedCell.scopeId, selectedCell.areaId));
    const base = getOverride(cell, activity);
    const timestamp = new Date().toISOString();
    const nextOverride: MatrixActivityOverride = {
      ...base,
      ...updates,
      lastEditedAt: timestamp,
      lastEditedFrom: "matrix",
    };
    const overrides = cell?.activityOverrides ?? [];
    const nextOverrides = overrides.some(
      (override) => override.activityId === activity.id,
    )
      ? overrides.map((override) =>
          override.activityId === activity.id ? nextOverride : override,
        )
      : [...overrides, nextOverride];

    updateCell(selectedCell.scopeId, selectedCell.areaId, {
      activityOverrides: nextOverrides,
    });
  };

  const addScope = () => {
    if (!draft || !newScopeName.trim()) return;
    const newScope: ScopeNode = {
      id: `scope-${Date.now()}`,
      name: newScopeName.trim(),
      type: "Zona",
    };
    const timestamp = new Date().toISOString();
    const newCells: MatrixCell[] = draft.areas.map((area) => ({
      id: `cell-${newScope.id}-${area.id}`,
      scopeId: newScope.id,
      areaId: area.id,
      recipeId: findRecipeForArea(area.id, draft) ?? draft.recipes[0]?.id,
      active: false,
      activityOverrides: [],
      lastEditedAt: timestamp,
      lastEditedFrom: "matrix",
    }));
    const nextScopeTree =
      draft.scopeTree.length > 0 && draft.scopeTree[0].children
        ? replaceScope(draft.scopeTree, {
            ...draft.scopeTree[0],
            children: [...(draft.scopeTree[0].children ?? []), newScope],
          })
        : [...draft.scopeTree, newScope];
    const nextPlan = {
      ...draft,
      scopeTree: nextScopeTree,
      cells: [...draft.cells, ...newCells],
    };
    setDraft(nextPlan);
    setSelectedCell(
      draft.areas[0] ? { scopeId: newScope.id, areaId: draft.areas[0].id } : null,
    );
    setNewScopeName("");
  };

  const addArea = () => {
    if (!draft || !newAreaName.trim()) return;
    const id = `area-${Date.now()}`;
    const nextArea: AreaNode = {
      id,
      name: newAreaName.trim(),
      discipline: "Proyecto",
    };
    setDraft({
      ...draft,
      areas: [...draft.areas, nextArea],
      cells: [
        ...draft.cells,
        ...scopes.map((scope) => ({
          id: `cell-${scope.id}-${id}`,
          scopeId: scope.id,
          areaId: id,
          recipeId: draft.recipes[0]?.id,
          active: false,
          activityOverrides: [],
          lastEditedAt: new Date().toISOString(),
          lastEditedFrom: "matrix" as const,
        })),
      ],
    });
    setSelectedCell(scopes[0] ? { scopeId: scopes[0].id, areaId: id } : null);
    setNewAreaName("");
  };

  if (!draft) {
    return (
      <div
        data-testid="matrix-editor-empty"
        className="h-full flex items-center justify-center bg-[var(--aia-alabaster)]"
      >
        <button
          type="button"
          onClick={createDraft}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[var(--aia-corp-main)] text-white text-sm font-semibold"
        >
          <Grid3X3 size={16} />
          Crear matriz
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="matrix-editor"
      className="h-full flex flex-col bg-[var(--aia-alabaster)]"
    >
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[var(--aia-corp-dark)] text-white">
        <Grid3X3 size={18} />
        <div className="min-w-0">
          <h2 className="text-sm font-bold font-[var(--font-heading)] truncate">
            {draft.name}
          </h2>
          <p className="text-xs text-[var(--aia-corp-light)]">
            {scopes.length} alcances · {draft.areas.length} áreas · {matrixTaskCount} tareas vinculadas
          </p>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onSyncFromGantt}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white/10 hover:bg-white/15"
        >
          <RefreshCw size={14} />
          Sincronizar
        </button>
        <button
          type="button"
          onClick={() => setDraft(matrixPlan ? clonePlan(matrixPlan) : draft)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-white/10 hover:bg-white/15"
        >
          <RotateCcw size={14} />
          Deshacer
        </button>
        <button
          type="button"
          onClick={() => onApplyMatrixPlan(draft)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--aia-corp-main)]"
        >
          <Check size={14} />
          {applyLabel}
        </button>
      </div>

      <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border-b border-[var(--gray-200)] bg-white">
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--aia-corp-dark)]">
          Nombre
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className="rounded-md border border-[var(--gray-300)] px-2 py-1.5 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--aia-corp-dark)]">
          Inicio
          <input
            type="date"
            value={draft.startDate}
            onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
            className="rounded-md border border-[var(--gray-300)] px-2 py-1.5 text-sm font-normal"
          />
        </label>
        <div className="flex items-end gap-2">
          <span className="text-xs text-[var(--gray-600)]">
            Preview: {preview?.tasks.length ?? 0} tareas · {preview?.issues.length ?? 0} alertas
          </span>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-white border-b border-[var(--gray-200)]">
        <div className="flex gap-2">
          <input
            value={newScopeName}
            onChange={(event) => setNewScopeName(event.target.value)}
            placeholder="Nuevo alcance"
            className="min-w-0 flex-1 rounded-md border border-[var(--gray-300)] px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={addScope}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[var(--aia-corp-main)] text-white text-xs font-semibold"
          >
            <Plus size={14} />
            Alcance
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={newAreaName}
            onChange={(event) => setNewAreaName(event.target.value)}
            placeholder="Nueva área"
            className="min-w-0 flex-1 rounded-md border border-[var(--gray-300)] px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={addArea}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-[var(--aia-corp-main)] text-white text-xs font-semibold"
          >
            <Plus size={14} />
            Área
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] overflow-hidden">
        <div className="min-h-0 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="bg-[var(--aia-corp-dark)] text-white text-left px-3 py-2 font-semibold">
                  Alcance
                </th>
                {draft.areas.map((area) => (
                  <th
                    key={area.id}
                    className="bg-[var(--aia-corp-dark)] text-white text-left px-3 py-2 font-semibold"
                  >
                    {area.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scopes.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(1, draft.areas.length + 1)}
                    className="bg-white px-3 py-6 text-sm text-[var(--gray-500)]"
                  >
                    Sin alcances. Agrega el primer alcance para construir la matriz.
                  </td>
                </tr>
              )}
              {scopes.map((scope) => (
                <tr key={scope.id} className="border-b border-[var(--gray-200)]">
                  <th className="sticky left-0 bg-white text-left px-3 py-2 font-semibold text-[var(--aia-corp-dark)]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCell({
                          scopeId: scope.id,
                          areaId: draft.areas[0]?.id ?? "",
                        })
                      }
                      className="font-semibold text-left"
                    >
                      {scope.name}
                    </button>
                  </th>
                  {draft.areas.map((area) => {
                    const cell = cellsByPair.get(cellKey(scope.id, area.id));
                    const recipe = getRecipe(draft, cell);
                    const overrides =
                      recipe?.activities.map((activity) =>
                        getOverride(cell, activity),
                      ) ?? [];
                    const totalDuration = overrides.reduce(
                      (sum, override) => sum + durationDays(override),
                      0,
                    );
                    const quantitySummary = formatQuantitySummary(overrides);
                    const isSelected =
                      selectedCell?.scopeId === scope.id &&
                      selectedCell.areaId === area.id;

                    return (
                      <td key={area.id} className="bg-white px-3 py-2 align-top">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCell({ scopeId: scope.id, areaId: area.id })
                          }
                          className="w-full text-left rounded-md border px-3 py-2"
                          style={{
                            borderColor: isSelected
                              ? "var(--aia-corp-main)"
                              : "var(--gray-200)",
                            background: cell?.active
                              ? "var(--aia-corp-xlight)"
                              : "var(--gray-100)",
                          }}
                        >
                          <span className="block text-xs font-semibold text-[var(--aia-corp-dark)]">
                            {cell?.active ? recipe?.name ?? "Sin receta" : "Inactiva"}
                          </span>
                          <span className="block text-xs text-[var(--gray-600)]">
                            {overrides.length} actividades · {totalDuration} días
                          </span>
                          <span className="block text-xs text-[var(--gray-500)] truncate">
                            {quantitySummary}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside
          data-testid="matrix-cell-panel"
          className="min-h-0 overflow-auto border-l border-[var(--gray-200)] bg-white p-4"
        >
          {selectedCell && selectedScope && selectedArea && selectedMatrixCell ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--gray-500)]">
                  Celda seleccionada
                </p>
                <h3 className="text-lg font-bold text-[var(--aia-corp-dark)]">
                  {selectedScope.name} × {selectedArea.name}
                </h3>
                <p className="mt-1 text-xs text-[var(--gray-500)]">
                  {formatQuantitySummary(selectedOverrides)}
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--aia-corp-dark)]">
                <input
                  type="checkbox"
                  checked={selectedMatrixCell.active}
                  onChange={(event) =>
                    updateCell(selectedCell.scopeId, selectedCell.areaId, {
                      active: event.target.checked,
                    })
                  }
                />
                Celda activa
              </label>

              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--aia-corp-dark)]">
                Receta
                <select
                  value={selectedMatrixCell.recipeId ?? ""}
                  onChange={(event) => {
                    const timestamp = new Date().toISOString();
                    const nextRecipe = draft.recipes.find(
                      (recipe) => recipe.id === event.target.value,
                    );
                    updateCell(selectedCell.scopeId, selectedCell.areaId, {
                      recipeId: event.target.value,
                      activityOverrides: createOverridesForRecipe(
                        nextRecipe,
                        timestamp,
                      ),
                    });
                  }}
                  className="rounded-md border border-[var(--gray-300)] px-2 py-1.5 text-sm font-normal"
                >
                  {draft.recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedAlerts.length > 0 && (
                <div className="rounded-md border border-[var(--aia-alert-main)] bg-[var(--aia-alert-xlight)] p-3 text-xs text-[var(--aia-alert-main)]">
                  <p className="font-bold text-[var(--aia-alert-main)]">
                    Datos faltantes
                  </p>
                  <ul className="mt-2 space-y-1">
                    {selectedAlerts.map((alert) => (
                      <li key={alert}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                {selectedRecipe?.activities.map((activity) => {
                  const override = getOverride(selectedMatrixCell, activity);
                  return (
                    <div
                      key={activity.id}
                      className="rounded-md border border-[var(--gray-200)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-[var(--aia-corp-dark)]">
                          {activity.name}
                        </h4>
                        <span className="text-xs text-[var(--gray-500)]">
                          {formatNumber(durationDays(override))} días
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--gray-600)]">
                          Cantidad
                          <input
                            aria-label={`Cantidad ${activity.name}`}
                            type="number"
                            min="0"
                            value={override.quantity}
                            onChange={(event) =>
                              updateActivityOverride(activity, {
                                quantity: Number(event.target.value),
                              })
                            }
                            className="rounded-md border border-[var(--gray-300)] px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--gray-600)]">
                          Unidad
                          <input
                            aria-label={`Unidad ${activity.name}`}
                            value={override.unit ?? ""}
                            onChange={(event) =>
                              updateActivityOverride(activity, {
                                unit: event.target.value,
                              })
                            }
                            className="rounded-md border border-[var(--gray-300)] px-2 py-1 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--gray-600)]">
                          Rendimiento
                          <input
                            aria-label={`Rendimiento ${activity.name}`}
                            type="number"
                            min="0"
                            value={override.productivityPerDay ?? 0}
                            onChange={(event) =>
                              updateActivityOverride(activity, {
                                productivityPerDay: Number(event.target.value),
                              })
                            }
                            className="rounded-md border border-[var(--gray-300)] px-2 py-1 text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedRecipe && selectedRecipe.dependencies.length > 0 && (
                <div className="rounded-md bg-[var(--aia-corp-xlight)] p-3 text-xs text-[var(--aia-corp-dark)]">
                  {selectedRecipe.dependencies.length} dependencias internas configuradas.
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-[var(--gray-500)]">
              Selecciona una celda para editar receta, cantidades y rendimientos.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
