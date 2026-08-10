import {
  designFindingStatus,
  readDoc,
  shippedExperiments,
} from "./docsConsistency";

describe("Sincronía entre EXPERIMENTS.md y DESIGN.md (R3)", () => {
  const experiments = readDoc("EXPERIMENTS.md");
  const design = readDoc("DESIGN.md");

  test("se leen experimentos ya enviados con su hallazgo de origen", () => {
    const enviados = shippedExperiments(experiments);

    expect(enviados.length).toBeGreaterThan(20);
    expect(enviados.find((item) => item.id === "E1")?.findings).toEqual([2]);
    expect(enviados.find((item) => item.id === "E45")?.findings).toEqual([
      7, 22, 40,
    ]);
  });

  test("ningún hallazgo cerrado por un experimento enviado sigue marcado open", () => {
    const mentiras = shippedExperiments(experiments).flatMap((experiment) =>
      experiment.findings
        .filter((finding) => designFindingStatus(design, finding) === "open")
        .map(
          (finding) =>
            `#${finding} sigue open pero ${experiment.id} está shipped`,
        ),
    );

    expect(mentiras).toEqual([]);
  });
});

describe("EXPERIMENTS.md dice la verdad sobre sí mismo (R3)", () => {
  const experiments = readDoc("EXPERIMENTS.md");

  test("E38 ya no atribuye a los encabezados un sistema responsivo que no tenían", () => {
    expect(experiments).not.toContain(
      "tienen sistema responsivo propio con abreviaturas",
    );
  });

  test("la cobertura del deshacer solo declara abiertos los casos que siguen abiertos", () => {
    expect(experiments).not.toContain(
      "`handleSyncMatrixFromGantt`, el reset de columnas",
    );
    expect(experiments).toContain(
      "el borrado de proyecto (permanente en servidor)",
    );
  });

  test("el borrado de proyecto se declara irreversible por diseño, no como deuda", () => {
    expect(experiments).toContain("irreversible por diseño");
  });
});
