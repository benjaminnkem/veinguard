# Theatre.js in VeinGuard

VeinGuard uses Theatre core sheets as the source of editable visual scene values while React Three Fiber owns rendering. This keeps the scene compatible with the repository's React 19 / Fiber 9 runtime; the optional `@theatre/r3f` peer contract currently targets Fiber 8, so it is not imported into production code.

## Development

Set `NEXT_PUBLIC_THEATRE_STUDIO=true` and run the web app. `TheatreStudioLoader` dynamically imports `@theatre/studio` in the browser and initializes Studio only when the local development flag is enabled. The R3F scene reads Theatre core object values directly, so Studio is never required by the default or production path.

## Project and sheets

The shared project is `VeinGuard Visual System`. The current landing scene uses:

- `VeinGuard / Hero`

Reserve these semantic sheet names when the corresponding visual scenes become editable:

- `VeinGuard / Thermal Pipeline`
- `VeinGuard / Intervention`
- `VeinGuard / Provenance`
- `VeinGuard / Final CTA`

Scene objects use semantic names such as `Hero / Network`, `Hero / Thermal Surface`, `Hero / Gate`, and `Hero / Flow Signal`. Avoid anonymous mesh names.

## Production

`apps/web/theatre/veinguard-project-state.json` is a committed, small production state file. `lib/theatre/project.ts` loads it into `getProject`. If Studio is enabled, the same project is made editable; otherwise the file provides deterministic initial values and the scene remains a normal client-only R3F component.

## Adding a scene object

1. Add the default object values in `lib/theatre/project.ts`.
2. Read `object.value` inside the scene or subscribe with Theatre `onChange` for DOM consumers.
3. Keep per-frame values in refs and mutate Three objects in `useFrame`.
4. If Studio is enabled, tune the object and export state from the Studio project menu.
5. Keep the exported state small and review it as visual configuration, not product data.

Never put network measurements, provider responses, credentials, or simulation results in Theatre state.
