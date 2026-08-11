/**
 * Deja listo el material del modo de prueba: una cuenta de revisión y una copia
 * propia de un cronograma real para mirarla desde las vistas con cuenta.
 *
 * No abre ninguna sesión —eso lo hace `/api/modo-prueba`, que es lo único que
 * toca la cookie— y no inventa datos: **copia** un proyecto que ya está en la
 * base, por defecto el más reciente que traiga tareas y asignaciones de verdad.
 * Un cronograma sintético habría escondido justo lo que se busca: el enlace
 * público que entregaba media aplicación se vio porque las 213 asignaciones del
 * cronograma de obra existían y no se pintaban.
 *
 *   npx tsx scripts/seed-modo-prueba.ts
 *   npx tsx scripts/seed-modo-prueba.ts --desde=485
 *
 * Es idempotente: vuelve a usar la misma copia en vez de acumular proyectos.
 */
import { Client } from "pg";

const CORREO =
  process.env.VISOR_TEST_MODE_EMAIL?.trim().toLowerCase() ?? "modo-prueba@visor.local";
const NOMBRE_COPIA = "Modo de prueba — cronograma de obra";

function urlDeBase(): string {
  return (
    process.env.DATABASE_URL ??
    "postgresql://visoruser:visorpass@localhost:5432/visormpp"
  );
}

function argumento(nombre: string): string | undefined {
  const prefijo = `--${nombre}=`;
  return process.argv.find((a) => a.startsWith(prefijo))?.slice(prefijo.length);
}

async function main() {
  const client = new Client({ connectionString: urlDeBase() });
  await client.connect();
  try {
    const desde = argumento("desde");
    const origen = desde
      ? await client.query(
          `SELECT id, name, project_data, start_date, finish_date, settings
             FROM projects WHERE id = $1`,
          [desde],
        )
      : await client.query(
          `SELECT id, name, project_data, start_date, finish_date, settings
             FROM projects
            WHERE jsonb_array_length(project_data->'tasks') > 100
              AND jsonb_array_length(project_data->'assignments') > 0
            ORDER BY id DESC
            LIMIT 1`,
        );

    if (origen.rows.length === 0) {
      throw new Error(
        "No hay ningún proyecto con tareas y asignaciones que copiar. " +
          "Importa un .mpp real primero, o pasa --desde=<id>.",
      );
    }
    const fuente = origen.rows[0];

    const usuario = await client.query(
      `INSERT INTO users (email, name, provider)
       VALUES ($1, 'Modo de prueba', 'password')
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [CORREO],
    );
    const userId = usuario.rows[0].id as string;

    const yaCopiado = await client.query(
      `SELECT id FROM projects WHERE name = $1 ORDER BY id DESC LIMIT 1`,
      [NOMBRE_COPIA],
    );

    let projectId: string;
    if (yaCopiado.rows.length > 0) {
      projectId = String(yaCopiado.rows[0].id);
      await client.query(
        `UPDATE projects
            SET project_data = $2, start_date = $3, finish_date = $4,
                settings = $5, updated_at = NOW()
          WHERE id = $1`,
        [
          projectId,
          fuente.project_data,
          fuente.start_date,
          fuente.finish_date,
          fuente.settings,
        ],
      );
    } else {
      const creado = await client.query(
        `INSERT INTO projects (name, project_data, start_date, finish_date, settings)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          NOMBRE_COPIA,
          fuente.project_data,
          fuente.start_date,
          fuente.finish_date,
          fuente.settings,
        ],
      );
      projectId = String(creado.rows[0].id);
    }

    // `project_members.project_id` es TEXT, no el entero de `projects.id`: la
    // pertenencia se escribe con el id en texto, como la leen los lectores.
    await client.query(
      `INSERT INTO project_members (project_id, user_id, role_id)
       VALUES ($1, $2, 'member')
       ON CONFLICT (project_id, user_id) DO NOTHING`,
      [projectId, userId],
    );

    const tareas = fuente.project_data?.tasks?.length ?? 0;
    const asignaciones = fuente.project_data?.assignments?.length ?? 0;

    console.log(`Cuenta de prueba : ${CORREO} (${userId})`);
    console.log(`Copiado de       : proyecto ${fuente.id} — ${fuente.name}`);
    console.log(`Proyecto propio  : ${projectId} — ${tareas} tareas, ${asignaciones} asignaciones`);
    console.log("");
    console.log("Para entrar, con VISOR_TEST_MODE=1 en el servidor:");
    console.log(`  http://127.0.0.1:3000/api/modo-prueba?destino=/project/${projectId}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
