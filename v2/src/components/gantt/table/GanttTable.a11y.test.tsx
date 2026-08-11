/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import GanttTable from "./GanttTable";
import type { GanttTask } from "@/components/gantt/types";

/**
 * Cada celda que se edita dice de qué tarea y de qué columna es.
 *
 * La tabla es lo que más se usa de la app, y al entrar en edición aparecía un
 * campo sin nombre. Con 240 tareas por siete columnas editables, eso son más de
 * mil seiscientos campos que un lector de pantalla anuncia sin decir qué son.
 *
 * **El texto sale del título de la columna, no escrito a mano.** Duplicarlo
 * habría dejado la tabla diciendo «Duración» arriba y otra cosa en el campo el
 * día que alguien renombrara la columna, que es la misma clase de duplicado que
 * ya cerró el guardián `limitesUnaSolaVez`.
 */
function tarea(): GanttTask {
  return {
    id: 7,
    name: "LOCALIZACIÓN Y REPLANTEO",
    start: new Date("2026-05-04"),
    finish: new Date("2026-05-04"),
    duration: 1,
    progress: 0,
    isCritical: false,
    isMilestone: false,
    isSummary: false,
    outlineLevel: 1,
    dependencies: [],
  };
}

describe("las celdas editables de la tabla tienen nombre", () => {
  function editar(testid: string) {
    render(<GanttTable tasks={[tarea()]} onUpdateTask={() => {}} />);
    // El doble clic va sobre la celda de dentro, no sobre el `<td>`.
    const celda = screen.getByTestId(testid);
    fireEvent.doubleClick(celda.querySelector(".gantt-editable-cell")!);
  }

  test("la duración se anuncia con su columna y su tarea", () => {
    editar("cell-duration-7");

    expect(
      screen.getByRole("spinbutton", {
        name: /Duración.*LOCALIZACIÓN Y REPLANTEO/i,
      }),
    ).toBeInTheDocument();
  });

  test("la fecha de inicio, igual", () => {
    editar("cell-start-7");

    const campo = screen
      .getByTestId("cell-start-7")
      .querySelector("input");

    expect(campo?.getAttribute("aria-label")).toMatch(
      /LOCALIZACIÓN Y REPLANTEO/,
    );
  });

  test("la celda en reposo también se anuncia, porque se puede enfocar", () => {
    // Lleva `tabindex="0"`: se llega a ella tabulando. Lo único que decía era
    // «Doble clic o Enter para editar» —una instrucción, no un nombre—, así que
    // se oía la misma frase en cada una de las cientos de celdas de la tabla
    // sin saber nunca sobre cuál se estaba.
    render(<GanttTable tasks={[tarea()]} onUpdateTask={() => {}} />);

    const celda = screen
      .getByTestId("cell-duration-7")
      .querySelector(".gantt-editable-cell");

    expect(celda).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/Duración de LOCALIZACIÓN Y REPLANTEO/),
    );
  });

  test("el nombre del campo sale del título de la columna, no de una copia", () => {
    // Si mañana la columna pasa a llamarse de otra forma, el campo la sigue.
    // Comprobarlo aquí es lo que impide que las dos versiones se separen.
    const { container } = render(
      <GanttTable tasks={[tarea()]} onUpdateTask={() => {}} />,
    );

    const nombre = container
      .querySelector('[data-testid="cell-duration-7"] .gantt-editable-cell')
      ?.getAttribute("aria-label");
    const tituloColumna = [...container.querySelectorAll("th")]
      .map((th) => th.textContent?.trim() ?? "")
      .find((texto) => nombre?.startsWith(texto) && texto.length > 2);

    // Que exista un encabezado cuyo texto es el principio del nombre del campo
    // es la prueba de que uno sale del otro y no de dos textos paralelos.
    expect(tituloColumna).toBeTruthy();
    expect(nombre).toBe(`${tituloColumna} de LOCALIZACIÓN Y REPLANTEO`);
  });
});
