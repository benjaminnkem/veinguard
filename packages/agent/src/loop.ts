import { compareScenarios } from "./compare";
import { capMessages, clipRationale, truncateJson } from "./compact";
import { detectActuationRequest } from "./constraints";
import { AgentError } from "./errors";
import { ToolSession } from "./execute";
import { systemPrompt, userPrompt } from "./prompt";
import { GEMINI_TOOLS } from "./tools";
import { DEFAULT_GEMINI_MAX_OUTPUT_TOKENS } from "./docs";
import type { AgentStore } from "./store";
import type {
  AgentEvent,
  AgentLimits,
  AgentRun,
  GeminiChatMessage,
  GeminiClient,
  SimulationPort,
} from "./types";
import type { AgentOutcome, RunStatus } from "@repo/contracts";

export interface LoopInput {
  run: AgentRun;
  gemini: GeminiClient;
  simulation: SimulationPort;
  store: AgentStore;
  limits: AgentLimits;
  now?: () => Date;
}

export async function runAgentLoop(input: LoopInput): Promise<AgentRun> {
  const now = input.now ?? (() => new Date());
  const started = now();
  let run = {
    ...input.run,
    status: "RUNNING" as RunStatus,
    startedAt: started.toISOString(),
    updatedAt: started.toISOString(),
  };
  await input.store.replaceRun(run);
  await emit(input, run, {
    type: "STARTED",
    displayMessage: "Operations agent started.",
  });

  if (detectActuationRequest(run.goal)) {
    return finish(input, run, {
      status: "SUCCEEDED",
      outcome: "REFUSED",
      rationale:
        "Refused. VeinGuard is decision-support only; no real infrastructure is actuated. Apply is digital-twin only.",
      eventType: "COMPLETED",
      displayMessage: "Refused real-actuation request.",
    });
  }

  const session = new ToolSession(run, input.simulation, {
    maxSimulations: input.limits.maxSimulations,
  });
  const messages: GeminiChatMessage[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: userPrompt(run) },
  ];

  let steps = 0;
  let lastContent: string | null = null;
  try {
    while (steps < input.limits.maxSteps) {
      if (now().getTime() - started.getTime() > input.limits.timeoutMs) {
        return finish(input, run, {
          status: "PARTIAL",
          outcome: "LIMIT_REACHED",
          rationale: selectedRationale(session, lastContent, "Wall-clock limit reached."),
          eventType: "LIMIT_REACHED",
          displayMessage: "Agent wall-clock limit reached.",
          selected: deterministicSelected(session),
        });
      }
      steps += 1;
      const result = await input.gemini.chat({
        model: run.modelId,
        messages: capMessages(messages, input.limits.contextMaxBytes),
        tools: [...GEMINI_TOOLS],
        tool_choice: "auto",
        temperature: 0.2,
        max_completion_tokens: DEFAULT_GEMINI_MAX_OUTPUT_TOKENS,
      });
      lastContent = result.content;
      if (result.toolCalls.length === 0) {
        break;
      }
      messages.push({
        role: "assistant",
        content: result.content,
        tool_calls: result.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: call.arguments },
          ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {}),
        })),
      });
      for (const call of result.toolCalls) {
        await emit(input, run, {
          type: "TOOL_STARTED",
          displayMessage: `Calling ${call.name}.`,
          toolName: call.name,
        });
        const executed = await session.execute(call.name, call.arguments);
        await emit(input, run, {
          type: "TOOL_COMPLETED",
          displayMessage: executed.displayMessage,
          toolName: executed.toolName,
          argsHash: executed.argsHash,
          resultSummary: publicSummary(executed.result),
          scenarioRunId: executed.scenarioRunId,
        });
        if (executed.eventType) {
          await emit(input, run, {
            type: executed.eventType,
            displayMessage: executed.displayMessage,
            toolName: executed.toolName,
            scenarioRunId: executed.scenarioRunId,
            resultSummary: publicSummary(executed.result),
          });
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: executed.toolName,
          content: truncateJson(executed.result),
        });
      }
      run = {
        ...run,
        scenarioRunIds: [...session.scenarios.keys()],
        updatedAt: now().toISOString(),
      };
      await input.store.replaceRun(run);
    }

    if (steps >= input.limits.maxSteps && lastContent === null) {
      return finish(input, run, {
        status: "PARTIAL",
        outcome: "LIMIT_REACHED",
        rationale: selectedRationale(session, lastContent, "Step limit reached."),
        eventType: "LIMIT_REACHED",
        displayMessage: "Agent step limit reached.",
        selected: deterministicSelected(session),
      });
    }

    const selected = deterministicSelected(session);
    const outcome: AgentOutcome = selected ? "SELECTED" : "NO_FEASIBLE_SCENARIO";
    return finish(input, run, {
      status: "SUCCEEDED",
      outcome,
      selected,
      rationale: selectedRationale(session, lastContent, undefined),
      eventType: outcome === "NO_FEASIBLE_SCENARIO" ? "COMPLETED" : "COMPLETED",
      displayMessage:
        outcome === "SELECTED"
          ? `Selected scenario ${selected}.`
          : "No feasible scenario under hard constraints.",
    });
  } catch (error) {
    const agentError = error instanceof AgentError ? error : null;
    return finish(input, run, {
      status: "FAILED",
      outcome: "FAILED",
      rationale: clipRationale(agentError?.message ?? "Agent run failed."),
      eventType: "FAILED",
      displayMessage: agentError?.message ?? "Agent run failed.",
      error: {
        code: agentError?.errorCode ?? "AGENT_UNAVAILABLE",
        message: agentError?.message ?? "Agent run failed.",
      },
    });
  }
}

function deterministicSelected(session: ToolSession): string | null {
  const comparison = session.lastComparison ?? compareScenarios([...session.scenarios.values()]);
  return comparison.feasible[0]?.scenarioRunId ?? null;
}

function selectedRationale(
  session: ToolSession,
  lastContent: string | null,
  fallback?: string,
): string {
  const selected = deterministicSelected(session);
  const fromModel = lastContent ? publicRationale(lastContent) : "";
  const prefix = selected
    ? `Selected scenario ${selected} by deterministic objective.`
    : "No feasible scenario.";
  const body = fromModel || fallback || "";
  return clipRationale(`${prefix} ${body}`.trim());
}

function publicRationale(text: string): string {
  const cleaned = text.replace(/```[\s\S]*?```/g, " ").trim();
  const parts = cleaned
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  return clipRationale(parts[parts.length - 1] ?? cleaned);
}

function publicSummary(result: Record<string, unknown>): Record<string, unknown> {
  const allowed = [
    "error",
    "feasible",
    "objective",
    "scenarioRunId",
    "rank",
    "projectedTargetBreachCount",
    "minResidualMgL",
    "hydraulicsConverged",
    "hardConstraintViolationIds",
    "rejected",
    "zoneId",
    "truncated",
  ];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in result) {
      out[key] = result[key];
    }
  }
  if (Array.isArray(result.feasible)) {
    out.feasibleCount = result.feasible.length;
  }
  if (Object.keys(out).length === 0) {
    out.hash = true;
  }
  return out;
}

async function emit(
  input: LoopInput,
  run: AgentRun,
  partial: Omit<AgentEvent, "agentRunId" | "organizationId" | "sequence" | "timestamp">,
): Promise<void> {
  const sequence = await input.store.nextSequence(run.id);
  const timestamp = (input.now ?? (() => new Date()))().toISOString();
  await input.store.appendEvent({
    agentRunId: run.id,
    organizationId: run.organizationId,
    sequence,
    timestamp,
    ...partial,
  });
}

async function finish(
  input: LoopInput,
  run: AgentRun,
  done: {
    status: RunStatus;
    outcome: AgentOutcome;
    rationale: string;
    eventType: "COMPLETED" | "FAILED" | "LIMIT_REACHED";
    displayMessage: string;
    selected?: string | null;
    error?: { code: string; message: string };
  },
): Promise<AgentRun> {
  const completedAt = (input.now ?? (() => new Date()))().toISOString();
  const next: AgentRun = {
    ...run,
    status: done.status,
    outcome: done.outcome,
    rationale: done.rationale,
    selectedScenarioRunId: done.selected ?? run.selectedScenarioRunId,
    completedAt,
    updatedAt: completedAt,
    error: done.error ?? run.error,
  };
  await input.store.replaceRun(next);
  await emit(input, next, {
    type: done.eventType,
    displayMessage: done.displayMessage,
    scenarioRunId: next.selectedScenarioRunId,
    resultSummary: {
      outcome: next.outcome,
      selectedScenarioRunId: next.selectedScenarioRunId,
    },
  });
  return next;
}
