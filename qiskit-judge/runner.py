"""
Core Judge Test Runner.
Executes participant Python source against public and hidden problem test suites.
Can be invoked programmatically or via CLI with JSON stdin.

The child process is a lifecycle and resource-management boundary, not a
security sandbox. Deployment must provide per-submission container or VM
isolation, including filesystem and network restrictions.
"""

import sys
import os
import io
import time
import json
import subprocess
import threading
import types
from contextlib import redirect_stdout, redirect_stderr
from typing import Dict, Any

# Ensure current dir is in Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Ensure clean UTF-8 encoding across Windows pipes
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

from sandbox import validate_source_security

MAX_EXECUTION_SECONDS = float(os.getenv("QISKIT_JUDGE_TIMEOUT_SECONDS", "20"))
MAX_OUTPUT_BYTES = 64 * 1024
MAX_SOURCE_BYTES = 64 * 1024


def _child_environment() -> Dict[str, str]:
    """Build a minimal environment without inheriting application secrets."""
    environment = {
        "PATH": os.environ.get("PATH", ""),
        "PYTHONPATH": os.path.dirname(os.path.abspath(__file__)),
        "PYTHONUNBUFFERED": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
        "OMP_NUM_THREADS": "1",
        "OPENBLAS_NUM_THREADS": "1",
        "MKL_NUM_THREADS": "1",
        "NUMEXPR_NUM_THREADS": "1",
    }
    if os.name == "nt":
        for name in ("SYSTEMROOT", "TEMP", "TMP"):
            value = os.environ.get(name)
            if value:
                environment[name] = value
    return environment


class OutputLimitExceeded(RuntimeError):
    pass


class _CappedOutput(io.StringIO):
    def __init__(self, budget):
        super().__init__()
        self.budget = budget

    def write(self, value):
        value_bytes = len(value.encode("utf-8"))
        current_bytes = len(self.getvalue().encode("utf-8"))
        if (
            value_bytes > MAX_OUTPUT_BYTES - current_bytes
            or self.budget[0] + value_bytes > MAX_OUTPUT_BYTES
        ):
            raise OutputLimitExceeded
        self.budget[0] += value_bytes
        super().write(value)
        return len(value)


def _run_evaluation_in_process(problem_id: str, source_code: str, mode: str = "run") -> Dict[str, Any]:
    """
    Evaluates source_code on problem_id in mode ('run' or 'submit').
    Returns structured JSON-serializable evaluation summary.
    """
    total_start = time.perf_counter()

    # 1. AST Security Validation
    is_safe, sec_err = validate_source_security(source_code)
    if not is_safe:
        return {
            "success": False,
            "mode": mode,
            "score": 0,
            "max_score": 0,
            "passed_tests": 0,
            "total_tests": 0,
            "execution_time_ms": int((time.perf_counter() - total_start) * 1000),
            "stdout": "",
            "stderr": sec_err,
            "error_message": sec_err,
            "public_results": [],
            "hidden_results": [],
        }

    # 2. Problem Judge Lookup
    try:
        from problems import get_judge
        judge = get_judge(problem_id)
    except ImportError as e:
        return {
            "success": False,
            "mode": mode,
            "score": 0,
            "max_score": 0,
            "passed_tests": 0,
            "total_tests": 0,
            "execution_time_ms": int((time.perf_counter() - total_start) * 1000),
            "stdout": "",
            "stderr": f"Judge runtime dependency error: {str(e)}",
            "error_message": f"Judge dependency missing: {str(e)}. Set QISKIT_JUDGE_URL or run Docker container.",
            "public_results": [],
            "hidden_results": [],
        }
    except ValueError as e:
        return {
            "success": False,
            "mode": mode,
            "score": 0,
            "max_score": 0,
            "passed_tests": 0,
            "total_tests": 0,
            "execution_time_ms": int((time.perf_counter() - total_start) * 1000),
            "stdout": "",
            "stderr": str(e),
            "error_message": str(e),
            "public_results": [],
            "hidden_results": [],
        }

    # 3. Compile and load participant module into isolated namespace
    output_budget = [0]
    stdout_buf = _CappedOutput(output_budget)
    stderr_buf = _CappedOutput(output_budget)
    user_module = types.ModuleType(f"submission_{problem_id.lower()}")

    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            # Restrict builtins in user code execution
            safe_globals = {
                "__name__": "__main__",
                "__builtins__": __builtins__,
            }
            code_obj = compile(source_code, f"<{problem_id}_solution>", "exec")
            exec(code_obj, safe_globals)

            for k, v in safe_globals.items():
                if not k.startswith("__"):
                    setattr(user_module, k, v)

    except OutputLimitExceeded:
        return {
            "success": False, "mode": mode, "score": 0,
            "max_score": judge.max_score, "passed_tests": 0, "total_tests": 0,
            "execution_time_ms": int((time.perf_counter() - total_start) * 1000),
            "stdout": stdout_buf.getvalue()[:4000],
            "stderr": "Evaluation output exceeded the maximum permitted size.",
            "error_message": "Evaluation output exceeded the maximum permitted size.",
            "public_results": [], "hidden_results": [],
        }
    except Exception as e:
        exec_ms = int((time.perf_counter() - total_start) * 1000)
        return {
            "success": False,
            "mode": mode,
            "score": 0,
            "max_score": judge.max_score,
            "passed_tests": 0,
            "total_tests": 0,
            "execution_time_ms": exec_ms,
            "stdout": stdout_buf.getvalue()[:4000],
            "stderr": f"Error loading submission: {str(e)}",
            "error_message": f"Compilation error: {str(e)}",
            "public_results": [],
            "hidden_results": [],
        }

    # 4. Run public tests
    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            pub_results = judge.run_public_tests(user_module)
    except OutputLimitExceeded:
        return {
            "success": False, "mode": mode, "score": 0,
            "max_score": judge.max_score, "passed_tests": 0, "total_tests": 1,
            "execution_time_ms": int((time.perf_counter() - total_start) * 1000),
            "stdout": stdout_buf.getvalue()[:4000],
            "stderr": "Evaluation output exceeded the maximum permitted size.",
            "error_message": "Evaluation output exceeded the maximum permitted size.",
            "public_results": [], "hidden_results": [],
        }
    except Exception as e:
        exec_ms = int((time.perf_counter() - total_start) * 1000)
        return {
            "success": False,
            "mode": mode,
            "score": 0,
            "max_score": judge.max_score,
            "passed_tests": 0,
            "total_tests": 1,
            "execution_time_ms": exec_ms,
            "stdout": stdout_buf.getvalue()[:4000],
            "stderr": f"Error running public tests: {str(e)}",
            "error_message": str(e),
            "public_results": [],
            "hidden_results": [],
        }

    # 5. If submit mode, run hidden tests
    hidden_results = []
    if mode == "submit":
        try:
            with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
                hidden_results = judge.run_hidden_tests(user_module)
        except Exception:
            # Do not treat a hidden-suite crash as a successful submission.
            return {
                "success": False,
                "mode": mode,
                "score": 0,
                "max_score": judge.max_score,
                "passed_tests": sum(1 for r in pub_results if r.passed),
                "total_tests": len(pub_results) + 1,
                "execution_time_ms": int((time.perf_counter() - total_start) * 1000),
                "stdout": stdout_buf.getvalue()[:4000],
                "stderr": "Hidden test suite execution failed.",
                "error_message": "Hidden test suite execution failed.",
                "public_results": [r.to_dict(sanitize_hidden=False) for r in pub_results],
                "hidden_results": [{
                    "test_type": "hidden",
                    "test_number": 1,
                    "test_name": "Hidden Test #1",
                    "passed": False,
                    "execution_time_ms": 0,
                    "error_message": "Hidden test failed. Check edge cases, conventions, and constraints.",
                }],
            }

    # 6. Aggregate results
    all_results = pub_results + hidden_results
    passed_count = sum(1 for r in all_results if r.passed)
    total_count = len(all_results)
    score = judge.calculate_score(pub_results, hidden_results) if mode == "submit" else 0

    all_passed = (total_count > 0 and passed_count == total_count)
    success = all_passed and (mode == "run" or score == judge.max_score)

    first_err = None
    for r in all_results:
        if not r.passed and r.error_message:
            first_err = r.error_message
            break

    exec_ms = int((time.perf_counter() - total_start) * 1000)

    return {
        "success": success,
        "mode": mode,
        "score": score,
        "max_score": judge.max_score,
        "passed_tests": passed_count,
        "total_tests": total_count,
        "execution_time_ms": exec_ms,
        "stdout": stdout_buf.getvalue()[:4000],
        "stderr": stderr_buf.getvalue()[:4000],
        "error_message": first_err,
        "public_results": [r.to_dict(sanitize_hidden=False) for r in pub_results],
        "hidden_results": [r.to_dict(sanitize_hidden=True) for r in hidden_results],
    }


def _child_limits():
    if os.name != "nt":
        from sandbox import set_sandbox_limits
        set_sandbox_limits()


def _failure_result(message: str, mode: str = "run") -> Dict[str, Any]:
    return {
        "success": False, "mode": mode, "score": 0, "max_score": 0,
        "passed_tests": 0, "total_tests": 0, "execution_time_ms": 0,
        "stdout": "", "stderr": message, "error_message": message,
        "public_results": [], "hidden_results": [],
    }


def _terminate_process(process: subprocess.Popen) -> None:
    # CREATE_NEW_PROCESS_GROUP does not guarantee descendant cleanup on Windows.
    # The deployment runtime must use a Job Object or isolated container for
    # guaranteed termination of process trees.
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=1)
        except subprocess.TimeoutExpired:
            process.kill()


def _read_output(stream, output, output_lock, output_total, output_exceeded):
    while True:
        chunk = stream.read(4096)
        if not chunk:
            return
        with output_lock:
            remaining = MAX_OUTPUT_BYTES - output_total[0]
            if len(chunk) > remaining:
                output.extend(chunk[:max(0, remaining)])
                output_total[0] += max(0, remaining)
                output_exceeded.set()
                return
            output.extend(chunk)
            output_total[0] += len(chunk)


def run_evaluation(problem_id: str, source_code: str, mode: str = "run") -> Dict[str, Any]:
    """Run a submission in a disposable child process with a hard timeout."""
    if os.getenv("QISKIT_JUDGE_CHILD") == "1":
        return _run_evaluation_in_process(problem_id, source_code, mode)
    if len(source_code.encode("utf-8")) > MAX_SOURCE_BYTES:
        return _failure_result("Source code exceeds maximum permitted size (64 KB).", mode)

    payload = json.dumps({
        "problem_id": problem_id,
        "code": source_code,
        "mode": mode,
    })
    env = _child_environment()
    env["QISKIT_JUDGE_CHILD"] = "1"
    env.pop("QISKIT_JUDGE_SECRET", None)
    creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)

    process = None
    stdout = bytearray()
    stderr = bytearray()
    output_lock = threading.Lock()
    output_total = [0]
    output_exceeded = threading.Event()
    termination_message = None
    try:
        process = subprocess.Popen(
            [sys.executable, os.path.abspath(__file__)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            cwd=os.path.dirname(os.path.abspath(__file__)),
            creationflags=creationflags,
            preexec_fn=_child_limits if os.name != "nt" else None,
        )
        process.stdin.write(payload.encode("utf-8"))
        process.stdin.close()
        stdout_thread = threading.Thread(
            target=_read_output,
            args=(process.stdout, stdout, output_lock, output_total, output_exceeded),
            daemon=True,
        )
        stderr_thread = threading.Thread(
            target=_read_output,
            args=(process.stderr, stderr, output_lock, output_total, output_exceeded),
            daemon=True,
        )
        stdout_thread.start()
        stderr_thread.start()
        deadline = time.monotonic() + MAX_EXECUTION_SECONDS
        while process.poll() is None:
            if output_exceeded.is_set():
                _terminate_process(process)
                termination_message = "Evaluation output exceeded the maximum permitted size."
                break
            if time.monotonic() >= deadline:
                _terminate_process(process)
                termination_message = "Evaluation timed out."
                break
            time.sleep(0.01)
        stdout_thread.join(timeout=1)
        stderr_thread.join(timeout=1)
        process.stdout.close()
        process.stderr.close()
    except OSError:
        if process is not None:
            _terminate_process(process)
        return _failure_result("Evaluation process could not be started.", mode)

    if termination_message:
        return _failure_result(termination_message, mode)
    if output_exceeded.is_set():
        return _failure_result("Evaluation output exceeded the maximum permitted size.", mode)
    if process.returncode != 0:
        return _failure_result("Evaluation process failed.", mode)

    try:
        return json.loads(stdout.decode("utf-8")[-MAX_OUTPUT_BYTES:])
    except json.JSONDecodeError:
        return _failure_result("Evaluation returned an invalid result.", mode)


if __name__ == "__main__":
    # Support reading JSON from stdin or argument
    input_str = sys.stdin.read() if not sys.stdin.isatty() else (sys.argv[1] if len(sys.argv) > 1 else "{}")
    try:
        data = json.loads(input_str)
        p_id = data.get("problem_id", data.get("problemId", "P1"))
        code = data.get("code", "")
        mode = data.get("mode", "run")
        result = run_evaluation(p_id, code, mode)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({
            "success": False,
            "error_message": f"Runner invocation error: {str(exc)}",
            "execution_time_ms": 0,
        }))
