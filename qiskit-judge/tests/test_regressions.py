import unittest
import asyncio
import io
import pathlib
import sys
import threading
from unittest.mock import patch
from starlette.requests import Request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from problems.base import TestResult
from runner import (
    MAX_SOURCE_BYTES,
    MAX_OUTPUT_BYTES,
    OutputLimitExceeded,
    _child_environment,
    _CappedOutput,
    _read_output,
    _run_evaluation_in_process,
    run_evaluation,
)
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
            result = _run_evaluation_in_process("P1", "", mode="submit")

        self.assertFalse(result["success"])
        self.assertEqual(result["score"], 0)
        self.assertEqual(result["total_tests"], 2)
        self.assertEqual(result["hidden_results"][0]["error_message"],
                         "Hidden test failed. Check edge cases, conventions, and constraints.")


class WorkerRegressionTests(unittest.TestCase):
    def _request(self, body, content_length=None):
        headers = []
        if content_length is not None:
            headers.append((b"content-length", str(content_length).encode()))
        sent = False

        async def receive():
            nonlocal sent
            if sent:
                return {"type": "http.disconnect"}
            sent = True
            return {"type": "http.request", "body": body, "more_body": False}

        return Request({
            "type": "http",
            "method": "POST",
            "path": "/evaluate",
            "headers": headers,
            "query_string": b"",
        }, receive)

    def test_oversized_request_without_content_length_is_rejected(self):
        request = self._request(b"x" * (worker.MAX_REQUEST_BYTES + 1))
        called = False

        async def call_next(_request):
            nonlocal called
            called = True
            return None

        response = asyncio.run(worker.enforce_request_size(request, call_next))
        self.assertEqual(response.status_code, 413)
        self.assertFalse(called)

    def test_misleading_content_length_does_not_bypass_limit(self):
        request = self._request(
            b"x" * (worker.MAX_REQUEST_BYTES + 1),
            content_length=1,
        )
        response = asyncio.run(worker.enforce_request_size(request, lambda _: None))
        self.assertEqual(response.status_code, 413)

    def test_missing_secret_fails_closed(self):
        with patch.object(worker, "JUDGE_SECRET", ""):
            with self.assertRaises(worker.HTTPException) as raised:
                worker.verify_token("Bearer configured-secret")

        self.assertEqual(raised.exception.status_code, 503)

    def test_missing_authorization_is_unauthorized(self):
        with patch.object(worker, "JUDGE_SECRET", "configured-secret"):
            with self.assertRaises(worker.HTTPException) as raised:
                worker.verify_token(None)

        self.assertEqual(raised.exception.status_code, 401)

    def test_invalid_token_is_forbidden(self):
        with patch.object(worker, "JUDGE_SECRET", "configured-secret"):
            with self.assertRaises(worker.HTTPException) as raised:
                worker.verify_token("Bearer invalid")

        self.assertEqual(raised.exception.status_code, 403)

    def test_valid_token_is_accepted(self):
        with patch.object(worker, "JUDGE_SECRET", "configured-secret"):
            self.assertIsNone(worker.verify_token("Bearer configured-secret"))


class ExecutionRegressionTests(unittest.TestCase):
    def test_child_environment_excludes_application_secrets(self):
        with patch.dict(
            "os.environ",
            {
                "SUPABASE_SERVICE_ROLE_KEY": "must-not-leak",
                "QISKIT_JUDGE_SECRET": "must-not-leak",
            },
            clear=False,
        ):
            child_environment = _child_environment()

        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY", child_environment)
        self.assertNotIn("QISKIT_JUDGE_SECRET", child_environment)
        self.assertEqual(child_environment["PYTHONUNBUFFERED"], "1")

    def test_oversized_source_is_rejected_before_child_execution(self):
        result = run_evaluation("P1", "x" * (MAX_SOURCE_BYTES + 1), mode="run")
        self.assertFalse(result["success"])
        self.assertEqual(
            result["error_message"],
            "Source code exceeds maximum permitted size (64 KB).",
        )

    def test_output_limits_apply_to_stdout_stderr_and_combined_output(self):
        stdout = _CappedOutput([0])
        with self.assertRaises(OutputLimitExceeded):
            stdout.write("x" * (MAX_OUTPUT_BYTES + 1))

        stderr = _CappedOutput([0])
        with self.assertRaises(OutputLimitExceeded):
            stderr.write("x" * (MAX_OUTPUT_BYTES + 1))

        budget = [MAX_OUTPUT_BYTES - 1]
        combined = _CappedOutput(budget)
        with self.assertRaises(OutputLimitExceeded):
            combined.write("xx")

        total = [MAX_OUTPUT_BYTES - 1]
        with self.assertRaises(OutputLimitExceeded):
            combined = _CappedOutput(total)
            combined.write("xx")

        pipe_total = [MAX_OUTPUT_BYTES - 1]
        exceeded = threading.Event()
        output = bytearray()
        _read_output(
            io.BytesIO(b"x"),
            output,
            threading.Lock(),
            pipe_total,
            exceeded,
        )
        self.assertFalse(exceeded.is_set())
        exceeded = threading.Event()
        _read_output(
            io.BytesIO(b"x"),
            bytearray(),
            threading.Lock(),
            [MAX_OUTPUT_BYTES],
            exceeded,
        )
        self.assertTrue(exceeded.is_set())

    def test_large_submission_output_is_rejected(self):
        result = run_evaluation("P1", 'print("x" * 70000)', mode="run")
        self.assertFalse(result["success"])
        self.assertEqual(
            result["error_message"],
            "Evaluation output exceeded the maximum permitted size.",
        )

    def test_timeout_terminates_submission(self):
        with patch("runner.MAX_EXECUTION_SECONDS", 0.1):
            result = run_evaluation("P1", "while True: pass", mode="run")

        self.assertFalse(result["success"])
        self.assertEqual(result["error_message"], "Evaluation timed out.")

    def test_concurrency_limit_returns_429_without_new_event_loop(self):
        payload = worker.EvaluationRequest(problemId="P1", code="", mode="run")
        with patch.object(worker._evaluation_semaphore, "acquire", return_value=False):
            with self.assertRaises(worker.HTTPException) as raised:
                worker.evaluate(payload, None)
        self.assertEqual(raised.exception.status_code, 429)
    def test_empty_bearer_token_returns_unauthorized(self):
        with patch.object(worker, "JUDGE_SECRET", "configured-secret"):
            with self.assertRaises(worker.HTTPException) as raised:
                worker.verify_token("Bearer ")

        self.assertEqual(raised.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
