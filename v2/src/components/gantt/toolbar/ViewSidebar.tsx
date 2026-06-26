"use client";

import {
  BarChart3,
  GitCompare,
  Table,
  Network,
  Users,
  TrendingUp,
  LineChart,
  Settings,
  AlertTriangle,
  Grid3X3,
} from "lucide-react";
import type { ViewType } from "./ViewSwitcher";

interface ViewTab {
  id: ViewType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const VIEW_TABS: ViewTab[] = [
  { id: "gantt", label: "Gantt", icon: BarChart3 },
  { id: "tracking", label: "Seguimiento", icon: GitCompare },
  { id: "taskSheet", label: "Hoja Tareas", icon: Table },
  { id: "network", label: "Diagrama Red", icon: Network },
  { id: "resources", label: "Recursos", icon: Users },
  { id: "lob", label: "Línea Balance", icon: TrendingUp },
  { id: "matrix", label: "Matriz", icon: Grid3X3 },
  { id: "scurve", label: "Curva S", icon: LineChart },
  { id: "bottlenecks", label: "Cuellos", icon: AlertTriangle },
  { id: "settings", label: "Configuración", icon: Settings },
];

interface ViewSidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function ViewSidebar({ activeView, onViewChange }: ViewSidebarProps) {
  return (
    <nav
      data-testid="view-sidebar"
      className="flex flex-col shrink-0"
      role="navigation"
      aria-label="Vistas del proyecto"
      style={{
        width: 52,
        background: "var(--aia-corp-dark)",
        borderRight: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {VIEW_TABS.map((tab) => {
        const isActive = activeView === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            data-testid={`sidebar-view-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            onClick={() => onViewChange(tab.id)}
            title={tab.label}
            className="flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{
              padding: "10px 4px",
              background: isActive ? "var(--aia-corp-main)" : "transparent",
              color: isActive ? "#ffffff" : "var(--aia-corp-mid)",
              border: "none",
              borderLeft: isActive ? "3px solid var(--aia-alert-main)" : "3px solid transparent",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <Icon size={18} />
            <span
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: "9px",
                fontWeight: 500,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
