"use client";

import {
  BarChart3,
  Users,
  TrendingUp,
  LineChart,
  Settings,
  AlertTriangle,
  CalendarDays,
  LayoutDashboard,
  Layers3,
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
  { id: "resources", labelEs: "Recursos", labelEn: "Resources", icon: Users },
  { id: "lob", labelEs: "Línea Balance", labelEn: "Line Balance", icon: TrendingUp },
  { id: "scurve", labelEs: "Curva S", labelEn: "S Curve", icon: LineChart },
  { id: "bottlenecks", labelEs: "Problemas", labelEn: "Problems", icon: AlertTriangle },
  { id: "unidadTipica", labelEs: "Unidad Típica", labelEn: "Typical Unit", icon: Layers3 },
  { id: "calendario", labelEs: "Calendario", labelEn: "Calendar", icon: CalendarDays },
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
