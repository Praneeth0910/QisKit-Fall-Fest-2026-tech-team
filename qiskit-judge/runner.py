"""
Core Judge Test Runner.
Executes participant Python source against public and hidden problem test suites.
Can be invoked programmatically or via CLI with JSON stdin.
"""

import sys
import os
import io
import time
import json
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

def run_evaluation(problem_id: str, source_code: str, mode: str = "run") -> Dict[str, Any]:
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
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
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
        except Exception as e:
            # Mask internal error details for hidden suite
            hidden_results = []

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
