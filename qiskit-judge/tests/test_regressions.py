import unittest
import pathlib
import sys
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from problems.base import TestResult
from runner import run_evaluation
import worker


class _FailingHiddenJudge:
    max_score = 10

    def run_public_tests(self, user_module):
        return [TestResult("public", 1, "Public test", passed=True)]

    def run_hidden_tests(self, user_module):
        raise RuntimeError("internal hidden failure")

    def calculate_score(self, public_results, hidden_results):
        return self.max_score


class RunnerRegressionTests(unittest.TestCase):
    def test_hidden_suite_failure_cannot_report_success(self):
        with patch("problems.get_judge", return_value=_FailingHiddenJudge()):
            result = run_evaluation("P1", "", mode="submit")

        self.assertFalse(result["success"])
        self.assertEqual(result["score"], 0)
        self.assertEqual(result["total_tests"], 2)
        self.assertEqual(result["hidden_results"][0]["error_message"],
                         "Hidden test failed. Check edge cases, conventions, and constraints.")


class WorkerRegressionTests(unittest.TestCase):
    def test_empty_bearer_token_returns_unauthorized(self):
        with patch.object(worker, "JUDGE_SECRET", "configured-secret"):
            with self.assertRaises(worker.HTTPException) as raised:
                worker.verify_token("Bearer ")

        self.assertEqual(raised.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
