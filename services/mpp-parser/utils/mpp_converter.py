"""MPXJ converter — uses mpxj Python library via JPype to parse .mpp files."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class MPPConversionError(Exception):
    """Raised when MPXJ conversion fails."""

    def __init__(self, detail: str, status_code: int = 500):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def _normalize_task(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw MPXJ task dict to match ProjectParser output format.

    MPXJ JSON keys differ from MS Project XML keys. This function maps them.
    """
    task: dict[str, Any] = {}

    # Direct mappings (MPXJ JSON → MSPTask format)
    task["UID"] = _int(raw.get("uniqueID", raw.get("UID", 0)))
    task["ID"] = _int(raw.get("id", raw.get("ID", raw.get("uniqueID", 0))))
    task["Name"] = str(raw.get("name", raw.get("Name", "")))
    task["Start"] = str(raw.get("start", raw.get("Start", "")))
    task["Finish"] = str(raw.get("finish", raw.get("Finish", "")))
    task["Duration"] = str(raw.get("duration", raw.get("Duration", "PT0H0M0S")))
    task["DurationFormat"] = _int(raw.get("durationFormat", raw.get("DurationFormat", 7)))
    task["PercentComplete"] = _int(raw.get("percentageComplete", raw.get("PercentComplete", 0)))
    task["Summary"] = _bool(raw.get("summary", raw.get("Summary", False)))
    task["Milestone"] = _bool(raw.get("milestone", raw.get("Milestone", False)))
    task["OutlineLevel"] = _int(raw.get("outlineLevel", raw.get("OutlineLevel", 1)))
    task["WBS"] = str(raw.get("wbs", raw.get("WBS", "")))

    # Normalize computed fields
    task["id"] = task["UID"]
    task["name"] = task["Name"]
    task["start"] = _normalize_date(task["Start"])
    task["finish"] = _normalize_date(task["Finish"])

    # Duration: parse ISO 8601 to days
    task["duration"] = _parse_iso_duration_days(task["Duration"])
    task["percentComplete"] = task["PercentComplete"]
    task["isSummary"] = task["Summary"]
    task["isMilestone"] = task["Milestone"]

    # Milestone detection: start == finish (date only)
    if task["start"] and task["finish"]:
        s_date = task["start"][:10]
        f_date = task["finish"][:10]
        if s_date == f_date and s_date:
            task["isMilestone"] = True
            task["Milestone"] = True

    # Predecessor links
    predecessor_links = raw.get("predecessorLinks", raw.get("PredecessorLink", []))
    if isinstance(predecessor_links, dict):
        predecessor_links = [predecessor_links]

    task["PredecessorLink"] = []
    task["predecessors"] = []
    for link in predecessor_links:
        pred_link = {
            "PredecessorUID": _int(link.get("predecessorUniqueID", link.get("PredecessorUID", 0))),
            "Type": _int(link.get("type", link.get("Type", 1))),
            "LinkLag": _int(link.get("linkLag", link.get("LinkLag", 0))),
            "LagFormat": _int(link.get("lagFormat", link.get("LagFormat", 7))),
        }
        task["PredecessorLink"].append(pred_link)
        task["predecessors"].append(pred_link["PredecessorUID"])

    task["successors"] = []
    task["ConstraintType"] = _int(raw.get("constraintType", raw.get("ConstraintType", 0)))
    task["ConstraintDate"] = _normalize_date(str(raw.get("constraintDate", raw.get("ConstraintDate", ""))))
    task["outlineLevel"] = task["OutlineLevel"]
    task["wbs"] = task["WBS"]

    # Copy any extra raw fields for availableColumns support
    for key, value in raw.items():
        snake_key = key
        if snake_key not in task:
            task[snake_key] = value

    return task


def _normalize_resource(raw: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw MPXJ resource dict."""
    return {
        "UID": _int(raw.get("uniqueID", raw.get("UID", 0))),
        "Name": str(raw.get("name", raw.get("Name", ""))),
        "Type": _int(raw.get("type", raw.get("Type", 0))),
    }


def _fmt_dt(dt: Any) -> str:
    if dt is None:
        return ""
    try:
        return dt.format("yyyy-MM-dd'T'HH:mm:ss")
    except Exception:
        return str(dt)[:19] if dt else ""


def _normalize_date(date_str: str) -> str:
    """Normalize date string to ISO 8601 format (YYYY-MM-DDTHH:mm:ss)."""
    if not date_str or date_str.strip() == "":
        return ""
    try:
        # Try parsing with dateutil if available, fallback to string
        from datetime import datetime

        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y"):
            try:
                dt = datetime.strptime(date_str[:19], fmt)
                return dt.strftime("%Y-%m-%dT%H:%M:%S")
            except ValueError:
                continue
        return date_str
    except Exception:
        return date_str


def _parse_iso_duration_days(duration_str: str) -> float:
    """Parse ISO 8601 duration (PT8H0M0S) to days (8-hour workday)."""
    if not duration_str or duration_str == "PT0H0M0S":
        return 0.0

    try:
        import re

        match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration_str)
        if not match:
            return 0.0

        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)

        total_hours = hours + minutes / 60 + seconds / 3600
        return round(total_hours / 8, 2)  # 8-hour workday
    except Exception:
        return 0.0


def _int(val: Any) -> int:
    """Safely convert to int."""
    if val is None:
        return 0
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


def _bool(val: Any) -> bool:
    """Safely convert to bool."""
    if isinstance(val, bool):
        return val
    if isinstance(val, int):
        return val == 1
    return str(val).lower() in ("true", "1", "yes")


def _build_successors(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Compute successors by inverting predecessor links."""
    successors_map: dict[int, list[dict[str, Any]]] = {}

    for task in tasks:
        for link in task.get("PredecessorLink", []):
            pred_id = link["PredecessorUID"]
            if pred_id not in successors_map:
                successors_map[pred_id] = []
            successors_map[pred_id].append({
                "id": task["id"],
                "Type": link["Type"],
                "LinkLag": link["LinkLag"],
                "LagFormat": link["LagFormat"],
            })

    for task in tasks:
        if task["id"] in successors_map:
            task["successors"] = successors_map[task["id"]]

    return tasks


def _recalculate_project_dates(tasks: list[dict[str, Any]]) -> tuple[str, str]:
    """Recalculate project start/finish from actual task dates (ignoring header)."""
    min_start = ""
    max_finish = ""

    for t in tasks:
        s = t.get("start", "")
        f = t.get("finish", "")
        if s and (not min_start or s < min_start):
            min_start = s
        if f and (not max_finish or f > max_finish):
            max_finish = f

    return min_start, max_finish


def convert_mpp_to_json(mpp_path: str) -> dict[str, Any]:
    """Convert an .mpp file to JSON using mpxj Python library via JPype."""
    try:
        import mpxj as _mpxj

        if not _mpxj.isJVMStarted():
            _mpxj.startJVM()

        from org.mpxj.reader import UniversalProjectReader

        reader = UniversalProjectReader()
        project = reader.read(mpp_path)

        if project is None:
            raise MPPConversionError("Could not parse project file", status_code=500)

        props = project.getProjectProperties()
        name = str(props.getName()) if props.getName() else "Proyecto Importado"
        start_date = _fmt_dt(props.getStartDate())
        finish_date = _fmt_dt(props.getFinishDate())

        resources = []
        for r in project.getResources():
            try:
                rtype = int(r.getType()) if r.getType() else 0
            except Exception:
                rtype = 0
            resources.append({
                "UID": r.getUniqueID(),
                "Name": str(r.getName()) if r.getName() else "",
                "Type": rtype,
            })

        tasks = []
        for t in project.getTasks():
            if t.getUniqueID() == 0 and t.getName() is None:
                continue
            dur = str(t.getDuration()) if t.getDuration() else "PT0H0M0S"
            task = {
                "UID": t.getUniqueID(),
                "ID": t.getID(),
                "Name": str(t.getName()) if t.getName() else "",
                "Start": _fmt_dt(t.getStart()),
                "Finish": _fmt_dt(t.getFinish()),
                "Duration": dur,
                "DurationFormat": 7,
                "PercentComplete": t.getPercentageComplete() if t.getPercentageComplete() else 0,
                "Summary": bool(t.getSummary()),
                "Milestone": bool(t.getMilestone()),
                "OutlineLevel": t.getOutlineLevel(),
                "WBS": str(t.getWBS()) if t.getWBS() else "",
                "PredecessorLink": [],
                "predecessors": [],
                "successors": [],
                "ConstraintType": 0,
                "ConstraintDate": "",
                "id": t.getUniqueID(),
                "name": str(t.getName()) if t.getName() else "",
                "start": _fmt_dt(t.getStart()),
                "finish": _fmt_dt(t.getFinish()),
                "duration": _parse_iso_duration_days(dur),
                "percentComplete": t.getPercentageComplete() if t.getPercentageComplete() else 0,
                "isSummary": bool(t.getSummary()),
                "isMilestone": bool(t.getMilestone()),
                "outlineLevel": t.getOutlineLevel(),
                "wbs": str(t.getWBS()) if t.getWBS() else "",
            }

            for pred in t.getPredecessors():
                pred_task = pred.getPredecessorTask()
                link = {
                    "PredecessorUID": pred_task.getUniqueID() if pred_task else 0,
                    "Type": pred.getType().getValue() if pred.getType() else 1,
                    "LinkLag": pred.getLag().getDuration() if pred.getLag() else 0,
                    "LagFormat": 7,
                }
                task["PredecessorLink"].append(link)
                task["predecessors"].append(link["PredecessorUID"])

            if task["Start"] and task["Finish"]:
                s_date = task["Start"][:10]
                f_date = task["Finish"][:10]
                if s_date == f_date and s_date:
                    task["isMilestone"] = True
                    task["Milestone"] = True

            tasks.append(task)

        tasks = _build_successors(tasks)

        if tasks:
            calc_start, calc_finish = _recalculate_project_dates(tasks)
            if calc_start:
                start_date = calc_start
            if calc_finish:
                finish_date = calc_finish

        return {
            "name": name,
            "startDate": start_date,
            "finishDate": finish_date,
            "tasks": tasks,
            "resources": resources,
            "calendar": {"weekDays": {}, "exceptions": []},
            "availableColumns": _extract_available_columns(tasks),
        }

    except MPPConversionError:
        raise
    except Exception as e:
        logger.exception("Unexpected error during MPXJ conversion")
        raise MPPConversionError(f"Conversion failed: {e}", status_code=500)


def _extract_available_columns(tasks: list[dict[str, Any]]) -> list[str]:
    """Extract all unique column names from tasks for frontend compatibility."""
    columns: set[str] = set()
    for task in tasks:
        columns.update(task.keys())
    return sorted(columns)
