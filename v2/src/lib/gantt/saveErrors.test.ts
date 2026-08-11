import { humanSaveError } from "./saveErrors";

/**
 * Lo que ve quien está en obra cuando el guardado falla.
 *
 * `saveProject` devolvía `err.message` tal cual, y `GanttView` lo pinta en
 * pantalla. Un fallo de base le enseñaba al jefe de obra cosas como
 * `connect ECONNREFUSED 127.0.0.1:5432` o `column "version" does not exist`:
 * jerga que no le dice qué hacer, y que además cuenta de más sobre el servidor.
 *
 * La app ya resolvió esto para el analizador con `humanParserError`. Mismo
 * patrón: el detalle técnico se queda en el registro del servidor.
 */
describe("humanSaveError", () => {
  test("un fallo de conexión se cuenta como lo que es", () => {
    const texto = humanSaveError("connect ECONNREFUSED 127.0.0.1:5432");

    expect(texto).not.toContain("ECONNREFUSED");
    expect(texto).not.toContain("127.0.0.1");
    expect(texto).toMatch(/conexión|servidor/i);
  });

  test("una columna que falta no se le cuenta al usuario en SQL", () => {
    const texto = humanSaveError('column "version" does not exist');

    expect(texto).not.toContain("column");
    expect(texto.length).toBeGreaterThan(20);
  });

  test("los mensajes escritos para el usuario pasan intactos", () => {
    // Este lo escribió la app a propósito y ya está en su idioma: reescribirlo
    // sería perder el único mensaje que sí sabe qué hacer.
    const conflicto =
      "Otra pestaña guardó este proyecto mientras lo editabas. Recarga para no perder lo suyo ni lo tuyo.";

    expect(humanSaveError(conflicto)).toBe(conflicto);
  });

  test("«no es tuyo» también pasa: es una explicación, no un fallo técnico", () => {
    expect(humanSaveError("Este proyecto no es tuyo")).toBe(
      "Este proyecto no es tuyo",
    );
  });

  test("sin mensaje, dice algo útil en vez de quedarse en blanco", () => {
    expect(humanSaveError(undefined).length).toBeGreaterThan(20);
  });
});
