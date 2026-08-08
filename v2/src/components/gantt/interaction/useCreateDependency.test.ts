import { inferDepType, depTypeLabel } from "./useCreateDependency";

describe("tipo de vínculo según los bordes (E35)", () => {
  test("de fin a inicio es FS", () => {
    expect(inferDepType("right", "left")).toBe("FS");
  });

  test("de fin a fin es FF", () => {
    expect(inferDepType("right", "right")).toBe("FF");
  });

  test("de inicio a inicio es SS", () => {
    expect(inferDepType("left", "left")).toBe("SS");
  });

  test("de inicio a fin es SF", () => {
    expect(inferDepType("left", "right")).toBe("SF");
  });
});

describe("el tipo se dice en obra, no solo en siglas (E35)", () => {
  test("cada tipo tiene su nombre en español", () => {
    expect(depTypeLabel("FS")).toBe("fin a inicio");
    expect(depTypeLabel("FF")).toBe("fin a fin");
    expect(depTypeLabel("SS")).toBe("inicio a inicio");
    expect(depTypeLabel("SF")).toBe("inicio a fin");
  });

  test("los cuatro tipos están cubiertos: ninguno queda sin nombre", () => {
    for (const tipo of ["FS", "SS", "FF", "SF"] as const) {
      expect(depTypeLabel(tipo).length).toBeGreaterThan(5);
    }
  });
});
