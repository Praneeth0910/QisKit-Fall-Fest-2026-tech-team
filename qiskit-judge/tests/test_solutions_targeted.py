import importlib.util
from pathlib import Path

import numpy as np
from qiskit import QuantumCircuit
from qiskit.circuit import Parameter
from qiskit.quantum_info import Pauli, Statevector


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("trusted_solutions", ROOT / "solutions.py")
solutions = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(solutions)


def test_p5_identity_empty_counts_and_y_basis():
    assert solutions.expectation_from_counts({}, "I") == 1.0
    assert solutions.expectation_from_counts({"0": 7, "1": 3}, "Z") == 0.4

    circuit = QuantumCircuit(1)
    circuit.h(0)
    circuit.s(0)
    measured = solutions.pauli_measurement_circuit(circuit, "Y")
    state = Statevector(measured.remove_final_measurements(inplace=False))
    assert np.isclose(state.probabilities_dict().get("0", 0), 1.0)


def test_p6_scaled_affine_and_repeated_parameters():
    theta = Parameter("theta")
    circuit = QuantumCircuit(1)
    circuit.rx(2 * theta + 0.3, 0)
    circuit.rx(theta, 0)
    calls = []

    def evaluate(bound):
        calls.append(bound)
        return float(np.real(Statevector(bound).expectation_value(Pauli("Z"))))

    result = solutions.param_shift_gradient(circuit, [0.4], evaluate)
    expected = -3 * np.sin(3 * 0.4 + 0.3)
    assert np.isclose(result[0], expected, atol=1e-8)
    assert len(calls) == 4


def test_all_current_judge_suites_pass_for_trusted_solution():
    for problem_id in range(1, 10):
        module = importlib.import_module(f"problems.p{problem_id}")
        judge = getattr(module, f"P{problem_id}Judge")()
        public = judge.run_public_tests(solutions)
        hidden = judge.run_hidden_tests(solutions)
        assert all(result.passed for result in public + hidden), (
            problem_id,
            [
                (result.test_name, result.error_message)
                for result in public + hidden
                if not result.passed
            ],
        )
