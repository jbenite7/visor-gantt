/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import SharedProjectView from "./SharedProjectView";

jest.mock("@/components/views/GanttView", () => ({
  __esModule: true,
  default: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="gantt-view" data-readonly={String(Boolean(readOnly))} />
  ),
}));

const base = {
  token: "tok-123",
  projectName: "Estación 16",
  tasks: [],
  calendar: undefined,
  expiresAt: "2026-08-17T09:00:00.000Z",
};

describe("SharedProjectView (E51: la pantalla del enlace)", () => {
  test("monta el Gantt en solo lectura, no en modo normal", () => {
    render(<SharedProjectView {...base} />);

    expect(screen.getByTestId("gantt-view")).toHaveAttribute(
      "data-readonly",
      "true",
    );
  });

  test("dice hasta cuándo vale el enlace, en vez de dejarlo caducar de sorpresa", () => {
    render(<SharedProjectView {...base} />);

    expect(screen.getByTestId("share-expiry")).toHaveTextContent(/17/);
  });

  test("ofrece quedárselo, que es el motivo de negocio de todo esto", () => {
    render(<SharedProjectView {...base} />);

    const enlace = screen.getByTestId("share-adopt");
    // Lleva al login con el destino puesto: al volver, se adopta sin repetir
    // la subida. Pedirle el archivo otra vez seria pedir esfuerzo en el peor
    // momento.
    expect(enlace).toHaveAttribute(
      "href",
      expect.stringContaining("/login?next="),
    );
    expect(enlace.getAttribute("href")).toContain("tok-123");
  });

  test("deja claro que no se puede editar, para no prometer lo que no da", () => {
    render(<SharedProjectView {...base} />);

    expect(screen.getByTestId("share-readonly-notice")).toBeInTheDocument();
  });
});
