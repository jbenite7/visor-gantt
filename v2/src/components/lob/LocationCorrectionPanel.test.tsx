/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
// La suite no tiene `user-event` instalado: se usa `fireEvent`, como el resto.
import { fireEvent, render, screen } from "@testing-library/react";
import LocationCorrectionPanel from "./LocationCorrectionPanel";
import {
  EMPTY_DETECTION_DICTIONARY,
  rememberCorrection,
} from "@/lib/scheduling/detection/dictionary";
import type { GanttTask } from "@/components/gantt/types";

function task(
  overrides: Partial<GanttTask> & { id: string | number },
): GanttTask {
  return {
    name: `Tarea ${overrides.id}`,
    start: new Date("2026-01-05T08:00:00"),
    finish: new Date("2026-01-09T17:00:00"),
    duration: 5,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
    ...overrides,
  };
}

describe("LocationCorrectionPanel (R4)", () => {
  test("muestra la ubicación que el motor asignó a cada tarea", () => {
    render(
      <LocationCorrectionPanel
        tasks={[task({ id: 1, name: "Mampostería Piso 4" })]}
        dictionary={EMPTY_DETECTION_DICTIONARY}
        onCorrect={jest.fn()}
      />,
    );

    expect(screen.getByTestId("correction-detected-1")).toHaveTextContent(
      "Piso 4",
    );
  });

  test("dice cuáles quedaron sin ubicar, en vez de esconderlas", () => {
    render(
      <LocationCorrectionPanel
        tasks={[task({ id: 2, name: "Instalación de redes secas" })]}
        dictionary={EMPTY_DETECTION_DICTIONARY}
        onCorrect={jest.fn()}
      />,
    );

    expect(screen.getByTestId("correction-detected-2")).toHaveTextContent(
      "Obra general",
    );
  });

  test("corregir entrega el nombre de la tarea, el valor y el motivo", () => {
    const onCorrect = jest.fn();
    render(
      <LocationCorrectionPanel
        tasks={[task({ id: 2, name: "Instalación de redes secas" })]}
        dictionary={EMPTY_DETECTION_DICTIONARY}
        onCorrect={onCorrect}
      />,
    );

    fireEvent.change(
      screen.getByLabelText("Nivel corregido de Instalación de redes secas"),
      { target: { value: "4" } },
    );
    fireEvent.change(
      screen.getByLabelText(
        "Motivo de la corrección de Instalación de redes secas",
      ),
      { target: { value: "Va en el piso 4" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Corregir Instalación de redes secas",
      }),
    );

    expect(onCorrect).toHaveBeenCalledWith({
      taskName: "Instalación de redes secas",
      value: "4",
      note: "Va en el piso 4",
    });
  });

  test("sin motivo no se guarda: en seis meses nadie sabría si sigue haciendo falta", () => {
    const onCorrect = jest.fn();
    render(
      <LocationCorrectionPanel
        tasks={[task({ id: 2, name: "Instalación de redes secas" })]}
        dictionary={EMPTY_DETECTION_DICTIONARY}
        onCorrect={onCorrect}
      />,
    );

    fireEvent.change(
      screen.getByLabelText("Nivel corregido de Instalación de redes secas"),
      { target: { value: "4" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Corregir Instalación de redes secas",
      }),
    );

    expect(onCorrect).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Escribe por qué la corriges",
    );
  });

  test("sin nivel tampoco se guarda, y lo dice", () => {
    const onCorrect = jest.fn();
    render(
      <LocationCorrectionPanel
        tasks={[task({ id: 2, name: "Instalación de redes secas" })]}
        dictionary={EMPTY_DETECTION_DICTIONARY}
        onCorrect={onCorrect}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Corregir Instalación de redes secas",
      }),
    );

    expect(onCorrect).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("nivel");
  });

  test("una tarea ya corregida se marca como corregida a mano", () => {
    render(
      <LocationCorrectionPanel
        tasks={[task({ id: 2, name: "Instalación de redes secas" })]}
        // La clave se construye con `rememberCorrection`, no a mano: escribirla
        // a mano en minúsculas hacía que no coincidiera con la normalizada, y el
        // test pasaba a comprobar el caso contrario del que dice comprobar.
        dictionary={rememberCorrection(EMPTY_DETECTION_DICTIONARY, {
          kind: "ubicacion",
          name: "Instalación de redes secas",
          value: "4",
          note: "Va en el piso 4",
          recordedAt: "2026-08-08T10:00:00.000Z",
        })}
        onCorrect={jest.fn()}
      />,
    );

    expect(screen.getByTestId("correction-source-2")).toHaveTextContent(
      "Corregida a mano",
    );
    expect(screen.getByTestId("correction-detected-2")).toHaveTextContent(
      "Piso 4",
    );
  });
});
