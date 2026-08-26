# VeinGuard — Deployment & Cost Strategy

**Goal:** Hackathon demonstration at approximately $0 where current free/trial tiers permit it, while preserving production-ready service boundaries.

Free plans change. Codex must re-check current official pricing before deployment.

# 1. Zero-cost hackathon target

```text
Next.js web
 -> Vercel Hobby or another appropriate free frontend host

Nest API
 -> Render Free

Nest worker
 -> co-located for hackathon if necessary, or separate if free-hour budget permits

Python simulation
 -> Render Free / Docker

MongoDB
 -> Atlas Free

Redis
 -> Upstash Redis Free or other compatible free Redis

Gemini
 -> Google AI Studio / Gemini API; quota depends on model and project tier

FortyGuard
 -> hackathon/trial credentials

Map
 -> MapLibre + currently permitted free map-style/tile provider
```

# 2. Render Free considerations

Current Render official docs at handoff state:
- free web services exist;
- free service spins down after 15 minutes without inbound traffic;
- restart can take about a minute;
- filesystem is ephemeral;
- workspace receives 750 free instance hours per calendar month;
- free services are not intended as production infrastructure.

Implications:
- no durable artifacts on local disk;
- pre-warm demo;
- account for shared instance hours;
- co-locating API+worker may be acceptable for hackathon while code remains separable.

# 3. MongoDB Atlas Free

Current official docs provide a Free cluster suitable for development/proof-of-concept and state one Free cluster per project.

Good for hackathon data volume; not a production-capacity claim.

# 4. Redis

At handoff Upstash publishes a Free tier including:
- 256 MB;
- 500K commands/month.

Upstash documents BullMQ compatibility and warns BullMQ polling can consume commands frequently.

Therefore:
- low/bounded worker concurrency;
- monitor command use;
- production queue infrastructure should be sized appropriately.

# 5. Gemini

VeinGuard accepts four server-only keys and advances on a 429/quota response.
Google documents many Gemini rate limits per project, so keys only provide
independent capacity when they belong to separately limited projects.

Current candidate:
```text
gemini-3.6-flash
```

Keep costs low with:
- compact summaries;
- small tool set;
- max steps;
- max simulations;
- no full network dumps.

# 6. FortyGuard

Normal API is paid, while trial/hackathon access may cover the event.

Do not assume the exact participant credit allotment from public docs.

Cost controls:
- canonical completed-real cache;
- small valid AOIs;
- only necessary environmental params;
- no wasteful polling;
- historical replay from cached real provider data for repeated demo.

If hackathon credentials are insufficient, this is the one likely external cost that may require sponsor clarification.

# 7. Map

MapLibre renderer is open source.

Set:
```env
NEXT_PUBLIC_MAP_STYLE_URL_LIGHT=https://tiles.openfreemap.org/styles/positron
NEXT_PUBLIC_MAP_STYLE_URL_DARK=https://tiles.openfreemap.org/styles/dark
```

Choose tile/style providers whose **current** free/browser terms permit the deployed demo. The Operations map uses `resolvedTheme` from next-themes to pick light vs dark.

# 8. Why $0 is not production

Real utility deployment should budget for:
- always-on API/worker;
- simulation compute;
- managed Redis;
- dedicated Mongo;
- object storage;
- backup;
- monitoring;
- security;
- private network;
- SSO/MFA;
- provider usage;
- support/SLA;
- data residency.

# 9. Environments

Local:
- Docker Mongo/Redis;
- local apps;
- real providers on demand.

Preview:
- no live secrets by default.

Hackathon:
- public web;
- protected API;
- benchmark network;
- cached/historical real FortyGuard;
- real Gemini.

Future production:
- separate services;
- private simulation network;
- durable artifact storage;
- secret manager;
- enterprise identity;
- observability.

# 10. Deployment checklist

- [ ] current free-tier docs rechecked
- [ ] secrets configured
- [ ] no browser secrets
- [ ] Mongo indexes
- [ ] Redis
- [ ] WNTR/EPANET Linux container works
- [ ] service auth
- [ ] FortyGuard live smoke
- [ ] Gemini live smoke
- [ ] MapLibre style loads
- [ ] CORS/auth origins
- [ ] SSE through hosting proxy
- [ ] health/readiness
- [ ] cold-start rehearsal
- [ ] real historical thermal event cached
- [ ] both chemistry profiles tested
- [ ] provenance visible

# 11. Demo reliability

Before judging:
1. acquire an eligible **real historical** thermal event;
2. persist provider provenance;
3. run selected model;
4. confirm actual behavior;
5. choose a useful real event/zone;
6. keep cached-real response.

If a selected event produces no useful target stress, test another eligible event. Do not alter model output.

# 12. Final cost report required from Codex

For each service:
- provider;
- selected plan;
- current free limit;
- observed/estimated demo usage;
- what happens at limit;
- card requirement if known;
- production alternative.

Never write "free forever" unless current official provider docs explicitly support that statement.
