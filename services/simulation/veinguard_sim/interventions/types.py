from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal


class InterventionError(ValueError):
    """Invalid intervention; must not reach EPANET."""


def parse_iso(value: str, label: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise InterventionError(f"{label} must be ISO-8601.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


def seconds_from_origin(value: str, origin: datetime, label: str) -> int:
    instant = parse_iso(value, label)
    seconds = int((instant - origin).total_seconds())
    if seconds < 0:
        raise InterventionError(f"{label} is before the scenario origin.")
    return seconds


@dataclass(frozen=True)
class PumpScheduleInterval:
    start_s: int
    end_s: int
    enabled: bool


@dataclass(frozen=True)
class ChangePumpSchedule:
    type: Literal["CHANGE_PUMP_SCHEDULE"]
    pump_id: str
    intervals: tuple[PumpScheduleInterval, ...]


@dataclass(frozen=True)
class ChangePumpSetting:
    type: Literal["CHANGE_PUMP_SETTING"]
    pump_id: str
    start_s: int
    end_s: int
    setting: float


@dataclass(frozen=True)
class TankSetInitialLevel:
    type: Literal["CHANGE_TANK_CONTROL"]
    op: Literal["SET_INITIAL_LEVEL"]
    tank_id: str
    level_m: float


@dataclass(frozen=True)
class TankLevelTriggersPump:
    type: Literal["CHANGE_TANK_CONTROL"]
    op: Literal["LEVEL_TRIGGERS_PUMP"]
    tank_id: str
    pump_id: str
    below_level_m: float
    above_level_m: float


@dataclass(frozen=True)
class ChangeValveSetting:
    type: Literal["CHANGE_VALVE_SETTING"]
    valve_id: str
    start_s: int
    end_s: int
    setting: float


@dataclass(frozen=True)
class FlushEvent:
    type: Literal["FLUSH_EVENT"]
    junction_id: str
    start_s: int
    duration_seconds: int
    discharge_lps: float


@dataclass(frozen=True)
class ChangeBoosterProfile:
    type: Literal["CHANGE_BOOSTER_PROFILE"]
    source_node_id: str
    start_s: int
    end_s: int
    mode: Literal["CONCENTRATION", "MASS"]
    value: float
    units: str


Intervention = (
    ChangePumpSchedule
    | ChangePumpSetting
    | TankSetInitialLevel
    | TankLevelTriggersPump
    | ChangeValveSetting
    | FlushEvent
    | ChangeBoosterProfile
)


def parse_interventions(raw: list[dict[str, Any]], origin: datetime) -> tuple[Intervention, ...]:
    parsed: list[Intervention] = []
    for index, item in enumerate(raw):
        if not isinstance(item, dict) or "type" not in item:
            raise InterventionError(f"Intervention {index} is missing type.")
        kind = str(item["type"])
        parsed.append(_parse_one(kind, item, origin))
    return tuple(parsed)


def _parse_one(kind: str, item: dict[str, Any], origin: datetime) -> Intervention:
    if kind == "CHANGE_PUMP_SCHEDULE":
        intervals_raw = item.get("intervals")
        if not isinstance(intervals_raw, list) or not intervals_raw:
            raise InterventionError("CHANGE_PUMP_SCHEDULE requires intervals.")
        intervals = []
        for row in intervals_raw:
            start_s = seconds_from_origin(str(row["start"]), origin, "interval.start")
            end_s = seconds_from_origin(str(row["end"]), origin, "interval.end")
            if end_s <= start_s:
                raise InterventionError("Pump schedule interval end must be after start.")
            intervals.append(
                PumpScheduleInterval(start_s, end_s, bool(row.get("enabled", True)))
            )
        pump_id = str(item.get("pumpId") or "")
        if not pump_id:
            raise InterventionError("CHANGE_PUMP_SCHEDULE requires pumpId.")
        return ChangePumpSchedule("CHANGE_PUMP_SCHEDULE", pump_id, tuple(intervals))

    if kind == "CHANGE_PUMP_SETTING":
        setting = float(item["setting"])
        if setting < 0:
            raise InterventionError("Pump setting cannot be negative.")
        return ChangePumpSetting(
            "CHANGE_PUMP_SETTING",
            _require(item, "pumpId"),
            seconds_from_origin(str(item["start"]), origin, "start"),
            seconds_from_origin(str(item["end"]), origin, "end"),
            setting,
        )

    if kind == "CHANGE_TANK_CONTROL":
        op = str(item.get("op") or "")
        if op == "SET_INITIAL_LEVEL":
            return TankSetInitialLevel(
                "CHANGE_TANK_CONTROL",
                "SET_INITIAL_LEVEL",
                _require(item, "tankId"),
                float(item["levelM"]),
            )
        if op == "LEVEL_TRIGGERS_PUMP":
            below = float(item["belowLevelM"])
            above = float(item["aboveLevelM"])
            if above <= below:
                raise InterventionError("aboveLevelM must be greater than belowLevelM.")
            return TankLevelTriggersPump(
                "CHANGE_TANK_CONTROL",
                "LEVEL_TRIGGERS_PUMP",
                _require(item, "tankId"),
                _require(item, "pumpId"),
                below,
                above,
            )
        raise InterventionError(
            "CHANGE_TANK_CONTROL op must be SET_INITIAL_LEVEL or LEVEL_TRIGGERS_PUMP."
        )

    if kind == "CHANGE_VALVE_SETTING":
        return ChangeValveSetting(
            "CHANGE_VALVE_SETTING",
            _require(item, "valveId"),
            seconds_from_origin(str(item["start"]), origin, "start"),
            seconds_from_origin(str(item["end"]), origin, "end"),
            float(item["setting"]),
        )

    if kind == "FLUSH_EVENT":
        duration = int(item["durationSeconds"])
        discharge = float(item["dischargeLps"])
        if duration <= 0 or discharge <= 0:
            raise InterventionError("Flush duration and discharge must be positive.")
        return FlushEvent(
            "FLUSH_EVENT",
            _require(item, "junctionId"),
            seconds_from_origin(str(item["start"]), origin, "start"),
            duration,
            discharge,
        )

    if kind == "CHANGE_BOOSTER_PROFILE":
        mode = str(item.get("mode") or "")
        if mode not in {"CONCENTRATION", "MASS"}:
            raise InterventionError("Booster mode must be CONCENTRATION or MASS.")
        if mode == "MASS":
            raise InterventionError(
                "MASS booster is not implemented in V1 without a verified "
                "flow-to-concentration conversion."
            )
        return ChangeBoosterProfile(
            "CHANGE_BOOSTER_PROFILE",
            _require(item, "sourceNodeId"),
            seconds_from_origin(str(item["start"]), origin, "start"),
            seconds_from_origin(str(item["end"]), origin, "end"),
            "CONCENTRATION",
            float(item["value"]),
            str(item.get("units") or "mg/L"),
        )

    raise InterventionError(f"Unsupported intervention type '{kind}'.")


def _require(item: dict[str, Any], key: str) -> str:
    value = str(item.get(key) or "")
    if not value:
        raise InterventionError(f"Missing {key}.")
    return value
