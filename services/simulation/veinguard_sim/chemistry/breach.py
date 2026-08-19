from __future__ import annotations


def target_breach(residual_mg_l: float, operational_target_mg_l: float) -> bool:
    return residual_mg_l < operational_target_mg_l
