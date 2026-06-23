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
} from "lucide-react";

export type ViewType =
  | "gantt"
  | "tracking"
  | "taskSheet"
  | "network"
  | "resources"
  | "lob"
  | "scurve"
  | "settings";

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
  { id: "scurve", label: "Curva S", icon: LineChart },
  { id: "settings", label: "Configuración", icon: Settings },
];

interface ViewSwitcherProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export default function ViewSwitcher({
  activeView,
  onViewChange,
}: ViewSwitcherProps) {
  return (
    <div
      data-testid="view-switcher"
      className="flex items-stretch"
      role="tablist"
      aria-label="Vistas del proyecto"
    >
      {VIEW_TABS.map((tab) => {
        const isActive = activeView === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            data-testid={`view-tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            onClick={() => onViewChange(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2 transition-colors shrink-0"
            style={{
              fontFamily: "var(--font-montserrat)",
              fontSize: "13px",
              fontWeight: 600,
              background: isActive
                ? "var(--aia-corp-main)"
                : "transparent",
              color: isActive
                ? "#ffffff"
                : "var(--aia-corp-mid)",
              borderBottom: isActive
                ? "3px solid var(--aia-corp-dark)"
                : "3px solid transparent",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background =
                  "var(--aia-corp-xlight)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <Icon size={14} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
