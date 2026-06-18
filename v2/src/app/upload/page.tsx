"use client";

import { useState } from "react";
import { uploadProject } from "../actions/upload";
import MPPUploader from "@/components/upload/MPPUploader";
import { mppTasksToGanttTasks } from "@/components/upload/mpp-to-gantt";
import GanttChart from "@/components/gantt/GanttChart";
import { GanttTask } from "@/components/gantt/types";
import { ProjectData } from "@/lib/parser/mpp-parser";
import ErrorDisplay from "@/components/upload/ErrorDisplay";

type ViewMode = "upload" | "loading" | "gantt" | "error";

export default function UploadPage() {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("upload");
  const [ganttTasks, setGanttTasks] = useState<GanttTask[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Legacy XML upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isXmlUploading, setIsXmlUploading] = useState(false);
  const [xmlResult, setXmlResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // --- MPP Upload Handlers ---

  const handleMPPUploadComplete = (data: ProjectData) => {
    const tasks = mppTasksToGanttTasks(data.tasks);
    setGanttTasks(tasks);
    setProjectName(data.name || "Proyecto Importado");
    setViewMode("gantt");
  };

  const handleMPPError = (error: string) => {
    setErrorMessage(error);
    setViewMode("error");
  };

  const handleBackToUpload = () => {
    setViewMode("upload");
    setGanttTasks([]);
    setErrorMessage("");
    setXmlResult(null);
  };

  // --- Legacy XML Upload Handlers ---

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processXmlFile(files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processXmlFile(files[0]);
    }
  };

  const processXmlFile = async (file: File) => {
    setIsXmlUploading(true);
    setXmlResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await uploadProject(formData);
      setXmlResult(res);
    } catch (error) {
      setXmlResult({
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setIsXmlUploading(false);
    }
  };

  // --- Render ---

  // Gantt view after successful parse
  if (viewMode === "gantt") {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
                {projectName}
              </h1>
              <p className="text-slate-400">
                {ganttTasks.length} tareas cargadas
              </p>
            </div>
            <button
              onClick={handleBackToUpload}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              ← Volver al upload
            </button>
          </div>

          <GanttChart
            tasks={ganttTasks}
            onTaskClick={(task) => {
              // Task click handler - can be extended for task details view
              void task;
            }}
          />
        </div>
      </div>
    );
  }

  // Error view
  if (viewMode === "error") {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
              Importar Proyecto
            </h1>
          </div>

          <ErrorDisplay error={errorMessage} onDismiss={handleBackToUpload} />

          <button
            onClick={handleBackToUpload}
            className="w-full py-3 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  // Loading view (during MPP parse)
  if (viewMode === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
              Importar Proyecto
            </h1>
          </div>

          <div className="border border-slate-700 rounded-xl p-12 text-center bg-slate-900">
            <div className="mx-auto w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-blue-400 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <p className="text-lg text-blue-400 animate-pulse">
              Parseando archivo...
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Esto puede tomar unos segundos
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Upload view (default)
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 text-transparent bg-clip-text">
            Importar Proyecto
          </h1>
          <p className="text-slate-400">
            Arrastra un archivo MS Project (.mpp) o haz clic para seleccionar
          </p>
        </div>

        {/* MPP Upload Zone */}
        <MPPUploader
          onUploadComplete={handleMPPUploadComplete}
          onError={handleMPPError}
        />

        {/* Legacy XML Upload Section */}
        <div className="border-t border-slate-800 pt-6">
          <p className="text-sm text-slate-500 text-center mb-4">
            ¿Tienes un archivo XML?{" "}
            <span className="text-slate-400">Usa la opción legacy</span>
          </p>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border border-dashed rounded-lg p-6 text-center transition-all
              ${
                isDragging
                  ? "border-blue-400 bg-blue-950/20"
                  : "border-slate-700 hover:border-slate-600 bg-slate-900"
              }
              ${isXmlUploading ? "opacity-50 pointer-events-none" : ""}
            `}
          >
            <input
              type="file"
              accept=".xml"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isXmlUploading}
            />

            <div className="space-y-2">
              {isXmlUploading ? (
                <p className="text-sm text-blue-400 animate-pulse">
                  Procesando XML...
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-300">
                    {isDragging
                      ? "Suelta el archivo XML aquí"
                      : "Arrastra un archivo XML o haz clic"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Compatible con MSPDI XML
                  </p>
                </>
              )}
            </div>
          </div>

          {xmlResult && (
            <div
              className={`
              mt-3 p-3 rounded-lg border text-sm
              ${
                xmlResult.success
                  ? "bg-emerald-950/20 border-emerald-700 text-emerald-400"
                  : ""
              }
            `}
            >
              {xmlResult.success ? (
                <p className="font-medium">✅ {xmlResult.message}</p>
              ) : (
                <ErrorDisplay
                  error={xmlResult.message}
                  onDismiss={() => setXmlResult(null)}
                />
              )}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-800">
          <p className="text-sm text-slate-500 text-center">
            Visor Gantt v2 - Powered by Next.js + Supabase
          </p>
        </div>
      </div>
    </div>
  );
}
