# Backend

Standalone Node.js 22+/TypeScript/Fastify service. Work on branch `backend`. The frontend has separate dependencies and communicates over HTTP; it does not import these implementation files.

## Start

```powershell
cd backend
npm ci
# Configure .env using .env.example. Never commit real credentials.
npm run dev
```

`npm run build` compiles to dist. `npm start` runs the compiled server. By default the API listens on http://127.0.0.1:4000. `FRONTEND_ORIGIN` is a comma-separated list of exact allowed browser origins. `HOST` defaults to loopback; explicitly choose a trusted-network binding when coordinating a multi-computer demo. Ollama stays on loopback.

## Database and authentication

The initial migration is `migrations/001_initial.sql`. Apply it once using the Supabase SQL Editor; no paid IPv4 add-on or direct DATABASE_URL is required for normal API operation. See migrations/README.md. The current project's migration was applied by the team and checked through the HTTPS Data API.

Frontend obtains a Supabase Auth session, then sends its access_token as a bearer token to this service. The API verifies it using Supabase Auth, checks team membership, and performs normal database requests with the caller's JWT and publishable key. RLS and composite foreign keys enforce team isolation. The optional server secret key is used only for the zero-row schema-readiness probe and explicit administrative live-test setup; never send it to the frontend.

## Local agents and context

See LOCAL_AI.md. The only model transport is local Ollama via Node native fetch. No @google/genai, Google API key, or cloud fallback. One global queue serializes up to eight pending jobs. A squad run uses one to three assigned agents, up to three model rounds per agent and two tools per round. Tools list same-team squads and publish validated same-team findings. No shell or arbitrary web execution.

Team and party are synonymous. Players within a team share access to all its agents, squads, context, and results; other teams cannot inspect them. Each squad has independent note/result/handoff history. Model prompts use a bounded selection of its recent history, with provenance and untrusted-reference labels. Full history is retained in the database; automatic long-term summaries/vector search are not implemented.

See ../contracts/backend-api.md for routes, payloads, limits, errors, and Realtime integration guidance. Subscribe to authenticated INSERT/UPDATE events and refetch; avoid DELETE subscriptions for private team data. Hosted handoff delivery to an authorized teammate and outsider non-delivery passed the live smoke test; frontend subscription integration still needs verification.

## Verification

- `npm test`: Isolated API, runner, local HTTP transport, queue/context, and actual PostgreSQL RLS tests. No hosted writes or credentials required.
- `npm run build`: Strict source TypeScript compilation.
- `npm run smoke:live`: Explicit live integration check requiring a running API, Ollama, applied schema, and backend Supabase credentials. Creates three temporary admin-confirmed users without signup emails, checks shared access/outsider denial and real local inference, then removes those exact users and owned test data in finally. Run only against the intended development project.

A live local Gemma tool-call round trip and the complete Auth-to-result smoke flow have passed on the development machine. Temporary live-test data was cleaned up.

## Demo limitations

Use one backend process. The queue is in memory; restart does not resume queued work. After confirming interruption, team members can use the documented recover endpoint to mark an orphaned run failed and retry. It rejects runs still scheduled in this process. Do not use it against another active backend instance. No durable worker or live cancellation.

The model timeout is 90 seconds per call with a 180-second elapsed guard between steps. A request started near the budget can finish later before failure is reported; late results are not saved as successful output. Context paging uses an initial timestamp-only cursor with a documented equal-timestamp limitation.