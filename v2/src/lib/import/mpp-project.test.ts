import { buildProjectDataFromMpp } from "./mpp-project";
import type { ProjectData as ParsedMppProject } from "@/lib/parser/mpp-parser";
import type { ProjectCalendar } from "@/types/calendar";

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
      name: "Dia festivo",
    },
  ],
  dateOverrides: [
    {
      id: "2026-01-06-0",
      date: "2026-01-06",
      name: "Dia festivo",
      isWorking: false,
    },
  ],
};

const parsedProject: ParsedMppProject = {
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
  availableColumns: ["UID", "ID", "Name", "Start", "Finish", "Text1"],
  availableResourceColumns: ["UID", "ID", "Name", "Type", "Text1"],
  availableAssignmentColumns: [
    "UID",
    "TaskUID",
    "ResourceUID",
    "Units",
    "Cost",
    "Text1",
  ],
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
  customFieldDefinitions: [
    {
      fieldId: "TEXT_1",
      fieldName: "Contrato",
      fieldType: "task",
      dataType: "string",
    },
  ],
};

describe("buildProjectDataFromMpp", () => {
  test("preserves parsed schedule data in light server import mode", () => {
    const project = buildProjectDataFromMpp(parsedProject, "cronograma.mpp", {
      calculateFields: false,
    });

    expect(project).toEqual(
      expect.objectContaining({
        name: "Cronograma importado",
        statusDate: "2026-01-08T00:00:00",
        calendar: expect.objectContaining({
          timeZone: importedCalendar.timeZone,
          workDays: importedCalendar.workDays,
          startHour: importedCalendar.startHour,
          endHour: importedCalendar.endHour,
          hoursPerDay: importedCalendar.hoursPerDay,
          dateOverrides: importedCalendar.dateOverrides,
        }),
        uiSettings: {
          locale: "es",
          taskFilter: { text: "", type: "all" },
        },
      }),
    );
    expect(project.calendar.nonWorkingDays).toEqual(
      expect.arrayContaining([
        importedCalendar.nonWorkingDays[0],
        expect.objectContaining({
          date: "2026-01-01",
          name: "Año Nuevo",
        }),
        expect.objectContaining({
          date: "2026-07-20",
          name: "Día de la Independencia",
        }),
      ]),
    );
    expect(project.tasks).toEqual([
      expect.objectContaining({
        id: 1,
        name: "Actividad importada",
        resourceNames: ["Oficial"],
        cost: 1200,
        matrixSource: expect.objectContaining({
          matrixPlanId: "matrix-mpp-cronograma-importado",
          cellId: "cell-1",
          recipeId: "recipe-1",
          activityId: "activity-1",
        }),
        mppFields: expect.objectContaining({ Text1: "Contrato" }),
      }),
    ]);
    expect(project.matrixPlan).toEqual(
      expect.objectContaining({
        id: "matrix-mpp-cronograma-importado",
        templateId: "mpp-import",
        cells: [
          expect.objectContaining({
            id: "cell-1",
            generatedTaskIds: [1],
            syncedTaskIds: [1],
            activityOverrides: [
              expect.objectContaining({
                sourceTaskId: 1,
                resourceNames: ["Oficial"],
                cost: 1200,
              }),
            ],
          }),
        ],
      }),
    );
    expect(project.resources).toEqual([
      expect.objectContaining({
        uid: 10,
        name: "Oficial",
        type: "work",
        mppFields: expect.objectContaining({ Text1: "Cuadrilla A" }),
      }),
    ]);
    expect(project.assignments).toEqual([
      expect.objectContaining({
        taskId: 1,
        resourceId: 10,
        units: 50,
        cost: 1200,
        mppFields: expect.objectContaining({ Text1: "Turno diurno" }),
      }),
    ]);
    expect(project.mppTaskColumns).toEqual(parsedProject.mppTaskColumns);
    expect(project.mppResourceColumns).toEqual(parsedProject.mppResourceColumns);
    expect(project.mppAssignmentColumns).toEqual(
      parsedProject.mppAssignmentColumns,
    );
    expect(project.customFieldDefinitions).toEqual(
      parsedProject.customFieldDefinitions,
    );
    expect(project.calculationEngineVersion).toBeUndefined();
    expect(project.calculatedAt).toBeUndefined();
  });

  test("uses file name when parser returns the generic fallback name", () => {
    const project = buildProjectDataFromMpp(
      { ...parsedProject, name: "Proyecto Importado" },
      "cronograma-real.mpp",
      { calculateFields: false },
    );

    expect(project.name).toBe("cronograma-real");
  });
});
