"use client";

import { useState, useCallback, useMemo } from "react";
import type { Resource, ResourceType } from "@/types/resource";
import ResourceRow from "@/components/resources/ResourceRow";
import { Plus, Trash2 } from "lucide-react";

interface ResourceSheetViewProps {
  resources: Resource[];
  onAddResource?: (resource: Resource) => void;
  onEditResource?: (resource: Resource) => void;
  onDeleteResource?: (uid: number) => void;
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
  color: "#ffffff",
  textAlign: "left",
  whiteSpace: "nowrap",
  letterSpacing: "0.03em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  background: "var(--aia-alabaster)",
  color: "var(--gray-900)",
  border: "1px solid var(--aia-corp-mid)",
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
}: ResourceSheetViewProps) {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUid, setEditingUid] = useState<number | null>(null);
  const [addForm, setAddForm] = useState<InlineFormData>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<InlineFormData>(EMPTY_FORM);

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

  return (
    <div data-testid="resource-sheet-view" className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div
        style={{
          background: "var(--aia-corp-dark)",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          borderBottom: "1px solid var(--aia-corp-mid)",
        }}
      >
        {/* Type filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          style={{
            background: "var(--aia-alabaster)",
            color: "var(--aia-corp-dark)",
            border: "1px solid var(--aia-corp-mid)",
            borderRadius: "var(--radius-sm)",
            padding: "4px 8px",
            fontSize: "0.8125rem",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            outline: "none",
            cursor: "pointer",
          }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Separator */}
        <div
          style={{
            width: "1px",
            height: "20px",
            background: "var(--aia-corp-mid)",
            opacity: 0.5,
          }}
        />

        {/* Delete button */}
        {selectedUid != null && onDeleteResource && (
          <button
            onClick={handleDelete}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              background: "var(--aia-alert-main)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.75rem",
              fontFamily: "var(--font-montserrat)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Trash2 size={12} />
            Eliminar
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Count */}
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--aia-corp-light)",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
          }}
        >
          {filteredResources.length} / {resources.length} recursos
        </span>

        {/* Add button */}
        {onAddResource && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 12px",
              background: "var(--aia-corp-main)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.75rem",
              fontFamily: "var(--font-montserrat)",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--aia-corp-dark)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--aia-corp-main)";
            }}
          >
            <Plus size={14} />
            Agregar Recurso
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--aia-corp-dark)",
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              <th style={{ ...thStyle, width: 50 }}>ID</th>
              <th style={{ ...thStyle }}>Nombre</th>
              <th style={{ ...thStyle, width: 100 }}>Tipo</th>
              <th style={{ ...thStyle, width: 80, textAlign: "right" }}>Tarifa</th>
              <th style={{ ...thStyle, width: 80, textAlign: "right" }}>Dispon.</th>
              <th style={{ ...thStyle, width: 100 }}>Grupo</th>
              <th style={{ ...thStyle, width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {/* ── Inline Add Form ── */}
            {showAddForm && (
              <tr
                data-testid="add-resource-row"
                style={{
                  background: "var(--aia-corp-xlight)",
                  borderBottom: "2px solid var(--aia-corp-main)",
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
                  Nuevo
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
                        {opt.label}
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
                <td style={{ padding: "6px 4px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={handleAdd}
                      disabled={!addForm.name.trim()}
                      style={{
                        padding: "2px 8px",
                        background: addForm.name.trim() ? "var(--aia-corp-main)" : "var(--gray-300)",
                        color: "#ffffff",
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
                        background: "transparent",
                        color: "var(--gray-500)",
                        border: "1px solid var(--gray-300)",
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
                    background: "var(--aia-corp-xlight)",
                    borderBottom: "2px solid var(--aia-corp-main)",
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
                          {opt.label}
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
                  <td style={{ padding: "6px 4px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editForm.name.trim()}
                        style={{
                          padding: "2px 8px",
                          background: editForm.name.trim() ? "var(--aia-corp-main)" : "var(--gray-300)",
                          color: "#ffffff",
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
                          background: "transparent",
                          color: "var(--gray-500)",
                          border: "1px solid var(--gray-300)",
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
                />
              ),
            )}

            {/* ── Empty State ── */}
            {filteredResources.length === 0 && !showAddForm && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: "48px 16px",
                    textAlign: "center",
                    color: "var(--gray-500)",
                    fontFamily: "var(--font-inter), system-ui, sans-serif",
                    fontSize: "0.9375rem",
                  }}
                >
                  No hay recursos. Click &quot;Agregar Recurso&quot; para crear uno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
