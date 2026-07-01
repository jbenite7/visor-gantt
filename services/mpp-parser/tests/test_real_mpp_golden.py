import json
import os
import sys
import unittest
import uuid
from pathlib import Path
from urllib import error, request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.mpp_converter import MPPConversionError, convert_mpp_to_json


FIXTURE = (
    Path(__file__).resolve().parents[3]
    / "test_data"
    / "20260430 PROGRAMACION ESTACION 16 - ML1 R2.mpp"
)
PRECONSTRUCTION_FIXTURE = Path(
    os.environ.get(
        "VISOR_GANTT_PRECONSTRUCTION_MPP_FIXTURE",
        str(Path.home() / "Downloads" / "20260303_Cronograma preconstrucción_DP 2.mpp"),
    )
)
PLAN_ACTION_FIXTURE = next(
    (Path(__file__).resolve().parents[3] / "test_data").glob(
        "20260530 cronograma plan de acci*n v1.mpp"
    ),
    Path(__file__).resolve().parents[3] / "test_data" / "20260530 cronograma plan de accion v1.mpp",
)


def _parse_with_service(path):
    boundary = "----VisorGanttGolden" + uuid.uuid4().hex
    body = bytearray()
    body.extend(
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'
            "Content-Type: application/octet-stream\r\n\r\n"
        ).encode()
    )
    body.extend(path.read_bytes())
    body.extend(f"\r\n--{boundary}--\r\n".encode())

    req = request.Request(
        "http://localhost:8000/api/parse-mpp",
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _load_project_or_skip(fixture):
    if not fixture.exists():
        raise unittest.SkipTest(f"Real .mpp fixture not found: {fixture}")

    try:
        return _parse_with_service(fixture)
    except (TimeoutError, OSError, error.URLError, error.HTTPError):
        pass

    try:
        return convert_mpp_to_json(str(fixture))
    except MPPConversionError as exc:
        message = str(exc)
        if (
            "Java Runtime" in message
            or "java_home" in message
            or "No JVM" in message
            or "JVM" in message
        ):
            raise unittest.SkipTest(f"Java runtime unavailable: {message}")
        raise


class RealMppGoldenTest(unittest.TestCase):
    """Golden smoke test for a real MPXJ import.

    The local developer machine may not have a Java runtime installed. In that
    case this test skips cleanly; it is expected to run inside the mpp-parser
    Docker image or any environment with MPXJ/JVM available and the fixture
    mounted at the repository root.
    """

    @classmethod
    def setUpClass(cls):
        cls.project = _load_project_or_skip(FIXTURE)

    def test_real_mpp_preserves_core_counts_and_column_catalogs(self):
        self.assertEqual("Proyecto Importado", self.project["name"])
        self.assertEqual("2025-08-21T07:00", self.project["startDate"])
        self.assertEqual("2026-10-07T16:00", self.project["finishDate"])

        self.assertEqual(301, len(self.project["tasks"]))
        self.assertEqual(18, len(self.project["resources"]))
        self.assertEqual(449, len(self.project["assignments"]))
        self.assertEqual(72, len(self.project["mppTaskColumns"]))
        self.assertEqual(39, len(self.project["mppResourceColumns"]))
        self.assertEqual(19, len(self.project["mppAssignmentColumns"]))
        self.assertEqual(16, len(self.project["customFieldDefinitions"]))

    def test_real_mpp_preserves_calculated_fields_and_custom_aliases(self):
        task_by_uid = {
            task["UID"]: task
            for task in self.project["tasks"]
        }
        milestone = task_by_uid[14302]

        self.assertEqual("Inicio de obra Edificio 1 (Sur)", milestone["Name"])
        self.assertEqual("3.1.2", milestone["WBS"])
        self.assertTrue(milestone["Milestone"])
        self.assertEqual([14755], milestone["predecessors"])
        self.assertEqual("START_NO_EARLIER_THAN", milestone["mppFields"]["CONSTRAINT_TYPE"])
        self.assertEqual("PHYSICAL_PERCENT_COMPLETE", milestone["mppFields"]["EARNED_VALUE_METHOD"])
        self.assertEqual("0.0d", milestone["mppFields"]["FREE_SLACK"])

        aliases = {
            definition["fieldId"]: definition["alias"]
            for definition in self.project["customFieldDefinitions"]
        }
        self.assertEqual("CANTIDAD", aliases["NUMBER1"])
        self.assertEqual("RENDIMIENTO", aliases["NUMBER2"])
        self.assertEqual("% PLAN", aliases["TEXT30"])
        self.assertEqual("NIVEL", aliases["TEXT22"])

    def test_real_mpp_preserves_assignment_fields(self):
        assignment = self.project["assignments"][0]

        self.assertEqual(12994, assignment["UID"])
        self.assertEqual(14302, assignment["TaskUID"])
        self.assertEqual(100.0, assignment["Units"])
        self.assertEqual("FLAT", assignment["mppFields"]["WORK_CONTOUR"])
        self.assertEqual("A", assignment["mppFields"]["COST_RATE_TABLE"])
        self.assertEqual("2026-01-10T16:00", assignment["mppFields"]["START"])
        self.assertEqual("2026-01-10T16:00", assignment["mppFields"]["FINISH"])


class PreconstructionMppGoldenTest(unittest.TestCase):
    """Golden smoke test for the preconstruction .mpp used in app validation."""

    @classmethod
    def setUpClass(cls):
        cls.project = _load_project_or_skip(PRECONSTRUCTION_FIXTURE)

    def test_preconstruction_mpp_preserves_core_counts_and_columns(self):
        self.assertEqual("Proyecto Importado", self.project["name"])
        self.assertEqual("2026-03-09T09:00", self.project["startDate"])
        self.assertEqual("2026-09-11T19:00", self.project["finishDate"])

        self.assertEqual(170, len(self.project["tasks"]))
        self.assertEqual(1, len(self.project["resources"]))
        self.assertEqual(130, len(self.project["assignments"]))
        self.assertEqual(48, len(self.project["mppTaskColumns"]))
        self.assertEqual(31, len(self.project["mppResourceColumns"]))
        self.assertEqual(21, len(self.project["mppAssignmentColumns"]))
        self.assertEqual(0, len(self.project["customFieldDefinitions"]))

    def test_preconstruction_mpp_preserves_schedule_and_assignment_fields(self):
        task_by_uid = {
            task["UID"]: task
            for task in self.project["tasks"]
        }
        contract_task = task_by_uid[109]
        self.assertEqual("Contrato revisor estructural", contract_task["Name"])
        self.assertEqual("START_NO_EARLIER_THAN", contract_task["mppFields"]["CONSTRAINT_TYPE"])
        self.assertEqual("1.1.4", contract_task["mppFields"]["WBS"])
        self.assertEqual("123.0d", contract_task["mppFields"]["FREE_SLACK"])

        assignment = self.project["assignments"][4]
        self.assertEqual(6, assignment["UID"])
        self.assertEqual(6, assignment["TaskUID"])
        self.assertEqual(100.0, assignment["Units"])
        self.assertEqual("80.0h", assignment["mppFields"]["WORK"])
        self.assertEqual("40.0h", assignment["mppFields"]["ACTUAL_WORK"])
        self.assertEqual("40.0h", assignment["mppFields"]["REMAINING_WORK"])
        self.assertEqual("2026-03-09T09:00", assignment["mppFields"]["START"])
        self.assertEqual("2026-03-20T19:00", assignment["mppFields"]["FINISH"])
        self.assertEqual("A", assignment["mppFields"]["COST_RATE_TABLE"])


class PlanActionMppGoldenTest(unittest.TestCase):
    """Golden test for a larger .mpp with baseline and custom task fields."""

    @classmethod
    def setUpClass(cls):
        cls.project = _load_project_or_skip(PLAN_ACTION_FIXTURE)

    def test_plan_action_mpp_preserves_large_project_counts(self):
        self.assertEqual("Proyecto Importado", self.project["name"])
        self.assertEqual("2026-04-24T07:00", self.project["startDate"])
        self.assertEqual("2027-04-24T17:00", self.project["finishDate"])

        self.assertEqual(1891, len(self.project["tasks"]))
        self.assertEqual(2, len(self.project["resources"]))
        self.assertEqual(1475, len(self.project["assignments"]))
        self.assertEqual(59, len(self.project["mppTaskColumns"]))
        self.assertEqual(36, len(self.project["mppResourceColumns"]))
        self.assertEqual(20, len(self.project["mppAssignmentColumns"]))
        self.assertEqual(10, len(self.project["customFieldDefinitions"]))

    def test_plan_action_mpp_preserves_baseline_cost_and_wbs_fields(self):
        task_by_uid = {
            task["UID"]: task
            for task in self.project["tasks"]
        }
        task = task_by_uid[12626]

        self.assertEqual("Instalación módulo escalera", task["Name"])
        self.assertEqual("8.3.2", task["WBS"])
        self.assertEqual("15.0d", task["Duration"])
        self.assertEqual("2026-07-02T07:00", task["Start"])
        self.assertEqual("2026-07-18T17:00", task["Finish"])

        fields = task["mppFields"]
        self.assertEqual("2026-07-02T07:00", fields["EARLY_START"])
        self.assertEqual("2026-07-18T17:00", fields["EARLY_FINISH"])
        self.assertEqual("2026-08-20T07:00", fields["LATE_START"])
        self.assertEqual("2026-09-05T17:00", fields["LATE_FINISH"])
        self.assertEqual("39.0d", fields["START_SLACK"])
        self.assertEqual("39.0d", fields["FINISH_SLACK"])
        self.assertEqual(67452067.0, fields["COST"])
        self.assertEqual(67452067.0, fields["REMAINING_COST"])
        self.assertEqual(67452067.0, fields["FIXED_COST"])
        self.assertEqual("2025-01-23T07:00", fields["BASELINE_START"])
        self.assertEqual("2025-02-26T17:00", fields["BASELINE_FINISH"])
        self.assertEqual("30.0d", fields["BASELINE_DURATION"])
        self.assertEqual("START_NO_EARLIER_THAN", fields["CONSTRAINT_TYPE"])
        self.assertEqual("2026-07-02T07:00", fields["CONSTRAINT_DATE"])
        self.assertEqual(3, fields["OUTLINE_LEVEL"])
        self.assertEqual("8.3.2", fields["OUTLINE_NUMBER"])
        self.assertEqual(0, fields["SUMMARY"])
        self.assertEqual(0, fields["MILESTONE"])
        self.assertAlmostEqual(17.0, fields["NUMBER6"], places=6)
        self.assertEqual("0,00%", fields["TEXT2"])

    def test_plan_action_mpp_preserves_summary_rollup_like_fields(self):
        task_by_uid = {
            task["UID"]: task
            for task in self.project["tasks"]
        }
        summary = task_by_uid[15611]

        self.assertEqual("Redes", summary["Name"])
        self.assertEqual("14.7", summary["WBS"])
        self.assertEqual("122.0d", summary["Duration"])
        self.assertEqual("2026-10-16T07:00", summary["Start"])
        self.assertEqual("2027-03-09T17:00", summary["Finish"])

        fields = summary["mppFields"]
        self.assertEqual(1, fields["SUMMARY"])
        self.assertEqual(0, fields["MILESTONE"])
        self.assertEqual("2027-03-05T07:00", fields["LATE_START"])
        self.assertEqual("2027-04-24T17:00", fields["LATE_FINISH"])
        self.assertEqual("40.0d", fields["FREE_SLACK"])
        self.assertEqual("118.0d", fields["START_SLACK"])
        self.assertEqual("40.0d", fields["FINISH_SLACK"])
        self.assertEqual(573360950.0, fields["COST"])
        self.assertEqual(573360950.0, fields["REMAINING_COST"])
        self.assertEqual("2025-02-24T07:00", fields["BASELINE_START"])
        self.assertEqual("2025-07-21T17:00", fields["BASELINE_FINISH"])
        self.assertEqual("119.0d", fields["BASELINE_DURATION"])
        self.assertEqual(2, fields["OUTLINE_LEVEL"])
        self.assertEqual("14.7", fields["OUTLINE_NUMBER"])

    def test_plan_action_mpp_preserves_timephased_assignment_fields(self):
        assignment = self.project["assignments"][1]

        self.assertEqual(11498, assignment["UID"])
        self.assertEqual(12472, assignment["TaskUID"])
        self.assertEqual(1509, assignment["TaskID"])
        self.assertEqual(100.0, assignment["Units"])

        fields = assignment["mppFields"]
        self.assertEqual(11498, fields["UNIQUE_ID"])
        self.assertEqual(12472, fields["TASK_UNIQUE_ID"])
        self.assertEqual(100.0, fields["ASSIGNMENT_UNITS"])
        self.assertEqual("2025-09-01T12:00", fields["BASELINE_START"])
        self.assertEqual("2025-10-06T12:00", fields["BASELINE_FINISH"])
        self.assertEqual("300.0h", fields["REGULAR_WORK"])
        self.assertEqual("300.0h", fields["WORK"])
        self.assertEqual("300.0h", fields["REMAINING_WORK"])
        self.assertEqual("2026-09-26T07:00", fields["START"])
        self.assertEqual("2026-10-31T17:00", fields["FINISH"])
        self.assertEqual("A", fields["COST_RATE_TABLE"])
        self.assertEqual(1, len(fields["RAW_TIMEPHASED_REMAINING_REGULAR_WORK"]))
        self.assertIn(
            "totalAmount=18000.0m",
            fields["RAW_TIMEPHASED_REMAINING_REGULAR_WORK"][0],
        )

    def test_plan_action_mpp_preserves_custom_aliases_and_resource_rates(self):
        aliases = {
            definition["fieldId"]: definition["alias"]
            for definition in self.project["customFieldDefinitions"]
        }
        self.assertEqual("CANTIDAD", aliases["NUMBER1"])
        self.assertEqual("RENDIMIENTO", aliases["NUMBER2"])
        self.assertEqual("% Planeado", aliases["NUMBER3"])
        self.assertEqual("Días calendario", aliases["NUMBER6"])
        self.assertEqual("% COMPLETADO - DECIMALES", aliases["TEXT2"])
        self.assertEqual("Unidad", aliases["TEXT1"])

        resource = self.project["resources"][1]
        self.assertEqual(145, resource["UID"])
        self.assertEqual("ENCOFRADO MURO-LOSA", resource["Name"])

        fields = resource["mppFields"]
        self.assertEqual("WORK", fields["TYPE"])
        self.assertEqual(100.0, fields["MAX_UNITS"])
        self.assertEqual("h", fields["STANDARD_RATE_UNITS"])
        self.assertEqual("h", fields["OVERTIME_RATE_UNITS"])
        self.assertIn("A", fields["COST_RATE_TABLES"])
        self.assertEqual(0.0, fields["COST_RATE_TABLES"]["A"]["standardRate"])


if __name__ == "__main__":
    unittest.main()
