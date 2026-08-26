# VeinGuard design system

> This is a visual and interaction specification for VeinGuard. The PRD, scientific model specifications, backend contracts, and current product implementation define behavior and data. This document does not import routes, features, content, or functionality from any other product.

## 1. Product visual thesis

VeinGuard is a heat-aware drinking-water distribution digital twin and operational decision-support system. Its visual language comes from the causal chain:

```text
environmental thermal boundary
  → modeled water temperature
  → hydraulics and water age
  → chemistry
  → projected target crossing
  → simulated intervention
  → hard constraints
  → deterministic feasibility and ranking
  → operator decision support
```

The interface should feel like engineered infrastructure that is alive but controlled: branches, conduits, gates, traces, and convergence. Water blue represents a selected or calculated network state. Warm amber/rose represents the external thermal environment. They must never collapse into one visual layer.

VeinGuard is not SCADA, autonomous control, a sensor replacement, pathogen detection, a safety certification engine, or a generic chatbot. Copy and visuals must use **modeled**, **projected**, **simulated**, **operational target**, **environmental boundary**, and **provenance** where appropriate.

## 2. Brand and visual principles

### Protected water circulation

The mark and interface share one idea: one controlled source can branch into many paths, and a gate decides which candidate continues. The system is a network, not a collection of floating cards.

### Clarity over spectacle

The landing page can be cinematic. Product surfaces are calmer and denser. Motion explains propagation, selection, loading, or feasibility; it does not decorate empty space.

### Causal honesty

FortyGuard is an environmental provider input. Modeled water temperature is a model output. Chemistry residual and nitrification conditions are modeled outputs. The UI always keeps those categories distinct.

### Evidence next to interpretation

Every major statement is paired with its source, freshness, state, unit, model version, or a direct route to provenance. Unknown/no-data is never green.

### Architecture, not card soup

Prefer map canvases, technical rails, inspectors, toolbars, drawers, tables, diagrams, and status strips. Cards are reserved for meaningful groupings such as a scenario, a compact metric, or a chemistry profile.

## 3. Surface families

### Landing `/`

Editorial, full-bleed, square-edged, and cinematic in selected moments. Uses large composed type, topology linework, original SVG primitives, and a restrained WebGL network scene. Primary CTA is `LAUNCH APP` and routes to `/operations`.

### Operations `/operations`

Map-first command surface. The map owns the workspace. Summary metrics are compact; the layer rail, map toolbar, timeline, and right inspector are structural. Environmental thermal data and modeled water-network state are visually separate.

### Digital Twin `/digital-twin`

View-only React Flow topology for the benchmark network. Nodes retain EPANET identifiers. Pipes read as engineered conduits, not generic graph edges. Trace and metric modes are prominent; topology editing is not implied.

### Intervention Lab `/intervention-lab`

Branching simulation workspace. Baseline is fixed, candidates are typed interventions, hard constraints are gates, rejected branches terminate, and deterministic ranking occurs only after completed runs. `Apply` always means `Apply to Digital Twin`.

### Resilience `/resilience`

Historical event and recurrence study. Use repeated modeled exposure and recurring vulnerability language. Do not claim causation from association.

### Setup `/setup`

Progressive foundation workflow: network → thermal mode/AOI/event → chemistry → target and constraints → validation → baseline → Operations. Keep benchmark and synthetic georeferencing disclosures visible.

## 4. Core tokens

The primary environment is near-black. Use CSS variables from `apps/web/app/globals.css`; do not scatter replacement literals through components.

| Token | Value | Meaning |
|---|---|---|
| `--color-bg` | `#050505` | application/marketing canvas |
| `--color-surface` | `#0C0C0C` | structural panels |
| `--color-surface-2` | `#111214` | nested data surfaces |
| `--color-elevated` | `#18181B` | selected/expanded objects |
| `--color-fg` | `#FAFAFA` | primary text |
| `--color-fg-soft` | `#E4E4E7` | supporting text |
| `--color-muted` | `#A1A1AA` | secondary text |
| `--color-faint` | `#71717A` | metadata and timestamps |
| `--color-water` | `#49C6E5` | active modeled/selected flow |
| `--color-water-luminous` | `#67D5EE` | high-emphasis trace |
| `--color-water-bright` | `#7DD3FC` | pale network highlight |
| `--color-water-pale` | `#BAE6FD` | light labels and focus |
| `--color-water-strong` | `#0EA5C6` | active fill |
| `--color-water-deep` | `#0284C7` | deep field |
| `--color-water-shadow` | `#075985` | shadowed water state |
| `--color-success` | `#34D399` | feasible/completed/passed |
| `--color-warning` | `#F59E0B` | target crossing/pending/warm field |
| `--color-danger` | `#F87171` | rejected/failed/breach state |
| `--color-info` | `#60A5FA` | informational state |

Water-blue alpha values use `.03`, `.05`, `.08`, `.10`, `.15`, `.20`, `.30`, `.40`, and `.50`. Warning and danger retain their semantic colors; they are not tinted blue.

## 5. Typography

Use the existing Geist Sans and Geist Mono variables. Do not add a third font without a product reason.

### Landing type

- Hero: `clamp(3.8rem, 9.4vw, 9.7rem)`, light weight, `0.88–0.96` line height, tight tracking.
- Section heading: `clamp(2.8rem, 6vw, 6.7rem)`, light weight, deliberate line breaks.
- Lead paragraph: `14–18px`, `1.7–2` line height.
- Eyebrow: 9–10px mono, uppercase, `0.16–0.22em` tracking.

### Product type

- App title: 15–24px, restrained.
- Section title: 12–14px, medium.
- Main row: 12–14px.
- Metric: 18–28px, light or mono.
- Metadata: 9–11px mono.
- EPANET IDs, activity IDs, timestamps, hashes, run IDs, model versions, chemistry values, and scenario IDs use mono.

Operational pages must not use landing-scale headings.

## 6. Borders, radius, and depth

- Marketing outer frames: square, `1px dashed rgb(255 255 255 / 0.16–0.22)`.
- Product structural dividers: solid `rgb(255 255 255 / 0.10–0.16)`.
- Product data panels: solid border, `10–16px` radius only when grouping improves scanability.
- Simulation preview/projected path/synthetic georeferencing/forecast/unresolved data: dashed treatment with an adjacent text label.
- Primary landing CTA: square, water-blue fill or water-blue rim.
- Product action: compact, solid, accessible focus ring; no marketing glow by default.
- Glow means active system state: selected trace, live pulse, gate, or primary CTA. Never add glow to every card.

## 7. Reusable product primitives

Build from semantic primitives rather than a universal `Card` with many appearance props:

- `AppNav` — primary VeinGuard routes and active state.
- `StatusBar` — network, georeference, thermal freshness, chemistry, simulation status.
- `SummaryCards` — compact operational metrics with units and target context.
- `MapToolbar`, `LayerPanel`, `NetworkLegend`, `Timeline` — map workspace controls.
- `Inspector`, `InspectorSection`, `MetricReadout`, `ProvenanceDrawer` — causal inspection.
- `ReservoirNode`, `TankNode`, `JunctionNode`, `PumpNode`, `ValveNode`, `PipeEdge` — topology vocabulary.
- `ScenarioBranch`, `ConstraintStatus`, `ScenarioComparison` — simulation branching.
- `ChemistrySelector` — active/coming-soon model states.
- `AgentRunEvent`, `SimulationStatus`, `EmptyState`, `ErrorState` — honest async states.

Every icon-only control has an accessible label. Status colors are paired with text, shape, or icon.

## 8. Operations map specification

### Basemap

Use a dark near-black style with subdued geography, low-noise roads, low-contrast labels, deep water bodies, and quiet boundaries. Infrastructure layers dominate. Map attribution remains visible. OpenFreeMap/OpenMapTiles attribution must not be removed.

### Environmental thermal layer

FortyGuard TCM is an amber/rose environmental field with soft opacity and thin contours. Do not use a rainbow ramp. Legend title must include `FortyGuard`, units, time/freshness, and `environmental boundary` semantics.

### Modeled network layers

Base pipes are dark structural conduits. Active flow is water-blue with controlled directional traces. Selected paths receive a thin halo and stronger width. Preview/candidate paths use dash. Constraint-affected and projected target-breach paths use warning/danger plus dash, width, marker, or label; never color alone.

Use MapLibre data-driven expressions for diameter/flow/metric where fields exist. Use feature-state for selection and hover so changing focus does not replace the whole GeoJSON source. Animate only selected/affected routes, not every segment.

### Assets

Use custom symbol/circle glyphs and text labels for reservoirs, tanks, junctions, pumps, and valves. Glyph geometry is recognizable at small scale and selected state is water-blue. Target crossing adds a semantic outer state.

### Interaction

Hover shows a small tooltip. Click/tap persists selection and opens the inspector. Camera transitions are controlled: initial network frame, selected asset, trace path, affected area, and reset. Keep map as the primary mobile surface; layer panel and inspector become drawers/bottom sheet.

### Legend and timeline

Legend is context-sensitive and explains units, ranges, target, modeled/source distinction, and missing data. Timeline snaps to available simulation frames and identifies historical/current/forecast/cached-real/queued states. Never interpolate unsupported values.

## 9. Digital Twin specification

The topology is a water network, not a generic node editor. Preserve actual positions and connectivity. Node shapes:

- reservoir: open/source form;
- tank: contained storage with level band;
- junction: small branching node;
- pump: directional mechanical diamond;
- valve: controlled gate form.

Pipe edges use an outer structural stroke, inner flow channel, directional trace only when meaningful, and optional metric label on selection. Non-traced elements recede. A selected node supports upstream/downstream trace, flow direction, metric mode, and provenance.

## 10. Intervention Lab specification

Baseline is visually fixed. Each branch represents a real typed intervention and a real run or explicit async state. Candidate branch states are `QUEUED`, `RUNNING`, `SUCCEEDED`, `FEASIBLE`, `REJECTED`, `FAILED`, or `NO_FEASIBLE_SCENARIO` as supplied by the backend.

The visual story is:

```text
AI proposes → simulation evaluates → hard constraints reject → deterministic comparison ranks → AI explains
```

Never present an LLM as the source of feasibility. Show before/after only from completed simulation. Show resource deltas only when the backend provides them.

## 11. Chemistry and nitrification

Free Chlorine and Monochloramine are active, distinct model profiles. Profile selection changes labels, inputs, results, and provenance. Chlorine Dioxide and Advanced Multi-Species Chemistry are visible disabled `COMING SOON` states.

Use `NITRIFICATION CONDITIONS`, not probability, concentration, or a claim of microbial kinetics unless the backend explicitly supplies a validated model. Explain the categorical state and its drivers.

## 12. Agent and provenance

The agent is an Operations Agent with a structured goal, optional constraint chips, bounded budgets, and a concise event stream. Do not show hidden chain-of-thought. Show tool/action, status, scenario ID, and concise result only.

Provenance is an engineering audit trail:

```text
FortyGuard activity → thermal snapshot → network/version/SHA → georeference → model/calibration → simulation run → result → agent run
```

Use compact rows, mono identifiers, copy controls only where useful, and visible freshness. Do not turn provenance into a blockchain explorer or a decorative timeline with no identifiers.

## 13. Landing motion and 3D

The landing page uses a single hero R3F canvas with branching conduits, junctions, a thermal boundary surface, a selected path, and sparse flow signals. Three.js geometry is shared and low-poly; DPR is capped at `1.45`. The scene is decorative and all meaning is duplicated in DOM.

Theatre core provides semantic sheet/object names and editable visual values. `@theatre/studio` is development-only behind `NEXT_PUBLIC_THEATRE_STUDIO=true`; production loads the committed state and never mounts Studio. See `docs/THEATRE.md`.

Use Motion for small UI transitions and presence. Use GSAP + ScrollTrigger for section reveal, pinning, and multi-depth scroll choreography. Use Lenis only on the landing page, synchronized through the GSAP ticker; destroy it on unmount. Do not run multiple animation loops.

Motion language: flow, pressure, propagation, trace, branch, gate, refraction, convergence. Avoid bounce, wobble, jelly, or cartoon spring motion.

## 14. Responsive behavior

### Landing

At mobile widths, stack the story, reduce scene complexity, disable custom cursor, shorten pinned sequences, reduce parallax, and keep the causal chain legible. The hero line breaks are deliberately composed; no accidental wrapping.

### Product

At 390–430px, map remains primary; app navigation collapses or scrolls without overflow; layer controls become a compact drawer; inspector becomes a bottom sheet; timeline remains reachable. At tablet widths, preserve map space and use collapsible side rails. At desktop, use left rail + workspace + right inspector where the route benefits from it.

Test at 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900, 1728×1117, and 1920×1080.

## 15. Accessibility

- WebGL and decorative SVG are `aria-hidden`.
- Meaningful model state exists in DOM text.
- Map controls have labels and keyboard focus.
- Drawers expose dialog semantics and close on Escape.
- Form controls have labels and disabled states.
- Focus-visible outline is water-blue and high contrast.
- No semantic state is color-only.
- Reduced motion disables Lenis smoothing, long scrubs, continuous 3D motion, cursor animation, and parallax while keeping state transitions immediate.

## 16. Performance and cleanup

- Prefer route-level code splitting; dynamically import browser-only MapLibre, R3F, and Theatre scenes.
- Cap WebGL DPR and pause below-fold scenes where possible.
- Share Three geometries/materials; use `useFrame` mutation for per-frame values, not React state.
- Use MapLibre feature-state and data-driven layers; avoid DOM markers for network-scale assets.
- Memoize XYFlow nodes and edges; animate only focused edges.
- Revert GSAP contexts and ScrollTriggers; destroy Lenis; disconnect observers; dispose Three resources.
- Keep provider responses, network arrays, and full simulation outputs out of LLM prompts.

## 17. Visual QA checklist

Confirm:

- `/` is unmistakably VeinGuard and every primary `LAUNCH APP` CTA routes to `/operations`.
- Operations is map-first and the map does not look like stock MapLibre.
- FortyGuard environmental heat is distinct from modeled water temperature.
- Pipes and assets carry topology semantics and selected paths recede the rest.
- Digital Twin reads as a water network, not a generic React Flow demo.
- Intervention Lab communicates candidate branches, gates, rejection, and deterministic comparison.
- Chemistry shows two active distinct profiles and two disabled coming-soon profiles.
- Provenance and freshness are visible; unknown/no-data is not green.
- Mobile has no horizontal overflow and retains map/inspector/timeline access.
- Reduced-motion mode remains useful and readable.
- No fabricated providers, customers, metrics, measurements, safety claims, or actuation.
