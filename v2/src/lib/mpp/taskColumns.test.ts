import {
  buildMppAssignmentColumnsFromAssignments,
  buildMppResourceColumnsFromResources,
  buildMppTaskColumnsFromTasks,
  normalizeAssignmentColumnSettings,
  normalizeResourceColumnSettings,
  normalizeTaskColumnSettings,
} from "./taskColumns";
import type { MSPTask } from "@/lib/parser/mpp-parser";

const task: MSPTask = {
  UID: 1,
  ID: 1,
  Name: "Actividad",
  Start: "2026-01-01T08:00:00",
  Finish: "2026-01-02T17:00:00",
  Duration: "P2D",
  DurationFormat: 7,
  PercentComplete: 0,
  Summary: false,
  Milestone: false,
  OutlineLevel: 1,
  WBS: "1",
  Text1: "Contrato",
  Number1: 12,
  mppFields: {
    Text1: "Contrato",
    Number1: 12,
  },
};

describe("MPP task columns", () => {
  test("builds dynamic columns for non-core MPP fields", () => {
    const columns = buildMppTaskColumnsFromTasks(
      [task],
      ["UID", "ID", "Name", "Duration", "Text1", "Number1"],
    );

    expect(columns.find((column) => column.fieldId === "NUMBER_1")).toEqual(
      expect.objectContaining({
        labelEn: "Number 1",
        labelEs: "Número 1",
        dataType: "number",
        isEditable: true,
      }),
    );
    expect(columns.find((column) => column.fieldId === "TEXT_1")).toEqual(
      expect.objectContaining({
        labelEn: "Text 1",
        labelEs: "Texto 1",
        dataType: "string",
        isEditable: true,
      }),
    );
    expect(columns.find((column) => column.fieldId === "ACTUAL_COST")).toEqual(
      expect.objectContaining({
        key: "mpp:ACTUAL_COST",
        sourceKey: "ACTUAL_COST",
        labelEn: "Actual Cost",
        labelEs: "Costo real",
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "cost",
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
    expect(columns.find((column) => column.fieldId === "DEADLINE")).toEqual(
      expect.objectContaining({
        key: "mpp:DEADLINE",
        sourceKey: "DEADLINE",
        labelEn: "Deadline",
        labelEs: "Fecha límite",
        calculationSpec: expect.objectContaining({
          calculationKind: "constraint",
          isCalculated: true,
        }),
      }),
    );
    expect(columns.find((column) => column.fieldId === "TEXT_1")).toEqual(
      expect.objectContaining({
        isEditable: true,
        calculationSpec: expect.objectContaining({
          calculationKind: "input",
          isCalculated: false,
          sourceOfTruth: "user",
        }),
      }),
    );
    expect(columns.length).toBeGreaterThan(300);
  });

  test("builds dynamic columns for resource and assignment records", () => {
    const resourceColumns = buildMppResourceColumnsFromResources(
      [{ uid: 10, name: "Oficial", type: "work", mppFields: { Text1: "Cuadrilla A" } }],
      ["UID", "Name", "Type", "Text1"],
    );
    const assignmentColumns = buildMppAssignmentColumnsFromAssignments(
      [{ taskId: 1, resourceId: 10, units: 50, cost: 1200, mppFields: { Text1: "Turno" } }],
      ["TaskUID", "ResourceUID", "Units", "Cost", "Text1"],
    );

    expect(resourceColumns.find((column) => column.fieldId === "TEXT_1")).toEqual(
      expect.objectContaining({
        recordType: "resource",
        labelEs: "Texto 1",
      }),
    );
    expect(resourceColumns.find((column) => column.fieldId === "WINDOWS_USER_ACCOUNT")).toEqual(
      expect.objectContaining({
        key: "mpp:resource:WINDOWS_USER_ACCOUNT",
        labelEn: "Windows User Account",
      }),
    );
    expect(resourceColumns.find((column) => column.fieldId === "TIMEPHASED_SPI")).toEqual(
      expect.objectContaining({
        key: "mpp:resource:TIMEPHASED_SPI",
        labelEn: "SPI (Timephased)",
        recordType: "resource",
        isEditable: false,
        calculationSpec: expect.objectContaining({
          calculationKind: "timephased",
          isCalculated: true,
        }),
      }),
    );
    expect(resourceColumns.find((column) => column.fieldId === "TIMEPHASED_CPI")).toEqual(
      expect.objectContaining({
        key: "mpp:resource:TIMEPHASED_CPI",
        labelEn: "CPI (Timephased)",
        recordType: "resource",
      }),
    );
    expect(assignmentColumns.find((column) => column.fieldId === "TEXT_1")).toEqual(
      expect.objectContaining({
        recordType: "assignment",
        labelEs: "Texto 1",
      }),
    );
    expect(assignmentColumns.find((column) => column.fieldId === "ACTUAL_WORK")).toEqual(
      expect.objectContaining({
        key: "mpp:assignment:ACTUAL_WORK",
        labelEn: "Actual Work",
        isEditable: true,
        calculationSpec: expect.objectContaining({
          calculationKind: "work",
          isCalculated: true,
          isEditableWhenCalculated: true,
        }),
      }),
    );
    expect(assignmentColumns.find((column) => column.fieldId === "COST_RATE_TABLE")).toEqual(
      expect.objectContaining({
        isEditable: true,
        calculationSpec: expect.objectContaining({
          calculationKind: "input",
          isCalculated: false,
          sourceOfTruth: "user",
        }),
      }),
    );
    expect(assignmentColumns.find((column) => column.fieldId === "TIMEPHASED_SPI")).toEqual(
      expect.objectContaining({
        key: "mpp:assignment:TIMEPHASED_SPI",
        labelEn: "SPI (Timephased)",
        recordType: "assignment",
      }),
    );
    expect(assignmentColumns.find((column) => column.fieldId === "TIMEPHASED_CPI")).toEqual(
      expect.objectContaining({
        key: "mpp:assignment:TIMEPHASED_CPI",
        labelEn: "CPI (Timephased)",
        recordType: "assignment",
      }),
    );
    expect(resourceColumns.length).toBeGreaterThan(250);
    expect(assignmentColumns.length).toBeGreaterThan(200);
  });

  test("uses parser aliases as both English and Spanish labels", () => {
    const columns = buildMppTaskColumnsFromTasks([task], undefined, [
      {
        sourceKey: "Text1",
        fieldId: "TEXT_1",
        alias: "Contrato",
        dataType: "string",
      },
    ]);

    expect(columns).toContainEqual(
      expect.objectContaining({
        sourceKey: "Text1",
        labelEn: "Contrato",
        labelEs: "Contrato",
      }),
    );
  });

  test("normalizes visible column settings with Spanish as default locale", () => {
    expect(normalizeTaskColumnSettings(undefined)).toEqual(
      expect.objectContaining({
        visible: expect.arrayContaining(["id", "name", "duration"]),
        widths: {},
        labelLocale: "es",
      }),
    );

    expect(normalizeTaskColumnSettings({ labelLocale: "en" }, "es").labelLocale).toBe("en");
    expect(normalizeResourceColumnSettings(undefined).visible).toEqual(
      expect.arrayContaining(["uid", "name", "type"]),
    );
    expect(normalizeAssignmentColumnSettings(undefined).visible).toEqual(
      expect.arrayContaining(["taskId", "resourceId", "units"]),
    );
  });
});
