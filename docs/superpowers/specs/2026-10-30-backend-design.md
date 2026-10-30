# MultiGrizz backend design

This records the team's approved direction and the bounded first slice requested in conversation.

- Independent TypeScript HTTP backend in `backend/`, branch `backend`; frontend is owned separately.
- Team and party are synonyms. Authenticated members share all team resources; outsiders cannot inspect them.
- Teams own agents and squads. An agent can belong to multiple squads; each squad has separate context. Sharing is explicit through same-team handoffs.
- Local Gemma 4 E2B through loopback-only Ollama, no Google key or cloud fallback. Shared serialized model queue, bounded agents/tool calls and context.
- Supabase Auth verifies bearer tokens. Use caller-scoped clients with publishable key and JWT for application data, backed by database RLS. Never trust team IDs in request bodies.
- Supabase HTTPS works; direct SQL is unavailable on this network. Deliver a non-destructive SQL migration for the dashboard SQL Editor and clearly report whether it has been applied.

## First slice

Create/join teams by high-entropy invite code; list members; create/list agents and squads; assign agents; append/read squad context; share handoffs; start a bounded run and poll run/results. Runs serialize local model use. Agents can list squads and publish same-team findings through allowlisted tools. Maximum 3 agents per run, 3 model rounds per agent, 2 tool calls per round. One active run per squad, enforced in the database.

Use Fastify for an independently runnable API and inject-based request verification; Zod validates inputs. Node native fetch handles Ollama. Supabase JS handles auth and caller-scoped data. Frontend signs in through Supabase Auth and sends access tokens; backend exposes no unauthenticated database access.

## Approaches

The earlier Next.js Route Handler option would couple frontend/backend deployment; the team requested separate applications. A standalone API fits that requirement. Hosted Gemma would require a key but conflicts with the team's explicit local requirement. Direct SQL is optional for runtime; HTTPS Data API plus dashboard migration avoids a paid IPv4 dependency.

## Limits

Single backend process and in-process execution queue for the demo; queued jobs do not survive process failure. Run state is persisted, and stale jobs require an explicit recovery policy rather than automatic duplicate execution. No arbitrary shell, browser, or external-network tools. No cross-team handoffs, billing, autonomous infinite loops, vector database, or full game mechanics in this slice.

## Acceptance

Unauthenticated requests denied; cross-team requests denied before retrieval/model use; cross-team child references rejected; context bounded and squad-scoped; local model failures reflected on runs; queue serializes calls and enforces capacity; API contract and SQL setup instructions let the frontend pair integrate. Local/live checks are distinguished from isolated tests.
