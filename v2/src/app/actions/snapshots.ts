"use server";

import pool from "@/lib/db";
import { migrationClient, runMigrations } from "@/lib/db/migrator";
import { ALL_MIGRATIONS } from "@/lib/db/migrations";
import type {
  ProjectSnapshot,
  ProjectSnapshotSummary,
  SnapshotOrigin,
  SnapshotTask,
} from "@/types/snapshot";

/**
 * Acceso a las fotos del plan.
 *
 * Se llama **solo al abrir el tablero**. Nada de esto entra en el camino del
 * guardado: `saveProject` sigue escribiendo un único blob y no sabe que estas
 * filas existen.
 */

interface SerializedSnapshotTask {
  taskId: string | number;
  name?: string;
  start: string;
  finish: string;
  duration: number;
  progress?: number;
}

function deserializeTasks(raw: SerializedSnapshotTask[]): SnapshotTask[] {
  return raw.map((task) => ({
    taskId: task.taskId,
    name: task.name,
    start: new Date(task.start),
    finish: new Date(task.finish),
    duration: task.duration,
    progress: task.progress,
  }));
}

function serializeTasks(tasks: SnapshotTask[]): SerializedSnapshotTask[] {
  return tasks.map((task) => ({
    taskId: task.taskId,
    name: task.name,
    start: task.start.toISOString(),
    finish: task.finish.toISOString(),
    duration: task.duration,
    progress: task.progress,
  }));
}

export async function listProjectSnapshots(
  projectId: string,
): Promise<ProjectSnapshotSummary[]> {
  const client = await pool.connect();
  try {
    await runMigrations(migrationClient(client), ALL_MIGRATIONS);
    const result = await client.query(
      `SELECT id, name, origin, captured_at,
              jsonb_array_length(tasks) AS task_count
         FROM project_snapshots
        WHERE project_id = $1
        ORDER BY captured_at DESC`,
      [projectId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      origin: String(row.origin) as SnapshotOrigin,
      capturedAt: new Date(row.captured_at),
      taskCount: Number(row.task_count),
    }));
  } catch (err) {
    console.error("listProjectSnapshots error:", err);
    return [];
  } finally {
    client.release();
  }
}

export async function loadProjectSnapshot(
  projectId: string,
  snapshotId: string,
): Promise<ProjectSnapshot | null> {
  const client = await pool.connect();
  try {
    await runMigrations(migrationClient(client), ALL_MIGRATIONS);
    const result = await client.query(
      `SELECT id, name, origin, captured_at, tasks
         FROM project_snapshots
        WHERE project_id = $1 AND id = $2`,
      [projectId, snapshotId],
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      id: String(row.id),
      projectId,
      name: String(row.name),
      origin: String(row.origin) as SnapshotOrigin,
      capturedAt: new Date(row.captured_at),
      tasks: deserializeTasks(row.tasks as SerializedSnapshotTask[]),
    };
  } catch (err) {
    console.error("loadProjectSnapshot error:", err);
    return null;
  } finally {
    client.release();
  }
}

export async function saveProjectSnapshot(
  snapshot: ProjectSnapshot,
): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  try {
    await runMigrations(migrationClient(client), ALL_MIGRATIONS);
    await client.query(
      `INSERT INTO project_snapshots (project_id, id, name, origin, captured_at, tasks)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project_id, id) DO NOTHING`,
      [
        snapshot.projectId,
        snapshot.id,
        snapshot.name,
        snapshot.origin,
        snapshot.capturedAt.toISOString(),
        JSON.stringify(serializeTasks(snapshot.tasks)),
      ],
    );
    return { success: true };
  } catch (err) {
    console.error("saveProjectSnapshot error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido al guardar la foto",
    };
  } finally {
    client.release();
  }
}
