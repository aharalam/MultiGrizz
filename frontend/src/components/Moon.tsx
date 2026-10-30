"use client";
import { useEffect, useRef } from "react";
import { drawMoon } from "@/lib/art";

// The intro's crescent moon, hanging over the site with its cloud wisps drifting past.
export default function Moon({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const draw = (now: number) => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const size = c.clientWidth;
      if (c.width !== size * dpr) c.width = c.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      drawMoon(ctx, size / 2, size / 2, size * 0.2, now / 1000);
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
