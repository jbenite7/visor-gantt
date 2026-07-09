import type { GanttTask } from "@/components/gantt/types";
import type { Baseline } from "@/types/baseline";
import type { Assignment, Resource } from "@/types/resource";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import { calculateMppFields, MPP_CALCULATION_ENGINE_VERSION } from "./mppCalculationEngine";

const start = new Date("2026-01-05T08:00:00.000Z");
const finish = new Date("2026-01-06T17:00:00.000Z");

function task(overrides: Partial<GanttTask> = {}): GanttTask {
  return {
    id: 1,
    name: "Actividad",
    start,
    finish,
    duration: 2,
    progress: 50,
    percentComplete: 50,
    isCritical: true,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("MPP calculation engine", () => {
  test("materializes schedule, baseline, work, cost and earned-value fields", () => {
    const resources: Resource[] = [
      {
        uid: 10,
        name: "Maestro obra",
        type: "work",
        rate: 100,
        availability: 100,
        group: "Campo",
        mppFields: {
          INITIALS: "MO",
        },
      },
    ];
    const assignments: Assignment[] = [
      { taskId: 1, resourceId: 10, units: 50, cost: 0 },
    ];
    const baselines: Baseline[] = [
      {
        id: "bl-1",
        name: "Baseline",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        tasks: [
          {
            taskId: 1,
            baselineStart: new Date("2026-01-05T08:00:00.000Z"),
            baselineFinish: new Date("2026-01-06T17:00:00.000Z"),
            baselineDuration: 2,
            baselineWork: 6,
            baselineCost: 800,
            baselineBudgetWork: 7,
            baselineBudgetCost: 900,
          },
        ],
      },
      {
        id: "bl-2",
        name: "Baseline 1",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        tasks: [
          {
            taskId: 1,
            baselineStart: new Date("2026-01-04T08:00:00.000Z"),
            baselineFinish: new Date("2026-01-06T17:00:00.000Z"),
            baselineDuration: 3,
            baselineWork: 9,
            baselineCost: 950,
            baselineBudgetWork: 10,
            baselineBudgetCost: 1000,
          },
        ],
      },
    ];

    const result = calculateMppFields({
      tasks: [task()],
      resources,
      assignments,
      baselines,
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:COST", fieldId: "COST", sourceKey: "COST", labelEn: "Cost", labelEs: "Costo", dataType: "currency", group: "cost", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:BUDGET_WORK", fieldId: "BUDGET_WORK", sourceKey: "BUDGET_WORK", labelEn: "Budget Work", labelEs: "Trabajo presupuestado", dataType: "duration", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: true },
        { key: "mpp:BUDGET_COST", fieldId: "BUDGET_COST", sourceKey: "BUDGET_COST", labelEn: "Budget Cost", labelEs: "Costo presupuestado", dataType: "currency", group: "cost", recordType: "task", isCustom: false, isCore: false, isEditable: true },
        { key: "mpp:BASELINE_0_ESTIMATED_START", fieldId: "BASELINE_0_ESTIMATED_START", sourceKey: "BASELINE_0_ESTIMATED_START", labelEn: "Baseline0 Estimated Start", labelEs: "Comienzo estimado de línea base 0", dataType: "date", group: "schedule", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:BASELINE_1_ESTIMATED_DURATION", fieldId: "BASELINE_1_ESTIMATED_DURATION", sourceKey: "BASELINE_1_ESTIMATED_DURATION", labelEn: "Baseline1 Estimated Duration", labelEs: "Duración estimada de línea base 1", dataType: "duration", group: "schedule", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:BCWP", fieldId: "BCWP", sourceKey: "BCWP", labelEn: "BCWP", labelEs: "BCWP", dataType: "currency", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
      mppResourceColumns: [
        { key: "mpp:resource:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
      mppAssignmentColumns: [
        { key: "mpp:assignment:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    const fields = result.tasks[0].mppFields!;
    expect(fields.START).toBe(start.toISOString());
    expect(fields.FINISH).toBe(finish.toISOString());
    expect(fields.DURATION).toBe(2);
    expect(fields.CRITICAL).toBe(true);
    expect(fields.WORK).toBe(8);
    expect(fields.COST).toBe(800);
    expect(fields.RESOURCE_NAMES).toBe("Maestro obra");
    expect(fields.RESOURCE_INITIALS).toBe("MO");
    expect(fields.RESOURCE_GROUP).toBe("Campo");
    expect(fields.RESOURCE_TYPE).toBe("work");
    expect(fields.ACTUAL_COST).toBe(400);
    expect(fields.BASELINE_COST).toBe(800);
    expect(fields.BASELINE_WORK).toBe(6);
    expect(fields.BASELINE_BUDGET_WORK).toBe(7);
    expect(fields.BASELINE_BUDGET_COST).toBe(900);
    expect(fields.BASELINE_0_WORK).toBe(6);
    expect(fields.BASELINE_0_BUDGET_COST).toBe(900);
    expect(fields.BASELINE_0_ESTIMATED_START).toBe("2026-01-05T08:00:00.000Z");
    expect(fields.BASELINE_0_ESTIMATED_FINISH).toBe("2026-01-06T17:00:00.000Z");
    expect(fields.BASELINE_0_ESTIMATED_DURATION).toBe(2);
    expect(fields.BASELINE_1_WORK).toBe(9);
    expect(fields.BASELINE_1_BUDGET_WORK).toBe(10);
    expect(fields.BASELINE_1_BUDGET_COST).toBe(1000);
    expect(fields.BASELINE_1_ESTIMATED_START).toBe("2026-01-04T08:00:00.000Z");
    expect(fields.BASELINE_1_ESTIMATED_FINISH).toBe("2026-01-06T17:00:00.000Z");
    expect(fields.BASELINE_1_ESTIMATED_DURATION).toBe(3);
    expect(fields.WORK_VARIANCE).toBe(2);
    expect(fields.BCWS).toBe(800);
    expect(fields.BCWP).toBe(400);
    expect(fields.ACWP).toBe(400);
    expect(fields.CPI).toBe(1);
    expect(fields.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ value: 4, cumulative: 4 }),
      expect.objectContaining({ value: 4, cumulative: 8 }),
    ]);
    expect(result.resources[0].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ value: 4, cumulative: 4 }),
      expect.objectContaining({ value: 4, cumulative: 8 }),
    ]);
    expect(result.assignments[0].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ value: 4, cumulative: 4 }),
      expect.objectContaining({ value: 4, cumulative: 8 }),
    ]);
    expect(fields.__calculationEngineVersion).toBe(MPP_CALCULATION_ENGINE_VERSION);
    expect(result.mppTaskColumns.find((column) => column.fieldId === "BCWP")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "earnedValue",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "BUDGET_WORK")).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "baseline",
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "BUDGET_COST")).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "baseline",
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "BASELINE_1_ESTIMATED_DURATION")).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "baseline",
          dependencies: ["BASELINES", "SCHEDULED_VALUES"],
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
  });

  test("enriches resource and assignment calculated columns from the calculated-field catalog", () => {
    const result = calculateMppFields({
      tasks: [task()],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 50, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppResourceColumns: [
        { key: "mpp:resource:WORK", fieldId: "WORK", sourceKey: "WORK", labelEn: "Work", labelEs: "Trabajo", dataType: "duration", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:resource:STANDARD_RATE", fieldId: "STANDARD_RATE", sourceKey: "STANDARD_RATE", labelEn: "Standard Rate", labelEs: "Tarifa estándar", dataType: "currency", group: "cost", recordType: "resource", isCustom: false, isCore: false, isEditable: true },
        { key: "mpp:resource:BUDGET_WORK", fieldId: "BUDGET_WORK", sourceKey: "BUDGET_WORK", labelEn: "Budget Work", labelEs: "Trabajo presupuestado", dataType: "duration", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: true },
      ],
      mppAssignmentColumns: [
        { key: "mpp:assignment:ACTUAL_WORK", fieldId: "ACTUAL_WORK", sourceKey: "ACTUAL_WORK", labelEn: "Actual Work", labelEs: "Trabajo real", dataType: "duration", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:BUDGET_COST", fieldId: "BUDGET_COST", sourceKey: "BUDGET_COST", labelEn: "Budget Cost", labelEs: "Costo presupuestado", dataType: "currency", group: "cost", recordType: "assignment", isCustom: false, isCore: false, isEditable: true },
      ],
    });

    expect(result.mppResourceColumns.find((column) => column.fieldId === "WORK")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "work",
        dependencies: ["ASSIGNMENTS", "TASKS", "RESOURCE_CALENDAR"],
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
    expect(result.mppResourceColumns.find((column) => column.fieldId === "STANDARD_RATE")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "input",
        dependencies: [],
        isCalculated: false,
        sourceOfTruth: "user",
      }),
    );
    expect(result.mppResourceColumns.find((column) => column.fieldId === "BUDGET_WORK")).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "baseline",
          dependencies: ["BASELINE", "BUDGET_VALUES"],
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
    expect(result.mppAssignmentColumns.find((column) => column.fieldId === "ACTUAL_WORK")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "work",
        dependencies: ["ASSIGNMENT_UNITS", "TASK_DURATION", "PROGRESS", "RESOURCE_CALENDAR"],
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
    expect(result.mppAssignmentColumns.find((column) => column.fieldId === "BUDGET_COST")).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "baseline",
          dependencies: ["BASELINE", "BUDGET_VALUES"],
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
  });

  test("keeps Stop and Resume editable while marking them as calculated tracking fields", () => {
    const result = calculateMppFields({
      tasks: [task()],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:STOP", fieldId: "STOP", sourceKey: "STOP", labelEn: "Stop", labelEs: "Detener", dataType: "date", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: true },
        { key: "mpp:RESUME", fieldId: "RESUME", sourceKey: "RESUME", labelEn: "Resume", labelEs: "Reanudar", dataType: "date", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: true },
      ],
    });

    for (const fieldId of ["STOP", "RESUME"]) {
      expect(result.mppTaskColumns.find((column) => column.fieldId === fieldId)).toEqual(
        expect.objectContaining({
          isEditable: true,
          calculationSpec: expect.objectContaining({
            calculationKind: "tracking",
            isCalculated: true,
            isEditableWhenCalculated: true,
            sourceOfTruth: "engine",
          }),
        }),
      );
    }
  });

  test("preserves imported Actual Start and Actual Finish as editable tracking inputs", () => {
    const actualStart = "2026-01-06T08:00:00.000Z";
    const actualFinish = "2026-01-07T17:00:00.000Z";
    const result = calculateMppFields({
      tasks: [
        task({
          progress: 100,
          percentComplete: 100,
          mppFields: {
            ACTUAL_START: actualStart,
            ACTUAL_FINISH: actualFinish,
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:ACTUAL_START", fieldId: "ACTUAL_START", sourceKey: "ACTUAL_START", labelEn: "Actual Start", labelEs: "Comienzo real", dataType: "date", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: true },
        { key: "mpp:ACTUAL_FINISH", fieldId: "ACTUAL_FINISH", sourceKey: "ACTUAL_FINISH", labelEn: "Actual Finish", labelEs: "Fin real", dataType: "date", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: true },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        ACTUAL_START: actualStart,
        ACTUAL_FINISH: actualFinish,
      }),
    );
    for (const fieldId of ["ACTUAL_START", "ACTUAL_FINISH"]) {
      expect(result.mppTaskColumns.find((column) => column.fieldId === fieldId)).toEqual(
        expect.objectContaining({
          isEditable: true,
          calculationSpec: expect.objectContaining({
            calculationKind: "tracking",
            isCalculated: true,
            isEditableWhenCalculated: true,
          }),
        }),
      );
    }
  });

  test("uses imported Actual Duration to recalculate Remaining Duration", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-09T17:00:00.000Z"),
          duration: 5,
          progress: 20,
          percentComplete: 20,
          mppFields: {
            ACTUAL_DURATION: "PT24H0M0S",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:ACTUAL_DURATION", fieldId: "ACTUAL_DURATION", sourceKey: "ACTUAL_DURATION", labelEn: "Actual Duration", labelEs: "Duración real", dataType: "duration", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: true },
        { key: "mpp:REMAINING_DURATION", fieldId: "REMAINING_DURATION", sourceKey: "REMAINING_DURATION", labelEn: "Remaining Duration", labelEs: "Duración restante", dataType: "duration", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: true },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        PERCENT_COMPLETE: 60,
        ACTUAL_DURATION: 3,
        REMAINING_DURATION: 2,
      }),
    );
    for (const fieldId of ["ACTUAL_DURATION", "REMAINING_DURATION"]) {
      expect(result.mppTaskColumns.find((column) => column.fieldId === fieldId)).toEqual(
        expect.objectContaining({
          isEditable: true,
          calculationSpec: expect.objectContaining({
            calculationKind: "tracking",
            isCalculated: true,
            isEditableWhenCalculated: true,
          }),
        }),
      );
    }
  });

  test("expands Duration when imported Actual Duration is greater than scheduled Duration", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 2,
          progress: 50,
          percentComplete: 50,
          mppFields: {
            ACTUAL_DURATION: "PT24H0M0S",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].duration).toBe(3);
    expect(result.tasks[0].finish.toISOString()).toBe("2026-01-07T17:00:00.000Z");
    expect(result.tasks[0].progress).toBe(100);
    expect(result.tasks[0].percentComplete).toBe(100);
    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        DURATION: 3,
        FINISH: "2026-01-07T17:00:00.000Z",
        PERCENT_COMPLETE: 100,
        ACTUAL_DURATION: 3,
        REMAINING_DURATION: 0,
        ACTUAL_FINISH: "2026-01-07T17:00:00.000Z",
      }),
    );
  });

  test("uses imported Remaining Duration to recalculate Duration and Percent Complete", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-09T17:00:00.000Z"),
          duration: 5,
          progress: 20,
          percentComplete: 20,
          mppFields: {
            REMAINING_DURATION: "PT16H0M0S",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].duration).toBe(3);
    expect(result.tasks[0].progress).toBeCloseTo(100 / 3);
    expect(result.tasks[0].percentComplete).toBeCloseTo(100 / 3);
    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        DURATION: 3,
        ACTUAL_DURATION: 1,
        REMAINING_DURATION: 2,
      }),
    );
    expect(Number(result.tasks[0].mppFields?.PERCENT_COMPLETE)).toBeCloseTo(100 / 3);
  });

  test("uses imported Actual Work to recalculate Remaining Work and percent work complete", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          progress: 20,
          percentComplete: 20,
          mppFields: {
            WORK: "PT40H0M0S",
            ACTUAL_WORK: "PT16H0M0S",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:ACTUAL_WORK", fieldId: "ACTUAL_WORK", sourceKey: "ACTUAL_WORK", labelEn: "Actual Work", labelEs: "Trabajo real", dataType: "duration", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: true },
        { key: "mpp:REMAINING_WORK", fieldId: "REMAINING_WORK", sourceKey: "REMAINING_WORK", labelEn: "Remaining Work", labelEs: "Trabajo restante", dataType: "duration", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: true },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        WORK: 40,
        ACTUAL_WORK: 16,
        REMAINING_WORK: 24,
        PERCENT_WORK_COMPLETE: 40,
      }),
    );
    for (const fieldId of ["ACTUAL_WORK", "REMAINING_WORK"]) {
      expect(result.mppTaskColumns.find((column) => column.fieldId === fieldId)).toEqual(
        expect.objectContaining({
          isEditable: true,
          calculationSpec: expect.objectContaining({
            calculationKind: "work",
            isCalculated: true,
            isEditableWhenCalculated: true,
          }),
        }),
      );
    }
  });

  test("uses imported assignment Actual Work to recalculate task work progress", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          progress: 25,
          percentComplete: 25,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            ACTUAL_WORK: "PT8H0M0S",
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppAssignmentColumns: [
        { key: "mpp:assignment:ACTUAL_WORK", fieldId: "ACTUAL_WORK", sourceKey: "ACTUAL_WORK", labelEn: "Actual Work", labelEs: "Trabajo real", dataType: "duration", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:REMAINING_WORK", fieldId: "REMAINING_WORK", sourceKey: "REMAINING_WORK", labelEn: "Remaining Work", labelEs: "Trabajo restante", dataType: "duration", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        WORK: 16,
        ACTUAL_WORK: 8,
        REMAINING_WORK: 8,
        ACTUAL_COST: 800,
      }),
    );
    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        WORK: 16,
        ACTUAL_WORK: 8,
        REMAINING_WORK: 8,
        PERCENT_WORK_COMPLETE: 50,
      }),
    );
    for (const fieldId of ["ACTUAL_WORK", "REMAINING_WORK"]) {
      expect(result.mppAssignmentColumns.find((column) => column.fieldId === fieldId)).toEqual(
        expect.objectContaining({
          isEditable: true,
          calculationSpec: expect.objectContaining({
            calculationKind: "work",
            isCalculated: true,
            isEditableWhenCalculated: true,
          }),
        }),
      );
    }
  });

  test("uses imported assignment Work to derive units for Fixed Work tasks", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          duration: 2,
          progress: 50,
          percentComplete: 50,
          mppFields: {
            TYPE: "Fixed Work",
          },
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 0,
          cost: 0,
          mppFields: {
            WORK: "PT16H0M0S",
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:ASSIGNMENT_UNITS", fieldId: "ASSIGNMENT_UNITS", sourceKey: "ASSIGNMENT_UNITS", labelEn: "Assignment Units", labelEs: "Unidades de asignación", dataType: "number", group: "basic", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
      mppAssignmentColumns: [
        { key: "mpp:assignment:WORK", fieldId: "WORK", sourceKey: "WORK", labelEn: "Work", labelEs: "Trabajo", dataType: "duration", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:ASSIGNMENT_UNITS", fieldId: "ASSIGNMENT_UNITS", sourceKey: "ASSIGNMENT_UNITS", labelEn: "Assignment Units", labelEs: "Unidades de asignación", dataType: "number", group: "basic", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        WORK: 16,
        ASSIGNMENT_UNITS: 100,
        ACTUAL_WORK: 8,
        REMAINING_WORK: 8,
        COST: 1600,
      }),
    );
    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        TYPE: "Fixed Work",
        WORK: 16,
        ASSIGNMENT_UNITS: "100",
        PEAK: 100,
        ACTUAL_WORK: 8,
        REMAINING_WORK: 8,
        COST: 1600,
      }),
    );
  });

  test("uses units derived from imported assignment Work for overallocation and timephased allocation", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          duration: 2,
          progress: 0,
          percentComplete: 0,
          mppFields: {
            TYPE: "Fixed Work",
          },
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 0,
          cost: 0,
          mppFields: {
            WORK: "PT32H0M0S",
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppResourceColumns: [
        { key: "mpp:resource:TIMEPHASED_PERCENT_ALLOCATION", fieldId: "TIMEPHASED_PERCENT_ALLOCATION", sourceKey: "TIMEPHASED_PERCENT_ALLOCATION", labelEn: "% Allocation (Timephased)", labelEs: "% asignación (por fases temporales)", dataType: "number", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:resource:TIMEPHASED_PEAK_UNITS", fieldId: "TIMEPHASED_PEAK_UNITS", sourceKey: "TIMEPHASED_PEAK_UNITS", labelEn: "Peak Units (Timephased)", labelEs: "Unidades pico (por fases temporales)", dataType: "number", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
      mppAssignmentColumns: [
        { key: "mpp:assignment:TIMEPHASED_PEAK_UNITS", fieldId: "TIMEPHASED_PEAK_UNITS", sourceKey: "TIMEPHASED_PEAK_UNITS", labelEn: "Peak Units (Timephased)", labelEs: "Unidades pico (por fases temporales)", dataType: "number", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        ASSIGNMENT_UNITS: "200",
        OVERALLOCATED: true,
        PEAK: 200,
      }),
    );
    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        OVERALLOCATED: true,
        PEAK: 200,
      }),
    );
    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        ASSIGNMENT_UNITS: 200,
        OVERALLOCATED: true,
        PEAK: 200,
      }),
    );
    expect(result.resources[0].mppFields?.TIMEPHASED_PERCENT_ALLOCATION).toEqual([
      expect.objectContaining({ value: 200 }),
      expect.objectContaining({ value: 200 }),
    ]);
    expect(result.resources[0].mppFields?.TIMEPHASED_PEAK_UNITS).toEqual([
      expect.objectContaining({ value: 200 }),
      expect.objectContaining({ value: 200 }),
    ]);
    expect(result.assignments[0].mppFields?.TIMEPHASED_PEAK_UNITS).toEqual([
      expect.objectContaining({ value: 200 }),
      expect.objectContaining({ value: 200 }),
    ]);
  });

  test("materializes resource and assignment actual dates and percent work complete", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
          progress: 100,
          percentComplete: 100,
          dependencies: [],
        }),
        task({
          id: 2,
          name: "Actividad 2",
          start: new Date("2026-01-06T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 1,
          progress: 50,
          percentComplete: 50,
          dependencies: [],
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 100, cost: 0 },
        { taskId: 2, resourceId: 10, units: 100, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppResourceColumns: [
        { key: "mpp:resource:PERCENT_WORK_COMPLETE", fieldId: "PERCENT_WORK_COMPLETE", sourceKey: "PERCENT_WORK_COMPLETE", labelEn: "% Work Complete", labelEs: "% trabajo completado", dataType: "percentage", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:resource:ACTUAL_START", fieldId: "ACTUAL_START", sourceKey: "ACTUAL_START", labelEn: "Actual Start", labelEs: "Comienzo real", dataType: "date", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
      mppAssignmentColumns: [
        { key: "mpp:assignment:PERCENT_WORK_COMPLETE", fieldId: "PERCENT_WORK_COMPLETE", sourceKey: "PERCENT_WORK_COMPLETE", labelEn: "% Work Complete", labelEs: "% trabajo completado", dataType: "percentage", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:ACTUAL_DURATION", fieldId: "ACTUAL_DURATION", sourceKey: "ACTUAL_DURATION", labelEn: "Actual Duration", labelEs: "Duración real", dataType: "duration", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:REMAINING_DURATION", fieldId: "REMAINING_DURATION", sourceKey: "REMAINING_DURATION", labelEn: "Remaining Duration", labelEs: "Duración restante", dataType: "duration", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:ACTUAL_FINISH", fieldId: "ACTUAL_FINISH", sourceKey: "ACTUAL_FINISH", labelEn: "Actual Finish", labelEs: "Fin real", dataType: "date", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        ACTUAL_START: "2026-01-05T08:00:00.000Z",
        ACTUAL_FINISH: "2026-01-05T17:00:00.000Z",
        PERCENT_WORK_COMPLETE: 100,
        ACTUAL_DURATION: 1,
        REMAINING_DURATION: 0,
      }),
    );
    expect(result.assignments[1].mppFields).toEqual(
      expect.objectContaining({
        ACTUAL_START: "2026-01-06T08:00:00.000Z",
        PERCENT_WORK_COMPLETE: 50,
        ACTUAL_DURATION: 0.5,
        REMAINING_DURATION: 0.5,
      }),
    );
    expect(result.assignments[1].mppFields?.ACTUAL_FINISH).toBeUndefined();
    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        ACTUAL_START: "2026-01-05T08:00:00.000Z",
        PERCENT_WORK_COMPLETE: 75,
      }),
    );
    expect(result.resources[0].mppFields?.ACTUAL_FINISH).toBeUndefined();
    expect(result.mppResourceColumns.find((column) => column.fieldId === "PERCENT_WORK_COMPLETE")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "tracking",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
    expect(result.mppAssignmentColumns.find((column) => column.fieldId === "PERCENT_WORK_COMPLETE")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "tracking",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
    expect(result.mppAssignmentColumns.find((column) => column.fieldId === "ACTUAL_DURATION")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "tracking",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
  });

  test("materializes resource availability window fields from imported availability periods", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
          progress: 0,
          percentComplete: 0,
          dependencies: [],
        }),
      ],
      resources: [
        {
          uid: 10,
          name: "Oficial",
          type: "work",
          rate: 100,
          availability: 100,
          mppFields: {
            AVAILABILITY_PERIODS: [
              {
                availableFrom: "2026-01-01T00:00:00.000Z",
                availableTo: "2026-01-31T23:59:59.000Z",
                units: 100,
              },
              {
                availableFrom: "2026-02-01T00:00:00.000Z",
                availableTo: "2026-02-28T23:59:59.000Z",
                units: 50,
              },
            ],
          },
        },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 100, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppResourceColumns: [
        { key: "mpp:resource:AVAILABLE_FROM", fieldId: "AVAILABLE_FROM", sourceKey: "AVAILABLE_FROM", labelEn: "Available From", labelEs: "Disponible desde", dataType: "date", group: "resource", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:resource:AVAILABLE_TO", fieldId: "AVAILABLE_TO", sourceKey: "AVAILABLE_TO", labelEn: "Available To", labelEs: "Disponible hasta", dataType: "date", group: "resource", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        AVAILABLE_FROM: "2026-01-01T00:00:00.000Z",
        AVAILABLE_TO: "2026-02-28T23:59:59.000Z",
      }),
    );
    expect(result.mppResourceColumns.find((column) => column.fieldId === "AVAILABLE_FROM")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "constraint",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
    expect(result.mppResourceColumns.find((column) => column.fieldId === "AVAILABLE_TO")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "constraint",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
  });

  test("materializes assignment task and resource descriptor fields from linked records", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 7,
          name: "Instalar redes",
          wbs: "2.4.1",
          outlineLevel: 3,
          isCritical: true,
        }),
      ],
      resources: [
        {
          uid: 10,
          name: "Oficial",
          type: "work",
          rate: 100,
          availability: 100,
          group: "Campo",
          mppFields: {
            INITIALS: "OF",
          },
        },
      ],
      assignments: [
        { taskId: 7, resourceId: 10, units: 100, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppAssignmentColumns: [
        { key: "mpp:assignment:RESOURCE_INITIALS", fieldId: "RESOURCE_INITIALS", sourceKey: "RESOURCE_INITIALS", labelEn: "Resource Initials", labelEs: "Iniciales del recurso", dataType: "text", group: "resource", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:WBS", fieldId: "WBS", sourceKey: "WBS", labelEn: "WBS", labelEs: "EDT", dataType: "text", group: "outline", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        RESOURCE_INITIALS: "OF",
        RESOURCE_GROUP: "Campo",
        RESOURCE_TYPE: "work",
        WBS: "2.4.1",
        TASK_OUTLINE_NUMBER: "2.4.1",
        OUTLINE_LEVEL: 3,
        CRITICAL: true,
      }),
    );
    expect(result.mppAssignmentColumns.find((column) => column.fieldId === "RESOURCE_INITIALS")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "work",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
    expect(result.mppAssignmentColumns.find((column) => column.fieldId === "WBS")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "rollup",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
  });

  test("derives resource initials from the resource name when imported initials are missing", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 7,
          name: "Instalar redes",
          wbs: "2.4.1",
        }),
      ],
      resources: [
        {
          uid: 10,
          name: "Maestro Obra",
          type: "work",
          rate: 100,
          availability: 100,
        },
      ],
      assignments: [
        { taskId: 7, resourceId: 10, units: 100, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:RESOURCE_INITIALS", fieldId: "RESOURCE_INITIALS", sourceKey: "RESOURCE_INITIALS", labelEn: "Resource Initials", labelEs: "Iniciales del recurso", dataType: "text", group: "resource", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
      mppResourceColumns: [
        { key: "mpp:resource:INITIALS", fieldId: "INITIALS", sourceKey: "INITIALS", labelEn: "Initials", labelEs: "Iniciales", dataType: "text", group: "resource", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
      mppAssignmentColumns: [
        { key: "mpp:assignment:RESOURCE_INITIALS", fieldId: "RESOURCE_INITIALS", sourceKey: "RESOURCE_INITIALS", labelEn: "Resource Initials", labelEs: "Iniciales del recurso", dataType: "text", group: "resource", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        INITIALS: "MO",
      }),
    );
    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        RESOURCE_INITIALS: "MO",
      }),
    );
    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        RESOURCE_INITIALS: "MO",
      }),
    );
    expect(result.mppResourceColumns.find((column) => column.fieldId === "INITIALS")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "work",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
  });

  test("calculates Task Summary Name from the outline hierarchy for tasks and assignments", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 6,
          name: "Redes",
          wbs: "2.4",
          outlineLevel: 2,
          isSummary: true,
        }),
        task({
          id: 7,
          name: "Instalar redes",
          wbs: "2.4.1",
          outlineLevel: 3,
          isCritical: true,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 7, resourceId: 10, units: 100, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:TASK_SUMMARY_NAME", fieldId: "TASK_SUMMARY_NAME", sourceKey: "TASK_SUMMARY_NAME", labelEn: "Task Summary Name", labelEs: "Nombre de tarea resumen", dataType: "string", group: "basic", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
      mppAssignmentColumns: [
        { key: "mpp:assignment:TASK_SUMMARY_NAME", fieldId: "TASK_SUMMARY_NAME", sourceKey: "TASK_SUMMARY_NAME", labelEn: "Task Summary Name", labelEs: "Nombre de tarea resumen", dataType: "string", group: "basic", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks.find((item) => item.id === 7)?.mppFields).toEqual(
      expect.objectContaining({
        TASK_SUMMARY_NAME: "Redes",
      }),
    );
    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        TASK_SUMMARY_NAME: "Redes",
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "TASK_SUMMARY_NAME")).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "rollup",
          dependencies: ["TASK_OUTLINE", "SUMMARY_CHILDREN"],
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
    expect(result.mppAssignmentColumns.find((column) => column.fieldId === "TASK_SUMMARY_NAME")).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "rollup",
          dependencies: ["ASSIGNMENT_TASK", "TASK_OUTLINE"],
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
  });

  test("uses imported assignment Remaining Work to derive actual work", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          progress: 25,
          percentComplete: 25,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            REMAINING_WORK: "PT4H0M0S",
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        WORK: 16,
        ACTUAL_WORK: 12,
        REMAINING_WORK: 4,
        ACTUAL_COST: 1200,
      }),
    );
    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        WORK: 16,
        ACTUAL_WORK: 12,
        REMAINING_WORK: 4,
        PERCENT_WORK_COMPLETE: 75,
      }),
    );
  });

  test("uses assignment start and finish to calculate delay and timephased work", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-07T17:00:00.000Z"),
          duration: 3,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            START: "2026-01-06T08:00:00.000Z",
            FINISH: "2026-01-07T17:00:00.000Z",
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppAssignmentColumns: [
        { key: "mpp:assignment:START", fieldId: "START", sourceKey: "START", labelEn: "Start", labelEs: "Comienzo", dataType: "date", group: "schedule", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:FINISH", fieldId: "FINISH", sourceKey: "FINISH", labelEn: "Finish", labelEs: "Fin", dataType: "date", group: "schedule", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:ASSIGNMENT_DELAY", fieldId: "ASSIGNMENT_DELAY", sourceKey: "ASSIGNMENT_DELAY", labelEn: "Assignment Delay", labelEs: "Retraso de asignación", dataType: "duration", group: "schedule", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        START: "2026-01-06T08:00:00.000Z",
        FINISH: "2026-01-07T17:00:00.000Z",
        ASSIGNMENT_DELAY: 1,
        WORK: 16,
      }),
    );
    expect(result.assignments[0].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 8, cumulative: 8 }),
      expect.objectContaining({ start: "2026-01-07T00:00:00.000Z", value: 8, cumulative: 16 }),
    ]);
    expect(result.mppAssignmentColumns.find((column) => column.fieldId === "ASSIGNMENT_DELAY")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "schedule",
        isCalculated: true,
      }),
    );
  });

  test("uses assignment windows to calculate resource start, finish and timephased work", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-07T17:00:00.000Z"),
          duration: 3,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            START: "2026-01-06T08:00:00.000Z",
            FINISH: "2026-01-07T17:00:00.000Z",
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppResourceColumns: [
        { key: "mpp:resource:START", fieldId: "START", sourceKey: "START", labelEn: "Start", labelEs: "Comienzo", dataType: "date", group: "schedule", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:resource:FINISH", fieldId: "FINISH", sourceKey: "FINISH", labelEn: "Finish", labelEs: "Fin", dataType: "date", group: "schedule", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:resource:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        START: "2026-01-06T08:00:00.000Z",
        FINISH: "2026-01-07T17:00:00.000Z",
        WORK: 16,
      }),
    );
    expect(result.resources[0].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 8, cumulative: 8 }),
      expect.objectContaining({ start: "2026-01-07T00:00:00.000Z", value: 8, cumulative: 16 }),
    ]);
  });

  test("sums resource timephased work from non-contiguous assignment windows", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
        }),
        task({
          id: 2,
          start: new Date("2026-01-07T08:00:00.000Z"),
          finish: new Date("2026-01-07T17:00:00.000Z"),
          duration: 1,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            START: "2026-01-05T08:00:00.000Z",
            FINISH: "2026-01-05T17:00:00.000Z",
          },
        },
        {
          taskId: 2,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            START: "2026-01-07T08:00:00.000Z",
            FINISH: "2026-01-07T17:00:00.000Z",
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppResourceColumns: [
        { key: "mpp:resource:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        START: "2026-01-05T08:00:00.000Z",
        FINISH: "2026-01-07T17:00:00.000Z",
        WORK: 16,
      }),
    );
    expect(result.resources[0].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 8, cumulative: 8 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 0, cumulative: 8 }),
      expect.objectContaining({ start: "2026-01-07T00:00:00.000Z", value: 8, cumulative: 16 }),
    ]);
  });

  test("calculates resource timephased allocation and remaining availability by bucket", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
        }),
        task({
          id: 2,
          start: new Date("2026-01-06T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 1,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 50, cost: 0 },
        { taskId: 2, resourceId: 10, units: 120, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppResourceColumns: [
        { key: "mpp:resource:TIMEPHASED_PERCENT_ALLOCATION", fieldId: "TIMEPHASED_PERCENT_ALLOCATION", sourceKey: "TIMEPHASED_PERCENT_ALLOCATION", labelEn: "% Allocation (Timephased)", labelEs: "% asignación (por fases temporales)", dataType: "number", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:resource:TIMEPHASED_PEAK_UNITS", fieldId: "TIMEPHASED_PEAK_UNITS", sourceKey: "TIMEPHASED_PEAK_UNITS", labelEn: "Peak Units (Timephased)", labelEs: "Unidades pico (por fases temporales)", dataType: "number", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:resource:TIMEPHASED_REMAINING_AVAILABILITY", fieldId: "TIMEPHASED_REMAINING_AVAILABILITY", sourceKey: "TIMEPHASED_REMAINING_AVAILABILITY", labelEn: "Remaining Availability (Timephased)", labelEs: "Disponibilidad restante (por fases temporales)", dataType: "number", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.resources[0].mppFields?.TIMEPHASED_PERCENT_ALLOCATION).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 50 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 120 }),
    ]);
    expect(result.resources[0].mppFields?.TIMEPHASED_PEAK_UNITS).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 50 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 120 }),
    ]);
    expect(result.resources[0].mppFields?.TIMEPHASED_REMAINING_AVAILABILITY).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 50 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: -20 }),
    ]);
  });

  test("calculates resource timephased unit and work availability by bucket", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 2,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 50 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 25, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppResourceColumns: [
        { key: "mpp:resource:TIMEPHASED_UNIT_AVAILABILITY", fieldId: "TIMEPHASED_UNIT_AVAILABILITY", sourceKey: "TIMEPHASED_UNIT_AVAILABILITY", labelEn: "Unit Availability (Timephased)", labelEs: "Disponibilidad de unidades (por fases temporales)", dataType: "number", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:resource:TIMEPHASED_WORK_AVAILABILITY", fieldId: "TIMEPHASED_WORK_AVAILABILITY", sourceKey: "TIMEPHASED_WORK_AVAILABILITY", labelEn: "Work Availability (Timephased)", labelEs: "Disponibilidad de trabajo (por fases temporales)", dataType: "duration", group: "tracking", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.resources[0].mppFields?.TIMEPHASED_UNIT_AVAILABILITY).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 50 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 50 }),
    ]);
    expect(result.resources[0].mppFields?.TIMEPHASED_WORK_AVAILABILITY).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 4 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 4 }),
    ]);
  });

  test("calculates assignment timephased peak units and remaining availability from resource load", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 2,
        }),
        task({
          id: 2,
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 60, cost: 0 },
        { taskId: 2, resourceId: 10, units: 50, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppAssignmentColumns: [
        { key: "mpp:assignment:TIMEPHASED_PERCENT_ALLOCATION", fieldId: "TIMEPHASED_PERCENT_ALLOCATION", sourceKey: "TIMEPHASED_PERCENT_ALLOCATION", labelEn: "% Allocation (Timephased)", labelEs: "% asignación (por fases temporales)", dataType: "number", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:TIMEPHASED_PEAK_UNITS", fieldId: "TIMEPHASED_PEAK_UNITS", sourceKey: "TIMEPHASED_PEAK_UNITS", labelEn: "Peak Units (Timephased)", labelEs: "Unidades pico (por fases temporales)", dataType: "number", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:TIMEPHASED_REMAINING_AVAILABILITY", fieldId: "TIMEPHASED_REMAINING_AVAILABILITY", sourceKey: "TIMEPHASED_REMAINING_AVAILABILITY", labelEn: "Remaining Availability (Timephased)", labelEs: "Disponibilidad restante (por fases temporales)", dataType: "number", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    const assignment = result.assignments.find((candidate) => String(candidate.taskId) === "1");
    expect(assignment?.mppFields?.TIMEPHASED_PERCENT_ALLOCATION).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 110 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 60 }),
    ]);
    expect(assignment?.mppFields?.TIMEPHASED_PEAK_UNITS).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 60 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 60 }),
    ]);
    expect(assignment?.mppFields?.TIMEPHASED_REMAINING_AVAILABILITY).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: -10 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 40 }),
    ]);
  });

  test("aggregates timephased work into weekly buckets when requested", () => {
    const input = {
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-18T17:00:00.000Z"),
          duration: 14,
          mppFields: {
            WORK: 140,
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "week",
      mppTaskColumns: [
        { key: "mpp:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:TIMEPHASED_CUMULATIVE_WORK", fieldId: "TIMEPHASED_CUMULATIVE_WORK", sourceKey: "TIMEPHASED_CUMULATIVE_WORK", labelEn: "Cumulative Work (Timephased)", labelEs: "Trabajo acumulado (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    } as Parameters<typeof calculateMppFields>[0] & { timephasedScale: "week" };

    const result = calculateMppFields(input);

    expect(result.tasks[0].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({
        start: "2026-01-05T00:00:00.000Z",
        finish: "2026-01-11T23:59:59.999Z",
        value: 70,
        cumulative: 70,
      }),
      expect.objectContaining({
        start: "2026-01-12T00:00:00.000Z",
        finish: "2026-01-18T23:59:59.999Z",
        value: 70,
        cumulative: 140,
      }),
    ]);
    expect(result.tasks[0].mppFields?.TIMEPHASED_CUMULATIVE_WORK).toEqual([
      expect.objectContaining({ value: 70, cumulative: 70 }),
      expect.objectContaining({ value: 140, cumulative: 140 }),
    ]);
  });

  test("maps standard Baseline1 timephased fields to numbered baseline totals", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 2,
          mppFields: {
            BASELINE_1_WORK: 16,
            BASELINE_1_COST: 800,
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppTaskColumns: [
        { key: "mpp:TIMEPHASED_BASELINE1_WORK", fieldId: "TIMEPHASED_BASELINE1_WORK", sourceKey: "TIMEPHASED_BASELINE1_WORK", labelEn: "Baseline1 Work (Timephased)", labelEs: "Trabajo de línea base 1 (por fases temporales)", dataType: "object", group: "baseline", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:TIMEPHASED_BASELINE1_COST", fieldId: "TIMEPHASED_BASELINE1_COST", sourceKey: "TIMEPHASED_BASELINE1_COST", labelEn: "Baseline1 Cost (Timephased)", labelEs: "Costo de línea base 1 (por fases temporales)", dataType: "object", group: "baseline", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks[0].mppFields?.TIMEPHASED_BASELINE1_WORK).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 8, cumulative: 8 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 8, cumulative: 16 }),
    ]);
    expect(result.tasks[0].mppFields?.TIMEPHASED_BASELINE1_COST).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 400, cumulative: 400 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 400, cumulative: 800 }),
    ]);
  });

  test("distinguishes timephased percent complete from cumulative percent complete", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-07T17:00:00.000Z"),
          duration: 3,
          progress: 60,
          percentComplete: 60,
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppTaskColumns: [
        { key: "mpp:TIMEPHASED_PERCENT_COMPLETE", fieldId: "TIMEPHASED_PERCENT_COMPLETE", sourceKey: "TIMEPHASED_PERCENT_COMPLETE", labelEn: "% Complete (Timephased)", labelEs: "% completado (por fases temporales)", dataType: "percentage", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:TIMEPHASED_CUMULATIVE_PERCENT_COMPLETE", fieldId: "TIMEPHASED_CUMULATIVE_PERCENT_COMPLETE", sourceKey: "TIMEPHASED_CUMULATIVE_PERCENT_COMPLETE", labelEn: "Cumulative % Complete (Timephased)", labelEs: "% completado acumulado (por fases temporales)", dataType: "percentage", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks[0].mppFields?.TIMEPHASED_PERCENT_COMPLETE).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 20, cumulative: 20 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 20, cumulative: 40 }),
      expect.objectContaining({ start: "2026-01-07T00:00:00.000Z", value: 20, cumulative: 60 }),
    ]);
    expect(result.tasks[0].mppFields?.TIMEPHASED_CUMULATIVE_PERCENT_COMPLETE).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 20, cumulative: 20 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 40, cumulative: 40 }),
      expect.objectContaining({ start: "2026-01-07T00:00:00.000Z", value: 60, cumulative: 60 }),
    ]);
  });

  test("calculates assignment timephased percent complete from the linked task progress", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-07T17:00:00.000Z"),
          duration: 3,
          progress: 60,
          percentComplete: 60,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 100, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppAssignmentColumns: [
        { key: "mpp:assignment:TIMEPHASED_PERCENT_COMPLETE", fieldId: "TIMEPHASED_PERCENT_COMPLETE", sourceKey: "TIMEPHASED_PERCENT_COMPLETE", labelEn: "% Complete (Timephased)", labelEs: "% completado (por fases temporales)", dataType: "percentage", group: "tracking", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        PERCENT_COMPLETE: 60,
      }),
    );
    expect(result.assignments[0].mppFields?.TIMEPHASED_PERCENT_COMPLETE).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 20, cumulative: 20 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 20, cumulative: 40 }),
      expect.objectContaining({ start: "2026-01-07T00:00:00.000Z", value: 20, cumulative: 60 }),
    ]);
  });

  test("aggregates timephased cost into monthly buckets when requested", () => {
    const input = {
      tasks: [
        task({
          start: new Date("2026-01-28T08:00:00.000Z"),
          finish: new Date("2026-02-03T17:00:00.000Z"),
          duration: 7,
          cost: 700,
          mppFields: {
            COST: 700,
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "month",
      mppTaskColumns: [
        { key: "mpp:TIMEPHASED_COST", fieldId: "TIMEPHASED_COST", sourceKey: "TIMEPHASED_COST", labelEn: "Cost (Timephased)", labelEs: "Costo (por fases temporales)", dataType: "object", group: "cost", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    } as Parameters<typeof calculateMppFields>[0] & { timephasedScale: "month" };

    const result = calculateMppFields(input);

    expect(result.tasks[0].mppFields?.TIMEPHASED_COST).toEqual([
      expect.objectContaining({
        start: "2026-01-28T00:00:00.000Z",
        finish: "2026-01-31T23:59:59.999Z",
        value: 466.6666666666667,
        cumulative: 466.6666666666667,
      }),
      expect.objectContaining({
        start: "2026-02-01T00:00:00.000Z",
        finish: "2026-02-03T23:59:59.999Z",
        value: 233.33333333333334,
        cumulative: 700,
      }),
    ]);
  });

  test("distributes timephased numeric values only across project working days", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-07T17:00:00.000Z"),
          duration: 3,
          mppFields: {
            WORK: 16,
          },
        }),
      ],
      calendar: {
        ...DEFAULT_PROJECT_CALENDAR,
        nonWorkingDays: [
          { id: "holiday", date: "2026-01-06", name: "No laboral" },
        ],
      },
      timephasedScale: "day",
      mppTaskColumns: [
        { key: "mpp:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:TIMEPHASED_CUMULATIVE_WORK", fieldId: "TIMEPHASED_CUMULATIVE_WORK", sourceKey: "TIMEPHASED_CUMULATIVE_WORK", labelEn: "Cumulative Work (Timephased)", labelEs: "Trabajo acumulado (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    } as Parameters<typeof calculateMppFields>[0] & { timephasedScale: "day" });

    expect(result.tasks[0].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: 8, cumulative: 8 }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: 0, cumulative: 8 }),
      expect.objectContaining({ start: "2026-01-07T00:00:00.000Z", value: 8, cumulative: 16 }),
    ]);
    expect(result.tasks[0].mppFields?.TIMEPHASED_CUMULATIVE_WORK).toEqual([
      expect.objectContaining({ value: 8, cumulative: 8 }),
      expect.objectContaining({ value: 8, cumulative: 8 }),
      expect.objectContaining({ value: 16, cumulative: 16 }),
    ]);
  });

  test("weights timephased values by working date override hours", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-09T08:00:00.000Z"),
          finish: new Date("2026-01-11T13:00:00.000Z"),
          duration: 2,
          mppFields: {
            WORK: 12,
          },
        }),
      ],
      calendar: {
        ...DEFAULT_PROJECT_CALENDAR,
        workDays: [1, 2, 3, 4, 5],
        dateOverrides: [
          {
            id: "sunday-work",
            date: "2026-01-11",
            name: "Media jornada especial",
            isWorking: true,
            hoursPerDay: 4,
          },
        ],
      },
      timephasedScale: "day",
      mppTaskColumns: [
        { key: "mpp:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    } as Parameters<typeof calculateMppFields>[0] & { timephasedScale: "day" });

    expect(result.tasks[0].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ start: "2026-01-09T00:00:00.000Z", value: 8, cumulative: 8 }),
      expect.objectContaining({ start: "2026-01-10T00:00:00.000Z", value: 0, cumulative: 8 }),
      expect.objectContaining({ start: "2026-01-11T00:00:00.000Z", value: 4, cumulative: 12 }),
    ]);
  });

  test("uses Work Contour to distribute timephased work across working days", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-07T17:00:00.000Z"),
          duration: 3,
          mppFields: {
            WORK: 60,
            WORK_CONTOUR: "Front Loaded",
          },
        }),
        task({
          id: 2,
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-07T17:00:00.000Z"),
          duration: 3,
          mppFields: {
            WORK: 60,
            WORK_CONTOUR: "Back Loaded",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppTaskColumns: [
        { key: "mpp:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    } as Parameters<typeof calculateMppFields>[0] & { timephasedScale: "day" });

    expect(result.tasks[0].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ value: 30, cumulative: 30 }),
      expect.objectContaining({ value: 20, cumulative: 50 }),
      expect.objectContaining({ value: 10, cumulative: 60 }),
    ]);
    expect(result.tasks[1].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ value: 10, cumulative: 10 }),
      expect.objectContaining({ value: 20, cumulative: 30 }),
      expect.objectContaining({ value: 30, cumulative: 60 }),
    ]);
  });

  test("calculates timephased remaining cumulative work and earned-value ratios by bucket", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 2,
          progress: 50,
          percentComplete: 50,
          mppFields: {
            WORK: 16,
            COST: 800,
          },
        }),
      ],
      baselines: [
        {
          id: "baseline",
          name: "Baseline",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          tasks: [
            {
              taskId: 1,
              baselineStart: new Date("2026-01-05T08:00:00.000Z"),
              baselineFinish: new Date("2026-01-06T17:00:00.000Z"),
              baselineDuration: 2,
              baselineWork: 16,
              baselineCost: 800,
            },
          ],
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppTaskColumns: [
        { key: "mpp:TIMEPHASED_WORK", fieldId: "TIMEPHASED_WORK", sourceKey: "TIMEPHASED_WORK", labelEn: "Work (Timephased)", labelEs: "Trabajo (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:TIMEPHASED_REMAINING_CUMULATIVE_WORK", fieldId: "TIMEPHASED_REMAINING_CUMULATIVE_WORK", sourceKey: "TIMEPHASED_REMAINING_CUMULATIVE_WORK", labelEn: "Remaining Cumulative Work (Timephased)", labelEs: "Trabajo acumulado restante (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:TIMEPHASED_SPI", fieldId: "TIMEPHASED_SPI", sourceKey: "TIMEPHASED_SPI", labelEn: "SPI (Timephased)", labelEs: "SPI (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:TIMEPHASED_CPI", fieldId: "TIMEPHASED_CPI", sourceKey: "TIMEPHASED_CPI", labelEn: "CPI (Timephased)", labelEs: "CPI (por fases temporales)", dataType: "object", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    } as Parameters<typeof calculateMppFields>[0] & { timephasedScale: "day" });

    expect(result.tasks[0].mppFields?.TIMEPHASED_WORK).toEqual([
      expect.objectContaining({ value: 8, cumulative: 8 }),
      expect.objectContaining({ value: 8, cumulative: 16 }),
    ]);
    expect(result.tasks[0].mppFields?.TIMEPHASED_REMAINING_CUMULATIVE_WORK).toEqual([
      expect.objectContaining({ value: 8, cumulative: 8 }),
      expect.objectContaining({ value: 0, cumulative: 16 }),
    ]);
    expect(result.tasks[0].mppFields?.TIMEPHASED_SPI).toEqual([
      expect.objectContaining({ value: 0.5, cumulative: 0.5 }),
      expect.objectContaining({ value: 0.5, cumulative: 0.5 }),
    ]);
    expect(result.tasks[0].mppFields?.TIMEPHASED_CPI).toEqual([
      expect.objectContaining({ value: 1, cumulative: 1 }),
      expect.objectContaining({ value: 1, cumulative: 1 }),
    ]);
  });

  test("materializes constraint and deadline fields from live task properties", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          isCritical: false,
          constraintType: "finishNoLaterThan",
          constraintDate: new Date("2026-01-06T17:00:00.000Z"),
          deadline: new Date("2026-01-05T17:00:00.000Z"),
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        CONSTRAINT_TYPE: "Finish No Later Than",
        CONSTRAINT_DATE: "2026-01-06T17:00:00.000Z",
        DEADLINE: "2026-01-05T17:00:00.000Z",
        PRELEVELED_START: "2026-01-05T08:00:00.000Z",
        PRELEVELED_FINISH: "2026-01-06T17:00:00.000Z",
        TOTAL_SLACK: -1,
        NEGATIVE_SLACK: -1,
        CRITICAL: true,
        STATUS: "Late",
        HEALTH: "At Risk",
      }),
    );
    expect(result.tasks[0].isCritical).toBe(true);
  });

  test("derives preleveled dates from imported Leveling Delay", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-07T08:00:00.000Z"),
          finish: new Date("2026-01-08T17:00:00.000Z"),
          duration: 2,
          mppFields: {
            LEVELING_DELAY: "PT16H0M0S",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        LEVELING_DELAY: 2,
        PRELEVELED_START: "2026-01-05T08:00:00.000Z",
        PRELEVELED_FINISH: "2026-01-06T17:00:00.000Z",
      }),
    );
  });

  test("materializes inactive tasks without active predecessor or successor links", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          name: "Inactiva",
          mppFields: { ACTIVE: false },
        }),
        task({
          id: 2,
          name: "Sucesora",
          dependencies: [{ from: 1, to: 2, type: "FS" }],
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        ACTIVE: false,
        SUCCESSORS: "",
        UNIQUE_ID_SUCCESSORS: "",
      }),
    );
    expect(result.tasks[1].mppFields).toEqual(
      expect.objectContaining({
        ACTIVE: true,
        PREDECESSORS: "",
        UNIQUE_ID_PREDECESSORS: "",
      }),
    );
  });

  test("uses imported Unique ID values for Unique ID predecessor and successor fields", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 101,
          name: "Predecesora",
          wbs: "1.1",
          dependencies: [],
          mppFields: { ID: 7, UNIQUE_ID: 101 },
        }),
        task({
          id: 205,
          name: "Sucesora",
          wbs: "1.2",
          dependencies: [{ from: 101, to: 205, type: "SS", lag: -1 }],
          mppFields: { ID: 8, UNIQUE_ID: 205 },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        ID: 7,
        SUCCESSORS: "8SS-1d",
        WBS_SUCCESSORS: "1.2",
        UNIQUE_ID_SUCCESSORS: "205",
      }),
    );
    expect(result.tasks[1].mppFields).toEqual(
      expect.objectContaining({
        ID: 8,
        PREDECESSORS: "7SS-1d",
        WBS_PREDECESSORS: "1.1",
        UNIQUE_ID_PREDECESSORS: "101",
      }),
    );
  });

  test("does not materialize internal string task ids as Unique ID values", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: "mx-task-etapa-1-formaleta",
          name: "Formaleta",
          mppFields: { ID: 12 },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        ID: 12,
        UNIQUE_ID: 12,
      }),
    );
    expect(typeof result.tasks[0].mppFields?.UNIQUE_ID).toBe("number");
  });

  test("materializes visible ID and Unique ID fields for tasks resources and assignments", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 7,
          name: "Instalar redes",
          mppFields: { UNIQUE_ID: 7001 },
        }),
      ],
      resources: [
        {
          uid: 10,
          name: "Oficial",
          type: "work",
          rate: 100,
          availability: 100,
          mppFields: { UNIQUE_ID: 9001 },
        },
      ],
      assignments: [
        {
          taskId: 7,
          resourceId: 10,
          units: 50,
          cost: 0,
          mppFields: { __rowId: 3001 },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:ID", fieldId: "ID", sourceKey: "ID", labelEn: "ID", labelEs: "Id.", dataType: "number", group: "basic", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:UNIQUE_ID", fieldId: "UNIQUE_ID", sourceKey: "UNIQUE_ID", labelEn: "Unique ID", labelEs: "Id. único", dataType: "number", group: "basic", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
      mppResourceColumns: [
        { key: "mpp:resource:ID", fieldId: "ID", sourceKey: "ID", labelEn: "ID", labelEs: "Id.", dataType: "number", group: "basic", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:resource:UNIQUE_ID", fieldId: "UNIQUE_ID", sourceKey: "UNIQUE_ID", labelEn: "Unique ID", labelEs: "Id. único", dataType: "number", group: "basic", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
      mppAssignmentColumns: [
        { key: "mpp:assignment:ID", fieldId: "ID", sourceKey: "ID", labelEn: "ID", labelEs: "Id.", dataType: "number", group: "basic", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:UNIQUE_ID", fieldId: "UNIQUE_ID", sourceKey: "UNIQUE_ID", labelEn: "Unique ID", labelEs: "Id. único", dataType: "number", group: "basic", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(expect.objectContaining({ ID: 7, UNIQUE_ID: 7001 }));
    expect(result.resources[0].mppFields).toEqual(expect.objectContaining({ ID: 10, UNIQUE_ID: 9001 }));
    expect(result.assignments[0].mppFields).toEqual(expect.objectContaining({ ID: 3001, UNIQUE_ID: 3001 }));
    expect(result.mppTaskColumns.find((column) => column.fieldId === "UNIQUE_ID")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "schedule",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
    expect(result.mppResourceColumns.find((column) => column.fieldId === "UNIQUE_ID")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "schedule",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
    expect(result.mppAssignmentColumns.find((column) => column.fieldId === "UNIQUE_ID")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "schedule",
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
  });

  test("materializes task Type and Effort Driven as editable calculation inputs", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          name: "Valor por defecto",
        }),
        task({
          id: 2,
          name: "Valor importado",
          mppFields: {
            TYPE: "Fixed Duration",
            EFFORT_DRIVEN: true,
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:TYPE", fieldId: "TYPE", sourceKey: "TYPE", labelEn: "Type", labelEs: "Tipo", dataType: "string", group: "basic", recordType: "task", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:EFFORT_DRIVEN", fieldId: "EFFORT_DRIVEN", sourceKey: "EFFORT_DRIVEN", labelEn: "Effort Driven", labelEs: "Condicionada por el esfuerzo", dataType: "boolean", group: "schedule", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        TYPE: "Fixed Units",
        EFFORT_DRIVEN: false,
      }),
    );
    expect(result.tasks[1].mppFields).toEqual(
      expect.objectContaining({
        TYPE: "Fixed Duration",
        EFFORT_DRIVEN: true,
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "TYPE")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "input",
        dependencies: ["WORK", "DURATION", "ASSIGNMENT_UNITS"],
        isCalculated: false,
        isEditableWhenCalculated: true,
        sourceOfTruth: "user",
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "TYPE")?.isEditable).toBe(true);
    expect(result.mppTaskColumns.find((column) => column.fieldId === "EFFORT_DRIVEN")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "input",
        dependencies: ["RESOURCE_ASSIGNMENTS", "WORK", "DURATION"],
        isCalculated: false,
        isEditableWhenCalculated: true,
        sourceOfTruth: "user",
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "EFFORT_DRIVEN")?.isEditable).toBe(true);
  });

  test("does not treat a constrained start as manually scheduled Task Mode", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          manualStart: new Date("2026-01-08T08:00:00.000Z"),
        }),
        task({
          id: 2,
          name: "Modo importado",
          mppFields: {
            TASK_MODE: "Manually Scheduled",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields?.TASK_MODE).toBe("Auto Scheduled");
    expect(result.tasks[1].mppFields?.TASK_MODE).toBe("Manually Scheduled");
  });

  test("calculates Complete Through from actual duration instead of final finish", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-08T17:00:00.000Z"),
          duration: 4,
          progress: 50,
          percentComplete: 50,
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:COMPLETE_THROUGH", fieldId: "COMPLETE_THROUGH", sourceKey: "COMPLETE_THROUGH", labelEn: "Complete Through", labelEs: "Completado hasta", dataType: "date", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks[0].mppFields?.ACTUAL_DURATION).toBe(2);
    expect(result.tasks[0].mppFields?.REMAINING_DURATION).toBe(2);
    expect(result.tasks[0].mppFields?.COMPLETE_THROUGH).toBe("2026-01-06");
  });

  test("calculates Stop and Resume from partial progress on a continuous task", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-08T17:00:00.000Z"),
          duration: 4,
          progress: 50,
          percentComplete: 50,
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields?.STOP).toBe("2026-01-06");
    expect(result.tasks[0].mppFields?.RESUME).toBe("2026-01-07");
  });

  test("preserves imported Resume when it represents a later split in the task", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-16T17:00:00.000Z"),
          duration: 8,
          progress: 25,
          percentComplete: 25,
          mppFields: {
            RESUME: "2026-01-12",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields?.STOP).toBe("2026-01-06");
    expect(result.tasks[0].mppFields?.RESUME).toBe("2026-01-12");
  });

  test("calculates MS Project status from an explicit status date", () => {
    const result = calculateMppFields({
      statusDate: new Date("2026-01-08T00:00:00.000Z"),
      tasks: [
        task({
          id: 1,
          name: "Complete task",
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-09T17:00:00.000Z"),
          duration: 5,
          progress: 100,
          percentComplete: 100,
        }),
        task({
          id: 2,
          name: "Future task",
          start: new Date("2026-01-12T08:00:00.000Z"),
          finish: new Date("2026-01-13T17:00:00.000Z"),
          duration: 2,
          progress: 0,
          percentComplete: 0,
        }),
        task({
          id: 3,
          name: "On schedule task",
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-09T17:00:00.000Z"),
          duration: 5,
          progress: 60,
          percentComplete: 60,
        }),
        task({
          id: 4,
          name: "Late task",
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-09T17:00:00.000Z"),
          duration: 5,
          progress: 40,
          percentComplete: 40,
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    } as Parameters<typeof calculateMppFields>[0] & { statusDate: Date });

    expect(result.tasks.map((calculated) => calculated.mppFields?.STATUS)).toEqual([
      "Complete",
      "Future Task",
      "On Schedule",
      "Late",
    ]);
    expect(result.tasks.map((calculated) => calculated.mppFields?.STATUS_INDICATOR)).toEqual([
      "Complete",
      "Future Task",
      "On Schedule",
      "Late",
    ]);
  });

  test("adds resource cost-per-use once per assignment to task, resource and assignment costs", () => {
    const result = calculateMppFields({
      tasks: [task({ progress: 25, percentComplete: 25 })],
      resources: [
        {
          uid: 10,
          name: "Cuadrilla",
          type: "work",
          rate: 100,
          availability: 100,
          mppFields: {
            COST_PER_USE: 50,
          },
        },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 50, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        WORK: 8,
        COST: 850,
        ACTUAL_COST: 212.5,
        REMAINING_COST: 637.5,
      }),
    );
    expect(result.assignments[0]).toEqual(
      expect.objectContaining({
        cost: 850,
        mppFields: expect.objectContaining({
          COST: 850,
          ACTUAL_COST: 212.5,
          REMAINING_COST: 637.5,
        }),
      }),
    );
    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        COST_PER_USE: 50,
        COST: 850,
        ACTUAL_COST: 212.5,
        REMAINING_COST: 637.5,
      }),
    );
  });

  test("applies fixed cost accrual when calculating actual and remaining cost", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          progress: 50,
          percentComplete: 50,
          mppFields: {
            FIXED_COST: 100,
            FIXED_COST_ACCRUAL: "Start",
          },
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 50, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        FIXED_COST: 100,
        FIXED_COST_ACCRUAL: "Start",
        COST: 900,
        ACTUAL_COST: 500,
        REMAINING_COST: 400,
      }),
    );
  });

  test("materializes actual fixed cost and spreads timephased actual fixed cost over reported progress", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-07T17:00:00.000Z"),
          duration: 3,
          progress: 50,
          percentComplete: 50,
          mppFields: {
            FIXED_COST: 100,
            FIXED_COST_ACCRUAL: "Prorated",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppTaskColumns: [
        { key: "mpp:TIMEPHASED_ACTUAL_FIXED_COST", fieldId: "TIMEPHASED_ACTUAL_FIXED_COST", sourceKey: "TIMEPHASED_ACTUAL_FIXED_COST", labelEn: "Actual Fixed Cost (Timephased)", labelEs: "Costo fijo real (por fases temporales)", dataType: "currency", group: "cost", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        ACTUAL_FIXED_COST: 50,
      }),
    );
    const series = result.tasks[0].mppFields?.TIMEPHASED_ACTUAL_FIXED_COST as Array<{
      start: string;
      value: number;
      cumulative: number;
    }>;
    expect(series).toHaveLength(3);
    expect(series[0]).toEqual(expect.objectContaining({ start: "2026-01-05T00:00:00.000Z" }));
    expect(series[0].value).toBeCloseTo(100 / 3);
    expect(series[0].cumulative).toBeCloseTo(100 / 3);
    expect(series[1]).toEqual(expect.objectContaining({ start: "2026-01-06T00:00:00.000Z" }));
    expect(series[1].value).toBeCloseTo(50 / 3);
    expect(series[1].cumulative).toBeCloseTo(50);
    expect(series[2]).toEqual(expect.objectContaining({ start: "2026-01-07T00:00:00.000Z" }));
    expect(series[2].value).toBeCloseTo(0);
    expect(series[2].cumulative).toBeCloseTo(50);
  });

  test("uses physical percent complete for earned value when that method is selected", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          progress: 20,
          percentComplete: 20,
          mppFields: {
            EARNED_VALUE_METHOD: "Physical % Complete",
            PHYSICAL_PERCENT_COMPLETE: 40,
          },
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 50, cost: 0 },
      ],
      baselines: [
        {
          id: "bl-ev",
          name: "Baseline",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          tasks: [
            {
              taskId: 1,
              baselineStart: start,
              baselineFinish: finish,
              baselineDuration: 2,
              baselineWork: 8,
              baselineCost: 1000,
            },
          ],
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        EARNED_VALUE_METHOD: "Physical % Complete",
        PERCENT_COMPLETE: 20,
        PHYSICAL_PERCENT_COMPLETE: 40,
        BCWS: 1000,
        BCWP: 400,
        ACWP: 160,
        SV: -600,
        CV: 240,
        CPI: 2.5,
        SPI: 0.4,
      }),
    );
  });

  test("rolls earned value fields into resources and assignments", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          progress: 50,
          percentComplete: 50,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 50,
          cost: 0,
          mppFields: {
            BASELINE_COST: 1000,
          },
        },
      ],
      baselines: [
        {
          id: "bl-assignment-ev",
          name: "Baseline",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          tasks: [
            {
              taskId: 1,
              baselineStart: start,
              baselineFinish: finish,
              baselineDuration: 2,
              baselineWork: 8,
              baselineCost: 1000,
            },
          ],
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    for (const record of [result.resources[0], result.assignments[0]]) {
      expect(record.mppFields).toEqual(
        expect.objectContaining({
          BCWS: 1000,
          BCWP: 500,
          ACWP: 400,
          SV: -500,
          SV_PERCENT: -50,
          CV: 100,
          CV_PERCENT: 20,
          SPI: 0.5,
          CPI: 1.25,
          EAC: 640,
          VAC: 360,
          TCPI: 500 / 600,
        }),
      );
    }
  });

  test("calculates BCWS from baseline cost scheduled through the status date", () => {
    const result = calculateMppFields({
      statusDate: new Date("2026-01-07T00:00:00.000Z"),
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-09T17:00:00.000Z"),
          duration: 5,
          progress: 40,
          percentComplete: 40,
        }),
      ],
      baselines: [
        {
          id: "bl-pv",
          name: "Baseline",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          tasks: [
            {
              taskId: 1,
              baselineStart: new Date("2026-01-05T08:00:00.000Z"),
              baselineFinish: new Date("2026-01-09T17:00:00.000Z"),
              baselineDuration: 5,
              baselineWork: 40,
              baselineCost: 1000,
            },
          ],
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        BCWS: 600,
        BCWP: 400,
        SV: -200,
        SPI: 400 / 600,
      }),
    );
  });

  test("calculates baseline date variances using the project working calendar", () => {
    const weekdayCalendar = {
      ...DEFAULT_PROJECT_CALENDAR,
      workDays: [1, 2, 3, 4, 5],
    };

    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
          progress: 0,
          percentComplete: 0,
        }),
      ],
      baselines: [
        {
          id: "bl-weekend",
          name: "Baseline",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          tasks: [
            {
              taskId: 1,
              baselineStart: new Date("2026-01-02T08:00:00.000Z"),
              baselineFinish: new Date("2026-01-02T17:00:00.000Z"),
              baselineDuration: 1,
              baselineWork: 8,
              baselineCost: 800,
            },
          ],
        },
      ],
      calendar: weekdayCalendar,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        START_VARIANCE: 1,
        FINISH_VARIANCE: 1,
      }),
    );
  });

  test("rolls up baseline, budget, variance and earned value fields on summary tasks", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          name: "Resumen",
          isSummary: true,
          outlineLevel: 1,
          duration: 2,
          progress: 0,
          percentComplete: 0,
        }),
        task({
          id: 2,
          name: "Hija A",
          outlineLevel: 2,
          duration: 1,
          progress: 50,
          percentComplete: 50,
          cost: 1000,
          actualCost: 500,
          mppFields: {
            WORK: 10,
            ACTUAL_WORK: 5,
            BASELINE_WORK: 8,
            BASELINE_COST: 900,
            BASELINE_BUDGET_WORK: 12,
            BASELINE_BUDGET_COST: 1100,
            BASELINE_1_WORK: 7,
            BASELINE_1_COST: 800,
            BASELINE_1_BUDGET_WORK: 9,
            BASELINE_1_BUDGET_COST: 950,
          },
        }),
        task({
          id: 3,
          name: "Hija B",
          outlineLevel: 2,
          duration: 1,
          progress: 100,
          percentComplete: 100,
          cost: 2000,
          actualCost: 2000,
          mppFields: {
            WORK: 20,
            ACTUAL_WORK: 20,
            BASELINE_WORK: 18,
            BASELINE_COST: 1800,
            BASELINE_BUDGET_WORK: 22,
            BASELINE_BUDGET_COST: 2100,
            BASELINE_1_WORK: 17,
            BASELINE_1_COST: 1700,
            BASELINE_1_BUDGET_WORK: 19,
            BASELINE_1_BUDGET_COST: 1950,
          },
        }),
      ],
      baselines: [
        {
          id: "summary-baseline-0",
          name: "Baseline",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          tasks: [
            {
              taskId: 2,
              baselineStart: new Date("2026-01-05T08:00:00.000Z"),
              baselineFinish: new Date("2026-01-05T17:00:00.000Z"),
              baselineDuration: 1,
              baselineWork: 8,
              baselineCost: 900,
              baselineBudgetWork: 12,
              baselineBudgetCost: 1100,
            },
            {
              taskId: 3,
              baselineStart: new Date("2026-01-06T08:00:00.000Z"),
              baselineFinish: new Date("2026-01-07T17:00:00.000Z"),
              baselineDuration: 2,
              baselineWork: 18,
              baselineCost: 1800,
              baselineBudgetWork: 22,
              baselineBudgetCost: 2100,
            },
          ],
        },
        {
          id: "summary-baseline-1",
          name: "Baseline 1",
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          tasks: [
            {
              taskId: 2,
              baselineStart: new Date("2026-01-04T08:00:00.000Z"),
              baselineFinish: new Date("2026-01-05T17:00:00.000Z"),
              baselineDuration: 2,
              baselineWork: 7,
              baselineCost: 800,
              baselineBudgetWork: 9,
              baselineBudgetCost: 950,
            },
            {
              taskId: 3,
              baselineStart: new Date("2026-01-06T08:00:00.000Z"),
              baselineFinish: new Date("2026-01-07T17:00:00.000Z"),
              baselineDuration: 2,
              baselineWork: 17,
              baselineCost: 1700,
              baselineBudgetWork: 19,
              baselineBudgetCost: 1950,
            },
          ],
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        BASELINE_WORK: 26,
        BASELINE_COST: 2700,
        BASELINE_BUDGET_WORK: 34,
        BASELINE_BUDGET_COST: 3200,
        BASELINE_1_WORK: 24,
        BASELINE_1_COST: 2500,
        BASELINE_1_BUDGET_WORK: 28,
        BASELINE_1_BUDGET_COST: 2900,
        BASELINE_0_ESTIMATED_START: "2026-01-05T08:00:00.000Z",
        BASELINE_0_ESTIMATED_FINISH: "2026-01-07T17:00:00.000Z",
        BASELINE_0_ESTIMATED_DURATION: 3,
        BASELINE_1_ESTIMATED_START: "2026-01-04T08:00:00.000Z",
        BASELINE_1_ESTIMATED_FINISH: "2026-01-07T17:00:00.000Z",
        BASELINE_1_ESTIMATED_DURATION: 4,
        BUDGET_WORK: 34,
        BUDGET_COST: 3200,
        WORK_VARIANCE: 4,
        COST_VARIANCE: 300,
        BCWS: 2700,
        BCWP: 2250,
        ACWP: 2500,
        SV: -450,
        CV: -250,
      }),
    );
  });

  test("rolls up physical percent complete on summary tasks weighted by child duration", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          name: "Resumen",
          isSummary: true,
          outlineLevel: 1,
          duration: 4,
          progress: 0,
          percentComplete: 0,
          mppFields: {
            PHYSICAL_PERCENT_COMPLETE: 0,
          },
        }),
        task({
          id: 2,
          name: "Hija A",
          outlineLevel: 2,
          duration: 1,
          progress: 10,
          percentComplete: 10,
          mppFields: {
            PHYSICAL_PERCENT_COMPLETE: 20,
          },
        }),
        task({
          id: 3,
          name: "Hija B",
          outlineLevel: 2,
          duration: 3,
          progress: 50,
          percentComplete: 50,
          mppFields: {
            PHYSICAL_PERCENT_COMPLETE: 80,
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        PHYSICAL_PERCENT_COMPLETE: 65,
      }),
    );
  });

  test("calculates Summary Progress on summary tasks from scheduled subtasks", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          name: "Resumen",
          isSummary: true,
          outlineLevel: 1,
          duration: 4,
          progress: 0,
          percentComplete: 0,
        }),
        task({
          id: 2,
          name: "Hija A",
          outlineLevel: 2,
          duration: 1,
          progress: 25,
          percentComplete: 25,
        }),
        task({
          id: 3,
          name: "Hija B",
          outlineLevel: 2,
          duration: 3,
          progress: 75,
          percentComplete: 75,
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:SUMMARY_PROGRESS", fieldId: "SUMMARY_PROGRESS", sourceKey: "SUMMARY_PROGRESS", labelEn: "Summary Progress", labelEs: "Progreso de resumen", dataType: "number", group: "tracking", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        PERCENT_COMPLETE: 62.5,
        SUMMARY_PROGRESS: 62.5,
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "SUMMARY_PROGRESS")).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "rollup",
          dependencies: ["TASK_OUTLINE", "SUMMARY_CHILDREN"],
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
  });

  test("does not mark WBS summary tasks as Group By Summary rows", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          name: "Resumen WBS",
          isSummary: true,
          outlineLevel: 1,
          wbs: "1",
        }),
        task({
          id: 2,
          name: "Actividad hija",
          isSummary: false,
          outlineLevel: 2,
          wbs: "1.1",
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:GROUP_BY_SUMMARY", fieldId: "GROUP_BY_SUMMARY", sourceKey: "GROUP_BY_SUMMARY", labelEn: "Group By Summary", labelEs: "Resumen de agrupación", dataType: "boolean", group: "basic", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        SUMMARY: true,
        GROUP_BY_SUMMARY: false,
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "GROUP_BY_SUMMARY")?.calculationSpec).toEqual(
      expect.objectContaining({
        calculationKind: "rollup",
        dependencies: ["VIEW_GROUPING"],
        isCalculated: true,
        sourceOfTruth: "engine",
      }),
    );
  });

  test("calculates resource and assignment baseline variances from imported baseline fields", () => {
    const weekdayCalendar = {
      ...DEFAULT_PROJECT_CALENDAR,
      workDays: [1, 2, 3, 4, 5],
    };
    const baselineFields = {
      BASELINE_START: "2026-01-02T08:00:00.000Z",
      BASELINE_FINISH: "2026-01-02T17:00:00.000Z",
      BASELINE_DURATION: 1,
      BASELINE_WORK: 6,
      BASELINE_COST: 700,
    };

    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 2,
          progress: 0,
          percentComplete: 0,
        }),
      ],
      resources: [
        {
          uid: 10,
          name: "Oficial",
          type: "work",
          rate: 100,
          availability: 100,
          mppFields: baselineFields,
        },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: baselineFields,
        },
      ],
      calendar: weekdayCalendar,
    });

    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        START_VARIANCE: 1,
        FINISH_VARIANCE: 2,
        WORK_VARIANCE: 10,
        COST_VARIANCE: 900,
      }),
    );
    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        DURATION: 2,
        START_VARIANCE: 1,
        FINISH_VARIANCE: 2,
        DURATION_VARIANCE: 1,
        WORK_VARIANCE: 10,
        COST_VARIANCE: 900,
      }),
    );
  });

  test("materializes resource and assignment budget work and cost from baseline budget fields", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
          progress: 0,
          percentComplete: 0,
        }),
        task({
          id: 2,
          name: "Actividad 2",
          start: new Date("2026-01-06T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 1,
          progress: 0,
          percentComplete: 0,
          dependencies: [],
        }),
      ],
      resources: [
        {
          uid: 10,
          name: "Oficial",
          type: "work",
          rate: 100,
          availability: 100,
        },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            BASELINE_BUDGET_WORK: 10,
            BASELINE_BUDGET_COST: 1200,
          },
        },
        {
          taskId: 2,
          resourceId: 10,
          units: 50,
          cost: 0,
          mppFields: {
            BASELINE_BUDGET_WORK: 6,
            BASELINE_BUDGET_COST: 700,
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        BUDGET_WORK: 10,
        BUDGET_COST: 1200,
      }),
    );
    expect(result.assignments[1].mppFields).toEqual(
      expect.objectContaining({
        BUDGET_WORK: 6,
        BUDGET_COST: 700,
      }),
    );
    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        BUDGET_WORK: 16,
        BUDGET_COST: 1900,
      }),
    );
  });

  test("rolls assignment baseline fields into resource baseline fields", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
          progress: 0,
          percentComplete: 0,
        }),
        task({
          id: 2,
          name: "Actividad 2",
          start: new Date("2026-01-06T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 1,
          progress: 0,
          percentComplete: 0,
          dependencies: [],
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            BASELINE_START: "2026-01-03T08:00:00.000Z",
            BASELINE_FINISH: "2026-01-03T17:00:00.000Z",
            BASELINE_WORK: 8,
            BASELINE_COST: 800,
            BASELINE_0_ESTIMATED_START: "2026-01-03T08:00:00.000Z",
            BASELINE_0_ESTIMATED_FINISH: "2026-01-03T17:00:00.000Z",
            BASELINE_0_ESTIMATED_DURATION: 1,
            BASELINE_1_START: "2026-01-02T08:00:00.000Z",
            BASELINE_1_FINISH: "2026-01-02T17:00:00.000Z",
            BASELINE_1_WORK: 7,
            BASELINE_1_COST: 700,
            BASELINE_1_ESTIMATED_START: "2026-01-02T08:00:00.000Z",
            BASELINE_1_ESTIMATED_FINISH: "2026-01-02T17:00:00.000Z",
            BASELINE_1_ESTIMATED_DURATION: 1,
          },
        },
        {
          taskId: 2,
          resourceId: 10,
          units: 50,
          cost: 0,
          mppFields: {
            BASELINE_START: "2026-01-04T08:00:00.000Z",
            BASELINE_FINISH: "2026-01-06T17:00:00.000Z",
            BASELINE_WORK: 4,
            BASELINE_COST: 400,
            BASELINE_0_ESTIMATED_START: "2026-01-04T08:00:00.000Z",
            BASELINE_0_ESTIMATED_FINISH: "2026-01-06T17:00:00.000Z",
            BASELINE_0_ESTIMATED_DURATION: 3,
            BASELINE_1_START: "2026-01-04T08:00:00.000Z",
            BASELINE_1_FINISH: "2026-01-06T17:00:00.000Z",
            BASELINE_1_WORK: 3,
            BASELINE_1_COST: 300,
            BASELINE_1_ESTIMATED_START: "2026-01-04T08:00:00.000Z",
            BASELINE_1_ESTIMATED_FINISH: "2026-01-06T17:00:00.000Z",
            BASELINE_1_ESTIMATED_DURATION: 3,
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        BASELINE_START: "2026-01-03T08:00:00.000Z",
        BASELINE_FINISH: "2026-01-06T17:00:00.000Z",
        BASELINE_WORK: 12,
        BASELINE_COST: 1200,
        BASELINE_0_ESTIMATED_START: "2026-01-03T08:00:00.000Z",
        BASELINE_0_ESTIMATED_FINISH: "2026-01-06T17:00:00.000Z",
        BASELINE_0_ESTIMATED_DURATION: 4,
        BASELINE_1_START: "2026-01-02T08:00:00.000Z",
        BASELINE_1_FINISH: "2026-01-06T17:00:00.000Z",
        BASELINE_1_WORK: 10,
        BASELINE_1_COST: 1000,
        BASELINE_1_ESTIMATED_START: "2026-01-02T08:00:00.000Z",
        BASELINE_1_ESTIMATED_FINISH: "2026-01-06T17:00:00.000Z",
        BASELINE_1_ESTIMATED_DURATION: 5,
      }),
    );
  });

  test("derives assignment baseline fields from the linked task baseline when assignment baseline is missing", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
          progress: 0,
          percentComplete: 0,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 100, cost: 0 },
      ],
      baselines: [
        {
          id: "baseline-0",
          name: "Baseline",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          tasks: [
            {
              taskId: 1,
              baselineStart: new Date("2026-01-02T08:00:00.000Z"),
              baselineFinish: new Date("2026-01-02T17:00:00.000Z"),
              baselineDuration: 1,
              baselineWork: 8,
              baselineCost: 800,
              baselineBudgetWork: 9,
              baselineBudgetCost: 900,
            },
          ],
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppAssignmentColumns: [
        { key: "mpp:assignment:BASELINE_START", fieldId: "BASELINE_START", sourceKey: "BASELINE_START", labelEn: "Baseline Start", labelEs: "Comienzo de línea base", dataType: "date", group: "baseline", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:BASELINE_COST", fieldId: "BASELINE_COST", sourceKey: "BASELINE_COST", labelEn: "Baseline Cost", labelEs: "Costo de línea base", dataType: "currency", group: "baseline", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:BASELINE_0_ESTIMATED_START", fieldId: "BASELINE_0_ESTIMATED_START", sourceKey: "BASELINE_0_ESTIMATED_START", labelEn: "Baseline0 Estimated Start", labelEs: "Comienzo estimado de línea base 0", dataType: "date", group: "baseline", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
        { key: "mpp:assignment:BASELINE_0_ESTIMATED_FINISH", fieldId: "BASELINE_0_ESTIMATED_FINISH", sourceKey: "BASELINE_0_ESTIMATED_FINISH", labelEn: "Baseline0 Estimated Finish", labelEs: "Fin estimado de línea base 0", dataType: "date", group: "baseline", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
      mppResourceColumns: [
        { key: "mpp:resource:BASELINE_COST", fieldId: "BASELINE_COST", sourceKey: "BASELINE_COST", labelEn: "Baseline Cost", labelEs: "Costo de línea base", dataType: "currency", group: "baseline", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        BASELINE_START: "2026-01-02T08:00:00.000Z",
        BASELINE_FINISH: "2026-01-02T17:00:00.000Z",
        BASELINE_DURATION: 1,
        BASELINE_WORK: 8,
        BASELINE_COST: 800,
        BASELINE_BUDGET_WORK: 9,
        BASELINE_BUDGET_COST: 900,
        BASELINE_0_ESTIMATED_START: "2026-01-02T08:00:00.000Z",
        BASELINE_0_ESTIMATED_FINISH: "2026-01-02T17:00:00.000Z",
        BASELINE_0_ESTIMATED_DURATION: 1,
        START_VARIANCE: 2,
        FINISH_VARIANCE: 2,
        WORK_VARIANCE: 0,
        COST_VARIANCE: 0,
      }),
    );
    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        BASELINE_START: "2026-01-02T08:00:00.000Z",
        BASELINE_FINISH: "2026-01-02T17:00:00.000Z",
        BASELINE_WORK: 8,
        BASELINE_COST: 800,
        BASELINE_BUDGET_WORK: 9,
        BASELINE_BUDGET_COST: 900,
      }),
    );
  });

  test("calculates overtime work and overtime cost from imported assignment and resource fields", () => {
    const result = calculateMppFields({
      tasks: [task({ progress: 50, percentComplete: 50 })],
      resources: [
        {
          uid: 10,
          name: "Oficial",
          type: "work",
          rate: 100,
          availability: 100,
          mppFields: {
            OVERTIME_RATE: 150,
            COST_PER_USE: 50,
          },
        },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            OVERTIME_WORK: 2,
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        WORK: 16,
        REGULAR_WORK: 14,
        OVERTIME_WORK: 2,
        ACTUAL_OVERTIME_WORK: 1,
        REMAINING_OVERTIME_WORK: 1,
        COST: 1750,
        OVERTIME_COST: 300,
        ACTUAL_OVERTIME_COST: 150,
        REMAINING_OVERTIME_COST: 150,
      }),
    );
    expect(result.assignments[0]).toEqual(
      expect.objectContaining({
        cost: 1750,
        mppFields: expect.objectContaining({
          REGULAR_WORK: 14,
          OVERTIME_WORK: 2,
          OVERTIME_RATE: 150,
          OVERTIME_COST: 300,
          ACTUAL_OVERTIME_COST: 150,
          REMAINING_OVERTIME_COST: 150,
        }),
      }),
    );
    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        OVERTIME_RATE: 150,
        REGULAR_WORK: 14,
        OVERTIME_WORK: 2,
        OVERTIME_COST: 300,
        ACTUAL_OVERTIME_COST: 150,
        REMAINING_OVERTIME_COST: 150,
      }),
    );
  });

  test("uses the assignment cost rate table when calculating work resource costs", () => {
    const result = calculateMppFields({
      tasks: [task({ progress: 50, percentComplete: 50 })],
      resources: [
        {
          uid: 10,
          name: "Oficial",
          type: "work",
          rate: 100,
          availability: 100,
          mppFields: {
            OVERTIME_RATE: 150,
            COST_PER_USE: 10,
            COST_RATE_TABLES: {
              B: {
                standardRate: 200,
                overtimeRate: 300,
                costPerUse: 40,
              },
            },
          },
        },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            COST_RATE_TABLE: "B",
            OVERTIME_WORK: 2,
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.assignments[0]).toEqual(
      expect.objectContaining({
        cost: 3440,
        mppFields: expect.objectContaining({
          COST_RATE_TABLE: "B",
          STANDARD_RATE: 200,
          OVERTIME_RATE: 300,
          COST_PER_USE: 40,
          COST: 3440,
          ACTUAL_COST: 1720,
          OVERTIME_COST: 600,
        }),
      }),
    );
    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        COST: 3440,
        ACTUAL_COST: 1720,
        OVERTIME_COST: 600,
      }),
    );
  });

  test("uses the cost rate table entry effective on the task start date", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-02-05T08:00:00.000Z"),
          finish: new Date("2026-02-06T17:00:00.000Z"),
        }),
      ],
      resources: [
        {
          uid: 10,
          name: "Oficial",
          type: "work",
          rate: 100,
          availability: 100,
          mppFields: {
            COST_RATE_TABLES: {
              B: {
                entries: [
                  {
                    effectiveDate: "2026-01-01T00:00:00.000Z",
                    standardRate: 150,
                    overtimeRate: 225,
                    costPerUse: 25,
                  },
                  {
                    effectiveDate: "2026-02-01T00:00:00.000Z",
                    standardRate: 250,
                    overtimeRate: 375,
                    costPerUse: 80,
                  },
                ],
              },
            },
          },
        },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            COST_RATE_TABLE: "B",
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.assignments[0]).toEqual(
      expect.objectContaining({
        cost: 4080,
        mppFields: expect.objectContaining({
          COST_RATE_TABLE: "B",
          STANDARD_RATE: 250,
          OVERTIME_RATE: 375,
          COST_PER_USE: 80,
          COST: 4080,
        }),
      }),
    );
  });

  test("prorates cost rate table entries when rates change during the task", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-28T08:00:00.000Z"),
          finish: new Date("2026-01-31T17:00:00.000Z"),
          duration: 4,
          progress: 25,
          percentComplete: 25,
        }),
      ],
      resources: [
        {
          uid: 10,
          name: "Oficial",
          type: "work",
          rate: 100,
          availability: 100,
          mppFields: {
            COST_RATE_TABLES: {
              B: {
                entries: [
                  {
                    startDate: "2026-01-01T00:00:00.000Z",
                    standardRate: 100,
                    overtimeRate: 150,
                    costPerUse: 0,
                  },
                  {
                    startDate: "2026-01-30T00:00:00.000Z",
                    standardRate: 200,
                    overtimeRate: 300,
                    costPerUse: 0,
                  },
                ],
              },
            },
          },
        },
      ],
      assignments: [
        {
          taskId: 1,
          resourceId: 10,
          units: 100,
          cost: 0,
          mppFields: {
            COST_RATE_TABLE: "B",
          },
        },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.assignments[0]).toEqual(
      expect.objectContaining({
        cost: 4800,
        mppFields: expect.objectContaining({
          COST_RATE_TABLE: "B",
          STANDARD_RATE: 100,
          COST: 4800,
          ACTUAL_COST: 1200,
          REMAINING_COST: 3600,
        }),
      }),
    );
    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        COST: 4800,
        ACTUAL_COST: 1200,
      }),
    );
  });

  test("uses resource calendar hours for assignment work unless the task ignores it", () => {
    const resourceCalendar = {
      ...DEFAULT_PROJECT_CALENDAR,
      hoursPerDay: 4,
      startHour: "08:00",
      endHour: "12:00",
    };

    const result = calculateMppFields({
      tasks: [
        task({ id: 1, name: "Usa calendario recurso" }),
        task({
          id: 2,
          name: "Ignora calendario recurso",
          mppFields: {
            IGNORE_RESOURCE_CALENDAR: true,
          },
        }),
      ],
      resources: [
        {
          uid: 10,
          name: "Medio tiempo",
          type: "work",
          rate: 100,
          availability: 100,
          calendar: resourceCalendar,
        },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 100, cost: 0 },
        { taskId: 2, resourceId: 10, units: 100, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        IGNORE_RESOURCE_CALENDAR: false,
        WORK: 8,
        COST: 800,
      }),
    );
    expect(result.tasks[1].mppFields).toEqual(
      expect.objectContaining({
        IGNORE_RESOURCE_CALENDAR: true,
        WORK: 16,
        COST: 1600,
      }),
    );
    expect(result.assignments[0].mppFields).toEqual(
      expect.objectContaining({
        WORK: 8,
        COST: 800,
      }),
    );
    expect(result.assignments[1].mppFields).toEqual(
      expect.objectContaining({
        WORK: 16,
        COST: 1600,
      }),
    );
  });

  test("detects resource overallocation from overlapping task assignments", () => {
    const result = calculateMppFields({
      tasks: [
        task({ id: 1, name: "Actividad A" }),
        task({ id: 2, name: "Actividad B" }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 75, cost: 0 },
        { taskId: 2, resourceId: 10, units: 75, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        PEAK: 150,
        OVERALLOCATED: true,
      }),
    );
    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        PEAK: 75,
        OVERALLOCATED: true,
      }),
    );
    expect(result.tasks[1].mppFields).toEqual(
      expect.objectContaining({
        PEAK: 75,
        OVERALLOCATED: true,
      }),
    );
    expect(result.assignments).toEqual([
      expect.objectContaining({
        mppFields: expect.objectContaining({
          PEAK: 75,
          OVERALLOCATED: true,
        }),
      }),
      expect.objectContaining({
        mppFields: expect.objectContaining({
          PEAK: 75,
          OVERALLOCATED: true,
        }),
      }),
    ]);
  });

  test("materializes timephased overallocation only on overallocated buckets", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          name: "Actividad A",
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-06T17:00:00.000Z"),
          duration: 2,
        }),
        task({
          id: 2,
          name: "Actividad B",
          start: new Date("2026-01-06T08:00:00.000Z"),
          finish: new Date("2026-01-07T17:00:00.000Z"),
          duration: 2,
        }),
      ],
      resources: [
        { uid: 10, name: "Oficial", type: "work", rate: 100, availability: 100 },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 75, cost: 0 },
        { taskId: 2, resourceId: 10, units: 75, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      timephasedScale: "day",
      mppTaskColumns: [
        { key: "mpp:TIMEPHASED_OVERALLOCATION", fieldId: "TIMEPHASED_OVERALLOCATION", sourceKey: "TIMEPHASED_OVERALLOCATION", labelEn: "Overallocation (Timephased)", labelEs: "Sobreasignación (por fases temporales)", dataType: "object", group: "work", recordType: "task", isCustom: false, isCore: false, isEditable: false },
      ],
      mppResourceColumns: [
        { key: "mpp:resource:TIMEPHASED_OVERALLOCATION", fieldId: "TIMEPHASED_OVERALLOCATION", sourceKey: "TIMEPHASED_OVERALLOCATION", labelEn: "Overallocation (Timephased)", labelEs: "Sobreasignación (por fases temporales)", dataType: "object", group: "work", recordType: "resource", isCustom: false, isCore: false, isEditable: false },
      ],
      mppAssignmentColumns: [
        { key: "mpp:assignment:TIMEPHASED_OVERALLOCATION", fieldId: "TIMEPHASED_OVERALLOCATION", sourceKey: "TIMEPHASED_OVERALLOCATION", labelEn: "Overallocation (Timephased)", labelEs: "Sobreasignación (por fases temporales)", dataType: "object", group: "work", recordType: "assignment", isCustom: false, isCore: false, isEditable: false },
      ],
    });

    expect(result.tasks[0].mppFields?.TIMEPHASED_OVERALLOCATION).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: false }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: true }),
    ]);
    expect(result.tasks[1].mppFields?.TIMEPHASED_OVERALLOCATION).toEqual([
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: true }),
      expect.objectContaining({ start: "2026-01-07T00:00:00.000Z", value: false }),
    ]);
    expect(result.resources[0].mppFields?.TIMEPHASED_OVERALLOCATION).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: false }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: true }),
      expect.objectContaining({ start: "2026-01-07T00:00:00.000Z", value: false }),
    ]);
    expect(result.assignments[0].mppFields?.TIMEPHASED_OVERALLOCATION).toEqual([
      expect.objectContaining({ start: "2026-01-05T00:00:00.000Z", value: false }),
      expect.objectContaining({ start: "2026-01-06T00:00:00.000Z", value: true }),
    ]);
  });

  test("detects overallocation against resource availability periods", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          name: "Actividad A",
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
        }),
        task({
          id: 2,
          name: "Actividad B",
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-05T17:00:00.000Z"),
          duration: 1,
        }),
      ],
      resources: [
        {
          uid: 10,
          name: "Oficial",
          type: "work",
          rate: 100,
          availability: 200,
          mppFields: {
            AVAILABILITY_PERIODS: [
              {
                start: "2026-01-05",
                finish: "2026-01-05",
                units: 150,
              },
            ],
          },
        },
      ],
      assignments: [
        { taskId: 1, resourceId: 10, units: 80, cost: 0 },
        { taskId: 2, resourceId: 10, units: 80, cost: 0 },
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
    });

    expect(result.resources[0].mppFields).toEqual(
      expect.objectContaining({
        MAX_UNITS: 200,
        PEAK: 160,
        OVERALLOCATED: true,
      }),
    );
    expect(result.tasks[0].mppFields?.OVERALLOCATED).toBe(true);
    expect(result.tasks[1].mppFields?.OVERALLOCATED).toBe(true);
    expect(result.assignments[0].mppFields?.OVERALLOCATED).toBe(true);
    expect(result.assignments[1].mppFields?.OVERALLOCATED).toBe(true);
  });

  test("calculates custom formulas and locks formula columns while keeping plain custom fields editable", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          mppFields: {
            NUMBER_1: 12,
            TEXT_1: "editable",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:NUMBER_1", fieldId: "NUMBER_1", sourceKey: "NUMBER_1", labelEn: "Number 1", labelEs: "Número 1", dataType: "number", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
        { key: "mpp:NUMBER_2", fieldId: "NUMBER_2", sourceKey: "NUMBER_2", labelEn: "Number 2", labelEs: "Número 2", dataType: "number", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
        { key: "mpp:NUMBER_3", fieldId: "NUMBER_3", sourceKey: "NUMBER_3", labelEn: "Number 3", labelEs: "Número 3", dataType: "number", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
        { key: "mpp:NUMBER_4", fieldId: "NUMBER_4", sourceKey: "NUMBER_4", labelEn: "Number 4", labelEs: "Número 4", dataType: "number", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
        { key: "mpp:NUMBER_5", fieldId: "NUMBER_5", sourceKey: "NUMBER_5", labelEn: "Number 5", labelEs: "Número 5", dataType: "number", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
        { key: "mpp:TEXT_1", fieldId: "TEXT_1", sourceKey: "TEXT_1", labelEn: "Text 1", labelEs: "Texto 1", dataType: "string", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
      ],
      customFieldDefinitions: [
        {
          fieldId: "NUMBER_3",
          recordType: "task",
          dataType: "number",
          formula: "[Number2] + 1",
          dependencies: ["NUMBER_2"],
        },
        {
          fieldId: "NUMBER_2",
          alias: "Puntaje Calculado",
          recordType: "task",
          dataType: "number",
          formula: "[Puntaje Base] * 2",
          dependencies: ["NUMBER_1"],
        },
        {
          fieldId: "NUMBER_1",
          alias: "Puntaje Base",
          recordType: "task",
          dataType: "number",
        },
        {
          fieldId: "NUMBER_4",
          recordType: "task",
          dataType: "number",
          formula: "[Number5] + 1",
          dependencies: ["NUMBER_5"],
        },
        {
          fieldId: "NUMBER_5",
          recordType: "task",
          dataType: "number",
          formula: "[Number4] + 1",
          dependencies: ["NUMBER_4"],
        },
        {
          fieldId: "TEXT_1",
          recordType: "task",
          dataType: "string",
        },
      ],
    });

    expect(result.tasks[0].mppFields?.NUMBER_2).toBe(24);
    expect(result.tasks[0].mppFields?.NUMBER_3).toBe(25);
    expect(result.tasks[0].mppFields?.NUMBER_4).toBeUndefined();
    expect(result.tasks[0].mppFields?.NUMBER_5).toBeUndefined();
    expect(result.tasks[0].mppFields?.NUMBER_4_FORMULA_ERROR).toContain("depende de NUMBER_5");
    expect(result.tasks[0].mppFields?.NUMBER_5_FORMULA_ERROR).toContain("depende de NUMBER_4");
    expect(result.mppTaskColumns.find((column) => column.fieldId === "NUMBER_2")).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "customFormula",
          formula: "[Puntaje Base] * 2",
          dependencies: ["NUMBER_1"],
          sourceOfTruth: "customFormula",
        }),
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "TEXT_1")).toEqual(
      expect.objectContaining({
        isEditable: true,
        calculationSpec: expect.objectContaining({
          calculationKind: "input",
          isCalculated: false,
          sourceOfTruth: "user",
        }),
      }),
    );
  });

  test("keeps imported unsupported custom formula reasons in fields and columns", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          mppFields: {
            NUMBER_1: 10,
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:NUMBER_2", fieldId: "NUMBER_2", sourceKey: "NUMBER_2", labelEn: "Number 2", labelEs: "Número 2", dataType: "number", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
      ],
      customFieldDefinitions: [
        {
          fieldId: "NUMBER_2",
          recordType: "task",
          dataType: "number",
          formula: "CustomFoo([Number1])",
          dependencies: ["NUMBER_1"],
          unsupportedFormula: true,
          unsupportedReason: "Funciones de formula no soportadas por el motor actual: CUSTOMFOO",
        },
      ],
    });

    expect(result.tasks[0].mppFields?.NUMBER_2).toBeUndefined();
    expect(result.tasks[0].mppFields?.NUMBER_2_FORMULA_ERROR).toBe(
      "Funciones de formula no soportadas por el motor actual: CUSTOMFOO",
    );
    expect(result.mppTaskColumns[0]).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "unsupportedFormula",
          formula: "CustomFoo([Number1])",
          unsupportedReason: "Funciones de formula no soportadas por el motor actual: CUSTOMFOO",
        }),
      }),
    );
  });

  test("materializes lookup errors for custom field values outside their lookup table", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          mppFields: {
            TEXT_1: "Pendiente",
            TEXT_2: "Aprobado",
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:TEXT_1", fieldId: "TEXT_1", sourceKey: "TEXT_1", labelEn: "Text 1", labelEs: "Texto 1", dataType: "string", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
        { key: "mpp:TEXT_2", fieldId: "TEXT_2", sourceKey: "TEXT_2", labelEn: "Text 2", labelEs: "Texto 2", dataType: "string", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
      ],
      customFieldDefinitions: [
        {
          fieldId: "TEXT_1",
          recordType: "task",
          dataType: "string",
          lookupValues: ["Aprobado", "Rechazado"],
        },
        {
          fieldId: "TEXT_2",
          recordType: "task",
          dataType: "string",
          lookupValues: ["Aprobado", "Rechazado"],
        },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        TEXT_1: "Pendiente",
        TEXT_1_LOOKUP_ERROR: 'Valor "Pendiente" no existe en la lista de valores permitidos para TEXT_1.',
        TEXT_2: "Aprobado",
      }),
    );
    expect(result.tasks[0].mppFields?.TEXT_2_LOOKUP_ERROR).toBeUndefined();
  });

  test("calculates custom date formulas with the project calendar", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          start: new Date("2026-01-05T08:00:00.000Z"),
          finish: new Date("2026-01-10T17:00:00.000Z"),
          duration: 6,
        }),
      ],
      calendar: {
        ...DEFAULT_PROJECT_CALENDAR,
        workDays: [1, 2, 3, 4, 5],
        hoursPerDay: 6,
      },
      mppTaskColumns: [
        { key: "mpp:DURATION_1", fieldId: "DURATION_1", sourceKey: "DURATION_1", labelEn: "Duration 1", labelEs: "Duración 1", dataType: "duration", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
      ],
      customFieldDefinitions: [
        {
          fieldId: "DURATION_1",
          recordType: "task",
          dataType: "duration",
          formula: "ProjDateDiff([Start], [Finish]) / 60",
          dependencies: ["START", "FINISH"],
        },
      ],
    });

    expect(result.tasks[0].mppFields?.DURATION_1).toBe(30);
    expect(result.tasks[0].mppFields?.DURATION_1_FORMULA_ERROR).toBeUndefined();
  });

  test("rolls up custom fields on summary tasks using imported rollup types", () => {
    const result = calculateMppFields({
      tasks: [
        task({
          id: 1,
          name: "Resumen",
          isSummary: true,
          outlineLevel: 1,
          duration: 4,
          progress: 0,
          percentComplete: 0,
        }),
        task({
          id: 2,
          name: "Hija A",
          outlineLevel: 2,
          duration: 2,
          progress: 50,
          percentComplete: 50,
          mppFields: {
            NUMBER_1: 10,
            NUMBER_2: 20,
            FLAG_1: false,
          },
        }),
        task({
          id: 3,
          name: "Hija B",
          outlineLevel: 2,
          duration: 2,
          progress: 100,
          percentComplete: 100,
          mppFields: {
            NUMBER_1: 30,
            NUMBER_2: 40,
            FLAG_1: true,
          },
        }),
      ],
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        { key: "mpp:NUMBER_1", fieldId: "NUMBER_1", sourceKey: "NUMBER_1", labelEn: "Number 1", labelEs: "Número 1", dataType: "number", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
        { key: "mpp:NUMBER_2", fieldId: "NUMBER_2", sourceKey: "NUMBER_2", labelEn: "Number 2", labelEs: "Número 2", dataType: "number", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
        { key: "mpp:FLAG_1", fieldId: "FLAG_1", sourceKey: "FLAG_1", labelEn: "Flag 1", labelEs: "Indicador 1", dataType: "boolean", group: "custom", recordType: "task", isCustom: true, isCore: false, isEditable: true },
      ],
      customFieldDefinitions: [
        {
          fieldId: "NUMBER_1",
          recordType: "task",
          dataType: "number",
          rollupType: "sum",
        },
        {
          fieldId: "NUMBER_2",
          recordType: "task",
          dataType: "number",
          rollupType: "average",
        },
        {
          fieldId: "FLAG_1",
          recordType: "task",
          dataType: "boolean",
          rollupType: "any",
        },
      ],
    });

    expect(result.tasks[0].mppFields).toEqual(
      expect.objectContaining({
        NUMBER_1: 40,
        NUMBER_2: 30,
        FLAG_1: true,
      }),
    );
  });
});
