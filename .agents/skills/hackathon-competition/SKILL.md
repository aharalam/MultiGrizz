---
name: hackathon-competition
description: Research an arbitrary hackathon, challenge project ideas, choose and protect a competition MVP, and prepare judging, demo, pitch, and submission. Use for hackathon strategy and material competition decisions, not routine engineering or generic UI design.
---

# Hackathon Competition Strategy

Optimize for the strongest feasible, polished, reliable competition submission in the time remaining. The coding agent is the orchestrator. This skill owns competition decisions, not general engineering workflow.

## Start with evidence, not a questionnaire

A name or URL is enough to start. Read `AGENTS.md` and `.hackathon/{BRIEF,PLAN,STATE}.md`; inspect supplied files and repository context. Research official event, rules, judging, sponsor, schedule, and submission sources before asking the team. Use native research subagents for independent questions when useful; return short findings with source links. Ask only about missing information that materially affects the next decision, and batch non-urgent questions. Keep meaningful uncertainty marked `CONFIRMED`, `INFERRED`, or `UNKNOWN`; missing low-priority facts do not stop progress. Never invent rules, weights, prizes, or API access.

## Understand the competition

Capture only decision-relevant facts in `BRIEF.md`: event and official sources; deadline and judging format; eligibility, team and prohibited-work rules; tracks, rubric and any actual weights; sponsor challenges and prizes; APIs, SDKs, data, credits and workshops; required technology; submission and demo requirements. Check current time and remaining time when planning. Preserve a few direct source links rather than a research dump. Escalate disqualification risks and material deadline uncertainty promptly.

When announcements, sponsor talks, Discord posts, or organizer clarifications change facts, update `BRIEF.md`, state confidence/source, assess strategic impact, and tell the team about material implications. Do not silently pivot an approved product.

## Challenge before choosing

Treat a proposed idea as a hypothesis. Test its user pain, need for software or AI, novelty, technical interest, rubric fit, natural track or sponsor fit, likely competing submissions, feasibility, external dependencies, and memorable demo moment. Push back with evidence and suggest a sharper version or alternatives when warranted. Do not flatter or argue for sport. Use the actual rubric; never invent universal scoring weights.

After research and an initial idea or shortlist, offer one optional **Grill Me** session if a consequential choice or assumption remains unresolved and there is time to examine it. Name the specific decision and why an interview could change the MVP recommendation; let the team accept the session or choose now. Skip the offer when the direction is clear, the team declines, or protecting the demo and submission matters more. New material information can justify a fresh offer.

If the team accepts or requests Grill Me, read and follow `.agents/skills/grilling/SKILL.md` directly, using the facts and rubric in `BRIEF.md`. Research discoverable facts yourself; ask the team to decide strategic choices. Keep the interview focused on the unresolved idea decision. After the team confirms shared understanding, record useful conclusions in `BRIEF.md`, then present the competition MVP for its separate approval. Do not start the interview merely because an event name or URL was supplied.

Define a **competition MVP**: the smallest feasible product that convincingly shows value, differentiation, and technical achievement to judges. Present the core demo; must, should, could, and do-not-build scope; core technical achievement; judge-facing story; largest risks. Get human approval before substantial implementation, then record the approved product in `BRIEF.md`.

## Plan for a working demo

Bring competition constraints into technical planning: time, required technology, sponsor opportunities, judge-visible value, reliability, and demo format. Let Superpowers or native engineering capability handle detailed architecture and execution. Prefer the simplest architecture that can deliver the demo. Show major stack choices, integrations, core UX flow, vertical demo slices, and risks; get team approval of that major direction before substantial implementation. Record its short summary in `PLAN.md`.

Build vertical slices that each connect UI to logic/integration to a visible result when practical. Keep the primary agent responsible for integration. Use native subagents for independent research, unfamiliar APIs, code/security review, or UI critique when their benefit exceeds coordination cost; avoid simultaneous writes to coupled files. Use Impeccable during UI development, Vercel web guidelines for relevant web review, and React Best Practices only for a React/Next.js project.

For substantial new scope, ask whether it is needed for the core demo, materially advances an actual criterion or differentiator, removes a serious demo risk, and can be built and verified safely in the time left. Recommend against low-value additions. As the deadline approaches, shift from exploration to integration, reliability, polish, and submission. Recommend feature freeze once the core demo works and more scope threatens it.

## Compete with what actually works

Audit each important rubric criterion: where is it satisfied, visible to judges, demonstrated, explained, and accurately represented in the submission? Shape the demo to the actual format: problem, why it matters, solution, live product, technical achievement, impact/differentiator. Protect the strongest moment.

Check realistic demo failures: API/model latency or outage, malformed output, network/auth/rate limits, cold starts, deployment, and missing demo data. Add only proportionate protection and an honest fallback. After feature freeze, prioritize critical fixes, UI and responsive polish, loading/failure/success states, realistic data, deployment, pitch, and required assets.

Prepare accurate project name/one-liner, submission text, README, architecture explanation, demo script, screenshots/video and links when required. Do not claim unbuilt features. Before submission or judging, present final demo flow, pitch structure, known risks, fallback, and submission state for human approval.

## Keep the handoff small

Maintain `BRIEF.md` for competition/product truth, `PLAN.md` for major technical direction, and `STATE.md` for the current working state. Update them routinely as work proceeds. Another agent should be able to resume from those files and Git without this conversation. Process is proportional: a copy fix can be direct; a core pipeline deserves planning and verification; an architecture pivot deserves renewed human approval.
