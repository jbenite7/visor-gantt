/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import TemplatePicker from "./TemplatePicker";
import { FACTORY_TEMPLATES } from "@/lib/matrix/templateCatalog";

describe("TemplatePicker", () => {
  test("lista las plantillas de fábrica", () => {
    render(
      <TemplatePicker
        canGenerateFromSchedule={false}
        onPickTemplate={jest.fn()}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    for (const template of FACTORY_TEMPLATES) {
      expect(screen.getByRole("button", { name: template.name })).toBeInTheDocument();
    }
  });

  test("elegir una plantilla la devuelve entera", () => {
    const onPickTemplate = jest.fn();
    render(
      <TemplatePicker
        canGenerateFromSchedule={false}
        onPickTemplate={onPickTemplate}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: FACTORY_TEMPLATES[0].name }));

    expect(onPickTemplate).toHaveBeenCalledWith(FACTORY_TEMPLATES[0]);
  });

  test("las plantillas propias salen en su propia sección", () => {
    render(
      <TemplatePicker
        ownTemplates={[
          {
            id: "propia-1",
            name: "Mi torre tipo",
            scopeTree: [],
            areas: [],
            recipes: [],
          },
        ]}
        canGenerateFromSchedule={false}
        onPickTemplate={jest.fn()}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    expect(screen.getByTestId("template-picker-own")).toHaveTextContent("Mi torre tipo");
  });

  test("sin plantillas propias lo dice en vez de dejar el hueco vacío", () => {
    render(
      <TemplatePicker
        canGenerateFromSchedule={false}
        onPickTemplate={jest.fn()}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    expect(screen.getByTestId("template-picker-own")).toHaveTextContent(
      "Todavía no has guardado ninguna matriz como plantilla.",
    );
  });

  test("con un cronograma cargado ofrece generar la matriz desde él", () => {
    const onGenerateFromSchedule = jest.fn();
    render(
      <TemplatePicker
        canGenerateFromSchedule
        onPickTemplate={jest.fn()}
        onGenerateFromSchedule={onGenerateFromSchedule}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Generar matriz desde el cronograma" }),
    );

    expect(onGenerateFromSchedule).toHaveBeenCalledTimes(1);
  });

  test("sin cronograma cargado explica por qué no se puede generar", () => {
    render(
      <TemplatePicker
        canGenerateFromSchedule={false}
        onPickTemplate={jest.fn()}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Generar matriz desde el cronograma" }),
    ).toBeDisabled();
    expect(screen.getByTestId("template-picker-generate-hint")).toHaveTextContent(
      "Carga primero un cronograma para que la matriz proponga alcances y ubicaciones.",
    );
  });

  test("la plantilla que entrega no es la del catálogo: editarla no lo altera", () => {
    const onPickTemplate = jest.fn();
    render(
      <TemplatePicker
        canGenerateFromSchedule={false}
        onPickTemplate={onPickTemplate}
        onGenerateFromSchedule={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: FACTORY_TEMPLATES[0].name }));

    const entregada = onPickTemplate.mock.calls[0][0];
    expect(entregada).not.toBe(FACTORY_TEMPLATES[0]);
    expect(entregada.name).toBe(FACTORY_TEMPLATES[0].name);
  });
});
