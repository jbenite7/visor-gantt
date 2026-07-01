"""MPXJ converter — uses mpxj Python library via JPype to parse .mpp files."""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import date, timedelta
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


def _json_value(value: Any) -> Any:
    """Convert JPype/Java values returned by MPXJ into JSON-safe values."""
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value

    try:
        if hasattr(value, "format"):
            formatted = _fmt_dt(value)
            if formatted:
                return formatted
    except Exception:
        pass

    try:
        # Java collections exposed through JPype are iterable.
        if not isinstance(value, (str, bytes)) and hasattr(value, "__iter__"):
            return [_json_value(item) for item in value]
    except Exception:
        pass

    return str(value)


def _field_type_class(field: Any) -> str:
    try:
        return str(field.getFieldTypeClass())
    except Exception:
        return ""


def _field_data_type(field: Any) -> str:
    try:
        return str(field.getDataType())
    except Exception:
        return "STRING"


def _field_id(field: Any) -> str:
    try:
        return str(field.name())
    except Exception:
        return str(field)


def _field_name(field: Any) -> str:
    try:
        return str(field.getName())
    except Exception:
        return _field_id(field).replace("_", " ").title()


def _call(obj: Any, method_name: str, default: Any = None) -> Any:
    """Safely call a Java/JPype getter."""
    try:
        method = getattr(obj, method_name)
        return method()
    except Exception:
        return default


def _call_arg(obj: Any, method_name: str, arg: Any, default: Any = None) -> Any:
    try:
        method = getattr(obj, method_name)
        return method(arg)
    except Exception:
        return default


COST_RATE_TABLE_NAMES = ("A", "B", "C", "D", "E")

DEFAULT_PROJECT_CALENDAR = {
    "timeZone": "America/Bogota",
    "workDays": [1, 2, 3, 4, 5, 6],
    "startHour": "08:00",
    "endHour": "17:00",
    "hoursPerDay": 8,
    "nonWorkingDays": [],
    "dateOverrides": [],
    "weekDays": {
        1: False,
        2: True,
        3: True,
        4: True,
        5: True,
        6: True,
        7: True,
    },
    "exceptions": [],
}

CALENDAR_DAY_SPECS = (
    ("MONDAY", 1, 2),
    ("TUESDAY", 2, 3),
    ("WEDNESDAY", 3, 4),
    ("THURSDAY", 4, 5),
    ("FRIDAY", 5, 6),
    ("SATURDAY", 6, 7),
    ("SUNDAY", 7, 1),
)


def _calendar_day_values() -> list[tuple[str, int, int, Any]]:
    try:
        from java.time import DayOfWeek  # type: ignore

        return [
            (name, project_day, legacy_day, getattr(DayOfWeek, name))
            for name, project_day, legacy_day in CALENDAR_DAY_SPECS
        ]
    except Exception:
        return [
            (name, project_day, legacy_day, name)
            for name, project_day, legacy_day in CALENDAR_DAY_SPECS
        ]


def _time_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    match = re.match(r"^(\d{1,2}):(\d{2})", text)
    if not match:
        return None
    return f"{int(match.group(1)):02d}:{match.group(2)}"


def _time_minutes(value: str | None) -> int | None:
    if not value:
        return None
    match = re.match(r"^(\d{2}):(\d{2})$", value)
    if not match:
        return None
    return int(match.group(1)) * 60 + int(match.group(2))


def _calendar_hours(calendar: Any, day_value: Any) -> list[Any]:
    if day_value is None:
        hours = _call(calendar, "getHours")
        if hours is None:
            hours = _call(calendar, "getCalendarHours")
    else:
        hours = _call_arg(calendar, "getHours", day_value)
        if hours is None:
            hours = _call_arg(calendar, "getCalendarHours", day_value)
    if hours is None:
        return []
    try:
        return list(hours)
    except Exception:
        return []


def _calendar_working_day(calendar: Any, day_value: Any) -> bool:
    value = _call_arg(calendar, "isWorkingDay", day_value)
    if isinstance(value, bool):
        return value
    day_type = str(_call_arg(calendar, "getDayType", day_value, "") or _call_arg(calendar, "getCalendarDayType", day_value, "")).upper()
    if "NON" in day_type or "REST" in day_type:
        return False
    if "WORK" in day_type or "DEFAULT" in day_type:
        return True
    return bool(_calendar_hours(calendar, day_value))


def _calendar_range_bounds(ranges: list[Any]) -> tuple[str | None, str | None]:
    starts: list[str] = []
    ends: list[str] = []
    for item in ranges:
        start = _time_text(_call(item, "getStart"))
        end = _time_text(_call(item, "getEnd"))
        if start:
            starts.append(start)
        if end:
            ends.append(end)
    if not starts or not ends:
        return None, None
    return min(starts), max(ends)


def _calendar_range_hours(ranges: list[Any]) -> float | None:
    total = 0
    for item in ranges:
        start = _time_minutes(_time_text(_call(item, "getStart")))
        end = _time_minutes(_time_text(_call(item, "getEnd")))
        if start is None or end is None or end <= start:
            continue
        total += end - start
    return total / 60 if total > 0 else None


def _date_key(value: Any) -> str | None:
    text = _fmt_dt(value)
    if not text:
        return None
    match = re.match(r"^\d{4}-\d{2}-\d{2}", text)
    return match.group(0) if match else None


def _date_range_keys(start: str | None, finish: str | None) -> list[str]:
    if not start:
        return []
    finish = finish or start
    try:
        cursor = date.fromisoformat(start)
        end = date.fromisoformat(finish)
    except ValueError:
        return [start]
    if end < cursor:
        end = cursor
    keys: list[str] = []
    while cursor <= end:
        keys.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return keys


def _calendar_exceptions(calendar: Any) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    exceptions = _call(calendar, "getExpandedCalendarExceptions")
    if exceptions is None:
        exceptions = _call(calendar, "getCalendarExceptions", [])
    non_working_days: list[dict[str, Any]] = []
    legacy_exceptions: list[dict[str, Any]] = []
    date_overrides: list[dict[str, Any]] = []
    try:
        exception_list = list(exceptions)
    except Exception:
        exception_list = []

    seen_non_working_dates: set[str] = set()
    for index, exception in enumerate(exception_list):
        start = _date_key(_call(exception, "getFromDate"))
        finish = _date_key(_call(exception, "getToDate")) or start
        is_working = bool(_call(exception, "getWorking", False))
        name = str(_call(exception, "getName", "") or "Día no laboral")
        for date_value in _date_range_keys(start, finish):
            legacy_exceptions.append({"date": date_value, "isWorking": is_working})
            override: dict[str, Any] = {
                "id": f"{date_value}-{index}",
                "date": date_value,
                "name": name,
                "isWorking": is_working,
            }
            exception_hours = _calendar_hours(exception, None)
            if exception_hours:
                override_start, override_end = _calendar_range_bounds(exception_hours)
                override_hours = _calendar_range_hours(exception_hours)
                if override_start:
                    override["startHour"] = override_start
                if override_end:
                    override["endHour"] = override_end
                if override_hours is not None:
                    override["hoursPerDay"] = int(override_hours) if float(override_hours).is_integer() else override_hours
            date_overrides.append(override)
            if is_working or date_value in seen_non_working_dates:
                continue
            seen_non_working_dates.add(date_value)
            non_working_days.append({
                "id": f"{date_value}-{index}",
                "date": date_value,
                "name": name,
            })

    non_working_days.sort(key=lambda item: item["date"])
    legacy_exceptions.sort(key=lambda item: item["date"])
    date_overrides.sort(key=lambda item: item["date"])
    return non_working_days, legacy_exceptions, date_overrides


def _extract_project_calendar(project: Any) -> dict[str, Any]:
    calendar = _call(project, "getDefaultCalendar")
    if calendar is None:
        calendars = _call(project, "getCalendarsForProject") or _call(project, "getCalendars")
        try:
            calendar = next(iter(calendars))
        except Exception:
            calendar = None
    if calendar is None:
        return dict(DEFAULT_PROJECT_CALENDAR)

    work_days: list[int] = []
    legacy_week_days: dict[int, bool] = {}
    start_hour: str | None = None
    end_hour: str | None = None
    range_hours: float | None = None

    for _name, project_day, legacy_day, day_value in _calendar_day_values():
        is_working = _calendar_working_day(calendar, day_value)
        legacy_week_days[legacy_day] = is_working
        if is_working:
            work_days.append(project_day)
            ranges = _calendar_hours(calendar, day_value)
            day_start, day_end = _calendar_range_bounds(ranges)
            start_hour = start_hour or day_start
            end_hour = end_hour or day_end
            range_hours = range_hours or _calendar_range_hours(ranges)

    minutes_per_day = _number_value(
        _call(calendar, "getCalendarMinutesPerDay")
        or _call(calendar, "getMinutesPerDay")
    )
    hours_per_day = (
        float(minutes_per_day) / 60
        if minutes_per_day is not None
        else range_hours or DEFAULT_PROJECT_CALENDAR["hoursPerDay"]
    )
    non_working_days, legacy_exceptions, date_overrides = _calendar_exceptions(calendar)

    return {
        "timeZone": DEFAULT_PROJECT_CALENDAR["timeZone"],
        "workDays": work_days or DEFAULT_PROJECT_CALENDAR["workDays"],
        "startHour": start_hour or DEFAULT_PROJECT_CALENDAR["startHour"],
        "endHour": end_hour or DEFAULT_PROJECT_CALENDAR["endHour"],
        "hoursPerDay": int(hours_per_day) if float(hours_per_day).is_integer() else hours_per_day,
        "nonWorkingDays": non_working_days,
        "dateOverrides": date_overrides,
        "weekDays": legacy_week_days or DEFAULT_PROJECT_CALENDAR["weekDays"],
        "exceptions": legacy_exceptions,
    }


def _extract_project_status_date(props: Any) -> str:
    """Return the MS Project status date when the file defines one."""
    return _fmt_dt(_call(props, "getStatusDate"))


def _number_value(value: Any) -> float | int | None:
    if value is None:
        return None
    amount = _call(value, "getAmount")
    if amount is not None:
        return _number_value(amount)
    raw = _json_value(value)
    if isinstance(raw, bool):
        return int(raw)
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return raw
    try:
        text = str(raw).replace(",", "")
        match = re.search(r"-?\d+(?:\.\d+)?", text)
        if match:
            number = float(match.group(0))
            return int(number) if number.is_integer() else number
    except Exception:
        return None
    return None


def _cost_rate_entry_value(entry: Any, *methods: str) -> float | int | None:
    for method in methods:
        value = _call(entry, method)
        number = _number_value(value)
        if number is not None:
            return number
    return None


def _cost_rate_entry_date(entry: Any, method: str) -> str | None:
    value = _call(entry, method)
    if value is None:
        return None
    formatted = _fmt_dt(value)
    return formatted or None


def _cost_rate_entry_payload(entry: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "startDate": _cost_rate_entry_date(entry, "getStartDate"),
        "endDate": _cost_rate_entry_date(entry, "getEndDate"),
        "standardRate": _cost_rate_entry_value(entry, "getStandardRate", "getRate"),
        "overtimeRate": _cost_rate_entry_value(entry, "getOvertimeRate"),
        "costPerUse": _cost_rate_entry_value(entry, "getCostPerUse"),
    }
    return {key: value for key, value in values.items() if value is not None}


def _cost_rate_table_entries(table: Any) -> list[Any]:
    entries = _call(table, "getEntries")
    if entries is None:
        entries = table
    try:
        return list(entries)
    except Exception:
        return []


def _read_cost_rate_table(resource: Any, index: int) -> Any:
    try:
        return resource.getCostRateTable(index)
    except Exception:
        return None


def _extract_cost_rate_tables(resource: Any) -> dict[str, dict[str, float | int]]:
    tables: dict[str, dict[str, float | int]] = {}
    for index, name in enumerate(COST_RATE_TABLE_NAMES):
        table = _read_cost_rate_table(resource, index)
        if table is None:
            continue
        entries = _cost_rate_table_entries(table)
        if not entries:
            continue
        entry_payloads = [
            payload
            for payload in (_cost_rate_entry_payload(entry) for entry in entries)
            if payload
        ]
        if not entry_payloads:
            continue
        cleaned = {
            key: value
            for key, value in entry_payloads[0].items()
            if key not in ("startDate", "endDate")
        }
        if len(entry_payloads) > 1 or "startDate" in entry_payloads[0] or "endDate" in entry_payloads[0]:
            cleaned["entries"] = entry_payloads
        if cleaned:
            tables[name] = cleaned
    return tables


def _availability_period_entries(table: Any) -> list[Any]:
    entries = _call(table, "getEntries")
    if entries is None:
        entries = table
    try:
        return list(entries)
    except Exception:
        return []


def _availability_period_date(entry: Any, *paths: tuple[str, ...]) -> str | None:
    for path in paths:
        value = entry
        for method in path:
            value = _call(value, method)
            if value is None:
                break
        if value is None:
            continue
        formatted = _fmt_dt(value)
        if formatted:
            return formatted
    return None


def _availability_period_units(entry: Any) -> float | int | None:
    for method in ("getUnits", "getMaxUnits", "getAvailability", "getPercentage"):
        value = _number_value(_call(entry, method))
        if value is not None:
            return value
    return None


def _availability_period_payload(entry: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "start": _availability_period_date(
            entry,
            ("getRange", "getStart"),
            ("getAvailableFrom",),
            ("getStartDate",),
            ("getStart",),
        ),
        "finish": _availability_period_date(
            entry,
            ("getRange", "getEnd"),
            ("getAvailableTo",),
            ("getEndDate",),
            ("getFinish",),
            ("getEnd",),
        ),
        "units": _availability_period_units(entry),
    }
    return {key: value for key, value in values.items() if value is not None and value != ""}


def _extract_resource_availability_periods(resource: Any) -> list[dict[str, Any]]:
    for method in (
        "getAvailability",
        "getAvailabilityTable",
        "getAvailabilityPeriods",
        "getResourceAvailability",
    ):
        table = _call(resource, method)
        if table is None:
            continue
        periods = [
            payload
            for payload in (_availability_period_payload(entry) for entry in _availability_period_entries(table))
            if payload
        ]
        if periods:
            return periods
    return []


def _extract_assignment_cost_rate_table(assignment: Any) -> str | None:
    index = _call(assignment, "getCostRateTableIndex")
    if index is not None:
        try:
            numeric_index = int(index)
            if 0 <= numeric_index < len(COST_RATE_TABLE_NAMES):
                return COST_RATE_TABLE_NAMES[numeric_index]
        except Exception:
            pass

    table = _call(assignment, "getCostRateTable")
    if table is None:
        return None
    text = str(table).strip()
    if not text:
        return None
    match = re.search(r"\b([A-E])\b$", text, re.IGNORECASE)
    return (match.group(1) if match else text).upper()


def _normalize_field_id(value: str) -> str:
    separated = re.sub(r"([A-Za-z])(\d+)", r"\1_\2", str(value))
    normalized = re.sub(r"[^A-Za-z0-9]+", "_", separated).strip("_").upper()
    return re.sub(r"_+", "_", normalized)


def _formula_dependencies(formula: str) -> list[str]:
    return sorted({
        _normalize_field_id(match.group(1))
        for match in re.finditer(r"\[([^\]]+)]", formula or "")
    })


SUPPORTED_CUSTOM_FORMULA_FUNCTIONS = {
    "ABS",
    "AND",
    "ATN",
    "CHOOSE",
    "CDBL",
    "CINT",
    "COS",
    "CSTR",
    "DATEADD",
    "DATEDIFF",
    "DATEPART",
    "DATESERIAL",
    "DATEVALUE",
    "DAY",
    "EXP",
    "FIX",
    "FORMAT",
    "HOUR",
    "IF",
    "IIF",
    "INSTR",
    "INT",
    "ISDATE",
    "ISNULL",
    "LCASE",
    "LEFT",
    "LEN",
    "LOG",
    "LTRIM",
    "MAX",
    "MID",
    "MIN",
    "MINUTE",
    "MOD",
    "MONTH",
    "NOT",
    "NOW",
    "NZ",
    "OR",
    "PROJDATEADD",
    "PROJDATECONV",
    "PROJDATEDIFF",
    "PROJDATESUB",
    "PROJDATEVALUE",
    "PROJDURCONV",
    "PROJDURVALUE",
    "RIGHT",
    "ROUND",
    "RTRIM",
    "SECOND",
    "REPLACE",
    "SGN",
    "SIN",
    "SQR",
    "SQRT",
    "STRCOMP",
    "SWITCH",
    "TAN",
    "TRIM",
    "UCASE",
    "VAL",
    "YEAR",
}


def _formula_function_names(formula: str) -> list[str]:
    names: set[str] = set()
    source = (formula or "").strip().lstrip("=")
    index = 0

    while index < len(source):
        char = source[index]
        if char in ("\"", "'"):
            index += 1
            while index < len(source) and source[index] != char:
                index += 1
            index += 1
            continue
        if char == "[":
            end = source.find("]", index + 1)
            index = len(source) if end == -1 else end + 1
            continue
        if char.isalpha() or char == "_":
            start = index
            while index < len(source) and (
                source[index].isalnum()
                or source[index] == "_"
                or source[index].isspace()
            ):
                index += 1
            name = re.sub(r"\s+", "", source[start:index]).upper()
            cursor = index
            while cursor < len(source) and source[cursor].isspace():
                cursor += 1
            if name and cursor < len(source) and source[cursor] == "(":
                names.add(name)
            continue
        index += 1

    return sorted(names)


def _unsupported_formula_reason(formula: str) -> str | None:
    if not formula:
        return None
    unsupported = [
        name
        for name in _formula_function_names(formula)
        if name not in SUPPORTED_CUSTOM_FORMULA_FUNCTIONS
    ]
    if not unsupported:
        return None
    joined = ", ".join(unsupported)
    return f"Funciones de formula no soportadas por el motor actual: {joined}"


def _lookup_values(custom_field: Any) -> list[Any]:
    lookup_table = _call(custom_field, "getLookupTable")
    if lookup_table is None:
        return []
    try:
        entries = lookup_table.getEntries()
    except Exception:
        entries = lookup_table
    values: list[Any] = []
    try:
        for entry in entries:
            value = (
                _call(entry, "getValue")
                or _call(entry, "getDescription")
                or _call(entry, "getFullValue")
                or entry
            )
            values.append(_json_value(value))
    except Exception:
        return []
    return values


def _extract_custom_field_definitions(project: Any, field_type_class: str, record_type: str) -> list[dict[str, Any]]:
    """Return custom field metadata keyed by FieldType name for one record kind."""
    definitions: list[dict[str, Any]] = []
    try:
        custom_fields = project.getCustomFields()
    except Exception:
        return definitions

    for custom_field in custom_fields:
        try:
            field = custom_field.getFieldType()
            if _field_type_class(field).upper() != field_type_class.upper():
                continue
            alias = str(custom_field.getAlias() or "").strip()
            field_id = _field_id(field)
            formula = str(
                _call(custom_field, "getFormula", "")
                or _call(custom_field, "getFormulaText", "")
                or ""
            ).strip()
            rollup = (
                _call(custom_field, "getSummaryRowsCalculationType", "")
                or _call(custom_field, "getRollupType", "")
                or ""
            )
            unsupported_reason = _unsupported_formula_reason(formula)
            mask = _call(custom_field, "getMask", "")
            indicators = _call(custom_field, "getGraphicalIndicators", None)
            definitions.append({
                "fieldId": field_id,
                "recordType": record_type,
                "alias": alias,
                "dataType": _field_data_type(field),
                "formula": formula or None,
                "dependencies": _formula_dependencies(formula),
                "rollupType": str(rollup) if rollup else None,
                "lookupValues": _lookup_values(custom_field),
                "graphicalIndicators": _json_value(indicators) if indicators is not None else None,
                "mask": str(mask) if mask else None,
                "unsupportedFormula": bool(unsupported_reason),
                "unsupportedReason": unsupported_reason,
            })
        except Exception:
            continue
    return definitions


def _calculation_spec(definition: dict[str, Any] | None) -> dict[str, Any] | None:
    if not definition:
        return None
    formula = definition.get("formula")
    return {
        "calculationKind": "customFormula" if formula else "input",
        "formula": formula,
        "dependencies": definition.get("dependencies") or [],
        "rollupType": definition.get("rollupType"),
        "isCalculated": bool(formula),
        "isEditableWhenCalculated": False,
        "sourceOfTruth": "customFormula" if formula else "user",
        "unsupportedReason": (
            definition.get("unsupportedReason")
            or "Formula importada no soportada por el motor actual."
            if definition.get("unsupportedFormula")
            else None
        ),
    }


def _field_metadata(
    project: Any,
    container: Any,
    field_type_class: str,
    record_type: str,
) -> tuple[list[Any], list[dict[str, Any]], list[dict[str, Any]]]:
    """Extract populated fields plus bilingual-ready column metadata for a table."""
    try:
        fields = list(container.getPopulatedFields())
    except Exception:
        fields = []

    custom_definitions = _extract_custom_field_definitions(project, field_type_class, record_type)
    definitions_by_field = {
        definition["fieldId"]: definition
        for definition in custom_definitions
    }
    columns: list[dict[str, Any]] = []
    seen_field_ids: set[str] = set()

    for field in fields:
        field_id = _field_id(field)
        seen_field_ids.add(field_id)
        definition = definitions_by_field.get(field_id)
        alias = str(definition.get("alias", "") if definition else "").strip()
        label = alias or _field_name(field)
        formula = definition.get("formula") if definition else None
        columns.append({
            "key": f"mpp:{field_id}" if record_type == "task" else f"mpp:{record_type}:{field_id}",
            "fieldId": field_id,
            "sourceKey": field_id,
            "labelEn": label,
            "labelEs": label if alias else "",
            "alias": alias,
            "dataType": _field_data_type(field),
            "group": "custom" if alias else "other",
            "recordType": record_type,
            "isCustom": bool(alias or definition),
            "isCore": False,
            "isEditable": bool(alias or definition) and not bool(formula),
            "calculationSpec": _calculation_spec(definition),
        })

    for definition in custom_definitions:
        field_id = definition["fieldId"]
        if field_id in seen_field_ids:
            continue
        alias = str(definition.get("alias") or "").strip()
        label = alias or field_id.replace("_", " ").title()
        formula = definition.get("formula")
        columns.append({
            "key": f"mpp:{field_id}" if record_type == "task" else f"mpp:{record_type}:{field_id}",
            "fieldId": field_id,
            "sourceKey": field_id,
            "labelEn": label,
            "labelEs": label,
            "alias": alias,
            "dataType": definition.get("dataType") or "STRING",
            "group": "custom",
            "recordType": record_type,
            "isCustom": True,
            "isCore": False,
            "isEditable": not bool(formula),
            "calculationSpec": _calculation_spec(definition),
        })

    columns.sort(key=lambda item: str(item.get("labelEn", item.get("fieldId", ""))))
    return fields, columns, custom_definitions


def _extract_fields(record: Any, fields: list[Any]) -> dict[str, Any]:
    """Read all populated fields from a Task/Resource/Assignment FieldContainer."""
    values: dict[str, Any] = {}
    for field in fields:
        try:
            value = record.getCachedValue(field)
        except Exception:
            value = None
        if value is None:
            continue
        values[_field_id(field)] = _json_value(value)
    return values


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


def _enum_value(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value.getValue())
    except Exception:
        pass
    try:
        return int(value)
    except Exception:
        return default


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
        status_date = _extract_project_status_date(props)
        task_fields, mpp_task_columns, task_custom_fields = _field_metadata(
            project,
            project.getTasks(),
            "TASK",
            "task",
        )
        resource_fields, mpp_resource_columns, resource_custom_fields = _field_metadata(
            project,
            project.getResources(),
            "RESOURCE",
            "resource",
        )
        assignment_container = project.getResourceAssignments()
        assignment_fields, mpp_assignment_columns, assignment_custom_fields = _field_metadata(
            project,
            assignment_container,
            "ASSIGNMENT",
            "assignment",
        )

        resources = []
        for r in project.getResources():
            try:
                rtype = int(r.getType()) if r.getType() else 0
            except Exception:
                rtype = 0
            resource = {
                "UID": r.getUniqueID(),
                "ID": _call(r, "getID", r.getUniqueID()),
                "Name": str(r.getName()) if r.getName() else "",
                "Type": rtype,
                "mppFields": {},
            }
            resource["mppFields"] = _extract_fields(r, resource_fields)
            cost_rate_tables = _extract_cost_rate_tables(r)
            if cost_rate_tables:
                resource["mppFields"]["COST_RATE_TABLES"] = cost_rate_tables
            availability_periods = _extract_resource_availability_periods(r)
            if availability_periods:
                resource["mppFields"]["AVAILABILITY_PERIODS"] = availability_periods
            for field_key, field_value in resource["mppFields"].items():
                resource[field_key] = field_value
            resources.append(resource)

        tasks = []
        for t in project.getTasks():
            if t.getUniqueID() == 0 and t.getName() is None:
                continue
            dur = str(t.getDuration()) if t.getDuration() else "PT0H0M0S"
            constraint_type = _call(t, "getConstraintType")
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
                "ConstraintType": _enum_value(constraint_type, 0),
                "ConstraintDate": _fmt_dt(_call(t, "getConstraintDate")),
                "Deadline": _fmt_dt(_call(t, "getDeadline")),
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
                "mppFields": {},
            }

            task["mppFields"] = _extract_fields(t, task_fields)
            for field_key, json_value in task["mppFields"].items():
                task[field_key] = json_value

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

        assignments = []
        for assignment in assignment_container:
            task_ref = _call(assignment, "getTask")
            resource_ref = _call(assignment, "getResource")
            assignment_uid = _call(assignment, "getUniqueID")
            task_uid = _call(task_ref, "getUniqueID", 0) if task_ref else 0
            task_id = _call(task_ref, "getID", task_uid) if task_ref else 0
            resource_uid = _call(resource_ref, "getUniqueID", 0) if resource_ref else 0
            resource_id = _call(resource_ref, "getID", resource_uid) if resource_ref else 0
            units = _call(assignment, "getUnits", 100)
            cost = _call(assignment, "getCost", 0)
            record = {
                "UID": assignment_uid,
                "TaskUID": task_uid,
                "TaskID": task_id,
                "ResourceUID": resource_uid,
                "ResourceID": resource_id,
                "Units": _json_value(units),
                "Cost": _json_value(cost),
                "mppFields": {},
            }
            record["mppFields"] = _extract_fields(assignment, assignment_fields)
            cost_rate_table = _extract_assignment_cost_rate_table(assignment)
            if cost_rate_table:
                record["mppFields"]["COST_RATE_TABLE"] = cost_rate_table
            for field_key, field_value in record["mppFields"].items():
                record[field_key] = field_value
            assignments.append(record)

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
            "statusDate": status_date,
            "tasks": tasks,
            "resources": resources,
            "assignments": assignments,
            "calendar": _extract_project_calendar(project),
            "availableColumns": _extract_available_columns(tasks),
            "availableResourceColumns": _extract_available_columns(resources),
            "availableAssignmentColumns": _extract_available_columns(assignments),
            "mppTaskColumns": mpp_task_columns,
            "mppResourceColumns": mpp_resource_columns,
            "mppAssignmentColumns": mpp_assignment_columns,
            "customFieldDefinitions": [
                *task_custom_fields,
                *resource_custom_fields,
                *assignment_custom_fields,
            ],
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
