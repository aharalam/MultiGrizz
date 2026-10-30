# MultiGrizz live demo runbook

Run everything on the prepared demo laptop (Ollama + `gemma4:e2b` installed, `backend/.env` and `frontend/.env.local` filled in). A full mission takes about 6–10 minutes on CPU, so **launch it at the start of the talk** and narrate while the squads work.

## 1. Before judges arrive (5 minutes)

1. **Start Ollama** (loopback, no cloud). In PowerShell:
   ```powershell
   $env:OLLAMA_NO_CLOUD='1'; $env:OLLAMA_HOST='127.0.0.1:11434'
   & "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" serve
   ```
   Leave this window open. Warm the model once in another window: `ollama run gemma4:e2b "Reply with: ready"`.
2. **Start the backend:** `cd backend`, then `npm run dev`. Open http://127.0.0.1:4000/ready and confirm `"model":{"ready":true}` and `"database":{"ready":true}`.
3. **Start the frontend:** `cd frontend`, then `npm run dev`. Open **http://localhost:3000** (exactly this address; the backend only accepts it).
4. **Create accounts:** `cd backend`, then `npm run demo:users -- player1 player2 rival`. Keep the printed emails and passwords handy.
5. **Prepare windows:** one normal Chrome window (player1), one Incognito window (player2), one other browser or profile (rival). Sign in to each at http://localhost:3000.
6. **Set up teams before the talk:**
   - player1: **Create team with event squads**. Copy the invite code shown in the panel.
   - player2: paste the code and click **Join**. Both now see the same three dens.
   - rival: **Create team with event squads** (a separate team).
7. Do **not** restart the backend once a mission is running; the queue is in memory and a restart drops it.

## 2. Live demo script (about 3 minutes of talking)

1. **Hook (player1 window):** "One brief, and a team of local AI agents plans the whole event."
2. **Launch:** the brief is pre-filled (networking event, 50 people, Dec 12, 6 PM, near Oakland University). Click **Launch mission**. The status chips show Venue → Promo → Logistics.
3. **Squads, not one agent:** point at the three dens. Each squad has several agents with their own roles:
   - **Venue Squad:** Event Manager, Scout, Budget Keeper
   - **Promo Squad:** Copywriter, Art Director
   - **Logistics Squad:** Scheduler, Event Manager
   The bars move as each agent takes its turn.
4. **Real research:** open the **Venue** den. Show the Scout's results: real venues from OpenStreetMap (e.g. Rochester Hills Civic Center, Fairfield Inn & Suites) and pages it read. "It says *unconfirmed* instead of inventing availability."
5. **Separate context and handoffs:** open the **Promo** den. "This squad never saw the venue research. It only got the handoff." Point at the orange **handoff from Venue Squad** entry with the decision. The flyer renders inside the panel; the invitation email uses a `{{recipients}}` placeholder and is marked DRAFT.
6. **Multiplayer:** switch to the player2 window. Same dens, same live progress: "teammates share everything inside their team."
7. **Isolation:** switch to the rival window. "A different team sees only its own squads; the fourth den is a private rival den." Nothing from player1's team appears.
8. **Final package:** when Logistics finishes, open its den: calendar invite text with a 24-hour reminder and the Event Manager's assembled package. Everything is a draft awaiting a player's approval; nothing is sent.
9. **Close:** "Everything ran on Gemma locally on this laptop: no cloud model, no API keys."

## 3. If something goes wrong

- **A squad shows `failed`:** the earlier squads' results stay visible in their dens; keep presenting them. Click **Launch mission** again to retry (it starts from the Venue Squad).
- **A squad is stuck on `running` after a backend restart:** that run was lost from memory. Create a fresh team with player1 and launch again.
- **Panel says "Sign in first" or shows request errors:** check http://127.0.0.1:4000/ready, then refresh the page.
- **Venue search is slow:** OpenStreetMap's main server rate-limits; the backend falls back automatically (adds about 12 s).
- **Backup for judges:** in a terminal, `cd backend`, then `npm run demo:mission` runs one complete mission from a temporary account and prints each squad's results, handoffs included.

## 4. Known limits (say these honestly if asked)

- One backend process with an in-memory queue; one mission runs at a time.
- The 2B model sometimes skips a handoff; the backend then forwards results with a visible `[automatic handoff]` label.
- Venue availability is rarely published online, so agents report it as unconfirmed.
- No emails are sent and nothing is booked: outputs are drafts for player approval.
