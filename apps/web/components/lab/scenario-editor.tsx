"use client";

import { useMemo, useState } from "react";
import type { LabContext } from "@/lib/lab";

const TYPES = [
  "CHANGE_PUMP_SCHEDULE",
  "CHANGE_PUMP_SETTING",
  "CHANGE_TANK_CONTROL",
  "FLUSH_EVENT",
  "CHANGE_BOOSTER_PROFILE",
] as const;

interface ScenarioEditorProps {
  context: LabContext;
  onCreate: (input: {
    name: string;
    interventions: Record<string, unknown>[];
  }) => Promise<void>;
  pending: boolean;
}

export function ScenarioEditor({
  context,
  onCreate,
  pending,
}: ScenarioEditorProps) {
  const [name, setName] = useState("Pump 10 setting");
  const [type, setType] = useState<(typeof TYPES)[number]>("CHANGE_PUMP_SETTING");
  const [pumpId, setPumpId] = useState(context.catalog.pumps[0]?.sourceId ?? "10");
  const [tankId, setTankId] = useState(context.catalog.tanks[0]?.sourceId ?? "1");
  const [junctionId, setJunctionId] = useState(
    context.catalog.junctions[0]?.sourceId ?? "101",
  );
  const [setting, setSetting] = useState(1);
  const [enabled, setEnabled] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState(3600);
  const [dischargeLps, setDischargeLps] = useState(20);
  const [levelM, setLevelM] = useState(5);
  const [boosterValue, setBoosterValue] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const typeMeta = context.catalog.types.find((item) => item.id === type);
  const endIso = useMemo(() => {
    const start = new Date(context.horizonStart).getTime();
    return new Date(start + 6 * 3600 * 1000).toISOString();
  }, [context.horizonStart]);

  async function submit() {
    setError(null);
    const interventions = [buildIntervention()];
    try {
      await onCreate({ name, interventions });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create scenario.");
    }
  }

  function buildIntervention(): Record<string, unknown> {
    const start = context.horizonStart;
    const end = endIso;
    if (type === "CHANGE_PUMP_SCHEDULE") {
      return {
        type,
        pumpId,
        intervals: [{ start, end, enabled }],
      };
    }
    if (type === "CHANGE_PUMP_SETTING") {
      return { type, pumpId, start, end, setting };
    }
    if (type === "CHANGE_TANK_CONTROL") {
      return { type, op: "SET_INITIAL_LEVEL", tankId, levelM };
    }
    if (type === "FLUSH_EVENT") {
      return {
        type,
        junctionId,
        start,
        durationSeconds,
        dischargeLps,
      };
    }
    return {
      type: "CHANGE_BOOSTER_PROFILE",
      sourceNodeId: junctionId,
      start,
      end,
      mode: "CONCENTRATION",
      value: boosterValue,
      units: "mg/L",
    };
  }

  return (
    <form
      className="flex flex-col gap-3 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2 className="font-semibold">Manual scenario</h2>
      <p className="text-muted-foreground">{context.notices.time}</p>
      <label className="flex flex-col gap-1">
        Name
        <input
          className="rounded-md border border-border bg-card px-2 py-1"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        Intervention type
        <select
          className="rounded-md border border-border bg-card px-2 py-1"
          value={type}
          onChange={(event) =>
            setType(event.target.value as (typeof TYPES)[number])
          }
        >
          {TYPES.map((id) => {
            const meta = context.catalog.types.find((item) => item.id === id);
            return (
              <option key={id} value={id} disabled={meta?.enabled === false}>
                {meta?.label ?? id}
              </option>
            );
          })}
          <option value="CHANGE_VALVE_SETTING" disabled>
            Change valve setting (Net3 has no valves)
          </option>
        </select>
      </label>
      {typeMeta?.notice ? (
        <p className="text-muted-foreground">{typeMeta.notice}</p>
      ) : null}
      {type === "CHANGE_PUMP_SCHEDULE" || type === "CHANGE_PUMP_SETTING" ? (
        <label className="flex flex-col gap-1">
          Pump (EPANET source id)
          <select
            className="rounded-md border border-border bg-card px-2 py-1"
            value={pumpId}
            onChange={(event) => setPumpId(event.target.value)}
          >
            {context.catalog.pumps.map((pump) => (
              <option key={pump.id} value={pump.sourceId}>
                {pump.id} · {pump.sourceId}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {type === "CHANGE_PUMP_SETTING" ? (
        <label className="flex flex-col gap-1">
          Setting
          <input
            type="number"
            min={0}
            step={0.1}
            className="rounded-md border border-border bg-card px-2 py-1"
            value={setting}
            onChange={(event) => setSetting(Number(event.target.value))}
          />
        </label>
      ) : null}
      {type === "CHANGE_PUMP_SCHEDULE" ? (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Pump enabled in interval
        </label>
      ) : null}
      {type === "CHANGE_TANK_CONTROL" ? (
        <>
          <label className="flex flex-col gap-1">
            Tank
            <select
              className="rounded-md border border-border bg-card px-2 py-1"
              value={tankId}
              onChange={(event) => setTankId(event.target.value)}
            >
              {context.catalog.tanks.map((tank) => (
                <option key={tank.id} value={tank.sourceId}>
                  {tank.id} · {tank.sourceId}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Initial level (m)
            <input
              type="number"
              className="rounded-md border border-border bg-card px-2 py-1"
              value={levelM}
              onChange={(event) => setLevelM(Number(event.target.value))}
            />
          </label>
        </>
      ) : null}
      {type === "FLUSH_EVENT" || type === "CHANGE_BOOSTER_PROFILE" ? (
        <label className="flex flex-col gap-1">
          Junction
          <select
            className="rounded-md border border-border bg-card px-2 py-1"
            value={junctionId}
            onChange={(event) => setJunctionId(event.target.value)}
          >
            {context.catalog.junctions.map((node) => (
              <option key={node.id} value={node.sourceId}>
                {node.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {type === "FLUSH_EVENT" ? (
        <>
          <label className="flex flex-col gap-1">
            Duration (s)
            <input
              type="number"
              min={1}
              className="rounded-md border border-border bg-card px-2 py-1"
              value={durationSeconds}
              onChange={(event) =>
                setDurationSeconds(Number(event.target.value))
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            Discharge (L/s)
            <input
              type="number"
              min={0.1}
              step={0.1}
              className="rounded-md border border-border bg-card px-2 py-1"
              value={dischargeLps}
              onChange={(event) => setDischargeLps(Number(event.target.value))}
            />
          </label>
        </>
      ) : null}
      {type === "CHANGE_BOOSTER_PROFILE" ? (
        <label className="flex flex-col gap-1">
          Concentration (mg/L)
          <input
            type="number"
            min={0}
            step={0.1}
            className="rounded-md border border-border bg-card px-2 py-1"
            value={boosterValue}
            onChange={(event) => setBoosterValue(Number(event.target.value))}
          />
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 font-medium disabled:text-muted-foreground"
      >
        {pending ? "Creating…" : "Create scenario"}
      </button>
    </form>
  );
}
