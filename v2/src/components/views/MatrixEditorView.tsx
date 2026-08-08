"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  CornerDownRight,
  Grid3X3,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
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
import {
  canAddChild,
  getAreaLeaves,
  getAreaNodeIds,
  getScopeLeaves,
  getScopeNodeIds,
  insertAreaChild,
  insertAreaSibling,
  insertScopeChild,
  insertScopeSibling,
  migrateAreaCellsToChild,
  migrateScopeCellsToChild,
  reconcileMatrixCells,
  removeAreaNode,
  removeScopeNode,
  updateAreaNode,
  updateScopeNode,
} from "@/lib/matrix/tree";

interface MatrixEditorViewProps {
  matrixPlan?: MatrixPlan;
  tasks: GanttTask[];
  onApplyMatrixPlan: (matrixPlan: MatrixPlan) => void;
  onSyncFromGantt: () => void;
  /** Avisa al proyecto de que hay borrador sin aplicar, para el aviso al cerrar (M28). */
  onDirtyChange?: (dirty: boolean) => void;
  applyLabel?: string;
}

interface SelectedCellRef {
  scopeId: string;
  areaId: string;
}

type MatrixEditorMode = "scopes" | "locations" | "matrix";

const matrixInputClass =
  "rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] px-2 py-1 text-sm";

const matrixIconButtonClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]";

const scopeTypeOptions = [
  "Capítulo",
  "Subcapitulo",
  "Disciplina",
  "Partida",
  "Actividad tipo",
  "Sub-Alcance",
  "Resumen MPP",
  "Tarea MPP",
];

const areaTypeOptions = [
  "Etapa",
  "Torre",
  "Nivel",
  "Piso",
  "Unidad",
  "Ambiente",
  "Sub-Ubicación",
  "Ubicación",
  "Apartamento",
  "Habitacion",
  "Zona",
  "Local",
  "Km",
  "MPP",
];

function includeCurrentTypeOption(options: string[], currentValue?: string): string[] {
  const current = currentValue?.trim();
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

/**
 * Cuántas celdas difieren entre lo aplicado y el borrador. Es el número que el
 * usuario necesita para decidir si descarta.
 */
function contarDiferenciasDeMatriz(
  aplicado: MatrixPlan,
  borrador: MatrixPlan,
): number {
  const previas = new Map(
    (aplicado.cells ?? []).map((cell) => [cell.id, JSON.stringify(cell)]),
  );
  let diferencias = 0;

  for (const cell of borrador.cells ?? []) {
    if (previas.get(cell.id) !== JSON.stringify(cell)) diferencias += 1;
    previas.delete(cell.id);
  }

  return diferencias + previas.size;
}

function clonePlan(plan: MatrixPlan): MatrixPlan {
  return JSON.parse(JSON.stringify(plan)) as MatrixPlan;
}

function cellKey(scopeId: string, areaId: string) {
  return `${scopeId}::${areaId}`;
}

function inferRecipeIdForScopeLabel(
  label: string,
  recipes: ActivityRecipe[],
): string | undefined {
  const normalized = sanitizeId(label);
  if (normalized.includes("estructura")) {
    return recipes.find((recipe) => recipe.id.includes("estructura"))?.id;
  }
  if (normalized.includes("arquitectura")) {
    return recipes.find((recipe) => recipe.id.includes("arquitectura"))?.id;
  }
  if (normalized.includes("mep") || normalized.includes("redes")) {
    return recipes.find((recipe) => recipe.id.includes("mep"))?.id;
  }
  return undefined;
}

function inferAreaTypeForLabel(label: string): string {
  const normalized = sanitizeId(label);
  if (normalized.includes("piso")) return "Piso";
  if (normalized.includes("nivel")) return "Nivel";
  if (normalized.includes("torre")) return "Torre";
  if (normalized.includes("etapa")) return "Etapa";
  if (normalized.includes("bloque")) return "Bloque";
  if (normalized.includes("apartamento") || normalized.includes("apto")) {
    return "Apartamento";
  }
  if (normalized.includes("habitacion")) return "Habitacion";
  if (normalized.includes("zona")) return "Zona";
  if (normalized.includes("local")) return "Local";
  if (normalized.includes("km")) return "Km";
  return "Ubicación";
}

function findRecipeForScope(scopeId: string, plan: MatrixPlan): string | undefined {
  const scope = getScopeLeaves(plan.scopeTree)
    .map((leaf) => leaf.node)
    .find((node) => node.id === scopeId);
  return scope?.defaultRecipeId
    ?? inferRecipeIdForScopeLabel(`${scopeId} ${scope?.name ?? ""}`, plan.recipes)
    ?? plan.recipes[0]?.id;
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

function findScope(nodes: ScopeNode[], id: string): ScopeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = node.children ? findScope(node.children, id) : undefined;
    if (child) return child;
  }
  return undefined;
}

function findArea(nodes: AreaNode[], id: string): AreaNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = node.children ? findArea(node.children, id) : undefined;
    if (child) return child;
  }
  return undefined;
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createNodeId(prefix: string, label: string): string {
  return `${prefix}-${Date.now()}-${sanitizeId(label) || "nuevo"}`;
}

export default function MatrixEditorView({
  matrixPlan,
  tasks,
  onApplyMatrixPlan,
  onSyncFromGantt,
  onDirtyChange,
  applyLabel = "Aplicar",
}: MatrixEditorViewProps) {
  const [draft, setDraft] = useState<MatrixPlan | undefined>(
    matrixPlan ? clonePlan(matrixPlan) : undefined,
  );
  /**
   * El borrador se perdía sin decir nada al cambiar de pestaña o recargar, y
   * «Deshacer» lo tiraba entero sin avisar de cuánto (M28).
   */
  const cambiosPendientes = useMemo(() => {
    if (!draft) return 0;
    if (!matrixPlan) return draft.cells?.length ?? 0;
    return contarDiferenciasDeMatriz(matrixPlan, draft);
  }, [draft, matrixPlan]);
  const tieneCambios = cambiosPendientes > 0;

  useEffect(() => {
    onDirtyChange?.(tieneCambios);
    // Al desmontar —cambiar de vista— el borrador se pierde: deja de haber
    // trabajo pendiente por el que preguntar al cerrar.
    return () => onDirtyChange?.(false);
  }, [tieneCambios, onDirtyChange]);

  const descartarCambios = useCallback(() => {
    if (!tieneCambios) return;
    const plural = cambiosPendientes === 1 ? "cambio" : "cambios";
    if (
      !window.confirm(
        `Se van a descartar ${cambiosPendientes} ${plural} sin aplicar. ¿Seguro?`,
      )
    ) {
      return;
    }
    setDraft(matrixPlan ? clonePlan(matrixPlan) : draft);
  }, [cambiosPendientes, draft, matrixPlan, tieneCambios]);

  const [activeMode, setActiveMode] = useState<MatrixEditorMode>("matrix");
  const [notice, setNotice] = useState<string | null>(null);
  const [newScopeName, setNewScopeName] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [selectedCell, setSelectedCell] = useState<SelectedCellRef | null>(() => {
    if (!matrixPlan) return null;
    const firstScope = getScopeLeaves(matrixPlan.scopeTree)[0]?.node;
    const firstArea = getAreaLeaves(matrixPlan.areas)[0]?.node;
    return firstScope && firstArea
      ? { scopeId: firstScope.id, areaId: firstArea.id }
      : null;
  });

  const scopeLeaves = useMemo(
    () => (draft ? getScopeLeaves(draft.scopeTree) : []),
    [draft],
  );
  const areaLeaves = useMemo(
    () => (draft ? getAreaLeaves(draft.areas) : []),
    [draft],
  );
  const scopes = useMemo(() => scopeLeaves.map((leaf) => leaf.node), [scopeLeaves]);
  const areas = useMemo(() => areaLeaves.map((leaf) => leaf.node), [areaLeaves]);
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
  const selectedArea = areas.find((area) => area.id === selectedCell?.areaId);
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
    const firstScope = getScopeLeaves(plan.scopeTree)[0]?.node;
    const firstArea = getAreaLeaves(plan.areas)[0]?.node;
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
      recipeId: existing?.recipeId ?? findRecipeForScope(scopeId, draft),
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

  const applyNextDraft = (nextPlan: MatrixPlan) => {
    const next = reconcileMatrixCells(nextPlan);
    setDraft(next);
    const firstScope = getScopeLeaves(next.scopeTree)[0]?.node;
    const firstArea = getAreaLeaves(next.areas)[0]?.node;
    if (
      selectedCell &&
      next.cells.some(
        (cell) =>
          cell.scopeId === selectedCell.scopeId && cell.areaId === selectedCell.areaId,
      )
    ) {
      return;
    }
    setSelectedCell(
      firstScope && firstArea ? { scopeId: firstScope.id, areaId: firstArea.id } : null,
    );
  };

  const activateAllCells = () => {
    if (!draft) return;
    const timestamp = new Date().toISOString();
    const next = reconcileMatrixCells(draft, timestamp);
    setDraft({
      ...next,
      cells: next.cells.map((cell) => ({
        ...cell,
        active: true,
        recipeId: cell.recipeId ?? findRecipeForScope(cell.scopeId, next),
        lastEditedAt: timestamp,
        lastEditedFrom: "matrix",
      })),
    });

    if (!selectedCell) {
      const firstScope = getScopeLeaves(next.scopeTree)[0]?.node;
      const firstArea = getAreaLeaves(next.areas)[0]?.node;
      setSelectedCell(
        firstScope && firstArea
          ? { scopeId: firstScope.id, areaId: firstArea.id }
          : null,
      );
    }
  };

  const addScope = () => {
    if (!draft || !newScopeName.trim()) return;
    const recipeId =
      inferRecipeIdForScopeLabel(newScopeName.trim(), draft.recipes) ??
      draft.recipes[0]?.id;
    const newScope: ScopeNode = {
      id: createNodeId("scope", newScopeName.trim()),
      name: newScopeName.trim(),
      type: "Disciplina",
      defaultRecipeId: recipeId,
    };
    const nextPlan: MatrixPlan = {
      ...draft,
      scopeTree: [...draft.scopeTree, newScope],
    };
    applyNextDraft(nextPlan);
    if (areas[0]) setSelectedCell({ scopeId: newScope.id, areaId: areas[0].id });
    setNewScopeName("");
  };

  const addArea = () => {
    if (!draft || !newAreaName.trim()) return;
    const id = createNodeId("area", newAreaName.trim());
    const nextArea: AreaNode = {
      id,
      name: newAreaName.trim(),
      type: inferAreaTypeForLabel(newAreaName.trim()),
    };
    const nextPlan: MatrixPlan = {
      ...draft,
      areas: [...draft.areas, nextArea],
    };
    applyNextDraft(nextPlan);
    setSelectedCell(scopes[0] ? { scopeId: scopes[0].id, areaId: id } : null);
    setNewAreaName("");
  };

  const addScopeChild = (parentId: string) => {
    if (!draft) return;
    setNotice(null);
    if (!canAddChild(draft.scopeTree, parentId)) {
      setNotice("Máximo 10 niveles de jerarquía.");
      return;
    }
    const parent = findScope(draft.scopeTree, parentId);
    const parentCells = draft.cells.filter((cell) => cell.scopeId === parentId);
    if (
      parentCells.length > 0 &&
      !window.confirm(
        `El alcance ${parent?.name ?? parentId} tiene ${parentCells.length} celdas. Se moveran al nuevo hijo.`,
      )
    ) {
      return;
    }
    const recipeId =
      parent?.defaultRecipeId ?? parentCells[0]?.recipeId ?? draft.recipes[0]?.id;
    const child: ScopeNode = {
      id: createNodeId("scope", parentId),
      name: "Nuevo sub-alcance",
      type: "Sub-Alcance",
      defaultRecipeId: recipeId,
    };
    let nextPlan: MatrixPlan = {
      ...draft,
      scopeTree: insertScopeChild(draft.scopeTree, parentId, child),
    };
    if (parentCells.length > 0) {
      nextPlan = migrateScopeCellsToChild(nextPlan, parentId, child);
    }
    applyNextDraft(nextPlan);
    if (areas[0]) setSelectedCell({ scopeId: child.id, areaId: areas[0].id });
  };

  const addScopeSibling = (targetId: string) => {
    if (!draft) return;
    const sibling: ScopeNode = {
      id: createNodeId("scope", targetId),
      name: "Nuevo sub-alcance",
      type: "Sub-Alcance",
      defaultRecipeId: draft.recipes[0]?.id,
    };
    applyNextDraft({
      ...draft,
      scopeTree: insertScopeSibling(draft.scopeTree, targetId, sibling),
    });
  };

  const addAreaChild = (parentId: string) => {
    if (!draft) return;
    setNotice(null);
    if (!canAddChild(draft.areas, parentId)) {
      setNotice("Máximo 10 niveles de jerarquía.");
      return;
    }
    const parent = findArea(draft.areas, parentId);
    const parentCells = draft.cells.filter((cell) => cell.areaId === parentId);
    if (
      parentCells.length > 0 &&
      !window.confirm(
        `La ubicacion ${parent?.name ?? parentId} tiene ${parentCells.length} celdas. Se moveran al nuevo hijo.`,
      )
    ) {
      return;
    }
    const child: AreaNode = {
      id: createNodeId("area", parentId),
      name: "Nueva sub-ubicación",
      type: "Sub-Ubicación",
    };
    let nextPlan: MatrixPlan = {
      ...draft,
      areas: insertAreaChild(draft.areas, parentId, child),
    };
    if (parentCells.length > 0) {
      nextPlan = migrateAreaCellsToChild(nextPlan, parentId, child);
    }
    applyNextDraft(nextPlan);
    if (scopes[0]) setSelectedCell({ scopeId: scopes[0].id, areaId: child.id });
  };

  const addAreaSibling = (targetId: string) => {
    if (!draft) return;
    const sibling: AreaNode = {
      id: createNodeId("area", targetId),
      name: "Nueva sub-ubicación",
      type: "Sub-Ubicación",
    };
    applyNextDraft({
      ...draft,
      areas: insertAreaSibling(draft.areas, targetId, sibling),
    });
  };

  const deleteScope = (scopeId: string) => {
    if (!draft) return;
    const ids = getScopeNodeIds(draft.scopeTree, scopeId);
    const cellCount = draft.cells.filter((cell) => ids.includes(cell.scopeId)).length;
    if (
      !window.confirm(
        `Se eliminaran ${ids.length} alcances y ${cellCount} celdas. Esta accion no se puede deshacer.`,
      )
    ) {
      return;
    }
    applyNextDraft(removeScopeNode(draft, scopeId));
  };

  const deleteArea = (areaId: string) => {
    if (!draft) return;
    const ids = getAreaNodeIds(draft.areas, areaId);
    const cellCount = draft.cells.filter((cell) => ids.includes(cell.areaId)).length;
    if (
      !window.confirm(
        `Se eliminaran ${ids.length} ubicaciones y ${cellCount} celdas. Esta accion no se puede deshacer.`,
      )
    ) {
      return;
    }
    applyNextDraft(removeAreaNode(draft, areaId));
  };

  const updateScopeDetails = (scopeId: string, updates: Partial<ScopeNode>) => {
    if (!draft) return;
    applyNextDraft({
      ...draft,
      scopeTree: updateScopeNode(draft.scopeTree, scopeId, updates),
    });
  };

  const updateAreaDetails = (areaId: string, updates: Partial<AreaNode>) => {
    if (!draft) return;
    applyNextDraft({
      ...draft,
      areas: updateAreaNode(draft.areas, areaId, updates),
    });
  };

  const updateScopeRecipe = (scopeId: string, recipeId: string) => {
    if (!draft) return;
    const timestamp = new Date().toISOString();
    const recipe = draft.recipes.find((item) => item.id === recipeId);
    applyNextDraft({
      ...draft,
      scopeTree: updateScopeNode(draft.scopeTree, scopeId, {
        defaultRecipeId: recipeId,
      }),
      cells: draft.cells.map((cell) =>
        cell.scopeId === scopeId
          ? {
              ...cell,
              recipeId,
              activityOverrides: createOverridesForRecipe(recipe, timestamp),
              lastEditedAt: timestamp,
              lastEditedFrom: "matrix" as const,
            }
          : cell,
      ),
    });
  };

  const renderScopeTree = (nodes: ScopeNode[], depth = 1): ReactNode =>
    nodes.map((node) => {
      const isLeaf = !node.children || node.children.length === 0;
      return (
        <div key={node.id} className="space-y-2" style={{ marginLeft: (depth - 1) * 16 }}>
          <div className="apple-section p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                Nivel {depth}
              </span>
              <span className="text-sm font-bold text-[var(--color-text-strong)]">
                {node.name}
              </span>
              <span className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                {isLeaf ? "Hoja" : "Grupo"}
              </span>
              <div className="flex-1" />
              <button
                type="button"
                aria-label={`Agregar hijo a ${node.name}`}
                title={`Agregar hijo a ${node.name}`}
                onClick={() => addScopeChild(node.id)}
                className={matrixIconButtonClass}
              >
                <CornerDownRight size={14} />
              </button>
              <button
                type="button"
                aria-label={`Agregar hermano de ${node.name}`}
                title={`Agregar hermano de ${node.name}`}
                onClick={() => addScopeSibling(node.id)}
                className={matrixIconButtonClass}
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                aria-label={`Eliminar ${node.name}`}
                onClick={() => deleteScope(node.id)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--aia-alert-main)] text-[var(--aia-alert-main)]"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                Nombre
                <input
                  aria-label={`Nombre alcance ${node.name}`}
                  value={node.name}
                  onChange={(event) =>
                    updateScopeDetails(node.id, { name: event.target.value })
                  }
                  className={matrixInputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                Tipo
                <select
                  aria-label={`Tipo alcance ${node.name}`}
                  value={node.type}
                  onChange={(event) =>
                    updateScopeDetails(node.id, { type: event.target.value })
                  }
                  className={matrixInputClass}
                >
                  {includeCurrentTypeOption(scopeTypeOptions, node.type).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                Receta
                <select
                  aria-label={`Receta alcance ${node.name}`}
                  disabled={!isLeaf}
                  value={node.defaultRecipeId ?? draft?.recipes[0]?.id ?? ""}
                  onChange={(event) => updateScopeRecipe(node.id, event.target.value)}
                  className={`${matrixInputClass} disabled:bg-[var(--color-bg-surface-secondary)]`}
                >
                  {draft?.recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {node.children && node.children.length > 0
            ? renderScopeTree(node.children, depth + 1)
            : null}
        </div>
      );
    });

  const renderAreaTree = (nodes: AreaNode[], depth = 1): ReactNode =>
    nodes.map((node) => {
      const isLeaf = !node.children || node.children.length === 0;
      return (
        <div key={node.id} className="space-y-2" style={{ marginLeft: (depth - 1) * 16 }}>
          <div className="apple-section p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                Nivel {depth}
              </span>
              <span className="text-sm font-bold text-[var(--color-text-strong)]">
                {node.name}
              </span>
              <span className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                {isLeaf ? "Hoja" : "Grupo"}
              </span>
              <div className="flex-1" />
              <button
                type="button"
                aria-label={`Agregar hijo a ${node.name}`}
                title={`Agregar hijo a ${node.name}`}
                onClick={() => addAreaChild(node.id)}
                className={matrixIconButtonClass}
              >
                <CornerDownRight size={14} />
              </button>
              <button
                type="button"
                aria-label={`Agregar hermano de ${node.name}`}
                title={`Agregar hermano de ${node.name}`}
                onClick={() => addAreaSibling(node.id)}
                className={matrixIconButtonClass}
              >
                <Plus size={14} />
              </button>
              <button
                type="button"
                aria-label={`Eliminar ${node.name}`}
                onClick={() => deleteArea(node.id)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--aia-alert-main)] text-[var(--aia-alert-main)]"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                Nombre
                <input
                  aria-label={`Nombre ubicación ${node.name}`}
                  value={node.name}
                  onChange={(event) =>
                    updateAreaDetails(node.id, { name: event.target.value })
                  }
                  className={matrixInputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                Tipo
                <select
                  aria-label={`Tipo ubicación ${node.name}`}
                  value={node.type ?? ""}
                  onChange={(event) =>
                    updateAreaDetails(node.id, { type: event.target.value || undefined })
                  }
                  className={matrixInputClass}
                >
                  <option value="">Sin tipo</option>
                  {includeCurrentTypeOption(areaTypeOptions, node.type).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {node.children && node.children.length > 0
            ? renderAreaTree(node.children, depth + 1)
            : null}
        </div>
      );
    });

  if (!draft) {
    return (
      <div
        data-testid="matrix-editor-empty"
        className="apple-module h-full flex items-center justify-center"
      >
        <button
          type="button"
          onClick={createDraft}
          className="apple-button-primary inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold"
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
      className="apple-module h-full flex flex-col"
    >
      <div className="apple-module-header shrink-0 flex flex-wrap items-start gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          <Grid3X3 size={18} color="var(--aia-corp-main)" className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold font-[var(--font-heading)] truncate text-[var(--color-text-strong)]">
              {draft.name}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {scopes.length} disciplinas · {areas.length} ubicaciones · {matrixTaskCount} tareas vinculadas
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 basis-full flex-wrap justify-start gap-2 md:basis-auto md:justify-end">
          <button
            type="button"
            onClick={onSyncFromGantt}
            className="apple-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
          >
            <RefreshCw size={14} />
            Sincronizar
          </button>
          <button
            type="button"
            onClick={activateAllCells}
            disabled={scopes.length === 0 || areas.length === 0}
            className="apple-button-secondary inline-flex max-w-full items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={14} />
            <span className="min-w-0 whitespace-normal text-left leading-tight">Activar todas las celdas</span>
          </button>
          {tieneCambios && (
            <span
              data-testid="matrix-dirty"
              className="text-xs font-semibold text-[var(--aia-warn-main)]"
            >
              Cambios sin aplicar
            </span>
          )}
          <button
            type="button"
            data-testid="matrix-discard"
            onClick={descartarCambios}
            className="apple-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
          >
            <RotateCcw size={14} />
            Descartar cambios
          </button>
          <button
            type="button"
            onClick={() => onApplyMatrixPlan(reconcileMatrixCells(draft))}
            className="apple-button-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
          >
            <Check size={14} />
            {applyLabel}
          </button>
        </div>
      </div>

      <div className="apple-module-header shrink-0 flex items-center gap-2 px-3 py-2">
        <div className="apple-segmented">
        {[
          ["scopes", "Alcances"],
          ["locations", "Ubicaciones"],
          ["matrix", "Matriz"],
        ].map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            onClick={() => setActiveMode(mode as MatrixEditorMode)}
            className="rounded-md px-3 py-1.5 text-xs font-semibold"
            style={{
              background:
                activeMode === mode ? "var(--aia-corp-main)" : "transparent",
              color: activeMode === mode ? "white" : "var(--color-text-muted)",
            }}
          >
            {label}
          </button>
        ))}
        </div>
        {notice && (
          <span className="ml-auto text-xs font-semibold text-[var(--aia-alert-main)]">
            {notice}
          </span>
        )}
      </div>

      <div className="apple-module-header shrink-0 grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-strong)]">
          Nombre
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className={`${matrixInputClass} py-1.5 font-normal`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-strong)]">
          Inicio
          <input
            type="date"
            value={draft.startDate}
            onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
            className={`${matrixInputClass} py-1.5 font-normal`}
          />
        </label>
        <div className="flex items-end gap-2">
          <span className="text-xs text-[var(--color-text-muted)]">
            Preview: {preview?.tasks.length ?? 0} tareas · {preview?.issues.length ?? 0} alertas
          </span>
        </div>
      </div>

      <div className="apple-module-header shrink-0 grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
        <div className="flex gap-2">
          <input
            value={newScopeName}
            onChange={(event) => setNewScopeName(event.target.value)}
            placeholder="Nueva disciplina"
            className={`${matrixInputClass} min-w-0 flex-1 py-1.5`}
          />
          <button
            type="button"
            onClick={addScope}
            className="apple-button-primary inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold"
          >
            <Plus size={14} />
            Disciplina
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={newAreaName}
            onChange={(event) => setNewAreaName(event.target.value)}
            placeholder="Nueva ubicación"
            className={`${matrixInputClass} min-w-0 flex-1 py-1.5`}
          />
          <button
            type="button"
            onClick={addArea}
            className="apple-button-primary inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold"
          >
            <Plus size={14} />
            Ubicación
          </button>
        </div>
      </div>

      {activeMode === "scopes" ? (
        <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
          {draft.scopeTree.length > 0 ? (
            renderScopeTree(draft.scopeTree)
          ) : (
            <div className="apple-section px-3 py-6 text-sm text-[var(--color-text-muted)]">
              Sin alcances. Agrega el primer alcance para construir la matriz.
            </div>
          )}
        </div>
      ) : activeMode === "locations" ? (
        <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
          {draft.areas.length > 0 ? (
            renderAreaTree(draft.areas)
          ) : (
            <div className="apple-section px-3 py-6 text-sm text-[var(--color-text-muted)]">
              Sin ubicaciones. Agrega la primera ubicacion para construir la matriz.
            </div>
          )}
        </div>
      ) : (
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] overflow-hidden">
        <div className="min-h-0 overflow-auto">
          <table className="apple-table min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">
                  Disciplina
                </th>
                {areas.map((area) => (
                  <th
                    key={area.id}
                    className="text-left px-3 py-2 font-semibold"
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
                    colSpan={Math.max(1, areas.length + 1)}
                    className="bg-[var(--color-bg-elevated)] px-3 py-6 text-sm text-[var(--color-text-muted)]"
                  >
                    Sin disciplinas. Agrega la primera disciplina para construir la matriz.
                  </td>
                </tr>
              )}
              {scopes.map((scope) => (
                <tr key={scope.id} className="border-b border-[var(--color-hairline)]">
                  <th className="sticky left-0 bg-[var(--color-bg-elevated)] text-left px-3 py-2 font-semibold text-[var(--color-text-strong)]">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCell({
                          scopeId: scope.id,
                          areaId: areas[0]?.id ?? "",
                        })
                      }
                      className="font-semibold text-left"
                    >
                      {scope.name}
                    </button>
                  </th>
                  {areas.map((area) => {
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
                      <td key={area.id} className="bg-[var(--color-bg-elevated)] px-3 py-2 align-top">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCell({ scopeId: scope.id, areaId: area.id })
                          }
                          className="w-full text-left rounded-lg border px-3 py-2 shadow-sm"
                          style={{
                            borderColor: isSelected
                              ? "var(--aia-corp-main)"
                              : "var(--color-hairline)",
                            background: cell?.active
                              ? "color-mix(in oklch, var(--aia-corp-xlight) 58%, var(--color-bg-elevated))"
                              : "var(--color-bg-surface-secondary)",
                          }}
                        >
                          <span className="block text-xs font-semibold text-[var(--color-text-strong)]">
                            {cell?.active ? recipe?.name ?? "Sin receta" : "Inactiva"}
                          </span>
                          <span className="block text-xs text-[var(--color-text-muted)]">
                            {overrides.length} actividades · {totalDuration} días
                          </span>
                          <span className="block text-xs text-[var(--color-text-muted)] truncate">
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
          className="apple-section min-h-0 overflow-auto border-l border-[var(--color-hairline)] p-4"
        >
          {selectedCell && selectedScope && selectedArea && selectedMatrixCell ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                  Celda seleccionada
                </p>
                <h3 className="text-lg font-bold text-[var(--color-text-strong)]">
                  {selectedScope.name} × {selectedArea.name}
                </h3>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {formatQuantitySummary(selectedOverrides)}
                </p>
              </div>

              <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-strong)]">
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

              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-strong)]">
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
                  className={`${matrixInputClass} py-1.5 font-normal`}
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
                      className="apple-section p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-[var(--color-text-strong)]">
                          {activity.name}
                        </h4>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {formatNumber(durationDays(override))} días
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
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
                            className={matrixInputClass}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
                          Unidad
                          <input
                            aria-label={`Unidad ${activity.name}`}
                            value={override.unit ?? ""}
                            onChange={(event) =>
                              updateActivityOverride(activity, {
                                unit: event.target.value,
                              })
                            }
                            className={matrixInputClass}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--color-text-muted)]">
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
                            className={matrixInputClass}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedRecipe && selectedRecipe.dependencies.length > 0 && (
                <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-surface-secondary)] p-3 text-xs text-[var(--color-text-strong)]">
                  {selectedRecipe.dependencies.length} dependencias internas configuradas.
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-[var(--color-text-muted)]">
              Selecciona una celda para editar receta, cantidades y rendimientos.
            </div>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}
