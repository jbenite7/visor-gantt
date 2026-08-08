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
  Grid3x3,
  MessageSquare,
} from "lucide-react";
import type { ViewType } from "./viewTypes";
import type { UILocale } from "@/types/ui";

type ViewGroupId = "trabajo" | "analisis" | "ajustes";

interface ViewTab {
  id: ViewType;
  labelEs: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group: ViewGroupId;
}

/**
 * Diez entradas sin agrupar son una lista que hay que leer entera cada vez.
 * Agrupadas por intención —lo que haces hoy, lo que analizas, lo que
 * configuras— se recorren de un vistazo (E14).
 */
/**
 * Once entradas: las nueve que dejó el recorte, la Matriz que vuelve del
 * atajo y Observaciones. El menú se recortó de 14 a 9 con esfuerzo y crece
 * por acumulación de decisiones razonables sueltas: el número se cuenta
 * a conciencia cada vez que se toca esta lista.
 */
const VIEW_GROUPS: { id: ViewGroupId; labelEs: string; labelEn: string }[] = [
  { id: "trabajo", labelEs: "Trabajo", labelEn: "Work" },
  { id: "analisis", labelEs: "Análisis", labelEn: "Analysis" },
  { id: "ajustes", labelEs: "Ajustes", labelEn: "Settings" },
];

const VIEW_TABS: ViewTab[] = [
  { id: "gantt", labelEs: "Gantt", labelEn: "Gantt", icon: BarChart3, group: "trabajo" },
  // La Matriz volvió al menú: solo se llegaba por ⌘K, que es como no existir (M27).
  { id: "matrix", labelEs: "Matriz", labelEn: "Matrix", icon: Grid3x3, group: "trabajo" },
  // Observaciones lleva dentro el compromiso semanal: una restricción de Last
  // Planner es una observación con responsable y fecha, así que son pestañas
  // de la misma vista y el menú no gana una puerta más (M26).
  { id: "observaciones", labelEs: "Observaciones", labelEn: "Observations", icon: MessageSquare, group: "trabajo" },
  { id: "calendario", labelEs: "Calendario", labelEn: "Calendar", icon: CalendarDays, group: "trabajo" },
  { id: "executive", labelEs: "Ejecutivo", labelEn: "Executive", icon: LayoutDashboard, group: "analisis" },
  { id: "scurve", labelEs: "Curva S", labelEn: "S Curve", icon: LineChart, group: "analisis" },
  { id: "lob", labelEs: "Línea Balance", labelEn: "Line Balance", icon: TrendingUp, group: "analisis" },
  { id: "unidadTipica", labelEs: "Unidad Típica", labelEn: "Typical Unit", icon: Layers3, group: "analisis" },
  { id: "bottlenecks", labelEs: "Problemas", labelEn: "Problems", icon: AlertTriangle, group: "analisis" },
  { id: "resources", labelEs: "Recursos", labelEn: "Resources", icon: Users, group: "analisis" },
  { id: "settings", labelEs: "Configuración", labelEn: "Settings", icon: Settings, group: "ajustes" },
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
      role="tablist"
      aria-label="Vistas del proyecto"
    >
      {VIEW_GROUPS.map((group) => (
        <div
          key={group.id}
          data-testid={`sidebar-group-${group.id}`}
          className="project-view-sidebar__group"
        >
          <span className="project-view-sidebar__group-title">
            {locale === "en" ? group.labelEn : group.labelEs}
          </span>

          {VIEW_TABS.filter((tab) => tab.group === group.id).map((tab) => {
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
        </div>
      ))}
    </nav>
  );
}
