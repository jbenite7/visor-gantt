"use client";

import type { Resource } from "@/types/resource";
import { Pencil } from "lucide-react";

interface ResourceRowProps {
  resource: Resource;
  index: number;
  isSelected: boolean;
  onClick?: () => void;
  onEdit?: (resource: Resource) => void;
}

const TYPE_BADGE: Record<Resource["type"], { bg: string; label: string }> = {
  work: { bg: "var(--aia-proj-main)", label: "Trabajo" },
  material: { bg: "var(--aia-const-main)", label: "Material" },
  cost: { bg: "var(--aia-arch-main)", label: "Costo" },
};

export default function ResourceRow({
  resource,
  index,
  isSelected,
  onClick,
  onEdit,
}: ResourceRowProps) {
  const stripeBg = index % 2 === 0 ? "var(--aia-alabaster)" : "var(--aia-linen)";
  const badge = TYPE_BADGE[resource.type];

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
          {badge.label}
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
