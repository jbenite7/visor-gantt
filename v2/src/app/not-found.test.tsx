/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

describe("página 404 (F5)", () => {
  test("habla en español, no en inglés de fábrica", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading")).toHaveTextContent(
      /no encontramos esta página/i,
    );
    expect(document.body.textContent).not.toMatch(/could not be found/i);
  });

  test("ofrece una salida a los cronogramas", () => {
    render(<NotFound />);

    const link = screen.getByRole("link", { name: /cronogramas/i });
    expect(link).toHaveAttribute("href", "/");
  });

  test("explica qué pudo pasar en vez de dejar al usuario a ciegas", () => {
    render(<NotFound />);
    expect(screen.getByTestId("not-found-hint")).toHaveTextContent(/enlace/i);
  });
});
