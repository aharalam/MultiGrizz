# Implementation plan

- Active direction: Multi-agent, multiplayer agentic ecosystem, selected by the team. PantryGap is parked in `ideas/PantryGap.md`.
- Repository architecture: Team requested one GitHub repository with independent `frontend/` and `backend/` applications, work branches `frontend` and `backend`, and eventual integration into `main`. API agreements live in `contracts/`. See CONTRIBUTING.md.
- Stack: Next.js/React/TypeScript frontend owned by frontend pair; implemented standalone Fastify/Node.js/TypeScript backend with local Gemma via Ollama HTTP API, Zod, and Supabase. Local inference is required; no Google API key or cloud fallback.
- Context hierarchy: Team and party are synonyms. One player team owns agents and squads; its players can inspect all team data. Squads maintain distinct working contexts and share explicit handoffs. Other player teams are isolated. No separate parties table.
- Components/data flow: Supabase Auth bearer token → team membership check → caller-scoped Data API/RLS → bounded local model queue → per-squad notes/results and explicit handoffs. Only schema readiness uses a server-key zero-row probe.
- Persistence: Seven tables, RLS, same-team composite foreign keys, atomic create/join RPCs and one-active-run constraint. Migration applied by user and live schema readiness verified.
- Execution limits: One process, queue eight, one to three agents/run, three model rounds/agent, two tools/round. Tools list same-team squad metadata and publish explicit same-team findings. Context is bounded recent history, not automatic long-term summarization or vector retrieval.
- Working slice: Auth → shared team → agent/squads → context → handoff → local Gemma run → persisted result, with outsider denial. Live smoke passed and temporary test data cleaned up.
- Risks: Queue is not durable; interrupted runs require explicit recovery. No live cancellation or multi-instance deployment. Hosted Realtime handoff delivery and outsider non-delivery verified; wait for replication readiness before writes/refetch on reconnect. Timestamp-only history cursor has a documented tie limitation.
- Next: Frontend pair integrates against contracts/backend-api.md, then test multiplayer in two browsers and decide demo network access. Frontend hosted on another machine cannot call this machine through its own localhost.
- Backend first-slice implementation authorized by team; frontend UI and final demo approval remain pending.

Keep this a short, current project strategy; use engineering skills for detailed plans.
