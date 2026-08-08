import {
  createObservation,
  observationBadgeFor,
  observationsToCsv,
  observationsToLpsCsv,
  toggleObservationStatus,
  type Observation,
} from "./observations";

function obs(overrides: Partial<Observation> = {}): Observation {
  return {
    id: "obs-1",
    taskId: 12,
    taskName: "EXCAVACIÓN A COTA 2110",
    wbs: "1.2.1",
    text: "Revisar rendimiento de excavación",
    status: "pending",
    createdAt: "2026-08-05T10:00:00.000Z",
    ...overrides,
  };
}

describe("createObservation", () => {
  test("nace pendiente y con el texto recortado", () => {
    const created = createObservation({
      taskId: 3,
      taskName: "Losa",
      wbs: "1.3",
      text: "  falta acero  ",
      id: "obs-x",
      createdAt: "2026-08-05T10:00:00.000Z",
    });

    expect(created).toEqual(
      expect.objectContaining({ status: "pending", text: "falta acero", taskId: 3 }),
    );
  });

  test("rechaza texto vacío en vez de crear una observación fantasma", () => {
    expect(
      createObservation({
        taskId: 3,
        taskName: "Losa",
        text: "   ",
        id: "obs-x",
        createdAt: "2026-08-05T10:00:00.000Z",
      }),
    ).toBeNull();
  });
});

describe("observationBadgeFor (el momento firma)", () => {
  test("sin observaciones no hay distintivo", () => {
    expect(observationBadgeFor([], 12)).toBeNull();
  });

  test("con alguna pendiente el distintivo es de atención", () => {
    const badge = observationBadgeFor([obs()], 12);
    expect(badge).toEqual({ kind: "pending", count: 1 });
  });

  test("con todas atendidas el distintivo es de resuelto", () => {
    const badge = observationBadgeFor([obs({ status: "done" })], 12);
    expect(badge).toEqual({ kind: "done", count: 1 });
  });

  test("una pendiente entre varias atendidas manda: sigue siendo pendiente", () => {
    const badge = observationBadgeFor(
      [obs({ id: "a", status: "done" }), obs({ id: "b", status: "pending" })],
      12,
    );
    expect(badge).toEqual({ kind: "pending", count: 2 });
  });

  test("solo cuenta las observaciones de esa tarea", () => {
    expect(observationBadgeFor([obs({ taskId: 99 })], 12)).toBeNull();
  });
});

describe("toggleObservationStatus", () => {
  test("alterna pendiente y atendida sin mutar la lista", () => {
    const list = [obs()];
    const next = toggleObservationStatus(list, "obs-1");

    expect(next[0].status).toBe("done");
    expect(list[0].status).toBe("pending");
    expect(toggleObservationStatus(next, "obs-1")[0].status).toBe("pending");
  });

  test("ignora un id inexistente", () => {
    expect(toggleObservationStatus([obs()], "no-existe")[0].status).toBe("pending");
  });
});

describe("exportación", () => {
  test("el CSV lleva encabezados y escapa las comas del texto", () => {
    const csv = observationsToCsv([obs({ text: "Revisar acero, viga y losa" })]);
    const [header, row] = csv.split("\n");

    expect(header).toBe("ID Actividad,WBS,Tarea,Observación,Estado,Fecha");
    expect(row).toContain('"Revisar acero, viga y losa"');
    expect(row).toContain("Pendiente");
  });

  test("las comillas del texto se escapan duplicándolas", () => {
    const csv = observationsToCsv([obs({ text: 'dice "urgente"' })]);
    expect(csv).toContain('"dice ""urgente"""');
  });

  test("el CSV de Last Planner usa sus propias columnas de restricción", () => {
    const csv = observationsToLpsCsv([obs()]);
    expect(csv.split("\n")[0]).toBe(
      "Actividad,WBS,Restricción,Estado,Responsable,Fecha compromiso",
    );
  });
});
