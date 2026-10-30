# PantryGap

Status: Saved for a future build. Not the active project. No product code, integration, or user validation has been completed.

## Concept

Help food pantry volunteers turn available donations into usable meal kits and identify the missing donation that would make existing stock more useful.

Core question: **What should someone donate next to make this pantry's existing stock more useful?**

The hypothesis is that usefulness depends on combinations, quantities, and preparation equipment, beyond the number of donated items. A pantry could have plenty of ingredients but lack the complementary items or equipment needed by its shoppers. This workflow need still requires validation with pantry staff.

Primary user: A pantry volunteer or inventory coordinator. A later donor view could communicate a verified, current donation priority.

## Research and local connection

Research was gathered during GrizzHacks project selection on October 30, 2026. Recheck these sources before building; do not treat this file as current operating guidance.

- [Golden Grizzlies Pantry](https://www.oakland.edu/osi/pantry/) lists can openers, microwaveable meals, and dietary options among in-demand items. It provides free resources and permits anonymous checkout. These facts support exploring practical usability and preserving shopper privacy.
- [OU and Forgotten Harvest distribution process project](https://www.oakland.edu/thisisou/secs/2024/ous-pawley-lean-institute-partners-with-forgotten-harvest-to-improve-process-of-addressing-food-insecurity/) documents efforts to improve how agencies obtain and distribute food. This is evidence of operational needs, not proof that this particular app is needed.
- No live pantry inventory, staff interview, partnership, or endorsement was obtained. Sample inventory must be clearly labeled as illustrative.

The public [GrizzHacks 8 listing](https://grizzhacks-8.devpost.com/) included AI/ML, Social Good, and Hell's Kitchen tracks. These suggested possible thematic alignment, but that March event's schedule conflicted with the team's current context. No track eligibility or judging advantage was confirmed. The team required Gemma and reported a 5:15 pm deadline; those were constraints of the original discussion, not requirements for a future build.

## Why Gemma belongs in the product

Use Gemma to interpret unstructured information:

- Extract item names, quantities, and units from messy pasted donation lists.
- Interpret preparation constraints such as microwave-only access.
- Explain why a reviewed kit is blocked and what an additional donation changes.
- Optionally read donation-list or label photos after the text flow is reliable.

Volunteers confirm the extracted inventory before calculations run. Unknown quantities, ambiguous units, and uncertain item identities require clarification rather than guessed stock.

Use deterministic application code for quantities, kit feasibility, stock consumption, and before/after comparisons. Use a small set of reviewed meal-kit templates. Gemma must not invent inventory, calculate unsupported impact claims, or certify dietary or allergen safety.

An implementation option researched at the time was hosted Gemma through the [Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api), with explicit Gemma model IDs such as `gemma-4-26b-a4b-it`. The transport name does not make a Gemma model Gemini. Access, quota, latency, and model availability were not tested. Another option was local Ollama with `gemma3:4b`; download size, laptop capacity, and latency need checking. Offline operation and privacy are benefits only if actually implemented and verified.

## Proposed MVP

1. One inventory screen: paste a donation list, run Gemma extraction, review and edit the structured result.
2. Select preparation constraints, initially a small explicit set such as microwave-only or no cooking equipment.
3. Evaluate a few reviewed kit templates against confirmed stock and constraints.
4. Show feasible kits, quantities, and the specific missing items or equipment blocking others.
5. Let the volunteer simulate adding a donation and compare feasible kits before and after.

The centerpiece is the **What donation helps most?** comparison, with calculations visible and explainable.

Shared inventory must not be counted toward multiple kits simultaneously. Define whether results are separate template scenarios or one jointly feasible allocation. State assumptions about package sizes, servings, equipment availability, and reusable equipment. A can opener is not consumed like an ingredient; its availability needs a different rule.

## Scope priorities

- Must: Real Gemma transformation; editable inventory; reviewed templates; quantity checks; preparation constraints; donation comparison; labeled sample data; understandable loading, error, and success states.
- Should: Explain each bottleneck and show evidence for extracted fields; export a short donation-priority summary.
- Could: Photo input, donor-facing view, persistence, multilingual explanations, local inference.
- Do not build for the first demo: Accounts, marketplace, delivery logistics, payments, broad pantry integrations, model training, unrestricted recipe generation, automated purchasing, or nutritional optimization claims.

## Demonstration

1. Introduce a clearly labeled sample inventory with a plausible missing complement.
2. Paste messy notes and show Gemma turning them into editable stock records.
3. Confirm the records and choose microwave-only preparation.
4. Show what can be assembled and which template is blocked, including the calculation.
5. Add the missing item in the simulator and show the verified increase in feasible kits.
6. Explain the division of work: Gemma understands the messy input; application rules verify the impact.

Choose the sample and template together so the result is reproducible. Do not promise a particular increase until the quantities have been checked. An equipment example can illustrate why raw food counts alone are insufficient, but only if the equipment rule matches the real use case.

Pitch direction: Help donors and volunteers turn what is already on the shelf into food people can actually use. Lead with the missing-item comparison and a local problem, rather than a generic AI recipe generator.

## Proposed technical direction

No architecture was selected or approved. A small web app with one server-side Gemma endpoint and a pure kit-calculation module was the simplest direction discussed in principle. Store API keys server-side. Start with explicit sample stock and reviewed templates; add persistence only if needed for the validated workflow.

For the original roughly three-hour window, the proposal was to complete one real model-powered flow, the deterministic comparison, and a polished demo, then reserve the last 45 minutes for verification and presentation. Replan against the actual future schedule.

## Risks and validation

- Workflow fit: Ask a pantry volunteer whether identifying combinations and missing items consumes meaningful time, how inventory is recorded, and whether a donation recommendation would be actionable.
- Differentiation: Compare existing pantry inventory and recipe tools before claiming novelty. The proposed differentiator is donation impact under real stock and preparation constraints.
- Data quality: Confirm units and amounts. Distinguish missing data from zero stock.
- Feasibility: Test actual Gemma access and latency early. Keep a saved, honestly labeled example response for explaining the flow during an outage; never present cached output as a live inference.
- Food suitability: Reviewed templates and verified labels are needed; the model cannot establish allergen safety, food condition, or suitability from an incomplete list.
- Impact: Feasible kits are a planning estimate, not proof of meals served or nutritional completeness.
- Privacy: Avoid requiring shopper identities or personal histories for the MVP. Hosted inference does not provide local-only privacy.

## Resume checklist

1. Validate the volunteer's problem and data availability.
2. Choose the smallest useful kit/constraint scenario and success measure.
3. Test one actual Gemma request.
4. Agree on MVP, allocation rules, architecture, and demo.
5. Build inventory confirmation through to the donation comparison as one complete flow.
6. Verify stock conservation, quantities, ambiguous input, equipment constraints, and model failures; then polish the presentation.

## Decision history

The team preferred PantryGap during idea selection, then explicitly parked it for a future build and chose a multi-agent, multiplayer agentic ecosystem as the current direction. This file preserves the proposal; it is not an instruction to resume implementation automatically.
