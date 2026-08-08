/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import FeedbackPanel from "./FeedbackPanel";
import type { MatrixPlan } from "@/types/matrix";

function plan(): MatrixPlan {
  return {
    id: "p1",
    name: "Torre",
    startDate: "2026-03-02",
    scopeTree: [{ id: "estructura", name: "Estructura", type: "Disciplina" }],
    areas: [{ id: "piso-1", name: "Piso 1", type: "Piso" }],
    recipes: [{ id: "r1", name: "Estructura", activities: [], dependencies: [] }],
    cells: [
      {
        id: "c1",
        scopeId: "estructura",
        areaId: "piso-1",
        recipeId: "r1",
        active: true,
        productivityOverridePerDay: 4,
        feedback: {
          source: "gantt",
          observedDurationDays: 8,
          suggestedProductivityPerDay: 2.5,
          status: "pendingApproval",
        },
      },
    ],
  };
}

describe("FeedbackPanel", () => {
  test("nombra el alcance y la ubicación de cada observación", () => {
    render(<FeedbackPanel plan={plan()} onApprove={jest.fn()} onDismiss={jest.fn()} />);

    expect(screen.getByTestId("feedback-item-c1")).toHaveTextContent("Estructura · Piso 1");
  });

  test("enseña lo observado frente a lo planificado", () => {
    render(<FeedbackPanel plan={plan()} onApprove={jest.fn()} onDismiss={jest.fn()} />);

    expect(screen.getByTestId("feedback-item-c1")).toHaveTextContent(
      "En obra tardó 8 días. El rendimiento real es 2,5 por día, frente a 4 planificado.",
    );
  });

  test("aprobar avisa con la celda", () => {
    const onApprove = jest.fn();
    render(<FeedbackPanel plan={plan()} onApprove={onApprove} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Usar el rendimiento real" }));

    expect(onApprove).toHaveBeenCalledWith("c1");
  });

  test("descartar avisa con la celda", () => {
    const onDismiss = jest.fn();
    render(<FeedbackPanel plan={plan()} onApprove={jest.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole("button", { name: "Mantener lo planificado" }));

    expect(onDismiss).toHaveBeenCalledWith("c1");
  });

  test("sin observaciones explica qué hace falta para que aparezcan", () => {
    render(
      <FeedbackPanel
        plan={{ ...plan(), cells: [] }}
        onApprove={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(screen.getByTestId("feedback-empty")).toHaveTextContent(
      "Aún no hay rendimientos observados. Aparecerán cuando se reporte avance real sobre las tareas que generó la matriz.",
    );
  });
});
