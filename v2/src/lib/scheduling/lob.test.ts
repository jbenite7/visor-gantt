import {
  computeLOBLayout,
  diagnoseLOB,
  generateAutomaticLOBFromTasks,
  generateLOBFromTasks,
} from "./lob";
import type { LOBActivity, LOBUnit } from "@/types/lob";
import type { GanttTask } from "@/components/gantt/types";
import type { MatrixPlan } from "@/types/matrix";
import type { ActivityMapping } from "./lob";

// ---------------------------------------------------------------------------
// computeLOBLayout
// ---------------------------------------------------------------------------

describe("computeLOBLayout", () => {
  // ---------------------------------------------------------------------------
  // 1. Empty input
  // ---------------------------------------------------------------------------
  it("returns empty lines and zero scales when no activities are given", () => {
    const result = computeLOBLayout([], []);

    expect(result.lines).toEqual([]);
    expect(result.totalUnits).toBe(0);
    expect(result.yScale.min).toBe(0);
    expect(result.yScale.max).toBe(0);
    // xScale should contain valid Dates
    expect(result.xScale.min).toBeInstanceOf(Date);
    expect(result.xScale.max).toBeInstanceOf(Date);
  });

  // ---------------------------------------------------------------------------
  // 2. Single activity with 3 units
  // ---------------------------------------------------------------------------
  it("produces one planned line with three points for three units", () => {
    const activity: LOBActivity = {
      id: "act-exc",
      name: "Excavation",
      taskIds: ["1"],
      plannedRate: 1,
      unitLabel: "Floor",
      plannedStart: new Date("2026-01-01"),
      plannedFinish: new Date("2026-01-15"),
    };

    const units: LOBUnit[] = [
      { activityId: "act-exc", unitIndex: 0, plannedDate: new Date("2026-01-01") },
      { activityId: "act-exc", unitIndex: 1, plannedDate: new Date("2026-01-05") },
      { activityId: "act-exc", unitIndex: 2, plannedDate: new Date("2026-01-10") },
    ];

    const result = computeLOBLayout([activity], units);

    // One planned line (no actual data)
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].activityId).toBe("act-exc");
    expect(result.lines[0].points).toHaveLength(3);
    expect(result.lines[0].isCritical).toBe(false);

    // Points sorted by unitIndex
    expect(result.lines[0].points[0].unitIndex).toBe(0);
    expect(result.lines[0].points[1].unitIndex).toBe(1);
    expect(result.lines[0].points[2].unitIndex).toBe(2);

    // yScale covers 0..2 (max unit index)
    expect(result.yScale.min).toBe(0);
    expect(result.yScale.max).toBe(2);
    expect(result.totalUnits).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // 3. Multiple activities
  // ---------------------------------------------------------------------------
  it("assigns different colors to different activities", () => {
    const actA: LOBActivity = {
      id: "act-a",
      name: "Structure",
      taskIds: ["1"],
      plannedRate: 1,
      unitLabel: "Piso",
      plannedStart: new Date("2026-01-01"),
      plannedFinish: new Date("2026-01-10"),
    };

    const actB: LOBActivity = {
      id: "act-b",
      name: "Finishing",
      taskIds: ["2"],
      plannedRate: 0.5,
      unitLabel: "Piso",
      plannedStart: new Date("2026-01-05"),
      plannedFinish: new Date("2026-01-15"),
    };

    const units: LOBUnit[] = [
      { activityId: "act-a", unitIndex: 0, plannedDate: new Date("2026-01-01") },
      { activityId: "act-a", unitIndex: 1, plannedDate: new Date("2026-01-05") },
      { activityId: "act-b", unitIndex: 0, plannedDate: new Date("2026-01-05") },
      { activityId: "act-b", unitIndex: 1, plannedDate: new Date("2026-01-10") },
    ];

    const result = computeLOBLayout([actA, actB], units);

    expect(result.lines).toHaveLength(2);

    // Verify lines are in activity order
    expect(result.lines[0].activityId).toBe("act-a");
    expect(result.lines[1].activityId).toBe("act-b");

    // Colors should differ (different indices in AIA palette)
    expect(result.lines[0].color).not.toBe(result.lines[1].color);

    // Each line should have 2 points (one per unit)
    expect(result.lines[0].points).toHaveLength(2);
    expect(result.lines[1].points).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // 4. Activity without unit data (synthetic points from activity dates)
  // ---------------------------------------------------------------------------
  it("creates synthetic planned points when no unit data exists", () => {
    const activity: LOBActivity = {
      id: "act-no-units",
      name: "Planning",
      taskIds: ["99"],
      plannedRate: 1,
      unitLabel: "Phase",
      plannedStart: new Date("2026-02-01"),
      plannedFinish: new Date("2026-02-10"),
    };

    const result = computeLOBLayout([activity], []);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].activityId).toBe("act-no-units");
    // Synthetic line uses 2 points (start at unit 0, finish at unit 1)
    expect(result.lines[0].points).toHaveLength(2);
    expect(result.lines[0].points[0].unitIndex).toBe(0);
    expect(result.lines[0].points[0].date).toEqual(new Date("2026-02-01"));
    expect(result.lines[0].points[1].unitIndex).toBe(1);
    expect(result.lines[0].points[1].date).toEqual(new Date("2026-02-10"));
  });

  // ---------------------------------------------------------------------------
  // 5. Actual dates produce actual line
  // ---------------------------------------------------------------------------
  it("adds an actual line when units have actualDate", () => {
    const activity: LOBActivity = {
      id: "act-actual",
      name: "Finishing",
      taskIds: ["1"],
      plannedRate: 1,
      unitLabel: "Floor",
      plannedStart: new Date("2026-01-01"),
      plannedFinish: new Date("2026-01-10"),
    };

    const units: LOBUnit[] = [
      { activityId: "act-actual", unitIndex: 0, plannedDate: new Date("2026-01-01"), actualDate: new Date("2026-01-02") },
      { activityId: "act-actual", unitIndex: 1, plannedDate: new Date("2026-01-05"), actualDate: new Date("2026-01-06") },
      { activityId: "act-actual", unitIndex: 2, plannedDate: new Date("2026-01-10") },
    ];

    const result = computeLOBLayout([activity], units);

    // 1 planned line + 1 actual line
    expect(result.lines).toHaveLength(2);

    const plannedLine = result.lines.find((l) => l.activityId === "act-actual")!;
    const actualLine = result.lines.find((l) => l.activityId === "act-actual-actual")!;

    expect(plannedLine).toBeDefined();
    expect(actualLine).toBeDefined();

    // Actual line has 2 points (only units 0 and 1 have actualDate)
    expect(actualLine.points).toHaveLength(2);
    expect(actualLine.points[0].unitIndex).toBe(0);
    expect(actualLine.points[0].date).toEqual(new Date("2026-01-02"));
    expect(actualLine.points[1].unitIndex).toBe(1);
    expect(actualLine.points[1].date).toEqual(new Date("2026-01-06"));

    // Actual > planned → deviation → isCritical
    expect(actualLine.isCritical).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateLOBFromTasks
// ---------------------------------------------------------------------------

describe("generateLOBFromTasks", () => {
  // ---------------------------------------------------------------------------
  // 0. Family classification exposed per mapping
  // ---------------------------------------------------------------------------
  it("cada actividad del LOB expone su familia y procedencia", () => {
    const baseTask = {
      duration: 5,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 2,
      dependencies: [],
    };
    const tasks: GanttTask[] = [
      { ...baseTask, id: 1, name: "Columnas piso 1", wbs: "1.1", start: new Date("2026-01-01"), finish: new Date("2026-01-05") },
      { ...baseTask, id: 2, name: "Columnas piso 2", wbs: "1.2", start: new Date("2026-01-06"), finish: new Date("2026-01-10") },
      { ...baseTask, id: 3, name: "Columnas piso 3", wbs: "1.3", start: new Date("2026-01-11"), finish: new Date("2026-01-15") },
    ];

    const activityMapping: ActivityMapping[] = [
      { activityName: "Columnas", taskIds: [1, 2, 3], unitLabel: "Piso" },
    ];

    const result = generateLOBFromTasks(tasks, activityMapping);

    const [first] = result.mappings;
    expect(first.family.family).toBe("Estructura");
    expect(first.family.matchedBy).toBeDefined();
    expect(first.family.confidence).toBeGreaterThan(0);
  });


  // ---------------------------------------------------------------------------
  // 6. Generate LOBActivity from tasks
  // ---------------------------------------------------------------------------
  it("creates LOBActivity with correct plannedStart/Finish from task dates", () => {
    const tasks: GanttTask[] = [
      {
        id: "T1",
        name: "Floor 1",
        start: new Date("2026-01-01"),
        finish: new Date("2026-01-05"),
        duration: 5,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
      {
        id: "T2",
        name: "Floor 2",
        start: new Date("2026-01-06"),
        finish: new Date("2026-01-10"),
        duration: 5,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
      {
        id: "T3",
        name: "Floor 3",
        start: new Date("2026-01-11"),
        finish: new Date("2026-01-15"),
        duration: 5,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
    ];

    const activityMapping: ActivityMapping[] = [
      { activityName: "Finishing", taskIds: ["T1", "T2", "T3"], unitLabel: "Floor" },
    ];

    const result = generateLOBFromTasks(tasks, activityMapping);

    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].id).toBe("lob-activity-0");
    expect(result.mappings[0].name).toBe("Finishing");
    expect(result.mappings[0].taskIds).toEqual(["T1", "T2", "T3"]);
    expect(result.mappings[0].unitLabel).toBe("Floor");
    // Earliest start across all tasks
    expect(result.mappings[0].plannedStart).toEqual(new Date("2026-01-01"));
    // Latest finish across all tasks
    expect(result.mappings[0].plannedFinish).toEqual(new Date("2026-01-15"));
    // Rate: 3 tasks / (14 days) = ~0.214
    expect(result.mappings[0].plannedRate).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // 7. Empty mapping yields empty result
  // ---------------------------------------------------------------------------
  it("returns empty array when activity mapping is empty", () => {
    const tasks: GanttTask[] = [];
    const result = generateLOBFromTasks(tasks, []);
    expect(result.mappings).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // 8. Unknown task IDs produce stub activity
  // ---------------------------------------------------------------------------
  it("creates a stub activity when no tasks match the mapping", () => {
    const tasks: GanttTask[] = [
      {
        id: "T1",
        name: "Real Task",
        start: new Date("2026-01-01"),
        finish: new Date("2026-01-05"),
        duration: 5,
        progress: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 1,
        dependencies: [],
      },
    ];

    const activityMapping: ActivityMapping[] = [
      { activityName: "Ghost", taskIds: ["UNKNOWN"], unitLabel: "Floor" },
    ];

    const result = generateLOBFromTasks(tasks, activityMapping);

    expect(result.mappings).toHaveLength(1);
    expect(result.mappings[0].name).toBe("Ghost");
    expect(result.mappings[0].plannedRate).toBe(1);
    // Stub: plannedStart and plannedFinish should be the same (today)
    expect(result.mappings[0].plannedStart).toEqual(result.mappings[0].plannedFinish);
  });
});

describe("diagnoseLOB", () => {
  it("detects delayed actual progress and uneven production rhythm", () => {
    const activities: LOBActivity[] = [
      {
        id: "act-a",
        name: "Estructura",
        taskIds: [1, 2, 3],
        plannedRate: 1,
        unitLabel: "Piso",
        plannedStart: new Date("2026-01-01"),
        plannedFinish: new Date("2026-01-10"),
      },
    ];
    const units: LOBUnit[] = [
      {
        activityId: "act-a",
        unitIndex: 0,
        plannedDate: new Date("2026-01-01"),
        actualDate: new Date("2026-01-01"),
      },
      {
        activityId: "act-a",
        unitIndex: 1,
        plannedDate: new Date("2026-01-02"),
        actualDate: new Date("2026-01-05"),
      },
      {
        activityId: "act-a",
        unitIndex: 2,
        plannedDate: new Date("2026-01-10"),
      },
    ];

    const diagnostics = diagnoseLOB(activities, units);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "delayedActual", severity: "high" }),
        expect.objectContaining({ kind: "unevenRhythm", severity: "medium" }),
      ]),
    );
  });

  it("detects line interference when activity order crosses between units", () => {
    const activities: LOBActivity[] = [
      {
        id: "act-a",
        name: "Cimbra",
        taskIds: [1, 2],
        plannedRate: 1,
        unitLabel: "Piso",
        plannedStart: new Date("2026-01-01"),
        plannedFinish: new Date("2026-01-10"),
      },
      {
        id: "act-b",
        name: "Acero",
        taskIds: [3, 4],
        plannedRate: 1,
        unitLabel: "Piso",
        plannedStart: new Date("2026-01-02"),
        plannedFinish: new Date("2026-01-08"),
      },
    ];
    const units: LOBUnit[] = [
      { activityId: "act-a", unitIndex: 0, plannedDate: new Date("2026-01-01") },
      { activityId: "act-a", unitIndex: 1, plannedDate: new Date("2026-01-10") },
      { activityId: "act-b", unitIndex: 0, plannedDate: new Date("2026-01-05") },
      { activityId: "act-b", unitIndex: 1, plannedDate: new Date("2026-01-08") },
    ];

    const diagnostics = diagnoseLOB(activities, units);

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "lineInterference",
          severity: "high",
          activityIds: ["act-a", "act-b"],
        }),
      ]),
    );
  });
});

describe("generateAutomaticLOBFromTasks", () => {
  const summaryTask = (
    id: string,
    name: string,
    wbs: string,
    outlineLevel: number,
    start: string,
    finish: string,
  ): GanttTask => ({
    id,
    name,
    wbs,
    start: new Date(start),
    finish: new Date(finish),
    duration: 1,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: true,
    outlineLevel,
    dependencies: [],
  });

  it("detects repetitive floor activities from task names", () => {
    const baseTask = {
      duration: 3,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    };

    const result = generateAutomaticLOBFromTasks([
      {
        ...baseTask,
        id: 1,
        name: "Acero columnas N1",
        start: new Date("2026-08-01"),
        finish: new Date("2026-08-03"),
      },
      {
        ...baseTask,
        id: 2,
        name: "Acero columnas N2",
        start: new Date("2026-08-04"),
        finish: new Date("2026-08-06"),
      },
      {
        ...baseTask,
        id: 3,
        name: "Cimbra columnas N1",
        start: new Date("2026-08-02"),
        finish: new Date("2026-08-04"),
      },
      {
        ...baseTask,
        id: 4,
        name: "Cimbra columnas N2",
        start: new Date("2026-08-05"),
        finish: new Date("2026-08-07"),
      },
    ]);

    expect(result.detectedUnitLabel).toBe("Piso");
    expect(result.activities).toHaveLength(2);
    expect(result.activities.map((activity) => activity.name)).toEqual([
      "Acero Columnas",
      "Cimbra Columnas",
    ]);
    expect(result.units).toHaveLength(4);
  });

  it("no confunde el sótano 1 con el piso 1: los dos dan '1' en el texto crudo", () => {
    const baseTask = {
      duration: 3,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    };

    const result = generateAutomaticLOBFromTasks([
      {
        ...baseTask,
        id: 1,
        name: "Mampostería Sótano 2",
        start: new Date("2026-08-01"),
        finish: new Date("2026-08-03"),
      },
      {
        ...baseTask,
        id: 2,
        name: "Mampostería Piso 1",
        start: new Date("2026-08-04"),
        finish: new Date("2026-08-06"),
      },
      {
        ...baseTask,
        id: 3,
        name: "Mampostería Sótano 1",
        start: new Date("2026-08-02"),
        finish: new Date("2026-08-04"),
      },
    ]);

    expect(result.units).toHaveLength(3);
    expect(result.activities).toHaveLength(1);
    // El orden de abajo arriba: sótano 2, luego sótano 1, luego piso 1.
    expect(result.activities[0].taskIds).toEqual([1, 3, 2]);
  });

  it("no parte el decimal de un módulo: «1.1» y «2.1» son la misma actividad", () => {
    // El punto de «Módulo 1.1» es parte del número, no puntuación. Al
    // convertirlo en espacio, «Losa aérea Módulo 1.2» se separaba de «Losa
    // aérea Módulo 1.1» y arrastraba el «2» al nombre de la actividad.
    const baseTask = {
      duration: 2,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 1,
      dependencies: [],
    };

    const result = generateAutomaticLOBFromTasks([
      {
        ...baseTask,
        id: 1,
        name: "Losa aérea Módulo 1.1",
        start: new Date("2026-08-01"),
        finish: new Date("2026-08-03"),
      },
      {
        ...baseTask,
        id: 2,
        name: "Losa aérea Módulo 1.2",
        start: new Date("2026-08-04"),
        finish: new Date("2026-08-06"),
      },
      {
        ...baseTask,
        id: 3,
        name: "Losa aérea Módulo 2.1",
        start: new Date("2026-08-07"),
        finish: new Date("2026-08-09"),
      },
    ]);

    // Una sola actividad —«Losa aérea»— con tres ubicaciones, no tres
    // actividades con una cada una.
    expect(result.activities).toHaveLength(1);
    expect(result.units).toHaveLength(3);
    expect(result.activities[0].taskIds).toEqual([1, 2, 3]);
  });

  it("uses matrix line-of-balance rhythm when generated tasks have collapsed dates", () => {
    const baseTask = {
      duration: 2,
      progress: 0,
      isCritical: false,
      isMilestone: false,
      isSummary: false,
      outlineLevel: 5,
      dependencies: [],
      start: new Date("2026-01-05"),
      finish: new Date("2026-01-06"),
      matrixSource: {
        matrixPlanId: "matrix-1",
        scopeId: "estructura",
        areaId: "piso-1",
        cellId: "cell-1",
        recipeId: "estructura-concreto",
        activityId: "formaleta",
      },
    } satisfies Partial<GanttTask>;
    const tasks: GanttTask[] = [
      {
        ...baseTask,
        id: "piso-1-formaleta",
        name: "Estructura - Formaleta - Piso 01",
        wbs: "1.1.1.1.1",
      },
      {
        ...baseTask,
        id: "piso-2-formaleta",
        name: "Estructura - Formaleta - Piso 02",
        wbs: "1.1.1.2.1",
        matrixSource: { ...baseTask.matrixSource, areaId: "piso-2", cellId: "cell-2" },
      },
      {
        ...baseTask,
        id: "piso-3-formaleta",
        name: "Estructura - Formaleta - Piso 03",
        wbs: "1.1.1.3.1",
        matrixSource: { ...baseTask.matrixSource, areaId: "piso-3", cellId: "cell-3" },
      },
    ];
    const matrixPlan = {
      id: "matrix-1",
      name: "Vivienda",
      startDate: "2026-01-05",
      scopeTree: [],
      areas: [],
      recipes: [
        {
          id: "estructura-concreto",
          name: "Estructura en concreto",
          activities: [],
          dependencies: [],
          lineOfBalance: { scopeType: "Piso", offsetDays: 2 },
        },
      ],
      cells: [],
    } satisfies MatrixPlan;

    const result = generateAutomaticLOBFromTasks(tasks, matrixPlan);
    const formaletaUnits = result.units.filter((unit) => unit.activityId === "auto-lob-0");

    expect(formaletaUnits.map((unit) => unit.plannedDate.toISOString().slice(0, 10))).toEqual([
      "2026-01-05",
      "2026-01-07",
      "2026-01-09",
    ]);
    expect(
      new Set(formaletaUnits.map((unit) => unit.plannedDate.getTime())).size,
    ).toBe(3);
  });

  it("detects repetitive activities from WBS hierarchy when explicit units are absent", () => {
    const tasks: GanttTask[] = [
      summaryTask("contracts", "CONTRATOS", "1.1", 2, "2026-03-01", "2026-03-05"),
      summaryTask("basements", "SÓTANOS", "1.2", 2, "2026-03-01", "2026-04-15"),
      summaryTask("apartments", "APARTAMENTOS Y CUBIERTA", "1.3", 2, "2026-04-01", "2026-05-15"),
      summaryTask("urbanism", "URBANISMO", "1.4", 2, "2026-05-01", "2026-06-15"),
      summaryTask("b-arch", "Arquitectura", "1.2.1", 3, "2026-03-01", "2026-03-10"),
      summaryTask("b-structure", "Estructura", "1.2.2", 3, "2026-03-11", "2026-03-20"),
      summaryTask("b-networks", "Redes", "1.2.3", 3, "2026-03-21", "2026-03-30"),
      summaryTask("a-arch", "Arquitectura", "1.3.1", 3, "2026-04-01", "2026-04-10"),
      summaryTask("a-structure", "Estructura", "1.3.2", 3, "2026-04-11", "2026-04-20"),
      summaryTask("a-networks", "Redes", "1.3.3", 3, "2026-04-21", "2026-04-30"),
      summaryTask("u-arch", "Arquitectura", "1.4.1", 3, "2026-05-01", "2026-05-10"),
      summaryTask("u-networks", "Redes", "1.4.2", 3, "2026-05-11", "2026-05-20"),
      summaryTask("u-unique", "Paisajismo", "1.4.3", 3, "2026-05-21", "2026-05-30"),
    ];

    const result = generateAutomaticLOBFromTasks(tasks);

    expect(result.detectedUnitLabel).toBe("Capítulo WBS");
    expect(result.activities.map((activity) => activity.name)).toEqual([
      "Arquitectura",
      "Estructura",
      "Redes",
    ]);
    expect(result.activities.find((activity) => activity.name === "Paisajismo")).toBeUndefined();
    expect(result.activities.find((activity) => activity.name === "Arquitectura")?.taskIds).toEqual([
      "b-arch",
      "a-arch",
      "u-arch",
    ]);

    const architectureUnits = result.units.filter((unit) => unit.activityId === "wbs-lob-0");
    expect(architectureUnits.map((unit) => unit.unitName)).toEqual([
      "SÓTANOS",
      "APARTAMENTOS Y CUBIERTA",
      "URBANISMO",
    ]);
    expect(architectureUnits.map((unit) => unit.unitIndex)).toEqual([0, 1, 2]);
  });

  // ---------------------------------------------------------------------------
  // Family classification via breadcrumb on the WBS-hierarchy path
  // ---------------------------------------------------------------------------
  it("classifies activities by family using the wbs breadcrumb (Piso 3 bajo Redes MEP)", () => {
    const tasks: GanttTask[] = [
      summaryTask("chapter", "Redes MEP", "1", 1, "2026-03-01", "2026-06-15"),
      summaryTask("tower-a", "Torre A", "1.1", 2, "2026-03-01", "2026-04-15"),
      summaryTask("tower-b", "Torre B", "1.2", 2, "2026-04-01", "2026-05-15"),
      summaryTask("a-piso3", "Piso 3", "1.1.1", 3, "2026-03-01", "2026-03-10"),
      summaryTask("b-piso3", "Piso 3", "1.2.1", 3, "2026-04-01", "2026-04-10"),
    ];

    const result = generateAutomaticLOBFromTasks(tasks);

    expect(result.activities).toHaveLength(1);
    const [activity] = result.activities;
    expect(activity.name).toBe("Piso 3");
    expect(activity.family?.family).toBe("Redes MEP");
    expect(activity.family?.matchedBy).toBe("breadcrumb");
    expect(activity.family?.confidence).toBeGreaterThan(0);
  });
});

describe("Línea de Balance · ubicación con el motor nuevo", () => {
  const hoja = (
    id: number,
    name: string,
    wbs: string,
    start: string,
    finish: string,
  ): GanttTask => ({
    id,
    name,
    wbs,
    start: new Date(start),
    finish: new Date(finish),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 3,
    dependencies: [],
  });

  const resumen = (id: number, name: string, wbs: string): GanttTask => ({
    ...hoja(id, name, wbs, "2026-01-05", "2026-01-09"),
    isSummary: true,
    outlineLevel: 2,
  });

  it("los sótanos entran en el análisis y se dibujan por debajo del piso 1", () => {
    const result = generateAutomaticLOBFromTasks([
      hoja(1, "Mampostería Sótano 2", "1.1", "2026-01-05", "2026-01-09"),
      hoja(2, "Mampostería Sótano 1", "1.2", "2026-01-12", "2026-01-16"),
      hoja(3, "Mampostería Piso 1", "1.3", "2026-01-19", "2026-01-23"),
      hoja(4, "Mampostería Cubierta", "1.4", "2026-01-26", "2026-01-30"),
    ]);

    expect(result.activities).toHaveLength(1);
    // De abajo arriba: sótano 2, sótano 1, piso 1, cubierta.
    expect(result.activities[0].taskIds).toEqual([1, 2, 3, 4]);
    expect(result.units.map((unit) => unit.unitIndex)).toEqual([0, 1, 2, 3]);
  });

  it("una hoja sin ubicación en su nombre hereda la del padre «SÓTANO n»", () => {
    // Es el caso de la mampostería y el aseo del archivo real: la hoja se
    // llama solo «MURO EN LADRILLO» y el piso lo pone la tarea padre.
    const result = generateAutomaticLOBFromTasks([
      resumen(1, "DA PORTO TORRE 3", "1"),
      resumen(2, "SÓTANO 2", "1.1"),
      resumen(3, "SÓTANO 1", "1.2"),
      hoja(4, "MURO EN LADRILLO", "1.1.1", "2026-01-05", "2026-01-09"),
      hoja(5, "MURO EN LADRILLO", "1.2.1", "2026-01-12", "2026-01-16"),
    ]);

    const muro = result.activities.find((activity) => activity.name === "Muro En Ladrillo");
    expect(muro).toBeDefined();
    expect(muro?.taskIds).toEqual([4, 5]);
    expect(muro?.unitLabel).toBe("Sótano");
  });
});
