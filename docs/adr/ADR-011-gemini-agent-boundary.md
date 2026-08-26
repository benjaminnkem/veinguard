# ADR-011 Gemini agent boundary

**Status:** Accepted for V1  
**Date:** 2026-08-26

## Decision

VeinGuard uses Gemini’s REST `models.generateContent` API with local function
calling. Gemini interprets compact system context and proposes typed tool
calls; VeinGuard validates arguments, enforces constraints, runs simulations,
and deterministically ranks completed scenarios.

The default model is `gemini-3.6-flash`, configured through `GEMINI_MODEL`.

## Contract consulted (2026-08-26)

- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/function-calling
- https://ai.google.dev/gemini-api/docs/models
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/deprecations

The client sends Gemini `contents`, `systemInstruction`, `tools`, and
`toolConfig.functionCallingConfig`, then maps returned `functionCall` parts to
VeinGuard’s existing local tool loop. Tool results are sent back as
`functionResponse` parts. Model thought parts are not persisted or displayed.

## Key rotation

The worker accepts up to four server-only credentials in this order:

```text
GEMINI_API_KEY_1
GEMINI_API_KEY_2
GEMINI_API_KEY_3
GEMINI_API_KEY_4
```

Each chat turn tries each available key at most once. HTTP 429 and Gemini quota
exhaustion responses mark the current key temporarily unavailable and advance
to the next key. Non-rate-limit errors fail immediately because retrying an
invalid request or credential would conceal a real configuration problem.

The provider documents many rate limits per project rather than per key. These
credentials therefore only provide independent capacity when their projects
have independent quotas. All-key exhaustion remains an explicit
`RATE_LIMIT`/`AGENT_UNAVAILABLE` failure; no canned response is generated.

## Boundary and persistence

| Actor | May |
|---|---|
| Gemini | Inspect compact summaries; propose typed interventions; write a short rationale |
| VeinGuard | Validate args; enforce constraints; run real simulations; apply hard constraints; rank by objective |
| Operator Apply | Digital twin only |

Gemini cannot override hard-constraint rejection or forbidden intervention
types. Persisted agent events contain tool names, validated-argument hashes,
compact result summaries, scenario IDs, selected scenario, and concise
rationale. No private chain-of-thought is persisted.

## Bounds

`AGENT_MAX_STEPS`, `AGENT_MAX_SIMULATIONS`, and `AGENT_TIMEOUT_MS` remain the
workflow bounds. `GEMINI_HTTP_TIMEOUT_MS` bounds an individual provider call
and defaults to 60 seconds, while the agent caps each completion at 768 output
tokens to keep tool turns responsive. Provider rotation is bounded by the
number of configured keys, with no unbounded retry loop.
