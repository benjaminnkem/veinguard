# VeinGuard — Decisions, Open Questions & Skills/MCP Guidance

# 1. Locked decisions

## Name
**VeinGuard**

## Product
Heat-aware drinking-water distribution digital twin and decision support.

## Stack
- Next.js frontend
- NestJS backend
- MongoDB
- Python/FastAPI scientific simulation service
- WNTR/EPANET
- Groq
- MapLibre
- React Flow
- BullMQ/Redis

## Runtime integrity
- no mocked required runtime behavior;
- unit-test doubles allowed;
- captured real provider fixtures allowed with provenance;
- benchmark network is valid and disclosed.

## Chemistry
Active:
- Free Chlorine
- Monochloramine

Coming soon:
- Chlorine Dioxide
- Advanced Multi-Species Chemistry

## Nitrification
V1 is a transparent favorable-conditions/risk indicator, not a biological concentration/probability model.

## Agent
- proposes/investigates/explains;
- deterministic simulation validates;
- deterministic constraints/objective select;
- digital twin only;
- no real actuation.

# 2. Current Groq candidate

```text
openai/gpt-oss-20b
```

The previous idea of `llama-3.3-70b-versatile` must not be used; current Groq deprecation docs win.

Model remains env-configurable.

# 3. Open questions that do not block scaffolding

## FortyGuard entitlement
Need actual:
- hackathon API key;
- free/trial credit allocation;
- Basic/Premium entitlement;
- account-specific regional/usage constraints.

Architecture is entitlement-aware regardless.

## Demo AOI
Choose after real provider testing.

Do not hardcode Phoenix just because it is hot. Select an eligible AOI/event that:
- is supported;
- returns real data;
- fits account area constraints;
- creates a useful demonstrable thermal field.

## Historical demo event
Choose through real acquisition/backtest.

No pre-invented numerical outcome.

## Map tile/style provider
MapLibre is locked. Tile/style host can be selected later based on current free terms.

# 4. Potential scientific blockers

Codex should ask if current authoritative docs/tests cannot resolve:

## Free Chlorine coupling
If time-varying spatial temperature cannot be coupled to EPANET chemistry with defensible state handling, Codex must show tested options before simplifying.

## Monochloramine
If accessible authoritative equations/model implementation cannot be verified, Codex must ask before using a heuristic.

## Calibration defaults
Literature values can be used for benchmark demo only with:
- explicit source;
- validity range;
- reference calibration label;
- no utility-specific claim.

If a required parameter has no defensible reference, ask.

# 5. Deliberately deferred

Not required for V1:
- real SCADA control;
- real utility GIS;
- SSO;
- billing;
- production data residency;
- chlorine dioxide model;
- DBP model;
- biological nitrification kinetics;
- object-storage vendor;
- enterprise observability vendor;
- sensor assimilation.

# 6. Skills/MCP recommendation

## Required
**No third-party MCP is required to build VeinGuard.**

The necessary engineering capabilities are:
- repository/file access;
- terminal/build/test execution;
- browser/web access to current official docs;
- Git/GitHub.

The science must live in code with tests, not inside an opaque MCP.

## Useful
- **GitHub integration**: useful for repo, PR and CI workflows.
- **Figma integration**: optional if a Figma source of truth is created for the Operations/Digital Twin UI.

These integrations are conveniences, not runtime dependencies.

## Optional
- issue tracker integration;
- product-design/prototyping tooling;
- observability integration after deployment.

## Do not add merely for novelty
- broad-write production MongoDB MCP;
- SCADA/control MCP;
- opaque "water AI" MCP;
- unofficial FortyGuard MCP that hides the actual provider contract.

Codex should call official FortyGuard HTTP APIs from our backend.

# 7. Persistent Codex guidance

`AGENTS.md` is the source of truth for repository-wide AI coding behavior.

If the Codex environment supports reusable skills/workflows, an optional future `veinguard-verify` skill can automate:
1. re-read current FortyGuard docs;
2. lint/typecheck/build;
3. run Python scientific tests;
4. run provider-contract tests;
5. run no-mock audit;
6. print phase report.

That is workflow convenience, not a blocker.

# 8. Questions Codex should not ask

Do not interrupt for:
- variable names;
- normal folder placement;
- ordinary library patterns;
- exact UI padding;
- routine retry implementation;
- matters clearly resolved by current official docs.

Ask only when choice materially affects correctness, science, safety, cost, or irreversible architecture.
