/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import AssignmentSheetView from "./AssignmentSheetView";
import ResourceSheetView from "./ResourceSheetView";
import type { GanttTask } from "@/components/gantt/types";
import type {
  MppAssignmentColumn,
  MppCustomFieldDefinition,
  MppResourceColumn,
} from "@/types/mppColumns";
import type { Assignment, Resource } from "@/types/resource";

const resource: Resource = {
  uid: 10,
  name: "Oficial",
  type: "work",
  availability: 100,
  mppFields: {
    TEXT_1: "Pendiente",
    TEXT_1_LOOKUP_ERROR: 'Valor "Pendiente" no existe en la lista de valores permitidos para TEXT_1.',
  },
};

const resourceColumn: MppResourceColumn = {
  key: "mpp:resource:TEXT_1",
  fieldId: "TEXT_1",
  sourceKey: "TEXT_1",
  labelEn: "Resource Status",
  labelEs: "Estado recurso",
  dataType: "string",
  group: "custom",
  recordType: "resource",
  isCustom: true,
  isCore: false,
  isEditable: true,
};

const customDefinitions: MppCustomFieldDefinition[] = [
  {
    fieldId: "TEXT_1",
    recordType: "resource",
    dataType: "string",
    lookupValues: ["Aprobado", "Rechazado"],
  },
];

const task: GanttTask = {
  id: 1,
  name: "Actividad",
  start: new Date("2026-01-05T08:00:00.000Z"),
  finish: new Date("2026-01-06T17:00:00.000Z"),
  duration: 2,
  progress: 0,
  isCritical: false,
  isMilestone: false,
  isSummary: false,
  outlineLevel: 1,
  dependencies: [],
};

const assignment: Assignment = {
  taskId: 1,
  resourceId: 10,
  units: 75,
  cost: 1200,
  mppFields: {
    ACTUAL_WORK: 12,
  },
};

const assignmentColumn: MppAssignmentColumn = {
  key: "mpp:assignment:ACTUAL_WORK",
  fieldId: "ACTUAL_WORK",
  sourceKey: "ACTUAL_WORK",
  labelEn: "Actual Work",
  labelEs: "Trabajo real",
  dataType: "duration",
  group: "tracking",
  recordType: "assignment",
  isCustom: false,
  isCore: false,
  isEditable: false,
  calculationSpec: {
    calculationKind: "work",
    isCalculated: true,
    isEditableWhenCalculated: false,
    lastCalculatedAt: "2026-06-26T20:00:00.000Z",
    sourceOfTruth: "engine",
  },
};

describe("Resource and assignment field inspectors", () => {
  test("shows resource custom lookup values and materialized lookup errors", () => {
    render(
      <ResourceSheetView
        resources={[resource]}
        mppResourceColumns={[resourceColumn]}
        customFieldDefinitions={customDefinitions}
        columnSettings={{
          visible: ["uid", "name", "type", "mpp:resource:TEXT_1"],
          widths: {},
          labelLocale: "es",
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("column-selector"));
    fireEvent.click(screen.getByRole("button", { name: "Inspeccionar columna Estado recurso" }));

    const inspector = within(screen.getByTestId("field-inspector"));
    expect(inspector.getByText("Inspector de campo")).toBeInTheDocument();
    expect(inspector.getByText("Estado recurso")).toBeInTheDocument();
    expect(inspector.getByText("Valor")).toBeInTheDocument();
    expect(inspector.getByText("Pendiente")).toBeInTheDocument();
    expect(inspector.getByText("Valores lookup")).toBeInTheDocument();
    expect(inspector.getByText("Aprobado, Rechazado")).toBeInTheDocument();
    expect(inspector.getByText("Errores")).toBeInTheDocument();
    expect(inspector.getByText('Valor "Pendiente" no existe en la lista de valores permitidos para TEXT_1.')).toBeInTheDocument();
  });

  test("shows assignment calculated field value and engine origin", () => {
    render(
      <AssignmentSheetView
        assignments={[assignment]}
        tasks={[task]}
        resources={[resource]}
        mppAssignmentColumns={[assignmentColumn]}
        columnSettings={{
          visible: ["taskId", "resourceId", "units", "mpp:assignment:ACTUAL_WORK"],
          widths: {},
          labelLocale: "es",
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("column-selector"));
    fireEvent.click(screen.getByRole("button", { name: "Inspeccionar columna Trabajo real" }));

    const inspector = within(screen.getByTestId("field-inspector"));
    expect(inspector.getByText("Trabajo real")).toBeInTheDocument();
    expect(inspector.getByText("Valor")).toBeInTheDocument();
    expect(inspector.getByText("12")).toBeInTheDocument();
    expect(inspector.getByText("Origen")).toBeInTheDocument();
    expect(inspector.getByText("engine")).toBeInTheDocument();
    expect(inspector.getByText("Solo lectura")).toBeInTheDocument();
  });
});
