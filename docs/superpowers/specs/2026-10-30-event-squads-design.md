# Event-planning squads demo design

Approved in conversation on 2026-10-30. Extends the existing backend (`2026-10-30-backend-design.md`); all of its tenancy, local-model, and safety rules still hold.

## Intent

Show judges why agent **squads** matter: separate working contexts that cooperate only through explicit handoffs, inside one private player team. The scenario is planning a real event from a single brief. Players type the brief; the agents do all of the work; players watch and approve the outputs.

Demo brief: "Organize a networking event for 50 people on December 12 at 6 PM. Find an available venue, create a promotional flyer and video, invite 50 people by email with an add-to-calendar option, and set a reminder 24 hours before. If the venue is unavailable, find alternative dates and recommend the best option."

## Goals

- One brief starts a mission. Agents plan, research, create, and assemble without players adding data or nudging steps.
- Three squads, **each with multiple agents** working together, with separate squad context and cooperation across squads only through handoffs:
  1. **Venue Squad**: Event Manager (reads the brief, sets the plan and constraints), Scout (finds venues, prices, published availability; researches alternative dates), Budget Keeper (estimates costs, weighs alternatives, makes the venue recommendation and hands it off).
  2. **Promo Squad**: Copywriter (invitation email, promotional copy), Art Director (flyer designed as HTML/SVG and promo video storyboard, built on the Copywriter's text).
  3. **Logistics Squad**: Scheduler (calendar invite and 24-hour reminder), Event Manager (assembles and checks the final package).
- The Event Manager belongs to two squads and works with only that squad's context in each, which shows that context lives with the squad, not the agent.
- Inside a squad, agents take turns in their position order. Each agent's result is written to the squad's context before the next agent starts, so teammates build on each other's work.
- The Venue Squad uses **real web search**.
- Judge moment: when the first-choice venue is unavailable on December 12, the Venue Squad recommends an alternative, and the new date reaches Promo and Logistics only through a handoff. Their flyer, email, and invite carry the corrected details with no human fix-up.
- Isolation is visible: a second player team on another laptop cannot see this team's squads, context, or package.
- Final event package: venue recommendation with reasoning and cost, flyer, video storyboard, invitation email, `.ics` calendar invite, and 24-hour reminder.

## Non-goals

- No sending. Emails, invites, and reminders are drafts that a player approves; approval marks them approved and sends nothing.
- No booking or payment for venues.
- No generated images or video files. The team records the judging/YouTube demo video itself; agents produce only the promo video storyboard.
- No cross-team sharing, durable worker, or multi-instance deployment (unchanged).

## Anti-goals

- Fabrication presented as fact. If availability isn't published, the agent says "unconfirmed" instead of claiming the venue is free or booked.
- A mission that silently stalls. Every squad step shows queued/running/completed/failed, and failures are visible in the package.
- Agents following instructions found on web pages.

## Constraints

- Local Gemma only (`gemma4:e2b` via loopback Ollama; CPU on the demo laptop). No cloud inference. Web search is a tool call, not inference, and was approved for this demo.
- Existing per-run limits: at most 3 agents per run, 3 model rounds per agent, 2 tool calls per round, a single serialized queue. Missions must work inside them or raise them deliberately.
- Supabase migrations are applied by the team through the dashboard SQL Editor.
- Hackathon deadline 5:15 pm Eastern on 2026-10-30. Frontend integration comes later; this slice is backend plus contract.

## Decided by the user

- The event-planning scenario and three-squad structure above.
- Every squad has multiple agents; squads are the visible unit of the demo.
- Agents do all of the work, including real web search.
- Emails and calendar invites are ready-to-send drafts awaiting player approval.
- Flyer designed by an agent as HTML/SVG; video stays a storyboard; the team makes the YouTube video.

## Builder's calls (made by Claude, open to change)

- **Mission orchestrator.** A new `missions` record holds the brief and drives one full-squad run per squad in a fixed order: Venue → Promo → Logistics. Every run uses all of that squad's agents. The brief is posted into the Venue Squad's context as the mission's first note; Promo and Logistics start from handoffs only. A small 2B model is too unreliable to choose the next squad itself, so the backend sequences squads while agents do the work in each step.
- **Event Manager placement.** Moved into the Venue Squad as well as Logistics (user approved "Event Manager in Logistics"; this adds the kickoff role without a fourth squad). Claude's call.
- **Handoffs stay agent-made.** Agents publish handoffs with `share_finding`. If a step finishes without handing off to the next squad, the orchestrator forwards that step's result as a handoff labeled `automatic` so the mission continues and the label stays truthful.
- **Artifacts.** A new `save_artifact` tool stores typed outputs (`venue_recommendation`, `flyer_html`, `video_storyboard`, `invitation_email`, `calendar_invite`, `reminder`) linked to the mission, with status `draft` or `approved` and an approve endpoint.
- **Calendar file built in code.** The Scheduler supplies structured fields (title, start, end, timezone, location, description). The backend generates a valid `.ics` (with a 24-hour `VALARM`) so model formatting slips can't produce a broken file. The invitation email references the invite as its add-to-calendar option.
- **Recipients.** 50 invitees are a recipient-list placeholder (`{{recipients}}`) plus count. The agent does not invent real addresses.
- **Flyer safety.** Flyer HTML is stored as untrusted. The contract tells the frontend to render it in a sandboxed iframe with scripts disabled; the backend strips `<script>`, event-handler attributes, and external URLs before saving.
- **Team setup.** One endpoint creates the three squads and six agents with their role instructions for a team, so a fresh team can start the demo in one call.
- **Budgets.** Raise per-response output length for artifact-writing agents (flyer HTML needs more than 512 tokens) and size each mission step's time budget from timing measured on this laptop.

## Settled by Claude (user asked for no further setup work)

1. **Search with no keys or accounts.** `find_venues(location, kind)` queries OpenStreetMap's Overpass API for real event venues near a location. `read_page(url)` fetches a venue website as plain, length-capped, untrusted text. Venue Squad agents only. Outbound requests go only to those URLs over HTTPS, with no private/loopback addresses, a short timeout, and a size cap. Recorded responses are a fallback when the network fails, and the run says so.
2. **Availability handling.** When a venue's site doesn't confirm December 12, the squad treats the date as at risk. It recommends the best venue with a primary date and a researched backup date, and the handoff carries that decision. If the agents find the date confirmed unavailable, the alternative-date path runs in full. Either way, downstream squads use only what the handoff says.
3. **Runtime.** Built to run live. Timing measured on this laptop; if a full mission is too slow to watch, the team starts it shortly before judges arrive and walks through its live history.

## Acceptance

- Single brief → mission completes with all six artifacts, or a visible failure on the step that broke.
- Venue Squad context contains its search results; Promo Squad context does not, only the handoff.
- Changing the venue date in the Venue step carries through to the flyer, email, and `.ics` without edits.
- Outsider team gets 403/empty for mission, runs, context, and artifacts.
- Generated `.ics` imports into Google Calendar and Outlook with the reminder.
- Approving a draft changes only its status; nothing is sent.
- Existing 52 tests still pass; new behavior covered by isolated tests; one live mission run on this laptop recorded with timing.
