# VEINGUARD BRAND SYSTEM

## Brand concept

VeinGuard is the intelligence layer inside a drinking-water distribution network. The identity combines the branching logic of a network with the discipline of a control gate: external thermal intelligence enters, the modeled system state propagates, and every intervention is checked before it can be considered feasible.

The brand idea is **protected water circulation**. VeinGuard should feel engineered, inspectable, and quietly alive—not like a security startup, a weather dashboard, or an autonomous control system.

## Personality and visual thesis

VeinGuard is precise, calm under pressure, and explicit about uncertainty. Visual energy comes from flow, propagation, and convergence. A glow means an active modeled state; a dashed line means a projection or candidate; a warm field means environmental input, never water temperature.

The product uses a near-black technical canvas, restrained water-blue light, warm environmental contours, solid structural dividers, and monospaced provenance. Marketing can become editorial and cinematic. Product surfaces remain operational and evidence-first.

## Logo system

The mark is a branching V-shaped conduit resolved through a central junction. Two paths split from one controlled node, expressing topology, circulation, and intervention branching. It is not a shield, droplet, heart, literal vein, or generic cybersecurity emblem.

The geometry uses a 64×64 unit field, 6-unit primary stroke, rounded caps, and a 2-unit central junction. The open form preserves negative space and remains legible at favicon size. The wordmark is a wide, light uppercase construction with generous tracking; the horizontal lockup is the default product signature and the stacked lockup is reserved for cover/launch moments.

Clear space around the mark is at least one quarter of its width. Minimum sizes are 16px for the mark, 112px for the horizontal lockup, and 28px for the stacked lockup. Use the mono mark on single-color or low-contrast surfaces. Do not stretch, rotate, add a shield, add a drop, apply a rainbow gradient, outline the wordmark, or place the logo in a decorative rounded container.

## Palette

### Core environment

| Token | Value | Use |
|---|---|---|
| `bg` | `#050505` | primary canvas |
| `surface` | `#0C0C0C` | panels and shells |
| `surface-2` | `#111214` | inner surfaces |
| `elevated` | `#18181B` | selected/expanded surfaces |
| `fg` | `#FAFAFA` | primary text |
| `fg-soft` | `#E4E4E7` | supporting text |
| `muted` | `#A1A1AA` | secondary copy |
| `faint` | `#71717A` | metadata |

### Water blue

`#49C6E5` is active modeled flow, selected network, verified model state, and interaction focus. Luminous and pale variants are reserved for traces and highlights; deep variants are for fields and hover surfaces. Blue is structural energy, not decoration.

### Semantic colors

Success is `#34D399`, warning is `#F59E0B`, danger is `#F87171`, and informational is `#60A5FA`. Every semantic state includes text or shape in addition to color. Warm amber/rose thermal contours describe the environmental boundary; they must not be reused as modeled water temperature.

## Typography

Use Geist Sans for human-readable interface and editorial copy, Geist Mono for EPANET IDs, timestamps, activity IDs, hashes, simulation runs, model versions, chemistry values, and scenario identifiers. Landing headlines can be large (`clamp(3.5rem, 9vw, 9rem)`) with deliberately composed line breaks. Product titles stay restrained at 24–32px, and operational metadata stays 10–12px.

## Surface and border language

Landing frames are architectural: square edges, precise dividers, and occasional dashed construction lines. Product panels use solid borders and modest 10–16px radii only when grouping data improves scanability. Dashed treatment has meaning: candidate intervention, projected route, forecast extent, synthetic georeferencing, or unresolved data. Avoid card soup; prefer maps, inspectors, rails, toolbars, tables, and structural canvases.

## Visualization language

- **Map symbolism:** subdued geography; infrastructure dominates. Synthetic georeferencing is visible in the UI and provenance.
- **Network symbolism:** pipes are conduits with hierarchy, width, direction, and state. Selected and traced paths recede other elements rather than simply making everything brighter.
- **Thermal field:** desaturated amber/rose contours and soft warm intensity represent FortyGuard environmental input.
- **Water state:** water-blue gradients and calibrated metric labels represent modeled water temperature and chemistry output.
- **Chemistry:** Free Chlorine and Monochloramine have distinct labels, inputs, model versions, and result paths. Coming-soon profiles stay disabled.
- **Simulation:** candidate branches use dashed construction; hard-constraint gates are explicit; only completed deterministic runs produce metrics.
- **Provenance:** causal lineage is a stack of source, network, model, calibration, simulation, and result—not a blockchain motif.
- **3D objects:** satin-black conduits, restrained blue internal flow, warm environmental surface, low-poly junctions, and sparse directional signals.

## Motion language

Motion means flow, pressure, propagation, trace, branch, gate, convergence, and refraction. Use quick transitions for controls, measured propagation for state changes, and slow ambient movement only in illustrative scenes. Avoid bounce, jelly, wobble, and perpetual particle noise. Respect `prefers-reduced-motion`: freeze decorative scenes at a useful frame, remove cursor smoothing and long scroll pins, and preserve semantic transitions.

## Accessibility and implementation

Decorative SVG and WebGL are `aria-hidden`; all meaningful state is duplicated in HTML. Focus is a clear water-blue outline. Map controls have labels, state is never color-only, drawers use dialog semantics, and mobile replaces side inspectors with bottom sheets or drawers. Keep source/freshness, modeled-vs-provider distinction, target language, and provenance close to the number they qualify.

Brand assets live in `apps/web/public/brand`. Core CSS tokens live in `apps/web/app/globals.css`. Scene values are registered through Theatre core in `apps/web/lib/theatre` and kept separate from product data. The application route is `/operations`; public launch CTAs always link there.
