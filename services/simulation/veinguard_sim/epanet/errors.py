from __future__ import annotations


class SimulationError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class NetworkInvalidError(SimulationError):
    def __init__(self, message: str) -> None:
        super().__init__("NETWORK_INVALID", message)


class SimulationConvergenceError(SimulationError):
    def __init__(self, message: str) -> None:
        super().__init__("SIMULATION_CONVERGENCE_FAILED", message)


class SimulationTimeoutError(SimulationError):
    def __init__(self, message: str) -> None:
        super().__init__("SIMULATION_TIMEOUT", message)
