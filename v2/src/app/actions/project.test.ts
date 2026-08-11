import type { MatrixPlan, MatrixTemplate } from "@/types/matrix";
import type { ProjectCalendar } from "@/types/calendar";

const query = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query, release }));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { connect },
}));

const getCurrentUser = jest.fn(async () => ({
  id: "user-1",
  email: "aia@example.com",
}));
const userHasPermission = jest.fn(async () => true);

jest.mock("@/lib/auth/session", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));

jest.mock("@/lib/auth/rbac", () => ({
  userHasPermission: (...args: unknown[]) => userHasPermission(...args),
}));

const ensureSchema = jest.fn(async () => {});
jest.mock('@/lib/db/ensureSchema', () => ({
  ensureSchema: () => ensureSchema(),
}));

const canAccessProject = jest.fn(async () => true);
const projectFilterFor = jest.fn(() => ({ where: "", params: [] as string[] }));
jest.mock("@/lib/auth/projectAccess", () => ({
  canAccessProject: (...args: unknown[]) => canAccessProject(...args),
  projectFilterFor: (...args: unknown[]) => projectFilterFor(...args),
}));

import {
  createMatrixPlanFromTemplate,
  deleteProject,
  loadProject,
  listProjects,
  listMatrixTemplates,
  saveProject,
  saveMatrixTemplate,
} from "./project";
import {
  EMPTY_DETECTION_DICTIONARY,
  rememberCorrection,
} from "@/lib/scheduling/detection/dictionary";

const template: MatrixTemplate = {
  id: "template-edificio",
  name: "Edificio",
  projectType: "Edificacion",
  scopeTree: [
    {
      id: "obra",
      name: "Obra",
      type: "Capítulo",
      children: [
        {
          id: "zapatas",
          name: "Zapatas",
          type: "Partida",
          defaultRecipeId: "concreto",
        },
      ],
    },
  ],
  areas: [
    {
      id: "torre-a",
      name: "Torre A",
      type: "Torre",
      children: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    },
  ],
  recipes: [
    {
      id: "concreto",
      name: "Concreto",
      activities: [
        {
          id: "formaleta",
          name: "Formaleta",
          productivityPerDay: 50,
          defaultQuantity: 100,
          unit: "m2",
        },
      ],
      dependencies: [],
    },
  ],
};

const calendar: ProjectCalendar = {
  timeZone: "America/Bogota",
  workDays: [1, 2, 3, 4, 5],
  startHour: "08:00",
  endHour: "17:00",
  hoursPerDay: 8,
  nonWorkingDays: [],
  dateOverrides: [],
};

const importedMatrixPlan: MatrixPlan = {
  id: "matrix-mpp-demo",
  name: "Demo importado - Programacion matricial",
  templateId: "mpp-import",
  startDate: "2026-01-01",
  scopeTree: [
    {
      id: "mpp-scope-1",
      name: "Actividad importada",
      type: "Tarea MPP",
    },
  ],
  areas: [
    {
      id: "mpp-cronograma-importado",
      name: "Cronograma importado",
      type: "MPP",
    },
  ],
  recipes: [
    {
      id: "recipe-1",
      name: "Actividad importada",
      activities: [
        {
          id: "activity-1",
          name: "Actividad importada",
          productivityPerDay: 1,
          defaultQuantity: 2,
          unit: "d",
        },
      ],
      dependencies: [],
    },
  ],
  cells: [
    {
      id: "cell-1",
      scopeId: "mpp-scope-1",
      areaId: "mpp-cronograma-importado",
      recipeId: "recipe-1",
      active: true,
      generatedTaskIds: [1],
      syncedTaskIds: [1],
      activityOverrides: [
        {
          activityId: "activity-1",
          name: "Actividad importada",
          quantity: 2,
          unit: "d",
          productivityPerDay: 1,
          sourceTaskId: 1,
          start: "2026-01-01T00:00:00.000Z",
          finish: "2026-01-02T00:00:00.000Z",
          duration: 2,
          progress: 35.25,
          percentComplete: 35.25,
          lastEditedAt: "2026-01-01T00:00:00.000Z",
          lastEditedFrom: "gantt",
        },
      ],
    },
  ],
};

// La sesión vuelve a estar puesta antes de cada test: si no, el primero que la
// quite para probar un rechazo se la deja quitada a todos los de abajo.
beforeEach(() => {
  getCurrentUser.mockResolvedValue({ id: "user-1", email: "aia@example.com" });
  userHasPermission.mockResolvedValue(true);
});

describe("matrix template actions", () => {
  beforeEach(() => {
    query.mockReset();
    release.mockClear();
    connect.mockClear();
  });

  test("saves and lists reusable matrix templates as JSONB", async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "template-edificio" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "template-edificio",
            name: "Edificio",
            project_type: "Edificacion",
            template_data: template,
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      });

    await expect(saveMatrixTemplate(template)).resolves.toEqual({
      success: true,
      id: "template-edificio",
    });
    await expect(listMatrixTemplates()).resolves.toEqual([
      {
        id: "template-edificio",
        name: "Edificio",
        projectType: "Edificacion",
        template,
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    expect(query.mock.calls[1][0]).toContain("INSERT INTO matrix_templates");
    expect(query.mock.calls[1][1][3]).toBe(JSON.stringify(template));
  });

  test("materializes a template into an independent project matrix plan", async () => {
    const plan = await createMatrixPlanFromTemplate({
      template,
      id: "matrix-from-template",
      name: "Proyecto desde plantilla",
      startDate: "2026-02-02",
    });

    expect(plan).toMatchObject({
      id: "matrix-from-template",
      name: "Proyecto desde plantilla",
      templateId: "template-edificio",
      startDate: "2026-02-02",
    });
    expect(plan).not.toBe(template);
    expect(plan.scopeTree).not.toBe(template.scopeTree);
    expect(plan.cells).toEqual([
      expect.objectContaining({
        scopeId: "zapatas",
        areaId: "piso-1",
        recipeId: "concreto",
        active: false,
      }),
    ]);
  });

  test("persists and reloads imported matrix plan links through project_data", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "project-1" }] });

    const saveResult = await saveProject({
      name: "Importado",
      tasks: [
        {
          id: 1,
          name: "Actividad importada",
          start: new Date("2026-01-01T00:00:00.000Z"),
          finish: new Date("2026-01-02T00:00:00.000Z"),
          duration: 2,
          progress: 35.25,
          percentComplete: 35.25,
          isCritical: false,
          isMilestone: false,
          isSummary: false,
          outlineLevel: 1,
          dependencies: [],
          wbs: "1",
          matrixSource: {
            matrixPlanId: "matrix-mpp-demo",
            scopeId: "mpp-scope-1",
            areaId: "mpp-cronograma-importado",
            cellId: "cell-1",
            recipeId: "recipe-1",
            activityId: "activity-1",
          },
        },
      ],
      resources: [],
      assignments: [],
      budgetItems: [],
      budgetMappings: [],
      baselines: [],
      calendar,
      matrixPlan: importedMatrixPlan,
      planningAuditEvents: [
        {
          id: "audit-1",
          kind: "taskEdit",
          summary: "Update duration on task 1",
          taskIds: [1],
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    const serializedProject = JSON.parse(query.mock.calls[0][1][1]);
    query.mockResolvedValueOnce({
      rows: [
        {
          name: "Importado",
          project_data: serializedProject,
        },
      ],
    });
    const loaded = await loadProject("project-1");

    expect(saveResult).toEqual({ success: true, id: "project-1" });
    // Por nombre y no por posición: entre el alta y la lectura se coló el
    // INSERT de `project_members` -quien crea un proyecto queda como miembro-,
    // y un test que cuenta llamadas se rompe con cualquier paso intermedio
    // legítimo. Lo que importa es que ambas consultas ocurrieron.
    const sqlEjecutado = query.mock.calls.map((c) => String(c[0]));
    expect(sqlEjecutado.some((q) => q.includes("INSERT INTO projects"))).toBe(true);
    expect(sqlEjecutado.some((q) => q.includes("SELECT name, project_data"))).toBe(true);
    expect(loaded?.matrixPlan).toEqual(importedMatrixPlan);
    expect(loaded?.planningAuditEvents).toEqual([
      {
        id: "audit-1",
        kind: "taskEdit",
        summary: "Update duration on task 1",
        taskIds: [1],
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    expect(loaded?.tasks[0]).toEqual(
      expect.objectContaining({
        id: 1,
        start: new Date("2026-01-01T00:00:00.000Z"),
        finish: new Date("2026-01-02T00:00:00.000Z"),
        matrixSource: expect.objectContaining({
          matrixPlanId: "matrix-mpp-demo",
          cellId: "cell-1",
        }),
      }),
    );
  });
});

describe("deleteProject", () => {
  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue({ rows: [] });
  });

  test("borra el proyecto y sus fotos en la misma transacción", async () => {
    const resultado = await deleteProject("project-1");

    expect(resultado).toEqual({ success: true });

    const llamadas = query.mock.calls.map((call) => String(call[0]));
    expect(llamadas).toEqual(
      expect.arrayContaining([
        "BEGIN",
        expect.stringContaining("DELETE FROM project_snapshots"),
        expect.stringContaining("DELETE FROM projects"),
        "COMMIT",
      ]),
    );
    // Las fotos se borran antes que el proyecto, dentro de la transacción.
    const indiceSnapshots = llamadas.findIndex((sql) =>
      sql.includes("DELETE FROM project_snapshots"),
    );
    const indiceProjects = llamadas.findIndex((sql) => sql.includes("DELETE FROM projects"));
    expect(indiceSnapshots).toBeGreaterThanOrEqual(0);
    expect(indiceSnapshots).toBeLessThan(indiceProjects);
  });

  test("si el borrado falla, hace ROLLBACK y no deja nada a medias", async () => {
    query.mockImplementation(async (text: string) => {
      if (text.includes("DELETE FROM projects")) {
        throw new Error("bloqueo de fila");
      }
      return { rows: [] };
    });

    const resultado = await deleteProject("project-1");

    expect(resultado.success).toBe(false);
    expect(resultado.error).toContain("bloqueo de fila");
    const llamadas = query.mock.calls.map((call) => String(call[0]));
    expect(llamadas).toContain("ROLLBACK");
    expect(llamadas).not.toContain("COMMIT");
  });
});

describe("ProjectData · el diccionario de correcciones viaja con el proyecto (R4)", () => {
  beforeEach(() => {
    query.mockReset();
  });

  function proyectoBase() {
    return {
      name: "Estación 16",
      tasks: [],
      resources: [],
      assignments: [],
      budgetItems: [],
      budgetMappings: [],
      baselines: [],
      calendar,
    };
  }

  test("una corrección guardada sobrevive al viaje de ida y vuelta", async () => {
    const dictionary = rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
      kind: "ubicacion",
      name: "Instalación de redes secas",
      value: "4",
      note: "Va en el piso 4, no en obra general",
      recordedAt: "2026-08-08T10:00:00.000Z",
    });

    query.mockResolvedValueOnce({ rows: [{ id: "project-1" }] });
    await saveProject({ ...proyectoBase(), detectionDictionary: dictionary });

    const serializado = JSON.parse(query.mock.calls[0][1][1]);
    expect(serializado.detectionDictionary.corrections).toHaveLength(1);
    expect(serializado.detectionDictionary.corrections[0].value).toBe("4");

    query.mockResolvedValueOnce({
      rows: [{ name: "Estación 16", project_data: serializado }],
    });
    const cargado = await loadProject("project-1");

    expect(cargado?.detectionDictionary).toEqual(dictionary);
  });

  test("un proyecto viejo sin diccionario se lee como diccionario vacío", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "project-2" }] });
    await saveProject(proyectoBase());

    const serializado = JSON.parse(query.mock.calls[0][1][1]);
    delete (serializado as { detectionDictionary?: unknown }).detectionDictionary;

    query.mockResolvedValueOnce({
      rows: [{ name: "Antiguo", project_data: serializado }],
    });
    const cargado = await loadProject("project-2");

    expect(cargado?.detectionDictionary).toEqual(EMPTY_DETECTION_DICTIONARY);
  });
});

/**
 * `loadProject` leía cualquier proyecto por su identificador, sin pedir nada.
 *
 * La página `/project/[id]` sí exige sesión y redirige al login, así que por
 * ahí no se colaba nadie. Pero una acción de servidor es una puerta propia, y
 * esta no tenía cerradura: la protección de este proyecto es página por página
 * y acción por acción —no hay `middleware.ts`—, y esta se quedó fuera de las
 * dos redes.
 *
 * E51 lo vuelve urgente: abre una ruta pública, y quien llega por ella ejecuta
 * código de la aplicación que puede invocar acciones de servidor. El acceso
 * compartido tendrá su propia entrada, que autoriza por token; esta se cierra.
 */
describe("loadProject exige sesión y permiso de lectura", () => {
  beforeEach(() => {
    query.mockReset();
    release.mockClear();
    connect.mockClear();
    query.mockResolvedValue({ rows: [] });
  });

  test("sin sesión no devuelve el proyecto, y no llega a consultar la base", async () => {
    getCurrentUser.mockResolvedValue(null as never);

    await expect(loadProject("project-1")).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  test("con sesión pero sin permiso de lectura, tampoco", async () => {
    userHasPermission.mockResolvedValue(false);

    await expect(loadProject("project-1")).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });
});

/**
 * El fallo más caro de la auditoría del 2026-08-10.
 *
 * `authorizeProjectAction` comprobaba el permiso **global** del rol y devolvía
 * un `userId` que **nunca llegaba a un `WHERE`**. El `UPDATE` de `saveProject`
 * filtraba solo por el id que mandaba el cliente, así que cualquier usuario con
 * rol `member` abría el proyecto de otro y el autoguardado le reemplazaba el
 * blob entero. Sin forjar nada y sin dejar rastro.
 */
describe("un proyecto tiene dueño: no se toca el de otro", () => {
  const proyectoAjeno = {
    id: "project-de-otro",
    name: "Torre 3",
    tasks: [],
    resources: [],
    assignments: [],
    budgetItems: [],
    budgetMappings: [],
    baselines: [],
    calendar,
  };

  beforeEach(() => {
    query.mockReset();
    release.mockClear();
    connect.mockClear();
    query.mockResolvedValue({ rows: [] });
    canAccessProject.mockResolvedValue(true);
  });

  test("quien no es miembro NO puede guardar encima, y no se toca la base", async () => {
    canAccessProject.mockResolvedValue(false);

    const resultado = await saveProject(proyectoAjeno);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toBeTruthy();
    // Lo que de verdad importa: el UPDATE no llegó a ejecutarse.
    const sql = query.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).not.toContain("UPDATE projects");
  });

  test("quien no es miembro NO puede leerlo", async () => {
    // La base SÍ tiene el proyecto: si no, este test pasaría en vacío —
    // devolvería null por no encontrarlo, no por rechazar al intruso.
    query.mockResolvedValue({
      rows: [{ name: "Torre 3", project_data: { tasks: [] } }],
      rowCount: 1,
    });
    canAccessProject.mockResolvedValue(false);

    await expect(loadProject("project-de-otro")).resolves.toBeNull();
  });

  test("quien no es miembro NO puede borrarlo", async () => {
    canAccessProject.mockResolvedValue(false);

    const resultado = await deleteProject("project-de-otro");

    expect(resultado.success).toBe(false);
    const sql = query.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).not.toContain("DELETE FROM projects");
  });

  test("el dueño sí puede guardar el suyo", async () => {
    canAccessProject.mockResolvedValue(true);
    query.mockResolvedValue({ rows: [{ id: "project-de-otro" }], rowCount: 1 });

    const resultado = await saveProject(proyectoAjeno);

    expect(resultado.success).toBe(true);
  });

  test("crear un proyecto te deja como miembro: si no, no podrías reabrirlo", async () => {
    query.mockResolvedValue({ rows: [{ id: "nuevo-1" }], rowCount: 1 });

    await saveProject({ ...proyectoAjeno, id: undefined });

    const sql = query.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).toContain("INSERT INTO project_members");
  });
});

describe("listProjects · la home solo enseña lo tuyo", () => {
  beforeEach(() => {
    query.mockReset();
    release.mockClear();
    query.mockResolvedValue({ rows: [] });
    projectFilterFor.mockReturnValue({
      where: "WHERE id::text IN (SELECT project_id FROM project_members WHERE user_id = $1)",
      params: ["user-1"],
    });
  });

  test("filtra por pertenencia en vez de traerlos todos", async () => {
    await listProjects();

    const [sql, params] = query.mock.calls[0];
    expect(String(sql)).toContain("project_members");
    expect(params).toEqual(["user-1"]);
  });

  test("al admin no le pone filtro", async () => {
    projectFilterFor.mockReturnValue({ where: "", params: [] });

    await listProjects();

    const [sql] = query.mock.calls[0];
    expect(String(sql)).not.toContain("project_members");
  });
});

/**
 * Punto 3 de la auditoría: dos pestañas se pisan, y un guardado a la nada dice
 * «Guardado».
 *
 * `saveProject` devolvía `{success:true}` sin mirar `rowCount`: si el proyecto
 * ya no existía, una tarde de trabajo se tiraba en silencio y ni siquiera
 * saltaba el aviso al cerrar la pestaña. Y sin control de versión, la pestaña B
 * reescribía el blob con su copia antigua y borraba lo de la A; ninguna se
 * enteraba y las dos decían «Guardado».
 */
describe("el guardado no miente", () => {
  const proyecto = {
    id: "project-1",
    name: "Torre 3",
    tasks: [],
    resources: [],
    assignments: [],
    budgetItems: [],
    budgetMappings: [],
    baselines: [],
    calendar,
  };

  beforeEach(() => {
    query.mockReset();
    release.mockClear();
    canAccessProject.mockResolvedValue(true);
  });

  test("si el UPDATE no tocó ninguna fila, NO dice que guardó", async () => {
    // El proyecto ya no existe: alguien lo borró mientras se editaba.
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    const resultado = await saveProject(proyecto);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toBeTruthy();
  });

  test("guarda contra la versión que se cargó, no a ciegas", async () => {
    query.mockResolvedValue({ rows: [{ version: 4 }], rowCount: 1 });

    await saveProject({ ...proyecto, version: 3 });

    const update = query.mock.calls.find((c) =>
      String(c[0]).includes("UPDATE projects"),
    );
    expect(String(update![0])).toContain("version = $");
    expect(update![1]).toContain(3);
  });

  test("si otra pestaña guardó antes, se rechaza y se explica", async () => {
    // El UPDATE con la versión vieja no encuentra fila que casar.
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    const resultado = await saveProject({ ...proyecto, version: 3 });

    expect(resultado.success).toBe(false);
    expect(resultado.error).toMatch(/otra|version|versión|recarga/i);
  });

  test("al guardar bien, devuelve la versión nueva para el siguiente guardado", async () => {
    query.mockResolvedValue({ rows: [{ version: 4 }], rowCount: 1 });

    const resultado = await saveProject({ ...proyecto, version: 3 });

    expect(resultado.success).toBe(true);
    expect(resultado.version).toBe(4);
  });
});

/**
 * El esquema tiene que estar puesto en el camino NORMAL, no por casualidad.
 *
 * `project.ts` consulta `version` y `project_members`, que solo existen si
 * corrieron las migraciones 004 y 005. Y las migraciones solo se disparaban
 * desde Cortes (`snapshots.ts`) y desde la subida sin cuenta
 * (`createSharedProject`). Ninguno de los dos está en el camino de abrir y
 * guardar un proyecto.
 *
 * En producción eso significa: la app arranca, alguien abre su proyecto y
 * guarda, y la consulta pide columnas que no existen. Solo se curaba si antes
 * alguien entraba a Cortes o subía un `.mpp` sin cuenta — por suerte.
 *
 * Es el mismo patrón del día: el `init-schema.sql` que nadie ejecuta, el
 * limpiador sin llamador, la caducidad sin disparador. Esta vez caía justo en
 * el paso a producción.
 */
describe("el esquema está garantizado al abrir y guardar", () => {
  beforeEach(() => {
    query.mockReset();
    release.mockClear();
    ensureSchema.mockClear();
    query.mockResolvedValue({ rows: [{ id: "p1", version: 2 }], rowCount: 1 });
  });

  test("guardar aplica las migraciones antes de tocar la base", async () => {
    await saveProject({
      id: "p1",
      name: "Torre 3",
      tasks: [],
      resources: [],
      assignments: [],
      budgetItems: [],
      budgetMappings: [],
      baselines: [],
      calendar,
    });

    expect(ensureSchema).toHaveBeenCalled();
  });

  test("abrir un proyecto también", async () => {
    await loadProject("p1");

    expect(ensureSchema).toHaveBeenCalled();
  });

  test("y listarlos", async () => {
    await listProjects();

    expect(ensureSchema).toHaveBeenCalled();
  });

  test("y borrarlos", async () => {
    await deleteProject("p1");

    expect(ensureSchema).toHaveBeenCalled();
  });

  test("no depende de que alguien haya pasado por Cortes antes", async () => {
    // Si este test tuviera que tocar `snapshots.ts` para pasar, el arreglo no
    // estaría: seguiría dependiendo de la suerte.
    await loadProject("p1");

    expect(ensureSchema).toHaveBeenCalled();
    const sql = query.mock.calls.map((c) => String(c[0])).join("\n");
    expect(sql).not.toContain("project_snapshots");
  });
});

/**
 * El rechazo por versión se distingue por un dato, no por su redacción.
 *
 * `GanttView` decidía si enseñar el botón de «Recargar» comprobando si el
 * mensaje contenía «Otra pestaña». Es decir: la interfaz leía el copy para
 * decidir qué hacer. Una corrección de redacción —lo más normal— habría hecho
 * desaparecer el botón, dejando al usuario reintentando algo que **nunca** puede
 * funcionar: el reintento manda la misma versión vieja y vuelve a chocar.
 */
describe("un rechazo por versión se puede reconocer sin leer el texto", () => {
  beforeEach(() => {
    query.mockReset();
    release.mockClear();
    ensureSchema.mockClear();
    canAccessProject.mockResolvedValue(true);
  });

  const proyecto = {
    id: "p1",
    version: 3,
    name: "Torre 3",
    tasks: [],
    resources: [],
    assignments: [],
    budgetItems: [],
    budgetMappings: [],
    baselines: [],
    calendar,
  };

  test("cuando otra pestaña se adelantó, se dice con un dato", async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    const resultado = await saveProject(proyecto);

    expect(resultado.success).toBe(false);
    expect(resultado.conflict).toBe(true);
  });

  test("y el proyecto que ya no existe NO es un conflicto: recargar no lo trae", async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });

    const resultado = await saveProject({ ...proyecto, version: undefined });

    expect(resultado.success).toBe(false);
    expect(resultado.conflict).toBeFalsy();
  });

  test("un guardado que sale bien no se marca como conflicto", async () => {
    query.mockResolvedValue({ rows: [{ version: 4 }], rowCount: 1 });

    const resultado = await saveProject(proyecto);

    expect(resultado.success).toBe(true);
    expect(resultado.conflict).toBeFalsy();
  });
});
