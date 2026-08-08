import { dragDestinationLabel } from "./dragPreview";
import { createProjectDate } from "@/lib/date/projectDate";

describe("el arrastre dice a dónde va (E30)", () => {
  test("suma los días del gesto a la fecha de inicio", () => {
    expect(dragDestinationLabel(createProjectDate("2026-01-05"), 3)).toBe(
      "08/01/2026",
    );
  });

  test("hacia atrás también", () => {
    expect(dragDestinationLabel(createProjectDate("2026-01-05"), -2)).toBe(
      "03/01/2026",
    );
  });

  test("sin desplazamiento devuelve la fecha original, no una vacía", () => {
    expect(dragDestinationLabel(createProjectDate("2026-01-05"), 0)).toBe(
      "05/01/2026",
    );
  });

  test("cruza el cambio de mes sin inventar días", () => {
    expect(dragDestinationLabel(createProjectDate("2026-01-30"), 3)).toBe(
      "02/02/2026",
    );
  });

  test("cruza el cambio de año", () => {
    expect(dragDestinationLabel(createProjectDate("2026-12-30"), 3)).toBe(
      "02/01/2027",
    );
  });

  test("no modifica la fecha que recibe", () => {
    const inicio = createProjectDate("2026-01-05");
    dragDestinationLabel(inicio, 10);

    expect(inicio.getDate()).toBe(5);
  });
});
