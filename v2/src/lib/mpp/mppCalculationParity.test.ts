import type { GanttTask } from "@/components/gantt/types";
import type { Assignment, Resource } from "@/types/resource";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";
import type {
  MppAssignmentColumn,
  MppCustomFieldDefinition,
  MppResourceColumn,
  MppTaskColumn,
} from "@/types/mppColumns";
import { calculateMppFields } from "./mppCalculationEngine";

function taskColumn(fieldId: string, dataType: MppTaskColumn["dataType"] = "string"): MppTaskColumn {
  return {
    key: `mpp:${fieldId}`,
    fieldId,
    sourceKey: fieldId,
    labelEn: fieldId,
    labelEs: fieldId,
    dataType,
    group: "other",
    recordType: "task",
    isCustom: fieldId.startsWith("NUMBER_") || fieldId.startsWith("TEXT_"),
    isCore: false,
    isEditable: false,
  };
}

function resourceColumn(fieldId: string, dataType: MppResourceColumn["dataType"] = "string"): MppResourceColumn {
  return {
    key: `mpp:resource:${fieldId}`,
    fieldId,
    sourceKey: fieldId,
    labelEn: fieldId,
    labelEs: fieldId,
    dataType,
    group: "other",
    recordType: "resource",
    isCustom: false,
    isCore: false,
    isEditable: false,
  };
}

function assignmentColumn(fieldId: string, dataType: MppAssignmentColumn["dataType"] = "string"): MppAssignmentColumn {
  return {
    key: `mpp:assignment:${fieldId}`,
    fieldId,
    sourceKey: fieldId,
    labelEn: fieldId,
    labelEs: fieldId,
    dataType,
    group: "other",
    recordType: "assignment",
    isCustom: false,
    isCore: false,
    isEditable: false,
  };
}

describe("MPP calculation parity with imported real-project fields", () => {
  test("recalculates a real-MPP-like task without losing imported calculated/custom context", () => {
    const tasks: GanttTask[] = [
      {
        id: 12626,
        name: "Instalación módulo escalera",
        start: new Date("2026-07-02T07:00:00.000Z"),
        finish: new Date("2026-07-18T17:00:00.000Z"),
        duration: 15,
        progress: 0,
        percentComplete: 0,
        isCritical: false,
        isMilestone: false,
        isSummary: false,
        outlineLevel: 3,
        wbs: "8.3.2",
        dependencies: [],
        constraintType: "startNoEarlierThan",
        constraintDate: new Date("2026-07-02T07:00:00.000Z"),
        mppFields: {
          UID: 12626,
          UNIQUE_ID: 12626,
          ID: 1115,
          WBS: "8.3.2",
          OUTLINE_LEVEL: 3,
          OUTLINE_NUMBER: "8.3.2",
          START: "2026-07-02T07:00",
          FINISH: "2026-07-18T17:00",
          DURATION: "15.0d",
          EARLY_START: "2026-07-02T07:00",
          EARLY_FINISH: "2026-07-18T17:00",
          LATE_START: "2026-08-20T07:00",
          LATE_FINISH: "2026-09-05T17:00",
          FREE_SLACK: "0.0d",
          START_SLACK: "39.0d",
          FINISH_SLACK: "39.0d",
          REMAINING_DURATION: "15.0d",
          COST: 67452067,
          REMAINING_COST: 67452067,
          FIXED_COST: 67452067,
          BASELINE_START: "2025-01-23T07:00",
          BASELINE_FINISH: "2025-02-26T17:00",
          BASELINE_DURATION: "30.0d",
          CONSTRAINT_TYPE: "START_NO_EARLIER_THAN",
          CONSTRAINT_DATE: "2026-07-02T07:00",
          NUMBER_6: 17.00000000000485,
          TEXT_2: "0,00%",
        },
      },
    ];
    const resources: Resource[] = [
      {
        uid: 145,
        name: "ENCOFRADO MURO-LOSA",
        type: "work",
        availability: 100,
        rate: 0,
        mppFields: {
          UNIQUE_ID: 145,
          TYPE: "WORK",
          MAX_UNITS: 100,
          STANDARD_RATE_UNITS: "h",
          OVERTIME_RATE_UNITS: "h",
          COST_RATE_TABLES: {
            A: {
              standardRate: 0,
              overtimeRate: 0,
              costPerUse: 0,
              entries: [
                {
                  startDate: "1984-01-01T00:00",
                  endDate: "2049-12-31T23:59",
                  standardRate: 0,
                  overtimeRate: 0,
                  costPerUse: 0,
                },
              ],
            },
          },
        },
      },
    ];
    const assignments: Assignment[] = [
      {
        taskId: 12626,
        resourceId: 145,
        units: 100,
        cost: 0,
        mppFields: {
          __rowId: 11498,
          UNIQUE_ID: 11498,
          TASK_UNIQUE_ID: 12626,
          RESOURCE_UNIQUE_ID: 145,
          ASSIGNMENT_UNITS: 100,
          BASELINE_START: "2025-09-01T12:00",
          BASELINE_FINISH: "2025-10-06T12:00",
          REGULAR_WORK: "300.0h",
          WORK: "300.0h",
          REMAINING_WORK: "300.0h",
          START: "2026-09-26T07:00",
          FINISH: "2026-10-31T17:00",
          RAW_TIMEPHASED_REMAINING_REGULAR_WORK: [
            "[TimephasedItem start=2026-09-26T07:00 totalAmount=18000.0m finish=2026-10-31T17:00 amountPerHour=60.0m]",
          ],
          COST_RATE_TABLE: "A",
        },
      },
    ];
    const customFieldDefinitions: MppCustomFieldDefinition[] = [
      {
        fieldId: "NUMBER_6",
        recordType: "task",
        alias: "Días calendario",
        dataType: "number",
      },
      {
        fieldId: "TEXT_2",
        recordType: "task",
        alias: "% COMPLETADO - DECIMALES",
        dataType: "string",
      },
    ];

    const result = calculateMppFields({
      tasks,
      resources,
      assignments,
      calendar: DEFAULT_PROJECT_CALENDAR,
      mppTaskColumns: [
        taskColumn("START", "date"),
        taskColumn("FINISH", "date"),
        taskColumn("DURATION", "duration"),
        taskColumn("CONSTRAINT_TYPE"),
        taskColumn("CONSTRAINT_DATE", "date"),
        taskColumn("BASELINE_START", "date"),
        taskColumn("BASELINE_FINISH", "date"),
        taskColumn("BASELINE_DURATION", "duration"),
        taskColumn("FIXED_COST", "currency"),
        taskColumn("COST", "currency"),
        taskColumn("REMAINING_COST", "currency"),
        taskColumn("WBS"),
        taskColumn("OUTLINE_LEVEL", "number"),
        taskColumn("OUTLINE_NUMBER"),
        taskColumn("NUMBER_6", "number"),
        taskColumn("TEXT_2"),
      ],
      mppResourceColumns: [
        resourceColumn("MAX_UNITS", "number"),
        resourceColumn("STANDARD_RATE", "currency"),
        resourceColumn("COST_RATE_TABLES", "object"),
      ],
      mppAssignmentColumns: [
        assignmentColumn("ASSIGNMENT_UNITS", "number"),
        assignmentColumn("WORK", "duration"),
        assignmentColumn("REMAINING_WORK", "duration"),
        assignmentColumn("REGULAR_WORK", "duration"),
        assignmentColumn("BASELINE_START", "date"),
        assignmentColumn("BASELINE_FINISH", "date"),
        assignmentColumn("RAW_TIMEPHASED_REMAINING_REGULAR_WORK", "object"),
        assignmentColumn("COST_RATE_TABLE"),
      ],
      customFieldDefinitions,
    });

    const taskFields = result.tasks[0].mppFields;
    expect(taskFields).toEqual(
      expect.objectContaining({
        WBS: "8.3.2",
        OUTLINE_LEVEL: 3,
        OUTLINE_NUMBER: "8.3.2",
        CONSTRAINT_TYPE: "Start No Earlier Than",
        FIXED_COST: 67452067,
        COST: 67452067,
        REMAINING_COST: 67452067,
        NUMBER_6: 17.00000000000485,
        TEXT_2: "0,00%",
      }),
    );
    expect(String(taskFields?.START)).toContain("2026-07-02T07:00");
    expect(String(taskFields?.FINISH)).toContain("2026-07-18T17:00");
    expect(String(taskFields?.BASELINE_START)).toContain("2025-01-23T07:00");
    expect(String(taskFields?.BASELINE_FINISH)).toContain("2025-02-26T17:00");

    const assignmentFields = result.assignments[0].mppFields;
    expect(assignmentFields).toEqual(
      expect.objectContaining({
        UNIQUE_ID: 11498,
        TASK_UNIQUE_ID: 12626,
        RESOURCE_UNIQUE_ID: 145,
        WORK: 300,
        REMAINING_WORK: 300,
        REGULAR_WORK: 300,
        COST_RATE_TABLE: "A",
      }),
    );
    expect(Number(assignmentFields?.ASSIGNMENT_UNITS)).toBeCloseTo(120.96774193548387);
    expect(assignmentFields?.RAW_TIMEPHASED_REMAINING_REGULAR_WORK).toEqual([
      "[TimephasedItem start=2026-09-26T07:00 totalAmount=18000.0m finish=2026-10-31T17:00 amountPerHour=60.0m]",
    ]);

    expect(result.mppTaskColumns.find((column) => column.fieldId === "NUMBER_6")).toEqual(
      expect.objectContaining({
        alias: "Días calendario",
        isEditable: true,
        calculationSpec: expect.objectContaining({
          calculationKind: "input",
          sourceOfTruth: "user",
        }),
      }),
    );
    expect(result.mppTaskColumns.find((column) => column.fieldId === "COST")).toEqual(
      expect.objectContaining({
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "cost",
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
  });
});
