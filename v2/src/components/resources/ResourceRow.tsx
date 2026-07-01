"use client";

import type { Resource } from "@/types/resource";
import { Pencil } from "lucide-react";
import type { ColumnConfig } from "@/components/gantt/table/ColumnSelector";
import type { UILocale } from "@/types/ui";
import { formatMppValue, getMppRecordValue } from "@/lib/mpp/recordValues";

interface ResourceRowProps {
  resource: Resource;
  index: number;
  isSelected: boolean;
  onClick?: () => void;
  onEdit?: (resource: Resource) => void;
  extraColumns?: ColumnConfig[];
  locale?: UILocale;
}

const TYPE_BADGE: Record<Resource["type"], { bg: string; labelEs: string; labelEn: string }> = {
  work: { bg: "var(--aia-proj-main)", labelEs: "Trabajo", labelEn: "Work" },
  material: { bg: "var(--aia-const-main)", labelEs: "Material", labelEn: "Material" },
  cost: { bg: "var(--aia-arch-main)", labelEs: "Costo", labelEn: "Cost" },
};

export default function ResourceRow({
  resource,
  index,
  isSelected,
  onClick,
  onEdit,
  extraColumns = [],
  locale = "es",
}: ResourceRowProps) {
  const stripeBg = index % 2 === 0 ? "var(--aia-alabaster)" : "var(--aia-linen)";
  const badge = TYPE_BADGE[resource.type];
  const typeLabel = locale === "en" ? badge.labelEn : badge.labelEs;

  return (
    <tr
      data-testid="resource-row"
      data-resource-id={resource.uid}
      onClick={onClick}
      onDoubleClick={() => onEdit?.(resource)}
      style={{
        background: isSelected ? "var(--aia-proj-xlight)" : stripeBg,
        borderLeft: isSelected ? "3px solid var(--aia-proj-main)" : "3px solid transparent",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
    >
      <td
        style={{
          padding: "6px 10px",
          fontSize: "0.8125rem",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          color: "var(--gray-700)",
          width: 50,
          textAlign: "center",
        }}
      >
        {resource.uid}
      </td>
      <td
        style={{
          padding: "6px 10px",
          fontSize: "0.8125rem",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          color: "var(--gray-900)",
          fontWeight: 500,
        }}
      >
        {resource.name}
      </td>
      <td
        style={{
          padding: "6px 10px",
          width: 100,
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.6875rem",
            fontWeight: 600,
            fontFamily: "var(--font-montserrat)",
            background: badge.bg,
            color: "#ffffff",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          {typeLabel}
        </span>
      </td>
      <td
        style={{
          padding: "6px 10px",
          fontSize: "0.8125rem",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          color: "var(--gray-700)",
          width: 80,
          textAlign: "right",
        }}
      >
        {resource.rate != null ? `$${resource.rate.toFixed(2)}` : "\u2014"}
      </td>
      <td
        style={{
          padding: "6px 10px",
          fontSize: "0.8125rem",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          color: "var(--gray-700)",
          width: 80,
          textAlign: "right",
        }}
      >
        {resource.availability != null ? `${resource.availability}%` : "\u2014"}
      </td>
      <td
        style={{
          padding: "6px 10px",
          fontSize: "0.8125rem",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          color: "var(--gray-700)",
          width: 100,
        }}
      >
        {resource.group ?? "\u2014"}
      </td>
      {extraColumns.map((column) => (
        <td
          key={column.key}
          style={{
            padding: "6px 10px",
            fontSize: "0.8125rem",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            color: "var(--gray-700)",
            width: column.width,
            textAlign: column.align,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={formatMppValue(
            getMppRecordValue(resource, column.sourceKey ?? column.key),
            column.dataType,
            locale,
          )}
        >
          {formatMppValue(
            getMppRecordValue(resource, column.sourceKey ?? column.key),
            column.dataType,
            locale,
          )}
        </td>
      ))}
      <td
        style={{
          padding: "6px 4px",
          width: 40,
          textAlign: "center",
        }}
      >
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(resource);
            }}
            title="Editar recurso"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--aia-corp-mid)",
              padding: 2,
              borderRadius: "var(--radius-sm)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--aia-corp-main)";
              e.currentTarget.style.background = "var(--aia-corp-xlight)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--aia-corp-mid)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Pencil size={13} />
          </button>
        )}
      </td>
    </tr>
  );
}
