import type { MppRecordType } from "@/types/mppColumns";
import { normalizeMppFieldId, resolveMppFieldDefinition } from "./fieldLabels";
import type { RawMppTaskColumn } from "./taskColumns";

interface StandardFieldInput {
  label: string;
  timephased?: boolean;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function expand(prefixes: string[], suffixes: string[]): string[] {
  return prefixes.flatMap((prefix) => suffixes.map((suffix) => `${prefix} ${suffix}`));
}

function fieldIdFromLabel(label: string): string {
  return normalizeMppFieldId(
    label
      .replace(/%/g, " Percent ")
      .replace(/([A-Za-z])(\d+)/g, "$1 $2")
      .replace(/(\d+)([A-Za-z])/g, "$1 $2"),
  );
}

function uniq(fields: StandardFieldInput[]): StandardFieldInput[] {
  const seen = new Set<string>();
  const result: StandardFieldInput[] = [];
  for (const field of fields) {
    const id = `${field.timephased ? "TIMEPHASED:" : ""}${fieldIdFromLabel(field.label)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(field);
  }
  return result;
}

function makeFields(labels: string[], timephased = false): StandardFieldInput[] {
  return labels.map((label) => ({ label, timephased }));
}

const TASK_FIELD_LABELS = uniq(makeFields([
  "Active", "Actual Cost", "Actual Duration", "Actual Finish", "Actual Overtime Cost",
  "Actual Overtime Work", "Actual Start", "Actual Work", "ACWP", "Assignment Delay",
  "Assignment Units", "Baseline Budget Cost", "Baseline Budget Work", "Baseline Cost",
  "Baseline Deliverable Finish", "Baseline Deliverable Start", "Baseline Duration",
  "Baseline Finish", "Baseline Start", "Baseline Work",
  ...expand(range(1, 10).map((i) => `Baseline${i}`), [
    "Budget Cost", "Budget Work", "Cost", "Deliverable Finish", "Deliverable Start",
    "Duration", "Finish", "Start", "Work",
  ]),
  ...expand(range(0, 10).map((i) => `Baseline${i}`), [
    "Estimated Duration", "Estimated Finish", "Estimated Start",
  ]),
  "BCWP", "BCWS", "Budget Cost", "Budget Work", "Complete Through", "Confirmed",
  "Constraint Date", "Constraint Type", "Contact", "Cost", "Cost Rate Table",
  "Cost Variance", ...range(1, 10).map((i) => `Cost${i}`), "CPI", "Created",
  "Critical", "CV", "CV%", ...range(1, 10).map((i) => `Date${i}`), "Deadline",
  "Deliverable Finish", "Deliverable GUID", "Deliverable Name", "Deliverable Start",
  "Deliverable Type", "Duration", "Duration Variance", ...range(1, 10).map((i) => `Duration${i}`),
  "EAC", "Early Finish", "Early Start", "Earned Value Method", "Effort Driven",
  ...range(1, 10).map((i) => `Enterprise Cost${i}`),
  ...range(1, 30).map((i) => `Enterprise Date${i}`),
  ...range(1, 10).map((i) => `Enterprise Duration${i}`),
  ...range(1, 20).map((i) => `Enterprise Flag${i}`),
  ...range(1, 40).map((i) => `Enterprise Number${i}`),
  ...range(1, 30).map((i) => `Enterprise Task Outline Code${i}`),
  ...range(1, 40).map((i) => `Enterprise Text${i}`),
  "Error Message", "Estimated", "External Task", "Finish", "Finish Slack",
  "Finish Variance", ...range(1, 10).map((i) => `Finish${i}`), "Fixed Cost Accrual",
  "Fixed Cost", ...range(1, 20).map((i) => `Flag${i}`), "Free Slack", "Group By Summary",
  "Health", "Hide Bar", "Hyperlink", "Hyperlink Address", "Hyperlink Href",
  "Hyperlink SubAddress", "ID", "Ignore Resource Calendar", "Ignore Warnings",
  "Indicators", "Late Finish", "Late Start", "Level Assignments", "Leveling Can Split",
  "Leveling Delay", "Linked Fields", "Marked", "Milestone", "Name", "Negative Slack",
  "Notes", ...range(1, 20).map((i) => `Number${i}`), "Objects",
  ...range(1, 10).map((i) => `Outline Code${i}`), "Outline Level", "Outline Number",
  "Overallocated", "Overtime Cost", "Overtime Work", "Peak", "% Complete",
  "% Work Complete", "Physical % Complete", "Placeholder", "Predecessors",
  "Preleveled Finish", "Preleveled Start", "Priority", "Project", "Publish",
  "Recurring", "Regular Work", "Remaining Cost", "Remaining Duration",
  "Remaining Overtime Cost", "Remaining Overtime Work", "Remaining Work",
  "Resource Group", "Resource Initials", "Resource Names", "Resource Phonetics",
  "Resource Type", "Response Pending", "Resume", "Rollup", "Scheduled Duration",
  "Scheduled Finish", "Scheduled Start", "SPI", "Start", "Start Slack",
  "Start Variance", ...range(1, 10).map((i) => `Start${i}`), "Status",
  "Status Indicator", "Status Manager", "Stop", "Subproject File",
  "Subproject Read Only", "Successors", "Summary", "Summary Progress", "SV", "SV%",
  "Task Calendar", "Task Calendar GUID", "Task GUID", "Task Mode", "Task Summary Name",
  "TCPI", "TeamStatus Pending", "Text Above", ...range(1, 30).map((i) => `Text${i}`),
  "Total Slack", "Type", "Unique ID", "Unique ID Predecessors", "Unique ID Successors",
  "Update Needed", "VAC", "Warning", "WBS", "WBS Predecessors", "WBS Successors",
  "Work", "Work Contour", "Work Variance",
]));

const TASK_TIMEPHASED_LABELS = makeFields([
  "Actual Cost", "Actual Fixed Cost", "Actual Overtime Work", "Actual Work", "ACWP",
  "Baseline Budget Cost", "Baseline Budget Work", "Baseline Cost", "Baseline Work",
  ...expand(range(0, 10).map((i) => `Baseline${i}`), [
    "Cumulative Work", "Remaining Cumulative Work", "Remaining Tasks",
  ]),
  ...expand(range(1, 10).map((i) => `Baseline${i}`), [
    "Budget Cost", "Budget Work", "Cost", "Work",
  ]),
  "BCWP", "BCWS", "Budget Cost", "Budget Work", "Cost", "CPI",
  "Cumulative Actual Work", "Cumulative Cost", "Cumulative % Complete",
  "Cumulative Work", "CV", "CV%", "Fixed Cost", "Overallocation", "Overtime Work",
  "% Complete", "Regular Work", "Remaining Actual Tasks", "Remaining Cumulative Actual Work",
  "Remaining Cumulative Work", "Remaining Tasks", "SPI", "SV", "SV%", "Work",
], true);

const RESOURCE_FIELD_LABELS = uniq(makeFields([
  "Accrue At", "Actual Cost", "Actual Finish", "Actual Overtime Cost",
  "Actual Overtime Work", "Actual Start", "Actual Work", "ACWP", "Assignment",
  "Assignment Delay", "Assignment Units", "Available From", "Available To",
  "Base Calendar", "Baseline Budget Cost", "Baseline Budget Work", "Baseline Cost",
  "Baseline Finish", "Baseline Start", "Baseline Work",
  ...expand(range(1, 10).map((i) => `Baseline${i}`), [
    "Budget Cost", "Budget Work", "Cost", "Finish", "Start", "Work",
  ]),
  "BCWP", "BCWS", "Budget", "Budget Cost", "Budget Work", "Can Level", "Code",
  "Confirmed", "Cost", "Cost Per Use", "Cost Rate Table", "Cost Type", "Cost Variance",
  ...range(1, 10).map((i) => `Cost${i}`), "Created", "CV",
  ...range(1, 10).map((i) => `Date${i}`), "Default Assignment Owner",
  ...range(1, 10).map((i) => `Duration${i}`), "E-mail Address", "Enterprise",
  "Enterprise Base Calendar", ...range(1, 10).map((i) => `Enterprise Cost${i}`),
  ...range(1, 30).map((i) => `Enterprise Date${i}`),
  ...range(1, 10).map((i) => `Enterprise Duration${i}`),
  ...range(1, 20).map((i) => `Enterprise Flag${i}`),
  ...range(1, 40).map((i) => `Enterprise Number${i}`),
  "Enterprise Required Values", ...range(1, 29).map((i) => `Enterprise Resource Outline Code${i}`),
  "Enterprise Team Member", ...range(1, 40).map((i) => `Enterprise Text${i}`),
  "Enterprise Unique ID", "Error Message", ...range(1, 10).map((i) => `Finish${i}`),
  "Finish", ...range(1, 20).map((i) => `Flag${i}`), "Generic", "Group",
  "Group By Summary", "Hyperlink", "Hyperlink Address", "Hyperlink Href",
  "Hyperlink SubAddress", "ID", "Import", "Inactive", "Indicators", "Initials",
  "Leveling Delay", "Linked Fields", "Material Label", "Max Units", "Name",
  "Notes", ...range(1, 20).map((i) => `Number${i}`), "Objects",
  ...range(1, 10).map((i) => `Outline Code${i}`), "Overallocated", "Overtime Cost",
  "Overtime Rate", "Overtime Work", "Peak", "% Work Complete", "Phonetics",
  "Project", "RBS", "Regular Work", "Remaining Cost", "Remaining Overtime Cost",
  "Remaining Overtime Work", "Remaining Work", "Resource Calendar GUID",
  "Resource Departments", "Resource GUID", "Response Pending", "Standard Rate",
  "Start", ...range(1, 10).map((i) => `Start${i}`), "Summary", "SV",
  "Team Assignment Pool", "Task Summary Name", "TeamStatus Pending",
  ...range(1, 30).map((i) => `Text${i}`), "Type", "Unique ID", "Update Needed",
  "VAC", "Windows User Account", "Work", "Work Contour", "Work Variance",
]));

const RESOURCE_TIMEPHASED_LABELS = makeFields([
  "Actual Cost", "Actual Overtime Work", "Actual Work", "ACWP", "Baseline Budget Cost",
  "Baseline Budget Work", "Baseline Cost", "Baseline Work",
  ...expand(range(0, 10).map((i) => `Baseline${i}`), [
    "Cumulative Work", "Remaining Cumulative Work",
  ]),
  ...expand(range(1, 10).map((i) => `Baseline${i}`), [
    "Budget Cost", "Budget Work", "Cost", "Work",
  ]),
  "BCWP", "BCWS", "Budget Cost", "Budget Work", "Cost", "Cumulative Actual Work",
  "Cumulative Cost", "Cumulative Work", "CV", "Overallocation", "Overtime Work",
  "Peak Units", "% Allocation", "Regular Work", "Remaining Availability",
  "Remaining Cumulative Actual Work", "Remaining Cumulative Work", "SV",
  "SPI", "CPI", "Unit Availability", "Work", "Work Availability",
], true);

const ASSIGNMENT_FIELD_LABELS = uniq(makeFields([
  "Actual Cost", "Actual Finish", "Actual Overtime Cost", "Actual Overtime Work",
  "Actual Start", "Actual Work", "ACWP", "Assignment", "Assignment Delay",
  "Assignment Owner", "Assignment Units", "Baseline Budget Cost", "Baseline Budget Work",
  "Baseline Cost", "Baseline Finish", "Baseline Start", "Baseline Work",
  ...expand(range(1, 10).map((i) => `Baseline${i}`), [
    "Budget Cost", "Budget Work", "Cost", "Finish", "Start", "Work",
  ]),
  ...expand(range(0, 10).map((i) => `Baseline${i}`), [
    "Estimated Finish", "Estimated Start",
  ]),
  "BCWP", "BCWS", "Budget Cost", "Budget Work", "Confirmed", "Cost",
  "Cost Rate Table", "Cost Variance", ...range(1, 10).map((i) => `Cost${i}`),
  "Critical", "CV", ...range(1, 10).map((i) => `Date${i}`),
  ...range(1, 10).map((i) => `Duration${i}`),
  ...range(1, 10).map((i) => `Enterprise Cost${i}`),
  ...range(1, 30).map((i) => `Enterprise Date${i}`),
  ...range(1, 10).map((i) => `Enterprise Duration${i}`),
  ...range(1, 20).map((i) => `Enterprise Flag${i}`),
  ...range(1, 40).map((i) => `Enterprise Number${i}`),
  ...range(1, 29).map((i) => `Enterprise Resource Outline Code${i}`),
  ...range(1, 40).map((i) => `Enterprise Text${i}`), "Finish", "Finish Variance",
  ...range(1, 10).map((i) => `Finish${i}`), ...range(1, 20).map((i) => `Flag${i}`),
  "Hyperlink", "Hyperlink Address", "Hyperlink Href", "Hyperlink SubAddress",
  "Leveling Delay", "Linked Fields", "Notes", ...range(1, 20).map((i) => `Number${i}`),
  "Outline Level", "Overallocated", "Overtime Cost", "Overtime Work", "Peak",
  "% Work Complete", "Priority", "Project", "RBS", "Regular Work", "Remaining Cost",
  "Remaining Overtime Cost", "Remaining Overtime Work", "Remaining Work",
  "Request/Demand", "Resource Group", "Resource ID", "Resource Initials",
  "Resource Name", "Resource Type", "Response Pending", "Start", "Start Variance",
  ...range(1, 10).map((i) => `Start${i}`), "SV", "Task ID", "Task Name",
  "Task Outline Number", "Task Summary Name", "TeamStatus Pending",
  ...range(1, 30).map((i) => `Text${i}`), "Unique ID", "Update Needed", "VAC",
  "WBS", "Work", "Work Contour", "Work Variance",
]));

const ASSIGNMENT_TIMEPHASED_LABELS = makeFields([
  "Actual Cost", "Actual Overtime Work", "Actual Work", "ACWP", "Baseline Budget Cost",
  "Baseline Budget Work", "Baseline Cost", "Baseline Work",
  ...expand(range(1, 10).map((i) => `Baseline${i}`), [
    "Budget Cost", "Budget Work", "Cost", "Work",
  ]),
  "BCWP", "BCWS", "Budget Cost", "Budget Work", "Cost", "Cumulative Cost",
  "Cumulative Work", "CV", "Overtime Work", "Peak Units", "% Complete",
  "Regular Work", "Remaining Availability", "SV", "SPI", "CPI", "Work",
], true);

const STANDARD_FIELDS: Record<MppRecordType, StandardFieldInput[]> = {
  task: uniq([...TASK_FIELD_LABELS, ...TASK_TIMEPHASED_LABELS]),
  resource: uniq([...RESOURCE_FIELD_LABELS, ...RESOURCE_TIMEPHASED_LABELS]),
  assignment: uniq([...ASSIGNMENT_FIELD_LABELS, ...ASSIGNMENT_TIMEPHASED_LABELS]),
};

function toColumn(field: StandardFieldInput, recordType: MppRecordType): RawMppTaskColumn {
  const fieldId = field.timephased
    ? `TIMEPHASED_${fieldIdFromLabel(field.label)}`
    : fieldIdFromLabel(field.label);
  const definition = resolveMppFieldDefinition(fieldId, field.label);
  const suffixEs = field.timephased ? " (por fases temporales)" : "";
  const suffixEn = field.timephased ? " (Timephased)" : "";
  const keyPrefix = recordType === "task" ? "mpp" : `mpp:${recordType}`;

  return {
    key: `${keyPrefix}:${fieldId}`,
    fieldId,
    sourceKey: fieldId,
    labelEn: `${definition.en}${suffixEn}`,
    labelEs: `${definition.es}${suffixEs}`,
    dataType: definition.dataType,
    group: definition.group,
    recordType,
    isCustom: definition.group === "custom",
    isCore: false,
    isEditable: definition.group === "custom",
    width: definition.width,
  };
}

export function getStandardMppColumns(recordType: MppRecordType): RawMppTaskColumn[] {
  return STANDARD_FIELDS[recordType].map((field) => toColumn(field, recordType));
}
