/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

// La página importa la acción de servidor, que arrastra el cliente de base de
// datos. Aquí interesa lo que ve el usuario, no la conexión.
jest.mock("@/app/actions/auth", () => ({
  loginAction: jest.fn(),
}));

import LoginPage from "./page";

describe("la entrada no castiga al que se equivoca (E9)", () => {
  test("conserva el correo escrito tras un intento fallido", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          error: "credenciales",
          correo: "residente@obra.co",
        }),
      }),
    );

    expect(screen.getByLabelText(/correo/i)).toHaveValue("residente@obra.co");
  });

  test("el error se muestra junto al campo, no como cartel suelto", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "credenciales" }),
      }),
    );

    const error = screen.getByTestId("login-error");
    expect(error).toHaveTextContent("El correo o la contraseña no coinciden.");
    expect(error).toHaveAttribute("role", "alert");
  });

  test("un texto arbitrario en la URL no llega a pantalla", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ error: "Llama al 300 123 4567" }),
      }),
    );

    expect(screen.queryByTestId("login-error")).not.toBeInTheDocument();
    expect(screen.queryByText(/300 123 4567/)).not.toBeInTheDocument();
  });

  test("hay salida para quien no recuerda la contraseña", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByText(/quien administra el proyecto/i),
    ).toBeInTheDocument();
  });

  test("sin error, no se pinta ningún aviso", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByTestId("login-error")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/correo/i)).toHaveValue("");
  });
});

describe("sesión expirada (E18)", () => {
  test("explica por qué te sacó, no solo pide entrar de nuevo", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          motivo: "sesion-expirada",
          next: "/project/42",
        }),
      }),
    );

    expect(screen.getByTestId("login-motivo")).toHaveTextContent(
      /sesión.*(caducó|expiró)/i,
    );
  });

  test("recuerda el destino para volver a él", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ next: "/project/42" }),
      }),
    );

    const hidden = document.querySelector<HTMLInputElement>(
      'input[name="next"]',
    );
    expect(hidden).toHaveValue("/project/42");
  });

  test("un destino externo no se respeta", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ next: "//evil.example.com" }),
      }),
    );

    const hidden = document.querySelector<HTMLInputElement>(
      'input[name="next"]',
    );
    expect(hidden).toHaveValue("");
  });
});
