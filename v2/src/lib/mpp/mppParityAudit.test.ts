import { auditMppParity } from "./mppParityAudit";

describe("auditMppParity", () => {
  test("matches numbers, dates and duration-like fields with tolerances", () => {
    const result = auditMppParity({
      recordType: "task",
      importedRecords: [
        {
          UID: 1,
          mppFields: {
            COST: 100.0001,
            START: "2026-01-05T08:00:00.000Z",
            DURATION: "15.0d",
            WORK: "300.0h",
          },
        },
      ],
      calculatedRecords: [
        {
          id: 1,
          mppFields: {
            COST: 100.0002,
            START: "2026-01-05T08:00:30.000Z",
            DURATION: 15,
            WORK: 300,
          },
        },
      ],
      fields: ["Cost", "Start", "Duration", "Work"],
      numericTolerance: 0.001,
      dateToleranceMs: 60_000,
      durationToleranceHours: 0.001,
    });

    expect(result.summary).toEqual({
      total: 4,
      match: 4,
      missingImported: 0,
      missingCalculated: 0,
      mismatch: 0,
      skipped: 0,
    });
    expect(result.records[0].fields.map((field) => field.status)).toEqual(["match", "match", "match", "match"]);
  });

  test("reports missing imported values, missing calculated values and mismatches", () => {
    const result = auditMppParity({
      recordType: "task",
      importedRecords: [
        {
          UID: 10,
          mppFields: {
            NAME: "Actividad importada",
            COST: 500,
          },
        },
      ],
      calculatedRecords: [
        {
          id: 10,
          mppFields: {
            NAME: "Actividad calculada",
            START: "2026-01-01T08:00:00.000Z",
          },
        },
      ],
      fields: ["Name", "Cost", "Start"],
    });

    expect(result.records[0].fields).toEqual([
      expect.objectContaining({ fieldId: "NAME", status: "mismatch" }),
      expect.objectContaining({ fieldId: "COST", status: "missingCalculated" }),
      expect.objectContaining({ fieldId: "START", status: "missingImported" }),
    ]);
    expect(result.summary).toEqual({
      total: 3,
      match: 0,
      missingImported: 1,
      missingCalculated: 1,
      mismatch: 1,
      skipped: 0,
    });
  });

  test("normalizes standard and custom field IDs and aggregates by record", () => {
    const result = auditMppParity({
      recordType: "task",
      importedRecords: [
        {
          mppFields: {
            UniqueID: 101,
            Number1: 24,
            Text1: "Contrato",
          },
        },
        {
          mppFields: {
            UniqueID: 102,
            Number1: 31,
            Text1: "Obra",
          },
        },
      ],
      calculatedRecords: [
        {
          mppFields: {
            UNIQUE_ID: 101,
            NUMBER_1: 24,
            TEXT_1: "Contrato",
          },
        },
        {
          mppFields: {
            UNIQUE_ID: 102,
            NUMBER_1: 30,
            TEXT_1: "Obra",
          },
        },
      ],
      fields: ["Number 1", "Text 1"],
    });

    expect(result.records).toEqual([
      expect.objectContaining({
        recordId: "101",
        summary: expect.objectContaining({ match: 2, mismatch: 0 }),
      }),
      expect.objectContaining({
        recordId: "102",
        summary: expect.objectContaining({ match: 1, mismatch: 1 }),
      }),
    ]);
    expect(result.summary).toEqual({
      total: 4,
      match: 3,
      missingImported: 0,
      missingCalculated: 0,
      mismatch: 1,
      skipped: 0,
    });
  });

  test("skips empty or explicitly excluded fields", () => {
    const result = auditMppParity({
      recordType: "resource",
      importedRecords: [{ uid: 1, mppFields: {} }],
      calculatedRecords: [{ uid: 1, mppFields: {} }],
      fields: ["Notes", "Cost"],
      skipFields: ["Cost"],
    });

    expect(result.records[0].fields).toEqual([
      expect.objectContaining({ fieldId: "NOTES", status: "skipped", reason: "Sin valor importado ni calculado" }),
      expect.objectContaining({ fieldId: "COST", status: "skipped", reason: "Campo excluido de la auditoria" }),
    ]);
    expect(result.summary).toEqual({
      total: 2,
      match: 0,
      missingImported: 0,
      missingCalculated: 0,
      mismatch: 0,
      skipped: 2,
    });
  });

  test("reports calculated records that did not exist in the import", () => {
    const result = auditMppParity({
      recordType: "assignment",
      importedRecords: [{ mppFields: { UNIQUE_ID: 1, WORK: "40h" } }],
      calculatedRecords: [
        { mppFields: { UNIQUE_ID: 1, WORK: 40 } },
        { mppFields: { UNIQUE_ID: 2, WORK: 16 } },
      ],
      fields: ["Work"],
    });

    expect(result.records).toEqual([
      expect.objectContaining({
        recordId: "1",
        summary: expect.objectContaining({ match: 1 }),
      }),
      expect.objectContaining({
        recordId: "2",
        summary: expect.objectContaining({ missingImported: 1 }),
      }),
    ]);
    expect(result.summary).toEqual({
      total: 2,
      match: 1,
      missingImported: 1,
      missingCalculated: 0,
      mismatch: 0,
      skipped: 0,
    });
  });
});
