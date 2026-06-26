/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HomeMppUploadAction from "../HomeMppUploadAction";
import { parseMPP } from "@/lib/api";
import { saveProject } from "@/app/actions/project";
import type { ProjectData } from "@/lib/parser/mpp-parser";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

jest.mock("@/lib/api", () => ({
  parseMPP: jest.fn(),
}));

jest.mock("@/app/actions/project", () => ({
  saveProject: jest.fn(),
}));

const mockedParseMPP = parseMPP as jest.MockedFunction<typeof parseMPP>;
const mockedSaveProject = saveProject as jest.MockedFunction<typeof saveProject>;

const parsedProject: ProjectData = {
  name: "Cronograma importado",
  startDate: "2026-01-01",
  finishDate: "2026-01-10",
  tasks: [
    {
      UID: 1,
      ID: 1,
      Name: "Actividad importada",
      Start: "2026-01-01T08:00:00",
      Finish: "2026-01-02T17:00:00",
      Duration: "P2D",
      DurationFormat: 7,
      PercentComplete: 10,
      Summary: false,
      Milestone: false,
      OutlineLevel: 1,
      WBS: "1",
    },
  ],
  resources: [],
};

function selectFile(name: string) {
  const input = screen.getByLabelText("Seleccionar archivo .mpp");
  const file = new File(["mpp"], name, { type: "application/octet-stream" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("HomeMppUploadAction", () => {
  beforeEach(() => {
    push.mockClear();
    mockedParseMPP.mockReset();
    mockedSaveProject.mockReset();
  });

  test("imports a .mpp file from the home without navigating to /upload", async () => {
    mockedParseMPP.mockResolvedValue(parsedProject);
    mockedSaveProject.mockResolvedValue({ success: true, id: "project-42" });

    render(<HomeMppUploadAction />);
    selectFile("cronograma.mpp");

    await waitFor(() => expect(mockedParseMPP).toHaveBeenCalled());
    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());

    expect(mockedSaveProject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Cronograma importado",
        tasks: [
          expect.objectContaining({
            id: 1,
            name: "Actividad importada",
          }),
        ],
      }),
    );
    expect(push).toHaveBeenCalledWith("/project/project-42");
    expect(push).not.toHaveBeenCalledWith("/upload");
  });

  test("rejects non-mpp files inline", async () => {
    render(<HomeMppUploadAction />);
    selectFile("cronograma.xml");

    expect(
      await screen.findByText("Selecciona un archivo Microsoft Project con extension .mpp"),
    ).toBeInTheDocument();
    expect(mockedParseMPP).not.toHaveBeenCalled();
    expect(mockedSaveProject).not.toHaveBeenCalled();
  });

  test("uses the file name when parser returns the generic fallback name", async () => {
    mockedParseMPP.mockResolvedValue({
      ...parsedProject,
      name: "Proyecto Importado",
    });
    mockedSaveProject.mockResolvedValue({ success: true, id: "project-43" });

    render(<HomeMppUploadAction />);
    selectFile("cronograma-real.mpp");

    await waitFor(() => expect(mockedSaveProject).toHaveBeenCalled());

    expect(mockedSaveProject).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "cronograma-real",
      }),
    );
    expect(push).toHaveBeenCalledWith("/project/project-43");
  });
});
