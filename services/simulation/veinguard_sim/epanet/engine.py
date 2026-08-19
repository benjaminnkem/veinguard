from __future__ import annotations

import os
import tempfile
from collections.abc import Callable
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeout
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from veinguard_sim import __version__
from veinguard_sim.epanet.errors import (
    NetworkInvalidError,
    SimulationConvergenceError,
    SimulationTimeoutError,
)


@dataclass(frozen=True)
class EngineVersions:
    wntr_version: str
    epanet_version: str
    simulation_service_version: str


@dataclass(frozen=True)
class LoadedInp:
    inp_bytes: bytes
    sha256: str
    network_id: str | None
    name: str | None
    source_type: str


@dataclass(frozen=True)
class HydraulicSummary:
    min_pressure_m: float | None
    max_pressure_m: float | None
    min_flow_m3s: float | None
    max_flow_m3s: float | None
    max_water_age_hours: float | None
    min_water_age_hours: float | None


@dataclass(frozen=True)
class HydraulicRun:
    converged: bool
    duration_seconds: float
    hydraulic_timestep_seconds: float
    report_timestep_seconds: float
    sample_time_seconds: float
    summary: HydraulicSummary
    nodes: dict[str, dict[str, float | None]]
    links: dict[str, dict[str, float | None]]
    times_seconds: list[float]
    engines: EngineVersions
    units: dict[str, str]


def engine_versions() -> EngineVersions:
    import wntr

    epanet_version = "2.2"
    version_fn: Callable[[], Any] | None = getattr(wntr, "epanet_version", None)
    if callable(version_fn):
        epanet_version = str(version_fn())
    return EngineVersions(
        wntr_version=str(wntr.__version__),
        epanet_version=str(epanet_version),
        simulation_service_version=__version__,
    )


def load_network_from_bytes(inp_bytes: bytes) -> Any:
    import wntr

    if not inp_bytes.strip():
        raise NetworkInvalidError("INP content is empty.")
    with tempfile.TemporaryDirectory(prefix="veinguard-inp-") as tmp:
        path = Path(tmp) / "network.inp"
        path.write_bytes(inp_bytes)
        try:
            return wntr.network.WaterNetworkModel(str(path))
        except Exception as exc:  # noqa: BLE001 — WNTR raises mixed types
            raise NetworkInvalidError(f"EPANET INP could not be parsed: {exc}") from exc


def validate_required_assets(wn: Any) -> dict[str, int]:
    summary = {
        "junctionCount": len(list(wn.junction_name_list)),
        "reservoirCount": len(list(wn.reservoir_name_list)),
        "tankCount": len(list(wn.tank_name_list)),
        "pipeCount": len(list(wn.pipe_name_list)),
        "pumpCount": len(list(wn.pump_name_list)),
        "valveCount": len(list(wn.valve_name_list)),
    }
    if summary["junctionCount"] < 1:
        raise NetworkInvalidError("Network has no junctions.")
    if summary["pipeCount"] < 1:
        raise NetworkInvalidError("Network has no pipes.")
    if summary["reservoirCount"] + summary["tankCount"] < 1:
        raise NetworkInvalidError("Network has no reservoir or tank source.")
    return summary


def _finite(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def _series_extrema(frame: Any) -> tuple[float | None, float | None]:
    if frame is None or getattr(frame, "empty", True):
        return None, None
    numeric = frame.to_numpy(dtype="float64", copy=False).ravel()
    finite = [float(v) for v in numeric if v == v]
    if not finite:
        return None, None
    return min(finite), max(finite)


def _age_hours(value: Any) -> float | None:
    seconds = _finite(value)
    if seconds is None:
        return None
    # EPANET AGE is stored by WNTR as seconds; expose hours in the product API.
    return seconds / 3600.0


def simulate_hydraulics_and_age(
    inp_bytes: bytes,
    sample_time_seconds: float | None = None,
) -> HydraulicRun:
    import wntr

    versions = engine_versions()
    with tempfile.TemporaryDirectory(prefix="veinguard-epanet-") as tmp:
        workdir = Path(tmp)
        inp_path = workdir / "network.inp"
        inp_path.write_bytes(inp_bytes)
        previous = os.getcwd()
        os.chdir(workdir)
        try:
            wn = wntr.network.WaterNetworkModel(str(inp_path))
            validate_required_assets(wn)
            wn.options.quality.parameter = "AGE"
            sim = wntr.sim.EpanetSimulator(wn)
            try:
                results = sim.run_sim(version=2.2, file_prefix=str(workdir / "run"))
            except Exception as exc:  # noqa: BLE001
                raise SimulationConvergenceError(f"EPANET simulation failed: {exc}") from exc
        finally:
            os.chdir(previous)

        pressure = results.node["pressure"]
        head = results.node["head"]
        demand = results.node["demand"]
        quality = results.node["quality"]
        flow = results.link["flowrate"]
        velocity = results.link["velocity"] if "velocity" in results.link else None

        times = [float(t) for t in pressure.index.tolist()]
        if not times:
            raise SimulationConvergenceError("EPANET returned no hydraulic timesteps.")
        if sample_time_seconds is None:
            sample = times[0]
        else:
            sample = min(times, key=lambda t: abs(t - sample_time_seconds))

        min_p, max_p = _series_extrema(pressure)
        min_q, max_q = _series_extrema(flow)
        min_age_s, max_age_s = _series_extrema(quality)
        min_age_h = None if min_age_s is None else min_age_s / 3600.0
        max_age_h = None if max_age_s is None else max_age_s / 3600.0

        nodes: dict[str, dict[str, float | None]] = {}
        for node_id in pressure.columns:
            nodes[str(node_id)] = {
                "pressureM": _finite(pressure.loc[sample, node_id]),
                "headM": _finite(head.loc[sample, node_id]) if node_id in head.columns else None,
                "demandM3s": (
                    _finite(demand.loc[sample, node_id]) if node_id in demand.columns else None
                ),
                "waterAgeHours": (
                    _age_hours(quality.loc[sample, node_id]) if node_id in quality.columns else None
                ),
            }

        links: dict[str, dict[str, float | None]] = {}
        for link_id in flow.columns:
            links[str(link_id)] = {
                "flowM3s": _finite(flow.loc[sample, link_id]),
                "velocityMs": (
                    _finite(velocity.loc[sample, link_id])
                    if velocity is not None and link_id in velocity.columns
                    else None
                ),
            }

        return HydraulicRun(
            converged=True,
            duration_seconds=float(wn.options.time.duration),
            hydraulic_timestep_seconds=float(wn.options.time.hydraulic_timestep),
            report_timestep_seconds=float(wn.options.time.report_timestep),
            sample_time_seconds=float(sample),
            summary=HydraulicSummary(
                min_pressure_m=min_p,
                max_pressure_m=max_p,
                min_flow_m3s=min_q,
                max_flow_m3s=max_q,
                max_water_age_hours=max_age_h,
                min_water_age_hours=min_age_h,
            ),
            nodes=nodes,
            links=links,
            times_seconds=times,
            engines=versions,
            units={
                "pressure": "m",
                "head": "m",
                "demand": "m3/s",
                "flow": "m3/s",
                "velocity": "m/s",
                "waterAge": "h",
            },
        )


def _simulate_hydraulics_and_age_job(
    inp_bytes: bytes,
    sample_time_seconds: float | None,
) -> HydraulicRun:
    return simulate_hydraulics_and_age(inp_bytes, sample_time_seconds)


def run_hydraulics_and_age(
    inp_bytes: bytes,
    timeout_seconds: int,
    sample_time_seconds: float | None = None,
) -> HydraulicRun:
    in_process = timeout_seconds <= 0 or os.environ.get("VEINGUARD_SIM_IN_PROCESS") == "1"
    if in_process:
        return simulate_hydraulics_and_age(inp_bytes, sample_time_seconds)
    with ProcessPoolExecutor(max_workers=1) as pool:
        future = pool.submit(_simulate_hydraulics_and_age_job, inp_bytes, sample_time_seconds)
        try:
            return future.result(timeout=timeout_seconds)
        except FuturesTimeout as exc:
            future.cancel()
            raise SimulationTimeoutError(
                f"Simulation exceeded {timeout_seconds} seconds.",
            ) from exc


def load_network(inp_bytes: bytes) -> Any:
    wn = load_network_from_bytes(inp_bytes)
    validate_required_assets(wn)
    return wn
