import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default pool;

/**
 * Aquí vivía `ensureProjectsTable`, retirada el 2026-08-11.
 *
 * Decía crear la tabla de proyectos, **no la llamaba ningún sitio**, y de
 * haberla llamado la habría creado con `id UUID` cuando la real es entera: una
 * trampa esperando a que alguien la invocara. Además se tragaba cualquier fallo
 * con un `console.warn`, así que ni siquiera habría avisado.
 *
 * Quien crea el esquema base ahora es la migración `000_base_schema`, por el
 * mismo camino que todo lo demás. Dos mecanismos para crear las mismas tablas es
 * justo donde vuelven a divergir.
 */
