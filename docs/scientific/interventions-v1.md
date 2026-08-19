# interventions-v1

Binding: typed interventions applied to an isolated WNTR copy. EPANET 2.2 runs the hydraulics.

| Type | WNTR/EPANET mechanism |
|---|---|
| `CHANGE_PUMP_SCHEDULE` | `Control` + `SimTimeCondition` on pump `status` |
| `CHANGE_PUMP_SETTING` | pump `base_speed` and timed `ControlAction` |
| `CHANGE_TANK_CONTROL` | `SET_INITIAL_LEVEL` or `LEVEL_TRIGGERS_PUMP` via `TankLevelCondition` |
| `CHANGE_VALVE_SETTING` | valve `initial_setting` + timed setting controls |
| `FLUSH_EVENT` | extra junction demand + pattern |
| `CHANGE_BOOSTER_PROFILE` | chemistry source override (`CONCENTRATION`); `MASS` rejected unless flow can convert |

FortyGuard air field is unchanged by interventions.
