import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.mpp_converter import (
    _extract_assignment_cost_rate_table,
    _extract_cost_rate_tables,
    _extract_custom_field_definitions,
    _extract_project_status_date,
    _extract_project_calendar,
    _extract_resource_availability_periods,
)


class FakeValue:
    def __init__(self, value):
        self.value = value

    def getAmount(self):
        return self.value


class FakeDate:
    def __init__(self, value):
        self.value = value

    def format(self, _pattern):
        return self.value


class FakeProjectProperties:
    def getStatusDate(self):
        return FakeDate("2026-01-08T00:00:00")


class FakeRateEntry:
    def __init__(self, standard, overtime, cost_per_use, start=None, end=None):
        self.standard = standard
        self.overtime = overtime
        self.cost_per_use = cost_per_use
        self.start = start
        self.end = end

    def getStartDate(self):
        return FakeDate(self.start) if self.start else None

    def getEndDate(self):
        return FakeDate(self.end) if self.end else None

    def getStandardRate(self):
        return FakeValue(self.standard)

    def getOvertimeRate(self):
        return FakeValue(self.overtime)

    def getCostPerUse(self):
        return FakeValue(self.cost_per_use)


class FakeCostRateTable:
    def __init__(self, entries):
        self.entries = entries

    def getEntries(self):
        return self.entries


class FakeResource:
    def getCostRateTable(self, index):
        tables = {
            0: FakeCostRateTable([FakeRateEntry(100, 150, 10)]),
            1: FakeCostRateTable([
                FakeRateEntry(200, 300, 40, "2026-01-01T00:00:00"),
                FakeRateEntry(250, 375, 80, "2026-02-01T00:00:00"),
            ]),
        }
        return tables.get(index)


class FakeTableName:
    def __str__(self):
        return "B"


class FakeAssignment:
    def getCostRateTable(self):
        return FakeTableName()


class FakeAssignmentByIndex:
    def getCostRateTableIndex(self):
        return 1


class FakeDateRange:
    def __init__(self, start, end):
        self.start = start
        self.end = end

    def getStart(self):
        return FakeDate(self.start)

    def getEnd(self):
        return FakeDate(self.end)


class FakeAvailabilityPeriod:
    def __init__(self, start, end, units):
        self.range = FakeDateRange(start, end)
        self.units = units

    def getRange(self):
        return self.range

    def getUnits(self):
        return FakeValue(self.units)


class FakeAvailabilityResource:
    def getAvailability(self):
        return [
            FakeAvailabilityPeriod("2026-01-01T00:00:00", "2026-01-15T23:59:59", 150),
            FakeAvailabilityPeriod("2026-01-16T00:00:00", None, 200),
        ]


class FakeCustomFieldType:
    def __init__(self, field_id, field_type_class="TASK", data_type="NUMBER"):
        self.field_id = field_id
        self.field_type_class = field_type_class
        self.data_type = data_type

    def name(self):
        return self.field_id

    def getFieldTypeClass(self):
        return self.field_type_class

    def getDataType(self):
        return self.data_type


class FakeCustomField:
    def __init__(self, field_id, alias, formula):
        self.field = FakeCustomFieldType(field_id)
        self.alias = alias
        self.formula = formula

    def getFieldType(self):
        return self.field

    def getAlias(self):
        return self.alias

    def getFormula(self):
        return self.formula


class FakeCustomFieldProject:
    def getCustomFields(self):
        return [
            FakeCustomField("NUMBER1", "Factor", "IIf([Cost] > 0, Round([Cost] / 100, 2), 0)"),
            FakeCustomField("NUMBER2", "No soportado", "ProjDurConv([Duration]) + CustomFoo([Cost])"),
            FakeCustomField("TEXT1", "Código limpio", 'Replace([Name], "Torre", "Bloque") & StrComp([Code], "A-10") & Sgn([Variance])'),
            FakeCustomField("TEXT2", "Mes costo", 'Format([Finish], "yyyy-mm") & "-" & Format([Cost], "#,##0.00")'),
            FakeCustomField("NUMBER3", "Carga trigonométrica", "Sqr([Number1]) + Mod([Cost], 7) + Sin([Angle]) + Cos([Angle]) + Tan([Angle]) + Atn([Slope]) + Log([Cost]) + Exp([Slope])"),
            FakeCustomField("NUMBER4", "Potencia", "[Number1] ^ 2 + [Cost]"),
        ]


class FakeTime:
    def __init__(self, value):
        self.value = value

    def __str__(self):
        return self.value


class FakeTimeRange:
    def __init__(self, start, end):
        self.start = start
        self.end = end

    def getStart(self):
        return FakeTime(self.start)

    def getEnd(self):
        return FakeTime(self.end)


class FakeCalendarException:
    def __init__(self, date, name="Día festivo", working=False, hours=None):
        self.date = date
        self.name = name
        self.working = working
        self.hours = hours or []

    def getFromDate(self):
        return self.date

    def getToDate(self):
        return self.date

    def getName(self):
        return self.name

    def getWorking(self):
        return self.working

    def getHours(self):
        return self.hours


class FakeProjectCalendar:
    def isWorkingDay(self, day):
        return str(day).upper() in {"MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"}

    def getHours(self, day):
        if not self.isWorkingDay(day):
            return []
        return [FakeTimeRange("08:30", "12:00"), FakeTimeRange("13:00", "17:30")]

    def getCalendarMinutesPerDay(self):
        return 450

    def getExpandedCalendarExceptions(self):
        return [
            FakeCalendarException("2026-01-06", "Día festivo"),
            FakeCalendarException(
                "2026-01-11",
                "Jornada especial",
                working=True,
                hours=[FakeTimeRange("09:00", "13:00")],
            ),
        ]


class FakeCalendarProject:
    def getDefaultCalendar(self):
        return FakeProjectCalendar()


class CostRateTableExtractionTest(unittest.TestCase):
    def test_extracts_resource_cost_rate_tables_a_to_e(self):
        tables = _extract_cost_rate_tables(FakeResource())

        self.assertEqual(tables["A"]["standardRate"], 100)
        self.assertEqual(tables["A"]["overtimeRate"], 150)
        self.assertEqual(tables["A"]["costPerUse"], 10)
        self.assertEqual(tables["B"]["standardRate"], 200)
        self.assertEqual(tables["B"]["entries"], [
            {
                "startDate": "2026-01-01T00:00:00",
                "standardRate": 200,
                "overtimeRate": 300,
                "costPerUse": 40,
            },
            {
                "startDate": "2026-02-01T00:00:00",
                "standardRate": 250,
                "overtimeRate": 375,
                "costPerUse": 80,
            },
        ])

    def test_extracts_assignment_selected_cost_rate_table(self):
        self.assertEqual(_extract_assignment_cost_rate_table(FakeAssignment()), "B")

    def test_extracts_assignment_selected_cost_rate_table_from_index(self):
        self.assertEqual(_extract_assignment_cost_rate_table(FakeAssignmentByIndex()), "B")

    def test_extracts_resource_availability_periods(self):
        periods = _extract_resource_availability_periods(FakeAvailabilityResource())

        self.assertEqual(periods, [
            {
                "start": "2026-01-01T00:00:00",
                "finish": "2026-01-15T23:59:59",
                "units": 150,
            },
            {
                "start": "2026-01-16T00:00:00",
                "units": 200,
            },
        ])

    def test_marks_imported_custom_formulas_outside_supported_subset(self):
        definitions = _extract_custom_field_definitions(FakeCustomFieldProject(), "TASK", "task")
        by_field = {definition["fieldId"]: definition for definition in definitions}

        self.assertFalse(by_field["NUMBER1"]["unsupportedFormula"])
        self.assertIsNone(by_field["NUMBER1"].get("unsupportedReason"))
        self.assertEqual(by_field["NUMBER1"]["dependencies"], ["COST"])
        self.assertFalse(by_field["TEXT1"]["unsupportedFormula"])
        self.assertIsNone(by_field["TEXT1"].get("unsupportedReason"))
        self.assertEqual(by_field["TEXT1"]["dependencies"], ["CODE", "NAME", "VARIANCE"])
        self.assertFalse(by_field["TEXT2"]["unsupportedFormula"])
        self.assertIsNone(by_field["TEXT2"].get("unsupportedReason"))
        self.assertEqual(by_field["TEXT2"]["dependencies"], ["COST", "FINISH"])
        self.assertFalse(by_field["NUMBER3"]["unsupportedFormula"])
        self.assertIsNone(by_field["NUMBER3"].get("unsupportedReason"))
        self.assertEqual(by_field["NUMBER3"]["dependencies"], ["ANGLE", "COST", "NUMBER_1", "SLOPE"])
        self.assertFalse(by_field["NUMBER4"]["unsupportedFormula"])
        self.assertIsNone(by_field["NUMBER4"].get("unsupportedReason"))
        self.assertEqual(by_field["NUMBER4"]["dependencies"], ["COST", "NUMBER_1"])
        self.assertTrue(by_field["NUMBER2"]["unsupportedFormula"])
        self.assertIn("CUSTOMFOO", by_field["NUMBER2"]["unsupportedReason"])
        self.assertEqual(by_field["NUMBER2"]["dependencies"], ["COST", "DURATION"])

    def test_extracts_project_status_date_from_properties(self):
        self.assertEqual(
            _extract_project_status_date(FakeProjectProperties()),
            "2026-01-08T00:00:00",
        )

    def test_extracts_project_calendar_for_schedule_calculations(self):
        calendar = _extract_project_calendar(FakeCalendarProject())

        self.assertEqual(calendar["workDays"], [1, 2, 3, 4, 5])
        self.assertEqual(calendar["startHour"], "08:30")
        self.assertEqual(calendar["endHour"], "17:30")
        self.assertEqual(calendar["hoursPerDay"], 7.5)
        self.assertEqual(calendar["nonWorkingDays"], [
            {
                "id": "2026-01-06-0",
                "date": "2026-01-06",
                "name": "Día festivo",
            },
        ])
        self.assertEqual(calendar["dateOverrides"], [
            {
                "id": "2026-01-06-0",
                "date": "2026-01-06",
                "name": "Día festivo",
                "isWorking": False,
            },
            {
                "id": "2026-01-11-1",
                "date": "2026-01-11",
                "name": "Jornada especial",
                "isWorking": True,
                "startHour": "09:00",
                "endHour": "13:00",
                "hoursPerDay": 4,
            },
        ])
        self.assertEqual(calendar["weekDays"], {
            1: False,
            2: True,
            3: True,
            4: True,
            5: True,
            6: True,
            7: False,
        })
        self.assertEqual(calendar["exceptions"], [
            {
                "date": "2026-01-06",
                "isWorking": False,
            },
            {
                "date": "2026-01-11",
                "isWorking": True,
            },
        ])


if __name__ == "__main__":
    unittest.main()
