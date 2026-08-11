/**
 * Resumen de lo que entró al importar un `.mpp`.
 *
 * Los conteos viajan en la URL de destino porque la importación termina en un
 * redirect: las cabeceras de esa respuesta se pierden cuando el navegador lo
 * sigue, así que la URL es el único canal que llega al usuario.
 */

export interface ImportSummary {
  tasks: number;
  dependencies: number;
  resources: number;
  /**
   * Columnas del `.mpp` que no entraron. La importación ligera se queda en
   * 120 columnas: callarlo hace creer que se importó todo (E33).
   */
  discardedColumns: string[];
  /**
   * La foto del cronograma no se pudo guardar.
   *
   * El tablero de Cortes explica que «cada vez que importas … se guarda una
   * foto». Cuando no ocurre, callarlo deja al usuario delante de un tablero
   * vacío que contradice ese texto.
   */
  snapshotMissing?: boolean;
}

function columnList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function count(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

export function parseImportSummary(
  params: Record<string, string | undefined>,
): ImportSummary | null {
  const tasks = count(params.tareas);
  if (tasks === null) return null;

  return {
    tasks,
    dependencies: count(params.dependencias) ?? 0,
    resources: count(params.recursos) ?? 0,
    discardedColumns: columnList(params.descartadas),
    snapshotMissing: params.sinFoto === "1",
  };
}

function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

export function formatImportSummary(summary: ImportSummary): string {
  const parts = [plural(summary.tasks, "tarea", "tareas")];
  if (summary.dependencies > 0) {
    parts.push(plural(summary.dependencies, "dependencia", "dependencias"));
  }
  if (summary.resources > 0) {
    parts.push(plural(summary.resources, "recurso", "recursos"));
  }

  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;

  return `Se importaron ${list}.`;
}
