/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MPPUploader from "../MPPUploader";
import type { ProjectData } from "@/lib/parser/mpp-parser";

// ---------------------------------------------------------------------------
// Mock parseMPP
// ---------------------------------------------------------------------------

const mockParseMPP = jest.fn();

jest.mock("@/lib/api", () => ({
  parseMPP: (...args: unknown[]) => mockParseMPP(...args),
}));

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockProjectData: ProjectData = {
  name: "Test Project",
  startDate: "2025-01-01",
  finishDate: "2025-12-31",
  tasks: [
    {
      UID: 1,
      ID: 1,
      Name: "Task 1",
      Start: "2025-01-01",
      Finish: "2025-01-15",
      Duration: "PT10D",
      DurationFormat: 7,
      PercentComplete: 0,
      Summary: false,
      Milestone: false,
      OutlineLevel: 1,
      WBS: "1",
    },
  ],
  resources: [],
};

function createFile(name: string, size = 1024): File {
  return new File([new ArrayBuffer(size)], name, {
    type: "application/octet-stream",
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderUploader(
  overrides: Partial<{
    onUploadComplete: (data: ProjectData) => void;
    onError: (error: string) => void;
    disabled: boolean;
  }> = {},
) {
  const onUploadComplete = overrides.onUploadComplete ?? jest.fn();
  const onError = overrides.onError ?? jest.fn();
  const disabled = overrides.disabled ?? false;

  const result = render(
    <MPPUploader
      onUploadComplete={onUploadComplete}
      onError={onError}
      disabled={disabled}
    />,
  );

  return { onUploadComplete, onError, ...result };
}

/**
 * Returns the hidden file <input> inside the component.
 */
function getFileInput(): HTMLInputElement {
  return screen.getByLabelText("Seleccionar archivo .mpp");
}

/**
 * Simulates selecting a file via the hidden input.
 */
function selectFile(file: File): void {
  fireEvent.change(getFileInput(), { target: { files: [file] } });
}

/**
 * Returns the drop zone <div> (the one with onDragEnter/onDrop handlers).
 *
 * DOM structure:
 *   div.w-full.space-y-4        <-- container.firstChild (wrapper)
 *     div.relative.border-2...  <-- the drop zone
 *       input
 *       div.space-y-4           <-- content wrapper
 *         p > "Arrastra tu archivo .mpp aquí"
 */
function getDropZone(container: HTMLElement): HTMLElement {
  const wrapper = container.firstChild as HTMLElement;
  return wrapper.firstChild as HTMLElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  jest.clearAllMocks();
});

describe("MPPUploader", () => {
  // --- Rendering -----------------------------------------------------------

  test("renders drop zone text and button in idle state", () => {
    renderUploader();

    expect(
      screen.getByText("Arrastra tu archivo .mpp aquí"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("o haz clic para seleccionar desde tu equipo"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Seleccionar archivo .mpp" }),
    ).toBeInTheDocument();
  });

  test("renders the hidden file input with correct accept attribute", () => {
    renderUploader();
    const input = getFileInput();
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("accept", ".mpp");
    expect(input).toHaveAttribute("type", "file");
  });

  test("shows max file size hint", () => {
    renderUploader();
    expect(screen.getByText(/Máximo 50 MB/)).toBeInTheDocument();
  });

  // --- Drag state ----------------------------------------------------------

  test("shows dragging text when file is dragged over", () => {
    const { container } = renderUploader();
    const dropZone = getDropZone(container);

    fireEvent.dragEnter(dropZone);

    expect(screen.getByText("Suelta el archivo aquí")).toBeInTheDocument();
  });

  test("returns to idle text when drag leaves", () => {
    const { container } = renderUploader();
    const dropZone = getDropZone(container);

    fireEvent.dragEnter(dropZone);
    fireEvent.dragLeave(dropZone);

    expect(
      screen.getByText("Arrastra tu archivo .mpp aquí"),
    ).toBeInTheDocument();
  });

  // --- File validation -----------------------------------------------------

  test("shows error for non-.mpp file extension", () => {
    const { onError } = renderUploader();
    const invalidFile = createFile("proyecto.xml");

    selectFile(invalidFile);

    expect(
      screen.getByText(/Tipo de archivo no soportado/),
    ).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("Tipo de archivo no soportado"),
    );
  });

  test("shows error for oversized file", () => {
    const { onError } = renderUploader();
    const oversizeFile = createFile("proyecto.mpp", 51 * 1024 * 1024);

    selectFile(oversizeFile);

    expect(
      screen.getByText(/El archivo excede el tamaño máximo/),
    ).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("excede el tamaño máximo"),
    );
  });

  // --- Parsing state -------------------------------------------------------

  test("shows parsing message while file is being processed", async () => {
    mockParseMPP.mockReturnValue(new Promise<never>(() => {}));

    renderUploader();
    selectFile(createFile("proyecto.mpp"));

    expect(await screen.findByText("Parseando archivo...")).toBeInTheDocument();
  });

  test("shows file name during parsing", async () => {
    mockParseMPP.mockReturnValue(new Promise<never>(() => {}));

    renderUploader();
    selectFile(createFile("proyecto.mpp"));

    expect(await screen.findByText("proyecto.mpp")).toBeInTheDocument();
  });

  test("shows 'Procesando...' on button while parsing", async () => {
    mockParseMPP.mockReturnValue(new Promise<never>(() => {}));

    renderUploader();
    selectFile(createFile("proyecto.mpp"));

    expect(
      await screen.findByRole("button", { name: "Procesando..." }),
    ).toBeInTheDocument();
  });

  // --- Success flow --------------------------------------------------------

  test("calls parseMPP with the selected .mpp file", async () => {
    mockParseMPP.mockResolvedValue(mockProjectData);
    const { onUploadComplete } = renderUploader();
    const file = createFile("proyecto.mpp");

    selectFile(file);

    await waitFor(() => {
      expect(mockParseMPP).toHaveBeenCalledTimes(1);
    });
    expect(mockParseMPP).toHaveBeenCalledWith(file);
    expect(onUploadComplete).toHaveBeenCalledWith(mockProjectData);
  });

  test("calls onUploadComplete with parsed data on success", async () => {
    mockParseMPP.mockResolvedValue(mockProjectData);
    const { onUploadComplete } = renderUploader();

    selectFile(createFile("proyecto.mpp"));

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalledWith(mockProjectData);
    });
  });

  // --- Error flow (parse) --------------------------------------------------

  test("shows error message when parseMPP fails", async () => {
    mockParseMPP.mockRejectedValue(new Error("Microservice timeout"));
    const { onError } = renderUploader();

    selectFile(createFile("proyecto.mpp"));

    await waitFor(() => {
      expect(screen.getByText("Microservice timeout")).toBeInTheDocument();
    });
    expect(onError).toHaveBeenCalledWith("Microservice timeout");
  });

  test("shows generic error for non-Error rejections", async () => {
    mockParseMPP.mockRejectedValue("string error");
    const { onError } = renderUploader();

    selectFile(createFile("proyecto.mpp"));

    await waitFor(() => {
      expect(screen.getByText("Error desconocido al parsear el archivo"))
        .toBeInTheDocument();
    });
    expect(onError).toHaveBeenCalledWith(
      "Error desconocido al parsear el archivo",
    );
  });

  // --- Drop handling -------------------------------------------------------

  test("calls parseMPP when file is dropped onto drop zone", async () => {
    mockParseMPP.mockResolvedValue(mockProjectData);
    const { container } = renderUploader();
    const dropZone = getDropZone(container);
    const file = createFile("proyecto.mpp");

    fireEvent.dragEnter(dropZone);
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(mockParseMPP).toHaveBeenCalledWith(file);
    });
  });

  test("ignores drop when disabled", () => {
    const { container } = renderUploader({ disabled: true });
    const dropZone = getDropZone(container);

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [createFile("proyecto.mpp")] },
    });

    expect(mockParseMPP).not.toHaveBeenCalled();
  });

  // --- Disabled state ------------------------------------------------------

  test("disables the button and reduces opacity when disabled prop is true", () => {
    const { container } = renderUploader({ disabled: true });

    const button = screen.getByRole("button", {
      name: "Seleccionar archivo .mpp",
    });
    expect(button).toBeDisabled();

    const dropZone = getDropZone(container);
    expect(dropZone.className).toContain("opacity-50");
    expect(dropZone.className).toContain("pointer-events-none");
  });

  test("does not open file dialog when disabled", () => {
    renderUploader({ disabled: true });
    const input = getFileInput();
    expect(input).toBeDisabled();
  });

  // --- Error display styling ------------------------------------------------

  test("shows error styling on drop zone when error exists", async () => {
    const { container } = renderUploader();
    mockParseMPP.mockRejectedValue(new Error("fail"));

    selectFile(createFile("proyecto.mpp"));

    await waitFor(() => {
      const dropZone = getDropZone(container);
      expect(dropZone.className).toContain("border-red");
    });
  });

  test("renders error icon and message in error banner", async () => {
    mockParseMPP.mockRejectedValue(new Error("Parse error detail"));

    renderUploader();
    selectFile(createFile("proyecto.mpp"));

    await waitFor(() => {
      expect(screen.getByText("Parse error detail")).toBeInTheDocument();
    });
  });
});
