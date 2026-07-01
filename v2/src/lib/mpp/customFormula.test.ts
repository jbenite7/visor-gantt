import {
  evaluateCustomFormula,
  extractFormulaDependencies,
} from "./customFormula";
import { DEFAULT_PROJECT_CALENDAR } from "@/types/calendar";

describe("custom formula evaluator", () => {
  test("extracts MS Project bracket field dependencies", () => {
    expect(extractFormulaDependencies("IIf([Cost] > 10, [Text1], [Number 1])")).toEqual([
      "COST",
      "TEXT_1",
      "NUMBER_1",
    ]);
  });

  test("evaluates arithmetic, comparisons and IIf without eval", () => {
    const result = evaluateCustomFormula("IIf([Cost] > 100, Round([Cost] * 1.19, 0), 0)", {
      getFieldValue: (fieldId) => ({
        COST: 125,
      })[fieldId],
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toBe(149);
  });

  test("calculates MS Project date functions with project calendar minutes", () => {
    const result = evaluateCustomFormula(
      "ProjDateDiff([Start], [Finish]) / 60",
      {
        calendar: DEFAULT_PROJECT_CALENDAR,
        getFieldValue: (fieldId) => ({
          START: "2026-01-05T08:00:00.000Z",
          FINISH: "2026-01-06T17:00:00.000Z",
        })[fieldId],
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.value).toBe(16);
  });

  test("ProjDateDiff includes working calendar exceptions with their own hours", () => {
    const result = evaluateCustomFormula(
      "ProjDateDiff([Start], [Finish]) / 60",
      {
        calendar: {
          ...DEFAULT_PROJECT_CALENDAR,
          workDays: [1, 2, 3, 4, 5],
          dateOverrides: [
            {
              id: "sunday-work",
              date: "2026-01-11",
              name: "Jornada especial",
              isWorking: true,
              hoursPerDay: 4,
            },
          ],
        },
        getFieldValue: (fieldId) => ({
          START: "2026-01-09T08:00:00.000Z",
          FINISH: "2026-01-11T13:00:00.000Z",
        })[fieldId],
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.value).toBe(12);
  });

  test("supports DateDiff, DateAdd, Switch and Choose functions used by custom fields", () => {
    const diff = evaluateCustomFormula('DateDiff("d", [Start], [Finish])', {
      getFieldValue: (fieldId) => ({
        START: "2026-01-05T00:00:00.000Z",
        FINISH: "2026-01-08T00:00:00.000Z",
      })[fieldId],
    });
    const add = evaluateCustomFormula('DateAdd("d", 3, [Start])', {
      getFieldValue: (fieldId) => ({
        START: "2026-01-05T00:00:00.000Z",
      })[fieldId],
    });
    const status = evaluateCustomFormula('Switch([Cost] > 1000, "Alto", [Cost] > 0, "Normal")', {
      getFieldValue: (fieldId) => ({ COST: 1500 })[fieldId],
    });
    const priority = evaluateCustomFormula('Choose(2, "Baja", "Media", "Alta")', {
      getFieldValue: () => null,
    });

    expect(diff).toEqual({ value: 3 });
    expect(add.error).toBeUndefined();
    expect(add.value).toBeInstanceOf(Date);
    expect((add.value as Date).toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(status).toEqual({ value: "Alto" });
    expect(priority).toEqual({ value: "Media" });
  });

  test("supports additional MS Project date, text and duration functions", () => {
    const dateValue = evaluateCustomFormula("ProjDateValue(\"2026-01-08\")", {
      getFieldValue: () => null,
    });
    const dateSub = evaluateCustomFormula("ProjDateSub([Finish], ProjDurValue(\"2d\"))", {
      calendar: DEFAULT_PROJECT_CALENDAR,
      getFieldValue: (fieldId) => ({
        FINISH: "2026-01-08T00:00:00.000Z",
      })[fieldId],
    });
    const datePart = evaluateCustomFormula('DatePart("q", DateSerial(2026, 5, 10))', {
      getFieldValue: () => null,
    });
    const text = evaluateCustomFormula('Left(Trim([Name]), 4) & "-" & Right([Code], 2) & "-" & Mid([Code], 2, 2) & "-" & InStr([Code], "B")', {
      getFieldValue: (fieldId) => ({
        NAME: " Torre 1 ",
        CODE: "ABCD",
      })[fieldId],
    });
    const durationHours = evaluateCustomFormula('ProjDurValue("2d") / 60', {
      calendar: DEFAULT_PROJECT_CALENDAR,
      getFieldValue: () => null,
    });

    expect(dateValue.error).toBeUndefined();
    expect((dateValue.value as Date).toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(dateSub.error).toBeUndefined();
    expect((dateSub.value as Date).toISOString()).toBe("2026-01-07T00:00:00.000Z");
    expect(datePart).toEqual({ value: 2 });
    expect(text).toEqual({ value: "Torr-CD-BC-2" });
    expect(durationHours).toEqual({ value: 16 });
  });

  test("accepts MPXJ textual duration values in ProjDateAdd and ProjDurValue", () => {
    const dateAdd = evaluateCustomFormula('ProjDateAdd([Start], "2d")', {
      calendar: DEFAULT_PROJECT_CALENDAR,
      getFieldValue: (fieldId) => ({
        START: "2026-01-05T00:00:00.000Z",
      })[fieldId],
    });
    const workHours = evaluateCustomFormula('ProjDurValue([Imported Work]) / 60', {
      calendar: DEFAULT_PROJECT_CALENDAR,
      getFieldValue: (fieldId) => ({
        IMPORTED_WORK: "300.0h",
      })[fieldId],
    });

    expect(dateAdd.error).toBeUndefined();
    expect((dateAdd.value as Date).toISOString()).toBe("2026-01-06T00:00:00.000Z");
    expect(workHours).toEqual({ value: 300 });
  });

  test("supports MS Project infix logical operators in custom formulas", () => {
    const result = evaluateCustomFormula('IIf([Cost] > 0 And Not [Blocked] Or [Override], "Ejecutar", "Esperar")', {
      getFieldValue: (fieldId) => ({
        COST: 100,
        BLOCKED: false,
        OVERRIDE: false,
      })[fieldId],
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toBe("Ejecutar");
  });

  test("supports additional MS Project text and numeric helper functions", () => {
    const sign = evaluateCustomFormula("Sgn([Variance])", {
      getFieldValue: (fieldId) => ({
        VARIANCE: -12,
      })[fieldId],
    });
    const comparison = evaluateCustomFormula('StrComp([Code], "A-10")', {
      getFieldValue: (fieldId) => ({
        CODE: "A-10",
      })[fieldId],
    });
    const replaced = evaluateCustomFormula('Replace([Name], "Torre", "Bloque")', {
      getFieldValue: (fieldId) => ({
        NAME: "Torre Norte",
      })[fieldId],
    });

    expect(sign).toEqual({ value: -1 });
    expect(comparison).toEqual({ value: 0 });
    expect(replaced).toEqual({ value: "Bloque Norte" });
  });

  test("supports common MS Project Format formulas for dates and numbers", () => {
    const result = evaluateCustomFormula(
      'Format([Finish], "yyyy-mm") & "|" & Format([Cost], "#,##0.00") & "|" & Format([Progress], "0%")',
      {
        getFieldValue: (fieldId) => ({
          FINISH: "2026-07-18T17:05:00.000Z",
          COST: 12345.5,
          PROGRESS: 0.456,
        })[fieldId],
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.value).toBe("2026-07|12,345.50|46%");
  });

  test("supports common MS Project numeric custom formula helpers", () => {
    const result = evaluateCustomFormula(
      "Mod([Cost], 7) + Sqr(16) + Sqrt(9) + Sin(0) + Cos(0) + Tan(0) + Atn(1) + Round(Log(1) + Exp(0), 6)",
      {
        getFieldValue: (fieldId) => ({
          COST: 15,
        })[fieldId],
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.value as number).toBeCloseTo(10 + Math.PI / 4);
  });

  test("supports the MS Project exponent operator with VBA-like precedence", () => {
    const result = evaluateCustomFormula("[Base] ^ 3 + 2 ^ 3 ^ 2 + -2 ^ 2", {
      getFieldValue: (fieldId) => ({
        BASE: 2,
      })[fieldId],
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toBe(516);
  });

  test("matches VBA Int and Fix semantics for negative custom formula values", () => {
    const floored = evaluateCustomFormula("Int(-8.4)", {
      getFieldValue: () => null,
    });
    const truncated = evaluateCustomFormula("Fix(-8.4)", {
      getFieldValue: () => null,
    });

    expect(floored).toEqual({ value: -9 });
    expect(truncated).toEqual({ value: -8 });
  });

  test("returns an explicit error for unsupported functions", () => {
    const result = evaluateCustomFormula("EnterpriseOnlyFunction([Start])", {
      getFieldValue: () => 0,
    });

    expect(result.value).toBeNull();
    expect(result.error).toContain("Función no soportada");
  });
});
