import {
  MIN_TASK_DURATION,
  parseDateInput,
  parseDurationInput,
  parseProgressInput,
  parseNumericFieldInput,
} from "./editValidation";

describe("parseDurationInput (E26)", () => {
  test("acepta enteros positivos", () => {
    expect(parseDurationInput("5")).toEqual({ ok: true, value: 5 });
  });

  test("rechaza negativos explicando el mínimo", () => {
    const result = parseDurationInput("-10");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("1");
  });

  test("rechaza cero en una tarea normal, porque el resize impone mínimo 1", () => {
    expect(parseDurationInput("0").ok).toBe(false);
    expect(MIN_TASK_DURATION).toBe(1);
  });

  test("permite cero cuando la tarea es un hito", () => {
    expect(parseDurationInput("0", { allowZero: true })).toEqual({
      ok: true,
      value: 0,
    });
  });

  test("rechaza texto sin convertirlo en cero", () => {
    const result = parseDurationInput("mañana");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toBeTruthy();
  });

  test("redondea a días enteros en vez de aceptar 2,5 días", () => {
    expect(parseDurationInput("2.5")).toEqual({ ok: true, value: 3 });
  });
});

describe("parseDateInput (E26)", () => {
  test("acepta una fecha ISO", () => {
    const result = parseDateInput("2026-03-12");
    expect(result.ok).toBe(true);
  });

  test("rechaza una fecha ilegible", () => {
    expect(parseDateInput("no-es-fecha").ok).toBe(false);
  });

  test("rechaza un fin anterior al inicio y lo explica", () => {
    const result = parseDateInput("2026-03-01", {
      notBefore: new Date("2026-03-10T08:00:00"),
      notBeforeLabel: "el inicio",
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("inicio");
  });

  test("acepta un fin igual al inicio (tarea de un día)", () => {
    const start = new Date("2026-03-10T08:00:00");
    expect(parseDateInput("2026-03-10", { notBefore: start }).ok).toBe(true);
  });
});

describe("parseProgressInput (E26)", () => {
  test("acepta 0 a 100", () => {
    expect(parseProgressInput("0")).toEqual({ ok: true, value: 0 });
    expect(parseProgressInput("100")).toEqual({ ok: true, value: 100 });
  });

  test("rechaza fuera de rango explicando el rango", () => {
    const result = parseProgressInput("150");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("100");
  });
});

describe("parseNumericFieldInput (E26)", () => {
  test("no convierte texto en cero en silencio", () => {
    const result = parseNumericFieldInput("mañana");
    expect(result.ok).toBe(false);
  });

  test("acepta un número con decimales", () => {
    expect(parseNumericFieldInput("1250.5")).toEqual({ ok: true, value: 1250.5 });
  });

  test("trata el vacío como borrar el valor", () => {
    expect(parseNumericFieldInput("")).toEqual({ ok: true, value: null });
  });
});
