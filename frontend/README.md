# Frontend

Owned by the two frontend teammates. Work on the `frontend` branch.

Planned stack: Next.js, React, TypeScript, Tailwind CSS, and shadcn/ui. This directory is a workspace boundary; the application has not been scaffolded yet.

Keep this application's package.json, lockfile, source, tests, and configuration inside this directory. Install and run its dependencies here, independently of the backend.

Connect to the backend over HTTP using NEXT_PUBLIC_API_BASE_URL. Keep Gemma credentials and privileged database keys out of this application. API payloads are coordinated in `../contracts/`.

Product boundaries: Party and player team mean the same thing. All players within a team share access to its agent pool, squads, context, tasks, and results. Other player teams cannot inspect them. Each agent squad has separate working context; explicit handoffs share context within the player team. See `../contracts/backend-api.md` for the implemented backend contract.

## Run with the backend

1. Backend: `cd backend && npm run dev` (needs Ollama with `gemma4:e2b`; see backend/LOCAL_AI.md). Check `http://127.0.0.1:4000/ready`.
2. Frontend: copy `.env.example` to `.env.local`, fill in the Supabase URL and **publishable** key, and set `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000`. Then `npm install && npm run dev` and open http://localhost:3000 (the backend allows only this origin by default).
3. Accounts: `cd backend && npm run demo:users -- player1 player2 rival` prints confirmed sign-in details without sending email.
4. Sign in, choose "Create team with event squads", share the invite code with a teammate, and launch the mission. Open a den to read that squad's private context, handoffs, and results. Signed-out visitors see the mock bears.
