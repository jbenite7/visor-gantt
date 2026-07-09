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
  LayoutDashboard,
} from "lucide-react";
import type { ViewType } from "./ViewSwitcher";
import type { UILocale } from "@/types/ui";

interface ViewTab {
  id: ViewType;
  labelEs: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const VIEW_TABS: ViewTab[] = [
  { id: "gantt", labelEs: "Gantt", labelEn: "Gantt", icon: BarChart3 },
  { id: "executive", labelEs: "Ejecutivo", labelEn: "Executive", icon: LayoutDashboard },
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

interface ViewSidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  locale?: UILocale;
}

export default function ViewSidebar({ activeView, onViewChange, locale = "es" }: ViewSidebarProps) {
  return (
    <nav
      data-testid="view-sidebar"
      className="project-view-sidebar"
      role="navigation"
      aria-label="Vistas del proyecto"
    >
      {VIEW_TABS.map((tab) => {
        const isActive = activeView === tab.id;
        const Icon = tab.icon;
        const label = locale === "en" ? tab.labelEn : tab.labelEs;

        return (
          <button
            key={tab.id}
            data-testid={`sidebar-view-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            onClick={() => onViewChange(tab.id)}
            title={label}
            className="project-view-sidebar__item"
            type="button"
          >
            <Icon className="project-view-sidebar__icon" aria-hidden />
            <span className="project-view-sidebar__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
