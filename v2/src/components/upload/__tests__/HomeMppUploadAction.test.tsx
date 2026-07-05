/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import HomeMppUploadAction from "../HomeMppUploadAction";

const requestSubmit = jest.fn();

function selectFile(name: string, size = 3) {
  const input = screen.getByLabelText("Seleccionar archivo .mpp");
  const file = new File(["x".repeat(size)], name, {
    type: "application/octet-stream",
  });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("HomeMppUploadAction", () => {
  beforeEach(() => {
    requestSubmit.mockClear();
    Object.defineProperty(HTMLFormElement.prototype, "requestSubmit", {
      configurable: true,
      value: requestSubmit,
    });
  });

  test("posts the original .mpp file to the shared server import endpoint", () => {
    const { container } = render(<HomeMppUploadAction />);
    const form = container.querySelector("form");
    const input = screen.getByLabelText("Seleccionar archivo .mpp");

    expect(form).toHaveAttribute("action", "/api/import-mpp");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("enctype", "multipart/form-data");
    expect(input).toHaveAttribute("name", "file");
    expect(input).toHaveAttribute("accept", ".mpp");

    selectFile("cronograma.mpp");

    expect(requestSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).toHaveTextContent("Importando...");
  });

  test("rejects non-mpp files inline before submitting", async () => {
    render(<HomeMppUploadAction />);
    selectFile("cronograma.xml");

    expect(
      await screen.findByText(
        "Selecciona un archivo Microsoft Project con extension .mpp",
      ),
    ).toBeInTheDocument();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  test("rejects oversized files inline before submitting", async () => {
    render(<HomeMppUploadAction />);
    const bytesOverLimit = 50 * 1024 * 1024 + 1;
    selectFile("cronograma.mpp", bytesOverLimit);

    expect(
      await screen.findByText("El archivo supera el maximo de 50 MB"),
    ).toBeInTheDocument();
    expect(requestSubmit).not.toHaveBeenCalled();
  });
});
