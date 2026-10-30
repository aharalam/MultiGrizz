# Backend

Owned by the two backend teammates. Work on the `backend` branch.

Planned stack: Node.js and TypeScript, a standalone HTTP API, Zod for validation, Gemma through @google/genai, and Supabase Postgres/Realtime. The API framework is not selected. This directory is a workspace boundary; the service has not been scaffolded yet.

Keep this service's package.json, lockfile, source, tests, database migrations, and configuration inside this directory. Install and run its dependencies here, independently of the frontend. The separate-service requirement replaces the earlier suggestion to use frontend Next.js Route Handlers as the backend.

Suggested development port: 4000. Allow only configured frontend origins. Keep model calls, context assembly, authorization, task claims, and action execution on the backend. Coordinate API payloads in `../contracts/` before both teams implement them.

Every team-owned record must carry a player-team boundary. Verify membership server-side and enforce database and Realtime access policies. Squad context is separate within a player team, but its human members can inspect everything. Cross-player-team context sharing is outside the initial scope.

The Gemma model, API access, quotas, and latency still need a real integration check. A bounded TypeScript coordinator should track agent runs and avoid duplicate task execution.
