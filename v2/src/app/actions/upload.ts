"use server";

import { MPPParser } from "@/lib/parser/mpp-parser";
import { CPMCalculatorService } from "@/lib/scheduling/cpm";
import { CalendarService } from "@/lib/scheduling/calendar";
import {
  Task,
  Dependency,
  DependencyType,
  mapMppDependencyType,
} from "@/lib/scheduling/types";
import pool from "@/lib/db";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

interface UploadResult {
  success: boolean;
  projectId?: number;
  message: string;
}

function mapConstraintType(value: unknown): Task["constraintType"] {
  switch (Number(value)) {
    case 1:
      return "asLateAsPossible";
    case 2:
      return "mustStartOn";
    case 3:
      return "mustFinishOn";
    case 4:
      return "startNoEarlierThan";
    case 5:
      return "startNoLaterThan";
    case 6:
      return "finishNoEarlierThan";
    case 7:
      return "finishNoLaterThan";
    default:
      return "asSoonAsPossible";
  }
}

function optionalDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function uploadProject(formData: FormData): Promise<UploadResult> {
  try {
    const file = formData.get("file") as File;

    if (!file) {
      return { success: false, message: "No se proporcionó ningún archivo" };
    }

    if (!file.name.endsWith(".xml")) {
      return { success: false, message: "Solo se aceptan archivos .xml" };
    }

    // Save temp file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const tempDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(tempDir, `${nanoid()}.xml`);
    fs.writeFileSync(tempPath, buffer);

    // 1. Parse XML
    const parser = new MPPParser();
    const projectData = parser.parse(tempPath);

    // 2. Initialize Calendar (sync for now, could be async)
    const calendar = new CalendarService();
    await calendar.init("CO");

    // Set work days from project (simplified: assume Mon-Sat)
    calendar.setWorkDays({ 1: false }); // Sunday off

    // 3. Map to Domain Tasks
    const tasks: Task[] = projectData.tasks.map((t) => ({
      id: t.UID,
      name: t.Name,
      durationMinutes: parseDurationToMinutes(t.Duration, t.DurationFormat),
      totalFloat: 0,
      isCritical: false,
      isMilestone: t.Milestone,
      outlineLevel: t.OutlineLevel,
      isSummary: t.Summary,
      manualStart: t.Start ? new Date(t.Start) : undefined,
      constraintType: mapConstraintType(t.ConstraintType),
      constraintDate: optionalDate(t.ConstraintDate),
      deadline: optionalDate(t.Deadline),
    }));

    // 4. Map Dependencies
    const dependencies: Dependency[] = [];
    projectData.tasks.forEach((t) => {
      if (t.PredecessorLink) {
        t.PredecessorLink.forEach((pred) => {
          dependencies.push({
            predecessorId: pred.PredecessorUID,
            successorId: t.UID,
            type: mapMppDependencyType(pred.Type),
            lag: pred.LinkLag || 0,
            isPercentage: false, // Detect from LagFormat if needed
          });
        });
      }
    });

    // 5. Calculate CPM
    const cpmService = new CPMCalculatorService(calendar);
    const projectStart = projectData.startDate
      ? new Date(projectData.startDate)
      : new Date();
    const calculatedTasks = cpmService.calculate(
      tasks,
      dependencies,
      projectStart,
    );

    // 6. Save to Supabase
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Insert Project
      const projectRes = await client.query(
        `INSERT INTO projects (name, start_date, finish_date, settings, created_at, updated_at) 
                 VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
        [
          projectData.name,
          projectStart,
          projectData.finishDate || null,
          JSON.stringify({}),
        ],
      );
      const projectId = projectRes.rows[0].id;

      // Insert Tasks
      for (const task of calculatedTasks) {
        await client.query(
          `INSERT INTO tasks 
                     (project_id, uid, name, start_date, finish_date, duration, 
                      percent_complete, outline_level, is_summary, is_milestone, wbs, extra_data)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            projectId,
            task.id,
            task.name,
            task.earlyStart || null,
            task.earlyFinish || null,
            task.durationMinutes / 60 / 8, // Convert to days for display
            0,
            task.outlineLevel,
            task.isSummary,
            task.isMilestone,
            "", // WBS - extract from original if needed
            JSON.stringify({
              lateStart: task.lateStart,
              lateFinish: task.lateFinish,
              totalFloat: task.totalFloat,
              isCritical: task.isCritical,
            }),
          ],
        );
      }

      // Insert Dependencies
      for (const dep of dependencies) {
        await client.query(
          `INSERT INTO dependencies (project_id, successor_uid, predecessor_uid, type, lag)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT DO NOTHING`,
          [
            projectId,
            dep.successorId,
            dep.predecessorId,
            mapDepTypeToInt(dep.type),
            dep.lag,
          ],
        );
      }

      await client.query("COMMIT");

      // Cleanup temp file
      fs.unlinkSync(tempPath);

      return {
        success: true,
        projectId,
        message: `Proyecto "${projectData.name}" importado con ${calculatedTasks.length} tareas`,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      message: `Error: ${error instanceof Error ? error.message : "Error desconocido"}`,
    };
  }
}

function parseDurationToMinutes(duration: string, _format: number): number {
  void _format;
  // Simplified parser (ISO 8601 format PT8H0M0S)
  if (duration.startsWith("PT")) {
    const hours = duration.match(/(\d+)H/);
    const minutes = duration.match(/(\d+)M/);
    const h = hours ? parseInt(hours[1]) : 0;
    const m = minutes ? parseInt(minutes[1]) : 0;
    return h * 60 + m;
  }

  // Fallback: assume days * 8 hours
  const days = parseFloat(duration) || 0;
  return days * 8 * 60;
}

function mapDepTypeToInt(type: DependencyType): number {
  switch (type) {
    case DependencyType.FinishToStart:
      return 1;
    case DependencyType.StartToStart:
      return 2;
    case DependencyType.FinishToFinish:
      return 3;
    case DependencyType.StartToFinish:
      return 4;
    default:
      return 1;
  }
}
