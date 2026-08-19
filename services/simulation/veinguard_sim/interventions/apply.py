from __future__ import annotations

from typing import Any

from veinguard_sim.interventions.types import (
    ChangeBoosterProfile,
    ChangePumpSchedule,
    ChangePumpSetting,
    ChangeValveSetting,
    FlushEvent,
    Intervention,
    InterventionError,
    TankLevelTriggersPump,
    TankSetInitialLevel,
)


def apply_interventions(wn: Any, interventions: tuple[Intervention, ...]) -> dict[str, Any]:
    """Mutate an isolated WNTR model. Never call this on the persisted base."""
    metrics: dict[str, Any] = {
        "flushWaterLiters": 0.0,
        "chemicalIncrementMg": 0.0,
        "switchingComplexity": 0.0,
        "boosterSources": [],
    }
    for index, item in enumerate(interventions):
        if isinstance(item, ChangePumpSchedule):
            _pump_schedule(wn, item, index)
            metrics["switchingComplexity"] += len(item.intervals)
        elif isinstance(item, ChangePumpSetting):
            _pump_setting(wn, item, index)
            metrics["switchingComplexity"] += 1
        elif isinstance(item, TankSetInitialLevel):
            _tank_initial(wn, item)
        elif isinstance(item, TankLevelTriggersPump):
            _tank_triggers_pump(wn, item, index)
            metrics["switchingComplexity"] += 2
        elif isinstance(item, ChangeValveSetting):
            _valve_setting(wn, item, index)
            metrics["switchingComplexity"] += 1
        elif isinstance(item, FlushEvent):
            _flush(wn, item, index)
            metrics["flushWaterLiters"] += item.discharge_lps * item.duration_seconds
            metrics["switchingComplexity"] += 1
        elif isinstance(item, ChangeBoosterProfile):
            _booster(wn, item)
            metrics["boosterSources"].append(
                {"nodeId": item.source_node_id, "value": item.value, "mode": item.mode}
            )
            metrics["switchingComplexity"] += 1
        else:
            raise InterventionError("Unhandled intervention.")
    return metrics


def _link_status(wn: Any) -> Any:
    from wntr.network.base import LinkStatus

    return LinkStatus


def _control_bits() -> tuple[Any, Any, Any]:
    from wntr.network.controls import Control, ControlAction, ControlPriority

    return Control, ControlAction, ControlPriority


def _require_pump(wn: Any, pump_id: str) -> Any:
    if pump_id not in wn.pump_name_list:
        raise InterventionError(f"Pump '{pump_id}' does not exist.")
    return wn.get_link(pump_id)


def _require_tank(wn: Any, tank_id: str) -> Any:
    if tank_id not in wn.tank_name_list:
        raise InterventionError(f"Tank '{tank_id}' does not exist.")
    return wn.get_node(tank_id)


def _require_valve(wn: Any, valve_id: str) -> Any:
    if valve_id not in wn.valve_name_list:
        raise InterventionError(f"Valve '{valve_id}' does not exist.")
    return wn.get_link(valve_id)


def _require_junction(wn: Any, junction_id: str) -> Any:
    if junction_id not in wn.junction_name_list:
        raise InterventionError(f"Junction '{junction_id}' does not exist.")
    return wn.get_node(junction_id)


def _add_time_status(wn: Any, link: Any, at_s: int, opened: bool, name: str) -> None:
    control_cls, action_cls, priority = _control_bits()
    status = _link_status(wn)
    action = action_cls(link, "status", status.Open if opened else status.Closed)
    control = control_cls._time_control(  # noqa: SLF001 — documented WNTR factory
        wn,
        int(at_s),
        "SIM_TIME",
        False,
        action,
        name=name,
    )
    control.update_priority(priority.very_high)
    wn.add_control(name, control)


def _remove_status_controls_for(wn: Any, link_name: str) -> None:
    for name in list(wn.control_name_list):
        control = wn.get_control(name)
        try:
            actions = control.actions()
        except Exception:  # noqa: BLE001
            continue
        for action in actions:
            target = getattr(action, "_target_obj", None)
            attr = getattr(action, "_attribute", None)
            target_name = getattr(target, "name", None)
            if target_name == link_name and attr == "status":
                wn.remove_control(name)
                break


def _pump_schedule(wn: Any, item: ChangePumpSchedule, index: int) -> None:
    pump = _require_pump(wn, item.pump_id)
    _remove_status_controls_for(wn, item.pump_id)
    first = item.intervals[0]
    pump.initial_status = _link_status(wn).Open if first.enabled else _link_status(wn).Closed
    for step, interval in enumerate(item.intervals):
        _add_time_status(
            wn,
            pump,
            interval.start_s,
            interval.enabled,
            f"vg_pump_sched_{index}_{step}_start",
        )
        _add_time_status(
            wn,
            pump,
            interval.end_s,
            not interval.enabled,
            f"vg_pump_sched_{index}_{step}_end",
        )


def _pump_setting(wn: Any, item: ChangePumpSetting, index: int) -> None:
    pump = _require_pump(wn, item.pump_id)
    if item.start_s == 0:
        pump.base_speed = item.setting
    control_cls, action_cls, priority = _control_bits()
    start_action = action_cls(pump, "base_speed", item.setting)
    start = control_cls._time_control(  # noqa: SLF001
        wn, item.start_s, "SIM_TIME", False, start_action, name=f"vg_pump_set_{index}_on"
    )
    start.update_priority(priority.very_high)
    wn.add_control(f"vg_pump_set_{index}_on", start)


def _tank_initial(wn: Any, item: TankSetInitialLevel) -> None:
    tank = _require_tank(wn, item.tank_id)
    if item.level_m < float(tank.min_level) or item.level_m > float(tank.max_level):
        raise InterventionError("Initial tank level is outside min/max bounds.")
    tank.init_level = item.level_m


def _tank_triggers_pump(wn: Any, item: TankLevelTriggersPump, index: int) -> None:
    from wntr.network.controls import TankLevelCondition

    tank = _require_tank(wn, item.tank_id)
    pump = _require_pump(wn, item.pump_id)
    control_cls, action_cls, priority = _control_bits()
    status = _link_status(wn)
    open_ctrl = control_cls(
        TankLevelCondition(tank, "level", "lt", item.below_level_m),
        action_cls(pump, "status", status.Open),
        priority=priority.very_high,
        name=f"vg_tank_open_{index}",
    )
    close_ctrl = control_cls(
        TankLevelCondition(tank, "level", "gt", item.above_level_m),
        action_cls(pump, "status", status.Closed),
        priority=priority.very_high,
        name=f"vg_tank_close_{index}",
    )
    wn.add_control(f"vg_tank_open_{index}", open_ctrl)
    wn.add_control(f"vg_tank_close_{index}", close_ctrl)


def _valve_setting(wn: Any, item: ChangeValveSetting, index: int) -> None:
    valve = _require_valve(wn, item.valve_id)
    if item.start_s == 0:
        valve.initial_setting = item.setting
    control_cls, action_cls, priority = _control_bits()
    action = action_cls(valve, "setting", item.setting)
    control = control_cls._time_control(  # noqa: SLF001
        wn, item.start_s, "SIM_TIME", False, action, name=f"vg_valve_{index}"
    )
    control.update_priority(priority.very_high)
    wn.add_control(f"vg_valve_{index}", control)


def _flush(wn: Any, item: FlushEvent, index: int) -> None:
    _require_junction(wn, item.junction_id)
    duration = float(wn.options.time.duration)
    step = float(wn.options.time.pattern_timestep or wn.options.time.hydraulic_timestep or 3600)
    steps = max(1, int(duration / step) + 1)
    multipliers = []
    for i in range(steps):
        t0 = i * step
        active = item.start_s <= t0 < item.start_s + item.duration_seconds
        multipliers.append(1.0 if active else 0.0)
    pattern_name = f"vg_flush_{index}"
    wn.add_pattern(pattern_name, multipliers)
    discharge_m3s = item.discharge_lps / 1000.0
    wn.get_node(item.junction_id).add_demand(discharge_m3s, pattern_name, "FLUSH")


def _booster(wn: Any, item: ChangeBoosterProfile) -> None:
    names = set(wn.junction_name_list) | set(wn.tank_name_list) | set(wn.reservoir_name_list)
    if item.source_node_id not in names:
        raise InterventionError(f"Booster node '{item.source_node_id}' does not exist.")
    wn.add_source(
        f"vg_booster_{item.source_node_id}",
        item.source_node_id,
        "SETPOINT",
        item.value,
        None,
    )
