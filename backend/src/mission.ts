import type { SupabaseClient } from '@supabase/supabase-js';
import type { OllamaClient } from './ollama.js';
import { executeRun } from './runner.js';
import { venueTools } from './webtools.js';

// Event-planning demo: three multi-agent squads. The Event Manager sits in two squads and
// sees only that squad's context in each. Squads share work only through handoffs.
const agents = {
  manager: { name: 'Event Manager', role: 'Coordinator', instructions: 'Coordinate the event. In the Venue Squad you go first: write only a short plan for your teammates (headcount, date, time, likely area, budget assumptions, what the Scout and Budget Keeper must decide). Do not call tools or claim any research results. In the Logistics Squad, assemble the final event package from the handoffs and teammates\' results: venue recommendation with date and cost, flyer, video storyboard, invitation email, calendar invite, and 24-hour reminder. Mark every email and invite as a DRAFT awaiting player approval. Flag anything missing or inconsistent.' },
  scout: { name: 'Scout', role: 'Venue researcher', instructions: 'Find real venues for the event. Call find_venues with the event area (default "Rochester Hills, Michigan" near Oakland University when the brief gives none). Pick the two or three most suitable for the headcount, then call read_page on a venue website to check capacity, pricing, and availability. Never invent facts: if a page does not confirm the requested date, say availability is unconfirmed. Report venue names, addresses, websites, what you verified, and two alternative dates near the requested one.' },
  budget: { name: 'Budget Keeper', role: 'Finance', instructions: 'Estimate the cost of each venue the Scout found for the given headcount, using any prices the Scout verified and clearly labeled estimates otherwise. Decide: recommend one venue and a date. If the requested date is unavailable or unconfirmed, recommend the requested date with a backup date, or the best alternative date. State venue, address, date, time, estimated cost, and why. Then share that decision with the Promo Squad and the Logistics Squad using share_finding with target_squad_id "Promo Squad", then again with "Logistics Squad".' },
  copywriter: { name: 'Copywriter', role: 'Marketing', instructions: 'Use only the venue decision from handoffs. Write the invitation email: subject line, body with event name, date, time, venue and address, a call to RSVP, and the line "Add to your calendar: [calendar invite attached]". Address it to {{recipients}} (50 guests); never invent email addresses. Also write a 24-hour reminder email. Mark both as DRAFT for player approval.' },
  artist: { name: 'Art Director', role: 'Creative', instructions: 'Use the venue decision from handoffs and the Copywriter\'s text. Design a promotional flyer as one self-contained HTML snippet with inline CSS only (no scripts, no external images or fonts): headline, date, time, venue, address, and RSVP line. Then write a promo video storyboard of 5 to 6 shots, each with visual, on-screen text, and voiceover, about 30 seconds total. Share the event details you used with share_finding, target_squad_id "Logistics Squad".' },
  scheduler: { name: 'Scheduler', role: 'Scheduling', instructions: 'Use only the venue decision from handoffs. Produce calendar invite details: title, start and end in America/Detroit time (assume two hours long unless told otherwise), location with address, and description. Then give an iCalendar (.ics) VEVENT text with a VALARM 24 hours before (TRIGGER:-PT24H), and state when the reminder email should go out. Mark it as DRAFT for player approval.' },
} as const;

export const eventSquads = [
  { key: 'venue', name: 'Venue Squad', goal: 'Find a real, available venue and date for the event within budget, then hand the decision to Promo and Logistics.', members: ['manager', 'scout', 'budget'] },
  { key: 'promo', name: 'Promo Squad', goal: 'Create the invitation email, flyer, and promo video storyboard from the venue decision.', members: ['copywriter', 'artist'] },
  { key: 'logistics', name: 'Logistics Squad', goal: 'Create the calendar invite and 24-hour reminder, then assemble the complete event package.', members: ['scheduler', 'manager'] },
] as const;

type Checked = <T>(result: { data: T; error: { code?: string } | null }) => T;

export async function createEventSquads(db: SupabaseClient, teamId: string, checked: Checked) {
  const created: Record<string, any> = {};
  for (const [key, agent] of Object.entries(agents)) {
    created[key] = checked(await db.from('agents').insert({ ...agent, team_id: teamId }).select().single());
  }
  const squads: Record<string, any> = {};
  for (const squad of eventSquads) {
    squads[squad.key] = checked(await db.from('squads').insert({ team_id: teamId, name: squad.name, goal: squad.goal }).select().single());
    for (const [position, member] of squad.members.entries()) {
      checked(await db.from('squad_agents').insert({ team_id: teamId, squad_id: squads[squad.key].id, agent_id: created[member].id, position }).select().single());
    }
  }
  return { agents: Object.values(created), venue_squad_id: squads.venue.id, promo_squad_id: squads.promo.id, logistics_squad_id: squads.logistics.id };
}

export type MissionSteps = { venue: string; promo: string; logistics: string };

const stepGoals = {
  venue: 'Plan the venue for this event brief (it is in squad context): research real venues, verify what you can, and decide the venue and date. Hand the decision to the Promo Squad and the Logistics Squad.',
  promo: 'Using the venue decision handed to this squad, write the invitation email and reminder, design the flyer, and storyboard the promo video. Where the venue decision changes the date or place in the brief, the venue decision wins.',
  logistics: 'Using the handoffs, create the calendar invite with a 24-hour reminder, then assemble the complete event package for player approval. Where the venue decision changes the date or place in the brief, the venue decision wins.',
};
// Venue output feeds both downstream squads; Promo output feeds Logistics for assembly.
const forwards: Record<keyof MissionSteps, Array<keyof MissionSteps>> = { venue: ['promo', 'logistics'], promo: ['logistics'], logistics: [] };

// Runs one squad after another inside a single queue job. Agents make their own handoffs;
// when a step finished without one, its results are forwarded as a labeled automatic handoff.
export async function runMission({ db, teamId, userId, brief, steps, model, track }: {
  db: SupabaseClient; teamId: string; userId: string; brief: string; steps: MissionSteps; model: OllamaClient;
  track: (runId: string, active: boolean) => void;
}): Promise<void> {
  for (const key of ['venue', 'promo', 'logistics'] as const) {
    const squad = (await db.from('squads').select('*').eq('team_id', teamId).eq('id', steps[key]).single()).data;
    const assignments = (await db.from('squad_agents').select('agent_id,position,agents(*)').eq('team_id', teamId).eq('squad_id', steps[key]).order('position').limit(4)).data ?? [];
    if (!squad || !assignments.length || assignments.length > 3) return;
    const run = (await db.from('runs').insert({ team_id: teamId, squad_id: steps[key], created_by: userId, goal: `${stepGoals[key]}\nBrief: ${brief}`.slice(0, 2000), status: 'queued' }).select().single()).data;
    if (!run) return;
    track(run.id, true);
    try {
      await executeRun({ db, run, squad, agents: assignments.map((assignment: any) => assignment.agents), model, budgetMs: 420000, ...(key === 'venue' ? { extraTools: venueTools } : {}) });
    } finally { track(run.id, false); }
    const finished = (await db.from('runs').select('status').eq('team_id', teamId).eq('id', run.id).single()).data;
    if (finished?.status !== 'completed') return;
    const entries = (await db.from('context_entries').select('kind,squad_id,content').eq('team_id', teamId).eq('run_id', run.id).order('created_at')).data ?? [];
    const results = entries.filter((entry: any) => entry.kind === 'result').map((entry: any) => entry.content).join('\n\n');
    for (const target of forwards[key]) {
      if (entries.some((entry: any) => entry.kind === 'handoff' && entry.squad_id === steps[target])) continue;
      await db.from('context_entries').insert({ team_id: teamId, squad_id: steps[target], source_squad_id: steps[key], kind: 'handoff', run_id: run.id, created_by: userId,
        content: `[automatic handoff: ${squad.name} results]\n${results.slice(-3800)}` });
    }
  }
}
