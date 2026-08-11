/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import SharedProjectView from "./SharedProjectView";

/** Lo que el Gantt recibió de verdad en el último render. */
let recibido: Record<string, unknown> = {};

jest.mock("@/components/views/GanttView", () => ({
  __esModule: true,
  default: (props: { readOnly?: boolean }) => {
    recibido = props;
    return (
      <div
        data-testid="gantt-view"
        data-readonly={String(Boolean(props.readOnly))}
      />
    );
  },
}));

const base = {
  token: "tok-123",
  projectName: "Estación 16",
  data: {
    tasks: [],
    resources: [{ id: 1, name: "Cuadrilla de obra negra" }],
    budgetItems: [{ id: "p1", name: "Concreto" }],
  } as never,
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

  test("le pasa al Gantt los recursos y el presupuesto, no solo las tareas", () => {
    // La barra lateral de este Gantt ofrece Recursos y Presupuesto. Antes solo
    // le llegaban las tareas, así que el visitante abría esas pantallas y las
    // veía vacías teniendo el dato la base. Se comprueba el dato que llega, no
    // la lista de props: es lo que decide lo que el visitante ve.
    render(<SharedProjectView {...base} />);

    expect(recibido.resources).toHaveLength(1);
    expect(recibido.budgetItems).toHaveLength(1);
  });

  test("deja claro que no se puede editar, para no prometer lo que no da", () => {
    render(<SharedProjectView {...base} />);

    expect(screen.getByTestId("share-readonly-notice")).toBeInTheDocument();
  });
});
