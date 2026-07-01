import type { MppRecordType } from "@/types/mppColumns";
import { getMppCalculatedFieldSpec } from "./calculatedFields";

function expectCalculatedSpec(recordType: MppRecordType, fieldIds: string[]) {
  for (const fieldId of fieldIds) {
    expect({ recordType, fieldId, spec: getMppCalculatedFieldSpec(fieldId, recordType) }).toEqual(
      expect.objectContaining({
        spec: expect.objectContaining({
          isCalculated: true,
          sourceOfTruth: "engine",
        }),
      }),
    );
  }
}

function expectUserInputSpec(recordType: MppRecordType, fieldIds: string[]) {
  for (const fieldId of fieldIds) {
    expect({ recordType, fieldId, spec: getMppCalculatedFieldSpec(fieldId, recordType) }).toEqual(
      expect.objectContaining({
        spec: expect.objectContaining({
          calculationKind: "input",
          isCalculated: false,
          isEditableWhenCalculated: true,
          sourceOfTruth: "user",
        }),
      }),
    );
  }
}

describe("MPP calculated field catalog", () => {
  test("classifies task fields that generate schedule calculations", () => {
    expectCalculatedSpec("task", [
      "Start",
      "Finish",
      "Duration",
      "Early Start",
      "Early Finish",
      "Late Start",
      "Late Finish",
      "Total Slack",
      "Free Slack",
      "Start Slack",
      "Finish Slack",
      "Negative Slack",
      "Critical",
      "Successors",
      "Predecessors",
      "WBS Predecessors",
      "WBS Successors",
      "Unique ID Predecessors",
      "Unique ID Successors",
      "Scheduled Start",
      "Scheduled Finish",
      "Scheduled Duration",
    ]);
  });

  test("classifies task tracking, work, cost, baseline and earned-value calculated fields", () => {
    expectCalculatedSpec("task", [
      "% Complete",
      "% Work Complete",
      "Physical % Complete",
      "Actual Start",
      "Actual Finish",
      "Actual Duration",
      "Remaining Duration",
      "Complete Through",
      "Stop",
      "Resume",
      "Status",
      "Status Indicator",
      "Health",
      "Work",
      "Actual Work",
      "Remaining Work",
      "Regular Work",
      "Overtime Work",
      "Actual Overtime Work",
      "Remaining Overtime Work",
      "Peak",
      "Overallocated",
      "Cost",
      "Actual Cost",
      "Remaining Cost",
      "Actual Fixed Cost",
      "Overtime Cost",
      "Actual Overtime Cost",
      "Remaining Overtime Cost",
      "Baseline Start",
      "Baseline Finish",
      "Baseline Duration",
      "Baseline Work",
      "Baseline Cost",
      "Baseline Budget Work",
      "Baseline Budget Cost",
      "Baseline1 Start",
      "Baseline1 Finish",
      "Baseline1 Duration",
      "Baseline1 Work",
      "Baseline1 Cost",
      "Start Variance",
      "Finish Variance",
      "Duration Variance",
      "Work Variance",
      "Cost Variance",
      "BCWS",
      "BCWP",
      "ACWP",
      "SV",
      "SV%",
      "CV",
      "CV%",
      "SPI",
      "CPI",
      "EAC",
      "VAC",
      "TCPI",
      "Work (Timephased)",
      "Cumulative Work (Timephased)",
      "Remaining Cumulative Work (Timephased)",
      "Baseline1 Work (Timephased)",
      "SPI (Timephased)",
      "CPI (Timephased)",
    ]);
  });

  test("classifies user-editable task calculation inputs and custom fields", () => {
    expectUserInputSpec("task", [
      "Type",
      "Effort Driven",
      "Fixed Cost",
      "Fixed Cost Accrual",
      "Earned Value Method",
      "Work Contour",
      "Cost Rate Table",
      "Text1",
      "Number1",
      "Date1",
      "Cost1",
      "Duration1",
      "Flag1",
      "Start1",
      "Finish1",
      "Outline Code1",
      "Enterprise Text1",
      "Enterprise Number1",
      "Enterprise Date1",
      "Enterprise Cost1",
      "Enterprise Duration1",
      "Enterprise Flag1",
      "Enterprise Task Outline Code1",
    ]);
  });

  test("classifies resource and assignment calculated fields plus custom inputs", () => {
    expectCalculatedSpec("resource", [
      "Start",
      "Finish",
      "Actual Start",
      "Actual Finish",
      "% Work Complete",
      "Work",
      "Actual Work",
      "Remaining Work",
      "Cost",
      "Actual Cost",
      "Remaining Cost",
      "Baseline Work",
      "Baseline Cost",
      "BCWS",
      "BCWP",
      "ACWP",
      "SPI (Timephased)",
      "CPI (Timephased)",
    ]);
    expectUserInputSpec("resource", [
      "Standard Rate",
      "Overtime Rate",
      "Cost Per Use",
      "Max Units",
      "Work Contour",
      "Text1",
      "Enterprise Text1",
      "Enterprise Resource Outline Code1",
    ]);

    expectCalculatedSpec("assignment", [
      "Start",
      "Finish",
      "Actual Start",
      "Actual Finish",
      "Actual Duration",
      "Remaining Duration",
      "% Work Complete",
      "Work",
      "Actual Work",
      "Remaining Work",
      "Cost",
      "Actual Cost",
      "Remaining Cost",
      "Baseline Work",
      "Baseline Cost",
      "BCWS",
      "BCWP",
      "ACWP",
      "SPI (Timephased)",
      "CPI (Timephased)",
    ]);
    expectUserInputSpec("assignment", [
      "Assignment Units",
      "Cost Rate Table",
      "Work Contour",
      "Text1",
      "Enterprise Text1",
      "Enterprise Resource Outline Code1",
    ]);
  });
});
