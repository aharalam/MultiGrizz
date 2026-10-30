"use client";
import { useState } from "react";
import BearWorld from "@/components/BearWorld";
import Intro from "@/components/Intro";
import Moon from "@/components/Moon";
import SquadBar from "@/components/SquadBar";
import { MY_TEAM, useTeams } from "@/lib/teams";

export default function Home() {
  const { teams, summon } = useTeams();
  const [focus, setFocus] = useState<number | null>(null);
  const [bay, setBay] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [diving, setDiving] = useState(true); // camera waits high up until the intro opens
  const [intro, setIntro] = useState(true);

  const shown = teams[focus ?? MY_TEAM];
  const agent = focus === null ? undefined : shown.agents[bay];

  const go = (i: number | null) => {
    setFocus(i);
    setBay(0);
    setHover(null);
  };
  const pickBay = (b: number) => {
    setBay(b);
    setTouched(true);
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#120d22] text-white">
      {/* moon: lights the sky in every view */}
      <Moon className="pointer-events-none absolute left-1/2 top-0 z-[1] h-[clamp(150px,24vmin,240px)] w-[clamp(150px,24vmin,240px)] -translate-x-1/2" />
      <BearWorld
        intro={diving}
        teams={teams}
        focus={focus}
        bay={bay}
        hover={hover}
        onHover={setHover}
        onFocus={go}
        onBay={pickBay}
        onSummon={summon}
      />

      {/* moonlight wash from the top, then a soft vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(190,180,255,.16),transparent_70%)] mix-blend-screen" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,.6)]" />

      <div className="absolute left-4 top-4">
        <SquadBar
          team={shown}
          title={focus === null ? "Your squad" : shown.name}
          active={focus === null ? null : bay}
          onPick={(i) => {
            if (focus === null) setFocus(MY_TEAM);
            pickBay(i);
          }}
        />
      </div>

      <div className="pointer-events-none absolute right-5 top-4 text-right">
        <div className="font-pixel text-3xl leading-none">
          Multi<span className="text-[#ff4f8b]">·</span>Grizz
        </div>
        <div className="font-hand text-base text-white/60">spooky agent dens · Hacktoberfest × GrizzHacks</div>
      </div>

      {/* banner: who is in the den you're looking at */}
      <div className="pointer-events-none absolute bottom-24 left-5 max-w-md">
        {focus === null ? (
          <>
            <div className="font-hand text-lg text-white/70">{hover === null ? "four dens round the fire" : `${teams[hover].species} bears`}</div>
            <div className="font-pixel text-4xl">{hover === null ? "Pick a den" : teams[hover].name}</div>
          </>
        ) : agent ? (
          <>
            <div className="font-hand text-lg text-white/70">den {bay + 1} · the {agent.role} · {agent.costume}</div>
            <div className="font-pixel text-5xl text-[#fff3dc]">{agent.name}</div>
          </>
        ) : (
          <>
            <div className="font-hand text-lg text-white/70">den {bay + 1}</div>
            <div className="font-pixel text-4xl text-[#ff4f8b]">Empty den</div>
            <div className="font-hand mt-1 text-xl text-white/80">Click the den to summon a new bear.</div>
          </>
        )}
      </div>

      {/* team tabs */}
      <nav className="absolute bottom-5 left-5 flex items-end gap-1.5">
        <button
          onClick={() => go(null)}
          className={`font-pixel rounded-t-md border border-b-0 border-white/15 px-3 text-sm transition-all ${
            focus === null ? "h-11 bg-[#ff4f8b] text-black" : "h-9 bg-black/50 text-white/80 hover:bg-black/70"
          }`}
        >
          ← All dens
        </button>
        {teams.map((t, i) => (
          <button
            key={t.id}
            onClick={() => go(i)}
            className={`font-pixel rounded-t-md px-3 text-sm text-white transition-all ${focus === i ? "h-11 border-b-4 border-[#ff4f8b]" : "h-9 opacity-80 hover:opacity-100"}`}
            style={{ background: t.color }}
          >
            {t.name}
          </button>
        ))}
      </nav>

      {focus !== null && (
        <div className="absolute bottom-6 right-5 flex gap-2">
          {[-1, 1].map((d) => (
            <button
              key={d}
              aria-label={d < 0 ? "previous den" : "next den"}
              onClick={() => pickBay((bay + d + 6) % 6)}
              className="font-pixel h-11 w-11 rounded-full border border-white/20 bg-black/50 text-xl hover:bg-black/70"
            >
              {d < 0 ? "‹" : "›"}
            </button>
          ))}
        </div>
      )}

      {!touched && (
        <div className="font-hand pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 text-lg text-white/60">
          {focus === null ? "~ click a den to step inside ~" : "~ scroll, drag or use ← → to meet each bear · esc to leave ~"}
        </div>
      )}
      {intro && <Intro onReveal={() => setDiving(false)} onDone={() => setIntro(false)} />}
    </main>
  );
}
