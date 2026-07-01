"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveProject } from "@/app/actions/project";
import { parseMPP } from "@/lib/api";
import {
  mppAssignmentsToAssignments,
  mppResourcesToResources,
  mppTasksToGanttTasks,
} from "@/components/upload/mpp-to-gantt";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import { DEFAULT_UI_SETTINGS } from "@/types/ui";
import {
  buildMppAssignmentColumnsFromAssignments,
  buildMppResourceColumnsFromResources,
  buildMppTaskColumnsFromTasks,
} from "@/lib/mpp/taskColumns";
import { calculateMppFields } from "@/lib/mpp/mppCalculationEngine";
import { normalizeProjectCalendar } from "@/lib/scheduling/projectCalendar";

const MAX_FILE_SIZE_MB = 50;
const GENERIC_IMPORTED_PROJECT_NAME = "Proyecto Importado";

function validateMppFile(file: File): string | null {
  const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
  if (extension !== ".mpp") {
    return "Selecciona un archivo Microsoft Project con extension .mpp";
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `El archivo supera el maximo de ${MAX_FILE_SIZE_MB} MB`;
  }
  return null;
}

export default function HomeMppUploadAction() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const validationError = validateMppFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const parsedProject = await parseMPP(file);
      const fallbackName = file.name.replace(/\.mpp$/i, "");
      const projectName =
        parsedProject.name && parsedProject.name !== GENERIC_IMPORTED_PROJECT_NAME
          ? parsedProject.name
          : fallbackName;
      const projectCalendar = normalizeProjectCalendar(
        parsedProject.calendar ?? DEFAULT_PROJECT_CALENDAR,
      );
      const tasks = mppTasksToGanttTasks(parsedProject.tasks);
      const mppTaskColumns = buildMppTaskColumnsFromTasks(
        parsedProject.tasks,
        parsedProject.availableColumns,
        parsedProject.mppTaskColumns,
      );
      const resources = mppResourcesToResources(parsedProject.resources ?? []);
      const assignments = mppAssignmentsToAssignments(parsedProject.assignments ?? []);
      const mppResourceColumns = buildMppResourceColumnsFromResources(
        resources,
        parsedProject.availableResourceColumns,
        parsedProject.mppResourceColumns,
      );
      const mppAssignmentColumns = buildMppAssignmentColumnsFromAssignments(
        assignments,
        parsedProject.availableAssignmentColumns,
        parsedProject.mppAssignmentColumns,
      );
      const calculated = calculateMppFields({
        tasks,
        resources,
        assignments,
        baselines: [],
        calendar: projectCalendar,
        statusDate: parsedProject.statusDate,
        mppTaskColumns,
        mppResourceColumns,
        mppAssignmentColumns,
        customFieldDefinitions: parsedProject.customFieldDefinitions ?? [],
      });
      const result = await saveProject({
        name: projectName,
        statusDate: parsedProject.statusDate,
        tasks: calculated.tasks,
        resources: calculated.resources,
        assignments: calculated.assignments,
        budgetItems: [],
        budgetMappings: [],
        baselines: [],
        calendar: projectCalendar,
        mppTaskColumns: calculated.mppTaskColumns,
        mppResourceColumns: calculated.mppResourceColumns,
        mppAssignmentColumns: calculated.mppAssignmentColumns,
        customFieldDefinitions: calculated.customFieldDefinitions,
        calculationEngineVersion: calculated.engineVersion,
        calculatedAt: calculated.calculatedAt,
        uiSettings: DEFAULT_UI_SETTINGS,
      });

      if (!result.success || !result.id) {
        throw new Error(result.error ?? "No se pudo guardar el proyecto importado");
      }

      router.push(`/project/${result.id}`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo importar el archivo .mpp",
      );
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".mpp"
        aria-label="Seleccionar archivo .mpp"
        className="sr-only"
        disabled={isProcessing}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => inputRef.current?.click()}
        className="inline-block px-5 py-2 rounded-lg bg-[var(--aia-corp-main)] text-white text-sm font-medium hover:bg-[var(--aia-corp-dark)] transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        {isProcessing ? "Importando..." : "Subir Archivo .mpp"}
      </button>
      {error && (
        <p className="max-w-md text-sm text-[var(--aia-alert-main)]">{error}</p>
      )}
    </div>
  );
}
