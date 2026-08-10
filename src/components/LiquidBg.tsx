"use client";

import { useEffect, useRef } from "react";

type Blob = { x: number; y: number; r: number; vx: number; vy: number; hue: string };

export default function LiquidBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;

    const colors = ["61,255,139", "255,194,75", "61,255,139"];

    let blobs: Blob[] = [];

    const build = () => {
      const count = Math.max(4, Math.min(Math.floor((w * h) / 90000), 7));
      blobs = Array.from({ length: count }, (_, i) => ({
        x: (i / count) * w + (Math.random() - 0.5) * w * 0.2,
        y: Math.random() * h,
        r: Math.min(w, h) * (0.22 + Math.random() * 0.14),
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        hue: colors[i % colors.length],
      }));
    };

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    };

    const draw = () => {
      t += 0.004;
      ctx.clearRect(0, 0, w, h);

      for (const b of blobs) {
        b.x += Math.sin(t + b.y * 0.001) * 0.35 + b.vx;
        b.y += Math.cos(t + b.x * 0.001) * 0.3 + b.vy;
        if (b.x < -b.r) b.x = w + b.r;
        if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r;
        if (b.y > h + b.r) b.y = -b.r;

        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(${b.hue},0.09)`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="liquid-bg" aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
