import type { MppCustomFieldDefinition, MppTaskColumn } from "@/types/mppColumns";
import { inspectMppField } from "./fieldInspector";

describe("MPP field inspector", () => {
  test("summarizes value, calculation metadata and materialized custom-field errors", () => {
    const column: MppTaskColumn = {
      key: "mpp:TEXT_1",
      fieldId: "TEXT_1",
      sourceKey: "Text1",
      labelEn: "Contract Status",
      labelEs: "Estado contrato",
      dataType: "string",
      group: "custom",
      recordType: "task",
      isCustom: true,
      isCore: false,
      isEditable: false,
      calculationSpec: {
        calculationKind: "customFormula",
        formula: 'IIf([Cost] > 0, "Aprobado", "Pendiente")',
        dependencies: ["COST"],
        isCalculated: true,
        isEditableWhenCalculated: false,
        lastCalculatedAt: "2026-06-26T19:00:00.000Z",
        sourceOfTruth: "customFormula",
      },
    };
    const definitions: MppCustomFieldDefinition[] = [
      {
        fieldId: "TEXT_1",
        recordType: "task",
        dataType: "string",
        alias: "Estado contrato",
        lookupValues: ["Aprobado", "Rechazado"],
        graphicalIndicators: [{ test: "equals", value: "Rechazado", image: "red" }],
      },
    ];

    const inspection = inspectMppField({
      record: {
        mppFields: {
          TEXT_1: "Pendiente",
          TEXT_1_LOOKUP_ERROR: 'Valor "Pendiente" no existe en la lista de valores permitidos para TEXT_1.',
          TEXT_1_FORMULA_ERROR: "Fórmula importada no soportada por el motor actual.",
        },
      },
      column,
      customFieldDefinitions: definitions,
      locale: "es",
    });

    expect(inspection).toEqual({
      fieldId: "TEXT_1",
      label: "Estado contrato",
      value: "Pendiente",
      dataType: "string",
      recordType: "task",
      isEditable: false,
      isCalculated: true,
      calculationKind: "customFormula",
      sourceOfTruth: "customFormula",
      formula: 'IIf([Cost] > 0, "Aprobado", "Pendiente")',
      dependencies: ["COST"],
      rollupType: undefined,
      lastCalculatedAt: "2026-06-26T19:00:00.000Z",
      lookupValues: ["Aprobado", "Rechazado"],
      graphicalIndicators: [{ test: "equals", value: "Rechazado", image: "red" }],
      errors: [
        {
          kind: "formula",
          message: "Fórmula importada no soportada por el motor actual.",
        },
        {
          kind: "lookup",
          message: 'Valor "Pendiente" no existe en la lista de valores permitidos para TEXT_1.',
        },
      ],
    });
  });
});
