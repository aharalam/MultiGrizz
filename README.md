# GrizzHacks Oakland University

Active project: A multiplayer Gemma-powered agent ecosystem. Player teams share their own agents and context, isolated from other player teams.

Development is split into independent [`frontend/`](frontend/README.md) and [`backend/`](backend/README.md) applications, with [`contracts/`](contracts/README.md) for their shared API. See [CONTRIBUTING.md](CONTRIBUTING.md) for branch ownership and the final merge workflow. Application code is not scaffolded yet.

A small repository operating system for building stronger hackathon submissions with Codex or Claude Code. It layers competition strategy over established engineering and design skills. It is a set of Markdown instructions, project-local skills, and Git history, not a SaaS product or agent runtime.

## How it works

The primary coding agent researches the competition, challenges ideas, integrates the product, and keeps the repo current. The custom [Hackathon Competition Strategy](.agents/skills/hackathon-competition/SKILL.md) skill owns competition decisions. [Matt Pocock's Grill Me](https://github.com/mattpocock/skills) can deepen a consequential idea decision when the team opts in. [Superpowers](https://github.com/obra/superpowers) supplies general engineering workflows. [Ponytail](https://github.com/DietrichGebert/ponytail) helps choose simpler code during relevant implementation or review. [Impeccable](https://github.com/pbakaus/impeccable) supplies design direction, UI critique, and polish. [Vercel web-design-guidelines](https://github.com/vercel-labs/agent-skills) supplies web UX and accessibility review. Native subagents can handle independent research or review; the primary agent normally owns writes and integration.

Three small files preserve project truth:

| File | Purpose |
| --- | --- |
| [BRIEF.md](.hackathon/BRIEF.md) | Competition facts, sources, uncertainty, approved product and MVP |
| [PLAN.md](.hackathon/PLAN.md) | Major architecture, integrations, demo slices, risks |
| [STATE.md](.hackathon/STATE.md) | What works now, blockers, next action, latest verification |

Git records implementation history. The team approves three strategic decisions: competition MVP, major architecture/demo plan, and final judge-facing demo/submission. Routine research, edits, and state updates do not need a gate. Process stays proportional to the task.

## First-time setup after cloning

**Open the clone in Codex or Claude Code and give the agent your task.** `AGENTS.md` (via `CLAUDE.md` in Claude Code) directs the agent to run the [first-use setup](.agents/SETUP.md) automatically before substantial work. There is no separate bootstrap command or setup form. This also works after exporting the files into a fresh event repository.

The competition, Grill Me, Ponytail, Impeccable, and Vercel skills are committed with the repository. The agent checks their entry points and active discovery without reinstalling them, and creates Claude Code's ignored local Impeccable hook manifest when needed. **Superpowers is profile-level**: the agent checks the active harness, installs it from the official marketplace through the supported CLI if missing, and verifies it. A sandbox-restricted plugin listing does not count as proof that it is absent. Installing a plugin may require a new agent session before its skills appear.

The agent asks you directly in the conversation for each step it cannot perform, waits for your reply, and verifies completion. In particular, if it cannot confirm Codex hook approval, it prompts you to run `/hooks`; it does not leave that step in a checklist for you to notice later. Manual actions may include:

- **Codex plugin fallback:** Open **Plugins â†’ Superpowers â†’ +** in the app, or find Superpowers under `/plugins` in Codex CLI. Start a new chat after installation.
- **Claude Code plugin fallback:** Run `/plugin install superpowers@claude-plugins-official`, then start a new session.
- **Codex Impeccable hook:** Open `/hooks` and approve this repository's hook when prompted. Hook trust cannot be automated safely.

Setup checks are idempotent and target only the agent you are using. Git cloning does not execute commands by itself; the setup starts when an agent opens the repository.

## Start a hackathon

Open this repository in Codex or Claude Code and say:

> We're at Hack Dearborn. Here's the official website: [URL]. Here are the materials they gave us: [files/links/screenshots]. Research the competition first, then help us decide what to build.

The agent should research official sources, update `BRIEF.md`, flag only decision-relevant unknowns, and challenge ideas. If a consequential idea choice remains unresolved, it makes one specific, optional Grill Me offer. Accepting starts a focused interview; declining lets the agent recommend a direction immediately. An event name or URL alone does not trigger an interview. The agent then proposes a competition MVP and seeks team approval. It plans a simple architecture and vertical demo slices, seeks approval of the major direction, builds and verifies them, maintains `PLAN.md` and `STATE.md`, protects the working demo, and prepares judging and submission.

For another Codex session, or a teammate using Claude Code: pull the repo, read `AGENTS.md` (Claude enters through `CLAUDE.md`), then `BRIEF.md`, `PLAN.md`, and `STATE.md`. No chat transcript is needed. Commit working checkpoints when useful.

## Skills and setup

The canonical competition skill is `.agents/skills/hackathon-competition/SKILL.md`. The tiny Claude entry point under `.claude/skills/` points to it; it does not duplicate the strategy. [Agent-run setup](.agents/SETUP.md) is a short operating procedure, not a second strategy skill or custom runtime.

Grill Me is optional during idea selection, after competition research. The agent should explain which unresolved choice the interview would clarify and ask once whether the team wants it. If accepted, it loads [`grilling`](.agents/skills/grilling/SKILL.md) directly so no special command is required; the [`grill-me` entry point](.agents/skills/grill-me/SKILL.md) remains available when a teammate asks for it explicitly. Both skill entry points are set to explicit activation in Codex and Claude Code, so an offer alone does not launch the interview. Both original skills come from Matt Pocock's repository and are preserved as `UPSTREAM.md`; thin project entry points provide cross-harness invocation. Only confirmed strategic conclusions go into `BRIEF.md`, and MVP approval remains a separate team decision. Skip the interview when the direction is clear or demo time is at risk.

Ponytail is project-local and needs no teammate install. Its [scoped entry point](.agents/skills/ponytail/SKILL.md) loads the unchanged [upstream skill](.agents/skills/ponytail/UPSTREAM.md) only for a bounded implementation or code review with a real simplification choice. `AGENTS.md` prompts the primary agent to select it when relevant; the Claude skill entry point points to the same source. The full upstream plugin's always-on hooks are intentionally absent. If you have the full Ponytail plugin enabled in your personal profile, disable it for this project to preserve selective use. Automatic selection is agent-driven rather than a hard runtime switch, so use `$ponytail` in Codex or `/ponytail` in Claude Code if an agent misses a relevant case.

| Capability | Source | Installation in this repository |
| --- | --- | --- |
| Superpowers | [obra/superpowers](https://github.com/obra/superpowers) | Profile-level plugin. The first-use agent procedure checks availability and installs it for the active harness when missing; plugin UI is the fallback. |
| Grill Me + grilling | [mattpocock/skills](https://github.com/mattpocock/skills) | Only the two dependent skills installed project-locally from commit `d81f3a1` with Codex's skill installer. Available to Codex and Claude Code; no full skill collection or extra install step. |
| Ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | Original `skills/ponytail/SKILL.md` installed at upstream commit `a322c2e` using Codex's skill installer, kept unchanged as `UPSTREAM.md`, and exposed through narrow project-local Codex/Claude entry points. No always-on plugin or hooks. |
| Impeccable | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Installed project-locally for Codex and Claude with `npx impeccable install -y --providers=codex,claude --scope=project`. First-use setup creates Claude's ignored local hook manifest if needed; in Codex, open `/hooks` and approve the committed project hook. Once a product is chosen, run `/impeccable init` (or `$impeccable` in Codex) to establish its own design context. |
| web-design-guidelines | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) via [vercel-labs/skills](https://github.com/vercel-labs/skills) | Installed project-locally for Codex and Claude with `npx skills add vercel-labs/agent-skills --skill web-design-guidelines -a codex -a claude-code -y`. |
| React Best Practices | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Not installed. Add only if the actual project selects React or Next.js. |

The project-local third-party skill files and Vercel `skills-lock.json` are committed for teammates. Impeccable's runtime cache and downloaded platform binaries are ignored. Restart the harness after installing skills; check Codex `/skills` or Claude's skill list to confirm discovery. If the skill is not visible, investigate before relying on it.

## Boundaries

Use existing skills for software engineering, visual design, and web guidelines. The custom skill handles only hackathon competition strategy. Native subagents are temporary helpers, not a custom orchestration system. There is no dashboard, memory server, RAG system, agent swarm, or framework to operate at hour 18.
