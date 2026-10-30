# MultiGrizz

A multiplayer workspace where human teams share a pool of local-AI agents, arrange them into squads, and pass findings between squad contexts.

Party and team mean the same thing. Every player in a team can inspect its agents, squads, context, and results. Other teams are isolated.

## Development

- `frontend/`: Independent Next.js app, owned by the frontend pair on `frontend`.
- `backend/`: Independent TypeScript/Fastify API, owned by the backend pair on `backend`.
- `contracts/backend-api.md`: Implemented HTTP API and multiplayer integration contract.
- `main`: Final integration branch. See CONTRIBUTING.md for merge workflow.

## Backend quick start

Requires Node.js 22+, Supabase configuration, and local Ollama with `gemma4:e2b` downloaded. Copy `backend/.env.example` to `backend/.env` and fill in the Supabase URL and keys. Apply `backend/migrations/001_initial.sql` once through the Supabase SQL Editor for a fresh project.

```powershell
cd backend
npm ci
npm run dev
```

API: http://localhost:4000. `/health` checks process liveness; `/ready` checks the local model and hosted schema. Tests: `npm test`. Build: `npm run build`. Production-style local run after build: `npm start`.

Gemma runs locally through Ollama; no Google API key or cloud inference fallback. Supabase stores shared application data remotely. See backend/LOCAL_AI.md and backend/README.md.

## Current scope

Team creation and invitation-code joining, shared agent definitions, squad assignments, structured note/result/handoff history, bounded local agent runs, team authorization, database RLS, and explicit interrupted-run recovery. Hosted Realtime handoff delivery and outsider isolation have been verified; frontend integration remains. This is a single-backend-process demo; its execution queue is not durable.

## Project instructions and credits

Agent setup and workflow instructions are in AGENTS.md and .agents/SETUP.md. Project-local third-party skill files and their licenses/attributions remain under .agents/ and .claude/. Workflow sources include Superpowers (obra/superpowers), Impeccable (pbakaus/impeccable), Grill Me (mattpocock/skills), Ponytail (DietrichGebert/ponytail), and Vercel agent-skills.

The deferred PantryGap proposal is in ideas/PantryGap.md.