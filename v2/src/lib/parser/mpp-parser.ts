import { XMLParser } from "fast-xml-parser";
import fs from "fs";
import type {
  MppAssignmentColumn,
  MppCustomFieldDefinition,
  MppResourceColumn,
  MppTaskColumn,
} from "@/types/mppColumns";
import type { ProjectCalendar } from "@/types/calendar";

export interface MSPTask {
  UID: number;
  ID: number;
  Name: string;
  Start: string;
  Finish: string;
  Duration: string;
  DurationFormat: number;
  PercentComplete: number;
  Summary: boolean;
  Milestone: boolean;
  OutlineLevel: number;
  WBS: string;
  PredecessorLink?: MSPPredecessorLink[];
  [key: string]: unknown; // Allow other props
}

export interface MSPPredecessorLink {
  PredecessorUID: number;
  Type: number; // 0=FF, 1=FS, 2=SF, 3=SS (check standard)
  LinkLag: number;
  LagFormat: number;
}

export interface MSPResource {
  UID: number;
  Name: string;
  Type: number;
  mppFields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MSPAssignment {
  UID?: number;
  TaskUID?: number;
  TaskID?: number;
  ResourceUID?: number;
  ResourceID?: number;
  Units?: number;
  Cost?: number;
  mppFields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProjectData {
  name: string;
  startDate: string;
  finishDate: string;
  statusDate?: string;
  tasks: MSPTask[];
  resources: MSPResource[];
  assignments?: MSPAssignment[];
  availableColumns?: string[];
  availableResourceColumns?: string[];
  availableAssignmentColumns?: string[];
  mppTaskColumns?: MppTaskColumn[];
  mppResourceColumns?: MppResourceColumn[];
  mppAssignmentColumns?: MppAssignmentColumn[];
  customFieldDefinitions?: MppCustomFieldDefinition[];
  calendar?: Partial<ProjectCalendar>;
}

export class MPPParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      isArray: (name) => {
        const arrayTags = ["Task", "Resource", "PredecessorLink"];
        return arrayTags.includes(name);
      },
    });
  }

  parse(filePath: string): ProjectData {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const xmlContent = fs.readFileSync(filePath, "utf-8");
    const jsonObj = this.parser.parse(xmlContent) as Record<string, unknown>;

    if (!jsonObj.Project) {
      throw new Error("Invalid MSP XML");
    }

    const root = asRecord(jsonObj.Project);

    // 1. General Info
    const name = String(root.Title || root.Name || "Proyecto Importado");
    // Ensure dates are string
    const startDate = String(root.StartDate || "");
    const finishDate = String(root.FinishDate || "");

    // 2. Resources
    const resources: MSPResource[] = [];
    const resourcesRoot = asRecord(root.Resources);
    const resourceList = asArray(resourcesRoot.Resource);
    if (resourceList.length > 0) {
      resourceList.forEach((resource) => {
        const res = asRecord(resource);
        if (res.Name) {
          resources.push({
            UID: parseInt(String(res.UID)),
            Name: String(res.Name),
            Type: parseInt(String(res.Type)),
          });
        }
      });
    }

    // 3. Tasks
    const tasks: MSPTask[] = [];
    const tasksRoot = asRecord(root.Tasks);
    const taskList = asArray(tasksRoot.Task);
    if (taskList.length > 0) {
      taskList.forEach((taskNode) => {
        const t = asRecord(taskNode);
        if (t.UID == 0 && !t.Name) return; // Skip root empty

        // Extract Predecessors
        let preds: MSPPredecessorLink[] = [];
        if (t.PredecessorLink) {
          preds = asArray(t.PredecessorLink).map((link) => {
            const l = asRecord(link);
            return {
              PredecessorUID: parseInt(String(l.PredecessorUID)),
              Type: parseInt(String(l.Type || 1)), // Default FS
              LinkLag: parseInt(String(l.LinkLag || 0)),
              LagFormat: parseInt(String(l.LagFormat || 7)),
            };
          });
        }

        // Parse Task
        const task: MSPTask = {
          ...t, // Copy all fields for availableColumns support
          UID: parseInt(String(t.UID)),
          ID: parseInt(String(t.ID || t.UID)),
          Name: String(t.Name || ""),
          Start: String(t.Start || ""),
          Finish: String(t.Finish || ""),
          Duration: String(t.Duration || ""),
          DurationFormat: parseInt(String(t.DurationFormat || 7)),
          PercentComplete: parseInt(String(t.PercentComplete || 0)),
          Summary: t.Summary === 1, // fast-xml-parser might auto-convert numbers if configured, but here safe check
          Milestone: t.Milestone === 1,
          OutlineLevel: parseInt(String(t.OutlineLevel || 1)),
          WBS: String(t.WBS || ""),
          PredecessorLink: preds,
        };

        // Enhanced Milestone Detection (Same as PHP)
        // If Start == Finish (Date only)
        if (task.Start && task.Finish) {
          const s = task.Start.split("T")[0];
          const f = task.Finish.split("T")[0];
          if (s === f) task.Milestone = true;
        }

        tasks.push(task);
      });
    }

    return {
      name,
      startDate,
      finishDate,
      tasks,
      resources,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}
