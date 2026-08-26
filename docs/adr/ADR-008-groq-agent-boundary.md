# ADR-008 Groq agent boundary

**Status:** Superseded by ADR-011
**Date:** 2026-08-19

## Decision

The VeinGuard operations agent uses **local tool calling** against the current Groq Chat Completions API. Groq proposes; VeinGuard executes tools, simulates, and ranks.

## Contract consulted (2026-08-19)

- https://console.groq.com/docs/models
- https://console.groq.com/docs/deprecations
- https://console.groq.com/docs/tool-use/overview
- https://console.groq.com/docs/tool-use/local-tool-calling
- https://console.groq.com/docs/structured-outputs
- https://console.groq.com/docs/rate-limits

Production model used as the default `GROQ_MODEL`: `openai/gpt-oss-20b`.

`llama-3.1-8b-instant` and `llama-3.3-70b-versatile` shut down 2026-08-16 on free/developer tiers. V1 refuses those model IDs.

`openai/gpt-oss-20b` supports local tools and JSON mode. It does **not** support parallel tool use. The loop executes returned tool calls sequentially and does not enable Groq built-in tools.

Auth: `Authorization: Bearer $GROQ_API_KEY` to `POST https://api.groq.com/openai/v1/chat/completions`.

## Boundary

| Actor | May |
|---|---|
| Groq | Inspect compact summaries; propose typed interventions; write a short rationale |
| VeinGuard | Validate args; enforce structured constraints; run real simulations; apply hard constraints; rank by the configured objective |
| Operator Apply | Digital twin only |

Groq cannot override a hard-constraint rejection or a forbidden intervention type.

Persisted fields: goal, constraints, model id, tool names, validated-arg hashes, compact result summaries, scenario ids, selected scenario, concise rationale. No chain-of-thought.

Missing `GROQ_API_KEY` makes `POST /v1/agent-runs` unavailable (`AGENT_UNAVAILABLE`). Manual scenario simulation stays available.

## Bounds

Environment: `AGENT_MAX_STEPS`, `AGENT_MAX_SIMULATIONS`, `AGENT_TIMEOUT_MS`. Context is capped in the agent package. Real-actuation language is refused before any Groq call.
