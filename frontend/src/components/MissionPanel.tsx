"use client";
import { useState } from "react";
import { supabase } from "@/lib/backend";
import type { useLive } from "@/lib/live";

const BRIEF = "Organize a networking event for 50 people on December 12 at 6 PM near Oakland University in Rochester Hills, Michigan. Find an available venue, create a promotional flyer and video, invite 50 people through email with an option to save the event to their calendars, and set up a reminder 24 hours before the event. If the venue is unavailable, find alternative dates and suggest the best option.";

// Flyer HTML is model-written: shown only in a sandboxed iframe with scripts disabled.
function flyerOf(raw: string): string | null {
  // The model sometimes writes its HTML entity-escaped (&lt;div …); decode before matching.
  const text = raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const match = /<(?:!doctype|html|div|section|body)[\s\S]*<\/(?:html|div|section|body)>/i.exec(text);
  return match ? match[0] : null;
}

const KIND_STYLE = { note: "text-white/60", result: "text-[#5bd16e]", handoff: "text-[#ff8c2b]" } as const;

export default function MissionPanel({ live, focus }: { live: ReturnType<typeof useLive>; focus: number | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [brief, setBrief] = useState(BRIEF);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const act = (fn: () => Promise<unknown>) => async () => {
    setBusy(true); setMessage(null);
    try { await fn(); } catch (e) { setMessage(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); }
  };
  const input = "w-full rounded-md border border-white/15 bg-black/50 px-2 py-1.5 font-hand text-base text-white placeholder:text-white/40";
  const button = "font-pixel rounded-md bg-[#ff4f8b] px-3 py-1.5 text-sm text-black disabled:opacity-50";

  let body;
  if (!supabase) {
    body = <p className="font-hand text-white/70">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to connect to the backend. Showing demo bears.</p>;
  } else if (!live.session) {
    body = (
      <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); act(async () => {
        const { error } = await supabase!.auth.signInWithPassword({ email, password });
        if (error) throw error;
      })(); }}>
        <input className={input} placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        <input className={input} placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <button className={button} disabled={busy}>Sign in</button>
      </form>
    );
  } else if (live.needsTeam) {
    body = (
      <div className="flex flex-col gap-2">
        <button className={button} disabled={busy} onClick={act(() => live.createTeam("Event Team"))}>Create team with event squads</button>
        <div className="flex gap-2">
          <input className={input} placeholder="invite code" value={code} onChange={(e) => setCode(e.target.value.trim())} />
          <button className={button} disabled={busy || !code} onClick={act(() => live.joinTeam(code))}>Join</button>
        </div>
      </div>
    );
  } else {
    const view = focus !== null ? live.views[focus] : undefined;
    const active = live.views.some((v) => v.run && (v.run.status === "queued" || v.run.status === "running"));
    const nameOf = (id: string | null) => live.views.find((v) => v.squad.id === id)?.squad.name ?? "another squad";
    body = (
      <div className="flex min-h-0 flex-col gap-2">
        <div className="font-hand text-sm text-white/60">team {live.team?.name} · invite <span className="select-all font-mono text-xs">{live.team?.invite_code}</span></div>
        <textarea className={`${input} h-24 resize-none text-sm`} value={brief} onChange={(e) => setBrief(e.target.value)} />
        <button className={button} disabled={busy || active || !brief.trim()} onClick={act(() => live.launch(brief))}>
          {active ? "Mission running…" : "Launch mission"}
        </button>
        <div className="flex gap-2 font-pixel text-[11px] uppercase">
          {live.views.map((v) => <span key={v.squad.id} className="rounded bg-black/50 px-1.5 py-0.5">{v.squad.name.split(" ")[0]}: {v.run?.status ?? "idle"}</span>)}
        </div>
        {view ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="font-pixel mb-1 text-sm text-[#fff3dc]">{view.squad.name} context</div>
            {view.entries.length === 0 && <p className="font-hand text-white/60">Nothing yet. This squad only sees its own notes, results, and handoffs.</p>}
            {[...view.entries].reverse().map((entry) => {
              const flyer = entry.kind !== "note" ? flyerOf(entry.content) : null;
              return (
                <article key={entry.id} className="mb-2 rounded-md border border-white/10 bg-black/45 p-2">
                  <div className={`font-pixel text-[11px] uppercase ${KIND_STYLE[entry.kind]}`}>
                    {entry.kind === "handoff" ? `handoff from ${nameOf(entry.source_squad_id)}` : entry.kind}
                  </div>
                  {flyer && <iframe title="Flyer" sandbox="" srcDoc={flyer} className="my-1 h-72 w-full rounded bg-white" />}
                  <pre className="whitespace-pre-wrap break-words font-sans text-xs text-white/85">{entry.content}</pre>
                </article>
              );
            })}
          </div>
        ) : <p className="font-hand text-white/60">Open a den to read that squad&apos;s private context.</p>}
      </div>
    );
  }

  return (
    <aside className="absolute right-5 top-20 z-10 flex max-h-[calc(100dvh-11rem)] w-[380px] flex-col gap-2 rounded-lg border border-white/10 bg-[#120d22]/80 p-3 backdrop-blur">
      <div className="font-pixel text-[13px] uppercase tracking-[0.18em] text-[#ff4f8b]">Event mission</div>
      {body}
      {(message || live.error) && <p className="font-hand text-sm text-[#ff8c2b]">{message ?? live.error}</p>}
    </aside>
  );
}
