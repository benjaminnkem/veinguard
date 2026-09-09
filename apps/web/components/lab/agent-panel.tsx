"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchLabAgent,
  labEventStreamUrl,
  labKeys,
  startLabAgent,
  type AgentEventView,
} from "@/lib/lab";

export function AgentPanel({ geminiConfigured }: { geminiConfigured: boolean }) {
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState(
    "Protect the projected target-breach junction over the configured simulation horizon without flushing.",
  );
  const [noFlush, setNoFlush] = useState(true);
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentEventView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const constraints = useMemo(() => {
    const chips: Record<string, unknown> = {
      sampleTimeSeconds: 3600,
      networkId: "epa-net3",
    };
    if (noFlush) {
      chips.forbidInterventionTypes = ["FLUSH_EVENT"];
    }
    return chips;
  }, [noFlush]);

  const start = useMutation({
    mutationFn: () => startLabAgent({ goal, structuredConstraints: constraints }),
    onSuccess: (data) => {
      setAgentRunId(data.agentRunId);
      setEvents([]);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const runQuery = useQuery({
    queryKey: labKeys.agent(agentRunId ?? ""),
    queryFn: () => fetchLabAgent(agentRunId!),
    enabled: agentRunId != null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "QUEUED" || status === "RUNNING" ? 2000 : false;
    },
  });

  useEffect(() => {
    if (!agentRunId) {
      return;
    }
    const source = new EventSource(labEventStreamUrl(agentRunId));
    const onMessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as AgentEventView;
        setEvents((current) =>
          current.some((item) => item.sequence === payload.sequence)
            ? current
            : [...current, payload],
        );
      } catch {
        /* ignore malformed SSE payloads */
      }
    };
    source.addEventListener("message", onMessage);
    source.onmessage = onMessage;
    source.addEventListener("agent.started", onMessage);
    source.addEventListener("agent.tool_started", onMessage);
    source.addEventListener("agent.tool_completed", onMessage);
    source.addEventListener("agent.scenario_created", onMessage);
    source.addEventListener("agent.scenario_rejected", onMessage);
    source.addEventListener("agent.comparison_completed", onMessage);
    source.addEventListener("agent.completed", onMessage);
    source.addEventListener("agent.failed", onMessage);
    source.addEventListener("agent.limit_reached", onMessage);
    return () => source.close();
  }, [agentRunId]);

  useEffect(() => {
    if (runQuery.data?.status === "SUCCEEDED" || runQuery.data?.status === "FAILED") {
      void queryClient.invalidateQueries({ queryKey: labKeys.list() });
    }
  }, [queryClient, runQuery.data?.status]);

  const run = runQuery.data;

  return (
    <div className="flex flex-col gap-3 text-xs">
      <h2 className="font-medium">Agent</h2>
      <p className="text-muted-foreground">Gemini proposes. Ranking is deterministic.</p>
      {!geminiConfigured ? (
        <p role="status" className="rounded-md border border-border px-2 py-1">
          Gemini is not configured. Manual scenario mode remains available.
        </p>
      ) : null}
      <label className="flex flex-col gap-1">
        What operational outcome do you want?
        <textarea
          className="min-h-24 rounded-md border border-border bg-card px-2 py-1"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-1">
        <Chip
          label="No flushing"
          selected={noFlush}
          onClick={() => setNoFlush((value) => !value)}
        />
        <Chip label="Configured horizon" selected />
        <Chip label="Network (EPA Net3)" selected />
      </div>
      {error ? (
        <p role="alert" className="text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!geminiConfigured || start.isPending}
        className="border border-water bg-water px-3 py-1.5 font-medium text-accent-foreground disabled:opacity-40"
        onClick={() => start.mutate()}
      >
        {start.isPending ? "Queuing…" : "Start agent run"}
      </button>
      {run ? (
        <section className="rounded-md border border-border p-2">
          <p>
            Status: <span className="font-medium">{run.status}</span>
            {run.outcome ? ` · ${run.outcome}` : ""}
          </p>
          {run.rationale ? <p className="mt-1 text-muted-foreground">{run.rationale}</p> : null}
        </section>
      ) : null}
      <ol className="max-h-48 space-y-1 overflow-auto">
        {events.map((event) => (
          <li key={event.sequence}>
            <span className="text-muted-foreground">{event.type}</span>
            {" · "}
            {event.displayMessage}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 ${
        selected ? "border-border bg-accent" : "border-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}
