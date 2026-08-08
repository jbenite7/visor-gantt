/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import RecipeEditor from "./RecipeEditor";
import type { ActivityRecipe } from "@/types/matrix";

function receta(): ActivityRecipe {
  return {
    id: "r1",
    name: "Estructura",
    activities: [
      { id: "columnas", name: "Columnas", productivityPerDay: 2, unit: "un" },
      { id: "losa", name: "Losa", productivityPerDay: 1, unit: "m2" },
    ],
    dependencies: [
      { predecessorActivityId: "columnas", successorActivityId: "losa", type: "FS" },
    ],
  };
}

describe("RecipeEditor", () => {
  test("lista las actividades en su orden", () => {
    render(<RecipeEditor recipe={receta()} onChange={jest.fn()} />);

    const filas = screen.getAllByTestId(/^recipe-activity-/);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("Columnas");
    expect(filas[1]).toHaveTextContent("Losa");
  });

  test("añadir una actividad avisa con la receta nueva", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Nombre de la actividad"), {
      target: { value: "Acero de refuerzo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar actividad" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nueva = onChange.mock.calls[0][0] as ActivityRecipe;
    expect(nueva.activities.map((item) => item.name)).toEqual([
      "Columnas",
      "Losa",
      "Acero de refuerzo",
    ]);
  });

  test("no deja agregar una actividad sin nombre", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar actividad" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Escribe el nombre de la actividad antes de agregarla.",
    );
  });

  test("quitar una actividad avisa sin ella", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Quitar Losa" }));

    const nueva = onChange.mock.calls[0][0] as ActivityRecipe;
    expect(nueva.activities.map((item) => item.id)).toEqual(["columnas"]);
    expect(nueva.dependencies).toHaveLength(0);
  });

  test("subir una actividad la reordena", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Subir Losa" }));

    const nueva = onChange.mock.calls[0][0] as ActivityRecipe;
    expect(nueva.activities.map((item) => item.id)).toEqual(["losa", "columnas"]);
  });

  test("un vínculo en círculo se rechaza con su motivo, sin cambiar la receta", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Actividad anterior"), {
      target: { value: "losa" },
    });
    fireEvent.change(screen.getByLabelText("Actividad siguiente"), {
      target: { value: "columnas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enlazar actividades" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "«Columnas» ya va antes que «Losa»",
    );
  });

  test("muestra los vínculos que ya tiene la receta", () => {
    render(<RecipeEditor recipe={receta()} onChange={jest.fn()} />);

    expect(screen.getByTestId("recipe-dependencies")).toHaveTextContent(
      "Columnas → Losa",
    );
  });

  test("si la actividad elegida desaparece de la receta, el desplegable deja de mostrarla", () => {
    const { rerender } = render(<RecipeEditor recipe={receta()} onChange={jest.fn()} />);

    const sinLosa: ActivityRecipe = {
      ...receta(),
      activities: [{ id: "columnas", name: "Columnas", productivityPerDay: 2, unit: "un" }],
      dependencies: [],
    };
    rerender(<RecipeEditor recipe={sinLosa} onChange={jest.fn()} />);

    const anterior = screen.getByLabelText("Actividad anterior") as HTMLSelectElement;
    const siguiente = screen.getByLabelText("Actividad siguiente") as HTMLSelectElement;
    expect(anterior.value).toBe("columnas");
    expect(siguiente.value).toBe("columnas");
    expect(screen.queryByText("Losa", { selector: "option" })).not.toBeInTheDocument();
  });

  test("una acción exitosa borra un error anterior", () => {
    const onChange = jest.fn();
    render(<RecipeEditor recipe={receta()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar actividad" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quitar Losa" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
