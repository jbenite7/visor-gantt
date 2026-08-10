import fs from "fs";
import path from "path";
import { Client } from "pg";

/**
 * Marca el instante en que arranca la corrida, **según el reloj de la base**.
 *
 * La suite creaba proyectos y no borraba ninguno: el 2026-08-10 la base tenía
 * 268 proyectos y 25 MB acumulados, y dos corridas sueltas de un solo test le
 * sumaron 14 más. Un recurso compartido que solo crece termina cambiando los
 * tiempos de todas las corridas siguientes.
 *
 * La marca la da `now()` de Postgres y no `new Date()` de Node a propósito:
 * `projects.created_at` es `timestamp` **sin zona horaria**, así que guarda la
 * hora local del servidor. Comparar eso contra un ISO en UTC se desfasa por el
 * huso, y un desfase hacia atrás haría que el borrado alcanzara proyectos
 * anteriores a la corrida — datos que no son suyos. Con el reloj de la base,
 * las dos puntas hablan el mismo idioma.
 *
 * Se guarda en un archivo y no en una variable de entorno porque el teardown
 * corre en otro proceso.
 */
export const MARCA_DE_ARRANQUE = path.resolve(
  __dirname,
  "../test-results/e2e-arranque.json",
);

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://visoruser:visorpass@localhost:5432/visormpp";

export default async function globalSetup() {
  const client = new Client({ connectionString: DATABASE_URL });
  try {
    await client.connect();
    // Como TEXTO, no como timestamp. Si se deja que el driver lo convierta a
    // `Date`, `toISOString()` lo reescribe en UTC y la marca se desplaza el
    // huso entero: medido aquí, cinco horas hacia adelante, con lo que la
    // limpieza no alcanzaba nada. El error cayó del lado seguro —borrar de
    // menos—, pero del lado contrario habría borrado datos ajenos.
    const { rows } = await client.query(
      "SELECT to_char(now(), 'YYYY-MM-DD HH24:MI:SS.US') AS ahora",
    );
    fs.mkdirSync(path.dirname(MARCA_DE_ARRANQUE), { recursive: true });
    fs.writeFileSync(
      MARCA_DE_ARRANQUE,
      JSON.stringify({ arranque: rows[0].ahora }),
    );
  } catch (error) {
    // Sin marca no hay limpieza, y eso es preferible a una limpieza a ciegas.
    console.warn(`[limpieza] No se pudo marcar el arranque: ${String(error)}`);
    fs.rmSync(MARCA_DE_ARRANQUE, { force: true });
  } finally {
    await client.end().catch(() => {});
  }
}
