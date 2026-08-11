/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
// El editor llama a acciones de servidor al montarse; sin esto el módulo
// arrastra dependencias de Node que jsdom no tiene.
jest.mock("@/app/actions/project", () => ({
  saveMatrixTemplate: jest.fn(async () => ({ success: true, id: "t1" })),
  listMatrixTemplates: jest.fn(async () => []),
}));

import MatrixEditorView from "./MatrixEditorView";
import { createDefaultMatrixPlan } from "@/lib/matrix/templates";

/**
 * Los campos de la matriz **ya tenían nombre**, y esto lo deja probado.
 *
 * El barrido de campos mudos marcó siete aquí. Al mirarlos a ojo resultaron
 * **falsos positivos**: cada uno vive dentro de un `<label>` que lo envuelve
 * —«Nombre», «Inicio», «Cantidad»—, y esa asociación implícita ya da nombre
 * accesible. La heurística solo buscaba `aria-label`, `title` y `placeholder`,
 * así que no veía la forma más común y más correcta de nombrar un campo.
 *
 * Se prueba en vez de anotarse porque «lo comprobé y estaba bien» no impide que
 * mañana alguien saque el campo de su `<label>` para recolocar el diseño. Y se
 * consulta **por el nombre**, que es como lo encuentra quien usa un lector de
 * pantalla: si el nombre desaparece, esto se pone rojo.
 *
 * Es el mismo aviso que ya está escrito en `docs/barridos-por-clase.md`: esa
 * heurística es frágil, y la muestra se mira antes de tocar nada.
 */
describe("los campos de la matriz se encuentran por su nombre", () => {
  beforeEach(() => {
    render(
      <MatrixEditorView
        matrixPlan={createDefaultMatrixPlan({
          id: "p1",
          name: "Torre",
          startDate: "2026-03-02",
        })}
        tasks={[]}
        onApplyMatrixPlan={jest.fn()}
        onSyncFromGantt={jest.fn()}
      />,
    );
  });

  test("el nombre del plan", () => {
    expect(screen.getByLabelText(/Nombre/i)).toBeInTheDocument();
  });

  test("la fecha de inicio", () => {
    expect(screen.getByLabelText(/Inicio/i)).toBeInTheDocument();
  });
});
