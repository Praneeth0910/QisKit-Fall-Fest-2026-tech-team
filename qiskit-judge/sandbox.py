"""
Security Sandbox & AST Validator for Untrusted Participant Code.
Blocks filesystem access, unauthorized network/system libraries,
infinite loop traps, and sets execution timeouts.
"""

import ast
import os
import subprocess
try:
    import resource
except ImportError:
    resource = None
import sys
import tempfile
from typing import Tuple, Optional, Set

# Whitelist of modules participants may import
ALLOWED_MODULES: Set[str] = {
    'qiskit',
    'qiskit.circuit',
    'qiskit.quantum_info',
    'qiskit.transpiler',
    'qiskit_aer',
    'numpy',
    'np',
    'scipy',
    'scipy.optimize',
    'scipy.linalg',
    'math',
    'cmath',
    'random',
    'itertools',
    'collections',
    'functools',
    'typing',
}

# Blacklist of dangerous built-in functions
BLOCKED_CALLS: Set[str] = {
    'eval',
    'exec',
    'compile',
    'open',
    'input',
    'breakpoint',
    '__import__',
}

# Explicitly banned module prefixes
BANNED_MODULES: Set[str] = {
    'os',
    'sys',
    'subprocess',
    'socket',
    'requests',
    'urllib',
    'shutil',
    'http',
    'ftplib',
    'telnetlib',
    'posix',
    'importlib',
    'code',
    'pickle',
    'ctypes',
    'threading',
    'multiprocessing',
    '_thread',
    'webbrowser',
    'pathlib',
}

class SecurityVisitor(ast.NodeVisitor):
    def __init__(self):
        self.errors = []

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            root_mod = alias.name.split('.')[0]
            if root_mod in BANNED_MODULES or (root_mod not in {'qiskit', 'qiskit_aer', 'numpy', 'scipy', 'math', 'cmath', 'random', 'itertools', 'collections', 'functools', 'typing'}):
                self.errors.append(f"Import of unauthorized module '{alias.name}' is strictly prohibited.")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        mod = node.module or ''
        root_mod = mod.split('.')[0]
        if root_mod in BANNED_MODULES or (root_mod not in {'qiskit', 'qiskit_aer', 'numpy', 'scipy', 'math', 'cmath', 'random', 'itertools', 'collections', 'functools', 'typing'}):
            self.errors.append(f"Import from unauthorized module '{mod}' is strictly prohibited.")
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        if isinstance(node.func, ast.Name):
            if node.func.id in BLOCKED_CALLS:
                self.errors.append(f"Use of restricted built-in '{node.func.id}()' is prohibited.")
        elif isinstance(node.func, ast.Attribute):
            if node.func.attr in {'system', 'popen', 'spawn', 'fork'}:
                self.errors.append(f"Calling restricted method '{node.func.attr}' is prohibited.")
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute):
        if node.attr in {'__subclasses__', '__bases__', '__mro__', '__globals__'}:
            self.errors.append(f"Introspection attribute '{node.attr}' access is prohibited.")
        self.generic_visit(node)


def validate_source_security(source_code: str) -> Tuple[bool, Optional[str]]:
    """
    Statically analyzes source code using Python AST.
    Returns (is_safe, error_message).
    """
    if len(source_code.encode('utf-8')) > 64 * 1024:
        return False, "Source code exceeds maximum permitted size (64 KB)."

    try:
        tree = ast.parse(source_code)
    except SyntaxError as e:
        return False, f"Syntax error at line {e.lineno}: {e.msg}"

    visitor = SecurityVisitor()
    visitor.visit(tree)

    if visitor.errors:
        return False, visitor.errors[0]

    return True, None


def set_sandbox_limits(max_memory_mb: int = 512, max_cpu_seconds: int = 15):
    """
    Enforces kernel-level resource limits for child processes.
    """
    # CPU time limit in seconds
    try:
        resource.setrlimit(resource.RLIMIT_CPU, (max_cpu_seconds, max_cpu_seconds + 2))
    except Exception:
        pass

    # Memory limit in bytes (RLIMIT_AS)
    try:
        mem_bytes = max_memory_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
    except Exception:
        pass

    # Disable core dumps
    try:
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    except Exception:
        pass
