import pool from "@/lib/db";
import { migrationClient, runMigrations } from "@/lib/db/migrator";
import { ALL_MIGRATIONS } from "@/lib/db/migrations";

/**
 * Aplica las migraciones una vez por proceso, para quien las necesite.
 *
 * Hasta E51 solo las disparaba `snapshots.ts`, es decir: el esquema se ponía al
 * día **cuando alguien abría la Curva S**. Las rutas públicas de E51 necesitan
 * `share_token` y `expires_at` en la primera visita, y no pasan por ahí; en una
 * base donde nadie hubiera abierto Cortes, las columnas sencillamente no
 * existirían.
 *
 * Se memoriza la promesa, no el resultado: así varias peticiones simultáneas
 * comparten el mismo trabajo en vez de migrar tres veces a la vez. Y si falla,
 * se olvida — cachear un fallo dejaría el proceso sin esquema hasta reiniciarlo.
 */
let enCurso: Promise<void> | null = null;

export function resetSchemaCache(): void {
  enCurso = null;
}

export function ensureSchema(): Promise<void> {
  if (enCurso) return enCurso;

  enCurso = (async () => {
    const client = await pool.connect();
    try {
      await runMigrations(migrationClient(client), ALL_MIGRATIONS);
    } finally {
      client.release();
    }
  })().catch((error) => {
    enCurso = null;
    throw error;
  });

  return enCurso;
}
