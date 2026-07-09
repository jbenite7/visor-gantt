import type { GanttDependency } from "@/components/gantt/types";

export type DependencyLagUnit = NonNullable<GanttDependency["lagUnit"]>;

export function normalizeLagUnit(unit?: GanttDependency["lagUnit"]): GanttDependency["lagUnit"] {
  return unit === "percent" ? "percent" : undefined;
}

export function dependencyLagUnitValue(unit?: GanttDependency["lagUnit"]): DependencyLagUnit {
  return unit === "percent" ? "percent" : "days";
}

export function formatDependencyLag(
  lag?: number,
  lagUnit?: GanttDependency["lagUnit"],
): string {
  if (lag === undefined || lag === 0 || !Number.isFinite(lag)) return "";

  const sign = lag > 0 ? "+" : "";
  const suffix = lagUnit === "percent" ? "%" : "d";
  return `${sign}${lag}${suffix}`;
}

export function lagPatch(
  rawLag: number | undefined,
  lagUnit?: GanttDependency["lagUnit"],
): Pick<GanttDependency, "lag" | "lagUnit"> {
  if (rawLag === undefined || !Number.isFinite(rawLag)) {
    return { lag: undefined, lagUnit: undefined };
  }

  if (rawLag !== 0 && lagUnit === "percent") {
    return { lag: rawLag, lagUnit: "percent" };
  }

  return { lag: rawLag, lagUnit: undefined };
}

export function normalizeDependencyLagFields(dep: GanttDependency): GanttDependency {
  const lag = dep.lag === undefined ? undefined : Number(dep.lag);
  const normalized: GanttDependency = {
    ...dep,
    lag,
  };

  if (lag === undefined || lag === 0 || dep.lagUnit !== "percent") {
    delete normalized.lagUnit;
  } else {
    normalized.lagUnit = "percent";
  }

  return normalized;
}

export function parseDependencyLagText(
  value: string | undefined,
  unit: string | undefined,
): Pick<GanttDependency, "lag" | "lagUnit"> {
  if (!value) return { lag: undefined };

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return { lag: undefined };

  return lagPatch(parsed, unit === "%" ? "percent" : undefined);
}
