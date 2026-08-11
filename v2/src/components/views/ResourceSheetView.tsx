"use client";

import { useState, useCallback, useMemo } from "react";
import type { Resource, ResourceType } from "@/types/resource";
import ResourceRow from "@/components/resources/ResourceRow";
import { Plus, Trash2 } from "lucide-react";
import ColumnSelector, { type ColumnConfig } from "@/components/gantt/table/ColumnSelector";
import type { MppCustomFieldDefinition, MppResourceColumn, ResourceColumnSettings } from "@/types/mppColumns";
import type { UILocale } from "@/types/ui";
import { inspectMppField } from "@/lib/mpp/fieldInspector";
import {
  DEFAULT_RESOURCE_COLUMN_SETTINGS,
  normalizeResourceColumnSettings,
} from "@/lib/mpp/taskColumns";

interface ResourceSheetViewProps {
  resources: Resource[];
  onAddResource?: (resource: Resource) => void;
  onEditResource?: (resource: Resource) => void;
  onDeleteResource?: (uid: number) => void;
  mppResourceColumns?: MppResourceColumn[];
  customFieldDefinitions?: MppCustomFieldDefinition[];
  columnSettings?: ResourceColumnSettings;
  locale?: UILocale;
  onColumnSettingsChange?: (settings: ResourceColumnSettings) => void;
  /** Restablecer columnas borra la configuración del usuario: el padre puede hacerlo deshacible. */
  onResetColumns?: () => void;
  onLocaleChange?: (locale: UILocale) => void;
}

type FilterType = "all" | ResourceType;

interface InlineFormData {
  name: string;
  type: ResourceType;
  rate: string;
  availability: string;
  group: string;
}

const EMPTY_FORM: InlineFormData = {
  name: "",
  type: "work",
  rate: "",
  availability: "100",
  group: "",
};

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "work", label: "Trabajo" },
  { value: "material", label: "Material" },
  { value: "cost", label: "Costo" },
];

const TYPE_OPTIONS: { value: ResourceType; label: string }[] = [
  { value: "work", label: "Trabajo" },
  { value: "material", label: "Material" },
  { value: "cost", label: "Costo" },
];

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

const inputStyle: React.CSSProperties = {
  background: "var(--color-bg-elevated)",
  color: "var(--color-text-strong)",
  border: "1px solid var(--color-hairline)",
  borderRadius: "var(--radius-sm)",
  padding: "4px 8px",
  fontSize: "0.8125rem",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function ResourceSheetView({
  resources,
  onAddResource,
  onEditResource,
  onDeleteResource,
  mppResourceColumns = [],
  customFieldDefinitions = [],
  columnSettings,
  locale = "es",
  onColumnSettingsChange,
  onResetColumns,
  onLocaleChange,
}: ResourceSheetViewProps) {
  const labels =
    locale === "en"
      ? {
          all: "All",
          work: "Work",
          material: "Material",
          cost: "Cost",
          delete: "Delete",
          resources: "resources",
          addResource: "Add Resource",
          id: "ID",
          name: "Name",
          type: "Type",
          rate: "Rate",
          availability: "Avail.",
          group: "Group",
          new: "New",
          empty: "No resources. Click \"Add Resource\" to create one.",
        }
      : {
          all: "Todos",
          work: "Trabajo",
          material: "Material",
          cost: "Costo",
          delete: "Eliminar",
          resources: "recursos",
          addResource: "Agregar Recurso",
          id: "ID",
          name: "Nombre",
          type: "Tipo",
          rate: "Tarifa",
          availability: "Dispon.",
          group: "Grupo",
          new: "Nuevo",
          empty: "No hay recursos. Pulsa «Agregar Recurso» para crear el primero.",
        };
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUid, setEditingUid] = useState<number | null>(null);
  const [addForm, setAddForm] = useState<InlineFormData>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<InlineFormData>(EMPTY_FORM);
  const [localColumnSettings, setLocalColumnSettings] = useState<ResourceColumnSettings>(
    normalizeResourceColumnSettings(columnSettings, locale),
  );
  const effectiveColumnSettings = columnSettings
    ? normalizeResourceColumnSettings(columnSettings, locale)
    : localColumnSettings;
  const updateColumnSettings = onColumnSettingsChange ?? setLocalColumnSettings;
  const extraColumns = useMemo<ColumnConfig[]>(
    () =>
      mppResourceColumns.map((column) => ({
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
    [mppResourceColumns, locale],
  );
  const fieldInspections = useMemo(() => {
    const inspections: Record<string, ReturnType<typeof inspectMppField>> = {};
    for (const column of mppResourceColumns) {
      let inspectionForColumn: ReturnType<typeof inspectMppField> | undefined;
      for (const resource of resources) {
        const inspection = inspectMppField({
          record: resource,
          column,
          customFieldDefinitions,
          locale,
        });
        if (inspection.value !== undefined && inspection.value !== null && inspection.value !== "") {
          inspectionForColumn = inspection;
          break;
        }
      }
      if (!inspectionForColumn && resources[0]) {
        inspectionForColumn = inspectMppField({
          record: resources[0],
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
  }, [customFieldDefinitions, locale, mppResourceColumns, resources]);
  const visibleExtraColumns = useMemo(
    () => extraColumns.filter((column) => effectiveColumnSettings.visible.includes(column.key)),
    [extraColumns, effectiveColumnSettings.visible],
  );

  const filteredResources = useMemo(() => {
    if (filterType === "all") return resources;
    return resources.filter((r) => r.type === filterType);
  }, [resources, filterType]);

  const handleRowClick = useCallback((uid: number) => {
    setSelectedUid((prev) => (prev === uid ? null : uid));
  }, []);

  const handleStartEdit = useCallback(
    (resource: Resource) => {
      setEditingUid(resource.uid);
      setEditForm({
        name: resource.name,
        type: resource.type,
        rate: resource.rate?.toString() ?? "",
        availability: resource.availability?.toString() ?? "100",
        group: resource.group ?? "",
      });
    },
    [],
  );

  const handleSaveEdit = useCallback(() => {
    if (editingUid == null) return;
    const resource = resources.find((r) => r.uid === editingUid);
    if (!resource) return;
    onEditResource?.({
      ...resource,
      name: editForm.name,
      type: editForm.type,
      rate: editForm.rate ? parseFloat(editForm.rate) : undefined,
      availability: editForm.availability ? parseInt(editForm.availability, 10) : undefined,
      group: editForm.group || undefined,
    });
    setEditingUid(null);
  }, [editingUid, editForm, resources, onEditResource]);

  const handleCancelEdit = useCallback(() => {
    setEditingUid(null);
  }, []);

  const handleAdd = useCallback(() => {
    const maxUid = resources.reduce((max, r) => Math.max(max, r.uid), 0);
    onAddResource?.({
      uid: maxUid + 1,
      name: addForm.name,
      type: addForm.type,
      rate: addForm.rate ? parseFloat(addForm.rate) : undefined,
      availability: addForm.availability ? parseInt(addForm.availability, 10) : undefined,
      group: addForm.group || undefined,
    });
    setAddForm(EMPTY_FORM);
    setShowAddForm(false);
  }, [addForm, resources, onAddResource]);

  const handleCancelAdd = useCallback(() => {
    setAddForm(EMPTY_FORM);
    setShowAddForm(false);
  }, []);

  const handleDelete = useCallback(() => {
    if (selectedUid != null) {
      onDeleteResource?.(selectedUid);
      setSelectedUid(null);
    }
  }, [selectedUid, onDeleteResource]);

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
      ...DEFAULT_RESOURCE_COLUMN_SETTINGS,
      visible: [
        ...DEFAULT_RESOURCE_COLUMN_SETTINGS.visible,
        ...extraColumns.filter((column) => column.defaultVisible).map((column) => column.key),
      ],
      labelLocale: locale,
    });
  }, [extraColumns, locale, updateColumnSettings, onResetColumns]);

  return (
    <div data-testid="resource-sheet-view" className="apple-module flex h-full flex-col">
      {/* ── Toolbar ── */}
      <div className="apple-subtoolbar">
        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          style={{
            background: "var(--color-bg-elevated)",
            color: "var(--color-text-strong)",
            border: "1px solid var(--color-hairline)",
            borderRadius: "var(--radius-lg)",
            padding: "6px 10px",
            fontSize: "0.8125rem",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            outline: "none",
            cursor: "pointer",
          }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {labels[opt.value]}
            </option>
          ))}
        </select>

        {/* Delete button */}
        {selectedUid != null && onDeleteResource && (
          <button
            onClick={handleDelete}
            className="apple-icon-button apple-icon-button-danger"
            title={labels.delete}
          >
            <Trash2 size={12} />
            {labels.delete}
          </button>
        )}

        {/* Spacer */}
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

        {/* Count */}
        <span
          className="apple-subtoolbar-count"
        >
          {filteredResources.length} / {resources.length} {labels.resources}
        </span>

        {/* Add button */}
        {onAddResource && (
          <button
            onClick={() => setShowAddForm(true)}
            className="apple-icon-button"
          >
            <Plus size={14} />
            {labels.addResource}
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table
          className="apple-table"
          style={{
            width: "100%",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr
              className="apple-grid-header"
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              <th style={{ ...thStyle, width: 50 }}>{labels.id}</th>
              <th style={{ ...thStyle }}>{labels.name}</th>
              <th style={{ ...thStyle, width: 100 }}>{labels.type}</th>
              <th style={{ ...thStyle, width: 80, textAlign: "right" }}>{labels.rate}</th>
              <th style={{ ...thStyle, width: 80, textAlign: "right" }}>{labels.availability}</th>
              <th style={{ ...thStyle, width: 100 }}>{labels.group}</th>
              {visibleExtraColumns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    ...thStyle,
                    width: column.width,
                    textAlign: column.align,
                  }}
                >
                  {locale === "en" ? column.labelEn ?? column.label : column.labelEs ?? column.label}
                </th>
              ))}
              <th style={{ ...thStyle, width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {/* ── Inline Add Form ── */}
            {showAddForm && (
              <tr
                data-testid="add-resource-row"
                style={{
                  background: "color-mix(in oklch, var(--aia-corp-xlight) 54%, var(--color-bg-elevated))",
                  borderBottom: "1px solid var(--color-hairline)",
                }}
              >
                <td
                  style={{
                    padding: "6px 10px",
                    fontSize: "0.75rem",
                    color: "var(--gray-500)",
                    textAlign: "center",
                  }}
                >
                  {labels.new}
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <input
                    type="text"
                    placeholder="Nombre"
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    style={inputStyle}
                    autoFocus
                  />
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <select
                    value={addForm.type}
                    onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value as ResourceType }))}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {labels[opt.value]}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <input
                    type="number"
                    placeholder="$"
                    step="0.01"
                    min="0"
                    value={addForm.rate}
                    onChange={(e) => setAddForm((f) => ({ ...f, rate: e.target.value }))}
                    style={inputStyle}
                  />
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <input
                    type="number"
                    placeholder="%"
                    min="0"
                    max="100"
                    value={addForm.availability}
                    onChange={(e) => setAddForm((f) => ({ ...f, availability: e.target.value }))}
                    style={inputStyle}
                  />
                </td>
                <td style={{ padding: "6px 10px" }}>
                  <input
                    type="text"
                    placeholder="Grupo"
                    value={addForm.group}
                    onChange={(e) => setAddForm((f) => ({ ...f, group: e.target.value }))}
                    style={inputStyle}
                  />
                </td>
                {visibleExtraColumns.map((column) => (
                  <td key={column.key} style={{ padding: "6px 10px", color: "var(--gray-400)" }}>
                    -
                  </td>
                ))}
                <td style={{ padding: "6px 4px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={handleAdd}
                      disabled={!addForm.name.trim()}
                      style={{
                        padding: "2px 8px",
                        background: addForm.name.trim() ? "var(--aia-corp-main)" : "var(--gray-300)",
                        color: "var(--color-text-on-primary)",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.6875rem",
                        fontFamily: "var(--font-montserrat)",
                        fontWeight: 600,
                        cursor: addForm.name.trim() ? "pointer" : "not-allowed",
                      }}
                    >
                      OK
                    </button>
                    <button
                      onClick={handleCancelAdd}
                      style={{
                        padding: "2px 8px",
                        background: "var(--color-bg-elevated)",
                        color: "var(--color-text-muted)",
                        border: "1px solid var(--color-hairline)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.6875rem",
                        fontFamily: "var(--font-montserrat)",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      X
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* ── Resource Rows ── */}
            {filteredResources.map((resource, index) =>
              editingUid === resource.uid ? (
                <tr
                  key={resource.uid}
                  data-testid="edit-resource-row"
                  style={{
                    background: "color-mix(in oklch, var(--aia-corp-xlight) 54%, var(--color-bg-elevated))",
                    borderBottom: "1px solid var(--color-hairline)",
                  }}
                >
                  <td
                    style={{
                      padding: "6px 10px",
                      fontSize: "0.8125rem",
                      color: "var(--gray-700)",
                      textAlign: "center",
                    }}
                  >
                    {resource.uid}
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      style={inputStyle}
                      autoFocus
                    />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as ResourceType }))}
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {labels[opt.value]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.rate}
                      onChange={(e) => setEditForm((f) => ({ ...f, rate: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.availability}
                      onChange={(e) => setEditForm((f) => ({ ...f, availability: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: "6px 10px" }}>
                    <input
                      type="text"
                      value={editForm.group}
                      onChange={(e) => setEditForm((f) => ({ ...f, group: e.target.value }))}
                      style={inputStyle}
                    />
                  </td>
                  {visibleExtraColumns.map((column) => (
                    <td key={column.key} style={{ padding: "6px 10px", color: "var(--gray-400)" }}>
                      -
                    </td>
                  ))}
                  <td style={{ padding: "6px 4px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editForm.name.trim()}
                        style={{
                          padding: "2px 8px",
                          background: editForm.name.trim() ? "var(--aia-corp-main)" : "var(--gray-300)",
                          color: "var(--color-text-on-primary)",
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.6875rem",
                          fontFamily: "var(--font-montserrat)",
                          fontWeight: 600,
                          cursor: editForm.name.trim() ? "pointer" : "not-allowed",
                        }}
                      >
                        OK
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        style={{
                          padding: "2px 8px",
                          background: "var(--color-bg-elevated)",
                          color: "var(--color-text-muted)",
                          border: "1px solid var(--color-hairline)",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "0.6875rem",
                          fontFamily: "var(--font-montserrat)",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        X
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <ResourceRow
                  key={resource.uid}
                  resource={resource}
                  index={index}
                  isSelected={selectedUid === resource.uid}
                  onClick={() => handleRowClick(resource.uid)}
                  onEdit={onEditResource ? handleStartEdit : undefined}
                  extraColumns={visibleExtraColumns}
                  locale={locale}
                />
              ),
            )}

            {/* ── Empty State ── */}
            {filteredResources.length === 0 && !showAddForm && (
              <tr>
                <td
                  colSpan={7 + visibleExtraColumns.length}
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
