import {
  auditMppCalculationRequirements,
  MPP_CALCULATION_REQUIREMENTS,
  summarizeMppCalculationRequirements,
} from "./calculationRequirements";

describe("MPP calculation requirements manifest", () => {
  test("keeps the explicit user-requested MS Project calculated field families covered", () => {
    const audit = auditMppCalculationRequirements();
    const failures = audit
      .filter((item) => !item.ok)
      .map((item) => ({
        recordType: item.requirement.recordType,
        fieldId: item.requirement.fieldId,
        family: item.requirement.family,
        expected: item.requirement.expected,
        actual: item.actual,
      }));

    expect(failures).toEqual([]);
  });

  test("contains a broad executable requirement set for core, baseline, timephased and custom fields", () => {
    expect(MPP_CALCULATION_REQUIREMENTS.length).toBeGreaterThan(450);
    expect(MPP_CALCULATION_REQUIREMENTS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recordType: "task", fieldId: "Total Slack", family: "Cronograma CPM" }),
        expect.objectContaining({ recordType: "task", fieldId: "Physical % Complete", family: "Progreso/tracking" }),
        expect.objectContaining({ recordType: "task", fieldId: "Baseline10 Cost", family: "Baseline y variancias" }),
        expect.objectContaining({ recordType: "task", fieldId: "SPI (Timephased)", family: "Timephased" }),
        expect.objectContaining({ recordType: "resource", fieldId: "Standard Rate", expected: "userInput" }),
        expect.objectContaining({ recordType: "assignment", fieldId: "Actual Work", family: "Asignaciones" }),
        expect.objectContaining({ recordType: "task", fieldId: "Text30", expected: "customInput" }),
        expect.objectContaining({ recordType: "task", fieldId: "Enterprise Text40", expected: "customInput" }),
      ]),
    );
  });

  test("summarizes coverage by the requested MS Project field families", () => {
    const summary = summarizeMppCalculationRequirements();

    expect(summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: "Cronograma CPM", total: 19, missing: 0, mismatched: 0 }),
        expect.objectContaining({ family: "Baseline y variancias", missing: 0, mismatched: 0 }),
        expect.objectContaining({ family: "Timephased", total: 15, missing: 0, mismatched: 0 }),
        expect.objectContaining({ family: "Campos personalizados", missing: 0, mismatched: 0 }),
      ]),
    );
    expect(summary.every((family) => family.covered === family.total)).toBe(true);
  });
});
