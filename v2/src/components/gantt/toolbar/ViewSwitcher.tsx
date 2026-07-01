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
import type { UILocale } from "@/types/ui";

export type ViewType =
  | "gantt"
  | "tracking"
  | "taskSheet"
  | "network"
  | "resources"
  | "lob"
  | "matrix"
  | "scurve"
  | "bottlenecks"
  | "settings";

interface ViewTab {
  id: ViewType;
  labelEs: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const VIEW_TABS: ViewTab[] = [
  { id: "gantt", labelEs: "Gantt", labelEn: "Gantt", icon: BarChart3 },
  { id: "tracking", labelEs: "Seguimiento", labelEn: "Tracking", icon: GitCompare },
  { id: "taskSheet", labelEs: "Hoja Tareas", labelEn: "Task Sheet", icon: Table },
  { id: "network", labelEs: "Diagrama Red", labelEn: "Network", icon: Network },
  { id: "resources", labelEs: "Recursos", labelEn: "Resources", icon: Users },
  { id: "lob", labelEs: "Línea Balance", labelEn: "Line Balance", icon: TrendingUp },
  { id: "matrix", labelEs: "Matriz", labelEn: "Matrix", icon: Grid3X3 },
  { id: "scurve", labelEs: "Curva S", labelEn: "S Curve", icon: LineChart },
  { id: "bottlenecks", labelEs: "Cuellos", labelEn: "Bottlenecks", icon: AlertTriangle },
  { id: "settings", labelEs: "Configuración", labelEn: "Settings", icon: Settings },
];

interface ViewSwitcherProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  locale?: UILocale;
}

export default function ViewSwitcher({
  activeView,
  onViewChange,
  locale = "es",
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
        const label = locale === "en" ? tab.labelEn : tab.labelEs;

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
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
