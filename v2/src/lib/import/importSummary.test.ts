import { parseImportSummary, formatImportSummary } from "./importSummary";

describe("parseImportSummary", () => {
  test("lee los conteos que llegan en la URL tras importar", () => {
    expect(
      parseImportSummary({ tareas: "239", dependencias: "212", recursos: "0" }),
    ).toEqual({ tasks: 239, dependencies: 212, resources: 0 });
  });

  test("sin parámetros no hay resumen que mostrar", () => {
    expect(parseImportSummary({})).toBeNull();
  });

  test("ignora valores que no son números en vez de mostrar NaN", () => {
    expect(parseImportSummary({ tareas: "muchas" })).toBeNull();
  });

  test("basta con el conteo de tareas: dependencias y recursos son opcionales", () => {
    expect(parseImportSummary({ tareas: "12" })).toEqual({
      tasks: 12,
      dependencies: 0,
      resources: 0,
    });
  });
});

describe("formatImportSummary", () => {
  test("resume en lenguaje de obra lo que se importó", () => {
    expect(
      formatImportSummary({ tasks: 239, dependencies: 212, resources: 0 }),
    ).toBe("Se importaron 239 tareas y 212 dependencias.");
  });

  test("menciona los recursos solo si vinieron", () => {
    expect(
      formatImportSummary({ tasks: 10, dependencies: 4, resources: 3 }),
    ).toBe("Se importaron 10 tareas, 4 dependencias y 3 recursos.");
  });

  test("usa singular cuando corresponde", () => {
    expect(formatImportSummary({ tasks: 1, dependencies: 1, resources: 1 })).toBe(
      "Se importaron 1 tarea, 1 dependencia y 1 recurso.",
    );
  });

  test("un cronograma sin dependencias no las menciona", () => {
    expect(formatImportSummary({ tasks: 5, dependencies: 0, resources: 0 })).toBe(
      "Se importaron 5 tareas.",
    );
  });
});
