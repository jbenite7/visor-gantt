import {
  getMppCalculationCoverage,
  summarizeMppCalculationCoverage,
} from "./calculationCoverage";

function entry(recordType: "task" | "resource" | "assignment", fieldId: string) {
  return getMppCalculationCoverage(recordType).find((item) => item.fieldId === fieldId);
}

describe("MPP calculation coverage report", () => {
  test("summarizes standard task, resource and assignment field coverage", () => {
    expect(summarizeMppCalculationCoverage("task")).toEqual(
      expect.objectContaining({
        recordType: "task",
        total: expect.any(Number),
        engineCalculated: expect.any(Number),
        userInput: expect.any(Number),
        customInput: expect.any(Number),
        passiveImport: expect.any(Number),
      }),
    );
    expect(summarizeMppCalculationCoverage("task").total).toBeGreaterThan(300);
    expect(summarizeMppCalculationCoverage("task").engineCalculated).toBeGreaterThan(100);
    expect(summarizeMppCalculationCoverage("resource").engineCalculated).toBeGreaterThan(80);
    expect(summarizeMppCalculationCoverage("assignment").engineCalculated).toBeGreaterThan(80);
  });

  test("classifies representative calculated, editable and passive fields", () => {
    expect(entry("task", "TOTAL_SLACK")).toEqual(
      expect.objectContaining({
        status: "engineCalculated",
        calculationKind: "schedule",
        isCalculated: true,
        isEditable: false,
        sourceOfTruth: "engine",
      }),
    );
    expect(entry("task", "BCWP")).toEqual(
      expect.objectContaining({
        status: "engineCalculated",
        calculationKind: "earnedValue",
      }),
    );
    expect(entry("task", "TIMEPHASED_SPI")).toEqual(
      expect.objectContaining({
        status: "engineCalculated",
        calculationKind: "timephased",
      }),
    );
    expect(entry("task", "FIXED_COST")).toEqual(
      expect.objectContaining({
        status: "userInput",
        calculationKind: "input",
        isCalculated: false,
        isEditable: true,
      }),
    );
    expect(entry("task", "TEXT_1")).toEqual(
      expect.objectContaining({
        status: "customInput",
        calculationKind: "input",
        isEditable: true,
      }),
    );
    expect(entry("task", "HYPERLINK")).toEqual(
      expect.objectContaining({
        status: "passiveImport",
        isCalculated: false,
        sourceOfTruth: "mppImport",
      }),
    );
  });

  test("reports resource and assignment calculation coverage from the same catalog", () => {
    expect(entry("resource", "TIMEPHASED_REMAINING_AVAILABILITY")).toEqual(
      expect.objectContaining({
        status: "engineCalculated",
        calculationKind: "timephased",
      }),
    );
    expect(entry("resource", "STANDARD_RATE")).toEqual(
      expect.objectContaining({
        status: "userInput",
        calculationKind: "input",
        isEditable: true,
      }),
    );
    expect(entry("assignment", "ACTUAL_WORK")).toEqual(
      expect.objectContaining({
        status: "engineCalculated",
        calculationKind: "work",
        isEditable: true,
      }),
    );
    expect(entry("assignment", "COST_RATE_TABLE")).toEqual(
      expect.objectContaining({
        status: "userInput",
        calculationKind: "input",
        isEditable: true,
      }),
    );
  });
});
