"use client";

import GanttView from "@/components/views/GanttView";
import { GanttTask } from "@/components/gantt/types";
import { createProjectDate } from "@/lib/date/projectDate";

const sampleTasks: GanttTask[] = [
  {
    id: 1,
    name: "Planificación del Proyecto",
    start: createProjectDate("2024-01-01"),
    finish: createProjectDate("2024-01-05"),
    duration: 5,
    progress: 100,
    isCritical: false,
    isMilestone: false,
    isSummary: true,
    outlineLevel: 1,
    dependencies: [],
  },
  {
    id: 2,
    name: "Reunión de inicio",
    start: createProjectDate("2024-01-01"),
    finish: createProjectDate("2024-01-01"),
    duration: 0,
    progress: 100,
    isCritical: true,
    isMilestone: true,
    isSummary: false,
    outlineLevel: 2,
    dependencies: [],
  },
  {
    id: 3,
    name: "Definición de Alcance",
    start: createProjectDate("2024-01-02"),
    finish: createProjectDate("2024-01-05"),
    duration: 3,
    progress: 100,
    isCritical: true,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 2,
    dependencies: [{ from: 2, to: 3, type: "FS" }],
  },
  {
    id: 4,
    name: "Desarrollo",
    start: createProjectDate("2024-01-06"),
    finish: createProjectDate("2024-01-20"),
    duration: 14,
    progress: 60,
    isCritical: false,
    isMilestone: false,
    isSummary: true,
    outlineLevel: 1,
    dependencies: [],
  },
  {
    id: 5,
    name: "API backend",
    start: createProjectDate("2024-01-06"),
    finish: createProjectDate("2024-01-15"),
    duration: 9,
    progress: 80,
    isCritical: true,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 2,
    dependencies: [{ from: 3, to: 5, type: "FS" }],
  },
  {
    id: 6,
    name: "Interfaz frontend",
    start: createProjectDate("2024-01-10"),
    finish: createProjectDate("2024-01-20"),
    duration: 10,
    progress: 40,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 2,
    dependencies: [{ from: 5, to: 6, type: "SS", lag: 4 }],
  },
  {
    id: 7,
    name: "Pruebas y lanzamiento",
    start: createProjectDate("2024-01-21"),
    finish: createProjectDate("2024-01-25"),
    duration: 5,
    progress: 0,
    isCritical: true,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [{ from: 6, to: 7, type: "FS" }],
  },
  {
    id: 8,
    name: "Puesta en marcha",
    start: createProjectDate("2024-01-25"),
    finish: createProjectDate("2024-01-25"),
    duration: 0,
    progress: 0,
    isCritical: true,
    isMilestone: true,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [{ from: 7, to: 8, type: "FS" }],
  },
];

export default function GanttDemoPage() {
  return (
    <div className="apple-page h-screen flex flex-col">
      <header className="apple-page-header shrink-0 px-6 py-4">
        <h1 className="text-2xl font-semibold text-[var(--color-text-strong)] font-[var(--font-heading)]">
          Demo de Gantt
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          8 tareas de ejemplo con dependencias FS, SS+lag, hitos y resúmenes
        </p>
      </header>
      <div className="flex-1 min-h-0">
        <GanttView
          tasks={sampleTasks}
          onTaskClick={(task) => console.log("Clic:", task.name)}
        />
      </div>
    </div>
  );
}
