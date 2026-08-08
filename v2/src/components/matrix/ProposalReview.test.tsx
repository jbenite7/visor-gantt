/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ProposalReview from "./ProposalReview";
import type { MatrixProposal } from "@/lib/matrix/matrixProposal";

function propuesta(): MatrixProposal {
  return {
    locations: [
      {
        id: "piso-1",
        name: "Piso 1",
        type: "Piso",
        order: 1,
        taskCount: 2,
        evidence: "«Piso 1» aparece en 2 tareas del cronograma.",
      },
      {
        id: "piso-2",
        name: "Piso 2",
        type: "Piso",
        order: 2,
        taskCount: 2,
        evidence: "«Piso 2» aparece en 2 tareas del cronograma.",
      },
    ],
    scopes: [
      {
        id: "mamposteria",
        name: "Mampostería",
        locationIds: ["piso-1", "piso-2"],
        evidence: "«Mampostería» se programa en 2 ubicaciones.",
      },
    ],
    recipes: [
      {
        id: "receta-mamposteria",
        scopeId: "mamposteria",
        name: "Mampostería",
        activities: [
          {
            id: "actividad-mamposteria",
            name: "Mampostería",
            medianDurationDays: 5,
            observedIn: 3,
          },
        ],
        confidence: 0.3,
        evidence: "«Mampostería» aparece en 3 ubicaciones, con 5 días de mediana.",
      },
    ],
    skippedTaskCount: 1,
    summary: "Se proponen 2 ubicaciones, 1 alcances y 1 recetas a partir de 4 tareas.",
  };
}

describe("ProposalReview", () => {
  test("enseña el resumen de lo propuesto antes que nada", () => {
    render(
      <ProposalReview proposal={propuesta()} onAccept={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(screen.getByTestId("proposal-summary")).toHaveTextContent(
      "Se proponen 2 ubicaciones",
    );
  });

  test("cada elemento propuesto muestra su evidencia", () => {
    render(
      <ProposalReview proposal={propuesta()} onAccept={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(screen.getByText("«Piso 1» aparece en 2 tareas del cronograma.")).toBeInTheDocument();
    expect(
      screen.getByText("«Mampostería» aparece en 3 ubicaciones, con 5 días de mediana."),
    ).toBeInTheDocument();
  });

  test("todo llega aceptado, porque el usuario pidió generarlo", () => {
    const onAccept = jest.fn();
    render(
      <ProposalReview proposal={propuesta()} onAccept={onAccept} onCancel={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Crear la matriz" }));

    expect(onAccept).toHaveBeenCalledWith({
      locationIds: ["piso-1", "piso-2"],
      scopeIds: ["mamposteria"],
      recipeIds: ["receta-mamposteria"],
    });
  });

  test("descartar un elemento lo deja fuera de lo aceptado", () => {
    const onAccept = jest.fn();
    render(
      <ProposalReview proposal={propuesta()} onAccept={onAccept} onCancel={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Piso 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear la matriz" }));

    expect(onAccept).toHaveBeenCalledWith({
      locationIds: ["piso-1"],
      scopeIds: ["mamposteria"],
      recipeIds: ["receta-mamposteria"],
    });
  });

  test("una propuesta vacía lo dice y no ofrece crear nada", () => {
    render(
      <ProposalReview
        proposal={{
          locations: [],
          scopes: [],
          recipes: [],
          skippedTaskCount: 0,
          summary:
            "Este cronograma no repite ninguna actividad en tres o más ubicaciones, así que no hay recetas que proponer.",
        }}
        onAccept={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId("proposal-summary")).toHaveTextContent(
      "no repite ninguna actividad",
    );
    expect(screen.getByRole("button", { name: "Crear la matriz" })).toBeDisabled();
  });

  test("cancelar avisa sin construir nada", () => {
    const onCancel = jest.fn();
    render(
      <ProposalReview proposal={propuesta()} onAccept={jest.fn()} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Descartar la propuesta" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
