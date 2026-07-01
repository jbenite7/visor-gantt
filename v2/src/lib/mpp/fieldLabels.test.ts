import {
  getMppColumnLabel,
  normalizeMppFieldId,
  resolveMppFieldDefinition,
} from "./fieldLabels";

describe("MS Project task field labels", () => {
  test("resolves standard task fields in English and Spanish", () => {
    expect(resolveMppFieldDefinition("Name")).toEqual(
      expect.objectContaining({ en: "Name", es: "Nombre" }),
    );
    expect(resolveMppFieldDefinition("Duration")).toEqual(
      expect.objectContaining({ en: "Duration", es: "Duración" }),
    );
    expect(resolveMppFieldDefinition("Start")).toEqual(
      expect.objectContaining({ en: "Start", es: "Comienzo" }),
    );
    expect(resolveMppFieldDefinition("PercentComplete")).toEqual(
      expect.objectContaining({ en: "% Complete", es: "% completado" }),
    );
    expect(resolveMppFieldDefinition("ResourceNames")).toEqual(
      expect.objectContaining({
        en: "Resource Names",
        es: "Nombres de los recursos",
      }),
    );
    expect(resolveMppFieldDefinition("Active")).toEqual(
      expect.objectContaining({
        en: "Active",
        es: "Activa",
        dataType: "boolean",
      }),
    );
    expect(resolveMppFieldDefinition("Assignment Delay")).toEqual(
      expect.objectContaining({
        en: "Assignment Delay",
        es: "Retraso de asignación",
        dataType: "duration",
        group: "schedule",
      }),
    );
    expect(resolveMppFieldDefinition("Fixed Cost")).toEqual(
      expect.objectContaining({
        en: "Fixed Cost",
        es: "Costo fijo",
        dataType: "currency",
        group: "cost",
      }),
    );
    expect(resolveMppFieldDefinition("Fixed Cost Accrual")).toEqual(
      expect.objectContaining({
        en: "Fixed Cost Accrual",
        es: "Acumulación de costos fijos",
        dataType: "string",
        group: "cost",
      }),
    );
    expect(resolveMppFieldDefinition("Actual Fixed Cost")).toEqual(
      expect.objectContaining({
        en: "Actual Fixed Cost",
        es: "Costo fijo real",
        dataType: "currency",
        group: "cost",
      }),
    );
    expect(resolveMppFieldDefinition("TIMEPHASED_ACTUAL_FIXED_COST", "Actual Fixed Cost")).toEqual(
      expect.objectContaining({
        en: "Actual Fixed Cost",
        es: "Costo fijo real",
        dataType: "currency",
        group: "cost",
      }),
    );
  });

  test("uses official custom field families when no alias exists", () => {
    expect(resolveMppFieldDefinition("Text1")).toEqual(
      expect.objectContaining({ en: "Text 1", es: "Texto 1" }),
    );
    expect(resolveMppFieldDefinition("Flag20")).toEqual(
      expect.objectContaining({ en: "Flag 20", es: "Indicador 20" }),
    );
  });

  test("keeps file aliases unchanged in both languages", () => {
    expect(resolveMppFieldDefinition("Text1", undefined, "Contrato")).toEqual(
      expect.objectContaining({ en: "Contrato", es: "Contrato" }),
    );
  });

  test("normalizes common field aliases", () => {
    expect(normalizeMppFieldId("PercentComplete")).toBe("PERCENT_COMPLETE");
    expect(normalizeMppFieldId("ResourceNames")).toBe("RESOURCE_NAMES");
    expect(normalizeMppFieldId("Outline Code 1")).toBe("OUTLINE_CODE_1");
  });

  test("returns the label for the active locale", () => {
    const column = { labelEn: "Finish", labelEs: "Fin" };

    expect(getMppColumnLabel(column, "es")).toBe("Fin");
    expect(getMppColumnLabel(column, "en")).toBe("Finish");
  });
});
