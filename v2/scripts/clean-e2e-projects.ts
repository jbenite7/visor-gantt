import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

interface CleanOptions {
  olderThanDays: number;
  confirm: boolean;
}

const KNOWN_FLAGS = new Set(["--yes", "--older-than-days"]);

function parseOptions(argv: string[]): CleanOptions {
  const options: CleanOptions = {
    olderThanDays: 7,
    confirm: false,
  };

  for (const item of argv) {
    if (item === "--yes") {
      options.confirm = true;
      continue;
    }

    if (item.startsWith("--older-than-days=")) {
      const raw = item.split("=")[1];
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Valor inválido para --older-than-days: "${raw}"`);
      }
      options.olderThanDays = value;
      continue;
    }

    if (item === "--help") {
      console.log(`
Uso:
  npx tsx scripts/clean-e2e-projects.ts [opciones]

Opciones:
  --older-than-days=<n>  Antigüedad mínima en días para considerar el proyecto (default 7)
  --yes                  Ejecuta el borrado. Sin esta opción solo se informa.
  --help                 Ver esta ayuda

Solo borra proyectos cuyo nombre contenga el marcador "run-" de las
corridas E2E (ver v2/e2e/helpers/runId.ts). Proyectos sin ese marcador
nunca se listan ni se borran, aunque coincidan con otros criterios.
`);
      process.exit(0);
    }

    const flagName = item.split("=")[0];
    if (!KNOWN_FLAGS.has(flagName)) {
      throw new Error(`Argumento no reconocido: "${item}". Usa --help para ver las opciones válidas.`);
    }
  }

  return options;
}

interface CandidateRow {
  id: string;
  name: string;
  created_at: string;
}

async function runClean(options: CleanOptions): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida en el entorno.");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const res = await client.query<CandidateRow>(
      `SELECT id, name, created_at
       FROM projects
       WHERE name LIKE '%run-%'
         AND created_at < NOW() - ($1 || ' days')::interval
       ORDER BY created_at ASC`,
      [options.olderThanDays],
    );

    if (res.rows.length === 0) {
      console.log(
        `No hay proyectos E2E (marcador "run-") con más de ${options.olderThanDays} día(s) de antigüedad.`,
      );
      return;
    }

    console.log(
      `Candidatos a borrar (marcador "run-", antigüedad > ${options.olderThanDays} día(s)):`,
    );
    for (const row of res.rows) {
      console.log(`  id=${row.id}  creado=${row.created_at}  nombre="${row.name}"`);
    }

    if (!options.confirm) {
      console.log(
        `\nModo informativo: no se borró nada. Usa --yes para ejecutar el borrado de estos ${res.rows.length} proyecto(s).`,
      );
      return;
    }

    const ids = res.rows.map((row) => row.id);
    const deleteRes = await client.query(`DELETE FROM projects WHERE id = ANY($1::int[])`, [ids]);
    console.log(`\nBorrado completado. Filas eliminadas: ${deleteRes.rowCount}`);
  } finally {
    await client.end();
  }
}

let options: CleanOptions;
try {
  options = parseOptions(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : "Error desconocido";
  console.error(`Error: ${message}`);
  process.exit(1);
}

runClean(options)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : "Error desconocido";
    console.error(`Error ejecutando limpieza: ${message}`);
    process.exit(1);
  });
