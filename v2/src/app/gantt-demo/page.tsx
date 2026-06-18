"use client";

import GanttChart from "@/components/gantt/GanttChart";
import { GanttTask } from "@/components/gantt/types";

export default function GanttDemoPage() {
  // Sample data for testing
  const sampleTasks: GanttTask[] = [
    {
      id: 1,
      name: "Planificación del Proyecto",
      start: new Date("2024-01-01"),
      finish: new Date("2024-01-05"),
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
      name: "Kickoff Meeting",
      start: new Date("2024-01-01"),
      finish: new Date("2024-01-01"),
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
      start: new Date("2024-01-02"),
      finish: new Date("2024-01-05"),
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
      start: new Date("2024-01-06"),
      finish: new Date("2024-01-20"),
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
      name: "Backend API",
      start: new Date("2024-01-06"),
      finish: new Date("2024-01-15"),
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
      name: "Frontend UI",
      start: new Date("2024-01-10"),
      finish: new Date("2024-01-20"),
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
      name: "Testing & Launch",
      start: new Date("2024-01-21"),
      finish: new Date("2024-01-25"),
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
      name: "Go Live",
      start: new Date("2024-01-25"),
      finish: new Date("2024-01-25"),
      duration: 0,
      progress: 0,
      isCritical: true,
      isMilestone: true,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [{ from: 7, to: 8, type: "FS" }],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
            Gantt Chart Demo
          </h1>
          <p className="text-slate-400">
            Visualización de cronograma con tareas críticas, resúmenes y
            milestones
          </p>
        </div>

        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
          <h2 className="text-lg font-medium mb-3">Leyenda</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded"></div>
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Crítica</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-500 rounded"></div>
              <span>Resumen</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rotate-45"></div>
              <span>Milestone</span>
            </div>
          </div>
        </div>

        <GanttChart
          tasks={sampleTasks}
          onTaskClick={(task) => {
            console.log("Clicked:", task.name);
          }}
        />
      </div>
    </div>
  );
}
