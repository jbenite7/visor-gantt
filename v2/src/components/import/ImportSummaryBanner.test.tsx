/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import ImportSummaryBanner from "./ImportSummaryBanner";

describe("ImportSummaryBanner", () => {
  test("dice qué se importó al llegar del .mpp", () => {
    render(
      <ImportSummaryBanner summary={{ tasks: 239, dependencies: 212, resources: 0 }} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Se importaron 239 tareas y 212 dependencias.",
    );
  });

  test("sin resumen no ocupa espacio en la pantalla", () => {
    const { container } = render(<ImportSummaryBanner summary={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test("se puede cerrar", () => {
    render(
      <ImportSummaryBanner summary={{ tasks: 5, dependencies: 0, resources: 0 }} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
