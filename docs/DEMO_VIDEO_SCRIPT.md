# VeinGuard demo video script

Natural voiceover, written to be read aloud. Record in **dark theme**, **1920×1080**, browser chrome hidden if you can. Cursor visible. Speak slightly slower than conversation. Leave a beat after every click so the UI can settle.

**Target runtime:** 3:30–4:30  
**Tone:** calm operator briefing, not a product ad  
**Audience:** FortyGuard hackathon judges who know temperature data, not water-network internals

Do not invent numbers on the VO. If the screen shows a residual, water age, or temperature, you can read it. If it does not, skip it.

---

## Before you press record

Do this once, off camera, so the video is not waiting on queues.

1. Start web, API, worker, simulation, Mongo, Redis.
2. Open **http://localhost:3000** in dark mode. Hide bookmarks. Zoom 100–110%.
3. Click **Launch App** and confirm Operations loads the captured FortyGuard hour (`2024-07-15T14:00:00Z`) with tiles, network overlay, and summary cards.
4. Click a projected target-breach junction (often **J-601** on the captured Net3 run). Confirm inspector **Why?** has drivers.
5. In Intervention Lab, either:
   - **Preferred for a clean cut:** start the agent once, let it finish, leave the completed run and at least one feasible scenario on screen. Optionally apply it to the twin so before/after is ready.
   - **Live:** be ready to type the default goal and click **Start agent run**. Edit out the wait if it exceeds ~20 seconds.
6. In Resilience, start a study with only the captured hour so `n=1` is honest. Do not add a second hour unless it actually succeeded.
7. Keep a provenance drawer click ready on Operations.

If Gemini is down, skip the live agent click. Walk a completed manual scenario. Say that Gemini was unavailable and the lab still ran a real simulation. Never play a canned answer.

---

## Words you will not say

| Don't | Say instead |
|---|---|
| unsafe water / safe water | projected target breach, configured operational target |
| this is a real city network | EPA Net3 benchmark, synthetically georeferenced |
| AI calculated the residual | Gemini proposed; EPANET and the chemistry model calculated |
| we applied it to the utility | Apply to Digital Twin |
| recurrence probability / risk score | appearance count, sample size |
| FortyGuard measured the water | FortyGuard is the environmental boundary |

---

## Shot list

Read the **Say** column. Do the **Record** column at the same time. Times are a guide, not a stopwatch.

---

### Shot 01 — Cold open
**0:00 – 0:18**

**Record**
- Landing page, full window.
- Hold on the headline for 2 seconds.
- Slow scroll just enough to show `EPA_BENCHMARK` / `SYNTHETIC_GEOREFERENCING` under the hero. Do not race through the marketing page.

**Say**

> Heat on a map is not the same thing as heat in a drinking-water network. VeinGuard is a digital twin that takes real FortyGuard temperature intelligence, runs it through a real water-network model, and tells an operator where a configured disinfectant target is projected to be crossed — and what they can actually try.

---

### Shot 02 — Enter the product
**0:18 – 0:32**

**Record**
- Click **LAUNCH APP**.
- Land on Operations. Hold so the status bar is readable: Network, Geography, Thermal, Chemistry, Simulation.
- Do not click anything for one second. Let tiles finish.

**Say**

> This demo uses EPA Net3 — a published benchmark network — placed into a demo area of interest with synthetic georeferencing. Those pipes are not a real city's infrastructure. The heat field is a real FortyGuard historical hour. Cached real, not invented.

---

### Shot 03 — The map, two truths
**0:32 – 1:05**

**Record**
- Layers panel open on the left. Network overlay on.
- Start on FortyGuard TCM. Slowly pan/zoom so cells and pipes are both visible.
- Point the cursor at the legend: HISTORICAL captured cells.
- Switch the quantitative layer to **modeled water temperature**, then to **modeled residual**, then to **projected target breach**. One change per sentence. Hold each layer ~2 seconds.
- Glance the four summary cards at the top. Don't hover frantically.

**Say**

> FortyGuard is the environmental boundary. Air temperature around the network — not a water sensor. VeinGuard calculates modeled water temperature from that field, then hydraulics, water age, and disinfectant residual through EPANET and a chemistry model. Unknown is never painted as healthy. And a red mark here is not “unsafe water.” It is a projected crossing of the operational residual target this utility configured.

---

### Shot 04 — Inspect one asset
**1:05 – 1:38**

**Record**
- Click the highlighted junction (use whatever the run actually flags; often J-601).
- Inspector opens. Slowly scroll: hydraulics, thermal, chemistry, then **Why?**
- Hover the modeled residual vs configured target. Do not click around.
- If the Why list has two or three drivers, pause on them.

**Say** *(read the actual IDs and numbers on screen)*

> Here’s the junction the model flags at this sample time. Pressure, flow, and water age come from EPANET. Associated air comes from the FortyGuard cell. Water temperature is modeled — calculated, not measured. Residual versus the configured target. And every highlight has a Why: residence time, elevated modeled water temperature, incoming residual. If the model didn’t compute it, we don’t show a fake number.

---

### Shot 05 — Open provenance
**1:38 – 1:52**

**Record**
- Click provenance in the inspector.
- Scroll just enough to show FortyGuard activity / snapshot, network checksum, thermal model version, chemistry model version. Two seconds, then close.

**Say**

> Provenance is first-class. Which FortyGuard snapshot, which network version, which thermal and chemistry model. If we can’t name the source, we don’t show the result.

---

### Shot 06 — Digital Twin
**1:52 – 2:22**

**Record**
- From the inspector, click **Open in Digital Twin**.
- The schematic should land on the same asset. Fit the graph if needed.
- Color by residual, then by projected target breach.
- Click **downstream** trace, then **upstream**. Follow the highlighted path. Do not spin the canvas.
- If flow is near zero on that node, the UI may not draw a direction. Don’t force it — say the line below.

**Say**

> Same asset, now as a network schematic — reservoirs, tanks, pumps, valves, junctions, pipes. This is the digital twin, not a CAD editor. Trace follows hydraulic flow sign, so you’re looking at the modeled path water actually takes, not a cosmetic highlight.

---

### Shot 07 — Intervention Lab, the ask
**2:22 – 2:50**

**Record**
- Click **Intervention Lab**.
- If you pre-ran the agent: show the completed run, events list, and the default goal still in the box. Point at **No flushing**.
- If live: keep the default goal, leave **No flushing** on, click **Start agent run**. Hold on QUEUED/RUNNING. Jump-cut in edit if it takes longer than ~20 seconds. Resume on completed events.

**Say**

> Operator goal: protect the projected target-breach junction through this hour, without flushing. Gemini does not calculate hydraulics. It proposes typed candidates. VeinGuard validates them, runs real simulations, and ranks the ones that survive hard constraints. Apply means apply to the digital twin. Nothing in the field moves.

---

### Shot 08 — Compare and apply
**2:50 – 3:22**

**Record**
- Show the scenario list: at least one feasible, and a rejected one if you have it (MASS booster or a hard-constraint fail is perfect).
- Click a feasible completed scenario. Point at Feasible / objective. If energy says **Not calculated**, leave it — that honesty is the point.
- Click **Apply to Digital Twin** if not already applied. Wait for the confirmation.
- Jump back to Digital Twin. Toggle **before / after**. Residual/network state may change. Then jump to Operations and show the heat layer is unchanged.

**Say**

> One candidate can be rejected in the open — a hard constraint, or an intervention we didn’t implement, like a mass booster. We don’t rank a failed run. The feasible plan gets applied to the twin only. Watch the before and after on the network. And watch the heat field: it does not change, because we didn’t pretend the weather changed. We changed the water-network scenario.

---

### Shot 09 — Resilience
**3:22 – 3:50**

**Record**
- Open **Resilience**.
- Select the captured-hour study.
- Hold on sample size, succeeded, failed.
- Scroll the events table. Point at freshness (captured / cached-real).
- Point at the recurrence table: count, n, Recurring? If n=1, Recurring is false — that is the shot. Do not apologize for it.
- Brief pan of the recurrence map.

**Say**

> Historical studies replay real FortyGuard hours. Sample size and failures are first-class. Recurrence here is an appearance count, not a probability, and not a claim that heat caused the chemistry. One successful hour cannot be called recurring. If an hour is missing, it stays failed. We do not invent it.

---

### Shot 10 — Close
**3:50 – 4:15**

**Record**
- Cut back to Operations map, heat + network together, inspector still on the junction.
- Optional: one slow push-in. End on the status bar (Thermal · Chemistry · Simulation).
- Freeze 1.5 seconds. Fade.

**Say**

> VeinGuard is heat-aware decision support for a drinking-water digital twin. Real FortyGuard. Real EPANET. Modeled chemistry. A bounded agent that proposes. A model that decides. And an honest label on everything we do not know.

---

## Full voiceover (teleprompter)

Read this straight through if you prefer one take, then cut picture to match. Pauses are marked with `/`.

> Heat on a map is not the same thing as heat in a drinking-water network. / VeinGuard is a digital twin that takes real FortyGuard temperature intelligence, runs it through a real water-network model, and tells an operator where a configured disinfectant target is projected to be crossed — and what they can actually try.
>
> This demo uses EPA Net3, a published benchmark network, placed into a demo area of interest with synthetic georeferencing. Those pipes are not a real city’s infrastructure. The heat field is a real FortyGuard historical hour. Cached real, not invented.
>
> FortyGuard is the environmental boundary. Air temperature around the network, not a water sensor. VeinGuard calculates modeled water temperature from that field, then hydraulics, water age, and disinfectant residual. Unknown is never painted as healthy. And a red mark here is not unsafe water. It is a projected crossing of the operational residual target this utility configured.
>
> Here’s the junction the model flags at this sample time. Pressure, flow, and water age come from EPANET. Associated air comes from the FortyGuard cell. Water temperature is modeled. Residual versus the configured target. And every highlight has a Why. If the model didn’t compute it, we don’t show a fake number.
>
> Provenance is first-class. Which FortyGuard snapshot, which network version, which thermal and chemistry model. If we can’t name the source, we don’t show the result.
>
> Same asset, now as a network schematic. This is the digital twin, not a CAD editor. Trace follows hydraulic flow sign, so you’re looking at the modeled path water actually takes.
>
> Operator goal: protect the projected target-breach junction through this hour, without flushing. Gemini does not calculate hydraulics. It proposes typed candidates. VeinGuard validates them, runs real simulations, and ranks the ones that survive hard constraints. Apply means apply to the digital twin. Nothing in the field moves.
>
> One candidate can be rejected in the open. We don’t rank a failed run. The feasible plan gets applied to the twin only. Watch the before and after on the network. And watch the heat field: it does not change, because we didn’t pretend the weather changed.
>
> Historical studies replay real FortyGuard hours. Sample size and failures are first-class. Recurrence is an appearance count, not a probability, and not a claim that heat caused the chemistry. One successful hour cannot be called recurring. If an hour is missing, it stays failed.
>
> VeinGuard is heat-aware decision support for a drinking-water digital twin. Real FortyGuard. Real EPANET. Modeled chemistry. A bounded agent that proposes. A model that decides. And an honest label on everything we do not know.

**Spoken length:** about 620 words → ~3:45 at 165 wpm, ~4:15 at 145 wpm. Aim for 150–160 wpm.

---

## 60-second cut (if the form is strict)

Use this only if you need a trailer or a hard one-minute limit. Same rules.

| Time | Record | Say |
|---|---|---|
| 0:00–0:08 | Landing headline | Heat on a map is not heat in the pipes. |
| 0:08–0:20 | Operations: TCM + network | Real FortyGuard historical heat on an EPA benchmark network. Synthetically georeferenced. Not a real city. |
| 0:20–0:32 | Click junction, Why? | Modeled residual versus a configured target. Not a claim of unsafe water. Every flag has a Why. |
| 0:32–0:48 | Twin trace, then Lab apply / before-after | Gemini proposes. EPANET decides. Apply is digital-twin only. Heat does not change. |
| 0:48–0:60 | Resilience sample size, then freeze on Operations | Recurrence is a count, with sample size. Honest about what we don’t know. |

---

## Edit notes

- Cut mouse-wandering. Keep the cursor still while you talk.
- If MapLibre tiles lag, hold; do not narrate over a grey map.
- Jump-cut queue waits. Keep one short “QUEUED” beat so it is visibly async and real.
- Lower-third optional, not required. If you use one: `EPA Net3 · SYNTHETIC GEOREF · FortyGuard HISTORICAL`.
- Music: none, or a very low bed under the close only. Judges need to hear the claim language.
- End card (2 seconds, no VO): `VeinGuard` / `FortyGuard Hackathon ’26` / `Apply = digital twin`.

## If the live run misbehaves

| What happens | What you do on camera |
|---|---|
| No map tiles | Don’t record Operations until tiles load. The rest of the product is still real. |
| No target-breach at this hour | Say “this historical hour did not cross the configured target” and inspect the lowest residual anyway. Do not pick a different number. |
| Agent fails | Open a completed manual scenario. “Gemini is down. The lab still runs the physics.” |
| Trace has no direction | “Flow is below the direction threshold at this node.” Move to a pipe with flow. |
| Resilience n=1 | Keep it. That is the integrity beat. |
