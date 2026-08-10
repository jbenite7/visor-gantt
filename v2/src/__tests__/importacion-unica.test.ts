import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * La app tuvo dos rutas de importación de `.mpp` que producían resultados
 * distintos:
 *
 * - `/api/import-mpp` → `buildProjectDataFromMpp` → aplica `withColombiaHolidays`
 *   y guarda en `projects.project_data`, que es de donde el visor lee. **Viva.**
 * - `/upload` → `uploadProject` → `CalendarService` leía la tabla `holidays`, que
 *   nadie poblaba nunca, y calculaba un CPM **sin festivos** que persistía en las
 *   tablas `tasks` y `dependencies`. Ningún lector las consultaba. **Muerta.**
 *
 * La ruta muerta no afectaba al usuario, pero simulaba un fallo de datos: en la
 * auditoría del 2026-08-10 hizo creer que el cronograma se calculaba sin los ~18
 * festivos colombianos. Costó media investigación descartarlo.
 *
 * Estos tests impiden que vuelva. Si alguien necesita una segunda ruta de
 * importación, tendrá que borrar este archivo a conciencia.
 */

const SRC = path.join(__dirname, "..");

describe("una sola ruta de importación", () => {
  test("no existe la página /upload ni su acción de servidor", () => {
    expect(existsSync(path.join(SRC, "app/upload"))).toBe(false);
    expect(existsSync(path.join(SRC, "app/actions/upload.ts"))).toBe(false);
  });

  test("ningún calendario consulta la tabla holidays", async () => {
    const calendar = await readFile(
      path.join(SRC, "lib/scheduling/calendar.ts"),
      "utf8",
    );
    expect(calendar).not.toMatch(/FROM\s+holidays/i);
    expect(calendar).not.toContain("@/lib/db");
  });

  test("el calendario distingue «sin festivos» de «no cargados»", async () => {
    const { CalendarService } = await import("@/lib/scheduling/calendar");
    const calendar = new CalendarService();
    expect(calendar.holidayCount).toBe(0);
    calendar.setHolidays(["2026-01-01", "2026-01-12"]);
    expect(calendar.holidayCount).toBe(2);
  });

  test("los festivos salen del calendario del proyecto, no de una tabla", async () => {
    const importer = await readFile(
      path.join(SRC, "lib/import/mpp-project.ts"),
      "utf8",
    );
    expect(importer).toContain("withColombiaHolidays");
  });
});
