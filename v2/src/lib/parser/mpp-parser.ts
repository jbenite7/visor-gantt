import { XMLParser } from "fast-xml-parser";
import fs from "fs";

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
  [key: string]: any; // Allow other props
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
}

export interface ProjectData {
  name: string;
  startDate: string;
  finishDate: string;
  tasks: MSPTask[];
  resources: MSPResource[];
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
    const jsonObj = this.parser.parse(xmlContent);

    if (!jsonObj.Project) {
      throw new Error("Invalid MSP XML");
    }

    const root = jsonObj.Project;

    // 1. General Info
    const name = root.Title || root.Name || "Proyecto Importado";
    // Ensure dates are string
    const startDate = root.StartDate || "";
    const finishDate = root.FinishDate || "";

    // 2. Resources
    const resources: MSPResource[] = [];
    if (root.Resources && root.Resources.Resource) {
      root.Resources.Resource.forEach((res: any) => {
        if (res.Name) {
          resources.push({
            UID: parseInt(res.UID),
            Name: res.Name,
            Type: parseInt(res.Type),
          });
        }
      });
    }

    // 3. Tasks
    const tasks: MSPTask[] = [];
    if (root.Tasks && root.Tasks.Task) {
      root.Tasks.Task.forEach((t: any) => {
        if (t.UID == 0 && !t.Name) return; // Skip root empty

        // Extract Predecessors
        let preds: MSPPredecessorLink[] = [];
        if (t.PredecessorLink) {
          preds = t.PredecessorLink.map((l: any) => ({
            PredecessorUID: parseInt(l.PredecessorUID),
            Type: parseInt(l.Type || 1), // Default FS
            LinkLag: parseInt(l.LinkLag || 0),
            LagFormat: parseInt(l.LagFormat || 7),
          }));
        }

        // Parse Task
        const task: MSPTask = {
          ...t, // Copy all fields for availableColumns support
          UID: parseInt(t.UID),
          ID: parseInt(t.ID || t.UID),
          Name: t.Name || "",
          Start: t.Start || "",
          Finish: t.Finish || "",
          Duration: t.Duration,
          DurationFormat: parseInt(t.DurationFormat || 7),
          PercentComplete: parseInt(t.PercentComplete || 0),
          Summary: t.Summary === 1, // fast-xml-parser might auto-convert numbers if configured, but here safe check
          Milestone: t.Milestone === 1,
          OutlineLevel: parseInt(t.OutlineLevel || 1),
          WBS: t.WBS || "",
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
