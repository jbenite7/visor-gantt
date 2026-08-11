/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AnonymousMppUpload from "./AnonymousMppUpload";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function subir(nombre = "obra.mpp") {
  const input = screen.getByLabelText(/ver un \.mpp sin cuenta/i);
  const file = new File([new Uint8Array([1])], nombre, {
    type: "application/octet-stream",
  });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ token: "tok-123" }),
  })) as unknown as typeof fetch;
});

/**
 * La entrada de E51, y va en `/login`.
 *
 * El plan la ponía en la home, pero la home **redirige a `/login` si no hay
 * sesión**: quien no tiene cuenta no la ve nunca. Un botón ahí sería una
 * función construida que nadie puede alcanzar, que es justo el patrón que este
 * trabajo existe para eliminar.
 */
describe("AnonymousMppUpload", () => {
  test("ofrece ver un cronograma sin crear cuenta", () => {
    render(<AnonymousMppUpload />);

    expect(
      screen.getByLabelText(/ver un \.mpp sin cuenta/i),
    ).toBeInTheDocument();
  });

  test("al elegir archivo, lleva al enlace que devuelve el servidor", async () => {
    render(<AnonymousMppUpload />);

    subir();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/ver/tok-123"));
  });

  test("mientras sube, lo dice y no deja subir otra vez", async () => {
    let resolver: (v: unknown) => void = () => {};
    global.fetch = jest.fn(
      () => new Promise((r) => (resolver = r)),
    ) as unknown as typeof fetch;

    render(<AnonymousMppUpload />);
    subir();

    await screen.findByText(/leyendo tu cronograma/i);
    expect(screen.getByLabelText(/ver un \.mpp sin cuenta/i)).toBeDisabled();

    resolver({ ok: true, json: async () => ({ token: "t" }) });
  });

  test("un error del servidor se enseña con sus palabras, no con un código", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({
        error: "El archivo supera el máximo de 50 MB",
      }),
    })) as unknown as typeof fetch;

    render(<AnonymousMppUpload />);
    subir();

    expect(
      await screen.findByText(/supera el máximo de 50 MB/i),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  test("si la red falla, no se queda colgado diciendo que sube", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch;

    render(<AnonymousMppUpload />);
    subir();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/ver un \.mpp sin cuenta/i)).not.toBeDisabled();
  });
});
