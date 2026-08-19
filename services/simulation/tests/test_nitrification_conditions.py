from __future__ import annotations

from veinguard_sim.chemistry.calibration import load_nitrification_thresholds
from veinguard_sim.chemistry.nitrification import (
    DRIVER_ELEVATED_TEMPERATURE,
    DRIVER_FREE_AMMONIA,
    DRIVER_HIGH_WATER_AGE,
    DRIVER_LOW_RESIDUAL,
    LEVEL_ELEVATED,
    LEVEL_HIGH,
    LEVEL_LOW,
    evaluate_nitrification_conditions,
    worst_nitrification,
)


def _base(**overrides: float) -> dict[str, float]:
    values = {
        "water_age_hours": 10.0,
        "temperature_c": 12.0,
        "residual_mg_l": 2.0,
        "free_ammonia_mg_n_l": 0.02,
    }
    values.update(overrides)
    return values


def test_no_drivers_is_low() -> None:
    thresholds = load_nitrification_thresholds()
    result = evaluate_nitrification_conditions(**_base(), thresholds=thresholds)
    assert result.level == LEVEL_LOW
    assert result.drivers == ()
    assert result.label == "Nitrification-favorable conditions not indicated"
    assert "probability" not in result.__dict__


def test_high_water_age_driver() -> None:
    thresholds = load_nitrification_thresholds()
    result = evaluate_nitrification_conditions(
        **_base(water_age_hours=48.0), thresholds=thresholds
    )
    assert result.drivers == (DRIVER_HIGH_WATER_AGE,)
    assert result.level == LEVEL_ELEVATED
    assert result.label == "Conditions favorable for nitrification"


def test_elevated_temperature_driver() -> None:
    thresholds = load_nitrification_thresholds()
    result = evaluate_nitrification_conditions(
        **_base(temperature_c=15.0), thresholds=thresholds
    )
    assert DRIVER_ELEVATED_TEMPERATURE in result.drivers
    assert len(result.drivers) == 1


def test_low_residual_driver() -> None:
    thresholds = load_nitrification_thresholds()
    result = evaluate_nitrification_conditions(
        **_base(residual_mg_l=1.49), thresholds=thresholds
    )
    assert result.drivers == (DRIVER_LOW_RESIDUAL,)


def test_free_ammonia_driver() -> None:
    thresholds = load_nitrification_thresholds()
    result = evaluate_nitrification_conditions(
        **_base(free_ammonia_mg_n_l=0.05), thresholds=thresholds
    )
    assert result.drivers == (DRIVER_FREE_AMMONIA,)


def test_combination_is_high_without_probability() -> None:
    thresholds = load_nitrification_thresholds()
    result = evaluate_nitrification_conditions(
        water_age_hours=72.0,
        temperature_c=26.0,
        residual_mg_l=0.9,
        free_ammonia_mg_n_l=0.12,
        thresholds=thresholds,
    )
    assert result.level == LEVEL_HIGH
    assert set(result.drivers) == {
        DRIVER_HIGH_WATER_AGE,
        DRIVER_ELEVATED_TEMPERATURE,
        DRIVER_LOW_RESIDUAL,
        DRIVER_FREE_AMMONIA,
    }
    assert result.label == "Conditions favorable for nitrification"
    dumped = {
        "level": result.level,
        "label": result.label,
        "drivers": list(result.drivers),
        "modelVersion": result.model_version,
        "thresholdProfileId": result.threshold_profile_id,
    }
    assert "probability" not in dumped
    assert "riskPercent" not in dumped


def test_sediment_driver_is_not_emitted() -> None:
    thresholds = load_nitrification_thresholds()
    result = evaluate_nitrification_conditions(**_base(), thresholds=thresholds)
    assert "DEPOSIT_OR_SEDIMENT_FACTOR" not in result.drivers


def test_network_worst_merges_drivers() -> None:
    thresholds = load_nitrification_thresholds()
    a = evaluate_nitrification_conditions(
        **_base(water_age_hours=50.0), thresholds=thresholds
    )
    b = evaluate_nitrification_conditions(
        **_base(free_ammonia_mg_n_l=0.1), thresholds=thresholds
    )
    worst = worst_nitrification({"A": a, "B": b})
    assert worst.level == LEVEL_ELEVATED
    assert set(worst.drivers) == {DRIVER_HIGH_WATER_AGE, DRIVER_FREE_AMMONIA}
