/**
 * Shared MPP import types.
 *
 * Mirrors the JSON output from the MPXJ-based Python microservice
 * (`services/mpp-parser/utils/mpp_converter.py`) and is compatible
 * with the existing MSPTask / MSPResource / ProjectData interfaces
 * in `v2/src/lib/parser/mpp-parser.ts`.
 *
 * Structural typing ensures MPPTask → MSPTask and MPPProject → ProjectData
 * are assignable without runtime conversion.
 */

import type { ProjectCalendar } from "./calendar";

/** A single calendar exception (holiday / non-working override). */
export interface MPPCalendarException {
  /** ISO-8601 date string, e.g. "2026-01-01" */
  date: string;
  /** Whether work is allowed on this date */
  isWorking: boolean;
}

/** Work-week definition. */
export interface MPPCalendar extends Partial<ProjectCalendar> {
  /**
   * Map of weekday index → isWorking.
   * Standard MSP uses 1=Sunday … 7=Saturday.
   * Example: `{ 1: false, 2: true, 3: true, … }`
   */
  weekDays: Record<number, boolean>;
  /** Non-working exceptions (holidays, custom overrides). */
  exceptions: MPPCalendarException[];
}

/** Predecessor link in raw MSP XML format. */
export interface MPPDependency {
  /** UID of the predecessor task. */
  PredecessorUID: number;
  /** Dependency type: 0=FF, 1=FS, 2=SF, 3=SS */
  Type: number;
  /** Lag amount (unit defined by LagFormat). */
  LinkLag: number;
  /** Format of the lag value: 7=days, 8=hours, etc. */
  LagFormat: number;
}

/** A single task from an .mpp / MSPDI XML source. */
export interface MPPTask {
  /** Unique (project-scoped) identifier. */
  UID: number;
  /** Outline number visible to the user. */
  ID: number;
  /** Task name. */
  Name: string;
  /** ISO-8601 start date/time. */
  Start: string;
  /** ISO-8601 finish date/time. */
  Finish: string;
  /** ISO-8601 duration (PnDTnHnMnS) or plain-text duration. */
  Duration: string;
  /** Format of the Duration string (MSP enum). */
  DurationFormat: number;
  /** Percentage complete (0–100). */
  PercentComplete: number;
  /** Whether this task is a summary (has children). */
  Summary: boolean;
  /** Whether this task is a milestone. */
  Milestone: boolean;
  /** Indentation level in the WBS tree (1 = top). */
  OutlineLevel: number;
  /** Work-Breakdown-Structure code. */
  WBS: string;
  /** Raw predecessor links from the source file. */
  PredecessorLink?: MPPDependency[];
  /**
   * Computed array of predecessor UIDs.
   * Populated during post-processing by inverting PredecessorLink.
   */
  predecessors?: number[];
  /**
   * Computed array of successor UIDs.
   * Populated during post-processing by inverting PredecessorLink across all tasks.
   */
  successors?: number[];
}

/** A resource (worker / material / cost) from an .mpp file. */
export interface MPPResource {
  /** Unique identifier. */
  UID: number;
  /** Resource display name. */
  Name: string;
  /** Resource type: 0=work, 1=material, 2=cost */
  Type: number;
}

/** Top-level project structure returned by the MPP parser. */
export interface MPPProject {
  /** Project name / title. */
  name: string;
  /** ISO-8601 project start date. */
  startDate: string;
  /** ISO-8601 project finish date. */
  finishDate: string;
  /** All tasks (flat list, tree implied by OutlineLevel). */
  tasks: MPPTask[];
  /** All resources. */
  resources: MPPResource[];
  /** Work-week / calendar definition. */
  calendar: MPPCalendar;
}
