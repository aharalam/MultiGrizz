# Implementation plan

- Active direction: Multi-agent, multiplayer agentic ecosystem, selected by the team. PantryGap is parked in `ideas/PantryGap.md`.
- Repository architecture: Team requested one GitHub repository with independent `frontend/` and `backend/` applications, work branches `frontend` and `backend`, and eventual integration into `main`. API agreements live in `contracts/`. See CONTRIBUTING.md.
- Proposed stack: Next.js/React/TypeScript frontend; standalone Node.js/TypeScript backend with local Gemma via Ollama HTTP API, Zod, and Supabase. Local inference is explicitly required by the team; no Google API key or silent cloud fallback. Separate backend replaces the earlier Next.js Route Handler suggestion. Application framework setup is not implemented.
- Context hierarchy: Team and party are synonyms. One player team owns agents and squads; its players can inspect all team data. Squads maintain distinct working contexts and share explicit handoffs. Other player teams are isolated. No separate parties table.
- Components, data flow, integrations, AI architecture, persistence, deployment: Not selected.
- Major technical decisions and risks: Not selected.
- Vertical demo slices and implementation order: Not selected.
- UI direction and core UX flow: Not selected.
- Architecture/demo plan approval: Pending product selection.

Keep this a short, current project strategy; use engineering skills for detailed plans.
