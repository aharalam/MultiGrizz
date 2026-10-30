import { SLOTS, STATUS_COLOR, STATUS_LABEL, type Team } from "@/lib/teams";

// Fortnite-style squad list: one row per agent, the bar is task progress instead of health.
export default function SquadBar({ team, title, active, onPick }: {
  team: Team;
  title: string;
  active: number | null;
  onPick(slot: number): void;
}) {
  return (
    <section className="w-[300px] select-none" aria-label={`${team.name} agents`}>
      <header className="mb-2 flex items-baseline gap-2 pl-1">
        <span className="font-pixel text-[13px] uppercase tracking-[0.18em] text-[#ff4f8b]">{title}</span>
        <span className="font-hand text-sm text-white/60">{team.agents.length}/{SLOTS} bears</span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {team.agents.map((ag, i) => {
          const on = active === i;
          const color = STATUS_COLOR[ag.status];
          return (
            <li key={ag.id}>
              <button
                onClick={() => onPick(i)}
                className={`group flex w-full items-center gap-2.5 rounded-md border px-2 py-1.5 text-left backdrop-blur-sm transition ${
                  on ? "border-[#ff4f8b] bg-black/70" : "border-white/10 bg-black/45 hover:bg-black/60"
                }`}
              >
                <span
                  className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border-2 bg-[#2a2336]"
                  style={{ borderColor: team.color }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ag.art} alt="" className="absolute left-1/2 top-0 h-[180%] max-w-none -translate-x-1/2" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-pixel truncate text-[15px] uppercase tracking-wide text-white">{ag.name}</span>
                    <span className="font-pixel text-[11px] uppercase" style={{ color }}>{STATUS_LABEL[ag.status]}</span>
                  </span>
                  <span className="mt-1 block h-2.5 -skew-x-12 overflow-hidden rounded-[2px] bg-white/15">
                    <span
                      className="block h-full transition-[width] duration-700 ease-out"
                      style={{ width: `${ag.progress}%`, background: color, boxShadow: `0 0 8px ${color}` }}
                    />
                  </span>
                  <span className="font-hand mt-0.5 block truncate text-[13px] leading-tight text-white/70">{ag.activity}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
