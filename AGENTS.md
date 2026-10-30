# Project operating contract

**This project workflow exists to reduce coordination overhead, not create it. Planning, documentation, delegation, and verification must be proportional to the size and risk of the task. If following the process would take longer than safely completing a small obvious task directly, do the task directly.**

When first opening this checkout in a coding agent, **run the agent-led setup in `.agents/SETUP.md` automatically**, then continue the user's task. Repeat its quick checks in later sessions; it installs only missing capabilities for the active harness and prompts the human only for unavoidable interactive steps. A clone itself cannot run setup. At the start of substantial work, read this file and `.hackathon/BRIEF.md`, `.hackathon/PLAN.md`, and `.hackathon/STATE.md`. Treat these files as the durable project brain; keep them concise and current without asking the team to maintain forms. Git records implementation history. Never invent competition facts or product capabilities.

Use `.agents/skills/hackathon-competition/SKILL.md` for competition research, idea challenge, MVP scope, time-aware decisions, judging, demo, and submission.

During idea selection, offer a focused Grill Me session only when a material choice remains unresolved after research. Start it only if the team accepts or requests it; follow the project-local `grilling` skill directly. This optional interview informs the MVP gate and does not replace competition analysis or run alongside Superpowers brainstorming.

Follow `.agents/SETUP.md` for first-use installation and verification. Do not delegate routine setup to the human when the active agent can do it with normal tool permissions. **Prompt the human directly for every unavoidable manual action**, especially Codex `/hooks` approval, and verify their completion; continue independent work while waiting.

Use Superpowers for engineering planning, implementation, debugging, verification, and review when proportionate. Use Impeccable throughout judge-facing UI work and its own `init`/project-context workflow when installed. Use Vercel `web-design-guidelines` for relevant web UI review; install React Best Practices only if the chosen project uses React or Next.js. Apply the most relevant specialist skill where they overlap, while preserving competition constraints.

For a bounded implementation or code review with a meaningful choice among existing code, standard library, native platform features, dependencies, or abstractions, proactively use `.agents/skills/ponytail/SKILL.md`. Return to normal guidance when that task ends. Skip Ponytail for tiny obvious edits, competition/product decisions, UI direction, prose, demo, and submission work. It may simplify implementation, but must preserve the approved MVP, judge-facing quality, demo reliability, and proportionate verification.

The primary agent owns integration. Use native subagents when independent research or review adds value. **Parallelize thought aggressively. Parallelize writes conservatively.** Prefer one writer for coupled files. Do small clear tasks directly.

Before substantial product implementation, obtain team approval for (1) the competition MVP and (2) the major architecture and demo plan. Before submission or judging, obtain approval for the final demo, pitch, risks, and fallback. These are strategic gates, not permission for routine edits. Meaningful new competition information updates `BRIEF.md`; major pivots require human judgment.

Build vertical working demo slices. Protect the working demo as time runs down. Keep `STATE.md` useful to a fresh agent: what works, what is broken, and what happens next. Update `PLAN.md` when major technical direction changes; do not copy detailed Superpowers plans into it.
