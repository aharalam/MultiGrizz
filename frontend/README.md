# Frontend

Owned by the two frontend teammates. Work on the `frontend` branch.

Planned stack: Next.js, React, TypeScript, Tailwind CSS, and shadcn/ui. This directory is a workspace boundary; the application has not been scaffolded yet.

Keep this application's package.json, lockfile, source, tests, and configuration inside this directory. Install and run its dependencies here, independently of the backend.

Connect to the backend over HTTP using NEXT_PUBLIC_API_BASE_URL. Keep Gemma credentials and privileged database keys out of this application. API payloads are coordinated in `../contracts/`.

Product boundaries: Party contains player teams. All players within a player team share access to its agent pool, squads, context, tasks, and results. Other player teams cannot inspect them. Each agent squad has separate working context; explicit handoffs share context within the player team.
