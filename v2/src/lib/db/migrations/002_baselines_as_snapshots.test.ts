import type { MigrationClient } from "@/lib/db/migrator";
import { migration002BaselinesAsSnapshots } from "./002_baselines_as_snapshots";

interface FilaTabla {
  projectId: string;
  id: string;
  name: string;
  origin: string;
  capturedAt: string;
  tasks: string;
}

/**
 * Cliente falso que simula de verdad la tabla `project_snapshots`: el
 * `origin` y el `captured_at` de cada fila salen de **parsear el SQL y los
 * parámetros que la migración manda**, no de un literal escrito a mano en el
 * test. Así, si la migración inserta con un `origin` distinto de `'baseline'`
 * (un typo, un cambio accidental), el test lo nota: el fake nunca lo
 * "corrige" a `'baseline'` por su cuenta.
 *
 * También respeta `ON CONFLICT (project_id, id) DO NOTHING` de verdad: un
 * segundo `INSERT` con la misma clave no agrega fila.
 */
function fakeClient(
  projectRows: Record<string, unknown>[],
  filasIniciales: FilaTabla[] = [],
): MigrationClient & {
  tabla: FilaTabla[];
  blobIntacto: () => boolean;
} {
  const tabla: FilaTabla[] = [...filasIniciales];
  let blobEscrito = false;

  return {
    tabla,
    blobIntacto: () => !blobEscrito,
    async query(text: string, params?: unknown[]) {
      if (text.includes("SELECT id, project_data->'baselines'")) {
        return { rows: projectRows };
      }

      if (text.includes("INSERT INTO project_snapshots")) {
        const originMatch = text.match(/VALUES\s*\(\$1,\s*\$2,\s*\$3,\s*'([^']+)',\s*\$4,\s*\$5\)/);
        const origin = originMatch?.[1] ?? "";
        const projectId = String(params?.[0]);
        const id = String(params?.[1]);
        const tieneOnConflict = text.includes(
          "ON CONFLICT (project_id, id) DO NOTHING",
        );
        const yaExiste = tabla.some(
          (fila) => fila.projectId === projectId && fila.id === id,
        );
        if (tieneOnConflict && yaExiste) {
          return { rows: [] };
        }
        tabla.push({
          projectId,
          id,
          name: String(params?.[2]),
          origin,
          capturedAt: String(params?.[3]),
          tasks: String(params?.[4]),
        });
        return { rows: [] };
      }

      if (text.includes("DELETE FROM project_snapshots")) {
        const requiereOriginBaseline = text.includes("origin = 'baseline'");
        const projectId = String(params?.[0]);
        const id = String(params?.[1]);
        const antes = tabla.length;
        for (let i = tabla.length - 1; i >= 0; i--) {
          const fila = tabla[i];
          const coincideClave = fila.projectId === projectId && fila.id === id;
          const coincideOrigin = !requiereOriginBaseline || fila.origin === "baseline";
          if (coincideClave && coincideOrigin) {
            tabla.splice(i, 1);
          }
        }
        void antes;
        return { rows: [] };
      }

      if (text.includes("UPDATE projects")) {
        blobEscrito = true;
        return { rows: [] };
      }

      return { rows: [] };
    },
  };
}

function proyectoConDosLineasBase(): Record<string, unknown> {
  return {
    id: "p1",
    baselines: [
      {
        id: "baseline-1",
        name: "Contractual",
        createdAt: "2026-01-05T00:00:00.000Z",
        tasks: [
          {
            taskId: 7,
            baselineStart: "2026-01-01T00:00:00.000Z",
            baselineFinish: "2026-01-08T00:00:00.000Z",
            baselineDuration: 8,
          },
        ],
      },
      {
        id: "baseline-2",
        name: "Reprogramación",
        createdAt: "2026-02-05T00:00:00.000Z",
        tasks: [],
      },
    ],
  };
}

describe("migración 002 · las líneas base pasan a ser fotos", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("solo lee la columna de líneas base, no el blob completo", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);
    const sqls: string[] = [];
    const espia: MigrationClient = {
      query: async (text, params) => {
        sqls.push(text);
        return client.query(text, params);
      },
    };

    await migration002BaselinesAsSnapshots.up(espia);

    const select = sqls.find((sql) => sql.includes("SELECT"));
    expect(select).toContain("project_data->'baselines'");
    expect(select).not.toContain("project_data FROM projects");
  });

  test("up copia cada línea base conservando su id", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.tabla.map((fila) => fila.id)).toEqual([
      "baseline-1",
      "baseline-2",
    ]);
    expect(client.tabla[0].projectId).toBe("p1");
    expect(client.tabla[0].name).toBe("Contractual");
  });

  test("up escribe origin 'baseline' y captured_at igual al createdAt del blob", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.tabla[0].origin).toBe("baseline");
    expect(client.tabla[0].capturedAt).toBe("2026-01-05T00:00:00.000Z");
    expect(client.tabla[1].origin).toBe("baseline");
    expect(client.tabla[1].capturedAt).toBe("2026-02-05T00:00:00.000Z");
  });

  test("up traduce las tareas de la línea base al formato de foto", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(JSON.parse(client.tabla[0].tasks)).toEqual([
      {
        taskId: 7,
        start: "2026-01-01T00:00:00.000Z",
        finish: "2026-01-08T00:00:00.000Z",
        duration: 8,
      },
    ]);
  });

  test("up no toca el blob: las líneas base siguen donde estaban", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.blobIntacto()).toBe(true);
  });

  test("la inserción declara ON CONFLICT (project_id, id) DO NOTHING", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);
    const sqls: string[] = [];
    const espia: MigrationClient = {
      query: async (text, params) => {
        sqls.push(text);
        return client.query(text, params);
      },
    };

    await migration002BaselinesAsSnapshots.up(espia);

    expect(
      sqls.find((sql) => sql.includes("INSERT INTO project_snapshots")),
    ).toContain("ON CONFLICT (project_id, id) DO NOTHING");
  });

  test("aplicar up() dos veces no duplica ninguna foto", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.up(client);
    await migration002BaselinesAsSnapshots.up(client);

    expect(client.tabla).toHaveLength(2);
    expect(client.tabla.map((fila) => fila.id).sort()).toEqual([
      "baseline-1",
      "baseline-2",
    ]);
  });

  test("down borra exactamente las filas que up() habría insertado, por (project_id, id)", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);
    await migration002BaselinesAsSnapshots.up(client);
    expect(client.tabla).toHaveLength(2);

    await migration002BaselinesAsSnapshots.down(client);

    expect(client.tabla).toHaveLength(0);
    expect(client.blobIntacto()).toBe(true);
  });

  test("down no borra una foto de origen 'baseline' que no viene de una línea base del blob", async () => {
    const fotoAjena: FilaTabla = {
      projectId: "p1",
      id: "snapshot-creado-a-mano-luego",
      name: "Línea base guardada después de migrar",
      origin: "baseline",
      capturedAt: "2026-05-01T00:00:00.000Z",
      tasks: "[]",
    };
    const client = fakeClient([proyectoConDosLineasBase()], [fotoAjena]);
    await migration002BaselinesAsSnapshots.up(client);
    expect(client.tabla).toHaveLength(3);

    await migration002BaselinesAsSnapshots.down(client);

    expect(client.tabla).toEqual([fotoAjena]);
  });

  test("ida y vuelta: tras up y down no queda ninguna foto derivada del blob, y el blob original sigue intacto", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.up(client);
    await migration002BaselinesAsSnapshots.down(client);

    expect(client.tabla).toHaveLength(0);
    expect(client.blobIntacto()).toBe(true);
  });

  test("un proyecto sin líneas base no se rompe: no inserta nada", async () => {
    const proyectoSinBaselines = { id: "p2", baselines: null };
    const client = fakeClient([proyectoSinBaselines]);

    await expect(
      migration002BaselinesAsSnapshots.up(client),
    ).resolves.not.toThrow();
    expect(client.tabla).toHaveLength(0);
  });

  test("baselines corrupto (no es un array) no tumba la migración", async () => {
    const proyectoCorrupto = { id: "p9", baselines: { esto: "no es un array" } };
    const client = fakeClient([proyectoCorrupto]);

    await expect(
      migration002BaselinesAsSnapshots.up(client),
    ).resolves.not.toThrow();
    expect(client.tabla).toHaveLength(0);
  });

  test("una línea base sin id se salta sin tumbar la migración, avisando por consola", async () => {
    const proyecto = {
      id: "p3",
      baselines: [
        {
          name: "Sin identificador",
          createdAt: "2026-01-05T00:00:00.000Z",
          tasks: [],
        },
        {
          id: "baseline-ok",
          name: "Correcta",
          createdAt: "2026-01-05T00:00:00.000Z",
          tasks: [],
        },
      ],
    };
    const client = fakeClient([proyecto]);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.tabla.map((fila) => fila.id)).toEqual(["baseline-ok"]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("p3"),
    );
  });

  test("una línea base sin tasks no se rompe: se copia con una lista de tareas vacía", async () => {
    const proyecto = {
      id: "p4",
      baselines: [
        {
          id: "baseline-sin-tareas",
          name: "Sin tareas",
          createdAt: "2026-01-05T00:00:00.000Z",
        },
      ],
    };
    const client = fakeClient([proyecto]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.tabla).toHaveLength(1);
    expect(JSON.parse(client.tabla[0].tasks)).toEqual([]);
  });

  test("una línea base con fecha inválida se salta sin tumbar la migración, avisando por consola", async () => {
    const proyecto = {
      id: "p5",
      baselines: [
        {
          id: "baseline-fecha-mala",
          name: "Fecha inválida",
          createdAt: "no-es-una-fecha",
          tasks: [],
        },
        {
          id: "baseline-ok",
          name: "Correcta",
          createdAt: "2026-01-05T00:00:00.000Z",
          tasks: [],
        },
      ],
    };
    const client = fakeClient([proyecto]);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.tabla.map((fila) => fila.id)).toEqual(["baseline-ok"]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("baseline-fecha-mala"),
    );
  });

  test("una línea base sin name se copia con un relleno legible, no se pierde", async () => {
    const proyecto = {
      id: "p6",
      baselines: [
        {
          id: "baseline-sin-nombre",
          createdAt: "2026-01-05T00:00:00.000Z",
          tasks: [],
        },
      ],
    };
    const client = fakeClient([proyecto]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.tabla).toHaveLength(1);
    expect(client.tabla[0].name).toBe("Línea base sin nombre");
  });
});
