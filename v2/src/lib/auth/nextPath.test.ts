import { safeNextPath } from "./nextPath";

describe("safeNextPath (E3: retorno al destino tras iniciar sesión)", () => {
  test("acepta rutas internas", () => {
    expect(safeNextPath("/upload")).toBe("/upload");
    expect(safeNextPath("/project/abc-123")).toBe("/project/abc-123");
  });

  test("rechaza destinos externos para no ser un redirector abierto", () => {
    expect(safeNextPath("https://evil.example.com")).toBe("");
    expect(safeNextPath("//evil.example.com")).toBe("");
    expect(safeNextPath("javascript:alert(1)")).toBe("");
  });

  test("rechaza valores ausentes o no textuales", () => {
    expect(safeNextPath(undefined)).toBe("");
    expect(safeNextPath(null)).toBe("");
    expect(safeNextPath(42)).toBe("");
  });
});
