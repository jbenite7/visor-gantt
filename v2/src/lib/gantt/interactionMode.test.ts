import { resolveInteractionMode } from "./interactionMode";

describe("Simple por defecto solo la primera vez (E36)", () => {
  test("primera visita sin preferencia: empieza en simple", () => {
    expect(resolveInteractionMode({}, { isFirstVisit: true })).toBe("simple");
  });

  test("visitas siguientes sin preferencia: avanzado, como el resto de la app", () => {
    expect(resolveInteractionMode({}, { isFirstVisit: false })).toBe("advanced");
  });

  test("la elección del usuario manda sobre todo lo demás", () => {
    expect(
      resolveInteractionMode({ interactionMode: "advanced" }, { isFirstVisit: true }),
    ).toBe("advanced");
    expect(
      resolveInteractionMode({ interactionMode: "simple" }, { isFirstVisit: false }),
    ).toBe("simple");
  });

  test("un proyecto con historial no es una primera visita", () => {
    expect(
      resolveInteractionMode({}, { isFirstVisit: false, hasHistory: true }),
    ).toBe("advanced");
  });
});
