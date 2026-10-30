"use client";
import { useEffect, useRef } from "react";
import { drawMoon } from "@/lib/art";

// Forest fly-through intro: eyes open, the grizzly mark surfaces, the camera flies
// through it and a circle opens onto the dens. ~4 s; click, key or "Skip" ends it.
const T = { eyes: 150, pop: 650, word: 950, dolly: 1750, pass: 1900, reveal: 3150, end: 4050 };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const expoOut = (x: number) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));
const quartIn = (x: number) => x * x * x * x;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export default function Intro({ onReveal, onDone }: { onReveal(): void; onDone(): void }) {
  const root = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const markSvg = useRef<SVGSVGElement>(null);
  const word = useRef<HTMLParagraphElement>(null);
  const cb = useRef({ onReveal, onDone });
  cb.current = { onReveal, onDone };

  useEffect(() => {
    const canvas = cv.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // seeded so the forest is the same every load
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const FAR = 90;
    const trees: { x: number; z: number; h: number; w: number; tiers: number }[] = [];
    for (let i = 0; i < 230; i++) {
      let x = (rnd() * 2 - 1) * 16;
      const z = 1.5 + rnd() * FAR;
      const gap = 1.3 + z * 0.02; // corridor for the camera
      if (Math.abs(x) < gap) x = Math.sign(x || 1) * (gap + rnd() * 1.2);
      trees.push({ x, z, h: 5 + rnd() * 6, w: 1.3 + rnd() * 1.1, tiers: 4 + Math.floor(rnd() * 3) });
    }
    const embers = Array.from({ length: 70 }, () => ({
      x: (rnd() * 2 - 1) * 10, y: rnd() * 5, z: 2 + rnd() * 40, s: 0.6 + rnd() * 1.4, v: 0.2 + rnd() * 0.4, p: rnd() * 6.28,
    }));

    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    addEventListener("resize", resize);
    resize();

    const NEAR = [6, 4, 5], FOG = [58, 22, 26];
    const treeColor = (rz: number) => {
      const k = Math.pow(clamp(rz / FAR), 0.7);
      return `rgb(${mix(NEAR[0], FOG[0], k) | 0},${mix(NEAR[1], FOG[1], k) | 0},${mix(NEAR[2], FOG[2], k) | 0})`;
    };
    const drawPine = (sx: number, gy: number, scale: number, t: (typeof trees)[number]) => {
      const h = t.h * scale, w = t.w * scale;
      ctx.fillRect(sx - w * 0.06, gy - h * 0.22, w * 0.12, h * 0.22);
      for (let i = 0; i < t.tiers; i++) {
        const k = i / t.tiers;
        const base = gy - h * (0.12 + k * 0.72);
        const tw = w * (1 - k * 0.75);
        ctx.beginPath();
        ctx.moveTo(sx - tw, base);
        ctx.lineTo(sx, base - h * 0.34);
        ctx.lineTo(sx + tw, base);
        ctx.closePath();
        ctx.fill();
      }
    };

    const drawForest = (t: number, camZ: number, speed: number) => {
      const f = H * 0.95, cx = W / 2, horizon = H * 0.56, camY = 1.7;
      const glow = 0.55 + 0.45 * span(t, 0, 1200) + span(t, T.reveal - 400, T.reveal + 300) * 1.4;
      const sky = ctx.createRadialGradient(cx, horizon - H * 0.05, 0, cx, horizon, Math.max(W, H) * 0.75);
      sky.addColorStop(0, `rgba(120,30,28,${0.55 * glow})`);
      sky.addColorStop(0.35, "rgba(46,14,16,0.8)");
      sky.addColorStop(1, "#070506");
      ctx.globalAlpha = speed > 0.02 ? clamp(1 - speed * 9, 0.35, 1) : 1; // smear = cheap motion blur
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      drawMoon(ctx, cx, H * 0.3, Math.min(W, H) * 0.12, t / 1000); // behind the trees

      const ground = ctx.createLinearGradient(0, horizon, 0, H);
      ground.addColorStop(0, "#1d0d10");
      ground.addColorStop(1, "#050304");
      ctx.fillStyle = ground;
      ctx.fillRect(0, horizon, W, H - horizon);

      const visible: [number, (typeof trees)[number]][] = [];
      for (const tr of trees) {
        let rz = tr.z - camZ;
        while (rz < 0.25) rz += FAR;
        visible.push([rz, tr]);
      }
      visible.sort((a, b) => b[0] - a[0]);
      for (const [rz, tr] of visible) {
        const scale = f / rz;
        const sx = cx + tr.x * scale * 0.42;
        if (sx < -tr.w * scale || sx > W + tr.w * scale) continue;
        ctx.fillStyle = treeColor(rz);
        drawPine(sx, horizon + camY * scale * 0.18, scale * 0.42, tr);
      }

      const fog = ctx.createLinearGradient(0, horizon - H * 0.18, 0, horizon + H * 0.12);
      fog.addColorStop(0, "rgba(58,22,26,0)");
      fog.addColorStop(0.55, "rgba(70,24,28,0.35)");
      fog.addColorStop(1, "rgba(58,22,26,0)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, horizon - H * 0.18, W, H * 0.3);

      for (const e of embers) {
        let rz = e.z - camZ * 0.9;
        while (rz < 0.4) rz += 40;
        const scale = f / rz;
        const y = (e.y + (t / 1000) * e.v) % 6;
        const sx = cx + (e.x + Math.sin(t / 900 + e.p) * 0.3) * scale * 0.42;
        const sy = horizon - y * scale * 0.42 * 0.6;
        const r = Math.max(0.6, e.s * scale * 0.012);
        const a = clamp(1 - rz / 40) * (0.5 + 0.5 * Math.sin(t / 300 + e.p));
        ctx.fillStyle = `rgba(255,${(80 + e.p * 10) | 0},60,${a * 0.85})`;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill();
      }

      const dark = 1 - expoOut(span(t, 0, 1100));
      if (dark > 0) { ctx.fillStyle = `rgba(5,3,4,${dark})`; ctx.fillRect(0, 0, W, H); }
      const v = ctx.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.3, cx, H * 0.5, Math.max(W, H) * 0.8);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    };

    const setMark = (t: number) => {
      const eyes = expoOut(span(t, T.eyes, T.eyes + 450));
      const pop = expoOut(span(t, T.pop, T.pop + 700));
      const w = expoOut(span(t, T.word, T.word + 650));
      const pass = span(t, T.pass, T.pass + 650);
      const passE = quartIn(pass) * 0.6 + pass * 0.4;
      const svg = markSvg.current!.style, wd = word.current!.style, m = mark.current!.style;
      svg.opacity = String(eyes);
      svg.filter = `brightness(${mix(0.15, 1, pop)})`;
      svg.transform = `scale(${mix(0.72, 1, pop)}) translateY(${mix(14, 0, pop)}px)`;
      wd.clipPath = `inset(0 ${100 - w * 100}% 0 0)`;
      wd.transform = `translateY(${mix(10, 0, w)}px)`;
      m.transform = `translate(-50%, -50%) scale(${1 + passE * 5})`; // camera flies through the mark
      m.opacity = String(1 - clamp(pass * 1.4));
      m.filter = pass > 0 ? `blur(${pass * 14}px)` : "none";
    };

    let revealed = false;
    const reveal = () => {
      if (!revealed) { revealed = true; cb.current.onReveal(); }
    };
    // the dens show through a growing hole in the intro
    const setHole = (k: number) => {
      const r = `${k * 150}%`;
      const mask = `radial-gradient(circle at 50% 46%, transparent ${r}, #000 calc(${r} + 1px))`;
      root.current!.style.maskImage = mask;
      root.current!.style.webkitMaskImage = mask;
    };

    let start = 0, raf = 0, lastZ = 0, done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      reveal();
      cb.current.onDone();
    };
    const frame = (now: number) => {
      const t = now - start;
      const d = span(t, T.dolly, T.reveal + 500);
      const camZ = quartIn(d) * 70 + d * 6;
      const speed = camZ - lastZ;
      lastZ = camZ;
      drawForest(t, camZ, speed / 3);
      setMark(t);
      const k = expoOut(span(t, T.reveal, T.end));
      if (k > 0) { reveal(); setHole(k); }
      if (t < T.end) raf = requestAnimationFrame(frame);
      else finish();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key !== "Tab") finish(); };

    let fade: ReturnType<typeof setTimeout> | undefined;
    if (reduce) {
      drawForest(1600, 0, 0);
      setMark(1700);
      fade = setTimeout(finish, 1400);
    } else {
      addEventListener("keydown", onKey);
      start = performance.now();
      raf = requestAnimationFrame(frame);
    }
    const el = root.current!;
    el.addEventListener("click", finish);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fade);
      removeEventListener("resize", resize);
      removeEventListener("keydown", onKey);
      el.removeEventListener("click", finish);
    };
  }, []);

  return (
    <div ref={root} className="fixed inset-0 z-50 cursor-pointer bg-[#0a0708]" aria-hidden="true">
      <canvas ref={cv} className="absolute inset-0 block h-full w-full" />
      <div ref={mark} className="pointer-events-none absolute left-1/2 top-[46%] flex flex-col items-center gap-[18px]" style={{ transform: "translate(-50%,-50%)" }}>
        {/* hidden until the animation brings it in, so no static logo shows while the page loads */}
        <svg ref={markSvg} viewBox="0 0 120 120" className="h-auto w-[clamp(108px,18vmin,168px)] overflow-visible" style={{ opacity: 0 }}>
          <circle cx="28" cy="30" r="17" fill="#1e1416" />
          <circle cx="92" cy="30" r="17" fill="#1e1416" />
          <circle cx="28" cy="31" r="8" fill="#5a1913" />
          <circle cx="92" cy="31" r="8" fill="#5a1913" />
          <path d="M60 20C89 20 106 39 106 64c0 27-21 44-46 44S14 91 14 64c0-25 17-44 46-44Z" fill="#241a1c" stroke="#e23b2e" strokeOpacity=".55" strokeWidth="1.5" />
          <path d="M60 20c-6 9-8 18-6 27M60 20c6 9 8 18 6 27" stroke="#3a2a2d" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="60" cy="82" rx="22" ry="17" fill="#3a2a2c" />
          <path d="M51 72h18c0 6-5 10-9 10s-9-4-9-10Z" fill="#0a0708" />
          <path d="M60 82v7M53 92c4 3 10 3 14 0" stroke="#0a0708" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M33 55l18 5-3 6-13-3Z" fill="#ff5a43" style={{ filter: "drop-shadow(0 0 6px rgba(255,70,50,.9))" }} />
          <path d="M87 55l-18 5 3 6 13-3Z" fill="#ff5a43" style={{ filter: "drop-shadow(0 0 6px rgba(255,70,50,.9))" }} />
        </svg>
        <p ref={word} className="font-pixel m-0 text-[clamp(40px,8vmin,88px)] leading-none text-[#f1e9e7] [text-shadow:0_6px_30px_rgba(0,0,0,.8)]" style={{ clipPath: "inset(0 100% 0 0)" }}>
          Multi<span className="text-[#ff4f8b]">Grizz</span>
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); root.current?.click(); }}
        className="absolute bottom-[18px] right-5 cursor-pointer border-0 bg-transparent px-2.5 py-2 font-mono text-xs tracking-wide text-[#a8999a] opacity-70 hover:text-white hover:opacity-100"
      >
        Skip intro
      </button>
    </div>
  );
}
