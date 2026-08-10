import type { MigrationClient } from "@/lib/db/migrator";
import { migration002BaselinesAsSnapshots } from "./002_baselines_as_snapshots";

interface FilaInsertada {
  projectId: string;
  id: string;
  name: string;
  origin: string;
  capturedAt: string;
  tasks: string;
}

/** Cliente falso con un proyecto que ya tiene dos líneas base dentro del blob. */
function fakeClient(projectRows: Record<string, unknown>[]): MigrationClient & {
  insertadas: FilaInsertada[];
  borrados: string[];
  blobIntacto: () => boolean;
} {
  const insertadas: FilaInsertada[] = [];
  const borrados: string[] = [];
  let blobEscrito = false;

  return {
    insertadas,
    borrados,
    blobIntacto: () => !blobEscrito,
    async query(text: string, params?: unknown[]) {
      if (text.includes("SELECT id, project_data FROM projects")) {
        return { rows: projectRows };
      }
      if (text.includes("INSERT INTO project_snapshots")) {
        insertadas.push({
          projectId: String(params?.[0]),
          id: String(params?.[1]),
          name: String(params?.[2]),
          origin: "baseline",
          capturedAt: String(params?.[3]),
          tasks: String(params?.[4]),
        });
        return { rows: [] };
      }
      if (text.includes("DELETE FROM project_snapshots")) {
        borrados.push(text.trim());
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

/**
 * Cliente falso que sí respeta `ON CONFLICT (project_id, id) DO NOTHING`:
 * un `INSERT` con una clave `(project_id, id)` ya presente no agrega fila.
 * Es el único modo de probar de verdad que aplicar `up()` dos veces no
 * duplica nada: el fake del brief solo registra el texto del SQL, no simula
 * el conflicto.
 */
function fakeClientConDedupeReal(
  projectRows: Record<string, unknown>[],
): MigrationClient & { insertadas: FilaInsertada[] } {
  const insertadas: FilaInsertada[] = [];
  const clavesExistentes = new Set<string>();

  return {
    insertadas,
    async query(text: string, params?: unknown[]) {
      if (text.includes("SELECT id, project_data FROM projects")) {
        return { rows: projectRows };
      }
      if (text.includes("INSERT INTO project_snapshots")) {
        const projectId = String(params?.[0]);
        const id = String(params?.[1]);
        const clave = `${projectId}::${id}`;
        const tieneOnConflict = text.includes(
          "ON CONFLICT (project_id, id) DO NOTHING",
        );
        if (tieneOnConflict && clavesExistentes.has(clave)) {
          return { rows: [] };
        }
        clavesExistentes.add(clave);
        insertadas.push({
          projectId,
          id,
          name: String(params?.[2]),
          origin: "baseline",
          capturedAt: String(params?.[3]),
          tasks: String(params?.[4]),
        });
        return { rows: [] };
      }
      return { rows: [] };
    },
  };
}

function proyectoConDosLineasBase(): Record<string, unknown> {
  return {
    id: "p1",
    project_data: {
      name: "Estación 16",
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
    },
  };
}

describe("migración 002 · las líneas base pasan a ser fotos", () => {
  test("up copia cada línea base conservando su id", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.insertadas.map((fila) => fila.id)).toEqual([
      "baseline-1",
      "baseline-2",
    ]);
    expect(client.insertadas[0].projectId).toBe("p1");
    expect(client.insertadas[0].name).toBe("Contractual");
  });

  test("up traduce las tareas de la línea base al formato de foto", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(JSON.parse(client.insertadas[0].tasks)).toEqual([
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
    const client = fakeClientConDedupeReal([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.up(client);
    await migration002BaselinesAsSnapshots.up(client);

    expect(client.insertadas).toHaveLength(2);
    expect(client.insertadas.map((fila) => fila.id).sort()).toEqual([
      "baseline-1",
      "baseline-2",
    ]);
  });

  test("down borra solo lo que esta migración creó", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.down(client);

    expect(client.borrados).toHaveLength(1);
    expect(client.borrados[0]).toContain("WHERE origin = 'baseline'");
    expect(client.blobIntacto()).toBe(true);
  });

  test("ida y vuelta: tras up y down no queda ninguna foto de origen línea base, y el blob original sigue intacto", async () => {
    const client = fakeClient([proyectoConDosLineasBase()]);

    await migration002BaselinesAsSnapshots.up(client);
    await migration002BaselinesAsSnapshots.down(client);

    expect(client.insertadas.every((fila) => fila.origin === "baseline")).toBe(
      true,
    );
    expect(client.borrados[0]).toContain("DELETE FROM project_snapshots");
    expect(client.borrados[0]).toContain("WHERE origin = 'baseline'");
    expect(client.blobIntacto()).toBe(true);
  });

  test("un proyecto sin líneas base no se rompe: no inserta nada", async () => {
    const proyectoSinBaselines = {
      id: "p2",
      project_data: { name: "Sin líneas base" },
    };
    const client = fakeClient([proyectoSinBaselines]);

    await expect(
      migration002BaselinesAsSnapshots.up(client),
    ).resolves.not.toThrow();
    expect(client.insertadas).toHaveLength(0);
  });

  test("una línea base sin id se salta sin tumbar la migración; las demás sí se copian", async () => {
    const proyecto = {
      id: "p3",
      project_data: {
        baselines: [
          {
            // sin id
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
      },
    };
    const client = fakeClient([proyecto]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.insertadas.map((fila) => fila.id)).toEqual(["baseline-ok"]);
  });

  test("una línea base sin tasks no se rompe: se copia con una lista de tareas vacía", async () => {
    const proyecto = {
      id: "p4",
      project_data: {
        baselines: [
          {
            id: "baseline-sin-tareas",
            name: "Sin tareas",
            createdAt: "2026-01-05T00:00:00.000Z",
            // sin propiedad tasks
          },
        ],
      },
    };
    const client = fakeClient([proyecto]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.insertadas).toHaveLength(1);
    expect(JSON.parse(client.insertadas[0].tasks)).toEqual([]);
  });

  test("una línea base con fecha inválida se salta sin tumbar la migración", async () => {
    const proyecto = {
      id: "p5",
      project_data: {
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
      },
    };
    const client = fakeClient([proyecto]);

    await migration002BaselinesAsSnapshots.up(client);

    expect(client.insertadas.map((fila) => fila.id)).toEqual(["baseline-ok"]);
  });
});
