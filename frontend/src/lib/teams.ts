"use client";
import { useCallback, useEffect, useState } from "react";

export type Role = "researcher" | "coder" | "writer" | "planner";
export type Status = "idle" | "thinking" | "tool" | "done";
export type Species = "grizzly" | "polar" | "panda" | "black";
export type Costume =
  | "vampire" | "witch" | "frankenstein" | "skeleton" | "mummy" | "ghost" | "wizard"
  | "pirate" | "pumpkin" | "zombie" | "bat" | "reaper" | "devil" | "scarecrow";

export type Agent = {
  id: string;
  name: string;
  role: Role;
  costume: Costume;
  description: string;
  status: Status;
  progress: number; // 0..100
  activity: string;
  art: string; // paper cut-out PNG in /public/bears
};

export type Team = {
  id: string;
  species: Species;
  name: string;
  color: string; // carousel walls
  ink: string; // text on paper
  agents: Agent[];
};

export const SLOTS = 6;
export const MY_TEAM = 0;

export const STATUS_LABEL: Record<Status, string> = {
  idle: "napping",
  thinking: "thinking",
  tool: "using a tool",
  done: "done",
};
export const STATUS_COLOR: Record<Status, string> = {
  idle: "#8a8478",
  thinking: "#b07cff",
  tool: "#ff8c2b",
  done: "#5bd16e",
};

const WORK: Record<Role, string[]> = {
  researcher: ["Digging up sources", "Reading 14 pages", "Cross-checking facts", "Summarizing findings"],
  coder: ["Reading the codebase", "Writing a route handler", "Running the tests", "Fixing a type error"],
  writer: ["Outlining the pitch", "Drafting the copy", "Polishing the wording", "Trimming to 2 minutes"],
  planner: ["Splitting the goal", "Assigning tasks", "Checking handoffs", "Updating the plan"],
};

const a = (
  id: string, name: string, role: Role, costume: Costume, description: string, art = `/bears/${id}.png`,
): Agent => ({ id, name, role, costume, description, status: "idle", progress: 0, activity: "Waiting for a task", art });

const INITIAL: Team[] = [
  {
    id: "grizzly", species: "grizzly", name: "Golden Grizzlies", color: "#b8862f", ink: "#5a3a12",
    agents: [
      a("bruno", "Bruno", "researcher", "vampire", "Hunts down sources after dark and drains them for facts."),
      a("honey", "Honey", "writer", "witch", "Brews rough notes into a pitch judges remember."),
      a("kodi", "Kodi", "coder", "frankenstein", "Stitches route handlers together until they come alive."),
      a("ursa", "Ursa", "planner", "skeleton", "Keeps the bare bones of the plan in order."),
    ],
  },
  {
    id: "polar", species: "polar", name: "Frost Fangs", color: "#4f8fa8", ink: "#1d4556",
    agents: [
      a("blizzard", "Blizzard", "coder", "mummy", "Wraps every function in tests before shipping."),
      a("floe", "Floe", "researcher", "ghost", "Drifts through docs nobody else reads."),
      a("aurora", "Aurora", "writer", "wizard", "Conjures release notes out of thin air."),
      a("tundra", "Tundra", "planner", "pirate", "Charts the route from idea to demo."),
    ],
  },
  {
    id: "panda", species: "panda", name: "Bamboo Banshees", color: "#6f9a5b", ink: "#2c4a22",
    agents: [
      a("mochi", "Mochi", "writer", "pumpkin", "Carves clear copy out of messy notes."),
      a("bao", "Bao", "coder", "zombie", "Never sleeps, keeps eating bugs."),
      a("lin", "Lin", "researcher", "bat", "Echolocates the one useful forum post."),
    ],
  },
  {
    id: "black", species: "black", name: "Midnight Paws", color: "#7a4f8f", ink: "#3a1f48",
    agents: [
      a("shadow", "Shadow", "planner", "reaper", "Harvests tasks before deadlines can."),
      a("ember", "Ember", "coder", "devil", "Speedruns builds, cursed or not."),
      a("juniper", "Juniper", "researcher", "scarecrow", "Guards the field of findings."),
    ],
  },
];

const SPARE: Pick<Agent, "name" | "role" | "costume" | "description">[] = [
  { name: "Pumpkin", role: "writer", costume: "pumpkin", description: "Freshly summoned, ready to write." },
  { name: "Wisp", role: "researcher", costume: "ghost", description: "Freshly summoned, ready to dig." },
  { name: "Fang", role: "coder", costume: "vampire", description: "Freshly summoned, ready to code." },
  { name: "Hex", role: "planner", costume: "witch", description: "Freshly summoned, ready to plan." },
];

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// Mock agent loop. ponytail: replace with Supabase Realtime once the backend is up; keep this hook's shape.
function tick(agent: Agent): Agent {
  const r = Math.random();
  if (agent.status === "idle") {
    return r < 0.12 ? { ...agent, status: "thinking", progress: 2, activity: pick(WORK[agent.role]) } : agent;
  }
  if (agent.status === "done") {
    return r < 0.1 ? { ...agent, status: "idle", progress: 0, activity: "Waiting for a task" } : agent;
  }
  const progress = Math.min(100, agent.progress + 1 + Math.random() * 6);
  if (progress >= 100) return { ...agent, status: "done", progress: 100, activity: "Handed off results" };
  if (r < 0.15) {
    return { ...agent, progress, status: agent.status === "thinking" ? "tool" : "thinking", activity: pick(WORK[agent.role]) };
  }
  return { ...agent, progress };
}

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>(INITIAL);

  useEffect(() => {
    // kick a few agents off so the first screen is busy
    setTeams((ts) => ts.map((t) => ({
      ...t,
      agents: t.agents.map((ag, i) =>
        i % 2 ? ag : { ...ag, status: "thinking", progress: 10 + Math.random() * 50, activity: pick(WORK[ag.role]) }),
    })));
    const id = setInterval(() => setTeams((ts) => ts.map((t) => ({ ...t, agents: t.agents.map(tick) }))), 800);
    return () => clearInterval(id);
  }, []);

  const summon = useCallback((teamIndex: number) => {
    setTeams((ts) => ts.map((t, i) => {
      if (i !== teamIndex || t.agents.length >= SLOTS) return t;
      const s = pick(SPARE);
      // ponytail: a summoned bear borrows a teammate's cut-out until per-agent art generation exists
      const twin = pick(t.agents);
      return { ...t, agents: [...t.agents, a(`${t.id}-${Date.now()}`, s.name, s.role, twin.costume, s.description, twin.art)] };
    }));
  }, []);

  return { teams, summon };
}
