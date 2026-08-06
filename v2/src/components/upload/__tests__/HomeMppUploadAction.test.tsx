/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import HomeMppUploadAction from "../HomeMppUploadAction";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function selectFile(name: string, size = 3) {
  const input = screen.getByLabelText("Seleccionar archivo .mpp");
  const file = new File(["x".repeat(size)], name, {
    type: "application/octet-stream",
  });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("HomeMppUploadAction", () => {
  beforeEach(() => {
    push.mockClear();
  });

  test("posts the original .mpp file to the shared server import endpoint", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      url: "/project/42",
      json: async () => ({}),
    }) as unknown as typeof fetch;

    render(<HomeMppUploadAction />);
    const input = screen.getByLabelText("Seleccionar archivo .mpp");

    expect(input).toHaveAttribute("name", "file");
    expect(input).toHaveAttribute("accept", ".mpp");

    selectFile("cronograma.mpp");

    expect(
      screen.getByRole("button", { name: /importando/i }),
    ).toHaveTextContent("Importando...");

    await screen.findByRole("button", { name: /subir archivo \.mpp/i });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/import-mpp",
      expect.objectContaining({ method: "POST" }),
    );
    expect(push).toHaveBeenCalledWith("/project/42");
  });

  test("limpia el valor del input tras procesar la seleccion para permitir reintentar con el mismo archivo", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "No se pudo guardar el proyecto importado" }),
    }) as unknown as typeof fetch;

    render(<HomeMppUploadAction />);
    const input = screen.getByLabelText(
      "Seleccionar archivo .mpp",
    ) as HTMLInputElement;

    const valueSetter = jest.spyOn(input, "value", "set");

    selectFile("cronograma.mpp");
    await screen.findByText("No se pudo guardar el proyecto importado");

    expect(valueSetter).toHaveBeenCalledWith("");

    valueSetter.mockRestore();
  });

  test("rejects non-mpp files inline before submitting", async () => {
    global.fetch = jest.fn();

    render(<HomeMppUploadAction />);
    selectFile("cronograma.xml");

    expect(
      await screen.findByText(
        "Selecciona un archivo Microsoft Project con extension .mpp",
      ),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("rejects oversized files inline before submitting", async () => {
    global.fetch = jest.fn();

    render(<HomeMppUploadAction />);
    const bytesOverLimit = 50 * 1024 * 1024 + 1;
    selectFile("cronograma.mpp", bytesOverLimit);

    expect(
      await screen.findByText("El archivo supera el maximo de 50 MB"),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("muestra el error del servidor dentro de la pagina y rehabilita el boton", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "No se pudo guardar el proyecto importado" }),
    }) as unknown as typeof fetch;

    render(<HomeMppUploadAction />);
    selectFile("cronograma.mpp");

    expect(
      await screen.findByText("No se pudo guardar el proyecto importado"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button")).not.toBeDisabled();
    expect(screen.getByRole("button")).toHaveTextContent("Subir Archivo .mpp");
  });

  test("mientras importa muestra la fase y deja cancelar (E4)", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    global.fetch = jest.fn(
      () => new Promise((resolve) => { resolveFetch = resolve; }),
    ) as jest.Mock;

    render(<HomeMppUploadAction />);

    const input = screen.getByLabelText("Seleccionar archivo .mpp");
    fireEvent.change(input, {
      target: { files: [new File(["mpp"], "obra.mpp")] },
    });

    expect(await screen.findByText(/analizando/i)).toBeInTheDocument();

    const cancel = screen.getByTestId("cancel-import");
    fireEvent.click(cancel);

    expect(await screen.findByText(/importación cancelada/i)).toBeInTheDocument();
    resolveFetch({ ok: true, status: 200, url: "/project/1", json: async () => ({}) });
  });

  test.each([
    [400, "Archivo invalido"],
    [400, "Selecciona un archivo Microsoft Project con extension .mpp"],
    [413, "El archivo excede el tamano maximo permitido"],
    [422, "No se pudo interpretar el archivo .mpp"],
  ])(
    "muestra el error del servidor para status %i",
    async (status, errorMessage) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ error: errorMessage }),
      }) as unknown as typeof fetch;

      render(<HomeMppUploadAction />);
      selectFile("cronograma.mpp");

      expect(await screen.findByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole("button")).not.toBeDisabled();
    },
  );
});
