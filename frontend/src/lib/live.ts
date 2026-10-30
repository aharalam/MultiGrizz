"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { api, supabase, type ApiAgent, type ApiEntry, type ApiRun, type ApiSquad, type ApiTeam } from "./backend";
import { DEN_STYLES, type Agent, type Costume, type Role, type Team } from "./teams";

// Live squads from the backend, shaped like the mock teams so BearWorld/SquadBar stay unchanged.
// Dens 0-2 are this player team's squads; den 3 stands for a rival team whose squads stay private.
export type SquadView = { squad: ApiSquad; agents: ApiAgent[]; run?: ApiRun; entries: ApiEntry[] };

const ART = ["bruno", "honey", "kodi", "ursa", "blizzard", "floe", "aurora", "tundra", "mochi", "bao", "lin", "shadow"];
const COSTUMES: Costume[] = ["vampire", "witch", "frankenstein", "skeleton", "mummy", "ghost", "wizard", "pirate"];
const ORDER = ["Venue Squad", "Promo Squad", "Logistics Squad"];

function roleOf(role: string): Role {
  const r = role.toLowerCase();
  if (r.includes("research") || r.includes("finance")) return "researcher";
  if (r.includes("creative")) return "coder";
  if (r.includes("marketing")) return "writer";
  return "planner";
}

function agentView(agent: ApiAgent, index: number, view: SquadView, seed: number): Agent {
  const run = view.run;
  const done = new Set(view.entries.filter((e) => e.kind === "result" && e.run_id === run?.id).map((e) => e.content.slice(1, e.content.indexOf(" |"))));
  const base = { id: `${view.squad.id}-${agent.id}`, name: agent.name, role: roleOf(agent.role), costume: COSTUMES[(seed + index) % COSTUMES.length],
    description: agent.instructions.split(". ")[0] + ".", art: `/bears/${ART[(seed + index) % ART.length]}.png` };
  if (!run) return { ...base, status: "idle", progress: 0, activity: "Waiting for a mission" };
  if (run.status === "completed" || done.has(agent.name)) return { ...base, status: "done", progress: 100, activity: run.status === "completed" ? "Handed off results" : "Finished, teammates working" };
  if (run.status === "failed") return { ...base, status: "idle", progress: 0, activity: "Run failed, launch again" };
  if (run.status === "queued") return { ...base, status: "idle", progress: 5, activity: "Queued for the local model" };
  const firstOpen = view.agents.findIndex((a) => !done.has(a.name));
  if (index !== firstOpen) return { ...base, status: "idle", progress: 10, activity: "Waiting for a teammate" };
  const elapsed = (Date.now() - Date.parse(run.updated_at)) / 1000;
  return { ...base, status: agent.role === "Venue researcher" ? "tool" : "thinking", progress: Math.min(92, 15 + elapsed / 2), activity: agent.role === "Venue researcher" ? "Searching real venues" : "Thinking with local Gemma" };
}

export function useLive() {
  const [session, setSession] = useState<Session | null>(null);
  const [team, setTeam] = useState<ApiTeam | null>(null);
  const [needsTeam, setNeedsTeam] = useState(false);
  const [views, setViews] = useState<SquadView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  // Pick the player's first team once signed in.
  useEffect(() => {
    if (!session) { setTeam(null); setViews([]); return; }
    api<ApiTeam[]>("/teams").then((teams) => { setTeam(teams[0] ?? null); setNeedsTeam(!teams.length); }).catch((e) => setError(e.message));
  }, [session]);

  const refresh = useCallback(async () => {
    if (!team) return;
    const squads = (await api<ApiSquad[]>(`/teams/${team.id}/squads`)).filter((s) => ORDER.includes(s.name))
      .sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name)).slice(0, 3);
    const next = await Promise.all(squads.map(async (squad) => {
      const [detail, runs, entries] = await Promise.all([
        api<{ agents: Array<{ agents: ApiAgent }> }>(`/teams/${team.id}/squads/${squad.id}`),
        api<ApiRun[]>(`/teams/${team.id}/squads/${squad.id}/runs`),
        api<ApiEntry[]>(`/teams/${team.id}/squads/${squad.id}/context?limit=100`),
      ]);
      return { squad, agents: detail.agents.map((a) => a.agents), run: runs[0], entries };
    }));
    setViews(next);
    setError(null);
  }, [team]);

  useEffect(() => {
    if (!team) return;
    refresh().catch((e) => setError(e.message));
    const id = setInterval(() => refresh().catch((e) => setError(e.message)), 3000);
    return () => clearInterval(id);
  }, [team, refresh]);

  const createTeam = async (name: string) => {
    const created = await api<ApiTeam>("/teams", "POST", { name });
    await api(`/teams/${created.id}/event-squads`, "POST");
    setTeam(created); setNeedsTeam(false);
  };
  const joinTeam = async (invite_code: string) => {
    setTeam(await api<ApiTeam>("/teams/join", "POST", { invite_code })); setNeedsTeam(false);
  };
  const launch = async (brief: string) => {
    if (!team || views.length !== 3) throw new Error("This team needs its three event squads.");
    await api(`/teams/${team.id}/missions`, "POST", { brief, venue_squad_id: views[0].squad.id, promo_squad_id: views[1].squad.id, logistics_squad_id: views[2].squad.id });
    await refresh();
  };

  const teams: Team[] | null = team && views.length ? [
    ...views.map((view, i) => ({ ...DEN_STYLES[i], id: view.squad.id, name: view.squad.name, agents: view.agents.map((agent, j) => agentView(agent, j, view, i * 4)) })),
    { ...DEN_STYLES[3], id: "rival", name: "Rival team · private", agents: [] },
  ] : null;

  return { session, team, needsTeam, views, teams, error, createTeam, joinTeam, launch };
}
