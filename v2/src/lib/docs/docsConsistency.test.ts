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

describe("PRODUCT.md registra C3 revertido (R3)", () => {
  const product = readDoc("PRODUCT.md");

  test("la reversión de C3 está escrita con su motivo", () => {
    expect(product).toContain("Revertido 2026-08-08");
    expect(product).toContain("editor de dependencias");
  });

  test("el Outcome Roadmap ya no anuncia el recorte a 9 vistas como propuesto", () => {
    expect(product).not.toContain(
      "| De 14 vistas a 9 (C1, C2, C3) | Emocional — sobrecarga | **3** | propuesto |",
    );
  });
});

describe("R6 y R7 quedan registrados donde nadie los confunda con trabajo olvidado", () => {
  const experiments = readDoc("EXPERIMENTS.md");

  test("los cuatro pendientes que esperan un dato están escritos con su disparador", () => {
    expect(experiments).toContain("## Pendientes que esperan un dato (R6)");
    for (const pendiente of [
      "Ritmo, no productividad",
      "Abscisas `K12+340`",
      "RUM en obra",
      "Presupuesto desde PDC",
    ]) {
      expect(experiments).toContain(pendiente);
    }
  });

  test("las cuatro decisiones diferidas están escritas con el caso que las obliga", () => {
    expect(experiments).toContain("## Decisiones diferidas (R7)");
    for (const decision of [
      "Cómo dibujar un tramo en la Línea de Balance",
      "El orden entre familias de eje",
      "Deshacer granular más allá de R1",
      "«Fin cambia la duración»",
    ]) {
      expect(experiments).toContain(decision);
    }
  });
});
