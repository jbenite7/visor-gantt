/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HomeMppUploadAction from "../HomeMppUploadAction";
import { parseMPP } from "@/lib/api";
import { saveProject } from "@/app/actions/project";
import type { ProjectData } from "@/lib/parser/mpp-parser";
import type { ProjectCalendar } from "@/types/calendar";

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

const importedCalendar: ProjectCalendar = {
  timeZone: "America/Bogota",
  workDays: [1, 2, 3, 4, 5],
  startHour: "08:30",
  endHour: "17:30",
  hoursPerDay: 7.5,
  nonWorkingDays: [
    {
      id: "2026-01-06-0",
      date: "2026-01-06",
      name: "Día festivo",
    },
  ],
  dateOverrides: [
    {
      id: "2026-01-06-0",
      date: "2026-01-06",
      name: "Día festivo",
      isWorking: false,
    },
  ],
};

const parsedProject: ProjectData & { calendar: ProjectCalendar } = {
  name: "Cronograma importado",
  startDate: "2026-01-01",
  finishDate: "2026-01-10",
  statusDate: "2026-01-08T00:00:00",
  calendar: importedCalendar,
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
      Text1: "Contrato",
    },
  ],
  resources: [
    {
      UID: 10,
      ID: 10,
      Name: "Oficial",
      Type: 1,
      Text1: "Cuadrilla A",
      mppFields: {
        Text1: "Cuadrilla A",
      },
    },
  ],
  assignments: [
    {
      UID: 99,
      TaskUID: 1,
      ResourceUID: 10,
      Units: 50,
      Cost: 1200,
      Text1: "Turno diurno",
      mppFields: {
        Text1: "Turno diurno",
      },
    },
  ],
  availableColumns: [
    "UID",
    "ID",
    "Name",
    "Start",
    "Finish",
    "Duration",
    "PercentComplete",
    "Text1",
  ],
  availableResourceColumns: ["UID", "ID", "Name", "Type", "Text1"],
  availableAssignmentColumns: ["UID", "TaskUID", "ResourceUID", "Units", "Cost", "Text1"],
  mppTaskColumns: [
    {
      key: "mpp:Text1",
      fieldId: "TEXT_1",
      sourceKey: "Text1",
      labelEn: "Text 1",
      labelEs: "Texto 1",
      dataType: "string",
      group: "custom",
      isCustom: true,
      isCore: false,
      isEditable: false,
    },
  ],
  mppResourceColumns: [
    {
      key: "mpp:resource:Text1",
      fieldId: "TEXT_1",
      sourceKey: "Text1",
      labelEn: "Text 1",
      labelEs: "Texto 1",
      dataType: "string",
      group: "custom",
      recordType: "resource",
      isCustom: true,
      isCore: false,
      isEditable: false,
    },
  ],
  mppAssignmentColumns: [
    {
      key: "mpp:assignment:Text1",
      fieldId: "TEXT_1",
      sourceKey: "Text1",
      labelEn: "Text 1",
      labelEs: "Texto 1",
      dataType: "string",
      group: "custom",
      recordType: "assignment",
      isCustom: true,
      isCore: false,
      isEditable: false,
    },
  ],
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

    const saved = mockedSaveProject.mock.calls[0][0];
    expect(saved).toEqual(
      expect.objectContaining({
        name: "Cronograma importado",
        statusDate: "2026-01-08T00:00:00",
        tasks: [
          expect.objectContaining({
            id: 1,
            name: "Actividad importada",
            mppFields: expect.objectContaining({
              Text1: "Contrato",
            }),
          }),
        ],
        resources: [
          expect.objectContaining({
            uid: 10,
            name: "Oficial",
            type: "work",
            mppFields: expect.objectContaining({
              Text1: "Cuadrilla A",
            }),
          }),
        ],
        assignments: [
          expect.objectContaining({
            taskId: 1,
            resourceId: 10,
            units: 50,
            cost: 1200,
            mppFields: expect.objectContaining({
              Text1: "Turno diurno",
            }),
          }),
        ],
        uiSettings: { locale: "es" },
      }),
    );
    expect(saved.calendar).toEqual(importedCalendar);
    expect(saved.mppTaskColumns.find((column) => column.fieldId === "TEXT_1")).toEqual(
      expect.objectContaining({ labelEn: "Text 1", labelEs: "Texto 1" }),
    );
    expect(saved.mppTaskColumns.find((column) => column.fieldId === "ACTUAL_COST")).toEqual(
      expect.objectContaining({ key: "mpp:ACTUAL_COST", labelEn: "Actual Cost" }),
    );
    expect(saved.mppResourceColumns.find((column) => column.fieldId === "TEXT_1")).toEqual(
      expect.objectContaining({ labelEs: "Texto 1" }),
    );
    expect(saved.mppResourceColumns.find((column) => column.fieldId === "WINDOWS_USER_ACCOUNT")).toEqual(
      expect.objectContaining({ key: "mpp:resource:WINDOWS_USER_ACCOUNT", labelEn: "Windows User Account" }),
    );
    expect(saved.mppAssignmentColumns.find((column) => column.fieldId === "TEXT_1")).toEqual(
      expect.objectContaining({ labelEs: "Texto 1" }),
    );
    expect(saved.mppAssignmentColumns.find((column) => column.fieldId === "ACTUAL_WORK")).toEqual(
      expect.objectContaining({ key: "mpp:assignment:ACTUAL_WORK", labelEn: "Actual Work" }),
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
  }, 15_000);
});
